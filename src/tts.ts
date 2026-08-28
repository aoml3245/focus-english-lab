import { cacheSpeech, readCachedSpeech } from './ttsAudioCache'

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
  backend?: 'server' | 'webgpu' | 'wasm'
  fallback: boolean
  voices: number
  clips: number
}

export type TTSProgressDetail = {
  phase: 'checking' | 'downloading' | 'loading-cache' | 'initializing' | 'generating' | 'playing' | 'ready' | 'complete'
  percent?: number
  loadedBytes?: number
  totalBytes?: number
  file?: string
  cached?: boolean
  backend?: 'webgpu' | 'wasm'
}

export type TTSBackendPreference = 'auto' | 'webgpu' | 'wasm'

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
const BACKEND_STORAGE_KEY = 'focus-english-lab:tts-backend:v1'
const DEFAULT_PROFILE: VoiceProfileId = 'toefl-balanced'
const SPEAKER_RE = /(?:^|\s)([A-Z][A-Za-z ]{0,24}):\s*/g

type ProgressHandler = (message: string, detail?: TTSProgressDetail) => void
type PlayOptions = { maxWaitMs?: number }
type BrowserSpeechPart = { text: string; voice: string }
type WorkerRequest = {
  chunks: Blob[]
  resolve: (blobs: Blob[]) => void
  reject: (error: Error) => void
  onChunk?: (blob: Blob, index: number) => void
  abort?: () => void
}
let activeAudio: HTMLAudioElement | null = null
let activeUrls: string[] = []
let playbackGeneration = 0
const speechCache = new Map<string, Blob[]>()
const MAX_CACHED_SPEECHES = 24
let examPrecacheGeneration = 0
let activePlaybackController: AbortController | null = null
let examPrecacheController: AbortController | null = null
const pendingPlaybackRequests = new Set<AbortController>()
const pendingSpeech = new Map<string, Promise<Blob[]>>()
let browserKokoroWorker: Worker | null = null
let browserKokoroPromise: Promise<void> | null = null
const browserKokoroProgressHandlers = new Set<ProgressHandler>()
let lastBrowserKokoroProgress: { message: string; detail: TTSProgressDetail } | null = null
const workerRequests = new Map<string, WorkerRequest>()
let workerRequestSequence = 0
let activeBrowserBackend: 'webgpu' | 'wasm' | null = null

export function hasLocalTtsServer() {
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
}

export function browserSupportsWebGPU() {
  return typeof navigator !== 'undefined' && 'gpu' in navigator && window.isSecureContext
}

export function loadTTSBackendPreference(): TTSBackendPreference {
  try {
    const stored = localStorage.getItem(BACKEND_STORAGE_KEY)
    return stored === 'webgpu' || stored === 'wasm' ? stored : 'auto'
  } catch { return 'auto' }
}

export function resolveTTSBackend(preference = loadTTSBackendPreference()): 'webgpu' | 'wasm' {
  return preference !== 'wasm' && browserSupportsWebGPU() ? 'webgpu' : 'wasm'
}

export function saveTTSBackendPreference(preference: TTSBackendPreference) {
  try { localStorage.setItem(BACKEND_STORAGE_KEY, preference) } catch { /* Storage may be disabled. */ }
  stopAllTTS()
  if (browserKokoroWorker) failWorker(new DOMException('TTS backend changed', 'AbortError'))
  activeBrowserBackend = null
  lastBrowserKokoroProgress = null
}

export function getActiveBrowserTTSBackend() {
  return activeBrowserBackend
}

export async function getBrowserKokoroCacheState(): Promise<'available' | 'missing' | 'unsupported'> {
  if (hasLocalTtsServer() || typeof caches === 'undefined') return 'unsupported'
  try {
    const cache = await caches.open('transformers-cache')
    const keys = await cache.keys()
    return keys.some((request) => {
      const url = decodeURIComponent(request.url)
      return url.includes('Kokoro-82M-v1.0-ONNX') && /model.*(?:fp16|q8|quantized).*\.onnx/i.test(url)
    }) ? 'available' : 'missing'
  } catch { return 'unsupported' }
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

function stopPlayback() {
  playbackGeneration += 1
  activePlaybackController?.abort()
  activePlaybackController = null
  pendingPlaybackRequests.forEach((controller) => controller.abort())
  pendingPlaybackRequests.clear()
  releaseAudio()
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

function terminateActiveBrowserWork() {
  if (!browserKokoroWorker || workerRequests.size === 0) return
  failWorker(new DOMException('Audio request cancelled', 'AbortError'))
  lastBrowserKokoroProgress = null
}

export function stopTTS() {
  stopPlayback()
  terminateActiveBrowserWork()
}

export function stopAllTTS() {
  stopPlayback()
  examPrecacheGeneration += 1
  examPrecacheController?.abort()
  examPrecacheController = null
  terminateActiveBrowserWork()
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

function chunkSpeechParts(parts: Array<{ text: string; speaker: number }>, maxLength = 120) {
  return parts.flatMap((part) => {
    if (part.text.length <= maxLength) return [part]
    const sentences = part.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((value) => value.trim()).filter(Boolean) || [part.text]
    const chunks: Array<{ text: string; speaker: number }> = []
    let current = ''
    for (const sentence of sentences) {
      if (current && current.length + sentence.length + 1 > maxLength) { chunks.push({ text: current, speaker: part.speaker }); current = '' }
      if (sentence.length <= maxLength) { current = current ? `${current} ${sentence}` : sentence; continue }
      for (const word of sentence.split(/\s+/)) {
        if (current && current.length + word.length + 1 > maxLength) { chunks.push({ text: current, speaker: part.speaker }); current = '' }
        current = current ? `${current} ${word}` : word
      }
    }
    if (current) chunks.push({ text: current, speaker: part.speaker })
    return chunks
  })
}

function reportBrowserKokoroProgress(message: string, detail: TTSProgressDetail) {
  lastBrowserKokoroProgress = { message, detail }
  browserKokoroProgressHandlers.forEach((handler) => handler(message, detail))
}

async function loadBrowserKokoro(onProgress: ProgressHandler, signal?: AbortSignal) {
  browserKokoroProgressHandlers.add(onProgress)
  try {
    if (!browserKokoroPromise) {
      const requestedBackend = resolveTTSBackend()
      reportBrowserKokoroProgress(`${requestedBackend === 'webgpu' ? 'WebGPU(Metal)' : 'WASM'}용 Kokoro 82M을 확인합니다…`, { phase: 'checking', percent: 0, backend: requestedBackend })
      browserKokoroPromise = (async () => {
        const cachedBeforeLoad = await getBrowserKokoroCacheState() === 'available'
        reportBrowserKokoroProgress(cachedBeforeLoad ? '저장된 Kokoro 82M을 브라우저 캐시에서 읽습니다…' : 'Kokoro 82M을 처음 다운로드합니다…', { phase: cachedBeforeLoad ? 'loading-cache' : 'downloading', percent: 0, cached: cachedBeforeLoad })
        const initializeBackend = async (backend: 'webgpu' | 'wasm') => {
          const worker = getBrowserKokoroWorker()
          const requestId = `init-${++workerRequestSequence}`
          await new Promise<void>((resolve, reject) => {
            workerRequests.set(requestId, { chunks: [], resolve: () => resolve(), reject })
            worker.postMessage({
              type: 'init',
              requestId,
              backend,
              wasmBaseUrl: new URL(`${import.meta.env.BASE_URL}ort/`, window.location.origin).href,
            })
          })
        }
        try { await initializeBackend(requestedBackend) }
        catch (error) {
          if (requestedBackend !== 'webgpu') throw error
          browserKokoroWorker?.terminate()
          browserKokoroWorker = null
          activeBrowserBackend = null
          reportBrowserKokoroProgress('WebGPU 초기화에 실패해 새 Worker에서 q8 WASM 호환 모드로 전환합니다…', { phase: 'initializing', percent: 0, backend: 'wasm' })
          await initializeBackend('wasm')
        }
        const backend = activeBrowserBackend || requestedBackend
        reportBrowserKokoroProgress(`Kokoro 82M ${backend === 'webgpu' ? 'WebGPU(Metal)' : 'WASM'} 초기화를 마쳤습니다.`, { phase: 'ready', percent: 100, cached: true, backend })
      })().catch((error) => {
        browserKokoroPromise = null
        lastBrowserKokoroProgress = null
        throw error
      })
    } else if (lastBrowserKokoroProgress) onProgress(lastBrowserKokoroProgress.message, lastBrowserKokoroProgress.detail)
    await browserKokoroPromise
    if (signal?.aborted) throw new DOMException('Audio preparation cancelled', 'AbortError')
  } finally { browserKokoroProgressHandlers.delete(onProgress) }
}

function failWorker(error: Error) {
  workerRequests.forEach((request) => request.reject(error))
  workerRequests.clear()
  browserKokoroWorker?.terminate()
  browserKokoroWorker = null
  browserKokoroPromise = null
  activeBrowserBackend = null
}

function getBrowserKokoroWorker() {
  if (browserKokoroWorker) return browserKokoroWorker
  const worker = new Worker(new URL('./tts.worker.ts', import.meta.url), { type: 'module', name: 'focus-english-kokoro' })
  worker.onmessage = (event: MessageEvent<{ type: string; requestId: string; blob?: Blob; index?: number; message?: string; percent?: number; loadedBytes?: number; totalBytes?: number; file?: string; backend?: 'webgpu' | 'wasm' }>) => {
    const message = event.data
    const request = workerRequests.get(message.requestId)
    if (message.type === 'progress') {
      const cached = lastBrowserKokoroProgress?.detail.cached === true
      const phase = cached ? 'loading-cache' : 'downloading'
      reportBrowserKokoroProgress(`${message.backend === 'webgpu' ? 'WebGPU(Metal)' : 'WASM'} ${cached ? '캐시 읽는 중' : '모델 다운로드 중'}… ${message.percent ?? 0}%`, { phase, percent: message.percent, loadedBytes: message.loadedBytes, totalBytes: message.totalBytes, file: message.file, cached, backend: message.backend })
      return
    }
    if (message.type === 'backend-fallback') {
      activeBrowserBackend = 'wasm'
      reportBrowserKokoroProgress('WebGPU 초기화에 실패해 q8 WASM 호환 모드로 전환합니다…', { phase: 'initializing', percent: 0, backend: 'wasm' })
      return
    }
    if (!request) return
    if (message.type === 'chunk' && message.blob) {
      request.chunks.push(message.blob)
      request.onChunk?.(message.blob, message.index ?? request.chunks.length - 1)
      return
    }
    workerRequests.delete(message.requestId)
    request.abort?.()
    if (message.type === 'ready' || message.type === 'done') {
      if (message.backend) activeBrowserBackend = message.backend
      request.resolve(request.chunks)
    }
    else if (message.type === 'cancelled') request.reject(new DOMException('Audio request cancelled', 'AbortError'))
    else request.reject(new Error(message.message || 'Kokoro Worker에서 음성을 만들지 못했습니다.'))
  }
  worker.onerror = () => failWorker(new Error('Kokoro 음성 Worker가 중단됐습니다.'))
  browserKokoroWorker = worker
  return worker
}

async function generateBrowserSpeech(parts: BrowserSpeechPart[], onProgress: ProgressHandler, signal: AbortSignal, onChunk?: (blob: Blob, index: number) => void) {
  await loadBrowserKokoro(onProgress, signal)
  if (signal.aborted) throw new DOMException('Audio request cancelled', 'AbortError')
  const worker = getBrowserKokoroWorker()
  const requestId = `speech-${++workerRequestSequence}`
  return new Promise<Blob[]>((resolve, reject) => {
    const abort = () => worker.postMessage({ type: 'cancel', requestId })
    signal.addEventListener('abort', abort, { once: true })
    workerRequests.set(requestId, {
      chunks: [],
      resolve,
      reject,
      onChunk: (blob, index) => {
        onProgress(`${activeBrowserBackend === 'webgpu' ? 'WebGPU(Metal)' : 'WASM'} 음성 스트리밍 중… ${index + 1}`, { phase: 'generating', cached: true, backend: activeBrowserBackend || undefined })
        onChunk?.(blob, index)
      },
      abort: () => signal.removeEventListener('abort', abort),
    })
    worker.postMessage({ type: 'generate', requestId, parts })
  })
}

function systemVoice() {
  const voices = window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith('en'))
  return voices.find((voice) => /samantha|ava|allison|zira|google us english/i.test(voice.name)) || voices.find((voice) => voice.lang.toLowerCase() === 'en-us') || voices[0]
}

function speakWithSystem(text: string, onProgress: ProgressHandler, signal: AbortSignal, generation: number) {
  return new Promise<void>((resolve, reject) => {
    if (!('speechSynthesis' in window)) { reject(new Error('이 브라우저는 음성 합성을 지원하지 않습니다.')); return }
    if (signal.aborted || generation !== playbackGeneration) { resolve(); return }
    const utterance = new SpeechSynthesisUtterance(text.replace(SPEAKER_RE, ' '))
    const voice = systemVoice()
    if (voice) utterance.voice = voice
    utterance.lang = voice?.lang || 'en-US'
    utterance.rate = .96
    utterance.pitch = 1
    let settled = false
    const cleanup = () => {
      utterance.onstart = null
      utterance.onend = null
      utterance.onerror = null
      signal.removeEventListener('abort', abort)
    }
    const finish = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }
    const abort = () => {
      window.speechSynthesis.cancel()
      finish()
    }
    signal.addEventListener('abort', abort, { once: true })
    utterance.onstart = () => {
      if (signal.aborted || generation !== playbackGeneration) { abort(); return }
      onProgress('재생 중…')
    }
    utterance.onend = finish
    utterance.onerror = () => {
      if (signal.aborted || generation !== playbackGeneration) { finish(); return }
      settled = true
      cleanup()
      reject(new Error('시스템 음성을 재생하지 못했습니다.'))
    }
    window.speechSynthesis.cancel()
    if (signal.aborted || generation !== playbackGeneration) { finish(); return }
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

export async function prepareTTS(profileId: VoiceProfileId, onProgress: ProgressHandler, signal?: AbortSignal): Promise<TTSPreparationResult> {
  const profile = getVoiceProfile(profileId)
  if (profile.id === 'system') {
    await prepareSystemVoices(onProgress)
    return { engine: 'system', fallback: false, voices: 1, clips: 0 }
  }
  if (!hasLocalTtsServer()) {
    await loadBrowserKokoro(onProgress, signal)
    const voices = new Set([profile.primary, profile.secondary].filter(Boolean)).size
    return { engine: 'kokoro', backend: activeBrowserBackend || resolveTTSBackend(), fallback: false, voices, clips: 0 }
  }
  onProgress('로컬 음성 서버를 확인하고 있습니다…')
  const response = await fetch('/api/tts/status', { signal })
  if (!response.ok) throw new Error('로컬 음성 서버에 연결하지 못했습니다.')
  const status = await response.json() as { state: 'idle' | 'loading' | 'ready' | 'error'; error?: string }
  if (status.state === 'error') throw new Error(status.error || '로컬 AI 음성 모델을 시작하지 못했습니다.')
  onProgress(status.state === 'ready' ? '로컬 AI 음성 서버가 준비됐습니다.' : 'AI 모델은 서버에서 백그라운드로 준비 중입니다.')
  const voices = new Set([profile.primary, profile.secondary].filter(Boolean)).size
  return { engine: 'kokoro', backend: 'server', fallback: false, voices, clips: 0 }
}

function speechKey(text: string, profile: VoiceProfile) {
  return `kokoro-q8-stream-v2:${profile.id}:${profile.primary || 'system'}:${profile.secondary || ''}:${text}`
}

async function synthesizeSpeech(text: string, profile: VoiceProfile, onProgress: ProgressHandler, signal: AbortSignal, onChunk?: (blob: Blob, index: number) => void) {
  const parts = chunkSpeechParts(splitSpeakers(text))
  if (!hasLocalTtsServer()) {
    return generateBrowserSpeech(parts.map((part) => ({
      text: part.text,
      voice: part.speaker % 2 === 1 && profile.secondary ? profile.secondary : profile.primary!,
    })), onProgress, signal, onChunk)
  }
  const blobs: Blob[] = []
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]
    onProgress(`서버 음성 불러오는 중… ${index + 1}/${parts.length}`)
    const voice = part.speaker % 2 === 1 && profile.secondary ? profile.secondary : profile.primary!
    if (signal.aborted) throw new DOMException('Audio request cancelled', 'AbortError')
    const response = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: part.text, voice, speed: 1 }), signal })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string }
      throw new Error(payload.error || '로컬 음성 서버에서 음성을 만들지 못했습니다.')
    }
    blobs.push(await response.blob())
  }
  return blobs
}

async function getSpeech(text: string, profile: VoiceProfile, onProgress: ProgressHandler, controller: AbortController, source: 'playback' | 'precache', onChunk?: (blob: Blob, index: number) => void) {
  const key = speechKey(text, profile)
  const cached = speechCache.get(key)
  if (cached) {
    speechCache.delete(key)
    speechCache.set(key, cached)
    return cached
  }
  if (!hasLocalTtsServer()) {
    const persisted = await readCachedSpeech(key)
    if (persisted?.length) {
      speechCache.set(key, persisted)
      return persisted
    }
  }
  const pending = pendingSpeech.get(key)
  if (pending) return pending
  if (source === 'playback') pendingPlaybackRequests.add(controller)
  const synthesis = synthesizeSpeech(text, profile, onProgress, controller.signal, onChunk).then(async (blobs) => {
      if (controller.signal.aborted) throw new DOMException('Audio request cancelled', 'AbortError')
      speechCache.set(key, blobs)
      while (speechCache.size > MAX_CACHED_SPEECHES) speechCache.delete(speechCache.keys().next().value!)
      if (!hasLocalTtsServer()) await cacheSpeech(key, blobs)
      return blobs
    }).finally(() => {
      pendingSpeech.delete(key)
      if (source === 'playback') pendingPlaybackRequests.delete(controller)
    })
  pendingSpeech.set(key, synthesis)
  return synthesis
}

export async function prepareExamTTS(texts: string[], profileId: VoiceProfileId, onProgress: ProgressHandler) {
  examPrecacheController?.abort()
  const controller = new AbortController()
  examPrecacheController = controller
  const result = await prepareTTS(profileId, onProgress, controller.signal)
  if (controller.signal.aborted) throw new DOMException('Audio preparation cancelled', 'AbortError')
  if (result.engine !== 'kokoro') return result
  const profile = getVoiceProfile(profileId)
  const uniqueTexts = [...new Set(texts.filter(Boolean))]
  const precacheTexts = hasLocalTtsServer() ? uniqueTexts : uniqueTexts.slice(0, 2)
  const generation = ++examPrecacheGeneration
  void (async () => {
    for (let index = 0; index < precacheTexts.length; index += 1) {
      if (generation !== examPrecacheGeneration || controller.signal.aborted) return
      await getSpeech(precacheTexts[index], profile, () => undefined, controller, 'precache')
    }
  })().catch(() => undefined).finally(() => { if (examPrecacheController === controller) examPrecacheController = null })
  return { ...result, clips: precacheTexts.length }
}

function playElement(audio: HTMLAudioElement, generation: number, signal: AbortSignal, onProgress: ProgressHandler) {
  return new Promise<void>((resolve, reject) => {
    if (generation !== playbackGeneration || signal.aborted) { resolve(); return }
    activeAudio = audio
    const abort = () => { audio.pause(); activeAudio = null; resolve() }
    signal.addEventListener('abort', abort, { once: true })
    audio.onplay = () => {
      if (generation !== playbackGeneration || signal.aborted) { abort(); return }
      onProgress('재생 중…', { phase: 'playing', percent: 100, cached: true })
    }
    audio.onended = () => { signal.removeEventListener('abort', abort); activeAudio = null; resolve() }
    audio.onerror = () => { signal.removeEventListener('abort', abort); activeAudio = null; reject(new Error('생성된 음성을 재생하지 못했습니다.')) }
    audio.play().catch(reject)
  })
}

async function speakWithKokoro(text: string, profile: VoiceProfile, onProgress: ProgressHandler, controller: AbortController, generation: number, maxWaitMs?: number) {
  const generationController = new AbortController()
  const cancelGeneration = () => generationController.abort()
  controller.signal.addEventListener('abort', cancelGeneration, { once: true })
  let streamedChunks = 0
  let firstChunkResolve: (() => void) | null = null
  const firstChunk = new Promise<void>((resolve) => { firstChunkResolve = resolve })
  let playbackChain = Promise.resolve()
  const queueChunk = (blob: Blob) => {
    streamedChunks += 1
    firstChunkResolve?.()
    firstChunkResolve = null
    playbackChain = playbackChain.then(async () => {
      if (controller.signal.aborted || generation !== playbackGeneration) return
      const url = URL.createObjectURL(blob)
      activeUrls.push(url)
      await playElement(new Audio(url), generation, controller.signal, onProgress)
    })
  }
  const speech = getSpeech(text, profile, onProgress, generationController, 'playback', queueChunk)
  if (maxWaitMs) {
    const startState = await Promise.race<'started' | 'complete' | 'timeout'>([
      firstChunk.then(() => 'started'),
      speech.then(() => 'complete'),
      new Promise<'timeout'>((resolve) => window.setTimeout(() => resolve('timeout'), maxWaitMs)),
    ])
    if (startState === 'timeout') {
      generationController.abort()
      void speech.catch(() => undefined)
      controller.signal.removeEventListener('abort', cancelGeneration)
      return false
    }
  }
  const blobs = await speech
  if (controller.signal.aborted || generation !== playbackGeneration) return
  if (!streamedChunks) {
    for (const blob of blobs) queueChunk(blob)
  }
  await playbackChain
  controller.signal.removeEventListener('abort', cancelGeneration)
  releaseAudio()
  return true
}

export async function playTTS(text: string, profileId: VoiceProfileId, onProgress: ProgressHandler, options: PlayOptions = {}) {
  stopPlayback()
  const controller = new AbortController()
  activePlaybackController = controller
  const profile = getVoiceProfile(profileId)
  const generation = playbackGeneration
  try {
    if (profile.id === 'system') {
      await speakWithSystem(text, onProgress, controller.signal, generation)
      if (controller.signal.aborted || generation !== playbackGeneration) return 'cancelled'
    }
    else {
      const played = await speakWithKokoro(text, profile, onProgress, controller, generation, options.maxWaitMs)
      if (controller.signal.aborted || generation !== playbackGeneration) return 'cancelled'
      if (played === false) {
        onProgress('AI 음성은 서버에서 계속 준비합니다. 이번에는 기기 음성으로 바로 재생합니다…')
        await speakWithSystem(text, onProgress, controller.signal, generation)
        if (controller.signal.aborted || generation !== playbackGeneration) return 'cancelled'
        return 'fallback'
      }
    }
    if (generation !== playbackGeneration) return 'cancelled'
    return 'completed'
  } catch (error) {
    if (generation !== playbackGeneration || controller.signal.aborted) return 'cancelled'
    if (profile.id !== 'system') {
      onProgress('AI 음성을 사용할 수 없어 시스템 음성으로 전환합니다…')
      await speakWithSystem(text, onProgress, controller.signal, generation)
      if (controller.signal.aborted || generation !== playbackGeneration) return 'cancelled'
      return 'fallback'
    }
    throw error
  } finally {
    if (activePlaybackController === controller) activePlaybackController = null
  }
}
