import type { BaseItem } from './types'

export type WritingCriterion = {
  name: '과제 수행' | '내용 전개' | '구성과 응집성' | '문법·어휘' | '어조·관습'
  score: number
  feedback: string
}

export type WritingIssue = {
  quote: string
  category: 'grammar' | 'vocabulary' | 'clarity' | 'organization' | 'tone'
  explanationKo: string
  correction: string
}

export type WritingFeedback = {
  estimatedScore: number
  cefr: string
  verdict: string
  strengths: string[]
  criteria: WritingCriterion[]
  issues: WritingIssue[]
  revisionPlan: string[]
  revisedResponse: string
  model: string
  createdAt: string
}

export type CoachModelStatus = { connected: boolean; selected: string; installed: string[]; recommendedInstalled: boolean }

const CONFIG_KEY = 'focus-english-lab:writing-coach-config:v1'
const FEEDBACK_KEY = 'focus-english-lab:writing-coach-feedback:v1'
const ENDPOINT = 'http://127.0.0.1:11434'
const RECOMMENDED = 'qwen3.5:9b'
const FALLBACK_ORDER = [RECOMMENDED, 'qwen3.5:4b', 'gemma3:12b', 'gemma3:4b', 'qwen3:8b']

const FEEDBACK_SCHEMA = {
  type: 'object',
  properties: {
    estimatedScore: { type: 'number', minimum: 0, maximum: 5 },
    cefr: { type: 'string', description: 'A short CEFR-style level label.' },
    verdict: { type: 'string', description: 'One concise sentence written only in Korean.' },
    strengths: { type: 'array', items: { type: 'string', description: 'A specific strength written only in Korean.' }, minItems: 2, maxItems: 3 },
    criteria: {
      type: 'array', minItems: 5, maxItems: 5,
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, score: { type: 'number', minimum: 0, maximum: 5 }, feedback: { type: 'string', description: 'Criterion feedback written only in Korean.' } },
        required: ['name', 'score', 'feedback'],
      },
    },
    issues: {
      type: 'array', maxItems: 8,
      items: {
        type: 'object',
        properties: { quote: { type: 'string' }, category: { type: 'string' }, explanationKo: { type: 'string', description: 'A concise explanation written only in Korean.' }, correction: { type: 'string' } },
        required: ['quote', 'category', 'explanationKo', 'correction'],
      },
    },
    revisionPlan: { type: 'array', items: { type: 'string', description: 'An actionable revision step written only in Korean.' }, minItems: 3, maxItems: 4 },
    revisedResponse: { type: 'string' },
  },
  required: ['estimatedScore', 'cefr', 'verdict', 'strengths', 'criteria', 'issues', 'revisionPlan', 'revisedResponse'],
}

function loadSelectedModel() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null')?.model || RECOMMENDED } catch { return RECOMMENDED }
}

export function saveSelectedCoachModel(model: string) {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify({ model })) } catch { /* storage can be disabled */ }
}

export async function getCoachModelStatus(): Promise<CoachModelStatus> {
  try {
    const response = await fetch(`${ENDPOINT}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!response.ok) throw new Error('Ollama unavailable')
    const data = await response.json() as { models?: Array<{ name: string }> }
    const installed = data.models?.map((item) => item.name) || []
    const saved = loadSelectedModel()
    const selected = installed.includes(saved) ? saved : FALLBACK_ORDER.find((model) => installed.includes(model)) || saved
    return { connected: true, selected, installed, recommendedInstalled: installed.includes(RECOMMENDED) }
  } catch { return { connected: false, selected: loadSelectedModel(), installed: [], recommendedInstalled: false } }
}

const systemPrompt = `You are a demanding but encouraging TOEFL writing coach. Base the evaluation on the official 0-5 TOEFL Writing criteria. Evaluate task fulfillment and elaboration, organization and cohesion, syntactic variety, precise and idiomatic vocabulary, lexical and grammatical accuracy, and appropriate politeness/register/social conventions when the task is an email.

Your job is teaching, not merely correcting. Identify the highest-leverage changes, quote only text that actually appears in the learner response, explain every issue in concise Korean, preserve the learner's intended ideas, and produce a realistic improved response at roughly the learner's level plus one step. Do not invent personal facts. Before returning, silently verify that every correction is grammatical, says exactly what its Korean explanation claims, and also appears correctly in the revised response. A score is an unofficial practice estimate, not an ETS score. Return every explanatory field in Korean, while quotes, corrections, and revisedResponse remain in English.`

function taskPrompt(item: BaseItem, response: string) {
  const type = item.kind === 'email' ? 'Write an Email' : 'Write for an Academic Discussion'
  return `TASK TYPE: ${type}\nTOPIC: ${item.topic || ''}\nINSTRUCTION: ${item.instruction}\nPROMPT: ${item.prompt || ''}\nCONTEXT/STIMULUS:\n${item.passage || '(none)'}\n\nLEARNER RESPONSE (${response.trim().split(/\s+/).length} words):\n${response}\n\nScore and coach this response. The criteria array must use exactly these Korean names in this order: 과제 수행, 내용 전개, 구성과 응집성, 문법·어휘, 어조·관습. For Academic Discussion, 어조·관습 means appropriate academic discussion tone and contribution to the exchange.`
}

export async function coachWriting(item: BaseItem, responseText: string): Promise<WritingFeedback> {
  const status = await getCoachModelStatus()
  if (!status.connected) throw new Error('Ollama가 실행 중이지 않습니다.')
  if (!status.installed.includes(status.selected)) throw new Error(`${RECOMMENDED} 모델 설치가 필요합니다.`)
  if (status.selected.toLowerCase().includes('translate')) throw new Error('번역 전용 모델 대신 글쓰기 코칭용 모델을 선택해 주세요.')
  const response = await fetch(`${ENDPOINT}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: status.selected,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: taskPrompt(item, responseText) }],
      stream: false,
      format: FEEDBACK_SCHEMA,
      think: 'medium',
      options: { temperature: 0.15, num_ctx: 8192, num_predict: 2048 },
      keep_alive: '10m',
    }),
    signal: AbortSignal.timeout(180000),
  })
  if (!response.ok) throw new Error(`코칭 모델 응답 오류 (${response.status})`)
  const payload = await response.json() as { message?: { content?: string } }
  if (!payload.message?.content) throw new Error('코칭 결과가 비어 있습니다.')
  const parsed = JSON.parse(payload.message.content) as Omit<WritingFeedback, 'model' | 'createdAt'>
  const feedback = { ...parsed, estimatedScore: Math.max(0, Math.min(5, Number(parsed.estimatedScore))), model: status.selected, createdAt: new Date().toISOString() }
  saveWritingFeedback(item.id, responseText, feedback)
  return feedback
}

export async function askWritingCoach(item: BaseItem, responseText: string, feedback: WritingFeedback, question: string) {
  const status = await getCoachModelStatus()
  if (!status.connected || !status.installed.includes(status.selected)) throw new Error('글쓰기 코칭 모델에 연결할 수 없습니다.')
  const response = await fetch(`${ENDPOINT}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: status.selected,
      messages: [
        { role: 'system', content: `${systemPrompt}\nAnswer the learner's follow-up question in 3-5 concise Korean sentences. Use short English examples only when helpful.` },
        { role: 'user', content: `${taskPrompt(item, responseText)}\n\nPREVIOUS FEEDBACK:\n${JSON.stringify(feedback)}\n\nLEARNER QUESTION: ${question}` },
      ],
      stream: false,
      think: false,
      options: { temperature: 0.25, num_ctx: 4096, num_predict: 500 },
      keep_alive: '10m',
    }),
    signal: AbortSignal.timeout(120000),
  })
  if (!response.ok) throw new Error(`코칭 대화 오류 (${response.status})`)
  const payload = await response.json() as { message?: { content?: string } }
  return payload.message?.content?.trim() || '답변을 생성하지 못했습니다.'
}

function saveWritingFeedback(itemId: string, responseText: string, feedback: WritingFeedback) {
  try {
    const stored = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '{}')
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify({ ...stored, [itemId]: { responseText, feedback } }))
  } catch { /* storage can be disabled */ }
}

export function loadWritingFeedback(itemId: string, responseText: string) {
  try {
    const saved = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '{}')?.[itemId]
    return saved?.responseText === responseText ? saved.feedback as WritingFeedback : null
  } catch { return null }
}
