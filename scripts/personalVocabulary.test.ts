import { describe, expect, it } from 'vitest'
import type { LearningEntry } from '../src/learning'
import { advanceDailyWordBatch, attachPersonalMeaning, createDailyWordBatch, currentDailyTask, findVocabularyMatches, parseDailyWordLines, selectBalancedPersonalReview, type PersonalWordStat } from '../src/personalVocabulary'

const entry = (word: string): LearningEntry => ({
  word,
  meaningKo: `${word} 뜻`,
  meaningEn: `${word} definition`,
  partOfSpeech: 'noun',
  cefr: 'B2',
  ipa: '',
  synonyms: [],
  example: `The ${word} matters.`,
  translation: `${word}는 중요하다.`,
  frequency: 0,
  topics: ['내가 만든 단어장'],
})

describe('personal vocabulary workflow', () => {
  it('parses common pasted word-list separators and removes duplicates', () => {
    expect(parseDailyWordLines('abandon, 버리다\ncoherent\t일관된\nabandon - 포기하다\ninvalid')).toEqual([
      { word: 'abandon', meaningKo: '포기하다' },
      { word: 'coherent', meaningKo: '일관된' },
    ])
  })

  it('shows an exact dictionary entry before close spelling candidates', () => {
    const dictionary = [entry('abandon'), entry('abandoned'), entry('abundant'), entry('coherent')]
    const exact = findVocabularyMatches('abandon', dictionary)
    expect(exact[0]).toMatchObject({ kind: 'exact', entry: { word: 'abandon' } })
    expect(exact.some((match) => match.entry.word === 'abandoned' && match.kind === 'similar')).toBe(true)
    const typo = findVocabularyMatches('abandonn', dictionary)
    expect(typo[0]).toMatchObject({ kind: 'similar', entry: { word: 'abandon' } })
    expect(findVocabularyMatches('coherent', dictionary)[0].entry.word).toBe('coherent')
  })

  it('keeps the dictionary meaning while making the user meaning primary', () => {
    const linked = attachPersonalMeaning(entry('abandon'), '내가 정한 포기하다')
    expect(linked.meaningKo).toBe('내가 정한 포기하다')
    expect(linked.personalMeaningKo).toBe('내가 정한 포기하다')
    expect(linked.dictionaryMeaningKo).toBe('abandon 뜻')
    expect(linked.topics[0]).toBe('내가 만든 단어장')
  })

  it('requires both directions and repeats only missed tasks until all are correct', () => {
    let batch = createDailyWordBatch([entry('alpha'), entry('beta')], () => 0.9)
    const firstMissed = currentDailyTask(batch)?.id
    batch = advanceDailyWordBatch(batch, false, () => 0.9)
    while (batch.position + 1 < batch.queue.length) batch = advanceDailyWordBatch(batch, true, () => 0.9)
    batch = advanceDailyWordBatch(batch, true, () => 0.9)
    expect(batch.complete).toBe(false)
    expect(batch.queue).toEqual([firstMissed])
    expect(batch.retryRound).toBe(2)
    batch = advanceDailyWordBatch(batch, true, () => 0.9)
    expect(batch.complete).toBe(true)
    expect(batch.totalAttempts).toBe(5)
  })

  it('builds a shuffled 50+50 review from high-error and stable words', () => {
    const entries = Array.from({ length: 120 }, (_, index) => entry(`word${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`))
    const stats: Record<string, PersonalWordStat> = {}
    entries.slice(0, 60).forEach((item, index) => { stats[item.word] = { word: item.word, attempts: 10, correct: 9 - (index % 3), incorrect: 1 + (index % 3), lastStudiedAt: '2026-08-29T00:00:00.000Z' } })
    const selected = selectBalancedPersonalReview(entries, stats, 100, () => 0.42)
    expect(selected.entries).toHaveLength(100)
    expect(new Set(selected.entries.map((item) => item.word)).size).toBe(100)
    expect(selected.difficultCount).toBe(50)
    expect(selected.stableCount).toBe(50)
  })
})
