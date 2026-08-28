/// <reference lib="webworker" />

import { env } from '@huggingface/transformers'
import { KokoroTTS, TextSplitterStream } from 'kokoro-js'

type SpeechPart = { text: string; voice: string }
type BrowserBackend = 'webgpu' | 'wasm'
type InitMessage = { type: 'init'; requestId: string; wasmBaseUrl: string; backend: BrowserBackend }
type GenerateMessage = { type: 'generate'; requestId: string; parts: SpeechPart[] }
type CancelMessage = { type: 'cancel'; requestId: string }
type IncomingMessage = InitMessage | GenerateMessage | CancelMessage
type OrtRuntime = {
  wasm?: { numThreads?: number; proxy?: boolean; wasmPaths?: { mjs: string; wasm: string } }
  webgpu?: { adapter?: unknown; powerPreference?: 'low-power' | 'high-performance' }
  versions?: { web?: string }
}

type KokoroModel = Awaited<ReturnType<typeof KokoroTTS.from_pretrained>>
type KokoroVoice = NonNullable<Parameters<KokoroModel['stream']>[1]>['voice']

const workerScope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope
let modelPromise: Promise<KokoroModel> | null = null
let modelBackend: BrowserBackend | null = null
let configuredWasmBaseUrl = ''
let configuredRuntimeVariant: 'standard' | 'asyncify' | null = null
let generationQueue = Promise.resolve()
const cancelledRequests = new Set<string>()

function post(type: string, requestId: string, payload: Record<string, unknown> = {}) {
  workerScope.postMessage({ type, requestId, ...payload })
}

function isSafariWebKit() {
  const userAgent = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/i.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIOS) return true
  return /Safari/i.test(userAgent) && !/(Chrome|Chromium|CriOS|FxiOS|EdgiOS|OPiOS)/i.test(userAgent)
}

function configureRuntime(wasmBaseUrl: string, backend: BrowserBackend) {
  if (configuredWasmBaseUrl) return
  configuredWasmBaseUrl = wasmBaseUrl.endsWith('/') ? wasmBaseUrl : `${wasmBaseUrl}/`
  const onnx = env.backends.onnx as unknown as OrtRuntime
  const wasm = onnx.wasm
  if (!wasm) throw new Error('ONNX WASM backend를 사용할 수 없습니다.')
  wasm.numThreads = 1
  wasm.proxy = false
  // Transformers.js v4 uses the native C++ WebGPU EP. Safari follows the
  // upstream standard-WASM path; other WebGPU browsers use Asyncify so CPU
  // fallback operators can yield without blocking the Worker.
  configuredRuntimeVariant = backend === 'webgpu' && !isSafariWebKit() ? 'asyncify' : 'standard'
  const suffix = configuredRuntimeVariant === 'asyncify' ? '.asyncify' : ''
  wasm.wasmPaths = {
    mjs: `${configuredWasmBaseUrl}ort-wasm-simd-threaded${suffix}.mjs`,
    wasm: `${configuredWasmBaseUrl}ort-wasm-simd-threaded${suffix}.wasm`,
  }
}

async function webGpuDtype() {
  const gpu = (navigator as unknown as { gpu?: { requestAdapter: (options?: { powerPreference?: string }) => Promise<{ features: Set<string> } | null> } }).gpu
  const adapter = await gpu?.requestAdapter({ powerPreference: 'high-performance' })
  if (!adapter) throw new Error('WebGPU adapter를 만들지 못했습니다.')
  const webgpu = (env.backends.onnx as unknown as OrtRuntime).webgpu
  if (webgpu) {
    webgpu.adapter = adapter
    webgpu.powerPreference = 'high-performance'
  }
  return adapter.features.has('shader-f16') ? 'fp16' as const : 'fp32' as const
}

async function loadModel(requestId: string, backend: BrowserBackend) {
  const dtype = backend === 'webgpu' ? await webGpuDtype() : 'q8' as const
  const ortVersion = (env.backends.onnx as unknown as OrtRuntime).versions?.web || 'unknown'
  post('backend-info', requestId, { backend, dtype, runtime: backend === 'webgpu' ? 'native-webgpu-ep' : 'wasm', runtimeVariant: configuredRuntimeVariant, ortVersion })
  return KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
    dtype,
    device: backend,
    progress_callback: (progress: { status?: string; progress?: number; loaded?: number; total?: number; file?: string }) => {
      if (progress.status !== 'progress' || !Number.isFinite(progress.progress)) return
      post('progress', requestId, {
        percent: Math.max(0, Math.min(100, Math.round(progress.progress || 0))),
        loadedBytes: progress.loaded,
        totalBytes: progress.total,
        file: progress.file?.split('/').pop(),
        backend,
      })
    },
  })
}

function ensureModel(requestId: string, wasmBaseUrl = configuredWasmBaseUrl, preferredBackend: BrowserBackend = modelBackend || 'wasm') {
  configureRuntime(wasmBaseUrl, preferredBackend)
  if (!modelPromise) {
    modelBackend = preferredBackend
    modelPromise = loadModel(requestId, preferredBackend).catch((error) => {
      modelPromise = null
      modelBackend = null
      throw error
    })
  }
  return modelPromise
}

async function initialize(message: InitMessage) {
  try {
    await ensureModel(message.requestId, message.wasmBaseUrl, message.backend)
    post('ready', message.requestId, { backend: modelBackend })
  } catch (error) {
    post('error', message.requestId, { message: error instanceof Error ? error.message : 'Kokoro Worker를 시작하지 못했습니다.' })
  }
}

async function generate(message: GenerateMessage) {
  try {
    const model = await ensureModel(message.requestId)
    let chunkIndex = 0
    for (const part of message.parts) {
      if (cancelledRequests.has(message.requestId)) break
      const splitter = new TextSplitterStream()
      // kokoro-js 1.2.1 can loop on URL/@mention tokens followed by a newline.
      // Newlines do not carry audible information, so normalize them before streaming.
      splitter.push(part.text.replace(/\s*\n+\s*/g, ' '))
      splitter.close()
      for await (const output of model.stream(splitter, { voice: part.voice as KokoroVoice, speed: 1 })) {
        if (cancelledRequests.has(message.requestId)) break
        const blob = output.audio.toBlob()
        post('chunk', message.requestId, { blob, index: chunkIndex, text: output.text })
        chunkIndex += 1
      }
    }
    if (cancelledRequests.has(message.requestId)) post('cancelled', message.requestId)
    else post('done', message.requestId, { chunks: chunkIndex, backend: modelBackend })
  } catch (error) {
    post('error', message.requestId, { message: error instanceof Error ? error.message : '음성을 생성하지 못했습니다.' })
  } finally {
    cancelledRequests.delete(message.requestId)
  }
}

workerScope.onmessage = (event: MessageEvent<IncomingMessage>) => {
  const message = event.data
  if (message.type === 'cancel') {
    cancelledRequests.add(message.requestId)
    return
  }
  if (message.type === 'init') {
    void initialize(message)
    return
  }
  generationQueue = generationQueue.then(() => generate(message)).catch(() => undefined)
}

export {}
