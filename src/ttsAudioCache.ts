const DB_NAME = 'focus-english-lab-tts-audio'
const STORE_NAME = 'clips'
const DB_VERSION = 1

export const TTS_AUDIO_CACHE_MAX_BYTES = 64 * 1024 * 1024
export const TTS_AUDIO_CACHE_MAX_ENTRIES = 200

type StoredSpeech = {
  key: string
  blobs: Blob[]
  size: number
  accessedAt: number
}

let databasePromise: Promise<IDBDatabase> | null = null

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.resolve<IDBDatabase | null>(null)
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error('음성 캐시를 열지 못했습니다.'))
    })
  }
  return databasePromise
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('음성 캐시 요청을 처리하지 못했습니다.'))
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('음성 캐시 저장에 실패했습니다.'))
    transaction.onabort = () => reject(transaction.error || new Error('음성 캐시 저장이 중단됐습니다.'))
  })
}

export async function readCachedSpeech(key: string) {
  try {
    const database = await openDatabase()
    if (!database) return null
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const done = transactionDone(transaction)
    const store = transaction.objectStore(STORE_NAME)
    const stored = await requestResult(store.get(key)) as StoredSpeech | undefined
    if (!stored?.blobs?.length) return null
    stored.accessedAt = Date.now()
    store.put(stored)
    await done
    return stored.blobs
  } catch {
    return null
  }
}

async function trimCache(database: IDBDatabase) {
  const read = database.transaction(STORE_NAME, 'readonly')
  const readDone = transactionDone(read)
  const entries = await requestResult(read.objectStore(STORE_NAME).getAll()) as StoredSpeech[]
  await readDone
  entries.sort((a, b) => b.accessedAt - a.accessedAt)
  let retainedBytes = 0
  const remove: string[] = []
  entries.forEach((entry, index) => {
    const keep = index < TTS_AUDIO_CACHE_MAX_ENTRIES && retainedBytes + entry.size <= TTS_AUDIO_CACHE_MAX_BYTES
    if (keep) retainedBytes += entry.size
    else remove.push(entry.key)
  })
  if (!remove.length) return
  const cleanup = database.transaction(STORE_NAME, 'readwrite')
  const cleanupDone = transactionDone(cleanup)
  remove.forEach((key) => cleanup.objectStore(STORE_NAME).delete(key))
  await cleanupDone
}

export async function cacheSpeech(key: string, blobs: Blob[]) {
  const size = blobs.reduce((total, blob) => total + blob.size, 0)
  if (!blobs.length || size > TTS_AUDIO_CACHE_MAX_BYTES / 2) return
  try {
    const database = await openDatabase()
    if (!database) return
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const done = transactionDone(transaction)
    transaction.objectStore(STORE_NAME).put({ key, blobs, size, accessedAt: Date.now() } satisfies StoredSpeech)
    await done
    await trimCache(database)
  } catch {
    // Storage pressure or private browsing must never block playback.
  }
}
