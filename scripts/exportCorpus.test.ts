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
    expect(corpus).toHaveLength(2922)
    expect(QUESTION_BANK.every((item) => item.sourceFamily?.startsWith('authored-'))).toBe(true)

    const exportedText = corpus.flatMap((item) => item.texts).join(' ').toLowerCase()
    for (const etsExample of ['mycorrhizal', 'palimpsest', 'multispectral', 'humidity-control']) {
      expect(exportedText).toContain(etsExample)
    }
  })

  it('keeps excluded history items out of new random sets', () => {
    const excluded = new Set(['w-email-0', 'w-discussion-0', 's-repeat-0-0'])
    const full = buildFullPracticeSet(excluded)
    const reading = buildSectionPractice('reading', excluded)
    expect(full).not.toHaveLength(0)
    expect(reading).not.toHaveLength(0)
    expect([...full, ...reading].every((item) => !excluded.has(item.id))).toBe(true)
  })

  it('uses unique prompts, answers, and short shuffled tiles for every Build a Sentence item', () => {
    const sentenceItems = QUESTION_BANK.filter((item) => item.kind === 'sentence-build')
    expect(sentenceItems).toHaveLength(300)
    const fullSentences = sentenceItems.map((item) => `${item.starter} ${String(item.answer).split('|').join(' ')}`.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim())
    expect(new Set(fullSentences).size).toBe(sentenceItems.length)
    expect(new Set(sentenceItems.map((item) => item.prompt?.toLowerCase())).size).toBe(sentenceItems.length)
    expect(new Set(sentenceItems.map((item) => item.starter?.toLowerCase())).size).toBe(sentenceItems.length)
    expect(new Set(sentenceItems.map((item) => item.grammarFocus)).size).toBe(sentenceItems.length)
    for (const item of sentenceItems) {
      const correct = String(item.answer).split('|')
      expect(correct.length).toBeGreaterThanOrEqual(5)
      expect(correct.length).toBeLessThanOrEqual(8)
      expect(item.words).toHaveLength(correct.length)
      expect(item.words?.every((tile) => tile.trim().split(/\s+/).length <= 3)).toBe(true)
      expect(item.words?.join('|')).not.toBe(item.answer)
      expect(correct.every((tile) => item.words?.includes(tile))).toBe(true)
      expect(item.grammarFocus).toBeTruthy()
    }
  })

  it('selects ten different grammar focuses for each Writing set', () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const sentenceItems = buildSectionPractice('writing').filter((item) => item.kind === 'sentence-build')
      expect(sentenceItems).toHaveLength(10)
      expect(new Set(sentenceItems.map((item) => item.grammarFocus)).size).toBe(10)
    }
  })
})
