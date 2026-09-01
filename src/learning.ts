export type LearningSense = {
  senseId: string
  meaningKo: string
  meaningEn: string
  partOfSpeech: string
  synonyms: string[]
}

import { notifyPrivateDataChanged } from './privateDataEvents'

export type LearningEntry = {
  word: string
  meaningKo: string
  personalMeaningKo?: string
  dictionaryMeaningKo?: string
  meaningEn: string
  partOfSpeech: string
  cefr: string
  ipa: string
  synonyms: string[]
  meanings?: LearningSense[]
  example: string
  translation: string
  frequency: number
  frequencyRank?: number
  topics: string[]
  academicCore?: boolean
  source?: 'corpus' | 'dictionary' | 'local-llm'
  context?: string
  savedAt?: string
  meaningReview?: string
  translationRepairs?: number
}

export type LocalLlmConfig = {
  endpoint: string
  model: string
}

export const FAVORITES_KEY = 'focus-english-lab:vocabulary-favorites:v1'
export const PERSONAL_WORDS_KEY = 'focus-english-lab:personal-vocabulary:v1'
export const DELETED_PERSONAL_WORDS_KEY = 'focus-english-lab:deleted-personal-words:v1'
const LLM_CONFIG_KEY = 'focus-english-lab:local-llm:v1'
const DEFAULT_CONFIG: LocalLlmConfig = { endpoint: 'http://127.0.0.1:11434', model: 'translategemma:latest' }

let vocabularyRequest: Promise<LearningEntry[]> | null = null

type PublicVocabularyManifest = {
  entryCount: number
  totalBytes: number
  chunks: Array<{ file: string; count: number; bytes: number; sha256: string }>
}

async function fetchPublicVocabularyChunk(url: URL, expectedCount: number, index: number) {
  let failure: unknown = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { cache: attempt === 0 ? 'default' : 'reload' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const entries = await response.json() as LearningEntry[]
      if (!Array.isArray(entries) || entries.length !== expectedCount) throw new Error('항목 수 불일치')
      return entries
    } catch (error) {
      failure = error
      if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)))
    }
  }
  throw new Error(`공개 기본 단어장 ${index + 1}번 조각을 불러오지 못했습니다.`, { cause: failure })
}

async function fetchPublicVocabulary(onProgress?: (progress: import('./cloudSync').VocabularyDownloadProgress) => void) {
  const manifestUrl = new URL('data/vocabulary/manifest.json', document.baseURI)
  onProgress?.({ phase: 'manifest', completedChunks: 0, totalChunks: 0, downloadedBytes: 0, loadedEntries: 0, cachedChunks: 0 })
  const manifestResponse = await fetch(manifestUrl, { cache: 'no-store' })
  if (!manifestResponse.ok) throw new Error('공개 기본 단어장 정보를 불러오지 못했습니다.')
  const manifest = await manifestResponse.json() as PublicVocabularyManifest
  if (!manifest.entryCount || !Array.isArray(manifest.chunks) || !manifest.chunks.length) throw new Error('공개 기본 단어장 정보가 올바르지 않습니다.')
  const chunkEntries: LearningEntry[][] = new Array(manifest.chunks.length)
  let nextIndex = 0
  let completedChunks = 0
  let downloadedBytes = 0
  let loadedEntries = 0
  onProgress?.({ phase: 'downloading', completedChunks, totalChunks: manifest.chunks.length, downloadedBytes, totalBytes: manifest.totalBytes, loadedEntries, cachedChunks: 0 })
  const worker = async () => {
    while (nextIndex < manifest.chunks.length) {
      const index = nextIndex++
      const chunk = manifest.chunks[index]
      const url = new URL(chunk.file, manifestUrl)
      url.searchParams.set('sha', chunk.sha256)
      const entries = await fetchPublicVocabularyChunk(url, chunk.count, index)
      chunkEntries[index] = entries
      completedChunks += 1
      downloadedBytes += chunk.bytes
      loadedEntries += entries.length
      onProgress?.({ phase: 'downloading', completedChunks, totalChunks: manifest.chunks.length, downloadedBytes, totalBytes: manifest.totalBytes, loadedEntries, cachedChunks: 0 })
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, manifest.chunks.length) }, () => worker()))
  onProgress?.({ phase: 'processing', completedChunks, totalChunks: manifest.chunks.length, downloadedBytes, totalBytes: manifest.totalBytes, loadedEntries, cachedChunks: 0 })
  const entries = chunkEntries.flat()
  if (entries.length !== manifest.entryCount) throw new Error('공개 기본 단어장 항목 수가 일치하지 않습니다.')
  onProgress?.({ phase: 'done', completedChunks, totalChunks: manifest.chunks.length, downloadedBytes, totalBytes: manifest.totalBytes, loadedEntries: entries.length, cachedChunks: 0 })
  return entries
}

export function requestVocabulary(onProgress?: (progress: import('./cloudSync').VocabularyDownloadProgress) => void) {
  vocabularyRequest ||= (async () => {
    if (import.meta.env.PROD) return fetchPublicVocabulary(onProgress)
    const response = await fetch('/__private/vocabulary.json')
    if (!response.ok) throw new Error('단어장 데이터를 불러오지 못했습니다.')
    return response.json() as Promise<LearningEntry[]>
  })()
  return vocabularyRequest
}

export function normalizeWord(value: string) {
  return value.toLowerCase().replace(/^[^a-z]+|[^a-z'-]+$/g, '')
}

export function loadFavorites() {
  try {
    const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')
    return new Set<string>(Array.isArray(stored) ? stored.map(normalizeWord).filter(Boolean) : [])
  } catch { return new Set<string>() }
}

export function saveFavorites(words: Set<string>) {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...words])); notifyPrivateDataChanged() } catch { /* storage can be disabled */ }
}

export function loadPersonalWords() {
  try {
    const stored = JSON.parse(localStorage.getItem(PERSONAL_WORDS_KEY) || '[]')
    return Array.isArray(stored) ? stored as LearningEntry[] : []
  } catch { return [] }
}

export function savePersonalWord(entry: LearningEntry) {
  const word = normalizeWord(entry.word)
  const current = loadPersonalWords()
  const next = [{ ...entry, word, savedAt: new Date().toISOString() }, ...current.filter((item) => normalizeWord(item.word) !== word)]
  try {
    localStorage.setItem(PERSONAL_WORDS_KEY, JSON.stringify(next))
    const deleted = JSON.parse(localStorage.getItem(DELETED_PERSONAL_WORDS_KEY) || '{}') as Record<string, string>
    delete deleted[word]
    localStorage.setItem(DELETED_PERSONAL_WORDS_KEY, JSON.stringify(deleted))
    notifyPrivateDataChanged()
  } catch { /* storage can be disabled */ }
  const favorites = loadFavorites()
  favorites.add(word)
  saveFavorites(favorites)
  return next[0]
}

export function removePersonalWord(word: string) {
  const normalized = normalizeWord(word)
  try { localStorage.setItem(PERSONAL_WORDS_KEY, JSON.stringify(loadPersonalWords().filter((item) => normalizeWord(item.word) !== normalized))); notifyPrivateDataChanged() } catch { /* storage can be disabled */ }
}

export function loadLocalLlmConfig(): LocalLlmConfig {
  try {
    const stored = JSON.parse(localStorage.getItem(LLM_CONFIG_KEY) || 'null')
    if (stored?.endpoint && stored?.model) return stored
  } catch { /* use defaults */ }
  return DEFAULT_CONFIG
}

export function saveLocalLlmConfig(config: LocalLlmConfig) {
  const endpoint = config.endpoint.trim().replace(/\/$/, '')
  const model = config.model.trim()
  if (!endpoint || !model) throw new Error('서버 주소와 모델 이름을 모두 입력해 주세요.')
  try { localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify({ endpoint, model })) } catch { throw new Error('브라우저에 설정을 저장하지 못했습니다.') }
  return { endpoint, model }
}

export async function findLocalModels(config = loadLocalLlmConfig()) {
  const response = await fetch(`${config.endpoint.replace(/\/$/, '')}/api/tags`, { signal: AbortSignal.timeout(2500) })
  if (!response.ok) throw new Error('로컬 LLM 서버에 연결할 수 없습니다.')
  const data = await response.json() as { models?: Array<{ name: string }> }
  return data.models?.map((item) => item.name) || []
}

async function generateJson<T>(prompt: string, config = loadLocalLlmConfig()): Promise<T> {
  const response = await fetch(`${config.endpoint.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, prompt, stream: false, format: 'json', options: { temperature: 0.15 } }),
    signal: AbortSignal.timeout(90000),
  })
  if (!response.ok) throw new Error(`로컬 LLM 응답 오류 (${response.status})`)
  const payload = await response.json() as { response?: string }
  if (!payload.response) throw new Error('로컬 LLM 응답이 비어 있습니다.')
  return JSON.parse(payload.response) as T
}

async function generateText(prompt: string, config = loadLocalLlmConfig()) {
  const response = await fetch(`${config.endpoint.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, prompt, stream: false, options: { temperature: 0.1 } }),
    signal: AbortSignal.timeout(90000),
  })
  if (!response.ok) throw new Error(`로컬 LLM 응답 오류 (${response.status})`)
  const payload = await response.json() as { response?: string }
  if (!payload.response) throw new Error('로컬 LLM 응답이 비어 있습니다.')
  return payload.response.trim()
}

const translationPrompt = (text: string) =>
  'You are a professional English (en) to Korean (ko) translator. Your goal is to accurately convey the meaning and nuances of the original English text while adhering to Korean grammar, vocabulary, and cultural sensitivities.\n' +
  'Produce only the Korean translation, without any additional explanations or commentary. Please translate the following English text into Korean:\n\n' + text

export async function findDictionaryEntry(word: string) {
  const normalized = normalizeWord(word)
  const entries = await requestVocabulary()
  return entries.find((entry) => normalizeWord(entry.word) === normalized) || null
}

export async function analyzeWordWithLocalLlm(word: string, sentence: string, fallback?: LearningEntry | null): Promise<LearningEntry> {
  const normalized = normalizeWord(word)
  const config = loadLocalLlmConfig()
  if (config.model.toLowerCase().includes('translategemma')) {
    const [meaningKo, sentenceTranslation] = await Promise.all([
      fallback?.meaningKo ? Promise.resolve(fallback.meaningKo) : generateText(translationPrompt(normalized), config),
      generateText(translationPrompt(sentence), config),
    ])
    return {
      word: normalized,
      meaningKo: meaningKo.trim() || '뜻을 확인하지 못했습니다.',
      meaningEn: fallback?.meaningEn || '',
      partOfSpeech: fallback?.partOfSpeech || 'word',
      cefr: fallback?.cefr || '—',
      ipa: fallback?.ipa || '',
      synonyms: (fallback?.synonyms || []).slice(0, 3),
      example: sentence,
      translation: sentenceTranslation,
      frequency: fallback?.frequency || 1,
      topics: fallback?.topics || ['내가 만든 단어장'],
      source: 'local-llm',
      context: sentence,
    }
  }
  const result = await generateJson<{ meaningKo?: string; meaningEn?: string; partOfSpeech?: string; synonyms?: string[]; sentenceTranslation?: string }>(
    `You are a TOEFL vocabulary tutor. Analyze the English word "${normalized}" as used in this sentence: "${sentence}". ` +
    'Return only JSON with keys meaningKo (concise Korean contextual meaning), meaningEn (concise English definition), partOfSpeech, synonyms (exactly 3 context-appropriate English synonyms), and sentenceTranslation (natural Korean translation).',
  )
  return {
    word: normalized,
    meaningKo: result.meaningKo || fallback?.meaningKo || '뜻을 확인하지 못했습니다.',
    meaningEn: result.meaningEn || fallback?.meaningEn || '',
    partOfSpeech: result.partOfSpeech || fallback?.partOfSpeech || 'word',
    cefr: fallback?.cefr || '—',
    ipa: fallback?.ipa || '',
    synonyms: (result.synonyms || fallback?.synonyms || []).slice(0, 3),
    example: sentence,
    translation: result.sentenceTranslation || fallback?.translation || '',
    frequency: fallback?.frequency || 1,
    topics: fallback?.topics || ['내가 만든 단어장'],
    source: 'local-llm',
    context: sentence,
  }
}

export async function translateSentenceWithLocalLlm(sentence: string) {
  const config = loadLocalLlmConfig()
  if (config.model.toLowerCase().includes('translategemma')) {
    return { translation: await generateText(translationPrompt(sentence), config), note: '로컬 TranslateGemma가 문맥을 반영해 번역했습니다.' }
  }
  const result = await generateJson<{ translation?: string; note?: string }>(
    `Translate this TOEFL-style English sentence into natural Korean and briefly explain one difficult grammar or expression. Sentence: "${sentence}". ` +
    'Return only JSON with keys translation and note.',
  )
  return { translation: result.translation || '', note: result.note || '' }
}
