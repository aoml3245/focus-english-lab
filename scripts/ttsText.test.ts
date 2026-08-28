import { describe, expect, it } from 'vitest'
import { normalizeSentenceTTSInput } from '../src/tts'

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
