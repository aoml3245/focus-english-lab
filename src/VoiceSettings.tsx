import { useEffect, useState } from 'react'
import { ArrowIcon, Brand } from './components'
import { browserSupportsWebGPU, getActiveBrowserTTSBackend, getBrowserKokoroCacheState, getBrowserTTSFallbackReason, getBrowserTTSRuntimeInfo, getVoiceProfile, hasLocalTtsServer, loadTTSBackendPreference, loadVoiceProfileId, playTTS, resolveTTSBackend, saveTTSBackendPreference, saveVoiceProfileId, stopTTS, VOICE_PROFILES, type TTSBackendPreference, type TTSProgressDetail, type VoiceProfileId } from './tts'

const PREVIEW_TEXT = 'Student: I am trying to understand the new research schedule. Advisor: Let us review the evidence together before you make a decision.'

export default function VoiceSettings({ onBack }: { onBack: () => void }) {
  const localTts = hasLocalTtsServer()
  const [selected, setSelected] = useState<VoiceProfileId>(loadVoiceProfileId)
  const [previewing, setPreviewing] = useState<VoiceProfileId | null>(null)
  const [status, setStatus] = useState('음성을 선택한 뒤 미리 듣기로 비교해 보세요.')
  const [cacheState, setCacheState] = useState<'checking' | 'available' | 'missing' | 'unsupported'>(localTts ? 'unsupported' : 'checking')
  const [modelProgress, setModelProgress] = useState<TTSProgressDetail | null>(null)
  const [backendPreference, setBackendPreference] = useState<TTSBackendPreference>(loadTTSBackendPreference)
  const [firstAudioMs, setFirstAudioMs] = useState<number | null>(null)
  const runtimeInfo = getBrowserTTSRuntimeInfo()
  useEffect(() => () => stopTTS(), [])
  useEffect(() => {
    if (localTts) return
    let active = true
    void getBrowserKokoroCacheState().then((state) => { if (active) setCacheState(state) })
    return () => { active = false }
  }, [localTts])

  const choose = (id: VoiceProfileId) => {
    setSelected(id)
    saveVoiceProfileId(id)
    setStatus(`${getVoiceProfile(id).name} 음성을 기본값으로 저장했습니다.`)
  }
  const preview = async (id: VoiceProfileId) => {
    const startedAt = performance.now()
    let firstAudioReported = false
    setPreviewing(id)
    setFirstAudioMs(null)
    if (!localTts && id !== 'system') setModelProgress({ phase: 'checking', percent: 0 })
    else setModelProgress(null)
    try {
      const result = await playTTS(PREVIEW_TEXT, id, (message, detail) => {
        setStatus(message)
        if (!firstAudioReported && detail?.phase === 'playing') {
          firstAudioReported = true
          setFirstAudioMs(Math.round(performance.now() - startedAt))
        }
        if (detail && !localTts) {
          setModelProgress(detail)
          if (detail.cached) setCacheState('available')
        }
      })
      if (result === 'completed') {
        setStatus(`${getVoiceProfile(id).name} 미리 듣기가 끝났습니다.`)
        if (!localTts && id !== 'system') setModelProgress({ phase: 'complete', percent: 100, cached: true })
      }
      if (result === 'fallback') {
        setStatus('AI 모델을 불러오지 못해 기기 기본 음성으로 재생했습니다.')
        setModelProgress(null)
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '음성을 재생하지 못했습니다.')
    } finally { setPreviewing(null) }
  }

  const chooseBackend = (preference: TTSBackendPreference) => {
    setBackendPreference(preference)
    saveTTSBackendPreference(preference)
    setModelProgress(null)
    setFirstAudioMs(null)
    setStatus(`${preference === 'auto' ? '자동' : preference === 'webgpu' ? 'WebGPU(Metal)' : 'WASM 호환'} 모드로 저장했습니다. 다음 미리 듣기부터 적용됩니다.`)
  }

  return <div className="voice-page">
    <header><Brand /><button className="text-button" onClick={onBack}><ArrowIcon direction="left" /> 설정으로</button></header>
    <main>
      <div className="voice-hero"><div><h1>듣기 음성을 골라보세요.</h1><p>실제 학습 환경처럼 자연스러운 AI 음성과 여러 억양을 비교하고, Listening·Speaking에서 사용할 기본 음성을 정할 수 있습니다.</p></div><div className="voice-current"><span>현재 기본 음성</span><strong>{getVoiceProfile(selected).name}</strong><small>{getVoiceProfile(selected).accent}</small></div></div>
      <div className="voice-notice"><strong>{localTts ? 'Kokoro 82M · 로컬 서버 실행 및 WAV 캐시' : 'Kokoro 82M · Native WebGPU EP 우선 Worker'}</strong><p>{localTts ? '문장은 외부 음성 API로 전송되지 않습니다. 로컬 서버가 모델을 한 번만 실행하고 생성한 음성을 디스크에 저장하므로, 같은 문장과 화자는 다음부터 즉시 재생됩니다.' : '지원 기기에서는 JSEP가 아닌 ONNX Runtime의 native WebGPU EP로 Apple GPU를 사용하고, 지원되지 않거나 초기화에 실패하면 q8 WASM으로 자동 복귀합니다. 생성 음성은 이 브라우저에 최대 64MB 또는 200개까지만 보관합니다.'}</p></div>
      {!localTts && <section className="voice-backend" aria-label="브라우저 AI 실행 방식">
        <div className="voice-backend-head"><div><span>INFERENCE BACKEND</span><strong>이 기기: {browserSupportsWebGPU() ? 'WebGPU 사용 가능' : 'WebGPU 미지원 · WASM 사용'}</strong><small>현재 선택: {backendPreference === 'auto' ? `자동 (${resolveTTSBackend() === 'webgpu' ? 'WebGPU·Metal' : 'WASM'})` : backendPreference === 'webgpu' ? 'WebGPU·Metal' : 'WASM 호환'}{getActiveBrowserTTSBackend() ? ` · 실제 실행: ${getActiveBrowserTTSBackend() === 'webgpu' ? 'WebGPU·Metal' : 'WASM'}` : ''}</small></div>{firstAudioMs !== null && <em>첫 소리 {firstAudioMs.toLocaleString()}ms</em>}</div>
        <div className="voice-backend-options"><button className={backendPreference === 'auto' ? 'voice-backend-option voice-backend-option--active' : 'voice-backend-option'} onClick={() => chooseBackend('auto')}><strong>자동 권장</strong><span>가능하면 WebGPU, 실패하면 WASM</span></button><button className={backendPreference === 'webgpu' ? 'voice-backend-option voice-backend-option--active' : 'voice-backend-option'} disabled={!browserSupportsWebGPU()} onClick={() => chooseBackend('webgpu')}><strong>WebGPU · Metal</strong><span>iOS 26 Safari GPU · fp16 156MB / fp32 311MB</span></button><button className={backendPreference === 'wasm' ? 'voice-backend-option voice-backend-option--active' : 'voice-backend-option'} onClick={() => chooseBackend('wasm')}><strong>WASM 호환</strong><span>기존 CPU 추론 · q8 약 90MB</span></button></div>
        <p>미리 듣기를 누른 뒤 <b>첫 소리</b> 시간이 표시되면 실제 체감 지연을 확인할 수 있습니다. WebGPU가 실패하면 WASM 전환이 표시되고 기존 모델로 자동 복귀합니다.{runtimeInfo && <> 런타임: <code>{runtimeInfo.runtime === 'native-webgpu-ep' ? 'Native WebGPU EP' : 'WASM'} · ORT {runtimeInfo.ortVersion} · {runtimeInfo.runtimeVariant} · {runtimeInfo.dtype}</code>.</>}{getBrowserTTSFallbackReason() && <> 최근 전환 이유: <code>{getBrowserTTSFallbackReason()}</code></>}</p>
      </section>}
      {!localTts && <section className="voice-download" aria-label="Kokoro 모델 저장 및 다운로드 상태">
        <div className="voice-download-head"><div><span>MODEL STORAGE</span><strong>{modelProgress?.phase === 'downloading' ? '모델 파일 다운로드 중' : modelProgress?.phase === 'loading-cache' ? '저장된 모델 읽는 중' : modelProgress?.phase === 'generating' ? 'AI 음성 생성 중' : modelProgress?.phase === 'playing' ? 'AI 음성 재생 중' : modelProgress?.phase === 'complete' || modelProgress?.phase === 'ready' ? 'Kokoro 82M 준비 완료' : cacheState === 'available' ? '이 브라우저에 모델 저장됨' : cacheState === 'missing' ? '아직 모델이 저장되지 않음' : cacheState === 'unsupported' ? '브라우저 저장소를 확인할 수 없음' : '브라우저 저장소 확인 중'}</strong></div><em className={cacheState === 'available' ? 'voice-cache-badge voice-cache-badge--ready' : 'voice-cache-badge'}>{cacheState === 'available' ? '캐시 확인됨' : cacheState === 'missing' ? '첫 사용 필요' : cacheState === 'unsupported' ? '확인 불가' : '확인 중'}</em></div>
        <div className={modelProgress && !['complete', 'ready', 'playing'].includes(modelProgress.phase) ? 'voice-progress voice-progress--active' : 'voice-progress'} role="progressbar" aria-label="Kokoro 모델 준비 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={modelProgress?.percent ?? (cacheState === 'available' ? 100 : 0)}><span style={{ width: `${modelProgress?.percent ?? (cacheState === 'available' ? 100 : 0)}%` }} /></div>
        <div className="voice-download-detail"><span>{modelProgress ? status : cacheState === 'available' ? '모델 파일은 브라우저의 transformers-cache에 보관되어 다음 방문에도 재사용됩니다.' : 'AI 음성의 미리 듣기를 누르면 실제 다운로드 퍼센트와 전송량이 여기에 표시됩니다.'}</span>{modelProgress?.loadedBytes !== undefined && modelProgress.totalBytes !== undefined && <strong>{(modelProgress.loadedBytes / 1024 / 1024).toFixed(1)} / {(modelProgress.totalBytes / 1024 / 1024).toFixed(1)} MB{modelProgress.file ? ` · ${modelProgress.file}` : ''}</strong>}</div>
      </section>}
      <section className="voice-list" aria-label="사용할 음성 선택">
        {VOICE_PROFILES.map((profile) => <article className={selected === profile.id ? 'voice-row voice-row--selected' : 'voice-row'} key={profile.id}>
          <div className="voice-radio" aria-hidden="true"><span /></div>
          <div className="voice-copy"><div><h2>{profile.name}</h2>{profile.recommended && <em>기본 권장</em>}</div><p>{profile.description}</p><small>{profile.accent}</small></div>
          <div className="voice-actions"><button className="button button--secondary" disabled={previewing !== null} onClick={() => preview(profile.id)}>{previewing === profile.id ? '준비 중…' : '미리 듣기'}</button><button className="button button--primary" disabled={selected === profile.id} onClick={() => choose(profile.id)}>{selected === profile.id ? '선택됨' : '이 음성 선택'}</button></div>
        </article>)}
      </section>
      <div className="voice-status" aria-live="polite"><span className={previewing ? 'audio-pulse audio-pulse--active' : 'audio-pulse'} />{status}{firstAudioMs !== null && <strong>첫 소리 {firstAudioMs.toLocaleString()}ms</strong>}</div>
      <p className="voice-attribution">오픈소스 모델: <a href="https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX" target="_blank" rel="noreferrer">Kokoro-82M ONNX</a> · Apache 2.0</p>
    </main>
  </div>
}
