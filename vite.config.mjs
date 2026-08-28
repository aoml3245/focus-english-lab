import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createTtsMiddleware } from './server/tts-cache.mjs'
import packageJson from './package.json' with { type: 'json' }

function localTtsServer() {
  const install = (server) => {
    if (process.env.VITEST) return
    server.middlewares.use(createTtsMiddleware(process.cwd()))
  }
  return { name: 'local-tts-server', configureServer: install, configurePreviewServer: install }
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
  plugins: [react(), localTtsServer(), versionManifest()],
  worker: { format: 'es' },
})
