import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// phonemizer 1.2.1 expands its embedded eSpeak data with `for await...of` on a
// ReadableStream. WebKit on iOS can expose ReadableStream without its async
// iterator, leaving phonemizer's uncaught initialization promise pending
// forever. Use the standard reader API that WebKit implements reliably.
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const target = join(projectRoot, 'node_modules', 'phonemizer', 'dist', 'phonemizer.js')
const original = 'C=[];for await(const A of e)C.push(A);const a=await new Blob(C).arrayBuffer()'
const replacement = 'C=[];const __felReader=e.getReader();for(;;){const __felChunk=await __felReader.read();if(__felChunk.done)break;C.push(__felChunk.value)}const a=await new Blob(C).arrayBuffer()'

const source = await readFile(target, 'utf8')
if (source.includes(replacement)) process.exit(0)
if (!source.includes(original)) throw new Error('phonemizer 1.2.1 patch target changed; review the upstream bundle before building.')
await writeFile(target, source.replace(original, replacement))
console.log('[tts] Patched phonemizer ReadableStream iteration for iOS WebKit.')
