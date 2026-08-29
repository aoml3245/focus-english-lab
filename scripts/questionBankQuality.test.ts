import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTEXT_TOPIC_COUNT, QUESTION_BANK } from '../src/bank'
import { NEW_TOPIC_COUNT, NEW_TOPIC_ITEMS } from '../src/newTopicBank'

const words = (text = '') => text.trim().split(/\s+/).filter(Boolean).length
const vocabularyPath = resolve(process.cwd(), 'private/vocabulary.json')
const testPrivateVocabulary = existsSync(vocabularyPath) ? it : it.skip

describe('ETS-calibrated new topic bank', () => {
  it('adds 20 topics and 360 original items without duplicate ids', () => {
    expect(NEW_TOPIC_COUNT).toBe(20)
    expect(NEW_TOPIC_ITEMS).toHaveLength(360)
    expect(QUESTION_BANK).toHaveLength(1360)
    expect(CONTEXT_TOPIC_COUNT).toBe(83)
    expect(new Set(QUESTION_BANK.map((item) => item.id)).size).toBe(QUESTION_BANK.length)

    const counts = new Map<string, number>()
    for (const item of NEW_TOPIC_ITEMS) counts.set(item.topic!, (counts.get(item.topic!) || 0) + 1)
    expect(counts.size).toBe(20)
    expect([...counts.values()].every((count) => count === 18)).toBe(true)
  })

  it('keeps official-style stimulus lengths and cloze structure', () => {
    const cloze = NEW_TOPIC_ITEMS.filter((item) => item.kind === 'complete-words')
    expect(cloze).toHaveLength(20)
    for (const item of cloze) {
      expect(item.passage?.split('___')).toHaveLength(11)
      expect(String(item.answer).split('|')).toHaveLength(10)
      expect(item.passage?.slice(0, item.passage.indexOf('.'))).not.toContain('___')
    }

    for (const item of NEW_TOPIC_ITEMS.filter((candidate) => candidate.title === 'Read an Academic Passage')) {
      expect(words(item.passage)).toBeGreaterThanOrEqual(70)
      expect(words(item.passage)).toBeLessThanOrEqual(200)
    }
    for (const item of NEW_TOPIC_ITEMS.filter((candidate) => candidate.title === 'Read in Daily Life')) {
      expect(words(item.passage)).toBeGreaterThanOrEqual(15)
      expect(words(item.passage)).toBeLessThanOrEqual(60)
    }
    for (const item of NEW_TOPIC_ITEMS.filter((candidate) => candidate.title === 'Listen to an Academic Talk')) {
      expect(words(item.audioText)).toBeGreaterThanOrEqual(35)
      expect(words(item.audioText)).toBeLessThanOrEqual(250)
    }
  })

  it('does not force advanced difficulty onto simple task types', () => {
    const shortResponses = NEW_TOPIC_ITEMS.filter((item) => item.title === 'Listen and Choose a Response')
    expect(shortResponses).toHaveLength(20)
    expect(shortResponses.every((item) => item.difficulty === 'B1' && words(item.audioText) <= 10)).toBe(true)

    const practicalTasks = NEW_TOPIC_ITEMS.filter((item) => item.title === 'Read in Daily Life' || item.title === 'Write an Email')
    expect(practicalTasks.every((item) => item.difficulty === 'B1' || item.difficulty === 'B2')).toBe(true)

    const shortRepeats = NEW_TOPIC_ITEMS.filter((item) => item.id.endsWith('-s0'))
    expect(shortRepeats.every((item) => item.difficulty === 'B1' && words(item.audioText) <= 12)).toBe(true)
  })

  testPrivateVocabulary('uses private vocabulary and distributes objective answers', () => {
    const vocabulary = JSON.parse(readFileSync(vocabularyPath, 'utf8')) as Array<{ word: string }>
    const available = new Set(vocabulary.map((entry) => entry.word.toLowerCase()))
    const focusWords = ['orientation', 'symbiosis', 'precursor', 'permeable', 'layered', 'attenuate', 'salient', 'retrieval', 'simultaneous', 'legibility', 'topology', 'authentication', 'autonomous', 'additive', 'emulate', 'geothermal', 'membrane', 'runoff', 'incentive', 'aggregate']
    expect(focusWords.every((word) => available.has(word))).toBe(true)

    const distribution = [0, 0, 0, 0]
    for (const item of NEW_TOPIC_ITEMS) if (typeof item.answer === 'number') distribution[item.answer] += 1
    expect(Math.max(...distribution) - Math.min(...distribution)).toBeLessThanOrEqual(2)
  })
})
