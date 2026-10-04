import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import SpeakingPractice, { RecordingCard, SpeakingRecordingReview, SpeakingSaveGate, SpeakingStorageManager } from '../src/SpeakingPractice'
import { alignRepeatTranscript, coachSpeakingText } from '../src/speakingCoach'
import { SPEAKING_CLIP_LIMIT, SpeakingCapture, deleteSpeakingRecording, deleteSpeakingSessionRecordings, listSpeakingRecordingSessions, listSpeakingRecordings, saveSpeakingRecording, type SpeakingRecording } from '../src/speakingRecordings'
import type { BaseItem } from '../src/types'

const item: BaseItem = { id: 'speaking-test', section: 'speaking', kind: 'repeat', module: 1, title: 'Repeat', instruction: 'Repeat the sentence.', audioText: 'Please return the library book tomorrow.', timeSeconds: 10, responseTimeSeconds: 8 }
const clip = (id: string, sessionId = 'test-session', size = 12): SpeakingRecording => ({ version: 1, id, sessionId, itemId: item.id, createdAt: new Date().toISOString(), duration: 2, blob: new Blob([new Uint8Array(size)], { type: 'audio/webm' }), mimeType: 'audio/webm', transcript: 'Please return the book tomorrow.' })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers() })

/** Minimal event-driven IDB double: assertions exercise commit/abort, not a fallback. */
function indexedDbDouble(initial: SpeakingRecording[] = [], failWrite = false) {
  const rows = new Map(initial.map((record) => [record.id, record]))
  const metas = new Map(initial.map((record) => [record.id, { id: record.id, sessionId: record.sessionId, bytes: record.blob.size }]))
  const db = { close: vi.fn(), transaction: (_name: string | string[], mode: string) => {
    const transaction: any = { error: null, oncomplete: null, onabort: null, onerror: null }
    let pending = false, aborted = false
    const finish = () => setTimeout(() => { if (!aborted) transaction.oncomplete?.() }, 0)
    transaction.abort = () => { aborted = true; queueMicrotask(() => transaction.onabort?.()) }
    transaction.objectStore = (name: string) => ({
      getAll: () => { const request: any = {}; queueMicrotask(() => { request.result = name === 'metadata' ? [...metas.values()] : [...rows.values()]; request.onsuccess?.({ target: request }); if (mode === 'readonly' || !pending) finish() }); return request },
      index: () => ({ getAll: (session: string) => { const request: any = {}; queueMicrotask(() => { request.result = [...rows.values()].filter((record) => record.sessionId === session); request.onsuccess?.({ target: request }); finish() }); return request } }),
      put: (record: any) => { pending = true; if (failWrite) { transaction.error = new Error('Quota exceeded'); transaction.abort() } else { if (name === 'metadata') metas.set(record.id, record); else rows.set(record.id, record); finish() } },
      delete: (id: string) => { if (name === 'metadata') metas.delete(id); else rows.delete(id); finish() },
    })
    return transaction
  } }
  vi.stubGlobal('indexedDB', { open: () => { const request: any = {}; queueMicrotask(() => { request.result = db; request.onsuccess?.() }); return request } })
  return rows
}

describe('speaking audio preservation', () => {
  it('keeps expiry blocked after a volatile fallback and volatile retry until a persistent retry succeeds', async () => {
    vi.stubGlobal('indexedDB', { open: () => { throw new Error('Unavailable') } })
    const busy = vi.fn(), gate = new SpeakingSaveGate(busy), recording = clip('volatile-expiry', 'volatile-expiry-session')
    const first = await saveSpeakingRecording(recording)
    expect(gate.saveResult(recording.id, first.persistent)).toBe(false)
    expect(busy).toHaveBeenLastCalledWith(true)
    const retry = await saveSpeakingRecording(recording)
    expect(gate.saveResult(recording.id, retry.persistent)).toBe(false)
    expect(gate.pendingId).toBe(recording.id)
    expect(busy).not.toHaveBeenCalledWith(false)
    const html = renderToStaticMarkup(<RecordingCard recording={{ ...recording, unsaved: true }} item={item} coachEnabled={false} onDelete={() => {}} onRecovered={() => {}} />)
    expect(html).toContain('임시 메모리 보관')
    expect(html).toContain('영구 저장되지 않았습니다')
    indexedDbDouble()
    const persistent = await saveSpeakingRecording(recording)
    expect(gate.saveResult(recording.id, persistent.persistent)).toBe(true)
    expect(gate.pendingId).toBeNull()
    expect(busy).toHaveBeenLastCalledWith(false)
    await deleteSpeakingRecording(recording.id)
  })
  it('releases a volatile held clip only after explicit recovery and actually removes its memory copy', async () => {
    vi.stubGlobal('indexedDB', { open: () => { throw new Error('Unavailable') } })
    const recording = clip('volatile-discard', 'volatile-discard-session'), busy = vi.fn(), gate = new SpeakingSaveGate(busy)
    gate.saveResult(recording.id, (await saveSpeakingRecording(recording)).persistent)
    expect(await listSpeakingRecordings(recording.sessionId)).toHaveLength(1)
    expect(busy).not.toHaveBeenCalledWith(false)
    // Same order as the confirmed card handler: remove memory, then release parent.
    await deleteSpeakingRecording(recording.id)
    gate.resolve(recording.id)
    expect(await listSpeakingRecordings(recording.sessionId)).toEqual([])
    expect(busy).toHaveBeenLastCalledWith(false)
  })
  it('blocks mock expiry/Next after a quota-denied completed clip until successful retry or explicit recovery', async () => {
    indexedDbDouble([], true)
    let nextBlocked = true, autoAdvance = false
    const gate = new SpeakingSaveGate((busy) => { nextBlocked = busy; if (!busy) autoAdvance = true })
    const recording = clip('failed-at-module-expiry')
    try { await saveSpeakingRecording(recording) } catch { gate.hold(recording.id) }
    expect(nextBlocked).toBe(true)
    expect(autoAdvance).toBe(false)
    expect(gate.pendingId).toBe(recording.id)
    expect(gate.resolve('unrelated-record')).toBe(false)
    expect(autoAdvance).toBe(false)
    // A failed retry still retains the same single unsaved Blob and hold.
    await expect(saveSpeakingRecording(recording)).rejects.toThrow()
    expect(nextBlocked).toBe(true)
    indexedDbDouble()
    await saveSpeakingRecording(recording)
    expect(gate.resolve(recording.id)).toBe(true)
    expect(nextBlocked).toBe(false)
    expect(autoAdvance).toBe(true)
  })
  it('exposes explicit file-kept/discard recovery choices without claiming failed audio is saved', () => {
    const recover = vi.fn(), recording = { ...clip('failed-recovery'), unsaved: true }
    const html = renderToStaticMarkup(<RecordingCard recording={recording} item={item} coachEnabled={false} onDelete={() => {}} onRecovered={recover} />)
    expect(html).toContain('녹음 다시 저장')
    expect(html).toContain('파일 보관을 확인하고 계속')
    expect(html).toContain('이 녹음을 포기하고 계속')
    expect(html).toContain('시험이 다음으로 넘어가지 않습니다')
    expect(html).not.toContain('이 브라우저에 저장됨')
    expect(recover).not.toHaveBeenCalled()
    const busy = vi.fn(), gate = new SpeakingSaveGate(busy)
    gate.hold(recording.id)
    expect(busy).toHaveBeenLastCalledWith(true)
    gate.resolve(recording.id) // Called only after confirm in the card event handler.
    expect(busy).toHaveBeenLastCalledWith(false)
  })
  it('hides study references and transcription during mock speaking but keeps recording available', () => {
    const studyItem = { ...item, taskChecklist: ['Check every original word.'], commonMistakes: ['Do not omit tomorrow.'], modelResponse: 'REFERENCE ANSWER' }
    const mock = renderToStaticMarkup(<SpeakingPractice item={studyItem} sessionId="mock" coachEnabled={false} onAnswer={() => {}} />)
    expect(mock).toContain('녹음 시작')
    for (const hidden of ['REFERENCE ANSWER', '자가 점검 기준', '흔한 실수', '자동 전사', '받아 적']) expect(mock).not.toContain(hidden)
    const practice = renderToStaticMarkup(<SpeakingPractice item={studyItem} sessionId="practice" coachEnabled onAnswer={() => {}} />)
    for (const visible of ['REFERENCE ANSWER', '자가 점검 기준', '흔한 실수', '자동 전사']) expect(practice).toContain(visible)
  })
  it('hides saved transcript and repeat answer alignment in mock cards without removing preservation controls', () => {
    const recording = clip('mock-card')
    const mock = renderToStaticMarkup(<RecordingCard recording={recording} item={item} coachEnabled={false} onDelete={() => {}} />)
    for (const hidden of ['textarea', recording.transcript, 'speaking-word-alignment', '누락:', '텍스트 코칭', '받아 적은 내용 저장']) expect(mock).not.toContain(hidden)
    expect(mock).toContain('이 녹음 삭제')
    expect(mock).toContain('이 브라우저에 저장됨')
    const unsaved = renderToStaticMarkup(<RecordingCard recording={{ ...recording, unsaved: true }} item={item} coachEnabled={false} onDelete={() => {}} />)
    expect(unsaved).toContain('녹음 다시 저장')
    const review = renderToStaticMarkup(<RecordingCard recording={recording} item={item} coachEnabled onDelete={() => {}} />)
    expect(review).toContain('speaking-word-alignment')
    expect(review).toContain('누락: library')
    expect(review).toContain('textarea')
    expect(review).toContain('로컬 AI로 텍스트 코칭')
  })
  it('commits a Blob and transcript, revisits the session, and deletes only the selected clip', async () => {
    const rows = indexedDbDouble()
    const original = clip('persistent-clip')
    expect((await saveSpeakingRecording(original)).persistent).toBe(true)
    expect((await listSpeakingRecordings(original.sessionId, item.id))[0].blob.size).toBe(original.blob.size)
    expect((await listSpeakingRecordings(original.sessionId))[0].transcript).toBe(original.transcript)
    await deleteSpeakingRecording(original.id)
    expect(rows.size).toBe(0)
  })
  it('does not claim a quota-denied write succeeded or evict an old recording', async () => {
    const old = clip('existing-clip')
    const rows = indexedDbDouble([old], true)
    await expect(saveSpeakingRecording(clip('denied-clip'))).rejects.toThrow('Quota exceeded')
    expect([...rows.keys()]).toEqual([old.id])
  })
  it('refuses size and 51st-session limits without removing user recordings', async () => {
    const existing = Array.from({ length: 50 }, (_, index) => clip(`old-${index}`, `session-${index}`))
    const rows = indexedDbDouble(existing)
    await expect(saveSpeakingRecording(clip('oversized', 'session-1', SPEAKING_CLIP_LIMIT + 1))).rejects.toThrow('5 MiB')
    await expect(saveSpeakingRecording(clip('fifty-first', 'session-51'))).rejects.toThrow('50회')
    expect(rows.size).toBe(50)
    expect((await saveSpeakingRecording(clip('same-session', 'session-1'))).persistent).toBe(true)
  })
  it('refuses the 100 MiB total without auto-eviction or accepting an empty recording', async () => {
    const sharedBlob = new Blob([new Uint8Array(SPEAKING_CLIP_LIMIT)])
    const existing = Array.from({ length: 20 }, (_, index) => ({ ...clip(`large-${index}`), blob: sharedBlob }))
    const rows = indexedDbDouble(existing)
    await expect(saveSpeakingRecording(clip('over-total'))).rejects.toThrow('100 MiB')
    await expect(saveSpeakingRecording(clip('empty', 'test-session', 0))).rejects.toThrow('비어')
    expect(rows.size).toBe(20)
  })
  it('labels IndexedDB denial as volatile memory rather than persistent saved audio', async () => {
    vi.stubGlobal('indexedDB', { open: () => { throw new Error('Disabled') } })
    const result = await saveSpeakingRecording(clip('memory-clip', 'memory-session'))
    expect(result.persistent).toBe(false)
    expect(result.warning).toContain('이 탭에서만')
    expect((await listSpeakingRecordings('memory-session'))[0].id).toBe('memory-clip')
    await deleteSpeakingRecording('memory-clip')
    expect(await listSpeakingRecordings('memory-session')).toEqual([])
  })
  it('lists lightweight session totals and deletes only the confirmed session', async () => {
    const records = [clip('a1', 'session-a'), clip('a2', 'session-a'), clip('b1', 'session-b')]
    const rows = indexedDbDouble(records)
    expect(await listSpeakingRecordingSessions()).toEqual([{ sessionId: 'session-a', clipCount: 2, bytes: 24, volatileCount: 0 }, { sessionId: 'session-b', clipCount: 1, bytes: 12, volatileCount: 0 }])
    await deleteSpeakingSessionRecordings('session-a')
    expect([...rows.keys()]).toEqual(['b1'])
    expect(await listSpeakingRecordings('session-b')).toHaveLength(1)
  })
  it('requires a specific deletion target and exposes a separate audio-management disclosure', async () => {
    await expect(deleteSpeakingSessionRecordings('')).rejects.toThrow('지정되지')
    const html = renderToStaticMarkup(<SpeakingStorageManager />)
    expect(html).toContain('녹음은 자동 삭제하지 않습니다')
    expect(html).toContain('JSON 백업')
    expect(html).toContain('별개입니다')
  })
})

describe('capture lifecycle and navigation', () => {
  function setup() {
    const track = { stop: vi.fn() }
    const stream = { getTracks: () => [track] }
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    class Recorder {
      static isTypeSupported = () => true
      state = 'inactive'; mimeType = 'audio/webm'; ondataavailable: any; onstop: any; onerror: any
      start() { this.state = 'recording' }
      stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['actual audio'], { type: this.mimeType }) }); this.onstop?.() }
    }
    vi.stubGlobal('MediaRecorder', Recorder)
    return { track, stream, getUserMedia }
  }
  it('returns real captured bytes when manually stopped, with a bounded response timer', async () => {
    vi.useFakeTimers(); const { track } = setup(); const complete = vi.fn(), fail = vi.fn()
    const capture = new SpeakingCapture()
    await capture.start(complete, fail, 2)
    await vi.advanceTimersByTimeAsync(2000)
    expect(complete).toHaveBeenCalledOnce()
    expect((complete.mock.calls[0][0] as Blob).size).toBe(12)
    expect(complete.mock.calls[0][1]).toBe(2)
    expect(track.stop).toHaveBeenCalled()
    expect(fail).not.toHaveBeenCalled()
  })
  it('discards only an unfinished clip and suppresses callbacks after navigation', async () => {
    const { track } = setup(); const complete = vi.fn(), fail = vi.fn(); const capture = new SpeakingCapture()
    await capture.start(complete, fail)
    capture.cancel()
    expect(complete).not.toHaveBeenCalled()
    expect(fail).not.toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
  })
  it('stops a stream that arrives after a cancelled permission request', async () => {
    const { track, stream, getUserMedia } = setup(); let resolve: any
    getUserMedia.mockReturnValue(new Promise((done) => { resolve = done }))
    const complete = vi.fn(), capture = new SpeakingCapture()
    const pending = capture.start(complete, vi.fn()); capture.cancel(); resolve(stream); await pending
    expect(track.stop).toHaveBeenCalledOnce()
    expect(complete).not.toHaveBeenCalled()
  })
  it('honors a mock-expiry stop requested while permission is pending', async () => {
    const { track, stream, getUserMedia } = setup(); let resolve: any
    getUserMedia.mockReturnValue(new Promise((done) => { resolve = done }))
    const complete = vi.fn(), capture = new SpeakingCapture()
    const pending = capture.start(complete, vi.fn()); capture.stop(); resolve(stream)
    expect(await pending).toBe(false)
    expect(complete).toHaveBeenCalledOnce()
    expect(track.stop).toHaveBeenCalled()
  })
  it('unblocks mock expiry after ten seconds of an unanswered permission request', async () => {
    vi.useFakeTimers(); const { track, stream, getUserMedia } = setup(); let resolve: any
    getUserMedia.mockReturnValue(new Promise((done) => { resolve = done }))
    const complete = vi.fn(), fail = vi.fn(), capture = new SpeakingCapture()
    const pending = capture.start(complete, fail); capture.stop()
    await vi.advanceTimersByTimeAsync(10000)
    expect(fail.mock.calls[0][0].message).toContain('응답 시간이 끝났지만')
    resolve(stream); await pending
    expect(complete).not.toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalledOnce()
  })
  it('reports microphone denial and allows the caller to reset without saving an empty clip', async () => {
    const { getUserMedia } = setup(); getUserMedia.mockRejectedValue(new Error('denied'))
    const complete = vi.fn(), fail = vi.fn()
    expect(await new SpeakingCapture().start(complete, fail)).toBe(false)
    expect(fail.mock.calls[0][0].message).toContain('권한')
    expect(complete).not.toHaveBeenCalled()
  })
})

describe('optional text-only self review', () => {
  it('aligns changed and omitted words without treating text alignment as pronunciation', () => {
    const alignment = alignRepeatTranscript('Please return the library book tomorrow.', 'Please return the book tomorrow.')
    expect(alignment.some((entry) => entry.status === 'missing' && entry.expected === 'library')).toBe(true)
    expect(alignRepeatTranscript('Please return the book.', 'Please return a book.').some((entry) => entry.status === 'changed')).toBe(true)
    expect(alignRepeatTranscript("I’m ready!", "i'm ready").every((entry) => entry.status === 'match')).toBe(true)
  })
  it('sends text only to the selected existing local model and aborts on cancellation', async () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ model: 'existing-coach:small' }) })
    const request = vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => { init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))) }))
    vi.stubGlobal('fetch', request)
    const controller = new AbortController()
    const pending = coachSpeakingText(item, 'Please return a book tomorrow.', controller.signal)
    const body = JSON.parse(request.mock.calls[0][1].body as string)
    expect(body.model).toBe('existing-coach:small')
    expect(body.messages[0].content).toContain('never audio')
    expect(body.messages[0].content).toContain('Do not assess pronunciation')
    controller.abort()
    await expect(pending).rejects.toThrow('Aborted')
  })
  it('renders study and history with recording limits and no pronunciation score claim', () => {
    const html = renderToStaticMarkup(<SpeakingPractice item={item} sessionId="test" onAnswer={() => {}} coachEnabled />)
    expect(html).toContain('100 MiB')
    expect(html).toContain('자동 삭제하지 않습니다')
    expect(html).toContain('직접 받아 적을 수 있습니다')
    expect(renderToStaticMarkup(<SpeakingRecordingReview sessionId="test" />)).toContain('음성이 포함되지 않습니다')
  })
})
