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
const workerStartedAt = performance.now()
let modelPromise: Promise<KokoroModel> | null = null
let modelBackend: BrowserBackend | null = null
let configuredWasmBaseUrl = ''
let configuredRuntimeVariant: 'standard' | 'asyncify' | null = null
let generationQueue = Promise.resolve()
const cancelledRequests = new Set<string>()

function post(type: string, requestId: string, payload: Record<string, unknown> = {}) {
  workerScope.postMessage({ type, requestId, ...payload })
}

function diagnose(requestId: string, stage: string, message: string, detail: Record<string, unknown> = {}) {
  post('diagnostic', requestId, { stage, message, elapsedMs: Math.round(performance.now() - workerStartedAt), detail })
}

function configureRuntime(wasmBaseUrl: string, backend: BrowserBackend, requestId: string) {
  if (configuredWasmBaseUrl) return
  configuredWasmBaseUrl = wasmBaseUrl.endsWith('/') ? wasmBaseUrl : `${wasmBaseUrl}/`
  const onnx = env.backends.onnx as unknown as OrtRuntime
  const wasm = onnx.wasm
  if (!wasm) throw new Error('ONNX WASM backend를 사용할 수 없습니다.')
  wasm.numThreads = 1
  wasm.proxy = false
  // The native WebGPU build exports webgpuInit only from the asyncify host.
  // The standard host is CPU-only, so pairing it with device: 'webgpu' fails
  // on Safari with "webgpuInit is not a function" before model creation.
  // Asyncify is the native C++ WebGPU EP here; it is not the deprecated JSEP
  // runtime. CPU-only WASM continues to use the smaller standard host.
  configuredRuntimeVariant = backend === 'webgpu' ? 'asyncify' : 'standard'
  const suffix = configuredRuntimeVariant === 'asyncify' ? '.asyncify' : ''
  wasm.wasmPaths = {
    mjs: `${configuredWasmBaseUrl}ort-wasm-simd-threaded${suffix}.mjs`,
    wasm: `${configuredWasmBaseUrl}ort-wasm-simd-threaded${suffix}.wasm`,
  }
  diagnose(requestId, 'runtime-configured', `${backend} 런타임 파일 경로를 설정했습니다.`, { runtimeVariant: configuredRuntimeVariant, numThreads: wasm.numThreads })
}

async function webGpuDtype(requestId: string) {
  diagnose(requestId, 'webgpu-adapter-request', 'WebGPU 어댑터를 요청합니다.')
  const gpu = (navigator as unknown as { gpu?: { requestAdapter: (options?: { powerPreference?: string }) => Promise<{ features: Set<string> } | null> } }).gpu
  const adapter = await gpu?.requestAdapter({ powerPreference: 'high-performance' })
  if (!adapter) throw new Error('WebGPU adapter를 만들지 못했습니다.')
  const webgpu = (env.backends.onnx as unknown as OrtRuntime).webgpu
  if (webgpu) {
    webgpu.adapter = adapter
    webgpu.powerPreference = 'high-performance'
  }
  const dtype = adapter.features.has('shader-f16') ? 'fp16' as const : 'fp32' as const
  diagnose(requestId, 'webgpu-adapter-ready', `WebGPU 어댑터가 준비됐습니다 (${dtype}).`, { dtype })
  return dtype
}

async function loadModel(requestId: string, backend: BrowserBackend) {
  diagnose(requestId, 'model-load-start', `${backend} 모델 로드를 시작합니다.`)
  const dtype = backend === 'webgpu' ? await webGpuDtype(requestId) : 'q8' as const
  const ortVersion = (env.backends.onnx as unknown as OrtRuntime).versions?.web || 'unknown'
  post('backend-info', requestId, { backend, dtype, runtime: backend === 'webgpu' ? 'native-webgpu-ep' : 'wasm', runtimeVariant: configuredRuntimeVariant, ortVersion })
  const model = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
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
  diagnose(requestId, 'model-load-ready', `${backend} 모델 세션이 준비됐습니다.`, { dtype, runtimeVariant: configuredRuntimeVariant })
  return model
}

function ensureModel(requestId: string, wasmBaseUrl = configuredWasmBaseUrl, preferredBackend: BrowserBackend = modelBackend || 'wasm') {
  configureRuntime(wasmBaseUrl, preferredBackend, requestId)
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
    diagnose(message.requestId, 'init-start', `${message.backend} Worker 초기화를 시작합니다.`)
    await ensureModel(message.requestId, message.wasmBaseUrl, message.backend)
    diagnose(message.requestId, 'init-ready', `${message.backend} Worker 초기화를 마쳤습니다.`)
    post('ready', message.requestId, { backend: modelBackend })
  } catch (error) {
    diagnose(message.requestId, 'init-error', error instanceof Error ? error.message : 'Worker 초기화 오류')
    post('error', message.requestId, { message: error instanceof Error ? error.message : 'Kokoro Worker를 시작하지 못했습니다.' })
  }
}

async function generate(message: GenerateMessage) {
  try {
    diagnose(message.requestId, 'generation-start', `음성 생성을 시작합니다 (${message.parts.length}개 조각).`, { parts: message.parts.length })
    const model = await ensureModel(message.requestId)
    let chunkIndex = 0
    for (let partIndex = 0; partIndex < message.parts.length; partIndex += 1) {
      const part = message.parts[partIndex]
      if (cancelledRequests.has(message.requestId)) break
      diagnose(message.requestId, 'part-start', `${partIndex + 1}번 텍스트 조각 추론을 시작합니다.`, { partIndex, characters: part.text.length, voice: part.voice })
      const splitter = new TextSplitterStream()
      // kokoro-js 1.2.1 can loop on URL/@mention tokens followed by a newline.
      // Newlines do not carry audible information, so normalize them before streaming.
      splitter.push(part.text.replace(/\s*\n+\s*/g, ' '))
      splitter.close()
      for await (const output of model.stream(splitter, { voice: part.voice as KokoroVoice, speed: 1 })) {
        if (cancelledRequests.has(message.requestId)) break
        const blob = output.audio.toBlob()
        diagnose(message.requestId, 'first-chunk', `${chunkIndex + 1}번 오디오 조각이 생성됐습니다.`, { chunkIndex, bytes: blob.size })
        post('chunk', message.requestId, { blob, index: chunkIndex, text: output.text })
        chunkIndex += 1
      }
    }
    if (cancelledRequests.has(message.requestId)) {
      diagnose(message.requestId, 'generation-cancelled', '음성 생성 취소를 반영했습니다.')
      post('cancelled', message.requestId)
    }
    else {
      diagnose(message.requestId, 'generation-done', `음성 생성을 마쳤습니다 (${chunkIndex}개 오디오 조각).`, { chunks: chunkIndex })
      post('done', message.requestId, { chunks: chunkIndex, backend: modelBackend })
    }
  } catch (error) {
    diagnose(message.requestId, 'generation-error', error instanceof Error ? error.message : '음성 생성 오류')
    post('error', message.requestId, { message: error instanceof Error ? error.message : '음성을 생성하지 못했습니다.' })
  } finally {
    cancelledRequests.delete(message.requestId)
  }
}

workerScope.onmessage = (event: MessageEvent<IncomingMessage>) => {
  const message = event.data
  if (message.type === 'cancel') {
    cancelledRequests.add(message.requestId)
    diagnose(message.requestId, 'cancel-received', 'Worker가 취소 요청을 받았습니다.')
    return
  }
  if (message.type === 'init') {
    void initialize(message)
    return
  }
  generationQueue = generationQueue.then(() => generate(message)).catch(() => undefined)
}

export {}
