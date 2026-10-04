import { useState } from 'react'
import { notifyPrivateDataChanged } from './privateDataEvents'
import type { BaseItem } from './types'

export type WritingDraft = { text: string; savedAt: string; checked: string[] }
export type WritingPracticeRecord = { itemId: string; updatedAt: string; drafts: WritingDraft[] }
export type WritingPracticeBackup = Record<string, WritingPracticeRecord>
const KEY = 'focus-english-lab:writing-practice:v1'
export function loadWritingPractice(): WritingPracticeBackup { try { const value = JSON.parse(localStorage.getItem(KEY) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {} } catch { return {} } }
export function clearWritingPractice() { localStorage.removeItem(KEY) }
export function mergeWritingPractice(incoming: WritingPracticeBackup = {}) {
  const current = loadWritingPractice()
  for (const [key, record] of Object.entries(incoming || {})) {
    if (!record || typeof record.itemId !== 'string' || !key.endsWith(`:${record.itemId}`) || !Number.isFinite(Date.parse(record.updatedAt)) || !Array.isArray(record.drafts)) continue
    const valid = record.drafts.filter((draft) => draft && typeof draft.text === 'string' && Number.isFinite(Date.parse(draft.savedAt)) && Array.isArray(draft.checked) && draft.checked.every((value) => typeof value === 'string'))
    const previous = current[key]
    const merged = new Map<string, WritingDraft>()
    for (const draft of [...(previous?.drafts || []), ...valid]) merged.set(JSON.stringify([draft.savedAt, draft.text, [...draft.checked].sort()]), draft)
    // Imports may contain more than 20 historical drafts. Preserve all of them;
    // the existing save cap stops further additions rather than deleting work.
    const drafts = [...merged.values()].sort((a, b) => a.savedAt.localeCompare(b.savedAt))
    if (!drafts.length) continue
    current[key] = { itemId: record.itemId, updatedAt: previous && previous.updatedAt > record.updatedAt ? previous.updatedAt : record.updatedAt, drafts }
  }
  localStorage.setItem(KEY, JSON.stringify(current))
}
export function saveWritingDraft(sessionId: string, itemId: string, text: string, checked: string[], now = new Date().toISOString()) {
  if (!text.trim()) throw new Error('답안을 먼저 작성해 주세요.')
  const key = `${sessionId}:${itemId}`
  const current = loadWritingPractice()
  const previous = current[key]?.drafts || []
  if (previous.length >= 20) throw new Error('이 문항에는 초안 20개가 이미 저장되어 있습니다. 기존 기록을 보존하기 위해 추가 저장을 중단합니다.')
  current[key] = { itemId, updatedAt: now, drafts: [...previous, { text, savedAt: now, checked }] }
  localStorage.setItem(KEY, JSON.stringify(current)); notifyPrivateDataChanged()
  return current[key]
}

/** Never clear or replace unsaved work before its preservation succeeds. */
export function preserveWritingEditor(sessionId: string, itemId: string, response: string, checked: string[]) {
  const record = loadWritingPractice()[`${sessionId}:${itemId}`]
  if (!response.trim() || record?.drafts.at(-1)?.text === response) return record
  return saveWritingDraft(sessionId, itemId, response, checked)
}

export function WritingDraftReview({ sessionId, itemId }: { sessionId: string; itemId: string }) {
  const [record] = useState(() => loadWritingPractice()[`${sessionId}:${itemId}`])
  if (!record?.drafts?.length) return null
  return <section className="writing-workshop" aria-label="저장된 쓰기 작성본"><h3>이 문항의 작성 과정</h3><p>처음 쓴 글과 수정본을 보존한 기록입니다. 당시 최종 제출 답안은 위에 따로 표시됩니다.</p>{record.drafts.map((draft, index) => <details key={`${draft.savedAt}-${index}`}><summary>{index === 0 ? '첫 작성본' : `${index + 1}번째 작성본`} · {new Date(draft.savedAt).toLocaleString('ko-KR')}</summary><p>{draft.text}</p><small>자가 점검 {draft.checked.length}개</small></details>)}</section>
}

export default function WritingWorkshop({ item, sessionId, response, onApply }: { item: BaseItem; sessionId: string; response: string; onApply: (text: string) => void }) {
  const [record, setRecord] = useState(() => loadWritingPractice()[`${sessionId}:${item.id}`])
  const [checked, setChecked] = useState<string[]>([])
  const [modelVisible, setModelVisible] = useState(false)
  const [message, setMessage] = useState('')
  const checklist = item.taskChecklist || (item.kind === 'email' ? ['수신자와 이메일 목적이 명확하다', '문제에서 요구한 모든 사항에 답했다', '필요한 설명과 구체적인 요청을 포함했다', '수신자에 맞는 공손한 어조로 끝맺었다'] : ['주장과 핵심 이유가 명확하다', '구체적 설명이나 사례를 제시했다', '토론의 다른 의견과 연결했다', '문법과 어휘를 다시 확인했다'])
  const save = () => {
    try { const next = saveWritingDraft(sessionId, item.id, response, checked); setRecord(next); setMessage(`${next.drafts.length}번째 작성본을 저장했습니다. 아래에서 이전 글과 비교할 수 있습니다.`) } catch (error) { setMessage(error instanceof Error ? error.message : '초안을 저장하지 못했습니다.') }
  }
  const replaceEditor = (text: string, nextChecked: string[] = []) => {
    try {
      const preserved = preserveWritingEditor(sessionId, item.id, response, checked)
      setRecord(preserved); onApply(text); setChecked(nextChecked)
      setMessage(text ? '현재 글을 보존한 뒤 선택한 작성본을 복원했습니다.' : '현재 글까지 보존했습니다. 위 편집기에 새 글을 작성하세요.')
    } catch (error) { setMessage(`${error instanceof Error ? error.message : '현재 글을 저장하지 못했습니다.'} 편집기 내용은 바꾸지 않았습니다.`) }
  }
  const first = record?.drafts[0]
  const last = record?.drafts.at(-1)
  const count = (text: string) => text.trim().split(/\s+/).filter(Boolean).length
  return <section className="writing-workshop" aria-label="쓰기 재작성 학습"><h2>작성 → 확인 → 다시 쓰기</h2><p>AI 연결 없이도 체크리스트와 예시 답안을 사용할 수 있습니다. 체크 표시는 자기 점검이며 자동 채점이 아닙니다.</p><fieldset><legend>이 과제의 요구 사항</legend>{checklist.map((step) => <label key={step}><input type="checkbox" checked={checked.includes(step)} onChange={() => setChecked((current) => current.includes(step) ? current.filter((value) => value !== step) : [...current, step])} />{step}</label>)}</fieldset><div className="actions"><button className="button button--secondary" onClick={save} disabled={!response.trim()}>현재 작성본 저장</button><button className="button button--secondary" disabled={!first} onClick={() => replaceEditor('')}>새로 다시 쓰기</button>{item.modelResponse && <button className="text-button" aria-expanded={modelVisible} onClick={() => setModelVisible(!modelVisible)}>{modelVisible ? '예시 답안 숨기기' : '예시 답안과 실수 해설 보기'}</button>}</div>{message && <p role="status">{message}</p>}{modelVisible && <div className="writing-model"><h3>가능한 답안의 한 예</h3><p>{item.modelResponse}</p><h3>자주 하는 실수</h3><ul>{item.commonMistakes?.map((mistake) => <li key={mistake}>{mistake}</li>)}</ul><h3>내 내용으로 다시 쓰기</h3><ul>{item.rewriteGuidance?.map((step) => <li key={step}>{step}</li>)}</ul></div>}{first && <div className="draft-comparison"><article><h3>첫 작성본 · {count(first.text)}단어</h3><p>{first.text}</p><small>체크 {first.checked.length}/{checklist.length} · {new Date(first.savedAt).toLocaleString('ko-KR')}</small></article><article><h3>{record!.drafts.length > 1 ? '최근 저장본' : '현재 편집본'} · {count(record!.drafts.length > 1 ? last!.text : response)}단어</h3><p>{record!.drafts.length > 1 ? last!.text : response}</p><small>체크 {record!.drafts.length > 1 ? last!.checked.length : checked.length}/{checklist.length}</small></article></div>}{record && <details><summary>저장한 작성본 {record.drafts.length}개</summary>{record.drafts.map((draft, index) => <article key={`${draft.savedAt}-${index}`}><h3>{index + 1}번째 작성본</h3><p>{draft.text}</p><button className="text-button" onClick={() => replaceEditor(draft.text, draft.checked)}>편집기에 복원</button></article>)}</details>}</section>
}
