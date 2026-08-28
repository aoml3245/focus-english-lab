import { readdir, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const assetsRoot = join(projectRoot, 'dist', 'assets')
const assets = await readdir(assetsRoot)

await Promise.all(assets
  .filter((asset) => asset.includes('ort-wasm-simd-threaded.jsep'))
  .map((asset) => unlink(join(assetsRoot, asset))))
