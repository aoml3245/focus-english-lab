import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createTtsMiddleware } from './server/tts-cache.mjs'
import packageJson from './package.json' with { type: 'json' }
import { createReadStream, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function localTtsServer() {
  const install = (server) => {
    if (process.env.VITEST) return
    server.middlewares.use(createTtsMiddleware(process.cwd()))
  }
  return { name: 'local-tts-server', configureServer: install, configurePreviewServer: install }
}

function privateVocabularyServer() {
  const install = (server) => {
    server.middlewares.use('/__private/vocabulary.json', (_request, response) => {
      const source = resolve(process.cwd(), 'private/vocabulary.json')
      if (!existsSync(source)) { response.statusCode = 404; response.end('Private vocabulary is not available.'); return }
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.setHeader('Cache-Control', 'no-store')
      createReadStream(source).pipe(response)
    })
  }
  return { name: 'private-vocabulary-server', configureServer: install, configurePreviewServer: install }
}

function versionManifest() {
  return {
    name: 'focus-english-version-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({
          version: packageJson.version,
          builtAt: new Date().toISOString(),
          commit: process.env.GITHUB_SHA || 'local',
        }),
      })
    },
  }
}

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? '/focus-english-lab/' : '/',
  plugins: [react(), localTtsServer(), privateVocabularyServer(), versionManifest()],
  worker: { format: 'es' },
})
