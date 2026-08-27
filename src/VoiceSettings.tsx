import { useEffect, useState } from 'react'
import { ArrowIcon, Brand } from './components'
import { getVoiceProfile, loadVoiceProfileId, playTTS, saveVoiceProfileId, stopTTS, VOICE_PROFILES, type VoiceProfileId } from './tts'

const PREVIEW_TEXT = 'Student: I am trying to understand the new research schedule. Advisor: Let us review the evidence together before you make a decision.'

export default function VoiceSettings({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState<VoiceProfileId>(loadVoiceProfileId)
  const [previewing, setPreviewing] = useState<VoiceProfileId | null>(null)
  const [status, setStatus] = useState('음성을 선택한 뒤 미리 듣기로 비교해 보세요.')
  useEffect(() => () => stopTTS(), [])

  const choose = (id: VoiceProfileId) => {
    setSelected(id)
    saveVoiceProfileId(id)
    setStatus(`${getVoiceProfile(id).name} 음성을 기본값으로 저장했습니다.`)
  }
  const preview = async (id: VoiceProfileId) => {
    setPreviewing(id)
    try {
      const result = await playTTS(PREVIEW_TEXT, id, setStatus)
      if (result === 'completed') setStatus(`${getVoiceProfile(id).name} 미리 듣기가 끝났습니다.`)
      if (result === 'fallback') setStatus('AI 모델을 불러오지 못해 기기 기본 음성으로 재생했습니다.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '음성을 재생하지 못했습니다.')
    } finally { setPreviewing(null) }
  }

  return <div className="voice-page">
    <header><Brand /><button className="text-button" onClick={onBack}><ArrowIcon direction="left" /> 홈으로</button></header>
    <main>
      <div className="voice-hero"><div><h1>듣기 음성을 골라보세요.</h1><p>실제 학습 환경처럼 자연스러운 AI 음성과 여러 억양을 비교하고, Listening·Speaking에서 사용할 기본 음성을 정할 수 있습니다.</p></div><div className="voice-current"><span>현재 기본 음성</span><strong>{getVoiceProfile(selected).name}</strong><small>{getVoiceProfile(selected).accent}</small></div></div>
      <div className="voice-notice"><strong>Kokoro 82M · 브라우저에서 직접 실행</strong><p>AI 음성은 문장을 외부 음성 API로 전송하지 않습니다. 처음 사용할 때 약 90MB 모델을 한 번 내려받아 브라우저 캐시에 저장하므로 미리 듣기 시작까지 시간이 걸릴 수 있습니다.</p></div>
      <section className="voice-list" aria-label="사용할 음성 선택">
        {VOICE_PROFILES.map((profile) => <article className={selected === profile.id ? 'voice-row voice-row--selected' : 'voice-row'} key={profile.id}>
          <div className="voice-radio" aria-hidden="true"><span /></div>
          <div className="voice-copy"><div><h2>{profile.name}</h2>{profile.recommended && <em>기본 권장</em>}</div><p>{profile.description}</p><small>{profile.accent}</small></div>
          <div className="voice-actions"><button className="button button--secondary" disabled={previewing !== null} onClick={() => preview(profile.id)}>{previewing === profile.id ? '준비 중…' : '미리 듣기'}</button><button className="button button--primary" disabled={selected === profile.id} onClick={() => choose(profile.id)}>{selected === profile.id ? '선택됨' : '이 음성 선택'}</button></div>
        </article>)}
      </section>
      <div className="voice-status" aria-live="polite"><span className={previewing ? 'audio-pulse audio-pulse--active' : 'audio-pulse'} />{status}</div>
      <p className="voice-attribution">오픈소스 모델: <a href="https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX" target="_blank" rel="noreferrer">Kokoro-82M ONNX</a> · Apache 2.0</p>
    </main>
  </div>
}
