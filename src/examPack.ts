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
  if (!Number.isFinite(item.module) || !Number.isFinite(item.timeSeconds) || item.timeSeconds! <= 0) return false
  if (item.options !== undefined && (!Array.isArray(item.options) || item.options.some((option) => typeof option !== 'string'))) return false
  if (typeof item.answer === 'number' && (!item.options || item.answer < 0 || item.answer >= item.options.length)) return false
  return true
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
