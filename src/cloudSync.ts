import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth'
import { Timestamp, deleteDoc, doc, getDoc, getFirestore, runTransaction, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import { createPersonalVocabularyBackup, importPersonalVocabularyBackup, type PersonalVocabularyBackup } from './personalVocabulary'
import { notifyPrivateDataApplied } from './privateDataEvents'
import { createSessionBackup, importSessionBackup, type SessionBackup } from './storage'
import { hashVocabularyChunk, loadCachedVocabularyChunks, saveVocabularyChunks } from './vocabularyCache'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyB4crPyqOI9wkZszVg30tyax3qnVvX3Bv0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'focus-english-lab-3245.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'focus-english-lab-3245',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '631913688385',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:631913688385:web:8b58e531aa0d95454605c0',
}

export const CLOUD_OWNER_UID = import.meta.env.VITE_FIREBASE_OWNER_UID || 'zXXioDJUMogbltI1YH9cFMthnsh1'
export const CLOUD_GROUP_ID = import.meta.env.VITE_FIREBASE_GROUP_ID || '7d74de6b-8269-4f6d-a218-37835ae0ff40'
export const CLOUD_SYNC_CONFIGURED = Object.values(firebaseConfig).every(Boolean) && Boolean(CLOUD_GROUP_ID)
export const CLOUD_APP_ORIGIN = 'https://focus-english-lab-3245.firebaseapp.com'

let app: FirebaseApp | null = null
let applyingRemote = false

function services() {
  if (!CLOUD_SYNC_CONFIGURED) throw new Error('Firebase 연결 설정이 아직 완료되지 않았습니다.')
  app ||= getApps().length ? getApp() : initializeApp(firebaseConfig)
  return { auth: getAuth(app), db: getFirestore(app) }
}

export type CloudAccess = {
  user: User
  authorized: boolean
  owner: boolean
  partnerUid: string | null
}

export type CloudSyncProgress = {
  phase: 'downloading' | 'merging' | 'uploading' | 'done'
  completed: number
  total: number
  downloadedBytes: number
  label: string
}

export type VocabularyDownloadProgress = {
  phase: 'manifest' | 'downloading' | 'processing' | 'done'
  completedChunks: number
  totalChunks: number
  downloadedBytes: number
  totalBytes?: number
  loadedEntries: number
  cachedChunks: number
}

export function watchCloudUser(callback: (user: User | null) => void, onError?: (error: Error) => void) {
  if (!CLOUD_SYNC_CONFIGURED) {
    callback(null)
    return () => undefined
  }
  const auth = services().auth
  void getRedirectResult(auth).catch((error) => onError?.(error instanceof Error ? error : new Error('로그인 결과를 확인하지 못했습니다.')))
  return onAuthStateChanged(auth, callback, (error) => onError?.(error))
}

export async function signInToCloud() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  if (import.meta.env.PROD && location.origin !== CLOUD_APP_ORIGIN) {
    location.assign(`${CLOUD_APP_ORIGIN}/?login=1`)
    return null
  }
  if (import.meta.env.PROD) {
    await signInWithRedirect(services().auth, provider)
    return null
  }
  const popup = signInWithPopup(services().auth, provider)
  const timeout = new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('로그인 창이 열리지 않았습니다. 브라우저의 팝업 차단을 해제한 뒤 다시 시도해 주세요.')), 15_000))
  return (await Promise.race([popup, timeout])).user
}

export async function signOutOfCloud() {
  await signOut(services().auth)
}

export async function resolveCloudAccess(user: User): Promise<CloudAccess> {
  const { db } = services()
  const memberRef = doc(db, 'groups', CLOUD_GROUP_ID, 'members', user.uid)
  let member = await getDoc(memberRef)
  if (!member.exists() && CLOUD_OWNER_UID && user.uid === CLOUD_OWNER_UID) {
    const groupRef = doc(db, 'groups', CLOUD_GROUP_ID)
    const batch = writeBatch(db)
    batch.set(groupRef, { ownerUid: user.uid, partnerUid: null, createdAt: serverTimestamp(), lastInviteId: null }, { merge: true })
    batch.set(memberRef, { role: 'owner', joinedAt: serverTimestamp(), displayName: user.displayName || '', email: user.email || '' })
    await batch.commit()
    member = await getDoc(memberRef)
  }
  if (!member.exists()) return { user, authorized: false, owner: false, partnerUid: null }
  const group = await getDoc(doc(db, 'groups', CLOUD_GROUP_ID))
  return { user, authorized: true, owner: member.data().role === 'owner', partnerUid: group.data()?.partnerUid || null }
}

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '').toUpperCase()
}

export async function createSharingCode(user: User) {
  const access = await resolveCloudAccess(user)
  if (!access.owner) throw new Error('공유 코드는 그룹 소유자만 만들 수 있습니다.')
  if (access.partnerUid) throw new Error('이미 두 번째 사용자가 연결되어 있습니다.')
  const { db } = services()
  const token = randomToken()
  const expiresAt = Timestamp.fromMillis(Date.now() + 30 * 60 * 1000)
  await setDoc(doc(db, 'invites', token), {
    groupId: CLOUD_GROUP_ID,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    expiresAt,
    usedBy: null,
    usedAt: null,
  })
  return { token, expiresAt: expiresAt.toDate() }
}

export async function joinWithSharingCode(user: User, rawCode: string) {
  const token = rawCode.trim().toUpperCase().replace(/\s+/g, '')
  if (token.length < 20) throw new Error('공유 코드를 다시 확인해 주세요.')
  const { db } = services()
  const inviteRef = doc(db, 'invites', token)
  const groupRef = doc(db, 'groups', CLOUD_GROUP_ID)
  const memberRef = doc(db, 'groups', CLOUD_GROUP_ID, 'members', user.uid)
  await runTransaction(db, async (transaction) => {
    const [invite, group] = await Promise.all([transaction.get(inviteRef), transaction.get(groupRef)])
    if (!invite.exists() || invite.data().groupId !== CLOUD_GROUP_ID) throw new Error('유효하지 않은 공유 코드입니다.')
    if (invite.data().usedBy) throw new Error('이미 사용된 공유 코드입니다.')
    if (invite.data().expiresAt.toMillis() <= Date.now()) throw new Error('공유 코드가 만료되었습니다.')
    if (!group.exists()) throw new Error('공유 그룹을 찾지 못했습니다.')
    if (group.data().partnerUid) throw new Error('이미 두 명이 연결된 그룹입니다.')
    if (group.data().ownerUid === user.uid) throw new Error('같은 계정은 코드 없이 다른 기기에서 로그인하면 됩니다.')
    transaction.update(inviteRef, { usedBy: user.uid, usedAt: serverTimestamp() })
    transaction.update(groupRef, { partnerUid: user.uid, lastInviteId: token })
    transaction.set(memberRef, { role: 'partner', joinedAt: serverTimestamp(), displayName: user.displayName || '', email: user.email || '', joinedVia: token })
  })
  return resolveCloudAccess(user)
}

export async function removeSharingPartner(user: User) {
  const access = await resolveCloudAccess(user)
  if (!access.owner || !access.partnerUid) throw new Error('해제할 연결 사용자가 없습니다.')
  const { db } = services()
  const groupRef = doc(db, 'groups', CLOUD_GROUP_ID)
  const memberRef = doc(db, 'groups', CLOUD_GROUP_ID, 'members', access.partnerUid)
  const batch = writeBatch(db)
  batch.update(groupRef, { partnerUid: null, lastInviteId: null })
  batch.delete(memberRef)
  await batch.commit()
  return resolveCloudAccess(user)
}

const parseBackup = (value: unknown) => {
  if (typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value) as PersonalVocabularyBackup
    return parsed?.format === 'focus-english-personal-vocabulary' && parsed.version === 1 ? parsed : null
  } catch { return null }
}

const sharedBackup = (): PersonalVocabularyBackup => {
  const local = createPersonalVocabularyBackup()
  return { ...local, stats: {}, activeBatch: null, sessions: [] }
}

type PrivateCloudBackup = {
  format: 'focus-english-private-cloud-backup'
  version: 1
  vocabulary: PersonalVocabularyBackup
  sessions: SessionBackup
}

const createPrivateCloudBackup = (): PrivateCloudBackup => ({
  format: 'focus-english-private-cloud-backup',
  version: 1,
  vocabulary: createPersonalVocabularyBackup(),
  sessions: createSessionBackup(),
})

const parsePrivateCloudBackup = (value: unknown): PrivateCloudBackup | null => {
  if (typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value) as PrivateCloudBackup | PersonalVocabularyBackup
    if ('format' in parsed && parsed.format === 'focus-english-private-cloud-backup' && parsed.version === 1) return parsed
    if ('format' in parsed && parsed.format === 'focus-english-personal-vocabulary' && parsed.version === 1) return { format: 'focus-english-private-cloud-backup', version: 1, vocabulary: parsed, sessions: { version: 1, active: null, history: [] } }
    return null
  } catch { return null }
}

const checkedPayload = (backup: unknown) => {
  const payload = JSON.stringify(backup)
  if (new Blob([payload]).size > 850_000) throw new Error('동기화 데이터가 안전한 문서 크기를 초과했습니다. JSON 백업을 보관해 주세요.')
  return payload
}

export async function syncPrivateLearningData(user: User, onProgress?: (progress: CloudSyncProgress) => void) {
  if (applyingRemote) return
  const access = await resolveCloudAccess(user)
  if (!access.authorized) throw new Error('이 계정은 아직 개인 그룹에 연결되지 않았습니다.')
  const { db } = services()
  applyingRemote = true
  try {
    const privateRef = doc(db, 'users', user.uid, 'state', 'personalVocabulary')
    const sharedRef = doc(db, 'groups', CLOUD_GROUP_ID, 'state', 'sharedVocabulary')
    let completed = 0
    let downloadedBytes = 0
    const reportDownloaded = (payload: unknown) => {
      completed += 1
      if (typeof payload === 'string') downloadedBytes += new TextEncoder().encode(payload).byteLength
      onProgress?.({ phase: 'downloading', completed, total: 2, downloadedBytes, label: '개인 기록과 공유 단어 목록을 받고 있습니다.' })
    }
    onProgress?.({ phase: 'downloading', completed: 0, total: 2, downloadedBytes: 0, label: '개인 기록과 공유 단어 목록을 받고 있습니다.' })
    const privatePromise = getDoc(privateRef).then((snapshot) => { reportDownloaded(snapshot.data()?.payload); return snapshot })
    const sharedPromise = getDoc(sharedRef).then((snapshot) => { reportDownloaded(snapshot.data()?.payload); return snapshot })
    const [remotePrivate, remoteShared] = await Promise.all([privatePromise, sharedPromise])
    onProgress?.({ phase: 'merging', completed: 2, total: 2, downloadedBytes, label: '받은 기록을 이 기기의 기록과 합치고 있습니다.' })
    const privateBackup = parsePrivateCloudBackup(remotePrivate.data()?.payload)
    const groupBackup = parseBackup(remoteShared.data()?.payload)
    if (privateBackup) {
      importPersonalVocabularyBackup(JSON.stringify(privateBackup.vocabulary), false)
      importSessionBackup(privateBackup.sessions, false)
    }
    if (groupBackup) importPersonalVocabularyBackup(JSON.stringify(groupBackup), false)
    const batch = writeBatch(db)
    batch.set(privateRef, { payload: checkedPayload(createPrivateCloudBackup()), updatedAt: serverTimestamp(), schemaVersion: 1 })
    batch.set(sharedRef, { payload: checkedPayload(sharedBackup()), updatedAt: serverTimestamp(), updatedBy: user.uid, schemaVersion: 1 })
    onProgress?.({ phase: 'uploading', completed: 2, total: 2, downloadedBytes, label: '합친 결과를 계정에 안전하게 저장하고 있습니다.' })
    await batch.commit()
    onProgress?.({ phase: 'done', completed: 2, total: 2, downloadedBytes, label: '개인 기록 동기화를 완료했습니다.' })
    notifyPrivateDataApplied()
  } finally {
    applyingRemote = false
  }
}

export async function fetchPrivateVocabulary(onProgress?: (progress: VocabularyDownloadProgress) => void): Promise<Blob> {
  const { auth, db } = services()
  if (!auth.currentUser) throw new Error('단어장을 사용하려면 먼저 로그인해 주세요.')
  const access = await resolveCloudAccess(auth.currentUser)
  if (!access.authorized) throw new Error('이 계정에는 단어장 접근 권한이 없습니다.')
  const manifestRef = doc(db, 'groups', CLOUD_GROUP_ID, 'vocabularyMeta', 'manifest')
  onProgress?.({ phase: 'manifest', completedChunks: 0, totalChunks: 0, downloadedBytes: 0, loadedEntries: 0, cachedChunks: 0 })
  const manifest = await getDoc(manifestRef)
  const manifestData = manifest.data()
  const totalChunks = Number(manifestData?.chunkCount || 0)
  const totalBytes = Number(manifestData?.totalBytes || 0) || undefined
  const manifestHashes = Array.isArray(manifestData?.chunkHashes) && manifestData.chunkHashes.length === totalChunks ? manifestData.chunkHashes.map(String) : []
  if (!totalChunks) throw new Error('비공개 단어장이 아직 업로드되지 않았습니다. 소유자 설정에서 초기 업로드를 완료해 주세요.')
  const chunkEntries: unknown[][] = new Array(totalChunks)
  let nextIndex = 0
  let completedChunks = 0
  let downloadedBytes = 0
  let cachedBytes = 0
  let loadedEntries = 0
  let cachedChunks = 0
  const encoder = new TextEncoder()
  const cachedPayloads = manifestHashes.length ? await loadCachedVocabularyChunks(CLOUD_GROUP_ID, manifestHashes).catch(() => [] as Array<string | null>) : []
  for (let index = 0; index < totalChunks; index += 1) {
    const payload = cachedPayloads[index]
    if (!payload) continue
    try {
      const parsed = JSON.parse(payload) as unknown[]
      chunkEntries[index] = parsed
      completedChunks += 1
      cachedChunks += 1
      cachedBytes += encoder.encode(payload).byteLength
      loadedEntries += parsed.length
    } catch { /* Corrupt cache entries are downloaded again. */ }
  }
  onProgress?.({ phase: 'downloading', completedChunks, totalChunks, downloadedBytes, totalBytes, loadedEntries, cachedChunks })
  const downloadedChunks: Array<{ index: number; hash: string; payload: string }> = []
  const pendingIndexes = Array.from({ length: totalChunks }, (_, index) => index).filter((index) => !chunkEntries[index])
  const worker = async () => {
    while (nextIndex < pendingIndexes.length) {
      const index = pendingIndexes[nextIndex]
      nextIndex += 1
      const snapshot = await getDoc(doc(db, 'groups', CLOUD_GROUP_ID, 'vocabularyChunks', index.toString().padStart(4, '0')))
      if (!snapshot.exists()) throw new Error(`비공개 단어장 ${index + 1}번 조각을 찾지 못했습니다.`)
      const payload = String(snapshot.data().entries || '[]')
      const parsed = JSON.parse(payload) as unknown[]
      chunkEntries[index] = parsed
      const hash = manifestHashes[index] || await hashVocabularyChunk(payload)
      downloadedChunks.push({ index, hash, payload })
      completedChunks += 1
      downloadedBytes += encoder.encode(payload).byteLength
      loadedEntries += parsed.length
      onProgress?.({ phase: 'downloading', completedChunks, totalChunks, downloadedBytes, totalBytes, loadedEntries, cachedChunks })
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, pendingIndexes.length) }, () => worker()))
  await saveVocabularyChunks(CLOUD_GROUP_ID, downloadedChunks).catch(() => undefined)
  const resolvedHashes = manifestHashes.length ? manifestHashes : downloadedChunks.sort((a, b) => a.index - b.index).map((chunk) => chunk.hash)
  const resolvedTotalBytes = totalBytes || cachedBytes + downloadedBytes
  onProgress?.({ phase: 'processing', completedChunks, totalChunks, downloadedBytes, totalBytes: resolvedTotalBytes, loadedEntries, cachedChunks })
  if ((!totalBytes || !manifestHashes.length) && access.owner) void setDoc(manifestRef, { totalBytes: resolvedTotalBytes, chunkHashes: resolvedHashes }, { merge: true }).catch(() => undefined)
  const entries = chunkEntries.flat()
  onProgress?.({ phase: 'done', completedChunks, totalChunks, downloadedBytes, totalBytes: resolvedTotalBytes, loadedEntries: entries.length, cachedChunks })
  return new Blob([JSON.stringify(entries)], { type: 'application/json' })
}

export async function uploadPrivateVocabulary(user: User, file: File) {
  const access = await resolveCloudAccess(user)
  if (!access.owner) throw new Error('비공개 단어장은 그룹 소유자만 업로드할 수 있습니다.')
  const entries = JSON.parse(await file.text()) as unknown[]
  if (!Array.isArray(entries) || entries.length < 100) throw new Error('올바른 단어장 JSON 배열이 아닙니다.')
  const encoder = new TextEncoder()
  const chunks: string[] = []
  let current: unknown[] = []
  let currentBytes = 2
  for (const entry of entries) {
    const serialized = JSON.stringify(entry)
    const bytes = encoder.encode(serialized).byteLength + 1
    if (current.length && currentBytes + bytes > 620_000) {
      chunks.push(JSON.stringify(current))
      current = []
      currentBytes = 2
    }
    current.push(entry)
    currentBytes += bytes
  }
  if (current.length) chunks.push(JSON.stringify(current))
  const chunkHashes = await Promise.all(chunks.map(hashVocabularyChunk))
  const { db } = services()
  const manifestRef = doc(db, 'groups', CLOUD_GROUP_ID, 'vocabularyMeta', 'manifest')
  const previous = await getDoc(manifestRef)
  const previousCount = Number(previous.data()?.chunkCount || 0)
  for (let start = 0; start < chunks.length; start += 400) {
    const batch = writeBatch(db)
    chunks.slice(start, start + 400).forEach((payload, offset) => {
      const index = start + offset
      batch.set(doc(db, 'groups', CLOUD_GROUP_ID, 'vocabularyChunks', index.toString().padStart(4, '0')), { index, entries: payload })
    })
    await batch.commit()
  }
  if (previousCount > chunks.length) {
    const batch = writeBatch(db)
    for (let index = chunks.length; index < previousCount; index += 1) batch.delete(doc(db, 'groups', CLOUD_GROUP_ID, 'vocabularyChunks', index.toString().padStart(4, '0')))
    await batch.commit()
  }
  const totalBytes = chunks.reduce((sum, payload) => sum + encoder.encode(payload).byteLength, 0)
  await setDoc(manifestRef, { chunkCount: chunks.length, entryCount: entries.length, totalBytes, chunkHashes, uploadedBy: user.uid, updatedAt: serverTimestamp(), schemaVersion: 1 })
  return { entries: entries.length, chunks: chunks.length }
}

export async function deleteUnusedInvite(user: User, token: string) {
  const access = await resolveCloudAccess(user)
  if (!access.owner) return
  await deleteDoc(doc(services().db, 'invites', token))
}
