import { uploadClientErrorLog, watchCloudUserForLogging } from './cloudSync'
import { getTTSDiagnostics, subscribeTTSDiagnostics, type TTSDiagnosticEvent } from './ttsDiagnostics'
import { APP_VERSION } from './version'

export type ClientErrorKind = 'window-error' | 'unhandled-rejection' | 'react-error' | 'tts-error'

export type ClientErrorLog = {
  schemaVersion: 1
  kind: ClientErrorKind
  name: string
  message: string
  stack: string
  route: string
  appVersion: string
  userAgent: string
  platform: string
  online: boolean
  visibility: string
  clientAt: string
  context: Record<string, string | number | boolean>
  ttsEvents: Array<{ at: string; elapsedMs: number; source: string; stage: string; message: string; requestId?: string; backend?: string }>
}

const QUEUE_KEY = 'focus-english-lab:error-log-queue:v1'
const MAX_QUEUE = 20
const MAX_EVENTS_PER_TEN_MINUTES = 30
const DEDUPE_MS = 60_000
const recentFingerprints = new Map<string, number>()
let recentUploads: number[] = []
let queue: ClientErrorLog[] = []
let flushing = false
let installed = false

function limit(value: unknown, max: number) {
  const text = value instanceof Error ? value.message : typeof value === 'string' ? value : String(value ?? '')
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max)
}

function route() {
  if (typeof location === 'undefined') return ''
  return `${location.pathname}${location.hash.split('?')[0]}`.slice(0, 300)
}

function safeTtsEvents(events: TTSDiagnosticEvent[]) {
  return events.slice(-20).map((event) => ({
    at: event.at,
    elapsedMs: event.elapsedMs,
    source: event.source,
    stage: limit(event.stage, 100),
    message: limit(event.message, 800),
    ...(event.requestId ? { requestId: limit(event.requestId, 120) } : {}),
    ...(event.backend ? { backend: event.backend } : {}),
  }))
}

function readQueue() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(QUEUE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.slice(-MAX_QUEUE) as ClientErrorLog[] : []
  } catch { return [] }
}

function persistQueue() {
  try { sessionStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE))) } catch { /* Session storage may be unavailable. */ }
}

async function flushQueue() {
  if (flushing || !queue.length) return
  flushing = true
  try {
    while (queue.length) {
      const uploaded = await uploadClientErrorLog(queue[0]).catch(() => false)
      if (!uploaded) break
      queue.shift()
      persistQueue()
    }
  } finally { flushing = false }
}

function normalizeError(error: unknown) {
  if (error instanceof Error) return { name: limit(error.name || 'Error', 120), message: limit(error.message, 1_200), stack: limit(error.stack, 5_000) }
  return { name: 'Error', message: limit(error, 1_200), stack: '' }
}

export function captureClientError(kind: ClientErrorKind, error: unknown, context: Record<string, string | number | boolean> = {}) {
  if (typeof window === 'undefined') return false
  const normalized = normalizeError(error)
  const fingerprint = `${kind}|${normalized.name}|${normalized.message}|${normalized.stack.slice(0, 300)}|${route()}`
  const now = Date.now()
  if (now - (recentFingerprints.get(fingerprint) || 0) < DEDUPE_MS) return false
  recentUploads = recentUploads.filter((timestamp) => now - timestamp < 10 * 60_000)
  if (recentUploads.length >= MAX_EVENTS_PER_TEN_MINUTES) return false
  recentFingerprints.set(fingerprint, now)
  recentUploads.push(now)
  const record: ClientErrorLog = {
    schemaVersion: 1,
    kind,
    ...normalized,
    route: route(),
    appVersion: APP_VERSION,
    userAgent: limit(navigator.userAgent, 500),
    platform: limit(navigator.platform, 120),
    online: navigator.onLine,
    visibility: document.visibilityState,
    clientAt: new Date(now).toISOString(),
    context: Object.fromEntries(Object.entries(context).slice(0, 20).map(([key, value]) => [limit(key, 80), typeof value === 'string' ? limit(value, 800) : value])),
    ttsEvents: safeTtsEvents(getTTSDiagnostics()),
  }
  queue = [...queue, record].slice(-MAX_QUEUE)
  persistQueue()
  void flushQueue()
  return true
}

export function installClientErrorLogging() {
  if (installed || typeof window === 'undefined') return
  installed = true
  queue = readQueue()
  window.addEventListener('error', (event) => {
    captureClientError('window-error', event.error || event.message, {
      source: event.filename ? limit(new URL(event.filename, location.href).pathname, 300) : '',
      line: event.lineno,
      column: event.colno,
    })
  })
  window.addEventListener('unhandledrejection', (event) => captureClientError('unhandled-rejection', event.reason))
  let lastTtsEventId = 0
  subscribeTTSDiagnostics((events) => {
    for (const event of events) {
      if (event.id <= lastTtsEventId) continue
      lastTtsEventId = event.id
      if (/(error|fail|fallback|timeout|unavailable)/i.test(event.stage)) {
        captureClientError('tts-error', new Error(event.message), { stage: event.stage, source: event.source, backend: event.backend || 'unknown' })
      }
    }
  })
  watchCloudUserForLogging((user) => {
    if (!user) return
    void flushQueue()
    window.setTimeout(() => void flushQueue(), 15_000)
  })
  window.addEventListener('online', () => void flushQueue())
  void flushQueue()
}
