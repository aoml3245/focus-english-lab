import type { BaseItem, Section } from './types'

const normalize = (value = '') => value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

export const stableHash = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const shuffled = <T,>(values: T[]) => {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = new Uint32Array(1)
    crypto.getRandomValues(random)
    const target = random[0] % (index + 1)
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

const inferredSequence = (item: BaseItem) => {
  const match = item.id.match(/(?:-|r|i)(\d+)$/)
  return match ? Number(match[1]) : 0
}

export function deriveStimulusGroupId(item: BaseItem) {
  if (item.stimulusGroupId) return item.stimulusGroupId
  const baseSpeaking = item.id.match(/^s-(repeat|interview)-(\d+)-\d+$/)
  if (baseSpeaking) return `s-${baseSpeaking[1]}-${baseSpeaking[2]}`
  if (item.kind === 'repeat' || item.kind === 'interview') {
    const generated = item.id.match(/^([xn]-\d+)-s-/)
    if (generated) return `${generated[1]}-${item.kind}`
    const context = item.id.match(/^(ctx-\d+)-s/)
    if (context) return `${context[1]}-${item.kind}`
  }
  const stimulus = item.passage || item.audioText
  if (stimulus && (item.kind === 'multiple-choice' || item.kind === 'listen-choice')) {
    return `${item.section}:${item.title}:${stableHash(normalize(stimulus)).toString(36)}`
  }
  return item.id
}

const contextualizeDuplicatePrompts = (items: BaseItem[]) => {
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = normalize(item.prompt)
    if (key) counts.set(key, (counts.get(key) || 0) + 1)
  }
  const seen = new Set<string>()
  return items.map((item) => {
    const key = normalize(item.prompt)
    if (!item.prompt || (counts.get(key) || 0) < 2) return item
    const source = item.passage || item.audioText || item.title
    const cue = source.replace(/^[A-Za-z ]+:/, '').match(/[A-Za-z][A-Za-z'-]*/g)?.slice(0, 7).join(' ') || item.title
    const lowerPrompt = item.prompt.charAt(0).toLowerCase() + item.prompt.slice(1)
    let prompt = `In the material beginning “${cue},” ${lowerPrompt}`
    let unique = normalize(prompt)
    if (seen.has(unique)) {
      prompt = `After reading or hearing “${cue},” ${lowerPrompt}`
      unique = normalize(prompt)
    }
    seen.add(unique)
    return { ...item, prompt }
  })
}

const balanceObjectiveAnswers = (items: BaseItem[]) => {
  const targets = new Map<string, number>()
  const keyFor = (item: BaseItem) => item.section === 'reading' ? 'reading' : `${item.section}:${item.title}`
  const titles = [...new Set(items.filter((item) => typeof item.answer === 'number' && item.options?.length === 4).map(keyFor))]
  for (const title of titles) {
    const objective = items
      .filter((item) => keyFor(item) === title && typeof item.answer === 'number' && item.options?.length === 4)
      .sort((left, right) => stableHash(left.id) - stableHash(right.id))
    objective.forEach((item, index) => targets.set(item.id, index % 4))
  }
  return items.map((item) => {
    const target = targets.get(item.id)
    if (target === undefined || !item.options || typeof item.answer !== 'number') return item
    const correct = item.options[item.answer]
    const distractors = item.options.filter((_, index) => index !== item.answer)
    const options = [...distractors]
    options.splice(target, 0, correct)
    return { ...item, options, answer: target }
  })
}

export function prepareQuestionBank(items: BaseItem[], options: { contextualizeDuplicatePrompts?: boolean } = {}) {
  const grouped = items.map((item) => ({
    ...item,
    stimulusGroupId: deriveStimulusGroupId(item),
    scenarioId: item.scenarioId || (item.kind === 'repeat' || item.kind === 'interview' ? deriveStimulusGroupId(item) : undefined),
    sequenceIndex: item.sequenceIndex ?? inferredSequence(item),
    sourceFamily: item.sourceFamily || item.id.split('-')[0],
  }))
  const withUniquePrompts = options.contextualizeDuplicatePrompts === false ? grouped : contextualizeDuplicatePrompts(grouped)
  return balanceObjectiveAnswers(withUniquePrompts)
}

const groupCandidates = (bank: BaseItem[], test: (item: BaseItem) => boolean, excludedIds: ReadonlySet<string>, allowedSizes?: ReadonlySet<number>) => {
  const groups = new Map<string, BaseItem[]>()
  for (const item of bank.filter(test)) {
    const key = deriveStimulusGroupId(item)
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }
  return shuffled([...groups.values()]
    .filter((group) => group.every((item) => !excludedIds.has(item.id)))
    .map((group) => [...group].sort((left, right) => (left.sequenceIndex || 0) - (right.sequenceIndex || 0)))
    .filter((group) => !allowedSizes || allowedSizes.has(group.length)))
}

export function pickGroupedExact(bank: BaseItem[], test: (item: BaseItem) => boolean, count: number, excludedIds: ReadonlySet<string>, allowedSizes?: ReadonlySet<number>) {
  const groups = groupCandidates(bank, test, excludedIds, allowedSizes)
  const combinations: Array<BaseItem[][] | undefined> = Array.from({ length: count + 1 })
  combinations[0] = []
  for (const group of groups) {
    for (let size = count - group.length; size >= 0; size -= 1) {
      if (combinations[size] && !combinations[size + group.length]) combinations[size + group.length] = [...combinations[size]!, group]
    }
  }
  return (combinations[count] || []).flat()
}

const withModule = (items: BaseItem[], module: 1 | 2) => items.map((item) => ({ ...item, module }))
const ids = (items: BaseItem[]) => items.map((item) => item.id)

const pickStage = (bank: BaseItem[], title: string, count: number, excluded: ReadonlySet<string>, module: 1 | 2, allowedSizes?: ReadonlySet<number>) => {
  const items = pickGroupedExact(bank, (item) => item.title === title, count, excluded, allowedSizes)
  if (items.length !== count) throw new Error(`Not enough complete ${title} groups to build the TOEFL-style set (${items.length}/${count}).`)
  return withModule(items, module)
}

export function buildReadingBlueprint(bank: BaseItem[], excludedIds: ReadonlySet<string> = new Set()) {
  const moduleOneCloze = pickStage(bank, 'Complete the Words', 2, excludedIds, 1, new Set([1]))
  const afterOneCloze = new Set([...excludedIds, ...ids(moduleOneCloze)])
  const moduleOneDaily = pickStage(bank, 'Read in Daily Life', 4, afterOneCloze, 1, new Set([1, 2]))
  const afterOneDaily = new Set([...afterOneCloze, ...ids(moduleOneDaily)])
  const moduleOneAcademic = pickStage(bank, 'Read an Academic Passage', 5, afterOneDaily, 1, new Set([2, 3]))
  const afterModuleOne = new Set([...afterOneDaily, ...ids(moduleOneAcademic)])

  const moduleTwoCloze = pickStage(bank, 'Complete the Words', 1, afterModuleOne, 2, new Set([1]))
  const afterTwoCloze = new Set([...afterModuleOne, ...ids(moduleTwoCloze)])
  const moduleTwoDaily = pickStage(bank, 'Read in Daily Life', 6, afterTwoCloze, 2, new Set([1, 2]))
  const afterTwoDaily = new Set([...afterTwoCloze, ...ids(moduleTwoDaily)])
  const moduleTwoAcademic = pickStage(bank, 'Read an Academic Passage', 5, afterTwoDaily, 2, new Set([2, 3]))
  return [...moduleOneCloze, ...moduleOneDaily, ...moduleOneAcademic, ...moduleTwoCloze, ...moduleTwoDaily, ...moduleTwoAcademic]
}

export function buildListeningBlueprint(bank: BaseItem[], excludedIds: ReadonlySet<string> = new Set()) {
  const configuration = [
    { module: 1 as const, response: 9, conversation: 5, announcement: 4, talk: 6 },
    { module: 2 as const, response: 8, conversation: 5, announcement: 4, talk: 6 },
  ]
  const selected: BaseItem[] = []
  let excluded = new Set(excludedIds)
  for (const stage of configuration) {
    for (const [title, count] of [
      ['Listen and Choose a Response', stage.response],
      ['Listen to a Conversation', stage.conversation],
      ['Listen to an Announcement', stage.announcement],
      ['Listen to an Academic Talk', stage.talk],
    ] as const) {
      const picked = pickStage(bank, title, count, excluded, stage.module)
      selected.push(...picked)
      excluded = new Set([...excluded, ...ids(picked)])
    }
  }
  return selected
}

const pickDiverseSentenceBuild = (bank: BaseItem[], count: number, excludedIds: ReadonlySet<string>) => {
  const candidates = shuffled(bank.filter((item) => item.kind === 'sentence-build' && !excludedIds.has(item.id)))
  const selected: BaseItem[] = []
  const focuses = new Set<string>()
  for (const item of candidates) {
    const focus = item.grammarFocus || `unclassified:${item.id}`
    if (focuses.has(focus)) continue
    selected.push(item)
    focuses.add(focus)
    if (selected.length === count) break
  }
  return selected
}

export function buildWritingBlueprint(bank: BaseItem[], excludedIds: ReadonlySet<string> = new Set()) {
  const sentences = pickDiverseSentenceBuild(bank, 10, excludedIds)
  const afterSentences = new Set([...excludedIds, ...ids(sentences)])
  const email = pickGroupedExact(bank, (item) => item.title === 'Write an Email', 1, afterSentences)
  const discussion = pickGroupedExact(bank, (item) => item.title === 'Write for an Academic Discussion', 1, new Set([...afterSentences, ...ids(email)]))
  return [...sentences, ...email, ...discussion]
}

export function buildSpeakingBlueprint(bank: BaseItem[], excludedIds: ReadonlySet<string> = new Set()) {
  const repeat = pickGroupedExact(bank, (item) => item.title === 'Listen and Repeat', 7, excludedIds, new Set([7]))
  const interview = pickGroupedExact(bank, (item) => item.title === 'Take an Interview', 4, new Set([...excludedIds, ...ids(repeat)]), new Set([4]))
  if (repeat.length !== 7 || interview.length !== 4) throw new Error('Not enough complete Speaking scenarios to build the TOEFL-style set.')
  return [...repeat, ...interview]
}

export function buildFullBlueprint(bank: BaseItem[], excludedIds: ReadonlySet<string> = new Set()) {
  return [
    ...buildReadingBlueprint(bank, excludedIds),
    ...buildListeningBlueprint(bank, excludedIds),
    ...buildWritingBlueprint(bank, excludedIds),
    ...buildSpeakingBlueprint(bank, excludedIds),
  ]
}

export function buildSectionBlueprint(bank: BaseItem[], section: Section, excludedIds: ReadonlySet<string> = new Set()) {
  if (section === 'reading') return buildReadingBlueprint(bank, excludedIds)
  if (section === 'listening') return buildListeningBlueprint(bank, excludedIds)
  if (section === 'writing') return buildWritingBlueprint(bank, excludedIds)
  return buildSpeakingBlueprint(bank, excludedIds)
}

export function pickTaskPractice(bank: BaseItem[], section: Section, title: string, count: number, excludedIds: ReadonlySet<string>) {
  if (title === 'Build a Sentence') return pickDiverseSentenceBuild(bank, count, excludedIds)
  const scenarioSize = title === 'Listen and Repeat' ? new Set([7]) : title === 'Take an Interview' ? new Set([4]) : undefined
  const grouped = pickGroupedExact(bank, (item) => item.section === section && item.title === title, count, excludedIds, scenarioSize)
  if (grouped.length === count) return grouped
  return shuffled(bank.filter((item) => item.section === section && item.title === title && !excludedIds.has(item.id))).slice(0, count)
}
