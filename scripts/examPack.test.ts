import { describe, expect, it } from 'vitest'
import { createExamPack, EXAM_PACK_FORMAT, parseExamPack } from '../src/examPack'
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
})
