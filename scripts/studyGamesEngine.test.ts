import { describe, expect, it } from 'vitest'
import type { LearningEntry } from '../src/learning'
import { advanceMasteryProgress, buildMasteryOptions, buildStudyQuestions, createMasteryProgress, isObjectiveAnswerCorrect, maskMasterySentence, masteryMinimumAttempts, MASTERY_STAGES, selectStudyEntries } from '../src/studyGamesEngine'

const entry = (word: string, extra: Partial<LearningEntry> = {}): LearningEntry => ({
  word, meaningKo: `${word} 뜻`, meaningEn: `${word} definition`, partOfSpeech: 'noun', cefr: 'B2', ipa: '', synonyms: [`${word}-similar`],
  example: `The ${word} changed the result.`, translation: `${word}가 결과를 바꾸었다.`, frequency: 2, topics: ['과학'], academicCore: true, source: 'corpus', ...extra,
})
const entries = [entry('alpha'), entry('beta'), entry('gamma'), entry('delta'), entry('epsilon'), entry('zeta')]

describe('study game question generation', () => {
  it('selects a filtered memorization cohort before the quiz', () => {
    const cohort = selectStudyEntries(entries, 3, { level: 'B2', academicOnly: true }, () => 0.42)
    expect(cohort).toHaveLength(3)
    expect(cohort.every((item) => item.cefr === 'B2' && item.academicCore)).toBe(true)
    expect(new Set(cohort.map((item) => item.word)).size).toBe(3)
  })

  it('mixes recall, synonym, and spelling tasks without duplicate words', () => {
    const questions = buildStudyQuestions(entries, 'vocabulary', 6, { level: 'B2', academicOnly: true }, () => 0.42)
    expect(questions).toHaveLength(6)
    expect(new Set(questions.map((question) => question.entry.word)).size).toBe(6)
    expect(new Set(questions.map((question) => question.task))).toEqual(new Set(['meaning', 'synonym', 'spelling']))
    expect(questions.find((question) => question.task === 'synonym')?.options).toHaveLength(4)
  })

  it('uses only corpus sentences and alternates translation directions', () => {
    const questions = buildStudyQuestions([...entries, entry('dictionary-only', { source: 'dictionary' })], 'sentence', 6, { level: 'All', academicOnly: false }, () => 0.3)
    expect(questions).toHaveLength(6)
    expect(questions.every((question) => question.entry.source === 'corpus')).toBe(true)
    expect(questions.map((question) => question.task)).toEqual(['translation', 'composition', 'translation', 'composition', 'translation', 'composition'])
  })

  it('grades only objective spelling and synonym responses automatically', () => {
    const spelling = buildStudyQuestions(entries, 'vocabulary', 3, { level: 'B2', academicOnly: true }, () => 0.5)[2]
    expect(spelling.task).toBe('spelling')
    expect(isObjectiveAnswerCorrect(spelling, `  ${spelling.answer.toUpperCase()} `)).toBe(true)
    expect(isObjectiveAnswerCorrect({ ...spelling, task: 'meaning' }, spelling.answer)).toBeNull()
  })

  it('keeps only missed words until the current mastery cycle reaches zero', () => {
    const initial = createMasteryProgress(entries.slice(0, 3), () => 0.9)
    const first = advanceMasteryProgress(initial, false, entries.slice(0, 3).map((item) => item.word), () => 0.9).progress
    const second = advanceMasteryProgress(first, true, entries.slice(0, 3).map((item) => item.word), () => 0.9).progress
    const retry = advanceMasteryProgress(second, true, entries.slice(0, 3).map((item) => item.word), () => 0.9)
    expect(retry.progress.queue).toHaveLength(1)
    expect(retry.progress.retryRound).toBe(2)
    const cleared = advanceMasteryProgress(retry.progress, true, entries.slice(0, 3).map((item) => item.word), () => 0.9)
    expect(cleared.progress.cycle).toBe(2)
    expect(cleared.progress.queue).toHaveLength(3)
  })

  it('advances through every mastery stage and completes after the minimum 11 recalls per word', () => {
    const cohort = entries.slice(0, 2)
    let progress = createMasteryProgress(cohort, () => 0.5)
    while (!progress.complete) progress = advanceMasteryProgress(progress, true, cohort.map((item) => item.word), () => 0.5).progress
    expect(progress.stageIndex).toBe(MASTERY_STAGES.length - 1)
    expect(progress.totalAttempts).toBe(masteryMinimumAttempts(cohort.length))
    expect(masteryMinimumAttempts(100)).toBe(1100)
  })

  it('builds cloze and synonym choices from the cohort', () => {
    const cloze = buildMasteryOptions(entries[0], entries, 'cloze-choice', () => 0.4)
    const synonym = buildMasteryOptions(entries[0], entries, 'synonym-choice', () => 0.4)
    expect(cloze.options).toContain(entries[0].word)
    expect(cloze.options).toHaveLength(4)
    expect(synonym.options).toContain(entries[0].synonyms[0])
    expect(maskMasterySentence(entries[0])).toContain('_____')
  })
})
