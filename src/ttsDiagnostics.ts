export type TTSDiagnosticEvent = {
  id: number
  at: string
  elapsedMs: number
  source: 'app' | 'worker'
  stage: string
  message: string
  requestId?: string
  backend?: 'webgpu' | 'wasm'
  detail?: Record<string, unknown>
}

const startedAt = performance.now()
const MAX_EVENTS = 120
let sequence = 0
let events: TTSDiagnosticEvent[] = []
const subscribers = new Set<(next: TTSDiagnosticEvent[]) => void>()

export function recordTTSDiagnostic(event: Omit<TTSDiagnosticEvent, 'id' | 'at' | 'elapsedMs'> & { elapsedMs?: number }) {
  const next: TTSDiagnosticEvent = {
    ...event,
    id: ++sequence,
    at: new Date().toISOString(),
    elapsedMs: event.elapsedMs ?? Math.round(performance.now() - startedAt),
  }
  events = [...events.slice(-(MAX_EVENTS - 1)), next]
  subscribers.forEach((subscriber) => subscriber(events))
  return next
}

export function getTTSDiagnostics() {
  return events
}

export function subscribeTTSDiagnostics(subscriber: (next: TTSDiagnosticEvent[]) => void) {
  subscribers.add(subscriber)
  subscriber(events)
  return () => { subscribers.delete(subscriber) }
}

export function clearTTSDiagnostics() {
  events = []
  subscribers.forEach((subscriber) => subscriber(events))
}

export function formatTTSDiagnostics(context: Record<string, unknown>) {
  return JSON.stringify({ capturedAt: new Date().toISOString(), context, events }, null, 2)
}
