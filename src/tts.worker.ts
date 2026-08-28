/// <reference lib="webworker" />

import { env, RawAudio } from '@huggingface/transformers'
import { KokoroTTS, TextSplitterStream } from 'kokoro-js'

type SpeechPart = { text: string; voice: string }
type BrowserBackend = 'webgpu' | 'wasm'
type InitMessage = { type: 'init'; requestId: string; wasmBaseUrl: string; backend: BrowserBackend; threads?: number }
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
type InstrumentedSession = {
  run: (...args: unknown[]) => Promise<unknown>
  inputNames?: string[]
  outputNames?: string[]
}

const workerScope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope
const workerStartedAt = performance.now()
let modelPromise: Promise<KokoroModel> | null = null
let modelBackend: BrowserBackend | null = null
let configuredWasmBaseUrl = ''
let configuredRuntimeVariant: 'standard' | 'asyncify' | null = null
let configuredThreads = 1
let generationQueue = Promise.resolve()
const cancelledRequests = new Set<string>()
let activePartRequestId: string | null = null
let activePartStartedAt = 0
let phonemizerSlowTimer: ReturnType<typeof setTimeout> | null = null

function post(type: string, requestId: string, payload: Record<string, unknown> = {}) {
  workerScope.postMessage({ type, requestId, ...payload })
}

function diagnose(requestId: string, stage: string, message: string, detail: Record<string, unknown> = {}) {
  post('diagnostic', requestId, { stage, message, elapsedMs: Math.round(performance.now() - workerStartedAt), detail })
}

function configureRuntime(wasmBaseUrl: string, backend: BrowserBackend, requestId: string, requestedThreads?: number) {
  if (configuredWasmBaseUrl) return
  configuredWasmBaseUrl = wasmBaseUrl.endsWith('/') ? wasmBaseUrl : `${wasmBaseUrl}/`
  const onnx = env.backends.onnx as unknown as OrtRuntime
  const wasm = onnx.wasm
  if (!wasm) throw new Error('ONNX WASM backend를 사용할 수 없습니다.')
  const canUseThreads = workerScope.crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined'
  const hardwareThreads = navigator.hardwareConcurrency || 2
  const automaticThreads = backend === 'wasm' && canUseThreads ? Math.max(2, Math.min(4, Math.floor(hardwareThreads / 2))) : 1
  configuredThreads = requestedThreads && canUseThreads ? Math.max(1, Math.min(4, requestedThreads)) : automaticThreads
  wasm.numThreads = configuredThreads
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
  diagnose(requestId, 'runtime-configured', `${backend} 런타임 파일 경로를 설정했습니다.`, { runtimeVariant: configuredRuntimeVariant, numThreads: wasm.numThreads, crossOriginIsolated: workerScope.crossOriginIsolated })
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
  post('backend-info', requestId, { backend, dtype, runtime: backend === 'webgpu' ? 'native-webgpu-ep' : 'wasm', runtimeVariant: configuredRuntimeVariant, ortVersion, threads: configuredThreads })
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
  const session = (model as unknown as { model?: { sessions?: { model?: InstrumentedSession } } }).model?.sessions?.model
  if (session) {
    const originalRun = session.run.bind(session)
    session.run = async (...args: unknown[]) => {
      const startedAt = performance.now()
      const diagnosticRequestId = activePartRequestId || requestId
      if (phonemizerSlowTimer) clearTimeout(phonemizerSlowTimer)
      phonemizerSlowTimer = null
      if (activePartStartedAt) {
        const durationMs = Math.round(startedAt - activePartStartedAt)
        diagnose(diagnosticRequestId, 'phonemizer-ready', `음소 변환 완료: ${durationMs}ms. ONNX 추론으로 넘어갑니다.`, {
          durationMs,
        })
        activePartStartedAt = 0
      }
      diagnose(diagnosticRequestId, 'onnx-run-start', 'ONNX Runtime model.run()을 호출했습니다.', {
        inputs: session.inputNames,
        outputs: session.outputNames,
        threads: configuredThreads,
      })
      try {
        const result = await originalRun(...args)
        const durationMs = Math.round(performance.now() - startedAt)
        diagnose(diagnosticRequestId, 'onnx-run-ready', `ONNX 추론 완료: ${durationMs}ms.`, {
          durationMs,
          threads: configuredThreads,
        })
        return result
      } catch (error) {
        diagnose(diagnosticRequestId, 'onnx-run-error', error instanceof Error ? error.message : 'ONNX Runtime 실행 오류', {
          durationMs: Math.round(performance.now() - startedAt),
          threads: configuredThreads,
        })
        throw error
      }
    }
  } else {
    diagnose(requestId, 'onnx-session-unavailable', 'Kokoro 내부 ONNX 세션에 진단 래퍼를 연결하지 못했습니다.')
  }
  diagnose(requestId, 'model-load-ready', `${backend} 모델 세션이 준비됐습니다.`, { dtype, runtimeVariant: configuredRuntimeVariant })
  return model
}

function ensureModel(requestId: string, wasmBaseUrl = configuredWasmBaseUrl, preferredBackend: BrowserBackend = modelBackend || 'wasm', requestedThreads?: number) {
  configureRuntime(wasmBaseUrl, preferredBackend, requestId, requestedThreads)
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
    await ensureModel(message.requestId, message.wasmBaseUrl, message.backend, message.threads)
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
    const audioChunks: Float32Array[] = []
    let sampleRate = 24_000
    let segmentCount = 0
    const renderedText: string[] = []
    post('generation-progress', message.requestId, { completedParts: 0, totalParts: message.parts.length, percent: 0 })
    for (let partIndex = 0; partIndex < message.parts.length; partIndex += 1) {
      const part = message.parts[partIndex]
      if (cancelledRequests.has(message.requestId)) break
      diagnose(message.requestId, 'part-start', `${partIndex + 1}번 텍스트 조각 추론을 시작합니다.`, { partIndex, characters: part.text.length, voice: part.voice })
      activePartRequestId = message.requestId
      activePartStartedAt = performance.now()
      phonemizerSlowTimer = setTimeout(() => {
        diagnose(message.requestId, 'phonemizer-slow', '음소 변환이 5초 넘게 끝나지 않았습니다. iOS eSpeak 초기화를 확인하세요.', { partIndex })
      }, 5_000)
      const splitter = new TextSplitterStream()
      // kokoro-js 1.2.1 can loop on URL/@mention tokens followed by a newline.
      // Newlines do not carry audible information, so normalize them before streaming.
      splitter.push(part.text.replace(/\s*\n+\s*/g, ' '))
      splitter.close()
      for await (const output of model.stream(splitter, { voice: part.voice as KokoroVoice, speed: 1 })) {
        if (cancelledRequests.has(message.requestId)) break
        audioChunks.push(output.audio.data)
        sampleRate = output.audio.sampling_rate
        renderedText.push(output.text)
        segmentCount += 1
        diagnose(message.requestId, 'segment-ready', `${segmentCount}번 내부 음성 구간을 이어 붙였습니다.`, { segmentCount, samples: output.audio.data.length })
      }
      if (phonemizerSlowTimer) clearTimeout(phonemizerSlowTimer)
      phonemizerSlowTimer = null
      activePartRequestId = null
      activePartStartedAt = 0
      post('generation-progress', message.requestId, { completedParts: partIndex + 1, totalParts: message.parts.length, percent: Math.round((partIndex + 1) / message.parts.length * 100) })
    }
    if (cancelledRequests.has(message.requestId)) {
      diagnose(message.requestId, 'generation-cancelled', '음성 생성 취소를 반영했습니다.')
      post('cancelled', message.requestId)
    }
    else {
      const blob = new RawAudio(audioChunks, sampleRate).toBlob()
      diagnose(message.requestId, 'first-chunk', `전체 문장을 하나의 연속 오디오로 완성했습니다.`, { segments: segmentCount, bytes: blob.size })
      post('chunk', message.requestId, { blob, index: 0, text: renderedText.join(' ') })
      diagnose(message.requestId, 'generation-done', `음성 생성을 마쳤습니다 (내부 ${segmentCount}구간 → 연속 오디오 1개).`, { chunks: 1, segments: segmentCount })
      post('done', message.requestId, { chunks: 1, backend: modelBackend })
    }
  } catch (error) {
    diagnose(message.requestId, 'generation-error', error instanceof Error ? error.message : '음성 생성 오류')
    post('error', message.requestId, { message: error instanceof Error ? error.message : '음성을 생성하지 못했습니다.' })
  } finally {
    if (phonemizerSlowTimer) clearTimeout(phonemizerSlowTimer)
    phonemizerSlowTimer = null
    activePartRequestId = null
    activePartStartedAt = 0
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
