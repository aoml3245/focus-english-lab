import { describe, expect, it } from 'vitest'
import { QUESTION_BANK } from '../src/bank'
import { getAdvancedSentences } from '../src/advancedSentences'
import { isCorrect } from '../src/review'

const sentences = QUESTION_BANK.filter((item) => item.kind === 'sentence-build')
const byId = new Map(sentences.map((item) => [item.id, item]))
const complete = (id: string) => {
  const item = byId.get(id)!
  return `${item.starter} ${String(item.answer).replaceAll('|', ' ')}`
}
const sortedTiles = (answer: string) => answer.split('|').sort()

describe('sentence meaning and answer integrity', () => {
  it('retains all 300 sentence tasks and uses every supplied tile exactly once', () => {
    expect(sentences).toHaveLength(300)
    for (const item of sentences) {
      expect(sortedTiles(String(item.answer)), item.id).toEqual([...(item.words ?? [])].sort())
      expect(isCorrect(item, String(item.answer).split('|')), item.id).toBe(true)
      expect(item.prompt, item.id).toMatch(/\?$/)
      expect(item.starter, item.id).toBeTruthy()
    }
  })

  it('gives purpose and reason responses an explicit main clause', () => {
    expect(complete('f11-sentence-2')).toMatch(/^They were processed so that contamination /)
    expect(complete('f12-sentence-7')).toMatch(/^It was strengthened not by chemistry /)
    expect(complete('f15-sentence-5')).toMatch(/^The translator retained it not so much because /)
  })

  it('uses an earlier hypothetical warning state to explain an earlier missed detection', () => {
    const answer = complete('f16-sentence-6')
    expect(answer).toContain('If the warning system had been functioning as designed')
    expect(answer).toContain('would likely have been detected before morning')
    expect(answer).not.toContain('now')
  })

  it('uses ordinary word order and parallel infinitives for not so much ... as', () => {
    expect(complete('f21-sentence-6')).toBe('It did not so much recover the full treated population as create a balanced subset for which comparison was defensible')
  })

  it('accepts the checked as-easily placement while requiring the identical tiles', () => {
    const item = byId.get('f19-sentence-6')!
    const alternative = 'regional absences|could|reflect|modern research|as|easily|as ancient exchange'
    expect(item.acceptedAnswers).toContain(alternative)
    expect(sortedTiles(alternative)).toEqual(sortedTiles(String(item.answer)))
    expect(isCorrect(item, alternative.split('|'))).toBe(true)
    expect(isCorrect(item, alternative.split('|').filter((tile) => tile !== 'easily'))).toBe(false)
    expect(isCorrect(item, [...alternative.split('|'), 'easily'])).toBe(false)
    for (const sentence of sentences) {
      for (const accepted of sentence.acceptedAnswers ?? []) {
        expect(sortedTiles(accepted), sentence.id).toEqual(sortedTiles(String(sentence.answer)))
      }
    }
  })

  it('provides 80 distinct, contextual tasks rather than repeating a technical-label template', () => {
    const revised = Array.from({ length: 8 }, (_, index) => getAdvancedSentences(index + 23)).flat()
    expect(revised).toHaveLength(80)
    expect(new Set(revised.map(([prompt]) => prompt)).size).toBe(80)
    expect(new Set(revised.map(([, starter]) => starter)).size).toBe(80)
    expect(new Set(revised.map(([, , fragments]) => fragments.join('|'))).size).toBe(80)
    for (let form = 23; form <= 30; form += 1) {
      const data = getAdvancedSentences(form)
      expect(data).toHaveLength(10)
      data.forEach(([prompt, starter, fragments], index) => {
        const item = byId.get(`f${form}-sentence-${index}`)!
        expect(item.prompt).toBe(prompt)
        expect(complete(item.id)).toBe(`${starter} ${fragments.join(' ')}`)
        expect(prompt).not.toContain('What qualification belongs')
        expect(complete(item.id)).not.toMatch(/inherited measurement drift|nominal difference|chosen boundary|normalization procedure/)
      })
    }
  })

  it('keeps only from triggering inversion when it modifies a subject', () => {
    expect(complete('f26-sentence-5')).toContain('Only students who have completed the induction are permitted')
    expect(complete('f26-sentence-5')).not.toContain('are students')
  })

  it('compares new images with training images, not an appearance with images', () => {
    expect(complete('f29-sentence-1')).toContain('images that differed in appearance from those on which')
    expect(complete('f29-sentence-1')).not.toContain('whose appearance differed from those')
  })
})
