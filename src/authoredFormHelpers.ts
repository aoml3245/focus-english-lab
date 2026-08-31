import { prepareSentenceTiles } from './sentenceTiles'
import type { BaseItem } from './types'

export type Difficulty = NonNullable<BaseItem['difficulty']>
export type Question = [prompt: string, options: string[], answer: number, explanation: string]
export type SentenceDatum = [prompt: string, starter: string, fragments: string[], grammarFocus: string]

export function createAuthoredFormHelpers(prefix: string) {
  const base = (id: string, section: BaseItem['section'], kind: BaseItem['kind'], title: string, topic: string, difficulty: Difficulty, timeSeconds: number): BaseItem => ({
    id: `${prefix}-${id}`, section, module: 1, kind, title, topic, difficulty, timeSeconds, instruction: '', sourceFamily: `authored-form-${prefix.slice(1)}`,
  })
  const cloze = (id: string, topic: string, difficulty: Difficulty, passage: string, answer: string): BaseItem => ({
    ...base(id, 'reading', 'complete-words', 'Complete the Words', topic, difficulty, 240), instruction: '첫 문장을 읽고 문맥, 문법, 철자에 맞게 열 개 단어를 완성하세요.', passage, answer, explanation: '어간의 의미와 문법 형태를 함께 고려해야 합니다.',
  })
  const daily = (id: string, topic: string, difficulty: Difficulty, passage: string, q: Question): BaseItem => ({
    ...base(id, 'reading', 'multiple-choice', 'Read in Daily Life', topic, difficulty, 75), instruction: '실용문의 조건과 예외를 구분해 답하세요.', passage, prompt: q[0], options: q[1], answer: q[2], explanation: q[3],
  })
  const readingGroup = (id: string, topic: string, difficulty: Difficulty, passage: string, questions: Question[]): BaseItem[] => questions.map((q, sequenceIndex) => ({
    ...base(`${id}-${sequenceIndex}`, 'reading', 'multiple-choice', 'Read an Academic Passage', topic, difficulty, 120), instruction: '학술 지문의 주장, 근거, 방법론적 한계를 파악하세요.', passage, prompt: q[0], options: q[1], answer: q[2], explanation: q[3], stimulusGroupId: `${prefix}-${id}`, sequenceIndex,
  }))
  const response = (id: number, audioText: string, options: string[], answer: number, explanation: string): BaseItem => ({
    ...base(`response-${id}`, 'listening', 'listen-choice', 'Listen and Choose a Response', '캠퍼스 의사소통', id < 8 ? 'B1' : 'B2', 35), instruction: '짧은 말을 듣고 가장 자연스러운 응답을 고르세요.', audioText, options, answer, explanation,
  })
  const listeningGroup = (id: string, title: string, topic: string, difficulty: Difficulty, audioText: string, questions: Question[]): BaseItem[] => questions.map((q, sequenceIndex) => ({
    ...base(`${id}-${sequenceIndex}`, 'listening', 'listen-choice', title, topic, difficulty, title === 'Listen to an Announcement' ? 55 : title === 'Listen to an Academic Talk' ? 80 : 70),
    instruction: title === 'Listen to an Announcement' ? '공지의 변화, 조건, 필요한 행동을 파악하세요.' : title === 'Listen to an Academic Talk' ? '강의의 핵심 개념과 증거 관계를 파악하세요.' : '대화의 문제, 제약, 해결 과정을 파악하세요.',
    audioText, prompt: q[0], options: q[1], answer: q[2], explanation: q[3], stimulusGroupId: `${prefix}-${id}`, sequenceIndex,
  }))
  const sentenceItems = (data: SentenceDatum[]): BaseItem[] => data.map(([prompt, starter, fragments, grammarFocus], index) => {
    const item = base(`sentence-${index}`, 'writing', 'sentence-build', 'Build a Sentence', '고급 문장 구조', index < 2 ? 'B2' : 'C1', 75)
    const tiles = prepareSentenceTiles(fragments, item.id)
    return { ...item, instruction: '모든 단어와 구를 한 번씩 사용해 문맥과 문법에 맞는 문장을 완성하세요.', prompt, starter, words: tiles.choices, answer: tiles.answer, grammarFocus, explanation: `${starter} ${tiles.correct.join(' ')}` }
  })
  const orderedForm = (reading: BaseItem[], responses: BaseItem[], conversations: BaseItem[], announcements: BaseItem[], talks: BaseItem[], writing: BaseItem[], speaking: BaseItem[]): BaseItem[] => [
    ...reading.slice(0, 11).map((item) => ({ ...item, module: 1 })), ...reading.slice(11).map((item) => ({ ...item, module: 2 })),
    ...responses.slice(0, 9).map((item) => ({ ...item, module: 1 })), ...conversations.slice(0, 5).map((item) => ({ ...item, module: 1 })), ...announcements.slice(0, 4).map((item) => ({ ...item, module: 1 })), ...talks.slice(0, 6).map((item) => ({ ...item, module: 1 })),
    ...responses.slice(9).map((item) => ({ ...item, module: 2 })), ...conversations.slice(5).map((item) => ({ ...item, module: 2 })), ...announcements.slice(4).map((item) => ({ ...item, module: 2 })), ...talks.slice(6).map((item) => ({ ...item, module: 2 })), ...writing, ...speaking,
  ]
  return { base, cloze, daily, readingGroup, response, listeningGroup, sentenceItems, orderedForm }
}
