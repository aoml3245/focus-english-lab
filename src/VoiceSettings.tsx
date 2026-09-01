import { useEffect, useRef, useState } from 'react'
import { ArrowIcon, Brand } from './components'
import { playReadyChime } from './readyChime'
import { browserSupportsWebGPU, getActiveBrowserTTSBackend, getBrowserKokoroCacheState, getBrowserTTSFallbackReason, getBrowserTTSRuntimeInfo, getVoiceProfile, hasLocalTtsServer, isIOSBrowser, loadTTSBackendPreference, loadVoiceProfileId, playTTS, prepareSpeech, resolveTTSBackend, saveTTSBackendPreference, saveVoiceProfileId, stopTTS, VOICE_PROFILES, type TTSBackendPreference, type TTSProgressDetail, type VoiceProfileId } from './tts'
import { APP_VERSION } from './version'
import { clearTTSDiagnostics, formatTTSDiagnostics, getTTSDiagnostics, subscribeTTSDiagnostics, type TTSDiagnosticEvent } from './ttsDiagnostics'

const PREVIEW_TEXT = 'Student: Could you help me understand the new research schedule? Advisor: Yes. Let us review the evidence together before you make a decision.'

export default function VoiceSettings({ onBack }: { onBack: () => void }) {
  const localTts = hasLocalTtsServer()
  const [selected, setSelected] = useState<VoiceProfileId>(loadVoiceProfileId)
  const [previewState, setPreviewState] = useState<{ id: VoiceProfileId; phase: 'preparing' | 'ready' | 'playing' | 'done' | 'error' } | null>(null)
  const previewPreparation = useRef<AbortController | null>(null)
  const [status, setStatus] = useState('음성을 선택한 뒤 미리 듣기로 비교해 보세요.')
  const [cacheState, setCacheState] = useState<'checking' | 'available' | 'missing' | 'unsupported'>(localTts ? 'unsupported' : 'checking')
  const [modelProgress, setModelProgress] = useState<TTSProgressDetail | null>(null)
  const [backendPreference, setBackendPreference] = useState<TTSBackendPreference>(loadTTSBackendPreference)
  const [firstAudioMs, setFirstAudioMs] = useState<number | null>(null)
  const [diagnostics, setDiagnostics] = useState<TTSDiagnosticEvent[]>(getTTSDiagnostics)
  const [diagnosticStatus, setDiagnosticStatus] = useState('')
  const runtimeInfo = getBrowserTTSRuntimeInfo()
  useEffect(() => () => { previewPreparation.current?.abort(); stopTTS() }, [])
  useEffect(() => subscribeTTSDiagnostics(setDiagnostics), [])
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
  const preparePreview = async (id: VoiceProfileId) => {
    previewPreparation.current?.abort()
    const controller = new AbortController()
    previewPreparation.current = controller
    setPreviewState({ id, phase: 'preparing' })
    setFirstAudioMs(null)
    if (!localTts && id !== 'system') setModelProgress({ phase: 'checking', percent: 0 })
    else setModelProgress(null)
    try {
      await prepareSpeech(PREVIEW_TEXT, id, 'dialogue', (message, detail) => {
        setStatus(message)
        if (detail && !localTts) {
          setModelProgress(detail)
          if (detail.cached) setCacheState('available')
        }
      }, controller.signal)
      if (controller.signal.aborted) return
      setPreviewState({ id, phase: 'ready' })
      setStatus(`${getVoiceProfile(id).name} 미리 듣기가 준비됐습니다. 재생 버튼을 눌러 주세요.`)
      void playReadyChime()
      if (!localTts && id !== 'system') setModelProgress({ phase: 'ready', percent: 100, cached: true })
    } catch (error) {
      if (controller.signal.aborted) return
      setPreviewState({ id, phase: 'error' })
      setStatus(error instanceof Error ? error.message : '미리 듣기 음성을 준비하지 못했습니다.')
    }
  }
  const playPreview = async (id: VoiceProfileId) => {
    const startedAt = performance.now()
    let firstAudioReported = false
    setPreviewState({ id, phase: 'playing' })
    setFirstAudioMs(null)
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
        setPreviewState({ id, phase: 'done' })
        setStatus(`${getVoiceProfile(id).name} 미리 듣기가 끝났습니다.`)
        if (!localTts && id !== 'system') setModelProgress({ phase: 'complete', percent: 100, cached: true })
      }
      if (result === 'fallback') {
        setPreviewState({ id, phase: 'done' })
        setStatus('AI 모델을 불러오지 못해 기기 기본 음성으로 재생했습니다.')
        setModelProgress(null)
      }
    } catch (error) {
      setPreviewState({ id, phase: 'error' })
      setStatus(error instanceof Error ? error.message : '음성을 재생하지 못했습니다.')
    }
  }

  const preview = (id: VoiceProfileId) => {
    const prepared = previewState?.id === id && (previewState.phase === 'ready' || previewState.phase === 'done')
    if (prepared) void playPreview(id)
    else void preparePreview(id)
  }

  const chooseBackend = (preference: TTSBackendPreference) => {
    previewPreparation.current?.abort()
    setBackendPreference(preference)
    saveTTSBackendPreference(preference)
    setModelProgress(null)
    setFirstAudioMs(null)
    setPreviewState(null)
    setStatus(`${preference === 'auto' ? '자동' : preference === 'webgpu' ? 'WebGPU(Metal)' : 'WASM 호환'} 모드로 저장했습니다. 다음 미리 듣기부터 적용됩니다.`)
  }

  const diagnosticContext = () => ({
    appVersion: APP_VERSION,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    secureContext: window.isSecureContext,
    crossOriginIsolated: window.crossOriginIsolated,
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
    webgpuAdvertised: browserSupportsWebGPU(),
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 'unknown',
    backendPreference,
    resolvedBackend: resolveTTSBackend(),
    activeBackend: getActiveBrowserTTSBackend(),
    runtimeInfo: getBrowserTTSRuntimeInfo(),
    fallbackReason: getBrowserTTSFallbackReason(),
    cacheState,
  })

  const copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(formatTTSDiagnostics(diagnosticContext()))
      setDiagnosticStatus('진단 로그를 클립보드에 복사했습니다.')
    } catch { setDiagnosticStatus('클립보드 복사에 실패했습니다. 아래 로그를 길게 눌러 복사해 주세요.') }
  }

  return <div className="voice-page">
    <header><Brand /><button className="text-button" onClick={onBack}><ArrowIcon direction="left" /> 설정으로</button></header>
    <main>
      <div className="voice-hero"><div><h1>듣기 음성을 골라보세요.</h1><p>미리 듣기에서 여성·남성 대화와 질문 상승 억양을 함께 비교하고, Listening·Speaking에서 사용할 기본 음성을 정할 수 있습니다.</p></div><div className="voice-current"><span>현재 기본 음성</span><strong>{getVoiceProfile(selected).name}</strong><small>{getVoiceProfile(selected).accent}</small></div></div>
      <div className="voice-notice"><strong>{localTts ? 'Kokoro 82M · 로컬 서버 실행 및 WAV 캐시' : isIOSBrowser() ? 'Kokoro 82M · iOS 병렬 WASM Worker' : 'Kokoro 82M · WebGPU/WASM Worker'}</strong><p>{localTts ? '문장은 외부 음성 API로 전송되지 않습니다. 로컬 서버가 모델을 한 번만 실행하고 생성한 음성을 디스크에 저장하므로, 같은 문장과 화자는 다음부터 즉시 재생됩니다.' : isIOSBrowser() ? 'iOS Safari에서는 ONNX Runtime 공식 지원 경로인 q8 WASM을 사용합니다. 음소 변환과 실제 ONNX 추론 시간을 진단 로그에서 따로 확인할 수 있고, 생성 음성은 최대 64MB 또는 200개까지만 보관합니다.' : '지원 기기에서는 ONNX Runtime native WebGPU EP를 사용하고, 지원되지 않거나 초기화에 실패하면 q8 WASM으로 자동 복귀합니다. 생성 음성은 최대 64MB 또는 200개까지만 보관합니다.'}</p></div>
      {!localTts && <section className="voice-backend" aria-label="브라우저 AI 실행 방식">
        <div className="voice-backend-head"><div><span>INFERENCE BACKEND</span><strong>이 기기: {isIOSBrowser() ? `iOS Safari · WASM ${window.crossOriginIsolated ? '병렬 실행 가능' : '단일 스레드'}` : browserSupportsWebGPU() ? 'WebGPU 사용 가능' : 'WebGPU 미지원 · WASM 사용'}</strong><small>현재 선택: {backendPreference === 'auto' ? `자동 (${resolveTTSBackend() === 'webgpu' ? 'WebGPU·Metal' : 'WASM'})` : backendPreference === 'webgpu' ? 'WebGPU·Metal' : 'WASM 호환'}{getActiveBrowserTTSBackend() ? ` · 실제 실행: ${getActiveBrowserTTSBackend() === 'webgpu' ? 'WebGPU·Metal' : 'WASM'}` : ''}</small></div>{firstAudioMs !== null && <em>첫 소리 {firstAudioMs.toLocaleString()}ms</em>}</div>
        <div className="voice-backend-options"><button className={backendPreference === 'auto' ? 'voice-backend-option voice-backend-option--active' : 'voice-backend-option'} onClick={() => chooseBackend('auto')}><strong>자동 권장</strong><span>{isIOSBrowser() ? 'iOS 공식 지원 경로 · 병렬 WASM' : '가능하면 WebGPU, 실패하면 WASM'}</span></button><button className={backendPreference === 'webgpu' ? 'voice-backend-option voice-backend-option--active' : 'voice-backend-option'} disabled={!browserSupportsWebGPU()} onClick={() => chooseBackend('webgpu')}><strong>WebGPU · Metal 실험</strong><span>iOS Safari에서는 ORT 공식 미지원</span></button><button className={backendPreference === 'wasm' ? 'voice-backend-option voice-backend-option--active' : 'voice-backend-option'} onClick={() => chooseBackend('wasm')}><strong>WASM 호환</strong><span>q8 약 90MB · 최대 4스레드</span></button></div>
        <p>iOS 자동 모드는 실패하는 WebGPU 초기화를 건너뛰고 ONNX Runtime이 공식 지원하는 WASM을 사용합니다. GitHub Pages에서는 첫 방문 때 한 번 새로고침해 병렬 실행을 활성화합니다.{runtimeInfo && <> 런타임: <code>{runtimeInfo.runtime === 'native-webgpu-ep' ? 'Native WebGPU EP' : 'WASM'} · ORT {runtimeInfo.ortVersion} · {runtimeInfo.runtimeVariant} · {runtimeInfo.dtype} · {runtimeInfo.threads} threads</code>.</>}{getBrowserTTSFallbackReason() && <> 최근 전환 이유: <code>{getBrowserTTSFallbackReason()}</code></>}</p>
      </section>}
      {!localTts && <section className="voice-download" aria-label="Kokoro 모델 저장 및 다운로드 상태">
        <div className="voice-download-head"><div><span>MODEL STORAGE</span><strong>{modelProgress?.phase === 'downloading' ? '모델 파일 다운로드 중' : modelProgress?.phase === 'loading-cache' ? '저장된 모델 읽는 중' : modelProgress?.phase === 'generating' ? 'AI 음성 생성 중' : modelProgress?.phase === 'playing' ? 'AI 음성 재생 중' : modelProgress?.phase === 'complete' || modelProgress?.phase === 'ready' ? 'Kokoro 82M 준비 완료' : cacheState === 'available' ? '이 브라우저에 모델 저장됨' : cacheState === 'missing' ? '아직 모델이 저장되지 않음' : cacheState === 'unsupported' ? '브라우저 저장소를 확인할 수 없음' : '브라우저 저장소 확인 중'}</strong></div><em className={cacheState === 'available' ? 'voice-cache-badge voice-cache-badge--ready' : 'voice-cache-badge'}>{cacheState === 'available' ? '캐시 확인됨' : cacheState === 'missing' ? '첫 사용 필요' : cacheState === 'unsupported' ? '확인 불가' : '확인 중'}</em></div>
        <div className={modelProgress && !['complete', 'ready', 'playing'].includes(modelProgress.phase) ? 'voice-progress voice-progress--active' : 'voice-progress'} role="progressbar" aria-label="Kokoro 모델 준비 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={modelProgress?.percent ?? (cacheState === 'available' ? 100 : 0)}><span style={{ width: `${modelProgress?.percent ?? (cacheState === 'available' ? 100 : 0)}%` }} /></div>
        <div className="voice-download-detail"><span>{modelProgress ? status : cacheState === 'available' ? '모델 파일은 브라우저의 transformers-cache에 보관되어 다음 방문에도 재사용됩니다.' : 'AI 음성의 미리 듣기를 누르면 실제 다운로드 퍼센트와 전송량이 여기에 표시됩니다.'}</span>{modelProgress?.loadedBytes !== undefined && modelProgress.totalBytes !== undefined && <strong>{(modelProgress.loadedBytes / 1024 / 1024).toFixed(1)} / {(modelProgress.totalBytes / 1024 / 1024).toFixed(1)} MB{modelProgress.file ? ` · ${modelProgress.file}` : ''}</strong>}</div>
      </section>}
      {!localTts && <details className="tts-diagnostics" open>
        <summary><span>임시 TTS 진단 도구</span><strong>{diagnostics.length ? `${diagnostics.length}개 이벤트` : '대기 중'}</strong></summary>
        <div className="tts-diagnostics__body">
          <dl>
            <div><dt>앱</dt><dd>v{APP_VERSION}</dd></div>
            <div><dt>선택 / 실제</dt><dd>{resolveTTSBackend()} / {getActiveBrowserTTSBackend() || '시작 전'}</dd></div>
            <div><dt>런타임</dt><dd>{runtimeInfo ? `${runtimeInfo.runtimeVariant} · ${runtimeInfo.dtype}` : '확인 전'}</dd></div>
            <div><dt>병렬 WASM</dt><dd>{window.crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined' ? '사용 가능' : '사용 불가'}</dd></div>
          </dl>
          <div className="tts-diagnostics__actions">
            <button className="button button--secondary" onClick={() => { stopTTS(); setStatus('현재 음성 작업을 중지했습니다.') }}>현재 작업 중지</button>
            <button className="button button--secondary" onClick={copyDiagnostics}>로그 복사</button>
            <button className="text-button" onClick={() => { clearTTSDiagnostics(); setDiagnosticStatus('진단 로그를 비웠습니다.') }}>로그 지우기</button>
          </div>
          {diagnosticStatus && <p>{diagnosticStatus}</p>}
          <ol aria-label="TTS 단계별 진단 로그">
            {diagnostics.length ? diagnostics.slice(-30).reverse().map((event) => <li key={event.id}><time>+{(event.elapsedMs / 1000).toFixed(1)}s</time><code>{event.source}:{event.stage}</code><span>{event.message}</span></li>) : <li><span>미리 듣기를 누르면 모델 확인부터 첫 오디오 조각까지 단계별 시간이 표시됩니다.</span></li>}
          </ol>
        </div>
      </details>}
      <section className="voice-list" aria-label="사용할 음성 선택">
        {VOICE_PROFILES.map((profile) => <article className={selected === profile.id ? 'voice-row voice-row--selected' : 'voice-row'} key={profile.id}>
          <div className="voice-radio" aria-hidden="true"><span /></div>
          <div className="voice-copy"><div><h2>{profile.name}</h2>{profile.recommended && <em>기본 권장</em>}</div><p>{profile.description}</p><small>{profile.accent}</small></div>
          <div className="voice-actions"><button className="button button--secondary" disabled={previewState?.phase === 'preparing' || previewState?.phase === 'playing'} onClick={() => preview(profile.id)}>{previewState?.id === profile.id && previewState.phase === 'preparing' ? '준비 중…' : previewState?.id === profile.id && previewState.phase === 'playing' ? '재생 중…' : previewState?.id === profile.id && previewState.phase === 'ready' ? '재생' : previewState?.id === profile.id && previewState.phase === 'done' ? '다시 재생' : previewState?.id === profile.id && previewState.phase === 'error' ? '준비 다시 시도' : '미리 듣기 준비'}</button><button className="button button--primary" disabled={selected === profile.id} onClick={() => choose(profile.id)}>{selected === profile.id ? '선택됨' : '이 음성 선택'}</button></div>
        </article>)}
      </section>
      <div className="voice-status" aria-live="polite"><span className={previewState?.phase === 'preparing' || previewState?.phase === 'playing' ? 'audio-pulse audio-pulse--active' : 'audio-pulse'} />{status}{firstAudioMs !== null && <strong>첫 소리 {firstAudioMs.toLocaleString()}ms</strong>}</div>
      <p className="voice-attribution">오픈소스 모델: <a href="https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX" target="_blank" rel="noreferrer">Kokoro-82M ONNX</a> · Apache 2.0</p>
    </main>
  </div>
}
