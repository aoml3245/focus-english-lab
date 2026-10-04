import { describe, expect, it } from 'vitest'
import { compactWavBytes, encodePcm16Wav } from '../src/pcmWav.mjs'
import { ExamAudioCache } from '../src/examAudioCache'

function floatWav(samples: Float32Array, rate = 24000) {
  const bytes = encodePcm16Wav(samples, rate)
  const output = new Uint8Array(44 + samples.length * 4)
  output.set(bytes.subarray(0, 44))
  const view = new DataView(output.buffer)
  view.setUint32(4, output.length - 8, true); view.setUint16(20, 3, true)
  view.setUint32(28, rate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 32, true)
  view.setUint32(40, samples.length * 4, true)
  samples.forEach((sample, index) => view.setFloat32(44 + index * 4, sample, true))
  return output
}

describe('bounded compact exam speech', () => {
  it('halves float32 sample bytes while preserving rate, duration and waveform within PCM16 quantization', () => {
    const samples = Float32Array.from({ length: 24000 }, (_, i) => Math.sin(i / 15) * 0.8)
    const source = floatWav(samples), compact = compactWavBytes(source), view = new DataView(compact.buffer)
    expect(compact.length).toBe(44 + samples.length * 2)
    expect(view.getUint16(20, true)).toBe(1)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getUint32(24, true)).toBe(24000)
    expect(view.getUint32(40, true) / 2 / 24000).toBe(1)
    for (let i = 0; i < samples.length; i++) expect(Math.abs(view.getInt16(44 + i * 2, true) / 32768 - samples[i])).toBeLessThan(0.00006)
    expect(compactWavBytes(compact)).toBe(compact)
  })
  it('encodes worker chunks without adding silence, clamps overflow and silences nonfinite samples', () => {
    const bytes = encodePcm16Wav([new Float32Array([-2, -1, 0]), new Float32Array([1, 2, NaN])], 22050)
    const view = new DataView(bytes.buffer)
    expect(Array.from({ length: 6 }, (_, i) => view.getInt16(44 + i * 2, true))).toEqual([-32768, -32768, 0, 32767, 32767, 0])
    expect(view.getUint32(24, true)).toBe(22050)
  })
  it('keeps malformed or unsupported cached audio intact rather than corrupting it', () => {
    const invalid = new Uint8Array(60)
    expect(compactWavBytes(invalid)).toBe(invalid)
    const truncated = floatWav(new Float32Array(10)).subarray(0, 48)
    expect(compactWavBytes(truncated)).toBe(truncated)
  })
  it('pins 57 clips above the old 64 MiB threshold and enforces the 128 MiB boundary', () => {
    const cache = new ExamAudioCache(), clip = new Blob([new Uint8Array(1_300_000)])
    for (let i = 0; i < 57; i++) cache.set(`branch-${i}`, [clip])
    expect(cache.get('branch-0')).toEqual([clip])
    expect(cache.get('branch-56')).toEqual([clip])
    expect(() => cache.set('too-large', [new Blob([new Uint8Array(64 * 1024 * 1024)])])).toThrow('128 MiB')
    expect(cache.get('branch-0')).toEqual([clip])
    const custom = new ExamAudioCache(2 * 1024 * 1024)
    expect(() => custom.set('too-large', [new Blob([new Uint8Array(3 * 1024 * 1024)])])).toThrow('2 MiB')
  })
})
