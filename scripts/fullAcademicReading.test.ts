import { describe, expect, it } from 'vitest'
import { fullAcademicReading } from '../src/fullAcademicReading'

const anchors: [string, string, string, string, string][] = [
  ['tap periods', 'nearly empty', 'both changes began', 'allocated', 'bill had fallen'],
  ['repair marks', 'different kind of tree', 'not as a record', 'add context', 'visitors spent more time'],
  ['city lights', 'Safety lights', 'fog could influence', 'not conclusive', 'repeat the counts'],
  ['modern additions', 'photographed each piece', 'older glue', 'Reversible means', 'light fill remained'],
  ['deliver books', 'paper request form', 'in transit', 'expanding the route', 'school reading project'],
  ['wooden walkway', 'low paths', 'unplanted for comparison', 'wind deposits', 'one season of measurements'],
  ['temperature sensors', 'beneath awnings', 'sidewalk width', 'distinct outcomes', 'awnings'],
  ['own grammar', 'watched only the hands', 'different viewpoint', 'fluent', 'local Deaf adults'],
  ['bread dough', 'same flour', 'compare the holes', 'more consistent', 'humid day'],
  ['tidal wetland', 'simple markers', 'entered from the harbor', 'declined', 'continued plant growth'],
  ['surface cooling', 'new insulation', 'strong sunlight', 'provisional', 'maintenance cost'],
  ['irrigation system', 'crossed and cut', 'abandoned before another', 'undisturbed ground', 'Plant remains'],
  ['continuous path', 'test tag', 'side channel', 'coverage remained', 'absence from the records'],
  ['later start', 'fell in both groups', 'self-reported sleep', 'punctuality', 'coursework'],
  ['warm-water event', 'larger grazers out', 'partial cages', 'urchins were abundant', 'two stresses'],
  ['linguistic failure', 'same photograph', 'did not remove', 'simple tally', 'originally counted'],
  ['levee', 'less new sediment', 'upstream trend', 'suspended material', 'controlled openings'],
  ['calibration guide', 'time zone', 'surprising report', 'calibration', 'reports had to be excluded'],
  ['pollen', 'immediately beside', 'fruit set', 'dominated', 'not identical'],
  ['searchable text', 'column edges', 'had not edited', 'retrieval', 'imperfect guide'],
  ['limited scope', 'became smaller', 'narrow range', 'imprecise', 'separated its findings'],
  ['cellular context', 'RNA declined', 'neighboring genes', 'abolishing', 'on-off switch'],
  ['local disturbance', 'both cores', 'local storm', 'correspondence', 'smaller lake'],
  ['throughput and delay', 'recovered slowly', 'queues delayed', 'test replay', 'react to one another'],
  ['not recovered', 'construction area', 'waterlogged site', 'decisively', 'question of detection'],
  ['conversational setting', 'short vowel', 'similar schooling', 'retained the cluster', 'Age was therefore associated'],
  ['combined explanation', 'earlier in the exposed', 'different loads', 'substantial', 'recommended both'],
  ['gravitational', 'recorded clock corrections', 'range of models', 'pattern persisted', 'timing from brightness'],
  ['testable chain', 'Browsing marks declined', 'Adjusting for those', 'predators might have favored', 'comparison valley'],
  ['not a random', 'directory described', 'not survived', 'Complaints clustered', 'percentage of all residents'],
]

describe('full-length authored academic reading', () => {
  it('contains 30 distinct 180–220-word passages and five questions per group', () => {
    expect(fullAcademicReading).toHaveLength(150)
    expect(new Set(fullAcademicReading.map((item) => item.id)).size).toBe(150)
    expect(anchors).toHaveLength(30)
    for (let group = 0; group < 30; group += 1) {
      const id = `full-academic-${String(group + 1).padStart(2, '0')}`
      const items = fullAcademicReading.filter((item) => item.stimulusGroupId === id)
      expect(items.map((item) => item.id)).toEqual(Array.from({ length: 5 }, (_, index) => `${id}-${index}`))
      expect(items.map((item) => item.sequenceIndex)).toEqual([0, 1, 2, 3, 4])
      const wordCount = items[0].passage!.trim().split(/\s+/).length
      expect(wordCount, id).toBeGreaterThanOrEqual(180)
      expect(wordCount, id).toBeLessThanOrEqual(220)
      expect(items.every((item) => item.passage === items[0].passage)).toBe(true)
      expect(items.every((item) => item.difficulty === (group < 10 ? 'B1' : group < 20 ? 'B2' : 'C1'))).toBe(true)
      expect(items.every((item) => item.sourceFamily === 'authored-full-academic-reading')).toBe(true)
    }
  })

  it('retains a passage evidence anchor for each of the 150 answers and a contextual vocabulary target', () => {
    const missing: string[] = []
    for (let group = 0; group < 30; group += 1) {
      const items = fullAcademicReading.slice(group * 5, group * 5 + 5)
      for (let question = 0; question < 5; question += 1) {
        if (!items[question].passage!.toLowerCase().includes(anchors[group][question].toLowerCase())) missing.push(`${items[question].id}: ${anchors[group][question]}`)
      }
      const target = items[3].prompt!.match(/“([^”]+)”/)?.[1]
      expect(target, items[3].id).toBeTruthy()
      expect(items[3].passage!.toLowerCase(), items[3].id).toContain(target!.toLowerCase())
    }
    expect(missing).toEqual([])
  })

  it('provides one keyed choice and a Korean reason for all four options', () => {
    const distribution = [0, 0, 0, 0]
    const normalizedPrompts = fullAcademicReading.map((item) => item.prompt!.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim())
    const duplicatePrompts = normalizedPrompts.flatMap((prompt, index) => normalizedPrompts.indexOf(prompt) === index ? [] : [`${fullAcademicReading[index].id}: ${prompt}`])
    expect(duplicatePrompts).toEqual([])
    for (const item of fullAcademicReading) {
      expect(item.options).toHaveLength(4)
      expect(new Set(item.options).size, item.id).toBe(4)
      const answer = item.answer as number
      expect(answer).toBeGreaterThanOrEqual(0)
      expect(answer).toBeLessThan(4)
      distribution[answer] += 1
      const reasons = item.explanation!.split(/(?=[ABCD]: )/).filter(Boolean)
      expect(reasons, item.id).toHaveLength(4)
      expect(reasons.every((reason) => /[가-힣]/.test(reason)), item.id).toBe(true)
    }
    expect(distribution).toEqual([38, 38, 37, 37])
  })

  it('does not repeat choices or copy the full correct option from a passage', () => {
    const normalize = (text = '') => text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
    const allChoices = fullAcademicReading.flatMap((item) => item.options!).map(normalize)
    const repeatedChoices = allChoices.flatMap((choice, index) => allChoices.indexOf(choice) === index ? [] : [choice])
    expect(repeatedChoices).toEqual([])
    const copied = fullAcademicReading.filter((item) => normalize(item.passage).includes(normalize(item.options![item.answer as number]))).map((item) => item.id)
    expect(copied).toEqual([])
  })
})
