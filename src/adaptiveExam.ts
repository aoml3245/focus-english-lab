import { deriveStimulusGroupId } from './examBlueprint'
import { scoreItem } from './review'
import type { BaseItem, SavedSession } from './types'

type Route = 'lower' | 'upper'
type AdaptiveSection = 'reading' | 'listening'
const level = (item: BaseItem) => item.difficulty === 'C1' ? 2 : item.difficulty === 'B2' ? 1 : 0
export const ADAPTIVE_THRESHOLD = 0.7

/** Exact-size group selection: prioritize authored difficulty, never split a stimulus. */
function chooseGroups(bank: BaseItem[], title: string, count: number, excluded: Set<string>, route: Route, allowedSizes?: Set<number>) {
  const grouped = new Map<string, BaseItem[]>()
  for (const item of bank.filter((item) => item.title === title)) {
    const key = deriveStimulusGroupId(item)
    grouped.set(key, [...(grouped.get(key) || []), item])
  }
  const groups = [...grouped.values()].filter((group) => group.every((item) => !excluded.has(item.id)) && (!allowedSizes || allowedSizes.has(group.length)))
  // Random tie breaking prevents every learner receiving the same optimal group.
  const rank = (group: BaseItem[]) => group.reduce((sum, item) => sum + (route === 'upper' ? 2 - level(item) : level(item)), 0)
  const ranked = groups.map((group) => ({ group, tie: crypto.getRandomValues(new Uint32Array(1))[0] })).sort((a, b) => rank(a.group) - rank(b.group) || a.tie - b.tie)
  const dp: Array<{ cost: number; groups: BaseItem[][] } | undefined> = Array(count + 1)
  dp[0] = { cost: 0, groups: [] }
  for (const { group } of ranked) {
    for (let size = count - group.length; size >= 0; size--) {
      const previous = dp[size]
      if (!previous) continue
      const cost = previous.cost + rank(group)
      if (!dp[size + group.length] || cost < dp[size + group.length]!.cost) dp[size + group.length] = { cost, groups: [...previous.groups, group] }
    }
  }
  const chosen = dp[count]?.groups.flatMap((group) => [...group].sort((a, b) => (a.sequenceIndex || 0) - (b.sequenceIndex || 0)))
  if (!chosen) throw new Error(`${title}의 완전한 ${route === 'upper' ? '상위' : '기초'} 모듈을 구성할 문제가 부족합니다.`)
  chosen.forEach((item) => excluded.add(item.id))
  return chosen.map((item) => ({ ...item, module: 2 }))
}

function buildBranch(bank: BaseItem[], section: AdaptiveSection, excluded: Set<string>, route: Route) {
  if (section === 'reading') {
    const fullGroups = bank.filter((item) => item.sourceFamily === 'authored-full-academic-reading' && !excluded.has(item.id))
    const academicBank = fullGroups.length >= 5 ? fullGroups : bank
    return [
      ...chooseGroups(bank, 'Complete the Words', 1, excluded, route, new Set([1])),
      ...chooseGroups(bank, 'Read in Daily Life', 6, excluded, route, new Set([1, 2, 3])),
      ...chooseGroups(academicBank, 'Read an Academic Passage', 5, excluded, route, new Set(fullGroups.length >= 5 ? [5] : [2, 3, 5])),
    ]
  }
  return [
    ...chooseGroups(bank, 'Listen and Choose a Response', 8, excluded, route),
    ...chooseGroups(bank, 'Listen to a Conversation', 5, excluded, route),
    ...chooseGroups(bank, 'Listen to an Announcement', 4, excluded, route),
    ...chooseGroups(bank, 'Listen to an Academic Talk', 6, excluded, route),
  ]
}

export function attachAdaptivePlan(session: SavedSession, items: BaseItem[], bank: BaseItem[], excludedIds: ReadonlySet<string> = new Set()): SavedSession {
  if (session.mode !== 'mock') return session
  const candidates: NonNullable<SavedSession['adaptive']>['candidates'] = {}
  for (const section of ['reading', 'listening'] as const) {
    if (!items.some((item) => item.section === section && item.module === 1) || !items.some((item) => item.section === section && item.module === 2)) continue
    const excluded = new Set([...excludedIds, ...items.filter((item) => item.section !== section || item.module === 1).map((item) => item.id)])
    const lower = buildBranch(bank, section, excluded, 'lower')
    const upper = buildBranch(bank, section, excluded, 'upper')
    if (upper.reduce((sum, item) => sum + level(item), 0) <= lower.reduce((sum, item) => sum + level(item), 0)) {
      // An imported uniform-difficulty bank cannot honestly claim adaptive difficulty.
      continue
    }
    candidates[section] = { lower, upper }
  }
  if (!Object.keys(candidates).length) return session
  const planned = items.flatMap((item, index) => {
    const pair = candidates[item.section as AdaptiveSection]
    if (!pair || item.module !== 2) return [item]
    return index === items.findIndex((candidate) => candidate.section === item.section && candidate.module === 2) ? pair.lower : []
  })
  return { ...session, adaptive: { version: 1, candidates, decisions: {} }, itemIds: planned.map((item) => item.id), itemSnapshots: structuredClone(planned) }
}

export function adaptivePreparationItems(session: SavedSession, items: BaseItem[]) {
  return [...new Map([...items, ...Object.values(session.adaptive?.candidates || {}).flatMap((pair) => [...pair.lower, ...pair.upper])].map((item) => [item.id, item])).values()]
}

/** Decide only at the router boundary, including time expiry; preserve actual router answers. */
export function advanceAdaptiveSession(session: SavedSession, items: BaseItem[], nextIndex: number, now = new Date().toISOString()): SavedSession {
  const current = items[session.itemIndex]
  const section = current?.section as AdaptiveSection
  const pair = session.adaptive?.candidates[section]
  const next = items[nextIndex]
  if (!pair || current.module !== 1 || (next?.section === current.section && next.module === 1) || session.adaptive?.decisions[section]) return { ...session, itemIndex: nextIndex, updatedAt: now }
  const router = items.filter((item) => item.section === section && item.module === 1)
  const scores = router.map((item) => scoreItem(item, session.answers[item.id]))
  const correct = scores.reduce((sum, score) => sum + score.correct, 0)
  const total = scores.reduce((sum, score) => sum + score.total, 0)
  const route: Route = total > 0 && correct / total >= ADAPTIVE_THRESHOLD ? 'upper' : 'lower'
  const oldStart = items.findIndex((item) => item.section === section && item.module === 2)
  const replaced = items.flatMap((item, index) => item.section === section && item.module === 2 ? index === oldStart ? pair[route] : [] : [item])
  return {
    ...session, itemIds: replaced.map((item) => item.id), itemSnapshots: structuredClone(replaced),
    itemIndex: oldStart >= 0 && nextIndex >= oldStart ? oldStart : nextIndex, updatedAt: now,
    adaptive: { ...session.adaptive!, decisions: { ...session.adaptive!.decisions, [section]: { route, correct, total, decidedAt: now } } },
  }
}
