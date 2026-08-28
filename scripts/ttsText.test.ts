import { describe, expect, it } from 'vitest'
import { examSpeechMode, getVoiceProfile, normalizeSentenceTTSInput, selectSpeechVoice, splitSpeakers } from '../src/tts'
import { applyQuestionRise, splitQuestionProsody } from '../src/ttsProsody'

describe('sentence TTS input', () => {
  it('joins visual line breaks without creating audio boundaries', () => {
    expect(normalizeSentenceTTSInput('The first sentence wraps here.\nThe second sentence stays connected.'))
      .toBe('The first sentence wraps here. The second sentence stays connected.')
  })

  it('normalizes CRLF and blank lines while preserving sentence punctuation', () => {
    expect(normalizeSentenceTTSInput('Why did it change?\r\n\r\nBecause the evidence improved.'))
      .toBe('Why did it change? Because the evidence improved.')
  })
})

describe('examSpeechMode', () => {
  it('keeps multi-speaker listening material in dialogue mode', () => {
    expect(examSpeechMode('listening', 'Listen to a Conversation')).toBe('dialogue')
    expect(examSpeechMode('listening', 'Listen to an Academic Talk')).toBe('dialogue')
    expect(examSpeechMode('listening', 'Listen to an Announcement')).toBe('dialogue')
  })

  it('uses continuous sentence mode for short responses and speaking prompts', () => {
    expect(examSpeechMode('listening', 'Listen and Choose a Response')).toBe('sentence')
    expect(examSpeechMode('speaking', 'Listen and Repeat')).toBe('sentence')
    expect(examSpeechMode('speaking', 'Take an Interview')).toBe('sentence')
  })
})

describe('dialogue voices', () => {
  it('recognizes longer speaker labels and preserves repeated speakers', () => {
    const parts = splitSpeakers('Student: Is the lab open? Community Engagement Coordinator: It opens at nine. Student: Thank you.')
    expect(parts.map((part) => part.speaker)).toEqual([0, 1, 0])
  })

  it('pairs opposite-gender voices for every AI profile', () => {
    for (const id of ['toefl-balanced', 'us-female', 'us-male', 'uk-female', 'uk-male'] as const) {
      const profile = getVoiceProfile(id)
      const first = selectSpeechVoice(profile, 'A stable transcript', 0)
      const second = selectSpeechVoice(profile, 'A stable transcript', 1)
      expect(first).not.toBe(second)
      expect(first[1]).not.toBe(second[1])
    }
  })
})

describe('question prosody', () => {
  it('isolates question sentences without changing their words', () => {
    expect(splitQuestionProsody([{ text: 'The office is nearby. Can you show me?', speaker: 0 }])).toEqual([
      { text: 'The office is nearby.', speaker: 0, intonation: 'neutral' },
      { text: 'Can you show me?', speaker: 0, intonation: 'question' },
    ])
  })

  it('raises and shortens only the final voiced tail', () => {
    const sampleRate = 1_000
    const samples = Float32Array.from({ length: 1_000 }, (_, index) => index < 950 ? Math.sin(index / 8) * 0.2 : 0)
    const risen = applyQuestionRise(samples, sampleRate)
    expect(risen.length).toBeLessThan(samples.length)
    expect([...risen.slice(0, 400)]).toEqual([...samples.slice(0, 400)])
  })
})
