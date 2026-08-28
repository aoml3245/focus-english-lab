import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { KokoroTTS } from 'kokoro-js'
import { env } from '@huggingface/transformers'

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const MODEL_VERSION = 'kokoro-82m-v1-q8'
const ALLOWED_VOICES = new Set(['af_heart', 'am_michael', 'bf_emma', 'bm_george'])
let modelPromise = null
let modelState = 'idle'
let modelStartedAt = 0
let modelReadyAt = 0
let modelError = ''
let generationQueue = Promise.resolve()
const pendingAudio = new Map()

function json(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 64 * 1024) { reject(new Error('요청이 너무 큽니다.')); req.destroy(); return }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
      catch { reject(new Error('올바른 JSON 요청이 아닙니다.')) }
    })
    req.on('error', reject)
  })
}

function cacheKey(text, voice, speed) {
  return createHash('sha256').update(JSON.stringify({ version: MODEL_VERSION, text, voice, speed })).digest('hex')
}

async function exists(file) {
  try { await stat(file); return true } catch { return false }
}

function getModel() {
  if (!modelPromise) {
    modelState = 'loading'
    modelStartedAt = Date.now()
    modelReadyAt = 0
    modelError = ''
    console.info('[tts] Loading Kokoro on the local server…')
    modelPromise = KokoroTTS.from_pretrained(MODEL_ID, { dtype: 'q8', device: 'cpu' })
      .then((model) => {
        modelState = 'ready'
        modelReadyAt = Date.now()
        console.info(`[tts] Kokoro ready in ${modelReadyAt - modelStartedAt}ms.`)
        return model
      })
      .catch((error) => {
        modelState = 'error'
        modelError = error instanceof Error ? error.message : String(error)
        modelPromise = null
        throw error
      })
  }
  return modelPromise
}

function enqueue(task) {
  const pending = generationQueue.then(task, task)
  generationQueue = pending.then(() => undefined, () => undefined)
  return pending
}

async function getCachedAudio(cacheDir, text, voice, speed) {
  await mkdir(cacheDir, { recursive: true })
  const key = cacheKey(text, voice, speed)
  const target = path.join(cacheDir, `${key}.wav`)
  if (await exists(target)) return { buffer: await readFile(target), hit: true, key, generationMs: 0 }
  let pending = pendingAudio.get(key)
  if (!pending) {
    pending = enqueue(async () => {
      if (await exists(target)) return { buffer: await readFile(target), hit: true, key, generationMs: 0 }
      const startedAt = Date.now()
      const model = await getModel()
      const temp = `${target}.${process.pid}.tmp`
      try {
        const audio = await model.generate(text, { voice, speed })
        await audio.save(temp)
        await rename(temp, target)
      } catch (error) {
        await unlink(temp).catch(() => undefined)
        throw error
      }
      return { buffer: await readFile(target), hit: false, key, generationMs: Date.now() - startedAt }
    }).finally(() => pendingAudio.delete(key))
    pendingAudio.set(key, pending)
  }
  return pending
}

export function createTtsMiddleware(rootDir) {
  env.cacheDir = path.join(rootDir, '.cache', 'models')
  env.allowRemoteModels = process.env.FOCUS_TTS_ALLOW_DOWNLOAD === '1'
  const cacheDir = path.join(rootDir, '.cache', 'tts')
  void getModel().catch((error) => console.error('[tts] Startup failed:', error))
  return async function ttsMiddleware(req, res, next) {
    const url = new URL(req.url || '/', 'http://localhost')
    if (url.pathname === '/api/tts/status' && req.method === 'GET') {
      json(res, 200, { state: modelState, error: modelError || undefined, modelLoadMs: modelReadyAt ? modelReadyAt - modelStartedAt : undefined, cache: '.cache/tts' })
      return
    }
    if (url.pathname !== '/api/tts' || req.method !== 'POST') { next(); return }
    try {
      const body = await readJson(req)
      const text = typeof body.text === 'string' ? body.text.trim() : ''
      const voice = typeof body.voice === 'string' ? body.voice : ''
      const speed = typeof body.speed === 'number' && body.speed >= 0.75 && body.speed <= 1.25 ? body.speed : 1
      if (!text || text.length > 12_000) { json(res, 400, { error: '텍스트는 1~12000자여야 합니다.' }); return }
      if (!ALLOWED_VOICES.has(voice)) { json(res, 400, { error: '지원하지 않는 음성입니다.' }); return }
      const audio = await getCachedAudio(cacheDir, text, voice, speed)
      res.statusCode = 200
      res.setHeader('Content-Type', 'audio/wav')
      res.setHeader('Content-Length', String(audio.buffer.length))
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      res.setHeader('X-TTS-Cache', audio.hit ? 'HIT' : 'MISS')
      res.setHeader('X-TTS-Generation-Ms', String(audio.generationMs))
      res.end(audio.buffer)
    } catch (error) {
      json(res, 500, { error: error instanceof Error ? error.message : '음성 생성에 실패했습니다.' })
    }
  }
}
