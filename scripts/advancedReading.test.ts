import { describe, expect, it } from 'vitest'
import { QUESTION_BANK } from '../src/bank'

const generatedReading = QUESTION_BANK.filter((item) => /^f(?:2[3-9]|30)-/.test(item.id) && item.section === 'reading')
const wordCount = (text = '') => text.trim().split(/\s+/).filter(Boolean).length

describe('authored reading for forms 23–30', () => {
  it('keeps the corrected plankton and language-prediction questions single-answer', () => {
    const plankton = generatedReading.find((item) => item.id === 'f23-academic-2-1')!
    expect(plankton.prompt).toBe('Why is one net sample insufficient?')
    expect(plankton.options![plankton.answer as number]).toBe('It cannot show the change in depth across the daily cycle.')
    expect(plankton.options).not.toContain('It can measure one depth but not the timing of ascent and descent.')
    const prediction = generatedReading.find((item) => item.id === 'f24-academic-1-0')!
    expect(prediction.prompt).toBe('Why are controlled sound, word, and sentence contrasts needed?')
    expect(prediction.options![prediction.answer as number]).toBe('A surprise response alone cannot locate the prediction error at one linguistic level.')
    expect(prediction.options).not.toContain('Whether responses differ between expected and unexpected input.')
  })

  it('separates oxygen consumption from ventilation and useful work from conserved energy', () => {
    const oxygen = generatedReading.find((item) => item.id === 'f28-academic-3-0')!
    expect(oxygen.passage).toContain('stratification limits replenishment and respiration consumes oxygen')
    const exergy = generatedReading.find((item) => item.id === 'f26-academic-2-0')!
    expect(exergy.passage).toContain('reduce the capacity to produce useful work relative to a reference environment')
    expect(exergy.passage).not.toContain('consume the portion of energy')
  })
  it('preserves all 184 original IDs and the 3/10/10 reading structure per form', () => {
    expect(generatedReading).toHaveLength(184)
    for (let form = 23; form <= 30; form += 1) {
      const items = generatedReading.filter((item) => item.id.startsWith(`f${form}-`))
      expect(items).toHaveLength(23)
      expect(items.filter((item) => item.kind === 'complete-words').map((item) => item.id)).toEqual([0, 1, 2].map((index) => `f${form}-cloze-${index}`))
      expect(items.filter((item) => item.title === 'Read in Daily Life').map((item) => item.id)).toEqual(Array.from({ length: 10 }, (_, index) => `f${form}-daily-${index}`))
      expect(items.filter((item) => item.title === 'Read an Academic Passage').map((item) => item.id)).toEqual([3, 2, 3, 2].flatMap((count, group) => Array.from({ length: count }, (_, index) => `f${form}-academic-${group}-${index}`)))
      expect(items.filter((item) => item.module === 1)).toHaveLength(11)
      expect(items.filter((item) => item.module === 2)).toHaveLength(12)
    }
  })

  it('uses a complete first cloze sentence and ten suffix answers', () => {
    for (const item of generatedReading.filter((candidate) => candidate.kind === 'complete-words')) {
      expect(item.passage?.slice(0, item.passage.indexOf('.'))).not.toContain('___')
      expect(item.passage?.split('___')).toHaveLength(11)
      expect(String(item.answer).split('|')).toHaveLength(10)
    }
  })

  it('keeps practical and academic stimuli long enough and gives four distinct options', () => {
    const tooShort = generatedReading.filter((item) => item.title === 'Read in Daily Life' && wordCount(item.passage) < 15).map((item) => item.id)
    expect(tooShort).toEqual([])
    for (const item of generatedReading.filter((candidate) => candidate.kind === 'multiple-choice')) {
      expect(item.options).toHaveLength(4)
      expect(new Set(item.options)).toHaveProperty('size', 4)
      expect(typeof item.answer).toBe('number')
      expect(item.explanation?.length).toBeGreaterThan(15)
    }
  })

  it('avoids repeated prompts, choices, and long stimulus sentences within the revised reading set', () => {
    const normalize = (text = '') => text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
    const objective = generatedReading.filter((item) => item.kind === 'multiple-choice')
    const prompts = objective.map((item) => normalize(item.prompt))
    const choices = objective.flatMap((item) => item.options || []).map(normalize)
    expect(new Set(prompts).size).toBe(prompts.length)
    expect(new Set(choices).size).toBe(choices.length)
    const representatives = new Map<string, string>()
    for (const item of generatedReading) {
      const group = item.stimulusGroupId || item.id
      if (!representatives.has(group)) representatives.set(group, item.passage || '')
    }
    const sentences = [...representatives.values()].flatMap((text) => text.split(/(?<=[.!?])\s+/).map(normalize).filter((sentence) => wordCount(sentence) >= 5))
    expect(new Set(sentences).size).toBe(sentences.length)
  })
})
