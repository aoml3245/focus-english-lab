import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prepareExamTTS, prepareSpeech, stopAllTTS, subscribeExamTTSPrecache } from '../src/tts'

beforeEach(() => {
  vi.stubGlobal('window', { location: { hostname: '127.0.0.1', search: '' } })
})
afterEach(() => { stopAllTTS(); vi.unstubAllGlobals() })

describe('whole mock audio preflight', () => {
  it('finishes all clips and retains the first one through Intro → Test without another synthesis', async () => {
    let synthesisCount = 0
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/tts/status') return new Response(JSON.stringify({ state: 'ready' }))
      synthesisCount += 1
      return new Response(new Blob(['prepared-clip'], { type: 'audio/wav' }))
    }))
    const states: Array<{ status: string; completed: number; total: number }> = []
    const unsubscribe = subscribeExamTTSPrecache((state) => states.push(state))
    const audio = Array.from({ length: 43 }, (_, index) => ({ text: `Unique preflight test utterance number ${index}.`, speechMode: 'sentence' as const }))
    const result = await prepareExamTTS(audio, 'us-female', () => {})
    expect(result.clips).toBe(43)
    expect(synthesisCount).toBe(43)
    expect(states.at(-1)).toMatchObject({ status: 'ready', completed: 43, total: 43 })
    stopAllTTS(true)
    await prepareSpeech(audio[0].text, 'us-female', 'sentence', () => {})
    expect(synthesisCount).toBe(43)
    // Leaving the exam discards the temporary pinned data, not user/model storage.
    stopAllTTS()
    await prepareSpeech(audio[0].text, 'us-female', 'sentence', () => {})
    expect(synthesisCount).toBe(44)
    unsubscribe()
  })

  it('reports a failed clip as an error rather than a ready exam', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url === '/api/tts/status'
      ? new Response(JSON.stringify({ state: 'ready' }))
      : new Response(JSON.stringify({ error: 'failed synthesis' }), { status: 500 })))
    const states: string[] = []
    const unsubscribe = subscribeExamTTSPrecache((state) => states.push(state.status))
    await expect(prepareExamTTS([{ text: 'Failure regression audio.', speechMode: 'sentence' }], 'us-male', () => {})).rejects.toThrow('failed synthesis')
    expect(states.at(-1)).toBe('error')
    unsubscribe()
  })

  it('aborts pending synthesis on navigation without a later ready notification', async () => {
    let started = false
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/tts/status') return new Response(JSON.stringify({ state: 'ready' }))
      started = true
      return new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true })
      })
    }))
    const states: string[] = []
    const unsubscribe = subscribeExamTTSPrecache((state) => states.push(state.status))
    const preparation = prepareExamTTS([{ text: 'Cancellation regression audio.', speechMode: 'sentence' }], 'uk-female', () => {})
    const rejection = expect(preparation).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(started).toBe(true))
    stopAllTTS()
    await rejection
    expect(states.at(-1)).toBe('idle')
    expect(states.slice(states.lastIndexOf('preparing') + 1)).not.toContain('ready')
    unsubscribe()
  })
})
