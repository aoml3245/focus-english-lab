import { deriveStimulusGroupId } from './examBlueprint'
import { notifyPrivateDataChanged } from './privateDataEvents'
import { scoreItem } from './review'
import type { BaseItem, SavedSession } from './types'

export const REVIEW_REASONS = ['어휘 부족', '세부 정보 놓침', '추론 오류', '문법 오류', '시간 부족', '기타'] as const
export type ReviewReason = typeof REVIEW_REASONS[number]
export type ExamReviewRecord = {
  item: BaseItem; wrongCount: number; correctStreak: number; reasons: ReviewReason[]
  dueAt: string; updatedAt: string; lastAttemptId: string
  attemptIds?: string[]
  lastAttemptAt?: string
}
export type ExamReviewState = Record<string, ExamReviewRecord>
const KEY = 'focus-english-lab:exam-review:v1'
let storageWarning = ''
export function examReviewStorageWarning() { return storageWarning }

export function loadExamReview(): ExamReviewState {
  try { const parsed = JSON.parse(localStorage.getItem(KEY) || '{}'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {} } catch { storageWarning = '오답 기록 저장소에 접근하지 못했습니다. 브라우저 저장 권한과 공간을 확인해 주세요.'; return {} }
}
export function saveExamReview(state: ExamReviewState, notify = true) {
  localStorage.setItem(KEY, JSON.stringify(state))
  storageWarning = ''
  if (notify) notifyPrivateDataChanged()
}
export function clearExamReview() { localStorage.removeItem(KEY) }
export function mergeExamReview(incoming: ExamReviewState = {}, notify = true) {
  const current = loadExamReview()
  for (const [id, record] of Object.entries(incoming)) {
    if (!record?.item || record.item.id !== id || !Number.isFinite(Date.parse(record.updatedAt)) || !Number.isFinite(Date.parse(record.dueAt)) || !Array.isArray(record.reasons)) continue
    if (!current[id] || record.updatedAt > current[id].updatedAt) current[id] = record
  }
  saveExamReview(current, notify)
}

export function applyReviewAttempt(state: ExamReviewState, item: BaseItem, correct: boolean, attemptId: string, now = new Date().toISOString()): ExamReviewState {
  const previous = state[item.id]
  if (previous?.lastAttemptId === attemptId || previous?.attemptIds?.includes(attemptId) || (!previous && correct)) return state
  if (previous?.lastAttemptAt && now < previous.lastAttemptAt) return state
  const correctStreak = correct ? (previous?.correctStreak || 0) + 1 : 0
  const intervalMinutes = correct ? [1440, 4320, 10080, 20160][Math.min(correctStreak - 1, 3)] : 10
  return { ...state, [item.id]: {
    item: structuredClone(item), wrongCount: (previous?.wrongCount || 0) + (correct ? 0 : 1), correctStreak,
    reasons: previous?.reasons || [], lastAttemptId: attemptId, updatedAt: now,
    lastAttemptAt: now,
    attemptIds: [...(previous?.attemptIds || (previous ? [previous.lastAttemptId] : [])), attemptId].slice(-200),
    dueAt: new Date(Date.parse(now) + intervalMinutes * 60_000).toISOString(),
  } }
}
export function recordExamReview(session: SavedSession, items: BaseItem[], onlyReviewed = false) {
  let state = loadExamReview()
  const timestamp = session.completed && Number.isFinite(Date.parse(session.updatedAt)) ? session.updatedAt : new Date().toISOString()
  for (const item of items) {
    if (item.answer === undefined || (onlyReviewed && !session.reviewedItemIds?.includes(item.id))) continue
    const score = scoreItem(item, session.answers[item.id])
    state = applyReviewAttempt(state, item, score.total > 0 && score.correct === score.total, `${session.id}:${item.id}`, timestamp)
  }
  try { saveExamReview(state) } catch { storageWarning = '오답 복습 기록을 저장하지 못했습니다. 기존 답안은 보존하며 브라우저 저장 공간을 확인해 주세요.' }
  return state
}
export function setReviewReason(item: BaseItem, reasons: ReviewReason[]) {
  const state = loadExamReview()
  const previous = state[item.id]
  if (!previous) return state
  const next = { ...state, [item.id]: { ...previous, reasons: reasons.filter((reason) => REVIEW_REASONS.includes(reason)), updatedAt: new Date().toISOString() } }
  saveExamReview(next)
  return next
}
export function reviewQueue(state: ExamReviewState, dueOnly = true, now = new Date().toISOString()) {
  return Object.values(state).filter((record) => !dueOnly || record.dueAt <= now).sort((a, b) => a.dueAt.localeCompare(b.dueAt) || b.wrongCount - a.wrongCount)
}

export function createReviewPractice(state: ExamReviewState, bank: BaseItem[], mode: 'exact' | 'transfer', dueOnly = true, now = new Date().toISOString(), limit = 10) {
  const queue = reviewQueue(state, dueOnly, now).slice(0, limit)
  const selected: BaseItem[] = []
  const usedGroups = new Set<string>()
  const originalIds = new Set(Object.keys(state))
  for (const record of queue) {
    const source = record.item
    if (mode === 'exact') {
      // Several mistakes can share one passage. Retain every queued question,
      // not just the first mistake from that stimulus.
      selected.push(source)
      continue
    }
    const candidates = bank.filter((candidate) => candidate.kind === source.kind && candidate.title === source.title && !originalIds.has(candidate.id) && candidate.id !== source.id && deriveStimulusGroupId(candidate) !== deriveStimulusGroupId(source))
      .map((candidate) => ({ candidate, fit: (candidate.grammarFocus && candidate.grammarFocus === source.grammarFocus ? 4 : 0) + (candidate.targetSkills?.some((skill) => source.targetSkills?.includes(skill)) ? 3 : 0) + (candidate.difficulty === source.difficulty ? 2 : 0) + (candidate.topic === source.topic ? 1 : 0), tie: crypto.getRandomValues(new Uint32Array(1))[0] }))
      .sort((a, b) => b.fit - a.fit || a.tie - b.tie).map(({ candidate }) => candidate)
    const chosen = candidates.find((item) => !usedGroups.has(deriveStimulusGroupId(item)))
    if (!chosen) continue
    const groupId = deriveStimulusGroupId(chosen)
    usedGroups.add(groupId)
    // Transfer exercises retain a whole new stimulus.
    selected.push(...bank.filter((item) => deriveStimulusGroupId(item) === groupId).sort((a, b) => (a.sequenceIndex || 0) - (b.sequenceIndex || 0)))
  }
  return selected
}
