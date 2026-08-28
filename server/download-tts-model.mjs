import path from 'node:path'
import { env } from '@huggingface/transformers'
import { KokoroTTS } from 'kokoro-js'

env.cacheDir = path.join(process.cwd(), '.cache', 'models')
env.allowRemoteModels = true

const startedAt = Date.now()
console.info(`[tts] Downloading Kokoro to ${env.cacheDir}`)
await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
  dtype: 'q8',
  device: 'cpu',
})
console.info(`[tts] Model ready in ${((Date.now() - startedAt) / 1000).toFixed(2)}s.`)
