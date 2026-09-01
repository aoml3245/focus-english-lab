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
  window.history.replaceState(window.history.state, '', url)
  window.location.reload()
}

export async function fetchLatestVersion() {
  const response = await fetch(versionManifestUrl(), { cache: 'reload', headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('최신 버전 정보를 불러오지 못했습니다.')
  const manifest = await response.json() as VersionManifest
  if (!manifest.version) throw new Error('배포 버전 정보가 올바르지 않습니다.')
  return manifest
}

export async function refreshAppToLatest(onProgress?: (message: string) => void) {
  onProgress?.('최신 배포 버전을 확인하고 있습니다…')
  const manifest = await fetchLatestVersion()
  if ('serviceWorker' in navigator) {
    onProgress?.('앱 실행 파일을 새로 확인하고 있습니다…')
    const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
    await registration?.update().catch(() => undefined)
  }
  onProgress?.(`새 버전 ${manifest.version} 적용 중…`)
  applyLatestVersion(manifest.version)
  return manifest
}

export default function AppUpdate() {
  const [latest, setLatest] = useState<VersionManifest | null>(null)

  useEffect(() => {
    let active = true
    const check = async () => {
      try {
        const manifest = await fetchLatestVersion()
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
    <span><strong>새 버전 {latest.version}</strong><small>배포가 완료됐습니다. 이전 앱 파일을 건너뛰고 바로 적용할 수 있습니다.</small></span>
    <button onClick={() => { void refreshAppToLatest() }}>지금 적용</button>
  </aside>
}
