import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AUTHORED_FORMS, CONTEXT_TOPIC_COUNT, countReadingScoredItems, QUESTION_BANK } from '../src/bank'
import { buildFullPracticeSetFrom, buildReadingPracticeSetFrom } from '../src/examPack'

const words = (text = '') => text.trim().split(/\s+/).filter(Boolean).length
const normalize = (text = '') => text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const contentWords = (text = '') => {
  const stopWords = new Set('a an the is are was were be been being to of and or but in on at for from with by as that this these those it its they their them will would should could can may might do does did have has had not no than then into through about after before when while because so every all only'.split(' '))
  return normalize(text).split(' ').filter((word) => word && !stopWords.has(word))
}
const passageCoverage = (option = '', passage = '') => {
  const passageWords = new Set(contentWords(passage))
  const optionWords = contentWords(option)
  return optionWords.length ? optionWords.filter((word) => passageWords.has(word)).length / optionWords.length : 0
}
const vocabularyPath = resolve(process.cwd(), 'private/vocabulary.json')
const testPrivateVocabulary = existsSync(vocabularyPath) ? it : it.skip
const repeated = (values: string[]) => {
  const counts = new Map<string, number>()
  for (const value of values.map(normalize).filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1)
  return [...counts.entries()].filter(([, count]) => count > 1)
}
const fourGrams = (value = '') => {
  const tokens = normalize(value).split(' ').filter(Boolean)
  return new Set(tokens.slice(0, -3).map((_, index) => tokens.slice(index, index + 4).join(' ')))
}
const jaccard = (left: Set<string>, right: Set<string>) => {
  const intersection = [...left].filter((value) => right.has(value)).length
  const union = new Set([...left, ...right]).size
  return union ? intersection / union : 0
}

describe('directly authored TOEFL-style bank', () => {
  it('materializes fixed, disjoint authored forms with the official section counts', () => {
    expect(AUTHORED_FORMS).toHaveLength(30)
    const used = new Set<string>()
    for (const form of AUTHORED_FORMS) {
      expect(form).toHaveLength(93)
      expect(form.filter((item) => item.section === 'reading')).toHaveLength(23)
      expect(form.filter((item) => item.section === 'listening')).toHaveLength(47)
      expect(form.filter((item) => item.section === 'writing')).toHaveLength(12)
      expect(form.filter((item) => item.section === 'speaking')).toHaveLength(11)
      expect(countReadingScoredItems(form)).toBe(50)
      expect(form.filter((item) => item.section === 'reading' && item.module === 1)).toHaveLength(11)
      expect(form.filter((item) => item.section === 'reading' && item.module === 2)).toHaveLength(12)
      expect(form.filter((item) => item.section === 'listening' && item.module === 1)).toHaveLength(24)
      expect(form.filter((item) => item.section === 'listening' && item.module === 2)).toHaveLength(23)
      for (const item of form) {
        expect(used.has(item.id)).toBe(false)
        used.add(item.id)
      }
    }
  })

  it('contains only directly authored active items without duplicate ids', () => {
    expect(QUESTION_BANK).toHaveLength(2922)
    expect(CONTEXT_TOPIC_COUNT).toBeGreaterThanOrEqual(30)
    expect(new Set(QUESTION_BANK.map((item) => item.id)).size).toBe(QUESTION_BANK.length)
    expect(QUESTION_BANK.every((item) => item.sourceFamily?.startsWith('authored-'))).toBe(true)
    expect(QUESTION_BANK.some((item) => item.id.startsWith('x-') || item.id.startsWith('n-'))).toBe(false)
  })

  it('keeps official-style stimulus lengths and cloze structure', () => {
    const cloze = QUESTION_BANK.filter((item) => item.kind === 'complete-words')
    expect(cloze).toHaveLength(92)
    for (const item of cloze) {
      expect(item.passage?.split('___')).toHaveLength(11)
      expect(String(item.answer).split('|')).toHaveLength(10)
      expect(item.passage?.slice(0, item.passage.indexOf('.'))).not.toContain('___')
    }

    for (const item of QUESTION_BANK.filter((candidate) => candidate.title === 'Read an Academic Passage')) {
      expect(words(item.passage)).toBeGreaterThanOrEqual(35)
      expect(words(item.passage)).toBeLessThanOrEqual(200)
    }
    for (const item of QUESTION_BANK.filter((candidate) => candidate.title === 'Read in Daily Life')) {
      expect(words(item.passage)).toBeGreaterThanOrEqual(15)
      expect(words(item.passage)).toBeLessThanOrEqual(120)
    }
    for (const item of QUESTION_BANK.filter((candidate) => candidate.title === 'Listen to an Academic Talk')) {
      expect(words(item.audioText)).toBeGreaterThanOrEqual(25)
      expect(words(item.audioText)).toBeLessThanOrEqual(250)
    }
  })

  it('does not force advanced difficulty onto simple task types', () => {
    const shortResponses = QUESTION_BANK.filter((item) => item.title === 'Listen and Choose a Response')
    expect(shortResponses).toHaveLength(510)
    expect(shortResponses.every((item) => (item.difficulty === 'B1' || item.difficulty === 'B2') && words(item.audioText) <= 12)).toBe(true)

    const practicalTasks = QUESTION_BANK.filter((item) => item.title === 'Read in Daily Life' || item.title === 'Write an Email')
    expect(practicalTasks.filter((item) => item.difficulty === 'C1').length / practicalTasks.length).toBeLessThan(0.25)

    const shortRepeats = QUESTION_BANK.filter((item) => item.kind === 'repeat' && item.sequenceIndex === 0)
    expect(shortRepeats.every((item) => words(item.audioText) <= 12)).toBe(true)
  })

  testPrivateVocabulary('uses private vocabulary and distributes objective answers', () => {
    const vocabulary = JSON.parse(readFileSync(vocabularyPath, 'utf8')) as Array<{ word: string }>
    const available = new Set(vocabulary.map((entry) => entry.word.toLowerCase()))
    const focusWords = ['orientation', 'retrieval', 'aggregate']
    expect(focusWords.every((word) => available.has(word))).toBe(true)

    const distribution = [0, 0, 0, 0]
    for (const item of QUESTION_BANK) if (typeof item.answer === 'number') distribution[item.answer] += 1
    expect(Math.max(...distribution) - Math.min(...distribution)).toBeLessThanOrEqual(3)
  })

  it('prevents copied answers, position cues, and repeated templates across the full Reading bank', () => {
    const reading = QUESTION_BANK.filter((item) => item.section === 'reading' && item.kind === 'multiple-choice')
    expect(reading).toHaveLength(628)

    const answerDistribution = [0, 1, 2, 3].map((answer) => reading.filter((item) => item.answer === answer).length)
    expect(Math.max(...answerDistribution) - Math.min(...answerDistribution)).toBeLessThanOrEqual(1)

    const copiedAnswers = reading.filter((item) => normalize(item.passage).includes(normalize(item.options![item.answer as number])))
    expect(copiedAnswers.map((item) => item.id)).toEqual([])

    const highLexicalOverlap = reading.filter((item) => passageCoverage(item.options![item.answer as number], item.passage) >= 0.8)
    expect(highLexicalOverlap.length / reading.length).toBeLessThan(0.08)

    expect(new Set(reading.map((item) => normalize(item.prompt))).size).toBe(reading.length)

    for (const item of reading) {
      expect(new Set(item.options!.map((option) => normalize(option))).size).toBe(4)
    }
  })

  it('builds two Reading modules representing 50 scored items', () => {
    const set = buildReadingPracticeSetFrom(QUESTION_BANK)
    expect(set).toHaveLength(23)
    expect(new Set(set.map((item) => item.id)).size).toBe(set.length)
    expect(set.filter((item) => item.module === 1)).toHaveLength(11)
    expect(set.filter((item) => item.module === 2)).toHaveLength(12)
    expect(countReadingScoredItems(set)).toBe(50)
    for (const module of [1, 2]) {
      const items = set.filter((item) => item.module === module)
      expect(items.filter((item) => item.kind === 'complete-words')).toHaveLength(module === 1 ? 2 : 1)
      expect(items.filter((item) => item.title === 'Read in Daily Life')).toHaveLength(module === 1 ? 4 : 6)
      expect(items.filter((item) => item.title === 'Read an Academic Passage')).toHaveLength(5)
    }
  })

  it('builds the 47-item Listening blueprint without answer-position cues', () => {
    const set = buildFullPracticeSetFrom(QUESTION_BANK).filter((item) => item.section === 'listening')
    expect(set).toHaveLength(47)
    expect(set.filter((item) => item.title === 'Listen and Choose a Response')).toHaveLength(17)
    expect(set.filter((item) => item.title === 'Listen to a Conversation')).toHaveLength(10)
    expect(set.filter((item) => item.title === 'Listen to an Announcement')).toHaveLength(8)
    expect(set.filter((item) => item.title === 'Listen to an Academic Talk')).toHaveLength(12)

    for (const title of ['Listen and Choose a Response', 'Listen to a Conversation', 'Listen to an Announcement', 'Listen to an Academic Talk']) {
      const bankItems = QUESTION_BANK.filter((item) => item.title === title)
      const distribution = [0, 1, 2, 3].map((answer) => bankItems.filter((item) => item.answer === answer).length)
      expect(Math.max(...distribution) - Math.min(...distribution)).toBeLessThanOrEqual(1)
    }
  })

  it('keeps Speaking scenarios coherent and ordered', () => {
    const speaking = buildFullPracticeSetFrom(QUESTION_BANK).filter((item) => item.section === 'speaking')
    const repeat = speaking.filter((item) => item.kind === 'repeat')
    const interview = speaking.filter((item) => item.kind === 'interview')
    expect(repeat).toHaveLength(7)
    expect(interview).toHaveLength(4)
    expect(new Set(repeat.map((item) => item.scenarioId)).size).toBe(1)
    expect(new Set(interview.map((item) => item.scenarioId)).size).toBe(1)
    expect(repeat.map((item) => item.sequenceIndex)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(interview.map((item) => item.sequenceIndex)).toEqual([0, 1, 2, 3])
  })

  it('builds two complete full exams without reusing an item', () => {
    const first = buildFullPracticeSetFrom(QUESTION_BANK)
    const second = buildFullPracticeSetFrom(QUESTION_BANK, new Set(first.map((item) => item.id)))
    expect(first).toHaveLength(93)
    expect(second).toHaveLength(93)
    expect(second.filter((item) => first.some((used) => used.id === item.id))).toEqual([])
    expect(countReadingScoredItems(first)).toBe(50)
    expect(countReadingScoredItems(second)).toBe(50)
  })

  it('prevents repeated visible questions, choices, and open-task scripts across the full bank', () => {
    expect(repeated(QUESTION_BANK.map((item) => item.prompt || ''))).toEqual([])
    expect(repeated(QUESTION_BANK.flatMap((item) => item.options || []))).toEqual([])
    expect(repeated(QUESTION_BANK.filter((item) => item.kind === 'repeat' || item.kind === 'interview').map((item) => item.audioText || ''))).toEqual([])
    expect(repeated(QUESTION_BANK.filter((item) => item.kind === 'email' || item.kind === 'discussion').map((item) => item.prompt || ''))).toEqual([])
    expect(repeated(QUESTION_BANK.filter((item) => item.kind === 'discussion').map((item) => item.passage || ''))).toEqual([])
  })

  it('does not repeat complete sentences across distinct long-stimulus groups', () => {
    const representatives = new Map<string, string>()
    for (const item of QUESTION_BANK) {
      const text = item.passage || item.audioText || ''
      if (words(text) < 15) continue
      const group = item.stimulusGroupId || item.id
      if (!representatives.has(group)) representatives.set(group, text)
    }
    const sentences = [...representatives.values()].flatMap((text) => text
      .split(/(?<=[.!?])\s+/)
      .map(normalize)
      .filter((sentence) => words(sentence) >= 5))
    expect(repeated(sentences)).toEqual([])
  })

  it('does not reuse a near-identical long stimulus under a different group', () => {
    const representatives = new Map<string, { id: string; text: string }>()
    for (const item of QUESTION_BANK) {
      const text = item.passage || item.audioText || ''
      if (words(text) < 25) continue
      const group = item.stimulusGroupId || item.id
      if (!representatives.has(group)) representatives.set(group, { id: item.id, text })
    }
    const stimuli = [...representatives.values()]
    const suspicious: string[] = []
    for (let left = 0; left < stimuli.length; left += 1) {
      for (let right = left + 1; right < stimuli.length; right += 1) {
        if (jaccard(fourGrams(stimuli[left].text), fourGrams(stimuli[right].text)) >= 0.45) suspicious.push(`${stimuli[left].id}:${stimuli[right].id}`)
      }
    }
    expect(suspicious).toEqual([])
  }, 30_000)

  it('keeps learner-facing English fields free of Korean topic labels', () => {
    const fields = QUESTION_BANK.flatMap((item) => [
      item.prompt || '', item.passage || '', item.audioText || '', item.starter || '',
      ...(item.options || []), ...(item.words || []),
    ])
    expect(fields.filter((value) => /[가-힣]/.test(value))).toEqual([])
  })

  it('reuses a listening stimulus only inside its own question group', () => {
    const audioGroups = new Map<string, Set<string>>()
    for (const item of QUESTION_BANK.filter((candidate) => candidate.kind === 'listen-choice')) {
      const key = normalize(item.audioText)
      const groups = audioGroups.get(key) || new Set<string>()
      groups.add(item.stimulusGroupId || item.id)
      audioGroups.set(key, groups)
    }
    expect([...audioGroups.values()].filter((groups) => groups.size > 1)).toEqual([])
  })
})
