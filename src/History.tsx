import { useMemo, useState } from 'react'
import { ArrowIcon, Brand } from './components'
import { SECTION_META } from './data'
import { getAvailablePracticeItems } from './examPack'
import { displayAnswer, getSessionStats, isCorrect } from './review'
import { loadHistory, setSessionRandomEligibility } from './storage'
import type { BaseItem, SavedSession, Section } from './types'

const ITEM_BY_ID = new Map(getAvailablePracticeItems().map((item) => [item.id, item]))

function sessionItems(session: SavedSession) {
  return (session.itemIds || []).map((id) => ITEM_BY_ID.get(id)).filter((item): item is BaseItem => Boolean(item))
}

function sessionLabel(items: BaseItem[], session?: SavedSession) {
  if (session?.mode === 'study') return '즉시 피드백 랜덤 세트'
  if (session?.mode === 'mock') return '실전 모의시험'
  const sections = [...new Set(items.map((item) => item.section))]
  return sections.length > 1 ? '전체 모의시험' : sections[0] ? `${SECTION_META[sections[0] as Section].label} 집중 연습` : '연습 세트'
}

function RandomPoolButton({ session, onChange }: { session: SavedSession; onChange: (next: SavedSession[]) => void }) {
  const included = session.randomEligible !== false
  const toggle = () => onChange(setSessionRandomEligibility(session.id, !included))
  return <button className={included ? 'pool-toggle' : 'pool-toggle pool-toggle--excluded'} aria-pressed={!included} onClick={toggle}><span>{included ? '랜덤 후보에 포함 중' : '랜덤 후보에서 제외됨'}</span><small>{included ? '이 세트의 문항이 다시 출제될 수 있습니다.' : '이 세트의 문항은 랜덤 세트에서 빠집니다.'}</small></button>
}

function HistoryDetail({ session, onBack, onHistoryChange }: { session: SavedSession; onBack: () => void; onHistoryChange: (next: SavedSession[]) => void }) {
  const items = sessionItems(session)
  const stats = getSessionStats(items, session)
  return <div className="history-page"><header><Brand /><button className="text-button" onClick={onBack}><ArrowIcon direction="left" /> 기록 목록</button></header><main><div className="history-detail-head"><div><span>{sessionLabel(items, session)}</span><h1>{new Date(session.startedAt).toLocaleString('ko-KR')}</h1><p>{items.length}문항 중 {stats.answered}문항 응답 · 자동 채점 {stats.correct}/{stats.objective.length}</p></div><RandomPoolButton session={session} onChange={onHistoryChange} /></div><section className="history-review"><div className="section-heading"><h2>문항별 정답과 해설</h2><p>문항을 펼치면 당시 문제, 내 답, 정답과 해설을 확인할 수 있습니다.</p></div><div className="history-question-list">{items.map((item, index) => {
    const objective = item.answer !== undefined
    const correct = objective && isCorrect(item, session.answers[item.id])
    return <details className="history-question" key={item.id}><summary><span>{index + 1}</span><span><strong>{item.prompt || item.instruction}</strong><small>{SECTION_META[item.section].label} · {item.title} · {item.topic}{item.difficulty ? ` · ${item.difficulty}` : ''}</small></span><em className={!objective ? 'history-status history-status--subjective' : correct ? 'history-status history-status--correct' : 'history-status history-status--wrong'}>{!objective ? '작성형' : correct ? '정답' : '복습'}</em></summary><div className="history-question-body">{(item.passage || item.audioText) && <blockquote><span>{item.passage ? '지문' : '음성 원문'}</span><p>{item.passage || item.audioText}</p></blockquote>}<dl><dt>내 답</dt><dd>{displayAnswer(item, session.answers[item.id])}</dd>{objective && <><dt>정답</dt><dd>{displayAnswer(item, item.answer)}</dd></>}</dl>{item.explanation ? <div className="history-explanation"><strong>해설</strong><p>{item.explanation}</p></div> : <div className="history-explanation"><strong>{objective ? '해설' : '작성형 응답'}</strong><p>{objective ? '별도 해설이 제공되지 않은 문항입니다.' : '자동 정답이 없는 문항입니다. 저장된 응답을 확인하고 Writing 코치 또는 Speaking 재연습에 활용하세요.'}</p></div>}</div></details>
  })}</div></section></main></div>
}

export default function History({ onBack, initialSessionId = null }: { onBack: () => void; initialSessionId?: string | null }) {
  const [history, setHistory] = useState(loadHistory)
  const [selectedId, setSelectedId] = useState<string | null>(initialSessionId)
  const selected = useMemo(() => history.find((session) => session.id === selectedId) || null, [history, selectedId])
  if (selected) return <HistoryDetail session={selected} onBack={() => setSelectedId(null)} onHistoryChange={setHistory} />
  const excludedItems = new Set(history.filter((session) => session.randomEligible === false).flatMap((session) => session.itemIds || [])).size
  return <div className="history-page"><header><Brand /><button className="text-button" onClick={onBack}><ArrowIcon direction="left" /> 홈으로</button></header><main><div className="history-hero"><div><span>Learning history</span><h1>학습 기록</h1><p>완료한 세트의 답안과 해설을 다시 보고, 해당 문항을 앞으로의 랜덤 출제에 넣을지 결정할 수 있습니다.</p></div><dl><div><dt>완료한 세트</dt><dd>{history.length}</dd></div><div><dt>랜덤 제외 문항</dt><dd>{excludedItems}</dd></div></dl></div>{history.length === 0 ? <div className="history-empty"><strong>완료한 세트가 없습니다.</strong><span>시험이나 연습 세트를 끝까지 마치면 기록과 답안이 여기에 저장됩니다.</span></div> : <section className="history-cards" aria-label="완료한 학습 기록">{history.map((session) => {
    const items = sessionItems(session)
    const stats = getSessionStats(items, session)
    return <article className="history-card" key={session.id}><div className="history-card-main"><span>{sessionLabel(items, session)}</span><h2>{new Date(session.startedAt).toLocaleString('ko-KR')}</h2><p>{stats.answered}/{items.length} 응답 · 자동 채점 {stats.correct}/{stats.objective.length}{stats.practiceBand ? ` · ${stats.practiceBand.toFixed(1)}/6.0` : ''}</p><button className="button button--secondary" onClick={() => setSelectedId(session.id)}>정답과 해설 보기 <ArrowIcon /></button></div><RandomPoolButton session={session} onChange={setHistory} /></article>
  })}</section>}</main></div>
}
