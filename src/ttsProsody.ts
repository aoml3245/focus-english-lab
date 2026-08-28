export type SpeechIntonation = 'neutral' | 'question'

export type ProsodyPart<T extends { text: string }> = T & { intonation: SpeechIntonation }

const QUESTION_END_RE = /\?(?:["”’']|\s)*$/
const SENTENCE_RE = /[^.!?]+(?:[.!?]+["”’']*|$)/g

export function splitQuestionProsody<T extends { text: string }>(parts: T[]): Array<ProsodyPart<T>> {
  return parts.flatMap((part) => {
    if (!part.text.includes('?')) return [{ ...part, intonation: 'neutral' as const }]
    const sentences = part.text.match(SENTENCE_RE)?.map((text) => text.trim()).filter(Boolean) || [part.text]
    return sentences.map((text) => ({ ...part, text, intonation: QUESTION_END_RE.test(text) ? 'question' as const : 'neutral' as const }))
  })
}

// Kokoro 82M currently produces little interrogative contour for `?`. Raise
// the pitch progressively over the final voiced half-second by reading that
// tail increasingly faster. The mapping begins at 1x, so the join is smooth.
export function applyQuestionRise(samples: Float32Array, sampleRate = 24_000) {
  if (samples.length < sampleRate * 0.18) return samples
  const silenceThreshold = 0.002
  let voicedEnd = samples.length - 1
  while (voicedEnd > 0 && Math.abs(samples[voicedEnd]) < silenceThreshold) voicedEnd -= 1
  const trailing = samples.length - 1 - voicedEnd
  const tailLength = Math.min(Math.round(sampleRate * 0.52), voicedEnd + 1)
  if (tailLength < sampleRate * 0.12) return samples
  const tailStart = voicedEnd + 1 - tailLength
  const averageSpeed = 1.1
  const outputTailLength = Math.max(1, Math.floor(tailLength / averageSpeed))
  const output = new Float32Array(tailStart + outputTailLength + trailing)
  output.set(samples.subarray(0, tailStart))
  for (let index = 0; index < outputTailLength; index += 1) {
    const progress = outputTailLength === 1 ? 1 : index / (outputTailLength - 1)
    const sourcePosition = Math.min(tailLength - 1, index + (averageSpeed - 1) * index * progress)
    const lower = Math.floor(sourcePosition)
    const upper = Math.min(tailLength - 1, lower + 1)
    const mix = sourcePosition - lower
    output[tailStart + index] = samples[tailStart + lower] * (1 - mix) + samples[tailStart + upper] * mix
  }
  if (trailing) output.set(samples.subarray(voicedEnd + 1), tailStart + outputTailLength)
  return output
}
