import { readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const assetsRoot = join(projectRoot, 'dist', 'assets')
const assets = (await readdir(assetsRoot)).filter((asset) => asset.includes('.jsep'))

if (assets.length) throw new Error(`Deprecated JSEP assets found in build: ${assets.join(', ')}`)
