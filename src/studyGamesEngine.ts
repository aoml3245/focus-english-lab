import type { LearningEntry } from './learning'

export type StudyGame = 'vocabulary' | 'sentence'
export type VocabularyTask = 'meaning' | 'synonym' | 'spelling'
export type SentenceTask = 'translation' | 'composition'

export type StudyQuestion = {
  id: string
  game: StudyGame
  task: VocabularyTask | SentenceTask
  entry: LearningEntry
  options?: string[]
  answer: string
}

export type StudyGameFilter = {
  level: string
  academicOnly: boolean
  savedWords?: Set<string>
}

const shuffle = <T,>(values: T[], random: () => number) => {
  const next = [...values]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[next[index], next[target]] = [next[target], next[index]]
  }
  return next
}

const eligible = (entry: LearningEntry, filter: StudyGameFilter) =>
  (filter.level === 'All' || entry.cefr === filter.level) &&
  (!filter.academicOnly || Boolean(entry.academicCore)) &&
  (!filter.savedWords || filter.savedWords.has(entry.word))

function synonymOptions(entry: LearningEntry, pool: LearningEntry[], random: () => number) {
  const answer = entry.synonyms[0]
  const distractors = shuffle(
    [...new Set(pool.flatMap((candidate) => candidate.synonyms).filter((word) => word !== answer && !entry.synonyms.includes(word)))],
    random,
  ).slice(0, 3)
  return distractors.length === 3 ? shuffle([answer, ...distractors], random) : undefined
}

export function buildStudyQuestions(
  entries: LearningEntry[],
  game: StudyGame,
  size: number,
  filter: StudyGameFilter,
  random: () => number = Math.random,
) {
  const filtered = entries.filter((entry) => eligible(entry, filter))
  const sentencePool = filtered.filter((entry) => entry.source === 'corpus' && entry.example && entry.translation)
  const pool = game === 'sentence' ? sentencePool : filtered
  const selected = shuffle(pool, random).slice(0, Math.min(size, pool.length))

  return selected.map<StudyQuestion>((entry, index) => {
    if (game === 'sentence') {
      const task: SentenceTask = index % 2 === 0 ? 'translation' : 'composition'
      return { id: `${entry.word}-${task}-${index}`, game, task, entry, answer: task === 'translation' ? entry.translation : entry.example }
    }
    const desired: VocabularyTask = (['meaning', 'synonym', 'spelling'] as const)[index % 3]
    if (desired === 'synonym') {
      const options = entry.synonyms.length ? synonymOptions(entry, filtered, random) : undefined
      if (options) return { id: `${entry.word}-synonym-${index}`, game, task: 'synonym', entry, options, answer: entry.synonyms[0] }
    }
    const task: VocabularyTask = desired === 'spelling' ? 'spelling' : 'meaning'
    return { id: `${entry.word}-${task}-${index}`, game, task, entry, answer: task === 'spelling' ? entry.word : entry.meaningKo }
  })
}

export function normalizeSpelling(value: string) {
  return value.trim().toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ')
}

export function isObjectiveAnswerCorrect(question: StudyQuestion, response: string) {
  if (question.task !== 'spelling' && question.task !== 'synonym') return null
  return normalizeSpelling(response) === normalizeSpelling(question.answer)
}

