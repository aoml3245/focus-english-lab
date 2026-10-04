/** Audio stays in this browser's IndexedDB, never localStorage or account exports. */
export const SPEAKING_AUDIO_LIMIT = 100 * 1024 * 1024
export const SPEAKING_CLIP_LIMIT = 5 * 1024 * 1024
export const SPEAKING_SESSION_LIMIT = 50
export type SpeakingRecording = {
  version: 1; id: string; sessionId: string; itemId: string; createdAt: string
  duration: number; mimeType: string; blob: Blob; transcript: string
}
export type RecordingResult = { recording: SpeakingRecording; persistent: boolean; warning?: string }
const memory = new Map<string, SpeakingRecording>()
const persistentIds = new Set<string>()
let storageWarning = ''
const databaseName = 'focus-english-speaking-recordings-v1'
type RecordingMeta = { id: string; sessionId: string; bytes: number }
const metadata = (recording: SpeakingRecording): RecordingMeta => ({ id: recording.id, sessionId: recording.sessionId, bytes: recording.blob.size })

function checkLimits(records: RecordingMeta[], candidate: SpeakingRecording) {
  if (!candidate.blob.size) throw new Error('녹음 데이터가 비어 있어 저장하지 못했습니다.')
  if (candidate.blob.size > SPEAKING_CLIP_LIMIT) throw new Error('녹음 하나의 한도(5 MiB)를 초과했습니다. 파일을 내려받아 보관해 주세요.')
  const others = records.filter((record) => record.id !== candidate.id)
  if (others.some((record) => !Number.isFinite(record.bytes) || record.bytes < 0)) throw new Error('녹음 저장 정보에 문제가 있어 기존 녹음을 보존한 채 저장을 중단했습니다.')
  if (others.reduce((sum, record) => sum + record.bytes, 0) + candidate.blob.size > SPEAKING_AUDIO_LIMIT) throw new Error('녹음 저장 한도(100 MiB)에 도달했습니다. 기존 녹음을 직접 내려받거나 삭제한 뒤 다시 저장해 주세요.')
  const sessions = new Set(others.map((record) => record.sessionId))
  sessions.add(candidate.sessionId)
  if (sessions.size > SPEAKING_SESSION_LIMIT) throw new Error('50회 학습의 녹음이 보관되어 있습니다. 기존 녹음을 직접 삭제한 뒤 다시 저장해 주세요.')
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return }
    const request = indexedDB.open(databaseName, 2)
    let settled = false
    const timeout = setTimeout(() => { settled = true; reject(new Error('녹음 저장소에 연결할 수 없습니다.')) }, 4000)
    request.onupgradeneeded = () => {
      const store = request.result.objectStoreNames.contains('recordings') ? request.transaction!.objectStore('recordings') : request.result.createObjectStore('recordings', { keyPath: 'id' })
      if (!store.indexNames.contains('sessionId')) store.createIndex('sessionId', 'sessionId')
      if (!request.result.objectStoreNames.contains('metadata')) {
        const meta = request.result.createObjectStore('metadata', { keyPath: 'id' })
        // Upgrade old clips one at a time, without materializing the whole audio bank.
        store.openCursor().onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
          if (cursor) { meta.put(metadata(cursor.value as SpeakingRecording)); cursor.continue() }
        }
      }
    }
    request.onsuccess = () => {
      clearTimeout(timeout)
      if (settled) { request.result.close(); return }
      settled = true; resolve(request.result)
    }
    request.onerror = () => { clearTimeout(timeout); settled = true; reject(request.error || new Error('녹음 저장소 오류')) }
    request.onblocked = () => { clearTimeout(timeout); settled = true; reject(new Error('다른 탭이 녹음 저장소를 사용 중입니다.')) }
  })
}

export async function saveSpeakingRecording(recording: SpeakingRecording): Promise<RecordingResult> {
  let db: IDBDatabase
  try { db = await openDatabase(); storageWarning = '' } catch {
    checkLimits([...memory.values()].map(metadata), recording)
    memory.set(recording.id, recording)
    storageWarning = '브라우저 저장소를 사용할 수 없어 이 탭에서만 보관합니다. 새로고침·종료 전에 녹음 파일을 내려받으세요.'
    return { recording, persistent: false, warning: storageWarning }
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(['recordings', 'metadata'], 'readwrite')
      const store = transaction.objectStore('recordings')
      const meta = transaction.objectStore('metadata')
      let limitError: Error | null = null
      meta.getAll().onsuccess = (event) => {
        try {
          checkLimits((event.target as IDBRequest<RecordingMeta[]>).result, recording)
          store.put(recording)
          meta.put(metadata(recording))
        } catch (error) { limitError = error as Error; transaction.abort() }
      }
      transaction.oncomplete = () => resolve()
      transaction.onabort = transaction.onerror = () => reject(limitError || transaction.error || new Error('브라우저 저장 공간 부족 또는 녹음 저장 오류입니다. 파일을 내려받아 보관해 주세요.'))
    })
    memory.delete(recording.id)
    persistentIds.add(recording.id)
    return { recording, persistent: true }
  } finally { db.close() }
}

export async function listSpeakingRecordings(sessionId: string, itemId?: string): Promise<SpeakingRecording[]> {
  let saved: SpeakingRecording[] = []
  let db: IDBDatabase | undefined
  try {
    db = await openDatabase(); storageWarning = ''
    saved = await new Promise<SpeakingRecording[]>((resolve, reject) => {
      const transaction = db!.transaction('recordings', 'readonly')
      const request = transaction.objectStore('recordings').index('sessionId').getAll(sessionId)
      request.onsuccess = () => { saved = request.result }
      transaction.oncomplete = () => resolve(saved)
      transaction.onerror = transaction.onabort = () => reject(transaction.error)
    })
  } catch { storageWarning = '브라우저의 녹음 저장소에 접근하지 못했습니다. 저장된 녹음이 없다는 뜻은 아닙니다. 이 탭의 임시 녹음만 표시합니다.' } finally { db?.close() }
  const combined = new Map([...saved, ...memory.values()].map((record) => [record.id, record]))
  saved.forEach((record) => persistentIds.add(record.id))
  return [...combined.values()].filter((record) => record.sessionId === sessionId && (!itemId || record.itemId === itemId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function isVolatileRecording(id: string) { return memory.has(id) }
export function getSpeakingStorageWarning() { return storageWarning }

export type SpeakingRecordingSession = { sessionId: string; clipCount: number; bytes: number; volatileCount: number }
/** Settings can inspect totals without loading a single audio Blob. */
export async function listSpeakingRecordingSessions(): Promise<SpeakingRecordingSession[]> {
  let stored: RecordingMeta[] = []
  let db: IDBDatabase | undefined
  try {
    db = await openDatabase(); storageWarning = ''
    stored = await new Promise<RecordingMeta[]>((resolve, reject) => {
      const transaction = db!.transaction('metadata', 'readonly')
      const request = transaction.objectStore('metadata').getAll()
      request.onsuccess = () => { stored = request.result }
      transaction.oncomplete = () => resolve(stored)
      transaction.onabort = transaction.onerror = () => reject(transaction.error)
    })
    stored.forEach((record) => persistentIds.add(record.id))
  } catch { storageWarning = '녹음 저장소에 접근하지 못했습니다. 저장된 녹음이 없다는 뜻은 아닙니다. 이 탭의 임시 보관 목록만 표시합니다.' } finally { db?.close() }
  const unique = new Map([...stored, ...[...memory.values()].map(metadata)].map((record) => [record.id, record]))
  const groups = new Map<string, SpeakingRecordingSession>()
  for (const record of unique.values()) {
    const group = groups.get(record.sessionId) || { sessionId: record.sessionId, clipCount: 0, bytes: 0, volatileCount: 0 }
    group.clipCount++; group.bytes += record.bytes; group.volatileCount += memory.has(record.id) ? 1 : 0
    groups.set(record.sessionId, group)
  }
  return [...groups.values()].sort((a, b) => a.sessionId.localeCompare(b.sessionId))
}

/** Caller must obtain explicit confirmation; this never touches learner answer/history data. */
export async function deleteSpeakingSessionRecordings(sessionId: string): Promise<void> {
  if (!sessionId) throw new Error('삭제할 학습 회차가 지정되지 않았습니다.')
  const db = await openDatabase()
  const deletedIds: string[] = []
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(['recordings', 'metadata'], 'readwrite')
      const meta = transaction.objectStore('metadata')
      const request = meta.getAll()
      request.onsuccess = () => {
        for (const record of request.result as RecordingMeta[]) if (record.sessionId === sessionId) {
          deletedIds.push(record.id); transaction.objectStore('recordings').delete(record.id); meta.delete(record.id)
        }
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('이 회차의 녹음을 삭제하지 못했습니다.'))
    })
    for (const [id, recording] of memory) if (recording.sessionId === sessionId) memory.delete(id)
    deletedIds.forEach((id) => persistentIds.delete(id))
  } finally { db.close() }
}

export async function deleteSpeakingRecording(id: string): Promise<void> {
  if (memory.has(id) && !persistentIds.has(id)) { memory.delete(id); return }
  const db = await openDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(['recordings', 'metadata'], 'readwrite')
      transaction.objectStore('recordings').delete(id)
      transaction.objectStore('metadata').delete(id)
      transaction.oncomplete = () => resolve()
      transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('녹음을 삭제하지 못했습니다.'))
    })
    memory.delete(id); persistentIds.delete(id)
  } finally { db.close() }
}

/** A navigation cancellation discards only the unfinished capture, never saved clips. */
export class SpeakingCapture {
  private recorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private cancelled = false
  private timer: ReturnType<typeof setTimeout> | undefined
  private pendingStopTimer: ReturnType<typeof setTimeout> | undefined
  private stopRequested = false
  private onError: ((error: Error) => void) | undefined
  async start(onComplete: (blob: Blob, duration: number) => void, onError: (error: Error) => void, limitSeconds?: number) {
    this.onError = onError
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (this.cancelled) { stream.getTracks().forEach((track) => track.stop()); return }
      this.stream = stream
      const formats = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']
      const mimeType = formats.find((format) => MediaRecorder.isTypeSupported?.(format))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      this.recorder = recorder
      const chunks: Blob[] = []
      let total = 0
      let oversized = false
      const started = Date.now()
      recorder.ondataavailable = (event) => {
        total += event.data.size
        if (total > SPEAKING_CLIP_LIMIT) { oversized = true; this.stop(); return }
        if (event.data.size) chunks.push(event.data)
      }
      recorder.onerror = () => { this.cancel(); onError(new Error('녹음 중 오류가 발생했습니다. 다시 시도해 주세요.')) }
      recorder.onstop = () => {
        this.release()
        if (this.cancelled) return
        if (oversized) { onError(new Error('녹음 한도(5 MiB)를 초과하여 중단했습니다. 더 짧게 다시 녹음해 주세요.')); return }
        const blob = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || 'audio/webm' })
        if (!blob.size) { onError(new Error('녹음 데이터가 비어 있습니다. 마이크를 확인해 주세요.')); return }
        onComplete(blob, Math.max(1, Math.round((Date.now() - started) / 1000)))
      }
      recorder.start(1000)
      if (this.stopRequested) { recorder.stop(); return false }
      if (limitSeconds && limitSeconds > 0) this.timer = setTimeout(() => this.stop(), limitSeconds * 1000)
      return true
    } catch (error) { this.release(); if (!this.cancelled) onError(new Error(`마이크를 사용할 수 없습니다. 권한과 보안 연결(HTTPS)을 확인해 주세요. ${error instanceof Error ? error.message : ''}`)); return false }
  }
  stop() {
    if (this.recorder?.state === 'recording') this.recorder.stop()
    else if (!this.recorder && !this.cancelled && !this.stopRequested) {
      this.stopRequested = true
      this.pendingStopTimer = setTimeout(() => { this.cancel(); this.onError?.(new Error('응답 시간이 끝났지만 마이크가 연결되지 않아 녹음을 취소했습니다.')) }, 10000)
    }
  }
  cancel() { this.cancelled = true; this.stop(); this.release() }
  private release() { clearTimeout(this.timer); clearTimeout(this.pendingStopTimer); this.stream?.getTracks().forEach((track) => track.stop()); this.stream = null }
}
