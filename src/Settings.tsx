import { useEffect, useState } from 'react'
import { ArrowIcon, Brand } from './components'
import { findLocalModels, loadLocalLlmConfig, saveLocalLlmConfig, type LocalLlmConfig } from './learning'
import { browserSupportsWebGPU, getVoiceProfile, hasLocalTtsServer, resolveTTSBackend } from './tts'
import { clearTtsAudioCache, getTtsAudioCacheStats, TTS_AUDIO_CACHE_MAX_BYTES, TTS_AUDIO_CACHE_MAX_ENTRIES, type TtsAudioCacheStats } from './ttsAudioCache'
import { getCoachModelStatus, loadSelectedCoachModel, saveSelectedCoachModel, type CoachModelStatus } from './writingCoachEngine'
import { APP_VERSION } from './version'
import { refreshAppToLatest } from './AppUpdate'
import { loadThemePreference, saveThemePreference, type ThemePreference } from './theme'

const EMPTY_CACHE: TtsAudioCacheStats = { entries: 0, bytes: 0 }
const formatMegabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes ? 1 : 0)} MB`

export default function Settings({ onBack, onVoiceSettings, onExamData }: { onBack: () => void; onVoiceSettings: () => void; onExamData: () => void }) {
  const [themePreference, setThemePreference] = useState<ThemePreference>(loadThemePreference)
  const [readingConfig, setReadingConfig] = useState<LocalLlmConfig>(loadLocalLlmConfig)
  const [readingModels, setReadingModels] = useState<string[]>([])
  const [readingStatus, setReadingStatus] = useState('읽기 도우미에서 단어 뜻과 문장 해석에 사용합니다.')
  const [readingChecking, setReadingChecking] = useState(false)
  const [coachStatus, setCoachStatus] = useState<CoachModelStatus | null>(null)
  const [coachModel, setCoachModel] = useState(loadSelectedCoachModel)
  const [coachChecking, setCoachChecking] = useState(false)
  const [cache, setCache] = useState<TtsAudioCacheStats>(EMPTY_CACHE)
  const [cacheBusy, setCacheBusy] = useState(true)
  const [cacheMessage, setCacheMessage] = useState('저장된 생성 음성의 사용량을 확인하고 있습니다.')
  const [updateBusy, setUpdateBusy] = useState(false)
  const [updateMessage, setUpdateMessage] = useState('학습 기록·단어장·설정·Kokoro 모델은 유지하고 앱 코드만 새로 불러옵니다.')

  useEffect(() => {
    let active = true
    void getTtsAudioCacheStats().then((stats) => {
      if (!active) return
      setCache(stats)
      setCacheBusy(false)
      setCacheMessage('같은 문장과 화자는 저장된 음성을 재사용해 더 빠르게 재생합니다.')
    })
    return () => { active = false }
  }, [])

  const checkReading = async () => {
    setReadingChecking(true)
    try {
      const saved = saveLocalLlmConfig(readingConfig)
      setReadingConfig(saved)
      const models = await findLocalModels(saved)
      setReadingModels(models)
      setReadingStatus(models.length ? `연결됨 · 설치된 모델 ${models.length}개` : '연결됐지만 설치된 모델이 없습니다.')
    } catch (error) { setReadingStatus(error instanceof Error ? error.message : '로컬 LLM을 확인하지 못했습니다.') }
    finally { setReadingChecking(false) }
  }

  const saveReading = () => {
    try {
      const saved = saveLocalLlmConfig(readingConfig)
      setReadingConfig(saved)
      setReadingStatus(`${saved.model} 설정을 저장했습니다.`)
    } catch (error) { setReadingStatus(error instanceof Error ? error.message : '설정을 저장하지 못했습니다.') }
  }

  const checkCoach = async () => {
    setCoachChecking(true)
    const status = await getCoachModelStatus()
    setCoachStatus(status)
    if (status.connected) {
      setCoachModel(status.selected)
      saveSelectedCoachModel(status.selected)
    }
    setCoachChecking(false)
  }

  const chooseCoach = (model: string) => {
    setCoachModel(model)
    saveSelectedCoachModel(model)
  }

  const clearCache = async () => {
    if (!window.confirm('생성된 음성 캐시를 비울까요? Kokoro 모델 자체는 유지되지만, 같은 문장을 다음에 다시 합성해야 합니다.')) return
    setCacheBusy(true)
    try {
      await clearTtsAudioCache()
      setCache(EMPTY_CACHE)
      setCacheMessage('생성 음성 캐시를 비웠습니다. Kokoro 모델 파일은 그대로 유지됩니다.')
    } catch { setCacheMessage('음성 캐시를 비우지 못했습니다.') }
    finally { setCacheBusy(false) }
  }

  const forceUpdate = async () => {
    setUpdateBusy(true)
    try {
      await refreshAppToLatest(setUpdateMessage)
    } catch (error) {
      setUpdateMessage(error instanceof Error ? error.message : '앱을 새로 불러오지 못했습니다. 네트워크를 확인해 주세요.')
      setUpdateBusy(false)
    }
  }

  const chooseTheme = (theme: ThemePreference) => {
    setThemePreference(theme)
    saveThemePreference(theme)
  }

  return <div className="settings-page">
    <header><Brand /><button className="text-button" onClick={onBack}><ArrowIcon direction="left" /> 홈으로</button></header>
    <main>
      <div className="settings-hero"><span>SETTINGS</span><h1>학습 환경 설정</h1><p>화면 테마, 음성, 로컬 AI, 브라우저 저장공간처럼 기기마다 달라지는 설정을 여기에서 관리합니다.</p></div>

      <section className="settings-section">
        <div className="settings-section-head"><div><span>01</span><h2>화면 테마</h2><p>기기의 화면 모드를 따르거나 라이트·다크 테마를 직접 고정할 수 있습니다.</p></div></div>
        <div className="theme-options" role="group" aria-label="화면 테마 선택">
          {([
            ['system', '시스템 설정', '기기의 라이트·다크 모드를 자동으로 따릅니다.'],
            ['light', '라이트', '밝은 배경과 진한 글자를 사용합니다.'],
            ['dark', '다크', '어두운 배경으로 눈부심을 줄입니다.'],
          ] as const).map(([value, label, description]) => <button key={value} type="button" className={themePreference === value ? 'theme-option theme-option--active' : 'theme-option'} aria-pressed={themePreference === value} onClick={() => chooseTheme(value)}><strong>{label}</strong><span>{description}</span></button>)}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-head"><div><span>02</span><h2>음성 및 재생</h2><p>Listening·Speaking·단어장에서 사용할 기본 음성과 엔진을 관리합니다.</p></div><button className="button button--primary" onClick={onVoiceSettings}>음성 상세 설정 <ArrowIcon /></button></div>
        <dl className="settings-summary"><div><dt>현재 음성</dt><dd>{getVoiceProfile().name}</dd></div><div><dt>실행 방식</dt><dd>{hasLocalTtsServer() ? '로컬 서버 · WAV 캐시' : resolveTTSBackend() === 'webgpu' ? 'WebGPU · Apple Metal/GPU 우선' : `WASM · CPU 호환${browserSupportsWebGPU() ? '' : ' (WebGPU 미지원)'}`}</dd></div></dl>
      </section>

      <section className="settings-section">
        <div className="settings-section-head"><div><span>03</span><h2>읽기 도우미 로컬 AI</h2><p>단어의 문맥 뜻·동의어와 선택한 문장의 해석을 생성하는 Ollama 설정입니다.</p></div></div>
        <div className="settings-form-grid">
          <label><span>Ollama 서버 주소</span><input value={readingConfig.endpoint} onChange={(event) => setReadingConfig({ ...readingConfig, endpoint: event.target.value })} inputMode="url" autoCapitalize="none" /></label>
          <label><span>번역·어휘 모델</span><input value={readingConfig.model} onChange={(event) => setReadingConfig({ ...readingConfig, model: event.target.value })} list="reading-models" autoCapitalize="none" /><datalist id="reading-models">{readingModels.map((model) => <option key={model} value={model} />)}</datalist></label>
        </div>
        <div className="settings-actions"><button className="button button--secondary" onClick={checkReading} disabled={readingChecking}>{readingChecking ? '확인 중…' : '연결 및 모델 확인'}</button><button className="button button--primary" onClick={saveReading}>설정 저장</button><span aria-live="polite">{readingStatus}</span></div>
      </section>

      <section className="settings-section">
        <div className="settings-section-head"><div><span>04</span><h2>쓰기 코칭 로컬 AI</h2><p>답안 평가, 교정, 개선 답안과 후속 질문에 사용할 모델입니다.</p></div></div>
        <div className="settings-model-row"><label><span>코칭 모델</span><select value={coachModel} onChange={(event) => chooseCoach(event.target.value)}>{coachStatus?.installed.length ? coachStatus.installed.map((model) => <option key={model}>{model}</option>) : <option>{coachModel}</option>}</select></label><button className="button button--secondary" onClick={checkCoach} disabled={coachChecking}>{coachChecking ? '확인 중…' : 'Ollama 모델 확인'}</button></div>
        <p className={coachStatus?.connected === false ? 'settings-status settings-status--error' : 'settings-status'}>{coachStatus ? coachStatus.connected ? `연결됨 · 설치된 모델 ${coachStatus.installed.length}개${coachStatus.recommendedInstalled ? ' · 권장 qwen3.5:9b 설치됨' : ''}` : 'Ollama에 연결할 수 없습니다. 로컬 앱에서 Ollama를 실행한 뒤 다시 확인하세요.' : '기본 권장 모델은 qwen3.5:9b이며, 확인 전에는 저장된 모델을 표시합니다.'}</p>
      </section>

      <section className="settings-section">
        <div className="settings-section-head"><div><span>05</span><h2>시험 데이터 관리</h2><p>문제 파일을 불러오거나 현재 문제은행을 다른 기기로 옮길 수 있습니다.</p></div><button className="button button--primary" onClick={onExamData}>시험 데이터 열기 <ArrowIcon /></button></div>
      </section>

      <section className="settings-section">
        <div className="settings-section-head"><div><span>06</span><h2>브라우저 저장공간</h2><p>생성된 음성만 제한된 용량으로 저장합니다. Kokoro 모델과 학습 기록은 이 버튼으로 지우지 않습니다.</p></div><button className="button button--secondary" onClick={clearCache} disabled={cacheBusy || cache.entries === 0}>{cacheBusy ? '확인 중…' : '생성 음성 비우기'}</button></div>
        <div className="settings-cache-meter"><div><strong>{formatMegabytes(cache.bytes)}</strong><span> / {formatMegabytes(TTS_AUDIO_CACHE_MAX_BYTES)}</span></div><div className="settings-meter" aria-label="생성 음성 캐시 사용량"><span style={{ width: `${Math.min(100, cache.bytes / TTS_AUDIO_CACHE_MAX_BYTES * 100)}%` }} /></div><small>{cache.entries} / {TTS_AUDIO_CACHE_MAX_ENTRIES}개 · {cacheMessage}</small></div>
      </section>

      <section className="settings-section">
        <div className="settings-section-head"><div><span>07</span><h2>앱 업데이트</h2><p>GitHub Pages의 최신 배포를 다시 확인하고, 이전 앱 파일 캐시를 우회해 새 버전으로 재시작합니다.</p></div><button className="button button--primary" onClick={() => { void forceUpdate() }} disabled={updateBusy}>{updateBusy ? '최신 버전 확인 중…' : '최신 버전 강제 적용'}</button></div>
        <dl className="settings-summary"><div><dt>현재 실행 버전</dt><dd>{APP_VERSION}</dd></div><div><dt>보존되는 데이터</dt><dd>학습 기록 · 단어장 · 음성 모델</dd></div></dl>
        <p className="settings-status" role="status" aria-live="polite">{updateMessage}</p>
      </section>

      <footer className="settings-footer"><Brand /><p>개발 중인 0.x 버전입니다. 기능 변경마다 버전을 올려 배포 상태를 구분합니다.</p><strong>Version {APP_VERSION}</strong></footer>
    </main>
  </div>
}
