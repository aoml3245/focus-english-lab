import type { LearningEntry } from './learning'

export type StudyGame = 'vocabulary' | 'sentence'
export type VocabularyTask = 'meaning' | 'synonym' | 'spelling'
export type SentenceTask = 'translation' | 'composition'
export type MasteryTask = 'meaning-recall' | 'spelling-recall' | 'cloze-choice' | 'synonym-choice' | 'cloze-spelling'

export type MasteryStage = {
  task: MasteryTask
  label: string
  repetitions: number
  description: string
}

export type MasteryProgress = {
  stageIndex: number
  cycle: number
  queue: string[]
  position: number
  retryWords: string[]
  retryRound: number
  totalAttempts: number
  complete: boolean
}

export const MASTERY_STAGES: MasteryStage[] = [
  { task: 'meaning-recall', label: '뜻 회상', repetitions: 3, description: '영단어만 보고 뜻을 떠올립니다.' },
  { task: 'spelling-recall', label: '철자 회상', repetitions: 3, description: '한국어 뜻을 보고 영어 단어를 적습니다.' },
  { task: 'cloze-choice', label: '문맥 선택', repetitions: 2, description: '예문의 빈칸에 들어갈 단어를 고릅니다.' },
  { task: 'synonym-choice', label: '동의어 변별', repetitions: 2, description: '문맥과 가장 가까운 동의어를 고릅니다.' },
  { task: 'cloze-spelling', label: '문맥 철자', repetitions: 1, description: '예문의 빈칸을 직접 완성합니다.' },
]

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

const unique = (values: string[]) => [...new Set(values)]

export function masteryMinimumAttempts(wordCount: number) {
  return MASTERY_STAGES.reduce((total, stage) => total + stage.repetitions * wordCount, 0)
}

export function createMasteryProgress(entries: LearningEntry[], random: () => number = Math.random): MasteryProgress {
  return {
    stageIndex: 0,
    cycle: 1,
    queue: shuffle(unique(entries.map((entry) => entry.word)), random),
    position: 0,
    retryWords: [],
    retryRound: 1,
    totalAttempts: 0,
    complete: entries.length === 0,
  }
}

export function advanceMasteryProgress(
  progress: MasteryProgress,
  correct: boolean,
  allWords: string[],
  random: () => number = Math.random,
) {
  if (progress.complete || !progress.queue.length) return { progress, transition: '' }
  const currentWord = progress.queue[progress.position]
  const retryWords = correct ? progress.retryWords : [...progress.retryWords, currentWord]
  const attempts = progress.totalAttempts + 1
  if (progress.position + 1 < progress.queue.length) {
    return { progress: { ...progress, position: progress.position + 1, retryWords, totalAttempts: attempts }, transition: '' }
  }
  if (retryWords.length) {
    const next = unique(retryWords)
    return {
      progress: { ...progress, queue: shuffle(next, random), position: 0, retryWords: [], retryRound: progress.retryRound + 1, totalAttempts: attempts },
      transition: `${next.length}개만 다시 확인합니다.`,
    }
  }
  const stage = MASTERY_STAGES[progress.stageIndex]
  if (progress.cycle < stage.repetitions) {
    return {
      progress: { ...progress, cycle: progress.cycle + 1, queue: shuffle(unique(allWords), random), position: 0, retryWords: [], retryRound: 1, totalAttempts: attempts },
      transition: `${stage.label} ${progress.cycle + 1}/${stage.repetitions}회 반복을 시작합니다.`,
    }
  }
  if (progress.stageIndex + 1 < MASTERY_STAGES.length) {
    const nextStage = MASTERY_STAGES[progress.stageIndex + 1]
    return {
      progress: { ...progress, stageIndex: progress.stageIndex + 1, cycle: 1, queue: shuffle(unique(allWords), random), position: 0, retryWords: [], retryRound: 1, totalAttempts: attempts },
      transition: `${stage.label}을 모두 통과했습니다. ${nextStage.label}을 시작합니다.`,
    }
  }
  return { progress: { ...progress, position: progress.queue.length, retryWords: [], totalAttempts: attempts, complete: true }, transition: '100단어 마스터리 코스를 모두 통과했습니다.' }
}

export function maskMasterySentence(entry: LearningEntry) {
  const escaped = entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const masked = entry.example.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '_____')
  return masked === entry.example ? `${entry.example}  [_____ = ${entry.meaningKo}]` : masked
}

export function buildMasteryOptions(entry: LearningEntry, pool: LearningEntry[], task: 'cloze-choice' | 'synonym-choice', random: () => number = Math.random) {
  const answer = task === 'cloze-choice' ? entry.word : entry.synonyms[0] || entry.meaningEn
  const candidates = task === 'cloze-choice'
    ? pool.filter((candidate) => candidate.word !== entry.word && candidate.partOfSpeech === entry.partOfSpeech).map((candidate) => candidate.word)
    : pool.flatMap((candidate) => candidate.synonyms.length ? candidate.synonyms : [candidate.meaningEn]).filter((candidate) => candidate !== answer)
  const fallback = task === 'cloze-choice'
    ? pool.filter((candidate) => candidate.word !== entry.word).map((candidate) => candidate.word)
    : pool.filter((candidate) => candidate.word !== entry.word).map((candidate) => candidate.meaningEn)
  const distractors = shuffle(unique([...candidates, ...fallback].filter(Boolean)), random).slice(0, 3)
  return { answer, options: shuffle(unique([answer, ...distractors]), random) }
}

const eligible = (entry: LearningEntry, filter: StudyGameFilter) =>
  (filter.level === 'All' || entry.cefr === filter.level) &&
  (!filter.academicOnly || Boolean(entry.academicCore)) &&
  (!filter.savedWords || filter.savedWords.has(entry.word))

export function selectStudyEntries(
  entries: LearningEntry[],
  size: number,
  filter: StudyGameFilter,
  random: () => number = Math.random,
) {
  const filtered = entries.filter((entry) => eligible(entry, filter))
  return shuffle(filtered, random).slice(0, Math.min(size, filtered.length))
}

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
