import { createAuthoredFormHelpers } from './authoredFormHelpers'
import { createAdvancedReading } from './advancedReading'
import { createAdvancedListening } from './advancedListening'
import type { Difficulty, SentenceDatum } from './authoredFormHelpers'
import type { BaseItem } from './types'

export type LogicBrief = {
  topic: string
  label: string
  principle: string
  caveat: string
  method: string
  difficulty?: Difficulty
}

export type PracticalBrief = {
  topic: string
  label: string
  notice: string
  inference: string
  difficulty?: Difficulty
}

export type AdvancedFormConfig = {
  form: number
  cloze: Array<LogicBrief & { extra: string }>
  practical: PracticalBrief[]
  academic: LogicBrief[]
  conversations: LogicBrief[]
  announcements: PracticalBrief[]
  talks: LogicBrief[]
  sentenceData: SentenceDatum[]
  email: { topic: string; prompt: string; difficulty?: Difficulty }
  discussion: { topic: string; prompt: string; passage: string }
  repeat: { topic: string; sentences: string[] }
  interview: { topic: string; questions: string[] }
}


export function createAdvancedAuthoredForm(config: AdvancedFormConfig): BaseItem[] {
  const prefix = `f${config.form}`
  const { base, sentenceItems, orderedForm } = createAuthoredFormHelpers(prefix)
  const reading = createAdvancedReading(config)
  const listening = createAdvancedListening(config)
  const writing = sentenceItems(config.sentenceData)
  writing.push({ ...base('email', 'writing', 'email', 'Write an Email', config.email.topic, config.email.difficulty || 'B2', 420), instruction: '상황, 영향, 요청 사항과 확인 방법을 구체적으로 작성하세요.', prompt: config.email.prompt })
  writing.push({ ...base('discussion', 'writing', 'discussion', 'Write for an Academic Discussion', config.discussion.topic, 'C1', 600), instruction: '두 관점을 평가하고 근거와 조건을 포함해 논지를 발전시키세요.', prompt: config.discussion.prompt, passage: config.discussion.passage })

  const speaking: BaseItem[] = [
    ...config.repeat.sentences.map((audioText, sequenceIndex) => ({ ...base(`repeat-${sequenceIndex}`, 'speaking', 'repeat', 'Listen and Repeat', config.repeat.topic, sequenceIndex < 2 ? 'B1' : 'B2', sequenceIndex < 3 ? 12 : 16), instruction: '한 번 듣고 준비 시간 없이 의미와 리듬을 살려 반복하세요.', audioText, stimulusGroupId: `${prefix}-repeat`, scenarioId: `${prefix}-repeat`, sequenceIndex })),
    ...config.interview.questions.map((audioText, sequenceIndex) => ({ ...base(`interview-${sequenceIndex}`, 'speaking', 'interview', 'Take an Interview', config.interview.topic, sequenceIndex === 0 ? 'B2' : 'C1', 45), instruction: '연속된 질문에 주장, 이유, 사례를 포함해 답하세요.', audioText, stimulusGroupId: `${prefix}-interview`, scenarioId: `${prefix}-interview`, sequenceIndex })),
  ]

  const byTitle = (title: string) => listening.filter((item) => item.title === title)
  return orderedForm(reading, byTitle('Listen and Choose a Response'), byTitle('Listen to a Conversation'), byTitle('Listen to an Announcement'), byTitle('Listen to an Academic Talk'), writing, speaking)
}
