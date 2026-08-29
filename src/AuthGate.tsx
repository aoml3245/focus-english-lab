import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { Brand } from './components'
import { CLOUD_OWNER_UID, CLOUD_SYNC_CONFIGURED, joinWithSharingCode, resolveCloudAccess, signInToCloud, signOutOfCloud, syncPrivateLearningData, watchCloudUser, type CloudAccess, type CloudSyncProgress } from './cloudSync'
import { refreshAppToLatest } from './AppUpdate'
import { PRIVATE_DATA_CHANGED_EVENT } from './privateDataEvents'

const ACCESS_CHECK_TIMEOUT_MS = 12_000

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('클라우드 권한 확인이 지연되고 있습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.')), timeoutMs)
    promise.then((value) => { window.clearTimeout(timer); resolve(value) }, (error) => { window.clearTimeout(timer); reject(error) })
  })
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [access, setAccess] = useState<CloudAccess | null>(null)
  const [loading, setLoading] = useState(CLOUD_SYNC_CONFIGURED)
  const [accessFailed, setAccessFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [syncProgress, setSyncProgress] = useState<CloudSyncProgress | null>(null)
  const syncTimer = useRef<number | null>(null)
  const autoLoginStarted = useRef(false)

  useEffect(() => watchCloudUser(async (nextUser) => {
    setUser(nextUser)
    setAccess(null)
    setAccessFailed(false)
    if (!nextUser) { setLoading(false); return }
    const isConfiguredOwner = Boolean(CLOUD_OWNER_UID) && nextUser.uid === CLOUD_OWNER_UID
    if (isConfiguredOwner) {
      setAccess({ user: nextUser, authorized: true, owner: true, partnerUid: null })
      setLoading(false)
    } else setLoading(true)
    try {
      const nextAccess = await withTimeout(resolveCloudAccess(nextUser), ACCESS_CHECK_TIMEOUT_MS)
      setAccess(nextAccess)
      setLoading(false)
      if (nextAccess.authorized) void syncPrivateLearningData(nextUser, setSyncProgress).then(() => window.setTimeout(() => setSyncProgress(null), 1200)).catch((error) => { setSyncProgress(null); setMessage(error instanceof Error ? error.message : '자동 동기화에 실패했습니다.') })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '클라우드 연결을 확인하지 못했습니다.')
      if (!isConfiguredOwner) setAccessFailed(true)
    }
    finally { setLoading(false) }
  }, (error) => { setMessage(error.message); setLoading(false); setBusy(false) }), [])

  useEffect(() => {
    if (loading || user || busy || autoLoginStarted.current) return
    const url = new URL(location.href)
    if (url.searchParams.get('login') !== '1') return
    autoLoginStarted.current = true
    url.searchParams.delete('login')
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
    setBusy(true)
    void signInToCloud().catch((error) => setMessage(error instanceof Error ? error.message : '로그인하지 못했습니다.')).finally(() => setBusy(false))
  }, [busy, loading, user])

  useEffect(() => {
    const schedule = () => {
      if (!user || !access?.authorized) return
      if (syncTimer.current) window.clearTimeout(syncTimer.current)
      syncTimer.current = window.setTimeout(() => {
        void syncPrivateLearningData(user).catch((error) => setMessage(error instanceof Error ? error.message : '자동 동기화에 실패했습니다.'))
      }, 1600)
    }
    window.addEventListener(PRIVATE_DATA_CHANGED_EVENT, schedule)
    return () => {
      window.removeEventListener(PRIVATE_DATA_CHANGED_EVENT, schedule)
      if (syncTimer.current) window.clearTimeout(syncTimer.current)
    }
  }, [access?.authorized, user])

  if (!CLOUD_SYNC_CONFIGURED) return children
  if (loading) return <GatePage title="개인 학습 공간을 확인하고 있습니다." message="로그인 상태와 암호화된 동기화 권한을 확인하는 중입니다." />
  if (!user) return <GatePage title="개인 학습 공간" message="단어장과 학습 기록은 로그인한 사용자에게만 열립니다."><button className="button button--primary button--large" onClick={() => { setBusy(true); void signInToCloud().catch((error) => setMessage(error instanceof Error ? error.message : '로그인하지 못했습니다.')).finally(() => setBusy(false)) }} disabled={busy}>{busy ? '로그인 확인 중…' : 'Google 계정으로 로그인'}</button>{message && <p className="auth-gate__status" role="status">{message}</p>}</GatePage>
  if (accessFailed) return <GatePage title="연결 확인이 지연되고 있습니다." message={message || 'Firebase 연결을 완료하지 못했습니다.'}><button className="button button--primary" onClick={() => window.location.reload()}>권한 다시 확인</button><button className="text-button" onClick={() => void signOutOfCloud()}>다른 계정으로 로그인</button></GatePage>
  if (!access?.authorized) return <GatePage title="공유 코드로 연결" message="이 계정은 아직 개인 학습 그룹에 연결되지 않았습니다. 소유자가 만든 일회용 코드를 입력하세요."><div className="auth-gate__form"><label><span>공유 코드</span><input value={code} onChange={(event) => setCode(event.target.value)} autoCapitalize="characters" autoCorrect="off" placeholder="공유 코드를 입력하세요" /></label><button className="button button--primary" disabled={busy || !code.trim()} onClick={() => { setBusy(true); void joinWithSharingCode(user, code).then(async (next) => { setAccess(next); await syncPrivateLearningData(user) }).catch((error) => setMessage(error instanceof Error ? error.message : '공유 그룹에 연결하지 못했습니다.')).finally(() => setBusy(false)) }}>{busy ? '연결 중…' : '공유 그룹 연결'}</button></div><p className="auth-gate__account">로그인 계정: {user.email || user.displayName || user.uid}</p>{!CLOUD_OWNER_UID && <p className="auth-gate__setup">초기 소유자 UID: <code>{user.uid}</code></p>}{message && <p className="auth-gate__status" role="status">{message}</p>}<button className="text-button" onClick={() => void signOutOfCloud()}>다른 계정으로 로그인</button></GatePage>
  return <>{syncProgress && <CloudSyncIndicator progress={syncProgress} />}{children}</>
}

function GatePage({ title, message, children }: { title: string; message: string; children?: ReactNode }) {
  return <main className="auth-gate"><div className="auth-gate__panel"><Brand /><h1>{title}</h1><p>{message}</p>{children}<GateUpdateAction /></div></main>
}

function GateUpdateAction() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const update = async () => {
    setBusy(true)
    try { await refreshAppToLatest(setMessage) }
    catch (error) {
      setMessage(error instanceof Error ? error.message : '최신 버전을 확인하지 못했습니다.')
      setBusy(false)
    }
  }
  return <div className="auth-gate__update"><button className="text-button" disabled={busy} onClick={() => void update()}>{busy ? '새 버전 확인 중…' : '새 버전 확인 및 업데이트'}</button>{message && <small role="status">{message}</small>}</div>
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function CloudSyncIndicator({ progress }: { progress: CloudSyncProgress }) {
  const percent = progress.phase === 'done' ? 100 : progress.phase === 'merging' ? 78 : progress.phase === 'uploading' ? 90 : progress.total ? Math.round(progress.completed / progress.total * 70) : 5
  return <aside className="cloud-sync-progress" role="status" aria-live="polite"><div><strong>개인 학습 기록 동기화</strong><span>{progress.label}</span></div><div className="cloud-sync-progress__meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div><small>{progress.completed} / {progress.total}개 받음 · {formatBytes(progress.downloadedBytes)}</small></aside>
}
