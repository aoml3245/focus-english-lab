import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { LearningEntry } from '../src/learning'

const vocabulary = JSON.parse(readFileSync(resolve(process.cwd(), 'public/vocabulary.json'), 'utf8')) as LearningEntry[]

describe('29,976-entry vocabulary artifact', () => {
  it('has the exact target, unique normalized headwords, and complete learner fields', () => {
    expect(vocabulary).toHaveLength(29_976)
    expect(new Set(vocabulary.map((entry) => entry.word)).size).toBe(29_976)
    for (const entry of vocabulary) {
      expect(entry.word).toMatch(/^[a-z][a-z-]{1,29}$/)
      expect(entry.meaningKo.trim()).not.toBe('')
      expect(entry.meaningEn.trim()).not.toBe('')
      expect(entry.example.trim()).not.toBe('')
      expect(entry.translation.trim()).not.toBe('')
      expect(entry.topics.length).toBeGreaterThan(0)
      expect(entry.synonyms.length).toBeLessThanOrEqual(3)
      expect(['noun', 'verb', 'adjective', 'adverb']).toContain(entry.partOfSpeech)
      expect(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).toContain(entry.cefr)
    }
  })

  it('preserves problem-derived vocabulary and adds ranked dictionary entries', () => {
    const words = new Map(vocabulary.map((entry) => [entry.word, entry]))
    for (const word of ['arbitrary', 'capacity', 'evidence', 'fluctuate', 'persist']) {
      expect(words.get(word)?.source).toBe('corpus')
      expect(words.get(word)?.frequency).toBeGreaterThan(0)
    }
    const added = vocabulary.filter((entry) => entry.source === 'dictionary')
    expect(added).toHaveLength(27_980)
    expect(added.every((entry) => Number.isInteger(entry.frequencyRank) && (entry.frequencyRank ?? 0) > 0)).toBe(true)
  })
})
