import type { SavedSession } from './types'
import { notifyPrivateDataChanged } from './privateDataEvents'
import { clearExamReview, loadExamReview, mergeExamReview, type ExamReviewState } from './examReviewLearning'
import { clearWritingPractice, loadWritingPractice, mergeWritingPractice, type WritingPracticeBackup } from './WritingWorkshop'

const ACTIVE_KEY = 'focus-english-lab.active:v2'
const HISTORY_KEY = 'focus-english-lab.history:v2'
const LEGACY_ACTIVE_KEY = 'focus-english-lab.active'
const LEGACY_HISTORY_KEY = 'focus-english-lab.history'
let volatileActive: SavedSession | null | undefined
let volatileHistory: SavedSession[] | undefined
export const SESSION_STORAGE_WARNING_EVENT = 'focus-english-lab:session-storage-warning'
export function getSessionStorageWarning() {
  return volatileActive !== undefined || volatileHistory !== undefined ? '학습 기록을 브라우저에 저장하지 못했습니다. 답안·결과는 현재 탭에만 임시 보관됩니다. 새로고침하거나 종료하기 전에 JSON 백업을 내려받으세요.' : ''
}
function reportSessionStorage() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_STORAGE_WARNING_EVENT))
}

export function loadActive(): SavedSession | null {
  if (volatileActive !== undefined) return volatileActive
  try {
    const value = localStorage.getItem(ACTIVE_KEY) || localStorage.getItem(LEGACY_ACTIVE_KEY)
    if (!value) return null
    if (!localStorage.getItem(ACTIVE_KEY)) localStorage.setItem(ACTIVE_KEY, value)
    return JSON.parse(value)
  } catch { return null }
}

export function saveActive(session: SavedSession) {
  try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(session)); volatileActive = undefined; notifyPrivateDataChanged() }
  catch { volatileActive = session }
  reportSessionStorage()
}

export function finishSession(session: SavedSession) {
  const completed = { ...session, completed: true, randomEligible: session.randomEligible !== false, updatedAt: new Date().toISOString() }
  const history = loadHistory()
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([completed, ...history].slice(0, 50)))
    localStorage.removeItem(ACTIVE_KEY)
    localStorage.removeItem(LEGACY_ACTIVE_KEY)
    volatileActive = undefined; volatileHistory = undefined
    notifyPrivateDataChanged()
  } catch { volatileHistory = [completed, ...history].slice(0, 50); volatileActive = null }
  reportSessionStorage()
  return completed
}

export function loadHistory(): SavedSession[] {
  if (volatileHistory !== undefined) return volatileHistory
  try {
    const value = localStorage.getItem(HISTORY_KEY) || localStorage.getItem(LEGACY_HISTORY_KEY)
    if (!value) return []
    if (!localStorage.getItem(HISTORY_KEY)) localStorage.setItem(HISTORY_KEY, value)
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map((session) => ({ ...session, randomEligible: session.randomEligible !== false })) : []
  } catch { return [] }
}

export function setSessionRandomEligibility(sessionId: string, randomEligible: boolean) {
  const next = loadHistory().map((session) => session.id === sessionId ? { ...session, randomEligible } : session)
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); volatileHistory = undefined; notifyPrivateDataChanged() } catch { volatileHistory = next }
  reportSessionStorage()
  return next
}

export type SessionBackup = { version: 1; active: SavedSession | null; history: SavedSession[]; examReview?: ExamReviewState; writingPractice?: WritingPracticeBackup }

export function createSessionBackup(): SessionBackup {
  return { version: 1, active: loadActive(), history: loadHistory(), examReview: loadExamReview(), writingPractice: loadWritingPractice() }
}

export function importSessionBackup(backup: SessionBackup, notify = true) {
  if (backup?.version !== 1 || !Array.isArray(backup.history)) return
  if (backup.examReview) mergeExamReview(backup.examReview, false)
  if (backup.writingPractice) mergeWritingPractice(backup.writingPractice)
  const sessions = new Map(loadHistory().map((session) => [session.id, session]))
  for (const incoming of backup.history) {
    if (!incoming?.id) continue
    const current = sessions.get(incoming.id)
    if (!current || (incoming.updatedAt || incoming.startedAt) > (current.updatedAt || current.startedAt)) sessions.set(incoming.id, incoming)
  }
  const history = [...sessions.values()].sort((a, b) => (b.updatedAt || b.startedAt).localeCompare(a.updatedAt || a.startedAt)).slice(0, 50)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  volatileHistory = undefined
  const currentActive = loadActive()
  const mergedActive = backup.active && (!currentActive || (backup.active.updatedAt || backup.active.startedAt) > (currentActive.updatedAt || currentActive.startedAt)) ? backup.active : currentActive
  if (mergedActive) localStorage.setItem(ACTIVE_KEY, JSON.stringify(mergedActive))
  else if (volatileActive === null) { localStorage.removeItem(ACTIVE_KEY); localStorage.removeItem(LEGACY_ACTIVE_KEY) }
  volatileActive = undefined; reportSessionStorage()
  if (notify) notifyPrivateDataChanged()
}

export function clearAllSessionData(notify = true) {
  clearExamReview()
  clearWritingPractice()
  localStorage.removeItem(ACTIVE_KEY)
  localStorage.removeItem(HISTORY_KEY)
  localStorage.removeItem(LEGACY_ACTIVE_KEY)
  localStorage.removeItem(LEGACY_HISTORY_KEY)
  volatileActive = undefined; volatileHistory = undefined; reportSessionStorage()
  if (notify) notifyPrivateDataChanged()
}

export function loadExcludedItemIds() {
  const excluded = new Set<string>()
  for (const session of loadHistory()) {
    if (session.randomEligible !== false) continue
    for (const id of session.itemIds || []) excluded.add(id)
  }
  return excluded
}
