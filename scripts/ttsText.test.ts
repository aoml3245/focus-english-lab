import { describe, expect, it } from 'vitest'
import { examSpeechMode, normalizeSentenceTTSInput } from '../src/tts'

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
