import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildFullPracticeSet, buildSectionPractice, QUESTION_BANK } from '../src/bank'

describe('vocabulary corpus export', () => {
  it('exports every user-visible English text field', () => {
    const destination = resolve(process.cwd(), 'work/vocabulary/corpus.json')
    mkdirSync(resolve(process.cwd(), 'work/vocabulary'), { recursive: true })
    const corpus = QUESTION_BANK.map((item) => ({
      id: item.id,
      topic: item.topic,
      context: item.context,
      texts: [item.passage, item.audioText, item.prompt, item.instruction, item.explanation, item.starter, ...(item.options || []), ...(item.words || [])].filter(Boolean),
    }))
    writeFileSync(destination, JSON.stringify(corpus, null, 2))
    expect(corpus).toHaveLength(1000)

    const generatedAcademicReadings = QUESTION_BANK.filter((item) => /^x-\d+-r1$/.test(item.id))
    expect(generatedAcademicReadings).toHaveLength(53)
    expect(generatedAcademicReadings.every((item) => /preliminary|qualifies|subsequent|persist/i.test(item.prompt || ''))).toBe(true)

    const exportedText = corpus.flatMap((item) => item.texts).join(' ').toLowerCase()
    for (const etsExample of ['arbitrary', 'capacity', 'fluctuated', 'relatively']) {
      expect(exportedText).toContain(etsExample)
    }
  })

  it('keeps excluded history items out of new random sets', () => {
    const excluded = new Set(QUESTION_BANK.slice(0, 120).map((item) => item.id))
    const full = buildFullPracticeSet(excluded)
    const reading = buildSectionPractice('reading', excluded)
    expect(full).not.toHaveLength(0)
    expect(reading).not.toHaveLength(0)
    expect([...full, ...reading].every((item) => !excluded.has(item.id))).toBe(true)
  })

  it('uses ETS-style shuffled short tiles for every Build a Sentence item', () => {
    const sentenceItems = QUESTION_BANK.filter((item) => item.kind === 'sentence-build')
    expect(sentenceItems).toHaveLength(73)
    for (const item of sentenceItems) {
      const correct = String(item.answer).split('|')
      expect(correct.length).toBeGreaterThanOrEqual(5)
      expect(correct.length).toBeLessThanOrEqual(8)
      expect(item.words?.length).toBeGreaterThanOrEqual(correct.length)
      expect(item.words?.length).toBeLessThanOrEqual(correct.length + 1)
      expect(item.words?.every((tile) => tile.trim().split(/\s+/).length <= 3)).toBe(true)
      expect(item.words?.join('|')).not.toBe(item.answer)
      expect(correct.every((tile) => item.words?.includes(tile))).toBe(true)
    }
  })
})
