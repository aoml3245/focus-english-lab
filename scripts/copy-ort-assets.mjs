import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const sourceRoot = join(projectRoot, 'node_modules', 'onnxruntime-web', 'dist')
const destinationRoot = join(projectRoot, 'public', 'ort')
const assets = ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']

await mkdir(destinationRoot, { recursive: true })
await Promise.all(assets.map((asset) => copyFile(join(sourceRoot, asset), join(destinationRoot, asset))))
