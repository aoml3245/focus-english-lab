import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { CLOUD_SYNC_CONFIGURED, createSharingCode, deleteUnusedInvite, removeSharingPartner, resolveCloudAccess, signOutOfCloud, syncPrivateLearningData, uploadPrivateVocabulary, watchCloudUser, type CloudAccess } from './cloudSync'

export default function CloudSyncSettings() {
  const [user, setUser] = useState<User | null>(null)
  const [access, setAccess] = useState<CloudAccess | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('개인 기록은 계정별로 분리하고, 공유 단어 목록만 두 사용자에게 동기화합니다.')
  const [invite, setInvite] = useState<{ token: string; expiresAt: Date } | null>(null)

  const refresh = async (nextUser: User) => setAccess(await resolveCloudAccess(nextUser))
  useEffect(() => watchCloudUser((nextUser) => { setUser(nextUser); if (nextUser) void refresh(nextUser) }), [])
  if (!CLOUD_SYNC_CONFIGURED) return <p className="settings-status settings-status--error">Firebase 프로젝트 연결 후 이 기능이 활성화됩니다.</p>
  if (!user || !access) return <p className="settings-status">로그인 상태를 확인하고 있습니다.</p>

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try { await action() } catch (error) { setMessage(error instanceof Error ? error.message : '클라우드 작업을 완료하지 못했습니다.') }
    finally { setBusy(false) }
  }

  return <div className="cloud-settings">
    <dl className="settings-summary"><div><dt>로그인 계정</dt><dd>{user.email || user.displayName || 'Firebase 사용자'}</dd></div><div><dt>공유 상태</dt><dd>{access.partnerUid ? '두 사용자 연결됨' : access.owner ? '내 계정만 연결됨' : '공유 사용자로 연결됨'}</dd></div></dl>
    {invite && <div className="cloud-invite"><span>30분 동안 한 번만 사용할 수 있는 코드</span><strong>{invite.token.match(/.{1,6}/g)?.join(' ')}</strong><small>{invite.expiresAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 만료</small></div>}
    <div className="settings-actions">
      <button className="button button--secondary" disabled={busy} onClick={() => void run(async () => { await syncPrivateLearningData(user); setMessage('개인 기록과 공유 단어장을 지금 동기화했습니다.') })}>지금 동기화</button>
      {access.owner && !access.partnerUid && <button className="button button--primary" disabled={busy} onClick={() => void run(async () => { if (invite) await deleteUnusedInvite(user, invite.token); setInvite(await createSharingCode(user)); setMessage('상대방이 자기 계정으로 로그인한 뒤 이 코드를 입력하면 연결됩니다.') })}>공유 코드 만들기</button>}
      {access.owner && access.partnerUid && <button className="button button--secondary" disabled={busy} onClick={() => { if (!window.confirm('연결된 사용자를 공유 그룹에서 해제할까요? 상대방의 개인 기록은 삭제되지 않습니다.')) return; void run(async () => { setAccess(await removeSharingPartner(user)); setMessage('공유 연결을 해제했습니다. 각 사용자의 개인 기록은 그대로 남아 있습니다.') }) }}>공유 연결 해제</button>}
      {access.owner && <label className="button button--secondary cloud-upload">비공개 단어장 업로드<input type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; void run(async () => { const result = await uploadPrivateVocabulary(user, file); setMessage(`${result.entries.toLocaleString('ko-KR')}개 단어를 ${result.chunks}개 비공개 조각으로 업로드했습니다.`); event.target.value = '' }) }} /></label>}
      <button className="text-button" disabled={busy} onClick={() => void signOutOfCloud()}>로그아웃</button>
    </div>
    <p className="settings-status" role="status" aria-live="polite">{message}</p>
  </div>
}
