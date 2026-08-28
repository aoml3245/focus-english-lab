import { QUESTION_BANK } from './bank'
import type { BaseItem, ItemKind, Section } from './types'

export const EXAM_PACK_FORMAT = 'focus-english-lab.exam-pack'
export const EXAM_PACK_VERSION = 1
const STORAGE_KEY = 'focus-english-lab.exam-pack:v1'

const SECTIONS = new Set<Section>(['reading', 'listening', 'writing', 'speaking'])
const KINDS = new Set<ItemKind>(['complete-words', 'multiple-choice', 'listen-choice', 'sentence-build', 'email', 'discussion', 'repeat', 'interview'])

export interface ExamPack {
  format: typeof EXAM_PACK_FORMAT
  version: typeof EXAM_PACK_VERSION
  title: string
  createdAt: string
  items: BaseItem[]
}

export type ExamPackInfo = { title: string; itemCount: number; source: 'built-in' | 'imported' }

function isItem(value: unknown): value is BaseItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<BaseItem>
  if (!item.id || typeof item.id !== 'string' || !item.title || typeof item.title !== 'string') return false
  if (!item.section || !SECTIONS.has(item.section) || !item.kind || !KINDS.has(item.kind)) return false
  if (!Number.isFinite(item.module) || !Number.isFinite(item.timeSeconds) || item.timeSeconds! <= 0 || typeof item.instruction !== 'string') return false
  if (item.options !== undefined && (!Array.isArray(item.options) || item.options.some((option) => typeof option !== 'string'))) return false
  if (typeof item.answer === 'number' && (!item.options || item.answer < 0 || item.answer >= item.options.length)) return false
  const hasOptionsAndIndex = Array.isArray(item.options) && item.options.length >= 2 && Number.isInteger(item.answer)
  switch (item.kind) {
    case 'complete-words': return typeof item.passage === 'string' && item.passage.length > 0 && typeof item.answer === 'string'
    case 'multiple-choice': return typeof item.passage === 'string' && item.passage.length > 0 && typeof item.prompt === 'string' && hasOptionsAndIndex
    case 'listen-choice': return typeof item.audioText === 'string' && item.audioText.length > 0 && hasOptionsAndIndex
    case 'sentence-build': return typeof item.prompt === 'string' && typeof item.starter === 'string' && Array.isArray(item.words) && item.words.length > 0 && item.words.every((word) => typeof word === 'string') && typeof item.answer === 'string'
    case 'email':
    case 'discussion': return typeof item.prompt === 'string' && item.prompt.length > 0
    case 'repeat':
    case 'interview': return typeof item.audioText === 'string' && item.audioText.length > 0
  }
}

export function parseExamPack(value: unknown): ExamPack {
  if (!value || typeof value !== 'object') throw new Error('시험 데이터 파일의 최상위 형식이 올바르지 않습니다.')
  const pack = value as Partial<ExamPack>
  if (pack.format !== EXAM_PACK_FORMAT || pack.version !== EXAM_PACK_VERSION) throw new Error('지원하지 않는 시험 데이터 파일입니다.')
  if (!pack.title || typeof pack.title !== 'string' || !Array.isArray(pack.items) || pack.items.length === 0) throw new Error('시험 이름 또는 문항이 없습니다.')
  if (pack.items.length > 10_000) throw new Error('한 파일에는 최대 10,000문항까지 넣을 수 있습니다.')
  if (!pack.items.every(isItem)) throw new Error('필수 항목이 없거나 정답 범위가 잘못된 문항이 있습니다.')
  const ids = new Set(pack.items.map((item) => item.id))
  if (ids.size !== pack.items.length) throw new Error('문항 ID가 중복되어 있습니다.')
  return { format: EXAM_PACK_FORMAT, version: EXAM_PACK_VERSION, title: pack.title.trim(), createdAt: typeof pack.createdAt === 'string' ? pack.createdAt : new Date().toISOString(), items: pack.items }
}

export function createExamPack(items: BaseItem[], title = 'Focus English Lab 기본 문제은행'): ExamPack {
  return { format: EXAM_PACK_FORMAT, version: EXAM_PACK_VERSION, title, createdAt: new Date().toISOString(), items }
}

export function loadImportedExamPack(): ExamPack | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? parseExamPack(JSON.parse(stored)) : null
  } catch { return null }
}

export function getActivePracticeItems() {
  return loadImportedExamPack()?.items || QUESTION_BANK
}

export function getAvailablePracticeItems() {
  const imported = loadImportedExamPack()?.items || []
  const byId = new Map(QUESTION_BANK.map((item) => [item.id, item]))
  imported.forEach((item) => byId.set(item.id, item))
  return [...byId.values()]
}

export function getActiveExamPackInfo(): ExamPackInfo {
  const imported = loadImportedExamPack()
  return imported
    ? { title: imported.title, itemCount: imported.items.length, source: 'imported' }
    : { title: 'Focus English Lab 기본 문제은행', itemCount: QUESTION_BANK.length, source: 'built-in' }
}

export function saveImportedExamPack(pack: ExamPack) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(parseExamPack(pack)))
}

export function clearImportedExamPack() {
  localStorage.removeItem(STORAGE_KEY)
}

export function downloadExamPack(pack: ExamPack, filename = 'focus-english-lab-exam-pack.felpack.json') {
  const url = URL.createObjectURL(new Blob([JSON.stringify(pack)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

const shuffled = <T,>(values: T[]) => {
  const result = [...values]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const random = new Uint32Array(1)
    crypto.getRandomValues(random)
    const j = random[0] % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const pick = (bank: BaseItem[], test: (item: BaseItem) => boolean, count: number, excludedIds: ReadonlySet<string>) => shuffled(bank.filter((item) => test(item) && !excludedIds.has(item.id))).slice(0, count)
const title = (value: string) => (item: BaseItem) => item.title === value
const NO_EXCLUSIONS = new Set<string>()

export type PracticeTaskType = { title: string; label: string; description: string; candidateCount: number; setSize: number }

const TASK_META: Record<string, { label: string; description: string; setSize: number }> = {
  'Complete the Words': { label: 'Complete the Words', description: '문맥과 철자를 이용해 빠진 글자를 완성합니다.', setSize: 6 },
  'Read in Daily Life': { label: 'Read in Daily Life', description: '공지·안내·메시지 같은 실용문을 읽고 답합니다.', setSize: 10 },
  'Read an Academic Passage': { label: 'Read an Academic Passage', description: '학술 지문의 핵심 내용과 추론을 연습합니다.', setSize: 10 },
  'Listen and Choose a Response': { label: 'Choose a Response', description: '짧은 질문을 듣고 가장 자연스러운 응답을 고릅니다.', setSize: 10 },
  'Listen to a Conversation': { label: 'Conversation', description: '캠퍼스 대화의 목적·문제·해결책을 파악합니다.', setSize: 8 },
  'Listen to an Announcement': { label: 'Announcement', description: '공지의 변경 사항과 필요한 행동을 파악합니다.', setSize: 8 },
  'Listen to an Academic Talk': { label: 'Academic Talk', description: '강의의 중심 생각·세부 정보·관계를 듣습니다.', setSize: 8 },
  'Build a Sentence': { label: 'Build a Sentence', description: '섞인 단어와 짧은 구를 문법에 맞게 배열합니다.', setSize: 10 },
  'Write an Email': { label: 'Write an Email', description: '목적·상황·요청을 갖춘 이메일을 작성합니다.', setSize: 3 },
  'Write for an Academic Discussion': { label: 'Academic Discussion', description: '입장과 근거를 제시하고 다른 의견에 기여합니다.', setSize: 2 },
  'Listen and Repeat': { label: 'Listen and Repeat', description: '문장을 듣고 준비 시간 없이 그대로 말합니다.', setSize: 10 },
  'Take an Interview': { label: 'Take an Interview', description: '면접형 질문을 듣고 충분한 길이로 답합니다.', setSize: 6 },
}

const fallbackTaskDescription = (kind: ItemKind) => ({
  'complete-words': '문맥 속 단어 완성 유형을 연습합니다.',
  'multiple-choice': '지문을 읽고 객관식 질문에 답합니다.',
  'listen-choice': '음성을 듣고 객관식 질문에 답합니다.',
  'sentence-build': '문장 구성 유형을 연습합니다.',
  email: '이메일 쓰기 유형을 연습합니다.',
  discussion: '학술 토론 쓰기 유형을 연습합니다.',
  repeat: '듣고 따라 말하기 유형을 연습합니다.',
  interview: '인터뷰 말하기 유형을 연습합니다.',
})[kind]

export function getPracticeTaskTypesFrom(bank: BaseItem[], section: Section, excludedIds: ReadonlySet<string> = NO_EXCLUSIONS): PracticeTaskType[] {
  const grouped = new Map<string, { count: number; kind: ItemKind }>()
  for (const item of bank) {
    if (item.section !== section || excludedIds.has(item.id)) continue
    const current = grouped.get(item.title)
    grouped.set(item.title, { count: (current?.count || 0) + 1, kind: item.kind })
  }
  return [...grouped.entries()].map(([taskTitle, value]) => {
    const meta = TASK_META[taskTitle]
    return {
      title: taskTitle,
      label: meta?.label || taskTitle,
      description: meta?.description || fallbackTaskDescription(value.kind),
      candidateCount: value.count,
      setSize: Math.min(value.count, meta?.setSize || 10),
    }
  }).sort((a, b) => {
    const knownTitles = Object.keys(TASK_META)
    const aIndex = knownTitles.indexOf(a.title)
    const bIndex = knownTitles.indexOf(b.title)
    return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex) || a.label.localeCompare(b.label)
  })
}

export function buildTaskPracticeFrom(bank: BaseItem[], section: Section, taskTitle: string, excludedIds: ReadonlySet<string> = NO_EXCLUSIONS) {
  const task = getPracticeTaskTypesFrom(bank, section, excludedIds).find((candidate) => candidate.title === taskTitle)
  return task ? pick(bank, (item) => item.section === section && item.title === taskTitle, task.setSize, excludedIds) : []
}

export const buildFullPracticeSetFrom = (bank: BaseItem[], excludedIds: ReadonlySet<string> = NO_EXCLUSIONS) => [
  ...pick(bank, (item) => item.section === 'reading' && item.kind === 'complete-words', 2, excludedIds), ...pick(bank, title('Read in Daily Life'), 6, excludedIds), ...pick(bank, title('Read an Academic Passage'), 8, excludedIds),
  ...pick(bank, title('Listen and Choose a Response'), 8, excludedIds), ...pick(bank, (item) => item.section === 'listening' && item.title !== 'Listen and Choose a Response', 8, excludedIds),
  ...pick(bank, title('Build a Sentence'), 10, excludedIds), ...pick(bank, title('Write an Email'), 1, excludedIds), ...pick(bank, title('Write for an Academic Discussion'), 1, excludedIds),
  ...pick(bank, title('Listen and Repeat'), 7, excludedIds), ...pick(bank, title('Take an Interview'), 4, excludedIds),
]

export const buildSectionPracticeFrom = (bank: BaseItem[], section: Section, excludedIds: ReadonlySet<string> = NO_EXCLUSIONS) => section === 'writing'
  ? [...pick(bank, title('Build a Sentence'), 10, excludedIds), ...pick(bank, title('Write an Email'), 1, excludedIds), ...pick(bank, title('Write for an Academic Discussion'), 1, excludedIds)]
  : section === 'speaking'
    ? [...pick(bank, title('Listen and Repeat'), 7, excludedIds), ...pick(bank, title('Take an Interview'), 4, excludedIds)]
    : pick(bank, (item) => item.section === section, 16, excludedIds)

export const countBySectionFrom = (bank: BaseItem[], section: Section, excludedIds: ReadonlySet<string> = NO_EXCLUSIONS) => bank.filter((item) => item.section === section && !excludedIds.has(item.id)).length
