import type { SavedSession } from './types'

const ACTIVE_KEY = 'focus-english-lab.active:v2'
const HISTORY_KEY = 'focus-english-lab.history:v2'
const LEGACY_ACTIVE_KEY = 'focus-english-lab.active'
const LEGACY_HISTORY_KEY = 'focus-english-lab.history'

export function loadActive(): SavedSession | null {
  try {
    const value = localStorage.getItem(ACTIVE_KEY) || localStorage.getItem(LEGACY_ACTIVE_KEY)
    if (!value) return null
    if (!localStorage.getItem(ACTIVE_KEY)) localStorage.setItem(ACTIVE_KEY, value)
    return JSON.parse(value)
  } catch { return null }
}

export function saveActive(session: SavedSession) {
  try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(session)) } catch { /* Storage may be disabled. */ }
}

export function finishSession(session: SavedSession) {
  const completed = { ...session, completed: true, randomEligible: session.randomEligible !== false, updatedAt: new Date().toISOString() }
  const history = loadHistory()
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([completed, ...history].slice(0, 50)))
    localStorage.removeItem(ACTIVE_KEY)
    localStorage.removeItem(LEGACY_ACTIVE_KEY)
  } catch { /* Keep the in-memory result when storage is unavailable. */ }
  return completed
}

export function loadHistory(): SavedSession[] {
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
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)) } catch { /* Keep the current in-memory state when storage is unavailable. */ }
  return next
}

export function loadExcludedItemIds() {
  const excluded = new Set<string>()
  for (const session of loadHistory()) {
    if (session.randomEligible !== false) continue
    for (const id of session.itemIds || []) excluded.add(id)
  }
  return excluded
}
