export type LearningEntry = {
  word: string
  meaningKo: string
  meaningEn: string
  partOfSpeech: string
  cefr: string
  ipa: string
  synonyms: string[]
  example: string
  translation: string
  frequency: number
  topics: string[]
  academicCore?: boolean
  source?: 'dictionary' | 'local-llm'
  context?: string
  savedAt?: string
}

export type LocalLlmConfig = {
  endpoint: string
  model: string
}

export const FAVORITES_KEY = 'focus-english-lab:vocabulary-favorites:v1'
export const PERSONAL_WORDS_KEY = 'focus-english-lab:personal-vocabulary:v1'
const LLM_CONFIG_KEY = 'focus-english-lab:local-llm:v1'
const DEFAULT_CONFIG: LocalLlmConfig = { endpoint: 'http://127.0.0.1:11434', model: 'translategemma:latest' }

let vocabularyRequest: Promise<LearningEntry[]> | null = null

export function requestVocabulary() {
  vocabularyRequest ||= fetch(`${import.meta.env.BASE_URL}vocabulary.json`).then((response) => {
    if (!response.ok) throw new Error('단어장 데이터를 불러오지 못했습니다.')
    return response.json() as Promise<LearningEntry[]>
  })
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
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...words])) } catch { /* storage can be disabled */ }
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
  try { localStorage.setItem(PERSONAL_WORDS_KEY, JSON.stringify(next)) } catch { /* storage can be disabled */ }
  const favorites = loadFavorites()
  favorites.add(word)
  saveFavorites(favorites)
  return next[0]
}

export function removePersonalWord(word: string) {
  const normalized = normalizeWord(word)
  try { localStorage.setItem(PERSONAL_WORDS_KEY, JSON.stringify(loadPersonalWords().filter((item) => normalizeWord(item.word) !== normalized))) } catch { /* storage can be disabled */ }
}

export function loadLocalLlmConfig(): LocalLlmConfig {
  try {
    const stored = JSON.parse(localStorage.getItem(LLM_CONFIG_KEY) || 'null')
    if (stored?.endpoint && stored?.model) return stored
  } catch { /* use defaults */ }
  return DEFAULT_CONFIG
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
