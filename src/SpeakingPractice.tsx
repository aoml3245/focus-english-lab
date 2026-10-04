import { useEffect, useRef, useState } from 'react'
import type { BaseItem } from './types'
import { alignRepeatTranscript, coachSpeakingText, type SpeakingTextFeedback } from './speakingCoach'
import { SpeakingCapture, deleteSpeakingRecording, deleteSpeakingSessionRecordings, getSpeakingStorageWarning, isVolatileRecording, listSpeakingRecordings, listSpeakingRecordingSessions, saveSpeakingRecording, type SpeakingRecording, type SpeakingRecordingSession } from './speakingRecordings'

type Recognition = { continuous: boolean; interimResults: boolean; lang: string; start(): void; abort(): void; onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null }
function recognitionConstructor() { const host = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }; return host.SpeechRecognition || host.webkitSpeechRecognition }
function abortRecognition(recognition: Recognition | null) { if (!recognition) return; recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.abort() }

type DisplayRecording = SpeakingRecording & { unsaved?: boolean }
/** A failed captured Blob must be resolved before the parent can auto-advance. */
export class SpeakingSaveGate {
  pendingId: string | null = null
  constructor(private readonly busy: (value: boolean) => void) {}
  hold(id: string) { this.pendingId = id; this.busy(true) }
  saveResult(id: string, persistent: boolean) { if (!persistent) this.hold(id); else this.resolve(id); return persistent }
  resolve(id: string) { if (this.pendingId !== id) return false; this.pendingId = null; this.busy(false); return true }
}
export function RecordingCard({ recording, item, coachEnabled, onDelete, onBusyChange, onRecovered }: { recording: DisplayRecording; item?: BaseItem; coachEnabled: boolean; onDelete: () => void; onBusyChange?: (busy: boolean) => void; onRecovered?: (resolution: 'saved' | 'acknowledged') => void }) {
  const [url, setUrl] = useState('')
  const [transcript, setTranscript] = useState(recording.transcript)
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState<SpeakingTextFeedback | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [saved, setSaved] = useState(!recording.unsaved)
  const controller = useRef<AbortController | null>(null)
  const player = useRef<HTMLAudioElement | null>(null)
  const active = useRef(true)
  const reportBusy = useRef(onBusyChange); reportBusy.current = onBusyChange
  useEffect(() => { reportBusy.current?.(busy); return () => { reportBusy.current?.(false) } }, [busy])
  useEffect(() => { if (!coachEnabled) { controller.current?.abort(); setBusy(false); setFeedback(null) } }, [coachEnabled])
  useEffect(() => {
    active.current = true
    const objectUrl = URL.createObjectURL(recording.blob); setUrl(objectUrl)
    const hide = () => { if (document.visibilityState !== 'hidden') return; controller.current?.abort(); player.current?.pause(); if (active.current) setBusy(false) }
    document.addEventListener('visibilitychange', hide)
    return () => { active.current = false; controller.current?.abort(); player.current?.pause(); URL.revokeObjectURL(objectUrl); document.removeEventListener('visibilitychange', hide) }
  }, [recording.id, recording.blob])
  const saveText = async () => {
    try { const { unsaved: _, ...stored } = recording; const result = await saveSpeakingRecording({ ...stored, transcript }); if (active.current) { setSaved(result.persistent); setMessage(result.persistent ? '녹음을 저장했습니다.' : `${result.warning || '이 탭의 임시 메모리에만 보관됩니다.'} 영구 저장되지 않아 시험 진행은 계속 보류됩니다.`); if (result.persistent) onRecovered?.('saved') } } catch (error) { if (active.current) setMessage(error instanceof Error ? error.message : '저장 실패') }
  }
  const coach = async () => {
    if (!item || !coachEnabled) return
    controller.current?.abort(); const next = new AbortController(); controller.current = next
    setBusy(true); setFeedback(null); setMessage('')
    try { const result = await coachSpeakingText(item, transcript, next.signal); if (active.current && !next.signal.aborted) setFeedback(result) }
    catch (error) { if (active.current && !next.signal.aborted) setMessage(error instanceof Error ? error.message : '코칭에 연결하지 못했습니다.') }
    finally { if (active.current && controller.current === next) setBusy(false) }
  }
  const remove = async () => {
    try { if (saved || isVolatileRecording(recording.id)) await deleteSpeakingRecording(recording.id); if (active.current) onDelete() } catch (error) { if (active.current) setMessage(error instanceof Error ? error.message : '삭제 실패') }
  }
  const acknowledge = async (kept: boolean) => {
    if (!window.confirm(kept ? '녹음 파일을 내려받아 보관했나요? 계속하면 이 화면과 임시 메모리의 녹음은 제거됩니다.' : '저장되지 않은 이 녹음을 포기하고 계속할까요? 화면과 임시 메모리에서 제거되며 복구할 수 없습니다.')) return
    try { if (isVolatileRecording(recording.id)) await deleteSpeakingRecording(recording.id); if (active.current) onRecovered?.('acknowledged') }
    catch (error) { if (active.current) setMessage(error instanceof Error ? error.message : '임시 녹음을 정리하지 못해 진행을 보류합니다.') }
  }
  const alignment = coachEnabled && item?.kind === 'repeat' && transcript.trim() ? alignRepeatTranscript(item.audioText || '', transcript) : []
  return <article className="speaking-recording-card">
    <p>{new Date(recording.createdAt).toLocaleString()} · {recording.duration}초 · {(recording.blob.size / 1024).toFixed(0)} KiB {!saved ? isVolatileRecording(recording.id) ? '· 임시 메모리 보관: 영구 저장되지 않았습니다. 내려받기 또는 재저장이 필요합니다' : '· 저장 실패: 내려받기 또는 다시 저장이 필요합니다' : isVolatileRecording(recording.id) ? '· 이 탭에서만 보관' : '· 이 브라우저에 저장됨'}</p>
    {url && <><audio ref={player} controls preload="metadata" src={url} aria-label="내 말하기 녹음 다시 듣기" /><a className="button" href={url} download={`${recording.itemId}-${recording.id}.${recording.mimeType.includes('mp4') ? 'm4a' : 'webm'}`}>녹음 내려받기</a></>}
    {coachEnabled && <><label>내가 말한 내용을 직접 받아 적기<textarea rows={4} maxLength={10000} value={transcript} onChange={(event) => { controller.current?.abort(); setBusy(false); setFeedback(null); setTranscript(event.target.value) }} placeholder="녹음을 들으며 받아 적고, 자동 전사가 있다면 틀린 부분을 수정하세요." /></label>
    <button className="button" onClick={saveText}>받아 적은 내용 저장</button>
    <p className="speaking-limit-note">단어 비교와 코칭은 이 텍스트만 평가합니다. 발음·억양·유창성이나 공식 시험 점수가 아닙니다.</p>
    {!!alignment.length && <div className="speaking-word-alignment" aria-label="받아 적은 텍스트 단어 비교">{alignment.map((token, index) => <span key={index} className={`speaking-word speaking-word--${token.status}`}>{token.status === 'missing' ? `누락: ${token.expected}` : token.status === 'changed' ? `${token.expected} → ${token.spoken}` : token.status === 'extra' ? `추가: ${token.spoken}` : token.spoken} </span>)}</div>}</>}
    {!coachEnabled && !saved && <button className="button" onClick={saveText}>녹음 다시 저장</button>}
    {!saved && onRecovered && <div role="alert"><p>저장되지 않은 녹음을 이 화면에서 보관 중입니다. 재저장하거나 파일을 내려받은 뒤 확인하기 전에는 시험이 다음으로 넘어가지 않습니다.</p><button className="button" onClick={() => acknowledge(true)}>파일 보관을 확인하고 계속</button><button className="button button--danger" onClick={() => acknowledge(false)}>이 녹음을 포기하고 계속</button></div>}
    {coachEnabled && item && <><button className="button button--primary" disabled={busy || !transcript.trim()} onClick={coach}>{busy ? '텍스트 코칭 중…' : '로컬 AI로 텍스트 코칭'}</button>{busy && <button className="button" onClick={() => { controller.current?.abort(); setBusy(false) }}>코칭 취소</button>}</>}
    {coachEnabled && feedback && <div className="speaking-feedback"><p>{feedback.summaryKo}</p><h4>잘한 점</h4><ul>{feedback.strengthsKo.map((text, index) => <li key={index}>{text}</li>)}</ul><h4>다음 연습</h4><ul>{feedback.improvementsKo.map((text, index) => <li key={index}>{text}</li>)}</ul><h4>개선한 답변 예시</h4><p>{feedback.revisedResponse}</p><small>로컬 모델: {feedback.model} · 비공식 텍스트 피드백</small></div>}
    {message && <p role="status">{message}</p>}
    {!deleteConfirm ? <button className="button" onClick={() => setDeleteConfirm(true)}>이 녹음 삭제</button> : <div role="alert"><p>이 녹음과 받아 적은 내용을 삭제할까요? 되돌릴 수 없습니다. 필요하면 먼저 내려받으세요.</p><button className="button button--danger" onClick={remove}>삭제 확인</button><button className="button" onClick={() => setDeleteConfirm(false)}>취소</button></div>}
  </article>
}

export function SpeakingRecordingReview({ sessionId, item, coachEnabled = false }: { sessionId: string; item?: BaseItem; coachEnabled?: boolean }) {
  const [recordings, setRecordings] = useState<DisplayRecording[]>([])
  const [loaded, setLoaded] = useState(false)
  const [warning, setWarning] = useState('')
  useEffect(() => { let active = true; setRecordings([]); setLoaded(false); setWarning(''); void listSpeakingRecordings(sessionId, item?.id).then((records) => { if (active) { setRecordings(records); setLoaded(true); setWarning(getSpeakingStorageWarning()) } }); return () => { active = false } }, [sessionId, item?.id])
  return <section className="speaking-study speaking-recording-review"><h3>말하기 녹음 다시 보기</h3><p>이 브라우저에서 보관한 녹음입니다. 계정 동기화·학습 기록 내보내기에는 음성이 포함되지 않습니다.</p>{warning && <p role="status">{warning}</p>}{!loaded ? <p role="status">녹음 확인 중…</p> : !recordings.length ? <p>{warning ? '지금 표시할 수 있는 녹음이 없습니다.' : '이 브라우저에 보관된 녹음이 없습니다.'}</p> : recordings.map((record) => <RecordingCard key={record.id} recording={record} item={item} coachEnabled={coachEnabled} onDelete={() => setRecordings((previous) => previous.filter((entry) => entry.id !== record.id))} />)}</section>
}

export function SpeakingStorageManager() {
  const [sessions, setSessions] = useState<SpeakingRecordingSession[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setBusy(true)
    void listSpeakingRecordingSessions().then((records) => { if (active) { setSessions(records); const warning = getSpeakingStorageWarning(); if (warning) setMessage(warning); setBusy(false) } })
    return () => { active = false }
  }, [revision])
  const remove = async (session: SpeakingRecordingSession) => {
    if (!window.confirm(`이 학습 회차의 녹음 ${session.clipCount}개와 받아 적은 내용을 삭제할까요? 되돌릴 수 없습니다. 필요한 녹음은 먼저 내려받으세요. 시험 답안과 학습 기록은 삭제하지 않습니다.`)) return
    setBusy(true)
    try { await deleteSpeakingSessionRecordings(session.sessionId); setSelected(null); setRevision((value) => value + 1); setMessage('선택한 회차의 녹음만 삭제했습니다. 시험 답안과 학습 기록은 유지됩니다.') }
    catch (error) { setMessage(error instanceof Error ? error.message : '삭제하지 못했습니다.'); setBusy(false) }
  }
  return <section className="speaking-study speaking-storage-manager"><h3>이 기기의 말하기 녹음 관리</h3><p>전체 {(sessions.reduce((sum, session) => sum + session.bytes, 0) / 1024 / 1024).toFixed(1)} / 100 MiB · {sessions.length} / 50회 학습. 학습 기록에서 사라진 회차의 녹음도 여기에서 확인할 수 있습니다. 녹음은 자동 삭제하지 않습니다.</p><p>계정 동기화·JSON 백업·학습 기록 삭제와 녹음 보관은 별개입니다. 녹음이 필요하면 개별 파일을 내려받으세요.</p>{message && <p role="status">{message}</p>}{busy ? <p role="status">녹음 저장소 확인 중…</p> : !sessions.length ? <p>지금 표시할 수 있는 녹음이 없습니다.</p> : <ul>{sessions.map((session) => <li key={session.sessionId}><span>회차 {session.sessionId.slice(0, 12)} · {session.clipCount}개 · {(session.bytes / 1024 / 1024).toFixed(1)} MiB{session.volatileCount > 0 ? ` · 임시 녹음 ${session.volatileCount}개` : ''}</span><div className="speaking-actions"><button className="button" disabled={busy} onClick={() => setSelected(selected === session.sessionId ? null : session.sessionId)}>{selected === session.sessionId ? '녹음 목록 닫기' : '다시 듣기·내려받기'}</button><button className="button button--danger" disabled={busy} onClick={() => remove(session)}>이 회차 녹음 삭제</button></div></li>)}</ul>}{selected && <SpeakingRecordingReview key={`${selected}:${revision}`} sessionId={selected} />}</section>
}

export default function SpeakingPractice({ item, sessionId, onAnswer, coachEnabled, onBusyChange, forceStopToken = 0 }: { item: BaseItem; sessionId: string; onAnswer: (duration: number) => void; coachEnabled: boolean; onBusyChange?: (busy: boolean) => void; forceStopToken?: number }) {
  const [state, setState] = useState<'idle' | 'requesting' | 'recording' | 'saving' | 'recovery'>('idle')
  const [seconds, setSeconds] = useState(0)
  const [message, setMessage] = useState('')
  const [recordings, setRecordings] = useState<DisplayRecording[]>([])
  const [optIn, setOptIn] = useState(false)
  const [recognitionAvailable, setRecognitionAvailable] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const transcript = useRef('')
  const capture = useRef<SpeakingCapture | null>(null)
  const completedSavePending = useRef(false)
  const recognition = useRef<Recognition | null>(null)
  const generation = useRef(0)
  const ticks = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const answer = useRef(onAnswer); answer.current = onAnswer
  const busyChange = useRef(onBusyChange); busyChange.current = onBusyChange
  const busySources = useRef(new Set<string>())
  const reportBusy = (source: string, busy: boolean) => { if (busy) busySources.current.add(source); else busySources.current.delete(source); busyChange.current?.(busySources.current.size > 0) }
  const saveGate = useRef<SpeakingSaveGate | null>(null)
  if (!saveGate.current) saveGate.current = new SpeakingSaveGate((busy) => reportBusy('capture', busy))
  const recovered = (id: string, resolution: 'saved' | 'acknowledged' = 'acknowledged') => {
    if (!saveGate.current || saveGate.current.pendingId !== id) return
    setRecordings((previous) => resolution === 'acknowledged' ? previous.filter((record) => record.id !== id) : previous.map((record) => record.id === id ? { ...record, unsaved: false } : record))
    setState('idle'); saveGate.current.resolve(id)
  }
  const previousStopToken = useRef(forceStopToken)
  useEffect(() => { if (!coachEnabled) { abortRecognition(recognition.current); setOptIn(false); setLiveTranscript(''); transcript.current = '' } }, [coachEnabled])
  useEffect(() => { if (forceStopToken !== previousStopToken.current) { previousStopToken.current = forceStopToken; capture.current?.stop() } }, [forceStopToken])
  useEffect(() => {
    const current = ++generation.current; setState('idle'); setSeconds(0); setRecordings([]); setMessage(''); setLiveTranscript(''); transcript.current = ''
    setRecognitionAvailable(Boolean(recognitionConstructor()))
    void listSpeakingRecordings(sessionId, item.id).then((records) => { if (generation.current === current) {
      setRecordings((previous) => [...new Map([...records, ...previous].map((record) => [record.id, record])).values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      const warning = getSpeakingStorageWarning(); if (warning) setMessage(warning)
    } })
    const hide = () => {
      if (document.visibilityState !== 'hidden') return
      // A completed, unsaved clip is not an unfinished capture: preserve its
      // recovery hold even when the browser temporarily goes into the background.
      if (saveGate.current?.pendingId || completedSavePending.current) return
      capture.current?.cancel(); abortRecognition(recognition.current); clearInterval(ticks.current)
      setState('idle'); reportBusy('capture', false); setMessage('화면을 떠나 진행 중 녹음·전사를 중단했습니다. 완료되어 저장된 녹음은 유지됩니다.')
      generation.current++
    }
    document.addEventListener('visibilitychange', hide)
    return () => { generation.current++; capture.current?.cancel(); abortRecognition(recognition.current); clearInterval(ticks.current); busySources.current.clear(); busyChange.current?.(false); document.removeEventListener('visibilitychange', hide) }
  }, [item.id, sessionId])
  const start = async () => {
    if (saveGate.current?.pendingId) return
    capture.current?.cancel(); abortRecognition(recognition.current); clearInterval(ticks.current)
    const current = generation.current
    setState('requesting'); setMessage(''); setSeconds(0); setLiveTranscript(''); transcript.current = ''; reportBusy('capture', true)
    const next = new SpeakingCapture(); capture.current = next
    const started = await next.start(async (blob, duration) => {
      abortRecognition(recognition.current); clearInterval(ticks.current)
      if (generation.current !== current) return
      setState('saving')
      completedSavePending.current = true
      const record: SpeakingRecording = { version: 1, id: crypto.randomUUID(), sessionId, itemId: item.id, createdAt: new Date().toISOString(), duration, blob, mimeType: blob.type, transcript: transcript.current }
      let status = ''; let unsaved = false
      try { const result = await saveSpeakingRecording(record); unsaved = !result.persistent; status = result.persistent ? '녹음을 이 브라우저에 저장했습니다.' : `${result.warning || '이 탭의 임시 메모리에만 보관됩니다.'} 영구 저장되지 않아 시험 진행은 보류됩니다. 파일을 내려받거나 재저장해 주세요.` }
      catch (error) { unsaved = true; status = `${error instanceof Error ? error.message : '저장하지 못했습니다.'} 아래에서 파일을 내려받으세요. 아직 저장된 녹음이 아닙니다.` }
      completedSavePending.current = false
      if (generation.current !== current) return
      setRecordings((previous) => [{ ...record, unsaved }, ...previous]); setMessage(status); setState(unsaved ? 'recovery' : 'idle'); answer.current(duration)
      if (unsaved) saveGate.current!.saveResult(record.id, false)
      else reportBusy('capture', false)
    }, (error) => { if (generation.current === current) { clearInterval(ticks.current); abortRecognition(recognition.current); setState('idle'); setMessage(error.message); reportBusy('capture', false) } }, item.responseTimeSeconds)
    if (!started || generation.current !== current) return
    setState('recording'); const startedAt = Date.now(); ticks.current = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 250)
    const Constructor = recognitionConstructor()
    if (coachEnabled && optIn && Constructor) {
      try {
        const recognizer = new Constructor(); recognition.current = recognizer; recognizer.continuous = true; recognizer.interimResults = false; recognizer.lang = 'en-US'
        recognizer.onresult = (event) => { if (generation.current !== current) return; const text = Array.from(event.results).filter((result) => result.isFinal).map((result) => result[0].transcript).join(' '); transcript.current = text; setLiveTranscript(text) }
        recognizer.onerror = () => { if (generation.current === current) setMessage('브라우저 자동 전사를 사용할 수 없습니다. 녹음 후 직접 받아 적을 수 있습니다.') }
        recognizer.onend = () => { if (generation.current === current) setMessage('자동 전사가 종료되었습니다. 녹음은 계속할 수 있으며 받아 적은 내용은 직접 보완해 주세요.') }
        recognizer.start()
      } catch { setMessage('자동 전사 시작 실패: 녹음은 계속됩니다. 녹음 후 직접 받아 적어 주세요.') }
    }
  }
  return <section key={`${sessionId}:${item.id}`} className="speaking-study">
    <h3>내 말하기 연습</h3><p>녹음은 이 기기의 브라우저에만 보관합니다. 최대 100 MiB · 녹음당 5 MiB · 50회 학습. 한도에 도달해도 기존 녹음을 자동 삭제하지 않습니다.</p>
    {coachEnabled && (recognitionAvailable ? <label><input type="checkbox" checked={optIn} disabled={state !== 'idle'} onChange={(event) => setOptIn(event.target.checked)} />브라우저 자동 전사 사용(선택)</label> : <p>이 브라우저에서는 자동 전사를 지원하지 않습니다. 녹음을 들으며 직접 받아 적을 수 있습니다.</p>)}
    {coachEnabled && optIn && <p className="speaking-limit-note">브라우저 전사 서비스는 음성을 외부로 전송할 수 있으며 영어 단어도 오인식할 수 있습니다. 발음 점수가 아닙니다.</p>}
    <div className="speaking-actions">{state === 'recording' ? <button className="button button--danger" onClick={() => capture.current?.stop()}>녹음 완료 · {seconds}초</button> : <button className="button button--primary" disabled={state !== 'idle'} onClick={start}>{state === 'requesting' ? '마이크 연결 중…' : state === 'saving' ? '녹음 저장 중…' : '녹음 시작'}</button>}{state === 'requesting' && <button className="button" onClick={() => { generation.current++; capture.current?.cancel(); setState('idle'); reportBusy('capture', false) }}>마이크 연결 취소</button>}{item.responseTimeSeconds && <span>최대 응답 시간 {item.responseTimeSeconds}초 · 시간 종료 시 녹음 완료</span>}</div>
    {coachEnabled && liveTranscript && <p className="speaking-live-transcript">자동 전사: {liveTranscript}</p>}{message && <p role="status">{message}</p>}
    {coachEnabled && <>{item.taskChecklist?.length ? <details><summary>자가 점검 기준</summary><ul>{item.taskChecklist.map((text, index) => <li key={index}><label><input type="checkbox" />{text}</label></li>)}</ul></details> : <details><summary>자가 점검 기준</summary><p>{item.kind === 'repeat' ? '원문의 단어를 빠뜨리지 않았는지, 녹음을 직접 들으며 확인하세요.' : '질문에 답했는지, 구체적인 이유·예시를 넣었는지, 답변 흐름이 자연스러운지 직접 확인하세요.'}</p></details>}
    {item.commonMistakes?.length ? <details><summary>흔한 실수</summary><ul>{item.commonMistakes.map((text, index) => <li key={index}>{text}</li>)}</ul></details> : null}
    {item.modelResponse && <details><summary>답변 예시(유일한 정답이 아닙니다)</summary><p>{item.modelResponse}</p></details>}</>}
    {state === 'recovery' && <p role="alert">녹음 보관 확인이 필요합니다. 아래에서 재저장·파일 보관 확인·포기 중 하나를 선택하세요. 새 녹음과 다음 문항은 잠시 차단됩니다.</p>}
    {recordings.filter((record) => record.sessionId === sessionId && record.itemId === item.id).map((record) => <RecordingCard key={record.id} recording={record} item={item} coachEnabled={coachEnabled} onRecovered={record.unsaved ? (resolution) => recovered(record.id, resolution) : undefined} onBusyChange={(busy) => reportBusy(record.id, busy)} onDelete={() => { setRecordings((previous) => previous.filter((entry) => entry.id !== record.id)); recovered(record.id) }} />)}
  </section>
}
