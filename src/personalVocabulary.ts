import { FAVORITES_KEY, PERSONAL_WORDS_KEY, loadFavorites, loadPersonalWords, normalizeWord, type LearningEntry } from './learning'
import { notifyPrivateDataChanged } from './privateDataEvents'

export type PersonalWordStat = {
  word: string
  attempts: number
  correct: number
  incorrect: number
  lastStudiedAt: string
  masteredAt?: string
}

export type DailyTaskDirection = 'meaning' | 'spelling'

export type DailyWordBatch = {
  version: 1
  id: string
  createdAt: string
  entries: LearningEntry[]
  queue: string[]
  position: number
  retryTaskIds: string[]
  retryRound: number
  totalAttempts: number
  complete: boolean
}

export type VocabularySession = {
  id: string
  kind: 'daily-intake' | 'personal-review'
  startedAt: string
  completedAt: string
  wordCount: number
  attempts: number
  correct: number
  incorrect: number
}

export type PersonalVocabularyBackup = {
  format: 'focus-english-personal-vocabulary'
  version: 1
  exportedAt: string
  personalWords: LearningEntry[]
  favorites: string[]
  stats: Record<string, PersonalWordStat>
  activeBatch: DailyWordBatch | null
  sessions: VocabularySession[]
}

const STATS_KEY = 'focus-english-lab:personal-vocabulary-stats:v1'
const ACTIVE_BATCH_KEY = 'focus-english-lab:daily-word-batch:v1'
const SESSIONS_KEY = 'focus-english-lab:vocabulary-sessions:v1'

const shuffle = <T,>(values: T[], random: () => number = Math.random) => {
  const next = [...values]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[next[index], next[target]] = [next[target], next[index]]
  }
  return next
}

const taskId = (word: string, direction: DailyTaskDirection) => `${normalizeWord(word)}:${direction}`

export function parseDailyWordLines(value: string) {
  const parsed = new Map<string, { word: string; meaningKo: string }>()
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const parts = line.split(/\t|\s*[,;|:]\s*|\s+[–—-]\s+/)
    const word = normalizeWord(parts.shift() || '')
    const meaningKo = parts.join(', ').trim()
    if (word && meaningKo) parsed.set(word, { word, meaningKo })
  }
  return [...parsed.values()]
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + Number(left[leftIndex - 1] !== right[rightIndex - 1]),
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[right.length]
}

export function findVocabularyMatches(word: string, entries: LearningEntry[], limit = 4) {
  const query = normalizeWord(word)
  if (!query) return []
  const matches: Array<{ entry: LearningEntry; kind: 'exact' | 'similar'; score: number }> = []
  for (const entry of entries) {
    const candidate = normalizeWord(entry.word)
    if (!candidate) continue
    if (candidate === query) {
      matches.push({ entry, kind: 'exact', score: 0 })
      continue
    }
    if (query.length < 3 || candidate[0] !== query[0] || Math.abs(candidate.length - query.length) > 2) continue
    const prefixRelated = candidate.startsWith(query) || query.startsWith(candidate)
    const distance = editDistance(query, candidate)
    if (distance <= 2 || prefixRelated) matches.push({ entry, kind: 'similar', score: (prefixRelated ? 5 : 10) + distance + Math.abs(candidate.length - query.length) })
  }
  return matches.sort((a, b) => a.score - b.score || a.entry.word.localeCompare(b.entry.word)).slice(0, limit)
}

export function attachPersonalMeaning(entry: LearningEntry, meaningKo: string): LearningEntry {
  return {
    ...entry,
    word: normalizeWord(entry.word),
    meaningKo,
    personalMeaningKo: meaningKo,
    dictionaryMeaningKo: entry.dictionaryMeaningKo || entry.meaningKo,
    topics: [...new Set(['내가 만든 단어장', ...(entry.topics || [])])],
  }
}

export function createDailyWordBatch(entries: LearningEntry[], random: () => number = Math.random): DailyWordBatch {
  const unique = [...new Map(entries.map((entry) => [normalizeWord(entry.word), { ...entry, word: normalizeWord(entry.word) }])).values()]
  const queue = shuffle(unique.flatMap((entry) => [taskId(entry.word, 'meaning'), taskId(entry.word, 'spelling')]), random)
  return {
    version: 1,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    entries: unique,
    queue,
    position: 0,
    retryTaskIds: [],
    retryRound: 1,
    totalAttempts: 0,
    complete: queue.length === 0,
  }
}

export function currentDailyTask(batch: DailyWordBatch) {
  const id = batch.queue[batch.position]
  if (!id) return null
  const separator = id.lastIndexOf(':')
  const word = id.slice(0, separator)
  const direction = id.slice(separator + 1) as DailyTaskDirection
  const entry = batch.entries.find((candidate) => normalizeWord(candidate.word) === word)
  return entry ? { id, entry, direction } : null
}

export function advanceDailyWordBatch(batch: DailyWordBatch, correct: boolean, random: () => number = Math.random) {
  const current = batch.queue[batch.position]
  if (!current || batch.complete) return batch
  const retryTaskIds = correct ? batch.retryTaskIds : [...batch.retryTaskIds, current]
  const totalAttempts = batch.totalAttempts + 1
  if (batch.position + 1 < batch.queue.length) return { ...batch, position: batch.position + 1, retryTaskIds, totalAttempts }
  if (retryTaskIds.length) {
    const next = shuffle([...new Set(retryTaskIds)], random)
    return { ...batch, queue: next, position: 0, retryTaskIds: [], retryRound: batch.retryRound + 1, totalAttempts }
  }
  return { ...batch, position: batch.queue.length, retryTaskIds: [], totalAttempts, complete: true }
}

export function loadPersonalWordStats() {
  try {
    const stored = JSON.parse(localStorage.getItem(STATS_KEY) || '{}')
    return stored && typeof stored === 'object' ? stored as Record<string, PersonalWordStat> : {}
  } catch { return {} }
}

export function recordPersonalWordAttempt(word: string, correct: boolean, mastered = false) {
  const normalized = normalizeWord(word)
  const stats = loadPersonalWordStats()
  const previous = stats[normalized]
  const now = new Date().toISOString()
  stats[normalized] = {
    word: normalized,
    attempts: (previous?.attempts || 0) + 1,
    correct: (previous?.correct || 0) + Number(correct),
    incorrect: (previous?.incorrect || 0) + Number(!correct),
    lastStudiedAt: now,
    masteredAt: mastered ? previous?.masteredAt || now : previous?.masteredAt,
  }
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); notifyPrivateDataChanged() } catch { /* storage can be disabled */ }
  return stats[normalized]
}

export function markPersonalWordsMastered(words: string[]) {
  const stats = loadPersonalWordStats()
  const now = new Date().toISOString()
  for (const value of words) {
    const word = normalizeWord(value)
    const previous = stats[word]
    stats[word] = { word, attempts: previous?.attempts || 0, correct: previous?.correct || 0, incorrect: previous?.incorrect || 0, lastStudiedAt: previous?.lastStudiedAt || now, masteredAt: previous?.masteredAt || now }
  }
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); notifyPrivateDataChanged() } catch { /* storage can be disabled */ }
}

export function saveActiveDailyBatch(batch: DailyWordBatch | null) {
  try {
    if (batch) localStorage.setItem(ACTIVE_BATCH_KEY, JSON.stringify(batch))
    else localStorage.removeItem(ACTIVE_BATCH_KEY)
    notifyPrivateDataChanged()
  } catch { /* storage can be disabled */ }
}

export function loadActiveDailyBatch(): DailyWordBatch | null {
  try {
    const stored = JSON.parse(localStorage.getItem(ACTIVE_BATCH_KEY) || 'null') as DailyWordBatch | null
    return stored?.version === 1 && Array.isArray(stored.entries) && Array.isArray(stored.queue) ? stored : null
  } catch { return null }
}

export function saveVocabularySession(session: VocabularySession) {
  const sessions = loadVocabularySessions()
  try { localStorage.setItem(SESSIONS_KEY, JSON.stringify([session, ...sessions].slice(0, 200))); notifyPrivateDataChanged() } catch { /* storage can be disabled */ }
}

export function loadVocabularySessions(): VocabularySession[] {
  try {
    const stored = JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]')
    return Array.isArray(stored) ? stored : []
  } catch { return [] }
}

export function selectBalancedPersonalReview(entries: LearningEntry[], stats: Record<string, PersonalWordStat>, size = 100, random: () => number = Math.random) {
  const unique = [...new Map(entries.map((entry) => [normalizeWord(entry.word), entry])).values()]
  const target = Math.min(size, unique.length)
  const half = Math.floor(target / 2)
  const byDifficulty = [...unique].sort((a, b) => {
    const left = stats[normalizeWord(a.word)]
    const right = stats[normalizeWord(b.word)]
    const leftRate = left?.attempts ? left.incorrect / left.attempts : 0
    const rightRate = right?.attempts ? right.incorrect / right.attempts : 0
    return (right?.incorrect || 0) - (left?.incorrect || 0) || rightRate - leftRate || (right?.attempts || 0) - (left?.attempts || 0)
  })
  const difficultPool = byDifficulty.filter((entry) => (stats[normalizeWord(entry.word)]?.incorrect || 0) > 0)
  const difficult = difficultPool.slice(0, half)
  const selected = new Set(difficult.map((entry) => normalizeWord(entry.word)))
  const stablePool = byDifficulty
    .filter((entry) => !selected.has(normalizeWord(entry.word)))
    .sort((a, b) => (stats[normalizeWord(a.word)]?.incorrect || 0) - (stats[normalizeWord(b.word)]?.incorrect || 0) || (stats[normalizeWord(b.word)]?.attempts || 0) - (stats[normalizeWord(a.word)]?.attempts || 0))
  const stable = stablePool.slice(0, target - difficult.length)
  const combined = [...difficult, ...stable]
  if (combined.length < target) combined.push(...byDifficulty.filter((entry) => !combined.includes(entry)).slice(0, target - combined.length))
  return { entries: shuffle(combined.slice(0, target), random), difficultCount: difficult.length, stableCount: Math.min(stable.length, target - difficult.length) }
}

export function createPersonalVocabularyBackup(): PersonalVocabularyBackup {
  return {
    format: 'focus-english-personal-vocabulary',
    version: 1,
    exportedAt: new Date().toISOString(),
    personalWords: loadPersonalWords(),
    favorites: [...loadFavorites()],
    stats: loadPersonalWordStats(),
    activeBatch: loadActiveDailyBatch(),
    sessions: loadVocabularySessions(),
  }
}

export function downloadPersonalVocabularyBackup() {
  const backup = createPersonalVocabularyBackup()
  const date = backup.exportedAt.slice(0, 10)
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `focus-english-vocabulary-${date}.json`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return backup
}

export function importPersonalVocabularyBackup(text: string, notify = true) {
  const backup = JSON.parse(text) as PersonalVocabularyBackup
  if (backup?.format !== 'focus-english-personal-vocabulary' || backup.version !== 1 || !Array.isArray(backup.personalWords) || !Array.isArray(backup.favorites)) throw new Error('Focus English Lab 개인 단어장 백업 파일이 아닙니다.')
  const words = new Map(loadPersonalWords().map((entry) => [normalizeWord(entry.word), entry]))
  for (const entry of backup.personalWords) if (entry?.word) words.set(normalizeWord(entry.word), { ...entry, word: normalizeWord(entry.word) })
  const favorites = loadFavorites()
  for (const word of backup.favorites) favorites.add(normalizeWord(word))
  for (const word of words.keys()) favorites.add(word)
  const currentStats = loadPersonalWordStats()
  const mergedStats = { ...currentStats }
  for (const [word, incoming] of Object.entries(backup.stats || {})) {
    const normalized = normalizeWord(word)
    const current = currentStats[normalized]
    mergedStats[normalized] = current ? {
      word: normalized,
      attempts: Math.max(current.attempts, incoming.attempts || 0),
      correct: Math.max(current.correct, incoming.correct || 0),
      incorrect: Math.max(current.incorrect, incoming.incorrect || 0),
      lastStudiedAt: current.lastStudiedAt > incoming.lastStudiedAt ? current.lastStudiedAt : incoming.lastStudiedAt,
      masteredAt: current.masteredAt || incoming.masteredAt,
    } : { ...incoming, word: normalized }
  }
  const sessions = new Map(loadVocabularySessions().map((session) => [session.id, session]))
  for (const session of backup.sessions || []) if (session?.id) sessions.set(session.id, session)
  localStorage.setItem(PERSONAL_WORDS_KEY, JSON.stringify([...words.values()]))
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]))
  localStorage.setItem(STATS_KEY, JSON.stringify(mergedStats))
  localStorage.setItem(SESSIONS_KEY, JSON.stringify([...sessions.values()].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 200)))
  if (!loadActiveDailyBatch() && backup.activeBatch && !backup.activeBatch.complete) saveActiveDailyBatch(backup.activeBatch)
  if (notify) notifyPrivateDataChanged()
  return { words: words.size, sessions: sessions.size }
}
