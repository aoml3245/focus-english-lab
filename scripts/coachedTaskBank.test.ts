import { describe, expect, it } from 'vitest'
import { coachedTaskBank } from '../src/coachedTaskBank'

const countWords = (text = '') => text.trim().split(/\s+/).filter(Boolean).length
const groupItems = (kind: 'repeat' | 'interview') => {
  const groups = new Map<string, typeof coachedTaskBank>()
  for (const item of coachedTaskBank.filter((candidate) => candidate.kind === kind)) {
    const key = item.scenarioId!
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return [...groups.values()]
}

describe('new coached writing and speaking bank', () => {
  it('provides 30 emails, 30 discussions, 20 seven-sentence repeat sets and 20 four-question interviews', () => {
    expect(coachedTaskBank).toHaveLength(280)
    expect(coachedTaskBank.filter((item) => item.kind === 'email')).toHaveLength(30)
    expect(coachedTaskBank.filter((item) => item.kind === 'discussion')).toHaveLength(30)
    expect(groupItems('repeat')).toHaveLength(20)
    expect(groupItems('interview')).toHaveLength(20)
    for (const group of groupItems('repeat')) expect(group.map((item) => item.sequenceIndex)).toEqual([0, 1, 2, 3, 4, 5, 6])
    for (const group of groupItems('interview')) expect(group.map((item) => item.sequenceIndex)).toEqual([0, 1, 2, 3])
    expect(new Set(coachedTaskBank.map((item) => item.id)).size).toBe(280)
  })

  it('gives every new task a reusable response, actionable checklist and revision guidance', () => {
    for (const item of coachedTaskBank) {
      expect(item.sourceFamily, item.id).toBe('authored-coached-2026')
      expect(item.modelResponse, item.id).toBeTruthy()
      expect(item.taskChecklist?.length, item.id).toBeGreaterThanOrEqual(3)
      expect(item.commonMistakes?.length, item.id).toBeGreaterThanOrEqual(2)
      expect(item.rewriteGuidance?.length, item.id).toBeGreaterThanOrEqual(3)
      expect(item.targetSkills?.length, item.id).toBeGreaterThanOrEqual(3)
      expect(item.explanation, item.id).toMatch(/[가-힣]/)
      for (const text of [...item.taskChecklist!, ...item.commonMistakes!, ...item.rewriteGuidance!]) {
        expect(text, item.id).toMatch(/[가-힣]/)
      }
    }
  })

  it('keeps writing responses substantial and separates email form from discussion form', () => {
    for (const item of coachedTaskBank.filter((candidate) => candidate.section === 'writing')) {
      expect(countWords(item.modelResponse), item.id).toBeGreaterThanOrEqual(100)
      expect(countWords(item.modelResponse), item.id).toBeLessThanOrEqual(190)
      expect(item.prompt, item.id).toBeTruthy()
      if (item.kind === 'email') expect(item.modelResponse, item.id).toMatch(/^(Dear|Hi) /)
      else {
        expect(item.passage, item.id).toMatch(/\n/)
        expect(item.modelResponse, item.id).not.toMatch(/^(Dear|Hi) /)
      }
    }
  })

  it('uses a coherent speaking scenario with short beginnings and longer repeat endings', () => {
    for (const group of groupItems('repeat')) {
      const counts = group.map((item) => countWords(item.audioText))
      expect(counts[0], group[0].scenarioId).toBeLessThanOrEqual(12)
      expect(counts[6], group[0].scenarioId).toBeGreaterThanOrEqual(20)
      expect(counts[6], group[0].scenarioId).toBeGreaterThan(counts[0] * 2)
      expect(new Set(group.map((item) => item.context)).size).toBe(1)
      for (const item of group) {
        expect(item.modelResponse).toBe(item.audioText)
        expect(item.responseTimeSeconds).toBeGreaterThanOrEqual(12)
        expect(item.instruction).toContain('그대로')
      }
    }
  })

  it('preserves independently reviewed attachment, food-preparation and fixed-budget boundaries', () => {
    const email03 = coachedTaskBank.find((item) => item.id === 'coached-email-03')!
    expect(email03.taskChecklist?.join(' ')).not.toContain('25명')
    const email10 = coachedTaskBank.find((item) => item.id === 'coached-email-10')!
    expect(email10.modelResponse).not.toMatch(/I have attached/)
    expect(email10.modelResponse).toContain('I can send the outline')
    const email12 = coachedTaskBank.find((item) => item.id === 'coached-email-12')!
    expect(email12.commonMistakes?.join(' ')).not.toContain('증식')
    const discussion02 = coachedTaskBank.find((item) => item.id === 'coached-discussion-02')!
    expect(discussion02.modelResponse).toContain('without diverting this budget')
  })

  it('provides four distinct interview questions and original, speakable 45-second response examples', () => {
    const interview = coachedTaskBank.filter((item) => item.kind === 'interview')
    expect(new Set(interview.map((item) => item.audioText)).size).toBe(80)
    expect(new Set(interview.map((item) => item.modelResponse)).size).toBe(80)
    for (const group of groupItems('interview')) {
      expect(new Set(group.map((item) => item.context)).size).toBe(1)
      expect(group[3].audioText).toMatch(/\b(If|Imagine|Suppose)\b/)
      for (const item of group) {
        expect(item.responseTimeSeconds).toBe(45)
        expect(countWords(item.modelResponse), item.id).toBeGreaterThanOrEqual(80)
        expect(countWords(item.modelResponse), item.id).toBeLessThanOrEqual(130)
        expect(item.modelResponse).not.toBe(item.audioText)
        expect(item.rewriteGuidance?.[0]).toContain('경험이 없다면')
      }
    }
  })
})
