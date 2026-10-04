import { describe, expect, it } from 'vitest'
import { AUTHORED_FORMS } from '../src/bank'

const forms = AUTHORED_FORMS.slice(22, 30)
const listening = forms.flatMap((form) => form.filter((item) => item.section === 'listening'))
const normalize = (text = '') => text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

describe('revised advanced listening content regressions', () => {
  it('preserves all 376 original IDs, group IDs and two-module counts', () => {
    expect(listening).toHaveLength(376)
    for (const [index, form] of forms.entries()) {
      const f = index + 23
      const actual = form.filter((item) => item.section === 'listening')
      const expected = [
        ...Array.from({ length: 17 }, (_, i) => `f${f}-response-${i}`),
        ...Array.from({ length: 5 }, (_, i) => [0, 1].map((q) => `f${f}-conversation-${i}-${q}`)).flat(),
        ...Array.from({ length: 4 }, (_, i) => [0, 1].map((q) => `f${f}-announcement-${i}-${q}`)).flat(),
        ...Array.from({ length: 6 }, (_, i) => [0, 1].map((q) => `f${f}-talk-${i}-${q}`)).flat(),
      ]
      expect(actual.map((item) => item.id).sort()).toEqual(expected.sort())
      expect(actual.filter((item) => item.module === 1)).toHaveLength(24)
      expect(actual.filter((item) => item.module === 2)).toHaveLength(23)
      for (const item of actual.filter((item) => item.title !== 'Listen and Choose a Response')) {
        expect(item.stimulusGroupId).toBe(item.id.slice(0, -2))
        expect(item.sequenceIndex).toBe(Number(item.id.at(-1)))
      }
    }
  })

  it('keeps 136 unique short campus utterances within B1/B2 length', () => {
    const responses = listening.filter((item) => item.title === 'Listen and Choose a Response')
    expect(responses).toHaveLength(136)
    expect(new Set(responses.map((item) => normalize(item.audioText))).size).toBe(136)
    for (const item of responses) {
      expect(item.audioText!.trim().split(/\s+/).length).toBeLessThanOrEqual(12)
      expect(['B1', 'B2']).toContain(item.difficulty)
      expect(item.audioText).not.toMatch(/confounder|monetary transmission|sensor inspected|precise .* location/i)
    }
  })

  it('gives each actual question four distinct grammatical choices and a bounded key', () => {
    for (const item of listening) {
      expect(item.options).toHaveLength(4)
      expect(new Set(item.options!.map(normalize)).size).toBe(4)
      expect(typeof item.answer).toBe('number')
      expect(item.answer as number).toBeGreaterThanOrEqual(0)
      expect(item.answer as number).toBeLessThan(4)
      expect(item.explanation?.length).toBeGreaterThan(30)
      expect(item.options!.join(' ')).not.toMatch(/settles (does|will|central|limitation)|judging (does|will|central|limitation)|answer (does|will|central|limitation)|Contextual variation is irrelevant|The broadest causal claim/i)
    }
  })

  it('does not silently presume an unmentioned shared log', () => {
    const announcements = listening.filter((item) => item.title === 'Listen to an Announcement')
    expect(announcements).toHaveLength(64)
    for (const item of announcements.filter((item) => /logged|shared log/i.test(item.prompt || ''))) {
      expect(item.audioText).toMatch(/shared log/i)
      expect(item.audioText).toMatch(/approved change|approved/i)
    }
    const item = listening.find((candidate) => candidate.id === 'f29-announcement-0-1')!
    expect(item.prompt).toMatch(/Who must follow/)
    expect(item.options![item.answer as number]).toContain('earlier bookings')
  })

  it('grounds repaired domain checks in the actual transcript rather than generic inference', () => {
    const ids = ['f23-conversation-0-1', 'f26-conversation-0-1', 'f28-talk-1-1', 'f29-talk-0-1']
    for (const id of ids) {
      const item = listening.find((candidate) => candidate.id === id)!
      expect(item.audioText).toContain(item.options![item.answer as number])
    }
    const additionality = listening.find((item) => item.id === 'f28-talk-1-1')!
    expect(additionality.audioText).not.toMatch(/laboratory demonstration|realistic loads|repeated use/)
    expect(additionality.audioText).toContain('without the project')
    const approximation = listening.find((item) => item.id === 'f29-talk-0-1')!
    expect(approximation.audioText).not.toMatch(/material recovered|preservation process|surviving record/)
    expect(approximation.audioText).toContain('mathematical bound')
  })

  it('preserves the order and explicit dates in drainage and sediment notices', () => {
    const drainage = listening.find((item) => item.id === 'f25-announcement-1-0')!
    expect(drainage.options![drainage.answer as number]).toBe('Remove tagged organisms before draining and screen the outflow during drainage.')
    expect(drainage.audioText).toMatch(/first|before/i)
    const sediment = listening.find((item) => item.id === 'f23-announcement-2-0')!
    expect(sediment.options![sediment.answer as number]).toBe('Keep incoming cores in intake and delay permanent shelf assignment until Monday.')
    expect(sediment.audioText).toContain('until Monday')
  })
})
