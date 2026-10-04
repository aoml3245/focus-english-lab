import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QUESTION_BANK, buildFullPracticeSet } from '../src/bank'
import { adaptivePreparationItems, advanceAdaptiveSession, attachAdaptivePlan } from '../src/adaptiveExam'
import { applyReviewAttempt, createReviewPractice, loadExamReview, recordExamReview, reviewQueue, setReviewReason } from '../src/examReviewLearning'
import { getSessionStats } from '../src/review'
import { saveWritingDraft, loadWritingPractice, mergeWritingPractice, preserveWritingEditor } from '../src/WritingWorkshop'
import { validateWritingFeedback } from '../src/writingCoachEngine'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import History from '../src/History'
import { SplitQuestion } from '../src/App'
import { clearAllSessionData, createSessionBackup, finishSession, getSessionStorageWarning, importSessionBackup, loadActive, loadHistory, saveActive } from '../src/storage'
import type { SavedSession } from '../src/types'

const base: SavedSession = { id: 'practice', startedAt: '', updatedAt: '', itemIndex: 0, answers: {}, completed: false, mode: 'mock' }
const now = '2026-10-04T09:00:00.000Z'
beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value), removeItem: (key: string) => store.delete(key) })
  vi.stubGlobal('window', { dispatchEvent: vi.fn() })
})
describe('learning upgrade', () => {
  it('renders mock reading without dictionary or translation assistance', () => {
    const item = QUESTION_BANK.find((candidate) => candidate.id === 'full-academic-01-0')!
    const html = renderToStaticMarkup(createElement(SplitQuestion, { item, answer: undefined, locked: false, showFeedback: false, onAnswer: () => {}, studyHelpers: false }))
    expect(html).toContain(renderToStaticMarkup(createElement('p', null, item.passage)))
    expect(html).not.toContain('읽기 도우미')
    expect(html).not.toContain('<!--$')
  })
  it('renders saved history and preserved writing drafts after a completed practice', () => {
    const item = QUESTION_BANK.find((item) => item.id === 'coached-email-01')!
    expect(item).toBeDefined()
    saveWritingDraft('history-test', item.id, 'Dear team, I need a later reservation.', [], now)
    finishSession({ ...base, id: 'history-test', startedAt: now, itemSnapshots: [item], itemIds: [item.id], answers: { [item.id]: 'Dear team, I need a later reservation.' } })
    expect(renderToStaticMarkup(createElement(History, { onBack: () => {} }))).toContain('정답과 해설 보기')
    expect(renderToStaticMarkup(createElement(History, { onBack: () => {}, initialSessionId: 'history-test' }))).toContain('문항별 정답과 해설')
  })
  it('plans complete branches of genuinely different authored difficulty and prepares every candidate', () => {
    const items = buildFullPracticeSet()
    const planned = attachAdaptivePlan(base, items, QUESTION_BANK)
    for (const section of ['reading', 'listening'] as const) {
      const pair = planned.adaptive!.candidates[section]!
      const weight = (level?: string) => level === 'C1' ? 2 : level === 'B2' ? 1 : 0
      expect(pair.lower).toHaveLength(section === 'reading' ? 12 : 23)
      expect(pair.upper).toHaveLength(pair.lower.length)
      expect(pair.upper.reduce((sum, item) => sum + weight(item.difficulty), 0)).toBeGreaterThan(pair.lower.reduce((sum, item) => sum + weight(item.difficulty), 0))
      expect(new Set([...pair.lower, ...pair.upper].map((item) => item.id)).size).toBe(pair.lower.length + pair.upper.length)
      const prepared = new Set(adaptivePreparationItems(planned, planned.itemSnapshots!).map((item) => item.id))
      expect([...pair.lower, ...pair.upper].every((item) => prepared.has(item.id))).toBe(true)
    }
  })
  it('routes on actual router answers only, preserves them, and never re-decides on revisiting', () => {
    const planned = attachAdaptivePlan(base, buildFullPracticeSet(), QUESTION_BANK)
    const items = planned.itemSnapshots!
    const boundary = items.findIndex((item) => item.section === 'reading' && item.module === 2)
    const router = items.filter((item) => item.section === 'reading' && item.module === 1)
    const answers = Object.fromEntries(router.map((item) => [item.id, item.kind === 'complete-words' ? String(item.answer).split('|') : item.answer!]))
    const session = { ...planned, itemIndex: boundary - 1, answers }
    expect(advanceAdaptiveSession(session, items, boundary - 1).adaptive!.decisions.reading).toBeUndefined()
    const upper = advanceAdaptiveSession(session, items, boundary, now)
    expect(upper.adaptive!.decisions.reading!.route).toBe('upper')
    expect(upper.answers).toEqual(answers)
    expect(upper.itemSnapshots!.filter((item) => item.section === 'reading' && item.module === 2).map((item) => item.id)).toEqual(upper.adaptive!.candidates.reading!.upper.map((item) => item.id))
    expect(advanceAdaptiveSession({ ...upper, itemIndex: boundary - 1, answers: {} }, upper.itemSnapshots!, boundary).adaptive!.decisions.reading!.route).toBe('upper')
    expect(advanceAdaptiveSession({ ...session, answers: {} }, items, boundary).adaptive!.decisions.reading!.route).toBe('lower')
  })
  it('does not attach adaptive branching to immediate feedback study', () => {
    expect(attachAdaptivePlan({ ...base, mode: 'study' }, buildFullPracticeSet(), QUESTION_BANK).adaptive).toBeUndefined()
  })
  it('reports section learning percentages rather than fabricated TOEFL bands', () => {
    const reading = QUESTION_BANK.find((item) => item.kind === 'multiple-choice')!
    const email = QUESTION_BANK.find((item) => item.kind === 'email')!
    const stats = getSessionStats([reading, email], { ...base, answers: { [reading.id]: reading.answer!, [email.id]: 'My actual email' } })
    expect(stats).not.toHaveProperty('practiceBand')
    expect(stats.sectionStats.find((stats) => stats.section === 'reading')).toMatchObject({ percent: 100 })
    expect(stats.sectionStats.find((stats) => stats.section === 'writing')).toMatchObject({ percent: null, constructedAnswered: 1 })
  })
  it('schedules mistakes and increasing recall intervals; repeated history scans are idempotent', () => {
    const item = QUESTION_BANK.find((item) => item.kind === 'multiple-choice')!
    let state = applyReviewAttempt({}, item, false, 'attempt-1', now)
    expect(state[item.id].dueAt).toBe('2026-10-04T09:10:00.000Z')
    expect(reviewQueue(state, true, now)).toHaveLength(0)
    state = applyReviewAttempt(state, item, true, 'attempt-2', now)
    expect(state[item.id].dueAt).toBe('2026-10-05T09:00:00.000Z')
    expect(applyReviewAttempt(state, item, false, 'attempt-1', now)).toEqual(state)
    state = applyReviewAttempt(state, item, true, 'attempt-3', now)
    expect(state[item.id].dueAt).toBe('2026-10-07T09:00:00.000Z')
    expect(state[item.id].wrongCount).toBe(1)
    recordExamReview(base, [item]); setReviewReason(item, ['추론 오류'])
    expect(loadExamReview()[item.id].reasons).toEqual(['추론 오류'])
  })
  it('distinguishes a preserved exact retry from a new similar stimulus', () => {
    const item = QUESTION_BANK.find((item) => item.kind === 'multiple-choice')!
    const state = applyReviewAttempt({}, item, false, 'attempt', now)
    expect(createReviewPractice(state, QUESTION_BANK, 'exact', false)).toEqual([item])
    const transfer = createReviewPractice(state, QUESTION_BANK, 'transfer', false)
    expect(transfer.length).toBeGreaterThan(0)
    expect(transfer.some((candidate) => candidate.id === item.id)).toBe(false)
    expect(transfer.every((candidate) => candidate.title === item.title)).toBe(true)
  })
  it('does not count an older correct session as a new success when reopening history after a mistake', () => {
    const item = QUESTION_BANK.find((item) => item.kind === 'multiple-choice')!
    const correct = { ...base, id: 'old-correct', completed: true, updatedAt: now, answers: { [item.id]: item.answer! } }
    const wrong = { ...base, id: 'new-wrong', completed: true, updatedAt: '2026-10-04T09:01:00.000Z' }
    recordExamReview(correct, [item]); recordExamReview(wrong, [item])
    const state = loadExamReview()
    recordExamReview(correct, [item]); recordExamReview(wrong, [item])
    expect(loadExamReview()).toEqual(state)
    expect(state[item.id]).toMatchObject({ correctStreak: 0, wrongCount: 1, dueAt: '2026-10-04T09:11:00.000Z' })
  })
  it('retains multiple exact retry mistakes from the same passage', () => {
    const group = QUESTION_BANK.filter((item) => item.sourceFamily === 'authored-full-academic-reading' && item.stimulusGroupId === 'full-academic-01')
    expect(group.length).toBeGreaterThanOrEqual(2)
    let state = applyReviewAttempt({}, group[0], false, 'first', now)
    state = applyReviewAttempt(state, group[1], false, 'second', now)
    expect(createReviewPractice(state, QUESTION_BANK, 'exact', false).map((item) => item.id)).toEqual([group[0].id, group[1].id])
  })
  it('preserves first and revised drafts and does not overwrite a newer import', () => {
    const first = saveWritingDraft('session', 'email', 'My first draft.', ['Purpose'], now)
    const revised = saveWritingDraft('session', 'email', 'My improved and specific request.', ['Purpose', 'Request'], '2026-10-04T09:01:00.000Z')
    expect(revised.drafts[0]).toEqual(first.drafts[0])
    expect(revised.drafts).toHaveLength(2)
    mergeWritingPractice({ 'session:email': first })
    expect(loadWritingPractice()['session:email'].drafts).toHaveLength(2)
  })
  it('merges drafts from a newer or older device without deleting either writing history', () => {
    saveWritingDraft('merged', 'email', 'Draft A.', [], now)
    saveWritingDraft('merged', 'email', 'Draft B.', [], '2026-10-04T09:01:00.000Z')
    const incoming = { 'merged:email': { itemId: 'email', updatedAt: '2026-10-04T09:02:00.000Z', drafts: [{ text: 'Other device C.', savedAt: '2026-10-04T09:02:00.000Z', checked: [] }] } }
    mergeWritingPractice(incoming); mergeWritingPractice(incoming)
    expect(loadWritingPractice()['merged:email'].drafts.map((draft) => draft.text)).toEqual(['Draft A.', 'Draft B.', 'Other device C.'])
    mergeWritingPractice({ 'merged:email': { itemId: 'email', updatedAt: '2026-10-03T09:00:00.000Z', drafts: [{ text: 'Older unique draft.', savedAt: '2026-10-03T09:00:00.000Z', checked: [] }] } })
    expect(loadWritingPractice()['merged:email'].drafts).toHaveLength(4)
    expect(loadWritingPractice()['merged:email'].updatedAt).toBe('2026-10-04T09:02:00.000Z')
  })
  it('merges learning backup fields without replacing personal sessions or including audio', () => {
    const item = QUESTION_BANK.find((item) => item.kind === 'multiple-choice')!
    const active = { ...base, id: 'local-active', updatedAt: '2026-10-04T09:02:00.000Z', answers: { [item.id]: item.answer! } }
    saveActive(active)
    saveWritingDraft('draft-session', 'email', 'Keep my local draft.', [], now)
    recordExamReview({ ...base, id: 'wrong-session' }, [item])
    importSessionBackup({ version: 1, active: { ...base, id: 'older-active', updatedAt: now }, history: [{ ...base, id: 'older-history', updatedAt: now, completed: true }] })
    expect(loadActive()).toEqual(active)
    expect(loadHistory().some((session) => session.id === 'older-history')).toBe(true)
    const backup = createSessionBackup()
    expect(backup.writingPractice!['draft-session:email'].drafts[0].text).toBe('Keep my local draft.')
    expect(backup.examReview![item.id].wrongCount).toBe(1)
    expect(JSON.stringify(backup)).not.toContain('audio/webm')
    expect(backup).not.toHaveProperty('recordings')
  })
  it('preserves an unsaved edit before rewrite or restoration and refuses to erase it at the draft cap', () => {
    saveWritingDraft('rewrite', 'email', 'First draft A.', [], now)
    expect(preserveWritingEditor('rewrite', 'email', 'Unsaved revision B.', [])!.drafts.map((draft) => draft.text)).toEqual(['First draft A.', 'Unsaved revision B.'])
    expect(preserveWritingEditor('rewrite', 'email', 'Unsaved revision B.', [])!.drafts).toHaveLength(2)
    for (let index = 2; index < 20; index++) saveWritingDraft('rewrite', 'email', `Saved draft ${index}.`, [], now)
    expect(() => preserveWritingEditor('rewrite', 'email', 'Do not erase this unsaved work.', [])).toThrow(/20개/)
    expect(loadWritingPractice()['rewrite:email'].drafts).toHaveLength(20)
  })
  it('rejects AI feedback about text the learner never wrote', () => {
    const value = { estimatedScore: 3, cefr: 'B2', verdict: '의미가 명확합니다.', revisedResponse: 'I agree.', strengths: [], revisionPlan: [], criteria: ['과제 수행', '내용 전개', '구성과 응집성', '문법·어휘', '어조·관습'].map((name) => ({ name, score: 3, feedback: '확인' })), issues: [{ quote: 'fabricated quotation', category: 'grammar', explanationKo: '오류', correction: 'Fixed.' }] }
    expect(() => validateWritingFeedback(value, 'I agree.')).toThrow(/없는 문장/)
    expect(() => validateWritingFeedback({ ...value, issues: [] }, 'I agree.')).not.toThrow()
  })
  it('warns and preserves exportable answers and results in the current tab when browser writes fail', () => {
    const original = globalThis.localStorage
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('quota') }, removeItem: () => {} })
    const active = { ...base, id: 'quota-test', answers: { email: 'Keep this answer.' } }
    saveActive(active)
    expect(getSessionStorageWarning()).toContain('현재 탭에만')
    expect(createSessionBackup().active).toEqual(active)
    finishSession(active)
    expect(createSessionBackup().history[0].answers.email).toBe('Keep this answer.')
    expect(loadActive()).toBeNull()
    vi.stubGlobal('localStorage', original)
    clearAllSessionData(false)
    expect(getSessionStorageWarning()).toBe('')
  })
})
