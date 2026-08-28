export type VoiceProfileId = 'toefl-balanced' | 'us-female' | 'us-male' | 'uk-female' | 'uk-male' | 'system'

export type VoiceProfile = {
  id: VoiceProfileId
  name: string
  shortLabel: string
  description: string
  accent: string
  primary?: string
  secondary?: string
  recommended?: boolean
}

export type TTSPreparationResult = {
  engine: 'kokoro' | 'system'
  fallback: boolean
  voices: number
  clips: number
}

export const VOICE_PROFILES: VoiceProfile[] = [
  { id: 'toefl-balanced', name: 'TOEFL 균형형', shortLabel: 'AI · 미국식 혼합', description: '대화에서는 여성·남성 화자를 자동으로 나누고, 강의에서는 자연스러운 미국식 음성을 사용합니다.', accent: '미국식 · 여성/남성', primary: 'af_heart', secondary: 'am_michael', recommended: true },
  { id: 'us-female', name: 'Heart', shortLabel: 'AI · 미국 여성', description: '명료하면서도 부드러운 미국식 여성 음성입니다. Kokoro 음성 중 품질 등급이 가장 높습니다.', accent: '미국식 · 여성', primary: 'af_heart' },
  { id: 'us-male', name: 'Michael', shortLabel: 'AI · 미국 남성', description: '학술 강의와 캠퍼스 안내에 잘 어울리는 차분한 미국식 남성 음성입니다.', accent: '미국식 · 남성', primary: 'am_michael' },
  { id: 'uk-female', name: 'Emma', shortLabel: 'AI · 영국 여성', description: '다양한 영어 억양을 연습할 수 있는 안정적인 영국식 여성 음성입니다.', accent: '영국식 · 여성', primary: 'bf_emma' },
  { id: 'uk-male', name: 'George', shortLabel: 'AI · 영국 남성', description: '강의와 인터뷰 연습에 적합한 또렷한 영국식 남성 음성입니다.', accent: '영국식 · 남성', primary: 'bm_george' },
  { id: 'system', name: '기기 기본 음성', shortLabel: '시스템 영어 음성', description: '모델 다운로드 없이 기기에 설치된 영어 음성을 사용합니다. AI 음성이 작동하지 않을 때의 안전한 대안입니다.', accent: '기기별로 다름' },
]

const PROFILE_BY_ID = new Map(VOICE_PROFILES.map((profile) => [profile.id, profile]))
const STORAGE_KEY = 'focus-english-lab:voice-profile:v1'
const DEFAULT_PROFILE: VoiceProfileId = 'toefl-balanced'
const SPEAKER_RE = /(?:^|\s)([A-Z][A-Za-z ]{0,24}):\s*/g

type ProgressHandler = (message: string) => void
type PlayOptions = { maxWaitMs?: number }
let activeAudio: HTMLAudioElement | null = null
let activeUrls: string[] = []
let playbackGeneration = 0
const speechCache = new Map<string, Blob[]>()
const speechPromises = new Map<string, Promise<Blob[]>>()
const MAX_CACHED_SPEECHES = 24
let examPrecacheGeneration = 0

export function hasLocalTtsServer() {
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
}

export function loadVoiceProfileId(): VoiceProfileId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as VoiceProfileId | null
    return stored && PROFILE_BY_ID.has(stored) ? stored : DEFAULT_PROFILE
  } catch { return DEFAULT_PROFILE }
}

export function saveVoiceProfileId(id: VoiceProfileId) {
  try { localStorage.setItem(STORAGE_KEY, id) } catch { /* Storage may be disabled. */ }
}

export function getVoiceProfile(id = loadVoiceProfileId()) {
  return PROFILE_BY_ID.get(id) || PROFILE_BY_ID.get(DEFAULT_PROFILE)!
}

function releaseAudio() {
  activeAudio?.pause()
  activeAudio = null
  activeUrls.forEach((url) => URL.revokeObjectURL(url))
  activeUrls = []
}

export function stopTTS() {
  playbackGeneration += 1
  releaseAudio()
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

function splitSpeakers(text: string) {
  const matches = [...text.matchAll(SPEAKER_RE)]
  if (!matches.length) return [{ text: text.trim(), speaker: 0 }]
  const speakers = new Map<string, number>()
  return matches.map((match, index) => {
    const label = match[1]
    if (!speakers.has(label)) speakers.set(label, speakers.size)
    const start = (match.index || 0) + match[0].length
    const end = matches[index + 1]?.index ?? text.length
    return { text: text.slice(start, end).trim(), speaker: speakers.get(label) || 0 }
  }).filter((part) => part.text)
}

function systemVoice() {
  const voices = window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith('en'))
  return voices.find((voice) => /samantha|ava|allison|zira|google us english/i.test(voice.name)) || voices.find((voice) => voice.lang.toLowerCase() === 'en-us') || voices[0]
}

function speakWithSystem(text: string, onProgress: ProgressHandler) {
  return new Promise<void>((resolve, reject) => {
    if (!('speechSynthesis' in window)) { reject(new Error('이 브라우저는 음성 합성을 지원하지 않습니다.')); return }
    const utterance = new SpeechSynthesisUtterance(text.replace(SPEAKER_RE, ' '))
    const voice = systemVoice()
    if (voice) utterance.voice = voice
    utterance.lang = voice?.lang || 'en-US'
    utterance.rate = .96
    utterance.pitch = 1
    utterance.onstart = () => onProgress('재생 중…')
    utterance.onend = () => resolve()
    utterance.onerror = () => reject(new Error('시스템 음성을 재생하지 못했습니다.'))
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  })
}

function prepareSystemVoices(onProgress: ProgressHandler) {
  return new Promise<void>((resolve, reject) => {
    if (!('speechSynthesis' in window)) { reject(new Error('이 브라우저는 음성 합성을 지원하지 않습니다.')); return }
    onProgress('기기 영어 음성을 확인하고 있습니다…')
    if (window.speechSynthesis.getVoices().length) { resolve(); return }
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.speechSynthesis.removeEventListener('voiceschanged', finish)
      resolve()
    }
    window.speechSynthesis.addEventListener('voiceschanged', finish, { once: true })
    window.setTimeout(finish, 800)
  })
}

export async function prepareTTS(profileId: VoiceProfileId, onProgress: ProgressHandler): Promise<TTSPreparationResult> {
  const profile = getVoiceProfile(profileId)
  if (profile.id === 'system' || !hasLocalTtsServer()) {
    await prepareSystemVoices(onProgress)
    return { engine: 'system', fallback: profile.id !== 'system', voices: 1, clips: 0 }
  }
  onProgress('로컬 음성 서버를 확인하고 있습니다…')
  const response = await fetch('/api/tts/status')
  if (!response.ok) throw new Error('로컬 음성 서버에 연결하지 못했습니다.')
  const status = await response.json() as { state: 'idle' | 'loading' | 'ready' | 'error'; error?: string }
  if (status.state === 'error') throw new Error(status.error || '로컬 AI 음성 모델을 시작하지 못했습니다.')
  onProgress(status.state === 'ready' ? '로컬 AI 음성 서버가 준비됐습니다.' : 'AI 모델은 서버에서 백그라운드로 준비 중입니다.')
  const voices = new Set([profile.primary, profile.secondary].filter(Boolean)).size
  return { engine: 'kokoro', fallback: false, voices, clips: 0 }
}

function speechKey(text: string, profile: VoiceProfile) {
  return `${profile.id}:${profile.primary || 'system'}:${profile.secondary || ''}:${text}`
}

async function synthesizeSpeech(text: string, profile: VoiceProfile, onProgress: ProgressHandler) {
  const parts = splitSpeakers(text)
  const blobs: Blob[] = []
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]
    onProgress(`서버 음성 불러오는 중… ${index + 1}/${parts.length}`)
    const voice = part.speaker % 2 === 1 && profile.secondary ? profile.secondary : profile.primary!
    const response = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: part.text, voice, speed: 1 }) })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string }
      throw new Error(payload.error || '로컬 음성 서버에서 음성을 만들지 못했습니다.')
    }
    blobs.push(await response.blob())
  }
  return blobs
}

function getSpeech(text: string, profile: VoiceProfile, onProgress: ProgressHandler) {
  const key = speechKey(text, profile)
  const cached = speechCache.get(key)
  if (cached) {
    speechCache.delete(key)
    speechCache.set(key, cached)
    return Promise.resolve(cached)
  }
  let pending = speechPromises.get(key)
  if (!pending) {
    pending = synthesizeSpeech(text, profile, onProgress).then((blobs) => {
      speechCache.set(key, blobs)
      while (speechCache.size > MAX_CACHED_SPEECHES) speechCache.delete(speechCache.keys().next().value!)
      return blobs
    }).finally(() => speechPromises.delete(key))
    speechPromises.set(key, pending)
  }
  return pending
}

export async function prepareExamTTS(texts: string[], profileId: VoiceProfileId, onProgress: ProgressHandler) {
  const result = await prepareTTS(profileId, onProgress)
  if (result.engine !== 'kokoro') return result
  const profile = getVoiceProfile(profileId)
  const uniqueTexts = [...new Set(texts.filter(Boolean))]
  const generation = ++examPrecacheGeneration
  void (async () => {
    for (let index = 0; index < uniqueTexts.length; index += 1) {
      if (generation !== examPrecacheGeneration) return
      await getSpeech(uniqueTexts[index], profile, () => undefined)
    }
  })().catch(() => undefined)
  return { ...result, clips: uniqueTexts.length }
}

function playElement(audio: HTMLAudioElement, generation: number, onProgress: ProgressHandler) {
  return new Promise<void>((resolve, reject) => {
    if (generation !== playbackGeneration) { resolve(); return }
    activeAudio = audio
    audio.onplay = () => onProgress('재생 중…')
    audio.onended = () => { activeAudio = null; resolve() }
    audio.onerror = () => reject(new Error('생성된 음성을 재생하지 못했습니다.'))
    audio.play().catch(reject)
  })
}

async function speakWithKokoro(text: string, profile: VoiceProfile, onProgress: ProgressHandler, maxWaitMs?: number) {
  const generation = playbackGeneration
  const speech = getSpeech(text, profile, onProgress)
  const blobs = maxWaitMs
    ? await Promise.race<Blob[] | null>([speech, new Promise<null>((resolve) => window.setTimeout(() => resolve(null), maxWaitMs))])
    : await speech
  if (!blobs) return false
  if (generation !== playbackGeneration) return
  const clips: HTMLAudioElement[] = []
  for (const blob of blobs) {
    const url = URL.createObjectURL(blob)
    activeUrls.push(url)
    clips.push(new Audio(url))
  }
  for (const clip of clips) await playElement(clip, generation, onProgress)
  releaseAudio()
  return true
}

export async function playTTS(text: string, profileId: VoiceProfileId, onProgress: ProgressHandler, options: PlayOptions = {}) {
  stopTTS()
  const profile = getVoiceProfile(profileId)
  const generation = playbackGeneration
  try {
    if (profile.id === 'system' || !hasLocalTtsServer()) {
      if (profile.id !== 'system') onProgress('웹 버전에서는 기기 영어 음성으로 재생합니다…')
      await speakWithSystem(text, onProgress)
      if (profile.id !== 'system') return 'fallback'
    }
    else {
      const played = await speakWithKokoro(text, profile, onProgress, options.maxWaitMs)
      if (played === false) {
        onProgress('AI 음성은 서버에서 계속 준비합니다. 이번에는 기기 음성으로 바로 재생합니다…')
        await speakWithSystem(text, onProgress)
        return 'fallback'
      }
    }
    if (generation !== playbackGeneration) return 'cancelled'
    return 'completed'
  } catch (error) {
    if (generation !== playbackGeneration) return 'cancelled'
    if (profile.id !== 'system') {
      onProgress('AI 음성을 사용할 수 없어 시스템 음성으로 전환합니다…')
      await speakWithSystem(text, onProgress)
      return 'fallback'
    }
    throw error
  }
}
