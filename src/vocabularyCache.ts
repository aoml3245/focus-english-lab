const DATABASE_NAME = 'focus-english-lab-private-vocabulary'
const STORE_NAME = 'chunks'
const DATABASE_VERSION = 1

type VocabularyChunkRecord = {
  key: string
  groupId: string
  index: number
  hash: string
  payload: string
  bytes: number
  cachedAt: string
}

const requestResult = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error || new Error('단어장 캐시를 읽지 못했습니다.'))
})

const transactionDone = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve()
  transaction.onerror = () => reject(transaction.error || new Error('단어장 캐시를 저장하지 못했습니다.'))
  transaction.onabort = () => reject(transaction.error || new Error('단어장 캐시 저장이 취소됐습니다.'))
})

async function openVocabularyCache() {
  if (!('indexedDB' in window)) throw new Error('이 브라우저는 단어장 캐시를 지원하지 않습니다.')
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'key' })
  }
  return requestResult(request)
}

const chunkKey = (groupId: string, index: number) => `${groupId}:${index.toString().padStart(4, '0')}`

export async function hashVocabularyChunk(payload: string) {
  const bytes = new TextEncoder().encode(payload)
  if (crypto.subtle) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    return [...digest].map((value) => value.toString(16).padStart(2, '0')).join('')
  }
  let hash = 2166136261
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619)
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export async function loadCachedVocabularyChunks(groupId: string, expectedHashes: string[]) {
  if (!expectedHashes.length) return [] as Array<string | null>
  const database = await openVocabularyCache()
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const done = transactionDone(transaction)
    const store = transaction.objectStore(STORE_NAME)
    const records = await Promise.all(expectedHashes.map((_, index) => requestResult(store.get(chunkKey(groupId, index)) as IDBRequest<VocabularyChunkRecord | undefined>)))
    await done
    return records.map((record, index) => record?.hash === expectedHashes[index] && typeof record.payload === 'string' ? record.payload : null)
  } finally { database.close() }
}

export async function saveVocabularyChunks(groupId: string, chunks: Array<{ index: number; hash: string; payload: string }>) {
  if (!chunks.length) return
  const database = await openVocabularyCache()
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const done = transactionDone(transaction)
    const store = transaction.objectStore(STORE_NAME)
    const encoder = new TextEncoder()
    const cachedAt = new Date().toISOString()
    for (const chunk of chunks) {
      const record: VocabularyChunkRecord = { key: chunkKey(groupId, chunk.index), groupId, index: chunk.index, hash: chunk.hash, payload: chunk.payload, bytes: encoder.encode(chunk.payload).byteLength, cachedAt }
      store.put(record)
    }
    await done
  } finally { database.close() }
}
