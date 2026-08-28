import { describe, expect, it } from 'vitest'
import type { LearningEntry } from '../src/learning'
import { buildStudyQuestions, isObjectiveAnswerCorrect } from '../src/studyGamesEngine'

const entry = (word: string, extra: Partial<LearningEntry> = {}): LearningEntry => ({
  word, meaningKo: `${word} 뜻`, meaningEn: `${word} definition`, partOfSpeech: 'noun', cefr: 'B2', ipa: '', synonyms: [`${word}-similar`],
  example: `The ${word} changed the result.`, translation: `${word}가 결과를 바꾸었다.`, frequency: 2, topics: ['과학'], academicCore: true, source: 'corpus', ...extra,
})
const entries = [entry('alpha'), entry('beta'), entry('gamma'), entry('delta'), entry('epsilon'), entry('zeta')]

describe('study game question generation', () => {
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
})
