import { cacheSpeech, readCachedSpeech } from './ttsAudioCache'
import { recordTTSDiagnostic } from './ttsDiagnostics'
import { applyQuestionRise, splitQuestionProsody, type SpeechIntonation } from './ttsProsody'

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

export type ExamTTSPrecacheState = {
  status: 'idle' | 'preparing' | 'ready' | 'error'
  completed: number
  total: number
  current: number
  percent: number
  message: string
}

export type TTSBackendPreference = 'auto' | 'webgpu' | 'wasm'
export type TTSRuntimeInfo = { runtime: 'native-webgpu-ep' | 'wasm'; runtimeVariant: 'standard' | 'asyncify'; ortVersion: string; dtype: string; threads: number }

export const VOICE_PROFILES: VoiceProfile[] = [
  { id: 'toefl-balanced', name: 'TOEFL 균형형', shortLabel: 'AI · 미국식 혼합', description: '대화에서는 여성·남성 화자를 자동으로 나누고, 강의에서는 자연스러운 미국식 음성을 사용합니다.', accent: '미국식 · 여성/남성', primary: 'af_heart', secondary: 'am_michael', recommended: true },
  { id: 'us-female', name: 'Heart', shortLabel: 'AI · 미국 여성 중심', description: 'Heart를 주 화자로 사용하고 대화 상대는 Michael로 자동 구분합니다.', accent: '미국식 · 여성 중심/남성 상대', primary: 'af_heart', secondary: 'am_michael' },
  { id: 'us-male', name: 'Michael', shortLabel: 'AI · 미국 남성 중심', description: 'Michael을 주 화자로 사용하고 대화 상대는 Heart로 자동 구분합니다.', accent: '미국식 · 남성 중심/여성 상대', primary: 'am_michael', secondary: 'af_heart' },
  { id: 'uk-female', name: 'Emma', shortLabel: 'AI · 영국 여성 중심', description: 'Emma를 주 화자로 사용하고 대화 상대는 George로 자동 구분합니다.', accent: '영국식 · 여성 중심/남성 상대', primary: 'bf_emma', secondary: 'bm_george' },
  { id: 'uk-male', name: 'George', shortLabel: 'AI · 영국 남성 중심', description: 'George를 주 화자로 사용하고 대화 상대는 Emma로 자동 구분합니다.', accent: '영국식 · 남성 중심/여성 상대', primary: 'bm_george', secondary: 'bf_emma' },
  { id: 'system', name: '기기 기본 음성', shortLabel: '시스템 영어 음성', description: '모델 다운로드 없이 기기에 설치된 영어 음성을 사용합니다. AI 음성이 작동하지 않을 때의 안전한 대안입니다.', accent: '기기별로 다름' },
]

const PROFILE_BY_ID = new Map(VOICE_PROFILES.map((profile) => [profile.id, profile]))
const STORAGE_KEY = 'focus-english-lab:voice-profile:v1'
const BACKEND_STORAGE_KEY = 'focus-english-lab:tts-backend:v1'
const DEFAULT_PROFILE: VoiceProfileId = 'toefl-balanced'
const SPEAKER_RE = /(?:^|\s)([A-Z][A-Za-z .'-]{0,47}):\s*/g

type ProgressHandler = (message: string, detail?: TTSProgressDetail) => void
export type SpeechMode = 'dialogue' | 'sentence'
export type ExamTTSAudio = { text: string; speechMode: SpeechMode }
type PlayOptions = { maxWaitMs?: number; speechMode?: SpeechMode }
type BrowserSpeechPart = { text: string; voice: string; intonation: SpeechIntonation }
type WorkerRequest = {
  chunks: Blob[]
  resolve: (blobs: Blob[]) => void
  reject: (error: Error) => void
  onProgress?: ProgressHandler
  onChunk?: (blob: Blob, index: number) => void
  abort?: () => void
}
let activeAudio: HTMLAudioElement | null = null
let unlockedAudio: HTMLAudioElement | null = null
let silentUnlockUrl: string | null = null
let activeUrls: string[] = []
let playbackGeneration = 0
const speechCache = new Map<string, Blob[]>()
const MAX_CACHED_SPEECHES = 24
let examPrecacheGeneration = 0
let activePlaybackController: AbortController | null = null
let examPrecacheController: AbortController | null = null
let examPrecacheState: ExamTTSPrecacheState = { status: 'idle', completed: 0, total: 0, current: 0, percent: 0, message: '' }
const examPrecacheListeners = new Set<(state: ExamTTSPrecacheState) => void>()
const pendingPlaybackRequests = new Set<AbortController>()
const pendingSpeech = new Map<string, Promise<Blob[]>>()
let browserKokoroWorker: Worker | null = null
let browserKokoroPromise: Promise<void> | null = null
const browserKokoroProgressHandlers = new Set<ProgressHandler>()
let lastBrowserKokoroProgress: { message: string; detail: TTSProgressDetail } | null = null
const workerRequests = new Map<string, WorkerRequest>()
let workerRequestSequence = 0
let activeBrowserBackend: 'webgpu' | 'wasm' | null = null
let activeBrowserRuntimeInfo: TTSRuntimeInfo | null = null
let lastBrowserBackendFallbackReason = ''

export function hasLocalTtsServer() {
  if (new URLSearchParams(window.location.search).get('tts-runtime') === 'browser') return false
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
}

export function browserSupportsWebGPU() {
  return typeof navigator !== 'undefined' && 'gpu' in navigator && window.isSecureContext
}

export function isIOSBrowser() {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function debugWasmThreadOverride() {
  if (typeof window === 'undefined' || !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)) return undefined
  const value = Number(new URLSearchParams(window.location.search).get('tts-threads'))
  return Number.isInteger(value) && value >= 1 && value <= 4 ? value : undefined
}

export function loadTTSBackendPreference(): TTSBackendPreference {
  try {
    const stored = localStorage.getItem(BACKEND_STORAGE_KEY)
    return stored === 'webgpu' || stored === 'wasm' ? stored : 'auto'
  } catch { return 'auto' }
}

export function resolveTTSBackend(preference = loadTTSBackendPreference()): 'webgpu' | 'wasm' {
  if (preference === 'wasm') return 'wasm'
  if (preference === 'webgpu') return browserSupportsWebGPU() ? 'webgpu' : 'wasm'
  return !isIOSBrowser() && browserSupportsWebGPU() ? 'webgpu' : 'wasm'
}

export function saveTTSBackendPreference(preference: TTSBackendPreference) {
  try { localStorage.setItem(BACKEND_STORAGE_KEY, preference) } catch { /* Storage may be disabled. */ }
  stopAllTTS()
  if (browserKokoroWorker) failWorker(new DOMException('TTS backend changed', 'AbortError'))
  activeBrowserBackend = null
  activeBrowserRuntimeInfo = null
  lastBrowserBackendFallbackReason = ''
  lastBrowserKokoroProgress = null
}

export function getActiveBrowserTTSBackend() {
  return activeBrowserBackend
}

export function getBrowserTTSRuntimeInfo() {
  return activeBrowserRuntimeInfo
}

export function getBrowserTTSFallbackReason() {
  return lastBrowserBackendFallbackReason
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

function createSilentWavUrl() {
  if (silentUnlockUrl) return silentUnlockUrl
  const sampleCount = 240
  const bytes = new Uint8Array(44 + sampleCount)
  const view = new DataView(bytes.buffer)
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) bytes[offset + index] = value.charCodeAt(index)
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + sampleCount, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, 24_000, true)
  view.setUint32(28, 24_000, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  write(36, 'data')
  view.setUint32(40, sampleCount, true)
  bytes.fill(128, 44)
  silentUnlockUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
  return silentUnlockUrl
}

// Safari requires play() to happen in the original tap handler. Reusing that
// same element lets an asynchronously generated Kokoro chunk start later.
function primeIOSAudioElement() {
  if (!isIOSBrowser() || !navigator.userActivation?.isActive) return null
  const audio = unlockedAudio || new Audio()
  unlockedAudio = audio
  audio.setAttribute('playsinline', '')
  audio.preload = 'auto'
  const unlockUrl = createSilentWavUrl()
  audio.src = unlockUrl
  audio.volume = 0
  void audio.play().then(() => {
    // A cached clip can replace the silent source almost immediately. Do not
    // let the unlock promise pause that real clip when the two overlap.
    if (audio.src === unlockUrl || audio.currentSrc === unlockUrl) {
      audio.pause()
      audio.currentTime = 0
    }
    audio.volume = 1
    recordTTSDiagnostic({ source: 'app', stage: 'audio-unlocked', message: '사용자 탭으로 iOS 오디오 재생 권한을 준비했습니다.' })
  }).catch((error) => {
    audio.volume = 1
    recordTTSDiagnostic({ source: 'app', stage: 'audio-unlock-error', message: error instanceof Error ? error.message : String(error) })
  })
  return audio
}

export function primeTTSPlayback() {
  primeIOSAudioElement()
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

function cancelActiveBrowserWork() {
  if (!browserKokoroWorker || workerRequests.size === 0) return
  const error = new DOMException('Audio request cancelled', 'AbortError')
  for (const [requestId, request] of workerRequests) {
    // Let model initialization finish, but detach speech immediately. Killing a
    // multi-threaded ORT Worker mid-run makes iOS WebKit kill the next WASM
    // Worker created in the same page. Detached chunks can never reach audio.
    if (requestId.startsWith('init-')) continue
    browserKokoroWorker.postMessage({ type: 'cancel', requestId })
    request.abort?.()
    request.reject(error)
    workerRequests.delete(requestId)
  }
  recordTTSDiagnostic({ source: 'app', stage: 'work-cancelled', message: '재생 요청을 분리하고 진행 중인 결과를 폐기합니다.' })
}

export function stopTTS() {
  recordTTSDiagnostic({ source: 'app', stage: 'stop', message: '현재 TTS 재생 요청을 중지합니다.' })
  stopPlayback()
}

export function stopAllTTS() {
  stopPlayback()
  examPrecacheGeneration += 1
  examPrecacheController?.abort()
  examPrecacheController = null
  cancelActiveBrowserWork()
  reportExamPrecache({ status: 'idle', completed: 0, total: 0, current: 0, percent: 0, message: '' })
}

function reportExamPrecache(state: ExamTTSPrecacheState) {
  examPrecacheState = state
  examPrecacheListeners.forEach((listener) => listener(state))
}

export function getExamTTSPrecacheState() {
  return examPrecacheState
}

export function subscribeExamTTSPrecache(listener: (state: ExamTTSPrecacheState) => void) {
  examPrecacheListeners.add(listener)
  listener(examPrecacheState)
  return () => { examPrecacheListeners.delete(listener) }
}

export function splitSpeakers(text: string) {
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

export function normalizeSentenceTTSInput(text: string) {
  return text.replace(/\r\n?/g, '\n').split(/\n+/).map((line) => line.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

export function examSpeechMode(section: 'listening' | 'speaking', title: string): SpeechMode {
  if (section === 'speaking' || title === 'Listen and Choose a Response') return 'sentence'
  return 'dialogue'
}

function chunkSpeechParts<T extends { text: string; speaker: number }>(parts: T[], maxLength = 120): T[] {
  return parts.flatMap((part) => {
    if (part.text.length <= maxLength) return [part]
    const sentences = part.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((value) => value.trim()).filter(Boolean) || [part.text]
    const chunks: T[] = []
    let current = ''
    for (const sentence of sentences) {
      if (current && current.length + sentence.length + 1 > maxLength) { chunks.push({ ...part, text: current }); current = '' }
      if (sentence.length <= maxLength) { current = current ? `${current} ${sentence}` : sentence; continue }
      for (const word of sentence.split(/\s+/)) {
        if (current && current.length + word.length + 1 > maxLength) { chunks.push({ ...part, text: current }); current = '' }
        current = current ? `${current} ${word}` : word
      }
    }
    if (current) chunks.push({ ...part, text: current })
    return chunks
  })
}

function stableParity(text: string) {
  let hash = 0
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) | 0
  return Math.abs(hash) % 2
}

export function selectSpeechVoice(profile: VoiceProfile, fullText: string, speaker: number) {
  const offset = profile.id === 'toefl-balanced' ? stableParity(fullText) : 0
  return profile.secondary && (speaker + offset) % 2 === 1 ? profile.secondary : profile.primary!
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
      recordTTSDiagnostic({ source: 'app', stage: 'backend-selected', message: `${requestedBackend} 백엔드를 요청했습니다.`, backend: requestedBackend, detail: { preference: loadTTSBackendPreference(), webgpuAdvertised: browserSupportsWebGPU() } })
      reportBrowserKokoroProgress(`${requestedBackend === 'webgpu' ? 'WebGPU(Metal)' : 'WASM'}용 Kokoro 82M을 확인합니다…`, { phase: 'checking', percent: 0, backend: requestedBackend })
      browserKokoroPromise = (async () => {
        const cachedBeforeLoad = await getBrowserKokoroCacheState() === 'available'
        reportBrowserKokoroProgress(cachedBeforeLoad ? '저장된 Kokoro 82M을 브라우저 캐시에서 읽습니다…' : 'Kokoro 82M을 처음 다운로드합니다…', { phase: cachedBeforeLoad ? 'loading-cache' : 'downloading', percent: 0, cached: cachedBeforeLoad })
        const initializeBackend = async (backend: 'webgpu' | 'wasm') => {
          const worker = getBrowserKokoroWorker()
          const requestId = `init-${++workerRequestSequence}`
          recordTTSDiagnostic({ source: 'app', stage: 'init-posted', message: `${backend} 초기화 요청을 Worker에 보냈습니다.`, requestId, backend })
          await new Promise<void>((resolve, reject) => {
            workerRequests.set(requestId, { chunks: [], resolve: () => resolve(), reject })
            worker.postMessage({
              type: 'init',
              requestId,
              backend,
              threads: debugWasmThreadOverride(),
              wasmBaseUrl: new URL(`${import.meta.env.BASE_URL}ort/`, window.location.origin).href,
            })
          })
        }
        try { await initializeBackend(requestedBackend) }
        catch (error) {
          if (requestedBackend !== 'webgpu') throw error
          lastBrowserBackendFallbackReason = error instanceof Error ? error.message : String(error)
          recordTTSDiagnostic({ source: 'app', stage: 'backend-fallback', message: lastBrowserBackendFallbackReason, backend: 'wasm', detail: { requestedBackend } })
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
  recordTTSDiagnostic({ source: 'app', stage: 'worker-terminated', message: error.message, detail: { pendingRequests: workerRequests.size } })
  workerRequests.forEach((request) => request.reject(error))
  workerRequests.clear()
  browserKokoroWorker?.terminate()
  browserKokoroWorker = null
  browserKokoroPromise = null
  activeBrowserBackend = null
  activeBrowserRuntimeInfo = null
}

function getBrowserKokoroWorker() {
  if (browserKokoroWorker) return browserKokoroWorker
  const worker = new Worker(new URL('./tts.worker.ts', import.meta.url), { type: 'module', name: 'focus-english-kokoro' })
  worker.onmessage = (event: MessageEvent<{ type: string; requestId: string; blob?: Blob; index?: number; message?: string; stage?: string; elapsedMs?: number; detail?: Record<string, unknown>; percent?: number; completedParts?: number; totalParts?: number; loadedBytes?: number; totalBytes?: number; file?: string; backend?: 'webgpu' | 'wasm'; dtype?: string; runtime?: 'native-webgpu-ep' | 'wasm'; runtimeVariant?: 'standard' | 'asyncify'; ortVersion?: string; threads?: number }>) => {
    const message = event.data
    const request = workerRequests.get(message.requestId)
    if (message.type === 'diagnostic') {
      recordTTSDiagnostic({ source: 'worker', stage: message.stage || 'worker-event', message: message.message || 'Worker 진단 이벤트', requestId: message.requestId, backend: message.backend, elapsedMs: message.elapsedMs, detail: message.detail })
      return
    }
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
    if (message.type === 'backend-info') {
      if (message.runtime && message.runtimeVariant && message.ortVersion) activeBrowserRuntimeInfo = { runtime: message.runtime, runtimeVariant: message.runtimeVariant, ortVersion: message.ortVersion, dtype: message.dtype || 'unknown', threads: message.threads || 1 }
      reportBrowserKokoroProgress(`${message.backend === 'webgpu' ? 'Native WebGPU' : 'WASM'} ${message.dtype || '모델'}을 초기화합니다…`, { phase: 'initializing', percent: 0, backend: message.backend })
      recordTTSDiagnostic({ source: 'app', stage: 'backend-info', message: `${message.backend} · ${message.runtimeVariant} · ${message.dtype} · ${message.threads || 1} threads`, requestId: message.requestId, backend: message.backend, detail: { runtime: message.runtime, ortVersion: message.ortVersion, crossOriginIsolated: self.crossOriginIsolated } })
      return
    }
    if (!request) return
    if (message.type === 'generation-progress') {
      request.onProgress?.(`연속 음성 변환 중… ${message.completedParts ?? 0}/${message.totalParts ?? 0}`, { phase: 'generating', percent: message.percent, backend: activeBrowserBackend || undefined })
      return
    }
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
  worker.onerror = (event) => {
    const location = event.filename ? ` (${event.filename.split('/').pop()}:${event.lineno || 0}:${event.colno || 0})` : ''
    failWorker(new Error(`${event.message || 'Kokoro 음성 Worker가 중단됐습니다.'}${location}`))
  }
  browserKokoroWorker = worker
  return worker
}

async function generateBrowserSpeech(parts: BrowserSpeechPart[], onProgress: ProgressHandler, signal: AbortSignal, onChunk?: (blob: Blob, index: number) => void) {
  await loadBrowserKokoro(onProgress, signal)
  if (signal.aborted) throw new DOMException('Audio request cancelled', 'AbortError')
  const worker = getBrowserKokoroWorker()
  const requestId = `speech-${++workerRequestSequence}`
  const requestStartedAt = performance.now()
  recordTTSDiagnostic({ source: 'app', stage: 'generation-posted', message: `Worker에 ${parts.length}개 텍스트 조각을 보냈습니다.`, requestId, backend: activeBrowserBackend || undefined, detail: { characters: parts.reduce((sum, part) => sum + part.text.length, 0) } })
  return new Promise<Blob[]>((resolve, reject) => {
    const waitingTimer = window.setInterval(() => {
      recordTTSDiagnostic({ source: 'app', stage: 'generation-waiting', message: `첫 오디오 조각을 ${Math.round((performance.now() - requestStartedAt) / 1000)}초째 기다리고 있습니다.`, requestId, backend: activeBrowserBackend || undefined })
    }, 10_000)
    const finish = <T,>(callback: (value: T) => void) => (value: T) => { window.clearInterval(waitingTimer); callback(value) }
    const abort = () => worker.postMessage({ type: 'cancel', requestId })
    signal.addEventListener('abort', abort, { once: true })
    workerRequests.set(requestId, {
      chunks: [],
      resolve: finish(resolve),
      reject: finish(reject),
      onProgress,
      onChunk: (blob, index) => {
        onProgress(`${activeBrowserBackend === 'webgpu' ? 'WebGPU(Metal)' : 'WASM'} 연속 음성을 완성했습니다.`, { phase: 'generating', cached: true, backend: activeBrowserBackend || undefined })
        onChunk?.(blob, index)
      },
      abort: () => signal.removeEventListener('abort', abort),
    })
    worker.postMessage({ type: 'generate', requestId, parts })
  })
}

function systemVoicePair() {
  const voices = window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith('en'))
  const female = voices.find((voice) => /samantha|ava|allison|zira|victoria|serena|karen|moira|tessa|google us english/i.test(voice.name))
  const male = voices.find((voice) => /daniel|alex|tom|fred|aaron|gordon|arthur|oliver|rishi/i.test(voice.name))
  const primary = female || voices.find((voice) => voice.lang.toLowerCase() === 'en-us') || voices[0]
  const secondary = male || voices.find((voice) => voice !== primary) || primary
  return [primary, secondary]
}

function speakSystemPart(text: string, voice: SpeechSynthesisVoice | undefined, onProgress: ProgressHandler, signal: AbortSignal, generation: number) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted || generation !== playbackGeneration) { resolve(); return }
    const utterance = new SpeechSynthesisUtterance(text)
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

async function speakWithSystem(text: string, speechMode: SpeechMode, onProgress: ProgressHandler, signal: AbortSignal, generation: number) {
  if (!('speechSynthesis' in window)) throw new Error('이 브라우저는 음성 합성을 지원하지 않습니다.')
  const voices = systemVoicePair()
  const parts = speechMode === 'sentence' ? [{ text: normalizeSentenceTTSInput(text), speaker: 0 }] : splitSpeakers(text)
  window.speechSynthesis.cancel()
  for (const part of parts) {
    if (signal.aborted || generation !== playbackGeneration) return
    await speakSystemPart(part.text, voices[part.speaker % 2], onProgress, signal, generation)
  }
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

function speechKey(text: string, profile: VoiceProfile, speechMode: SpeechMode) {
  return `kokoro-q8-prosody-v5:${hasLocalTtsServer() ? 'server' : 'browser'}:${speechMode}:${profile.id}:${profile.primary || 'system'}:${profile.secondary || ''}:${text}`
}

function encodeFloatWav(samples: Float32Array, sampleRate: number) {
  const bytes = new Uint8Array(44 + samples.byteLength)
  const view = new DataView(bytes.buffer)
  const write = (offset: number, value: string) => { for (let index = 0; index < value.length; index += 1) bytes[offset + index] = value.charCodeAt(index) }
  write(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); write(8, 'WAVE'); write(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 3, true); view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 32, true)
  write(36, 'data'); view.setUint32(40, samples.byteLength, true)
  new Float32Array(bytes.buffer, 44).set(samples)
  return new Blob([bytes], { type: 'audio/wav' })
}

async function applyQuestionRiseToWav(blob: Blob) {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  let offset = 12
  let format = 0
  let channels = 0
  let sampleRate = 0
  let bits = 0
  let dataOffset = 0
  let dataSize = 0
  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(...bytes.slice(offset, offset + 4))
    const size = view.getUint32(offset + 4, true)
    if (id === 'fmt ' && size >= 16) {
      format = view.getUint16(offset + 8, true); channels = view.getUint16(offset + 10, true)
      sampleRate = view.getUint32(offset + 12, true); bits = view.getUint16(offset + 22, true)
    }
    if (id === 'data') { dataOffset = offset + 8; dataSize = Math.min(size, bytes.length - dataOffset); break }
    offset += 8 + size + (size % 2)
  }
  if (!dataOffset || channels !== 1 || !sampleRate) return blob
  let samples: Float32Array
  if (format === 3 && bits === 32) samples = new Float32Array(buffer.slice(dataOffset, dataOffset + dataSize))
  else if (format === 1 && bits === 16) {
    const count = Math.floor(dataSize / 2)
    samples = new Float32Array(count)
    for (let index = 0; index < count; index += 1) samples[index] = view.getInt16(dataOffset + index * 2, true) / 32768
  } else return blob
  return encodeFloatWav(applyQuestionRise(samples, sampleRate), sampleRate)
}

async function mergeWavBlobs(blobs: Blob[]) {
  if (blobs.length <= 1) return blobs[0]
  const buffers = await Promise.all(blobs.map((blob) => blob.arrayBuffer()))
  const parsed = buffers.map((buffer) => {
    const bytes = new Uint8Array(buffer)
    const view = new DataView(buffer)
    let offset = 12
    while (offset + 8 <= bytes.length) {
      const id = String.fromCharCode(...bytes.slice(offset, offset + 4))
      const size = view.getUint32(offset + 4, true)
      if (id === 'data' && offset + 8 + size <= bytes.length) {
        return { bytes, dataOffset: offset + 8, dataSizeOffset: offset + 4, dataSize: size }
      }
      offset += 8 + size + (size % 2)
    }
    throw new Error('로컬 WAV 데이터 구간을 찾지 못했습니다.')
  })
  const first = parsed[0]
  const totalDataSize = parsed.reduce((sum, value) => sum + value.dataSize, 0)
  const merged = new Uint8Array(first.dataOffset + totalDataSize)
  merged.set(first.bytes.slice(0, first.dataOffset))
  let writeOffset = first.dataOffset
  for (const value of parsed) {
    merged.set(value.bytes.slice(value.dataOffset, value.dataOffset + value.dataSize), writeOffset)
    writeOffset += value.dataSize
  }
  const mergedView = new DataView(merged.buffer)
  mergedView.setUint32(4, merged.byteLength - 8, true)
  mergedView.setUint32(first.dataSizeOffset, totalDataSize, true)
  return new Blob([merged], { type: 'audio/wav' })
}

async function synthesizeSpeech(text: string, profile: VoiceProfile, speechMode: SpeechMode, onProgress: ProgressHandler, signal: AbortSignal, onChunk?: (blob: Blob, index: number) => void) {
  // Keep complete utterances together. The Worker may split exceptionally long
  // input for the model, but it joins all PCM output into one WAV before play.
  const normalizedText = speechMode === 'sentence' ? normalizeSentenceTTSInput(text) : text
  const speakerParts = speechMode === 'sentence' ? [{ text: normalizedText, speaker: 0 }] : splitSpeakers(normalizedText)
  const parts = chunkSpeechParts(splitQuestionProsody(speakerParts), 400)
  if (!hasLocalTtsServer()) {
    return generateBrowserSpeech(parts.map((part) => ({
      text: part.text,
      voice: selectSpeechVoice(profile, normalizedText, part.speaker),
      intonation: part.intonation,
    })), onProgress, signal, onChunk)
  }
  const blobs: Blob[] = []
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]
    onProgress(`서버 음성 불러오는 중… ${index + 1}/${parts.length}`)
    const voice = selectSpeechVoice(profile, normalizedText, part.speaker)
    if (signal.aborted) throw new DOMException('Audio request cancelled', 'AbortError')
    const response = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: part.text, voice, speed: 1 }), signal })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string }
      throw new Error(payload.error || '로컬 음성 서버에서 음성을 만들지 못했습니다.')
    }
    const blob = await response.blob()
    blobs.push(part.intonation === 'question' ? await applyQuestionRiseToWav(blob) : blob)
  }
  return [await mergeWavBlobs(blobs)]
}

async function getSpeech(text: string, profile: VoiceProfile, speechMode: SpeechMode, onProgress: ProgressHandler, controller: AbortController, source: 'playback' | 'precache', onChunk?: (blob: Blob, index: number) => void) {
  const key = speechKey(text, profile, speechMode)
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
  const synthesis = synthesizeSpeech(text, profile, speechMode, onProgress, controller.signal, onChunk).then(async (blobs) => {
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

export async function prepareExamTTS(audio: ExamTTSAudio[], profileId: VoiceProfileId, onProgress: ProgressHandler) {
  examPrecacheController?.abort()
  const controller = new AbortController()
  examPrecacheController = controller
  const result = await prepareTTS(profileId, onProgress, controller.signal)
  if (controller.signal.aborted) throw new DOMException('Audio preparation cancelled', 'AbortError')
  if (result.engine !== 'kokoro') {
    reportExamPrecache({ status: 'ready', completed: 0, total: 0, current: 0, percent: 100, message: '기기 영어 음성이 준비됐습니다.' })
    return result
  }
  const profile = getVoiceProfile(profileId)
  const uniqueAudio = new Map<string, ExamTTSAudio>()
  for (const entry of audio) {
    if (!entry.text) continue
    uniqueAudio.set(`${entry.speechMode}\u0000${entry.text}`, entry)
  }
  const precacheAudio = [...uniqueAudio.values()]
  const generation = ++examPrecacheGeneration
  reportExamPrecache({ status: precacheAudio.length ? 'preparing' : 'ready', completed: 0, total: precacheAudio.length, current: 0, percent: precacheAudio.length ? 0 : 100, message: precacheAudio.length ? `시험 음성 0/${precacheAudio.length} 변환 준비` : '변환할 시험 음성이 없습니다.' })
  try {
    for (let index = 0; index < precacheAudio.length; index += 1) {
      if (generation !== examPrecacheGeneration || controller.signal.aborted) throw new DOMException('Audio preparation cancelled', 'AbortError')
      const total = precacheAudio.length
      const entry = precacheAudio[index]
      reportExamPrecache({ status: 'preparing', completed: index, total, current: index + 1, percent: Math.round(index / total * 100), message: `시험 음성 ${index + 1}/${total} 변환 중` })
      await getSpeech(entry.text, profile, entry.speechMode, (_message, detail) => {
        if (generation !== examPrecacheGeneration || controller.signal.aborted) return
        const itemProgress = detail?.phase === 'generating' && detail.percent !== undefined ? detail.percent / 100 : 0
        reportExamPrecache({ status: 'preparing', completed: index, total, current: index + 1, percent: Math.min(99, Math.round((index + itemProgress) / total * 100)), message: `시험 음성 ${index + 1}/${total} 변환 중` })
      }, controller, 'precache')
      reportExamPrecache({ status: index + 1 === total ? 'ready' : 'preparing', completed: index + 1, total, current: Math.min(index + 2, total), percent: Math.round((index + 1) / total * 100), message: index + 1 === total ? `시험 음성 ${total}개를 모두 준비했습니다.` : `시험 음성 ${index + 1}/${total} 준비 완료` })
    }
  } catch (error) {
    if (generation !== examPrecacheGeneration || controller.signal.aborted) throw error
    reportExamPrecache({ ...examPrecacheState, status: 'error', message: error instanceof Error ? error.message : '시험 음성을 미리 변환하지 못했습니다.' })
    throw error
  } finally {
    if (examPrecacheController === controller) examPrecacheController = null
  }
  return { ...result, clips: precacheAudio.length }
}

export async function prepareSpeech(text: string, profileId: VoiceProfileId, speechMode: SpeechMode, onProgress: ProgressHandler, signal?: AbortSignal) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const result = await prepareTTS(profileId, onProgress, controller.signal)
    if (result.engine === 'kokoro') {
      await getSpeech(text, getVoiceProfile(profileId), speechMode, onProgress, controller, 'precache')
    }
    if (controller.signal.aborted) throw new DOMException('Audio preparation cancelled', 'AbortError')
    return result
  } finally {
    signal?.removeEventListener('abort', abort)
  }
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

async function speakWithKokoro(text: string, profile: VoiceProfile, speechMode: SpeechMode, onProgress: ProgressHandler, controller: AbortController, generation: number, maxWaitMs?: number, playbackAudio?: HTMLAudioElement | null) {
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
      const audio = playbackAudio || new Audio()
      audio.src = url
      audio.volume = 1
      audio.load()
      await playElement(audio, generation, controller.signal, onProgress)
    })
  }
  const speech = getSpeech(text, profile, speechMode, onProgress, generationController, 'playback', queueChunk)
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
  const primedAudio = primeIOSAudioElement()
  const controller = new AbortController()
  activePlaybackController = controller
  const profile = getVoiceProfile(profileId)
  const speechMode = options.speechMode || 'dialogue'
  const generation = playbackGeneration
  try {
    if (profile.id === 'system') {
      await speakWithSystem(text, speechMode, onProgress, controller.signal, generation)
      if (controller.signal.aborted || generation !== playbackGeneration) return 'cancelled'
    }
    else {
      const played = await speakWithKokoro(text, profile, speechMode, onProgress, controller, generation, options.maxWaitMs, primedAudio)
      if (controller.signal.aborted || generation !== playbackGeneration) return 'cancelled'
      if (played === false) {
        onProgress('AI 음성은 서버에서 계속 준비합니다. 이번에는 기기 음성으로 바로 재생합니다…')
        await speakWithSystem(text, speechMode, onProgress, controller.signal, generation)
        if (controller.signal.aborted || generation !== playbackGeneration) return 'cancelled'
        return 'fallback'
      }
    }
    if (generation !== playbackGeneration) return 'cancelled'
    return 'completed'
  } catch (error) {
    if (generation !== playbackGeneration || controller.signal.aborted) return 'cancelled'
    if (profile.id !== 'system') {
      const message = error instanceof Error ? error.message : String(error)
      recordTTSDiagnostic({ source: 'app', stage: 'playback-error', message, backend: activeBrowserBackend || undefined })
      onProgress(`AI 음성을 사용할 수 없어 시스템 음성으로 전환합니다… (${message})`)
      await speakWithSystem(text, speechMode, onProgress, controller.signal, generation)
      if (controller.signal.aborted || generation !== playbackGeneration) return 'cancelled'
      return 'fallback'
    }
    throw error
  } finally {
    if (activePlaybackController === controller) activePlaybackController = null
  }
}
