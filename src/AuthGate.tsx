import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { Brand } from './components'
import { CLOUD_OWNER_UID, CLOUD_SYNC_CONFIGURED, joinWithSharingCode, resolveCloudAccess, signInToCloud, signOutOfCloud, syncPrivateLearningData, watchCloudUser, type CloudAccess } from './cloudSync'
import { PRIVATE_DATA_CHANGED_EVENT } from './privateDataEvents'

export default function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [access, setAccess] = useState<CloudAccess | null>(null)
  const [loading, setLoading] = useState(CLOUD_SYNC_CONFIGURED)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const syncTimer = useRef<number | null>(null)

  useEffect(() => watchCloudUser(async (nextUser) => {
    setUser(nextUser)
    setAccess(null)
    if (!nextUser) { setLoading(false); return }
    try {
      const nextAccess = await resolveCloudAccess(nextUser)
      setAccess(nextAccess)
      if (nextAccess.authorized) await syncPrivateLearningData(nextUser)
    } catch (error) { setMessage(error instanceof Error ? error.message : '클라우드 연결을 확인하지 못했습니다.') }
    finally { setLoading(false) }
  }), [])

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
  if (!access?.authorized) return <GatePage title="공유 코드로 연결" message="이 계정은 아직 개인 학습 그룹에 연결되지 않았습니다. 소유자가 만든 일회용 코드를 입력하세요."><div className="auth-gate__form"><label><span>공유 코드</span><input value={code} onChange={(event) => setCode(event.target.value)} autoCapitalize="characters" autoCorrect="off" placeholder="공유 코드를 입력하세요" /></label><button className="button button--primary" disabled={busy || !code.trim()} onClick={() => { setBusy(true); void joinWithSharingCode(user, code).then(async (next) => { setAccess(next); await syncPrivateLearningData(user) }).catch((error) => setMessage(error instanceof Error ? error.message : '공유 그룹에 연결하지 못했습니다.')).finally(() => setBusy(false)) }}>{busy ? '연결 중…' : '공유 그룹 연결'}</button></div><p className="auth-gate__account">로그인 계정: {user.email || user.displayName || user.uid}</p>{!CLOUD_OWNER_UID && <p className="auth-gate__setup">초기 소유자 UID: <code>{user.uid}</code></p>}{message && <p className="auth-gate__status" role="status">{message}</p>}<button className="text-button" onClick={() => void signOutOfCloud()}>다른 계정으로 로그인</button></GatePage>
  return children
}

function GatePage({ title, message, children }: { title: string; message: string; children?: ReactNode }) {
  return <main className="auth-gate"><div className="auth-gate__panel"><Brand /><h1>{title}</h1><p>{message}</p>{children}</div></main>
}
