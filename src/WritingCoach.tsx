import { useEffect, useRef, useState } from 'react'
import { askWritingCoach, coachWriting, getCoachModelStatus, loadWritingFeedback, saveSelectedCoachModel, type CoachModelStatus, type WritingFeedback } from './writingCoachEngine'
import type { BaseItem } from './types'

type ChatMessage = { role: 'learner' | 'coach'; text: string }

export default function WritingCoach({ item, response, onApply, onBusyChange }: { item: BaseItem; response: string; onApply: (text: string) => void; onBusyChange?: (busy: boolean) => void }) {
  const [modelStatus, setModelStatus] = useState<CoachModelStatus | null>(null)
  const [feedback, setFeedback] = useState<WritingFeedback | null>(() => loadWritingFeedback(item.id, response))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [question, setQuestion] = useState('')
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [asking, setAsking] = useState(false)
  const mounted = useRef(true)
  const wordCount = response.trim() ? response.trim().split(/\s+/).length : 0

  useEffect(() => { let active = true; getCoachModelStatus().then((status) => { if (active) setModelStatus(status) }); return () => { active = false } }, [])
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; onBusyChange?.(false) }
  }, [onBusyChange])

  const runCoach = async () => {
    setLoading(true); onBusyChange?.(true); setError(''); setChat([])
    try {
      const result = await coachWriting(item, response)
      if (mounted.current) setFeedback(result)
    }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : '코칭 결과를 생성하지 못했습니다.') }
    finally { if (mounted.current) { setLoading(false); onBusyChange?.(false) } }
  }

  const ask = async () => {
    if (!feedback || !question.trim()) return
    const learnerQuestion = question.trim()
    setQuestion(''); setAsking(true); onBusyChange?.(true); setChat((current) => [...current, { role: 'learner', text: learnerQuestion }])
    try {
      const answer = await askWritingCoach(item, response, feedback, learnerQuestion)
      if (mounted.current) setChat((current) => [...current, { role: 'coach', text: answer }])
    } catch (cause) { if (mounted.current) setChat((current) => [...current, { role: 'coach', text: cause instanceof Error ? cause.message : '답변을 만들지 못했습니다.' }]) }
    finally { if (mounted.current) { setAsking(false); onBusyChange?.(false) } }
  }

  const generalModels = modelStatus?.installed.filter((model) => !model.toLowerCase().includes('translate')) || []
  const coachReady = Boolean(modelStatus?.connected && generalModels.includes(modelStatus.selected))
  const checklist = item.kind === 'email'
    ? ['첫 문장에서 목적을 밝히기', '상황이 나에게 미친 영향을 구체화하기', '제안된 계획을 정확히 언급하기', '공손하고 구체적인 질문으로 마무리하기']
    : ['첫 문장에서 입장을 분명히 밝히기', '핵심 이유를 한 가지 깊게 설명하기', '구체적인 사례나 결과로 뒷받침하기', '다른 의견과 연결해 토론에 기여하기']
  return <aside className="writing-coach" aria-label="AI 글쓰기 코치">
    <div className="coach-head"><div><span>AI Writing Coach</span><h2>고쳐 쓰며 배우기</h2></div>{modelStatus && <select aria-label="글쓰기 코칭 모델" value={modelStatus.selected} onChange={(event) => { saveSelectedCoachModel(event.target.value); setModelStatus({ ...modelStatus, selected: event.target.value }) }}>{generalModels.length ? generalModels.map((model) => <option key={model}>{model}</option>) : <option>{modelStatus.selected}</option>}</select>}</div>
    {!feedback && <div className="coach-start"><p>ETS 기준으로 과제 수행, 내용 전개, 구성, 문법·어휘, 어조를 진단하고 수정 순서를 알려줍니다.</p><div className="coach-checklist"><h3>작성 전 체크</h3><ol>{checklist.map((step) => <li key={step}>{step}</li>)}</ol></div><dl><div><dt>현재 분량</dt><dd>{wordCount}단어</dd></div><div><dt>연결 상태</dt><dd>{coachReady ? '코치 준비됨' : modelStatus?.connected ? '코칭 모델 필요' : 'Ollama 확인 필요'}</dd></div></dl>{modelStatus?.connected && !modelStatus.recommendedInstalled && <div className="coach-model-note"><strong>추천 모델: qwen3.5:9b</strong><span>번역 전용 모델은 글쓰기 평가에 사용하지 않습니다.</span></div>}<button className="button button--primary" disabled={loading || wordCount < 20 || !coachReady} onClick={runCoach}>{loading ? '답안을 꼼꼼히 읽는 중…' : 'AI 코칭 받기'}</button>{wordCount < 20 && <small>20단어 이상 작성하면 코칭을 시작할 수 있습니다.</small>}{error && <p className="coach-error">{error}</p>}</div>}
    {feedback && <div className="coach-feedback">
      <section className="coach-score"><div><span>연습 추정치</span><strong>{feedback.estimatedScore.toFixed(1)}<small>/5</small></strong></div><div><span>예상 수준</span><strong>{feedback.cefr}</strong></div><p>{feedback.verdict}</p></section>
      <section><h3>잘한 점</h3><ul>{feedback.strengths.map((strength) => <li key={strength}>{strength}</li>)}</ul></section>
      <section><h3>기준별 진단</h3><div className="criteria-list">{feedback.criteria.map((criterion) => <article key={criterion.name}><div><strong>{criterion.name}</strong><span>{criterion.score.toFixed(1)} / 5</span></div><i><b style={{ width: `${criterion.score * 20}%` }} /></i><p>{criterion.feedback}</p></article>)}</div></section>
      <section><h3>우선 고칠 부분</h3>{feedback.issues.length ? <div className="issue-list">{feedback.issues.map((issue, index) => <article key={`${issue.quote}-${index}`}><span>{issue.category}</span><del>{issue.quote}</del><strong>{issue.correction}</strong><p>{issue.explanationKo}</p></article>)}</div> : <p className="coach-muted">큰 오류가 발견되지 않았습니다.</p>}</section>
      <section><h3>수정 순서</h3><ol>{feedback.revisionPlan.map((step) => <li key={step}>{step}</li>)}</ol></section>
      <section className="coach-revision"><h3>한 단계 나은 글</h3><p>{feedback.revisedResponse}</p><button className="button button--secondary" onClick={() => onApply(feedback.revisedResponse)}>이 수정본으로 편집하기</button></section>
      <section className="coach-chat"><h3>코치에게 질문</h3>{chat.map((message, index) => <p className={`coach-chat-${message.role}`} key={`${message.role}-${index}`}><strong>{message.role === 'learner' ? '나' : '코치'}</strong>{message.text}</p>)}<div><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void ask() }} placeholder="왜 이렇게 고쳤는지 물어보세요" /><button onClick={() => void ask()} disabled={asking || !question.trim()}>{asking ? '생각 중' : '질문'}</button></div></section>
      <div className="coach-actions"><button className="text-button" onClick={() => setFeedback(null)}>새로 평가하기</button><small>{feedback.model} · ETS 공식 점수가 아닌 연습 추정치</small></div>
    </div>}
  </aside>
}
