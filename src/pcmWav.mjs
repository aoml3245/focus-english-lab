/** Compact uncompressed speech without resampling: signed PCM16 at the original rate. */
export function encodePcm16Wav(samples, sampleRate, channels = 1) {
  const chunks = Array.isArray(samples) ? samples : [samples]
  const count = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const bytes = new Uint8Array(44 + count * 2)
  const view = new DataView(bytes.buffer)
  const write = (offset, value) => { for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i) }
  write(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); write(8, 'WAVE'); write(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true)
  write(36, 'data'); view.setUint32(40, count * 2, true)
  let offset = 44
  for (const chunk of chunks) for (const raw of chunk) {
    const sample = Number.isFinite(raw) ? Math.max(-1, Math.min(1, raw)) : 0
    view.setInt16(offset, Math.round(sample * (sample < 0 ? 32768 : 32767)), true); offset += 2
  }
  return bytes
}

/** Legacy float32 caches are converted on read; PCM16 and unknown formats stay intact. */
export function compactWavBytes(bytes) {
  if (bytes.byteLength < 44) return bytes
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (offset) => String.fromCharCode(...bytes.subarray(offset, offset + 4))
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return bytes
  let format = 0, channels = 0, sampleRate = 0, bits = 0
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = view.getUint32(offset + 4, true), start = offset + 8
    if (start + size > bytes.length) return bytes
    if (tag(offset) === 'fmt ' && size >= 16) {
      format = view.getUint16(start, true); channels = view.getUint16(start + 2, true)
      sampleRate = view.getUint32(start + 4, true); bits = view.getUint16(start + 14, true)
    }
    if (tag(offset) === 'data') {
      if (format !== 3 || bits !== 32 || !channels || !sampleRate || size % 4) return bytes
      // The one temporary float array is released before a whole exam is retained.
      const samples = new Float32Array(size / 4)
      for (let i = 0; i < samples.length; i++) samples[i] = view.getFloat32(start + i * 4, true)
      return encodePcm16Wav(samples, sampleRate, channels)
    }
    offset = start + size + (size % 2)
  }
  return bytes
}
