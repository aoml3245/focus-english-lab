import { useState } from 'react'
import { ArrowIcon, Brand } from './components'
import { createReviewPractice, examReviewStorageWarning, loadExamReview, recordExamReview, reviewQueue, REVIEW_REASONS, setReviewReason, type ReviewReason } from './examReviewLearning'
import { loadHistory } from './storage'
import { resolveSessionItems } from './sessionQuestions'
import type { BaseItem } from './types'

export function ReviewCausePanel({ item, onSaved }: { item: BaseItem; onSaved?: () => void }) {
  const [initial] = useState(() => loadExamReview()[item.id])
  const [reasons, setReasons] = useState<ReviewReason[]>(() => initial?.reasons || [])
  const [error, setError] = useState('')
  if (!initial) return null
  return <fieldset className="review-causes"><legend>왜 어려웠나요? 다음 복습을 위해 표시하세요.</legend>{REVIEW_REASONS.map((reason) => <label key={reason}><input type="checkbox" checked={reasons.includes(reason)} onChange={() => {
    const next = reasons.includes(reason) ? reasons.filter((value) => value !== reason) : [...reasons, reason]
    try { setReviewReason(item, next); setReasons(next); setError(''); onSaved?.() } catch { setError('복습 원인을 저장하지 못했습니다. 저장 공간을 확인해 주세요.') }
  }} />{reason}</label>)}{error && <p role="alert">{error}</p>}</fieldset>
}

export default function ExamReviewWorkshop({ bank, onBack, onBegin }: { bank: BaseItem[]; onBack: () => void; onBegin: (items: BaseItem[], source: 'exact' | 'transfer') => void }) {
  const [state, setState] = useState(() => {
    const byId = new Map(bank.map((item) => [item.id, item]))
    for (const session of [...loadHistory()].reverse()) recordExamReview(session, resolveSessionItems(session, byId))
    return loadExamReview()
  })
  const [dueOnly, setDueOnly] = useState(true)
  const [reason, setReason] = useState<ReviewReason | ''>('')
  const [message, setMessage] = useState('')
  const all = reviewQueue(state, false)
  const due = reviewQueue(state)
  const filtered = Object.fromEntries(Object.entries(state).filter(([, record]) => !reason || record.reasons.includes(reason)))
  const queue = reviewQueue(filtered, dueOnly)
  const start = (source: 'exact' | 'transfer') => {
    const selected = createReviewPractice(filtered, bank, source, dueOnly)
    if (!selected.length) { setMessage(source === 'transfer' ? '이 범위에는 새로운 유사 문제가 없습니다. 같은 문제 복습을 선택해 주세요.' : '지금 복습할 문제가 없습니다. 전체 오답 보기로 먼저 연습할 수 있습니다.'); return }
    onBegin(selected, source)
  }
  return <div className="simple-page review-workshop"><header><Brand /><button className="text-button" onClick={onBack}><ArrowIcon direction="left" /> 홈으로</button></header><main><h1>오답 재학습</h1><p>틀린 문제는 10분 뒤부터 다시 확인하고, 연속 정답에 따라 1일 → 3일 → 7일 → 14일 간격으로 복습합니다. 정답을 한 번 맞혔다고 기록을 지우지 않습니다.</p><div className="result-grid"><div><span>오늘 복습</span><strong>{due.length}</strong></div><div><span>오답 학습 기록</span><strong>{all.length}</strong></div></div><div className="review-options"><label><input type="checkbox" checked={dueOnly} onChange={(event) => setDueOnly(event.target.checked)} /> 복습 시간이 된 문제만</label><label>원인 필터<select value={reason} onChange={(event) => setReason(event.target.value as ReviewReason | '')}><option value="">모든 원인</option>{REVIEW_REASONS.map((value) => <option key={value}>{value}</option>)}</select></label></div><div className="actions"><button className="button button--primary" onClick={() => start('exact')}>같은 문제 다시 풀기</button><button className="button button--secondary" onClick={() => start('transfer')}>새 유사 문제로 연습</button></div><p>같은 문제는 당시 지문과 보기를 유지합니다. 새 유사 문제는 유형·문법·목표 기능·난이도를 우선해 선택하며 완전히 동일한 능력을 측정한다고 보장하지 않습니다.</p>{message && <p role="status">{message}</p>}{examReviewStorageWarning() && <p className="notice notice--error" role="alert">{examReviewStorageWarning()}</p>}{queue.length === 0 ? <p className="notice">현재 필터의 복습 대상이 없습니다.</p> : <section className="review-records">{queue.slice(0, 40).map((record) => <article key={record.item.id}><strong>{record.item.title} · {record.item.topic}</strong><p>{record.item.prompt || record.item.instruction}</p><small>틀린 횟수 {record.wrongCount} · 연속 정답 {record.correctStreak} · 다음 {new Date(record.dueAt).toLocaleString('ko-KR')}</small><ReviewCausePanel key={`${record.item.id}-${record.updatedAt}`} item={record.item} onSaved={() => setState(loadExamReview())} /><button className="text-button" onClick={() => setState(loadExamReview())}>표시 새로고침</button></article>)}</section>}</main></div>
}
