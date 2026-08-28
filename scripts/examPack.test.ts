import { describe, expect, it } from 'vitest'
import { buildTaskPracticeFrom, createExamPack, EXAM_PACK_FORMAT, getPracticeTaskTypesFrom, parseExamPack } from '../src/examPack'
import { QUESTION_BANK } from '../src/bank'
import type { BaseItem } from '../src/types'

const item: BaseItem = {
  id: 'portable-1', section: 'listening', module: 1, kind: 'listen-choice', title: 'Listen to a Conversation',
  instruction: 'Listen and answer.', audioText: 'Student: Hello. Advisor: Welcome.', prompt: 'What happened?',
  options: ['A greeting', 'A lecture'], answer: 0, timeSeconds: 60, topic: 'Campus', difficulty: 'B2',
}

describe('portable exam packs', () => {
  it('round-trips a valid pack', () => {
    const pack = createExamPack([item], 'Portable test')
    expect(parseExamPack(JSON.parse(JSON.stringify(pack)))).toMatchObject({ format: EXAM_PACK_FORMAT, title: 'Portable test', items: [item] })
  })

  it('rejects duplicate ids and invalid answer indexes', () => {
    expect(() => parseExamPack({ ...createExamPack([item]), items: [item, item] })).toThrow(/중복/)
    expect(() => parseExamPack(createExamPack([{ ...item, answer: 4 }]))).toThrow(/잘못된/)
  })

  it('exposes and builds every section task type independently', () => {
    const expected = { reading: 3, listening: 4, writing: 3, speaking: 2 } as const
    for (const [section, expectedCount] of Object.entries(expected)) {
      const tasks = getPracticeTaskTypesFrom(QUESTION_BANK, section as BaseItem['section'])
      expect(tasks).toHaveLength(expectedCount)
      for (const task of tasks) {
        const practice = buildTaskPracticeFrom(QUESTION_BANK, section as BaseItem['section'], task.title)
        expect(practice).toHaveLength(task.setSize)
        expect(practice.every((candidate) => candidate.section === section && candidate.title === task.title)).toBe(true)
      }
    }
  })

  it('keeps excluded questions out of type-specific practice', () => {
    const title = 'Read an Academic Passage'
    const excluded = new Set(QUESTION_BANK.filter((candidate) => candidate.title === title).slice(0, 20).map((candidate) => candidate.id))
    const practice = buildTaskPracticeFrom(QUESTION_BANK, 'reading', title, excluded)
    expect(practice.length).toBeGreaterThan(0)
    expect(practice.every((candidate) => !excluded.has(candidate.id))).toBe(true)
  })
})
