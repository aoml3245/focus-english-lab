import { describe, expect, it } from 'vitest'
import { QUESTION_BANK, buildReadingPracticeSet } from '../src/bank'
import { getSessionStats, isCorrect, scoreItem } from '../src/review'
import { createExamPack, parseExamPack } from '../src/examPack'
import { requiresExamAudioPreflight, stimulusWasPlayed } from '../src/examAudioState'
import { resolveSessionItems } from '../src/sessionQuestions'
import { ExamAudioCache } from '../src/examAudioCache'
import legacyRevisions from '../src/legacyQuestionRevisions.json'
import { completedClozePassage } from '../src/clozeFormat'
import type { BaseItem, SavedSession } from '../src/types'

const session: SavedSession = { id: 'regression', startedAt: '', updatedAt: '', itemIndex: 0, answers: {}, completed: true }
const byId = new Map(QUESTION_BANK.map((item) => [item.id, item]))

describe('exam correction regressions', () => {
  it('never counts an unanswered objective item as correct, including a zero answer index', () => {
    for (const item of QUESTION_BANK.filter((item) => item.answer !== undefined)) {
      expect(isCorrect(item, undefined), item.id).toBe(false)
      expect(scoreItem(item, undefined).correct, item.id).toBe(0)
    }
  })
  it('pins all 43 ready mock clips despite the ordinary 24-clip LRU, with a byte cap', () => {
    const cache = new ExamAudioCache(43)
    for (let index = 0; index < 43; index += 1) cache.set(`clip-${index}`, [new Blob(['x'])])
    expect(cache.get('clip-0')).toHaveLength(1)
    expect(cache.get('clip-42')).toHaveLength(1)
    expect(() => cache.set('overflow', [new Blob(['x'])])).toThrow(/한도/)
    cache.clear()
    expect(cache.get('clip-0')).toBeUndefined()
    expect(() => cache.set('new', [new Blob(['x'])])).not.toThrow()
  })
  it('awards nine of ten cloze blanks without marking the entire item correct', () => {
    const item = QUESTION_BANK.find((item) => item.kind === 'complete-words')!
    const answer = String(item.answer).split('|').map((word) => ` ${word.toUpperCase()} `)
    answer[9] = 'wrong'
    expect(scoreItem(item, answer)).toEqual({ correct: 9, total: 10 })
    expect(isCorrect(item, answer)).toBe(false)
    const stats = getSessionStats([item], { ...session, answers: { [item.id]: answer } })
    expect(stats).toMatchObject({ correct: 9, total: 10, answered: 1 })
    expect(stats.mistakes).toEqual([item])
    expect(scoreItem(item, undefined)).toEqual({ correct: 0, total: 10 })
  })

  it('uses all 50 Reading scoring units, not 23 screens, in its denominator', () => {
    const items = buildReadingPracticeSet()
    const answers = Object.fromEntries(items.map((item) => [item.id, item.kind === 'complete-words' ? String(item.answer).split('|') : item.answer]))
    expect(getSessionStats(items, { ...session, answers })).toMatchObject({ correct: 50, total: 50, answered: 23 })
    expect(getSessionStats(items, session)).toMatchObject({ correct: 0, total: 50 })
  })

  it('accepts curated tile orders but rejects an arbitrary permutation and missing tiles', () => {
    for (const item of QUESTION_BANK.filter((item) => item.acceptedAnswers?.length)) {
      for (const answer of item.acceptedAnswers!) {
        expect(isCorrect(item, answer.split('|')), item.id).toBe(true)
        expect(isCorrect(item, answer.toUpperCase()), item.id).toBe(true)
      }
      expect(isCorrect(item, []), item.id).toBe(false)
    }
    expect(isCorrect(byId.get('w-sentence-0')!, ['to', 'how', 'organize', 'the evidence', 'more clearly'])).toBe(false)
  })

  it('round-trips explicit alternative answers and rejects altered tile multisets', () => {
    const item = byId.get('w-sentence-0')!
    expect(parseExamPack(JSON.parse(JSON.stringify(createExamPack([item])))).items[0].acceptedAnswers).toEqual(item.acceptedAnswers)
    expect(() => parseExamPack(createExamPack([{ ...item, acceptedAnswers: ['how|to|organize'] }]))).toThrow()
  })

  it('requires preflight only for audio-bearing mock exams', () => {
    const reading = QUESTION_BANK.filter((item) => item.section === 'reading')
    const audio = QUESTION_BANK.filter((item) => item.section === 'listening')
    expect(requiresExamAudioPreflight('mock', audio)).toBe(true)
    expect(requiresExamAudioPreflight('mock', reading)).toBe(false)
    expect(requiresExamAudioPreflight('study', audio)).toBe(false)
    expect(requiresExamAudioPreflight('section', audio)).toBe(false)
  })

  it('does not infer playback from adjacent questions; requires completed playback', () => {
    const first = QUESTION_BANK.find((item) => item.title === 'Listen to a Conversation')!
    const second = QUESTION_BANK.find((item) => item.id !== first.id && item.stimulusGroupId === first.stimulusGroupId)!
    expect(stimulusWasPlayed(second, [])).toBe(false)
    expect(stimulusWasPlayed(second, [first.stimulusGroupId!])).toBe(true)
    expect(stimulusWasPlayed(second, ['some-other-group'])).toBe(false)
  })

  it('keeps the learner’s original question snapshot even after an option rewrite', () => {
    const original = structuredClone(byId.get('w-sentence-0')!)
    const changed: BaseItem = { ...original, prompt: 'Rewritten prompt', words: ['new'], answer: 'new' }
    const saved: SavedSession = { ...session, itemIds: [original.id], itemSnapshots: [original], questionBankRevision: '0.1.84' }
    expect(resolveSessionItems(saved, new Map([[changed.id, changed]]))).toEqual([original])
    expect(saved.answers).toEqual({})
  })

  it('uses alternating second-half gaps after the intact first sentence for all 92 clozes', () => {
    const clozes = QUESTION_BANK.filter((item) => item.kind === 'complete-words')
    expect(clozes).toHaveLength(92)
    for (const item of clozes) {
      const suffixes = String(item.answer).split('|')
      let index = 0
      const restored = item.passage!.replace(/___/g, () => suffixes[index++])
      const opening = restored.search(/[.!?](?:\s|$)/)
      expect(item.passage!.slice(0, opening + 1), item.id).not.toContain('___')
      const words = [...restored.slice(opening + 1).matchAll(/\b[A-Za-z]+(?:['’\-][A-Za-z]+)*\b/g)].map((match) => match[0])
      expect(suffixes, item.id).toEqual(Array.from({ length: 10 }, (_, n) => words[2 * n + 1].slice(Math.floor(words[2 * n + 1].length / 2))))
      expect(index, item.id).toBe(10)
      expect(completedClozePassage(item), item.id).toBe(restored)
      expect(item.explanation, item.id).toContain('10.')
    }
  })

  it('restores pre-update options without changing stored numeric answers', () => {
    const original = (legacyRevisions as unknown as BaseItem[]).find((item) => item.id === 'f04-response-1')!
    expect(original).toBeDefined()
    const answers = { [original.id]: original.answer as number }
    const saved: SavedSession = { ...session, itemIds: [original.id], answers }
    const restored = resolveSessionItems(saved, byId)
    expect(restored).toEqual([original])
    expect(restored[0].options?.[original.answer as number]).toBe('Certainly, the control switch is beside the podium.')
    expect(isCorrect(restored[0], saved.answers[original.id])).toBe(true)
    expect(saved.answers).toEqual(answers)
  })

  it('regrades a curated historical tile order only when its original task is unchanged', () => {
    const saved: SavedSession = { ...session, itemIds: ['w-sentence-0'], answers: { 'w-sentence-0': ['how', 'to', 'more clearly', 'organize', 'the evidence'] } }
    const original = resolveSessionItems(saved, byId)[0]
    expect(original.acceptedAnswers).toContain('how|to|more clearly|organize|the evidence')
    expect(isCorrect(original, saved.answers[original.id])).toBe(true)
    const rewritten = (legacyRevisions as unknown as BaseItem[]).find((item) => item.id === 'f21-sentence-6')!
    expect(rewritten.acceptedAnswers).toBeUndefined()
    expect(rewritten.starter).toContain('Not so much did it')
  })
})
