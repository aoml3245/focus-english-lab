type AudioContextWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
}

let audioContext: AudioContext | null = null
let lastPlayedAt = 0

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (audioContext) return audioContext
  const currentWindow = window as AudioContextWindow
  const AudioContextConstructor = currentWindow.AudioContext || currentWindow.webkitAudioContext
  if (!AudioContextConstructor) return null
  audioContext = new AudioContextConstructor()
  return audioContext
}

export function primeReadyChime() {
  try {
    const context = getAudioContext()
    if (context?.state === 'suspended') void context.resume().catch(() => undefined)
  } catch {
    // A later user interaction can retry, and TTS must remain unaffected.
  }
}

function addTone(context: AudioContext, destination: AudioNode, startAt: number, frequency: number, volume: number, duration: number) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, startAt)
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  oscillator.connect(gain)
  gain.connect(destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration + 0.02)
}

/** Plays a short, low-volume confirmation chime after speech preparation. */
export async function playReadyChime() {
  const now = Date.now()
  if (now - lastPlayedAt < 500) return false

  try {
    const context = getAudioContext()
    if (!context) return false
    if (context.state === 'suspended') await context.resume()
    if (context.state !== 'running') return false

    const startAt = context.currentTime + 0.02
    addTone(context, context.destination, startAt, 880, 0.075, 0.32)
    addTone(context, context.destination, startAt + 0.08, 1_320, 0.045, 0.4)
    lastPlayedAt = now
    return true
  } catch {
    // Audio permission varies by browser. Speech remains usable if the chime is blocked.
    return false
  }
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    primeReadyChime()
    window.removeEventListener('pointerdown', unlock, true)
    window.removeEventListener('keydown', unlock, true)
  }
  window.addEventListener('pointerdown', unlock, { capture: true, once: true })
  window.addEventListener('keydown', unlock, { capture: true, once: true })
}
