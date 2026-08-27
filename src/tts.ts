import type { GenerateOptions } from 'kokoro-js'

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
type KokoroInstance = Awaited<ReturnType<(typeof import('kokoro-js'))['KokoroTTS']['from_pretrained']>>

let kokoroPromise: Promise<KokoroInstance> | null = null
let activeAudio: HTMLAudioElement | null = null
let activeUrls: string[] = []
let playbackGeneration = 0
let useSystemForSession = false
const preparedVoices = new Set<string>()
const preparationPromises = new Map<string, Promise<void>>()
const speechCache = new Map<string, Blob[]>()
const speechPromises = new Map<string, Promise<Blob[]>>()
const MAX_CACHED_SPEECHES = 24

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

async function getKokoro(onProgress: ProgressHandler) {
  if (!kokoroPromise) {
    kokoroPromise = import('kokoro-js').then(({ KokoroTTS }) => KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (progress: { status?: string; progress?: number }) => {
        const percent = typeof progress.progress === 'number' ? ` ${Math.round(progress.progress)}%` : ''
        onProgress(`AI 음성 모델 준비 중…${percent}`)
      },
    })).catch((error) => { kokoroPromise = null; throw error })
  }
  return kokoroPromise
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

async function warmVoice(tts: KokoroInstance, voice: string, onProgress: ProgressHandler, index: number, total: number) {
  if (preparedVoices.has(voice)) return
  let pending = preparationPromises.get(voice)
  if (!pending) {
    pending = (async () => {
      onProgress(`AI 화자 워밍업 중… ${index}/${total}`)
      await tts.generate(index === 1 ? 'Audio is ready.' : 'The second speaker is ready.', { voice: voice as NonNullable<GenerateOptions['voice']>, speed: 1 })
      preparedVoices.add(voice)
    })().finally(() => preparationPromises.delete(voice))
    preparationPromises.set(voice, pending)
  }
  await pending
}

export async function prepareTTS(profileId: VoiceProfileId, onProgress: ProgressHandler): Promise<TTSPreparationResult> {
  const profile = getVoiceProfile(profileId)
  if (profile.id === 'system') {
    await prepareSystemVoices(onProgress)
    return { engine: 'system', fallback: false, voices: 1, clips: 0 }
  }
  try {
    onProgress('AI 음성 엔진을 시작하고 있습니다…')
    const tts = await getKokoro(onProgress)
    const voices = [...new Set([profile.primary, profile.secondary].filter((voice): voice is string => Boolean(voice)))]
    for (let index = 0; index < voices.length; index += 1) await warmVoice(tts, voices[index], onProgress, index + 1, voices.length)
    useSystemForSession = false
    onProgress('AI 음성 엔진과 화자 준비가 끝났습니다.')
    return { engine: 'kokoro', fallback: false, voices: voices.length, clips: 0 }
  } catch {
    useSystemForSession = true
    onProgress('AI 음성을 사용할 수 없어 기기 음성을 준비합니다…')
    await prepareSystemVoices(onProgress)
    return { engine: 'system', fallback: true, voices: 1, clips: 0 }
  }
}

function speechKey(text: string, profile: VoiceProfile) {
  return `${profile.id}:${profile.primary || 'system'}:${profile.secondary || ''}:${text}`
}

async function synthesizeSpeech(text: string, profile: VoiceProfile, onProgress: ProgressHandler) {
  const tts = await getKokoro(onProgress)
  const parts = splitSpeakers(text)
  const blobs: Blob[] = []
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]
    onProgress(`자연스러운 음성 생성 중… ${index + 1}/${parts.length}`)
    const voice = part.speaker % 2 === 1 && profile.secondary ? profile.secondary : profile.primary!
    const rawAudio = await tts.generate(part.text, { voice: voice as NonNullable<GenerateOptions['voice']>, speed: 1 })
    blobs.push(rawAudio.toBlob())
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
  for (let index = 0; index < uniqueTexts.length; index += 1) {
    onProgress(`시험 음성 미리 생성 중… ${index + 1}/${uniqueTexts.length}`)
    await getSpeech(uniqueTexts[index], profile, onProgress)
  }
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

async function speakWithKokoro(text: string, profile: VoiceProfile, onProgress: ProgressHandler) {
  const generation = playbackGeneration
  const blobs = await getSpeech(text, profile, onProgress)
  if (generation !== playbackGeneration) return
  const clips: HTMLAudioElement[] = []
  for (const blob of blobs) {
    const url = URL.createObjectURL(blob)
    activeUrls.push(url)
    clips.push(new Audio(url))
  }
  for (const clip of clips) await playElement(clip, generation, onProgress)
  releaseAudio()
}

export async function playTTS(text: string, profileId: VoiceProfileId, onProgress: ProgressHandler) {
  stopTTS()
  const profile = getVoiceProfile(profileId)
  const generation = playbackGeneration
  try {
    if (profile.id === 'system' || useSystemForSession) await speakWithSystem(text, onProgress)
    else await speakWithKokoro(text, profile, onProgress)
    if (generation !== playbackGeneration) return 'cancelled'
    return useSystemForSession && profile.id !== 'system' ? 'fallback' : 'completed'
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
