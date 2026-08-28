import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createTtsMiddleware } from './server/tts-cache.mjs'

function localTtsServer() {
  const install = (server) => {
    if (process.env.VITEST) return
    server.middlewares.use(createTtsMiddleware(process.cwd()))
  }
  return { name: 'local-tts-server', configureServer: install, configurePreviewServer: install }
}

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? '/focus-english-lab/' : '/',
  plugins: [react(), localTtsServer()],
})
