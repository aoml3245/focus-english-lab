import { useEffect, useState } from 'react'
import { APP_VERSION } from './version'

type VersionManifest = { version: string; builtAt?: string; commit?: string }

function versionManifestUrl() {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin)
  const url = new URL('version.json', base)
  url.searchParams.set('check', Date.now().toString())
  return url
}

export function applyLatestVersion(version: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('app-version', version)
  url.searchParams.set('updated-at', Date.now().toString())
  window.location.replace(url)
}

export default function AppUpdate() {
  const [latest, setLatest] = useState<VersionManifest | null>(null)

  useEffect(() => {
    let active = true
    const check = async () => {
      try {
        const response = await fetch(versionManifestUrl(), { cache: 'no-store', headers: { Accept: 'application/json' } })
        if (!response.ok) return
        const manifest = await response.json() as VersionManifest
        if (active && manifest.version && manifest.version !== APP_VERSION) setLatest(manifest)
      } catch { /* Offline use keeps the current version. */ }
    }
    void check()
    const interval = window.setInterval(check, 60_000)
    const onVisible = () => { if (document.visibilityState === 'visible') void check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!latest) return null
  return <aside className="app-update" role="status" aria-live="polite">
    <span><strong>새 버전 {latest.version}</strong><small>배포가 완료됐습니다. 캐시를 우회해 바로 적용할 수 있습니다.</small></span>
    <button onClick={() => applyLatestVersion(latest.version)}>지금 적용</button>
  </aside>
}
