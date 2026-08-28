import { useCallback, useEffect, useRef, useState } from 'react'
import { loadVoiceProfileId, playTTS, stopTTS } from './tts'

export const HOME_NAVIGATION_EVENT = 'focus-english-lab:navigate-home'

export function Brand() {
  return <button type="button" className="brand" aria-label="홈으로 이동" title="홈으로" onClick={() => window.dispatchEvent(new Event(HOME_NAVIGATION_EVENT))}><span className="brand-mark" aria-hidden="true"><i /><i /></span><span>Focus English Lab</span></button>
}

export function ArrowIcon({ direction = 'right' }: { direction?: 'left' | 'right' }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={direction === 'right' ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6'} /></svg>
}

export function Timer({ seconds, onExpire, hidden = false, paused = false }: { seconds: number; onExpire: () => void; hidden?: boolean; paused?: boolean }) {
  const [left, setLeft] = useState(seconds)
  const expired = useRef(false)
  useEffect(() => { setLeft(seconds); expired.current = false }, [seconds])
  useEffect(() => {
    if (paused) return undefined
    const id = window.setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(id)
  }, [paused])
  useEffect(() => {
    if (left === 0 && !expired.current) { expired.current = true; onExpire() }
  }, [left, onExpire])
  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  return <span className={left <= 15 ? 'timer timer--low' : 'timer'} aria-label={hidden ? '시간 숨김' : `남은 시간 ${mm}분 ${ss}초`}>{hidden ? '--:--' : `${mm}:${ss}`}</span>
}

export function AudioPrompt({ text, autoPlay = false, onPlaybackChange }: { text: string; autoPlay?: boolean; onPlaybackChange?: (active: boolean) => void }) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'played' | 'error'>('idle')
  const [status, setStatus] = useState('')
  const started = useRef(false)
  const play = useCallback(async () => {
    if (started.current) return
    started.current = true
    onPlaybackChange?.(true)
    setState('loading')
    try {
      const result = await playTTS(text, loadVoiceProfileId(), (message) => {
        setStatus(message)
        setState(message === '재생 중…' ? 'playing' : 'loading')
      }, { maxWaitMs: 1500 })
      if (result === 'cancelled') return
      setState('played')
      setStatus(result === 'fallback' ? '시스템 음성으로 재생했습니다.' : '한 번 재생했습니다.')
    } catch (error) {
      started.current = false
      setState('error')
      setStatus(error instanceof Error ? error.message : '오디오를 재생하지 못했습니다.')
    } finally { onPlaybackChange?.(false) }
  }, [onPlaybackChange, text])
  useEffect(() => {
    stopTTS()
    started.current = false
    setState('idle')
    setStatus('')
    onPlaybackChange?.(false)
  }, [onPlaybackChange, text])
  useEffect(() => {
    if (!autoPlay) return undefined
    const id = window.setTimeout(play, 500)
    return () => window.clearTimeout(id)
  }, [autoPlay, play])
  useEffect(() => () => { stopTTS(); onPlaybackChange?.(false) }, [onPlaybackChange])
  const label = state === 'played' ? 'Audio played' : state === 'error' ? 'Try audio again' : state === 'loading' ? 'Preparing natural voice…' : state === 'playing' ? 'Playing audio…' : 'Play audio once'
  return <div className="audio-prompt"><button className="audio-button" onClick={play} disabled={state === 'loading' || state === 'playing' || state === 'played'}><span className={state === 'loading' || state === 'playing' ? 'audio-dot audio-dot--active' : 'audio-dot'} />{label}</button>{status && <small aria-live="polite">{status}</small>}</div>
}

export function Recorder({ onRecorded }: { onRecorded: (duration: number) => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'done' | 'denied'>('idle')
  const [duration, setDuration] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const startedAt = useRef(0)
  const stop = () => recorder.current?.stop()
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      recorder.current = mediaRecorder; startedAt.current = Date.now(); setState('recording')
      mediaRecorder.onstop = () => {
        const elapsed = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000))
        stream.getTracks().forEach((track) => track.stop()); setDuration(elapsed); setState('done'); onRecorded(elapsed)
      }
      mediaRecorder.start()
    } catch { setState('denied') }
  }
  if (state === 'denied') return <p className="notice notice--error">마이크 권한이 필요합니다. 브라우저 주소창에서 권한을 허용한 뒤 다시 시도하세요.</p>
  return <div className="recorder">
    <div className={`mic ${state === 'recording' ? 'mic--live' : ''}`}><span /></div>
    <div><strong>{state === 'recording' ? 'Recording…' : state === 'done' ? `Recorded · ${duration}s` : 'Microphone ready'}</strong><p>실제 시험처럼 한 번에 말해 보세요.</p></div>
    {state === 'recording' ? <button className="button button--danger" onClick={stop}>Stop</button> : <button className="button button--primary" onClick={start}>{state === 'done' ? 'Record again' : 'Start recording'}</button>}
  </div>
}
