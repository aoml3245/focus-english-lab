import { useEffect, useState } from 'react'
import { createSessionBackup, getSessionStorageWarning, SESSION_STORAGE_WARNING_EVENT } from './storage'

export default function SessionStorageNotice() {
  const [message, setMessage] = useState(getSessionStorageWarning)
  useEffect(() => {
    const refresh = () => setMessage(getSessionStorageWarning())
    refresh(); window.addEventListener(SESSION_STORAGE_WARNING_EVENT, refresh)
    return () => window.removeEventListener(SESSION_STORAGE_WARNING_EVENT, refresh)
  }, [])
  if (!message) return null
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(createSessionBackup(), null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'focus-english-lab-unsaved-learning-backup.json'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <aside className="session-storage-notice" role="alert"><p>{message}</p><button className="button button--secondary" onClick={download}>임시 답안·기록 JSON 저장</button><small>개인 음성 파일은 포함되지 않습니다. 녹음은 별도로 내려받으세요.</small></aside>
}
