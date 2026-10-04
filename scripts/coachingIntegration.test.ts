import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { coachWriting, loadWritingFeedback, validateWritingFeedback } from '../src/writingCoachEngine'
import { coachSpeakingText } from '../src/speakingCoach'
import type { BaseItem } from '../src/types'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import WritingCoach from '../src/WritingCoach'

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value) })
})
afterEach(() => vi.unstubAllGlobals())

function traceLiveCoach() {
  const realFetch = globalThis.fetch
  vi.stubGlobal('fetch', async (...args: Parameters<typeof fetch>) => {
    const started = Date.now()
    const response = await realFetch(...args)
    if (String(args[0]).endsWith('/api/chat')) {
      const payload = await response.clone().json()
      // stdout keeps opt-in live evidence available even when a reporter hides
      // console output from passing tests. These fixtures contain no user data.
      process.stdout.write(`LIVE_MODEL_TRACE ${JSON.stringify({ elapsedMs: Date.now() - started, ...payload })}\n`)
    }
    return response
  })
}
const live = process.env.FEL_TEST_LOCAL_AI === '1' ? it : it.skip
const item: BaseItem = { id: 'integration-only-email', section: 'writing', kind: 'email', module: 1, title: 'Write an Email', timeSeconds: 420, instruction: 'Write to a library coordinator.', prompt: 'Your reserved study room is unavailable because of a repair. Explain its effect on your project group, suggest another time, and ask how to confirm a replacement room.', taskChecklist: ['Explain the effect on your group', 'Suggest an alternative time', 'Ask how to confirm the booking'] }

const sampleAnswer = 'We need it because we prepares a project presentation.'
const sampleFeedback = {
  estimatedScore: 3, cefr: 'B1', verdict: '과제 목적은 명확하지만 주어와 동사의 일치를 확인하세요.',
  strengths: ['목적을 구체적으로 설명했습니다.', '짧은 문장으로 요청 이유를 전달했습니다.'],
  criteria: ['과제 수행', '내용 전개', '구성과 응집성', '문법·어휘', '어조·관습'].map((name) => ({ name, score: 3, feedback: '원문의 목적을 유지하면서 표현을 다듬으세요.' })),
  issues: [{ quote: sampleAnswer, category: 'grammar', explanationKo: '복수 주어 we에는 prepare를 사용합니다.', correction: 'We need it because we prepare a project presentation.' }],
  revisionPlan: ['주어와 동사를 대조하세요.', '일정을 그대로 유지하세요.', '확인 요청을 명확히 쓰세요.'], revisedResponse: 'We need it because we prepare a project presentation.',
}

function mockWritingModel(outputs: unknown[]) {
  let index = 0
  const request = vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/api/tags')
    ? { models: [{ name: 'qwen3.5:9b' }] }
    : { message: { content: JSON.stringify(outputs[index++]) } }), { status: 200 }))
  vi.stubGlobal('fetch', request)
  return request
}

it('distinguishes a real missing quotation from an invalid category and non-Korean explanation', () => {
  expect(() => validateWritingFeedback(sampleFeedback, sampleAnswer)).not.toThrow()
  expect(() => validateWritingFeedback({ ...sampleFeedback, issues: [{ ...sampleFeedback.issues[0], quote: 'Invented text.' }] }, sampleAnswer)).toThrow(/없는 문장/)
  expect(() => validateWritingFeedback({ ...sampleFeedback, issues: [{ ...sampleFeedback.issues[0], category: '문법·어휘' }] }, sampleAnswer)).toThrow(/오류 분류/)
  expect(() => validateWritingFeedback({ ...sampleFeedback, verdict: 'English-only verdict.' }, sampleAnswer)).toThrow(/한국어/)
})

it('uses original-only quote choices and repairs one invalid result without changing learner context', async () => {
  const request = mockWritingModel([{ ...sampleFeedback, issues: [{ ...sampleFeedback.issues[0], quote: 'Invented text.' }] }, sampleFeedback])
  const result = await coachWriting(item, sampleAnswer)
  expect(result.issues[0].quote).toBe(sampleAnswer)
  const chatCalls = request.mock.calls.filter(([url]) => url.endsWith('/api/chat'))
  expect(chatCalls).toHaveLength(2)
  const bodies = chatCalls.map((call) => JSON.parse((call[1] as RequestInit).body as string))
  expect(bodies[0].format.properties.issues.items.properties.quote.enum).toEqual([sampleAnswer])
  expect(bodies[0].format.properties.issues.items.properties.category.enum).toEqual(['grammar', 'vocabulary', 'clarity', 'organization', 'tone'])
  expect(bodies[0].think).toBe(false)
  expect(bodies[1].messages[1]).toEqual(bodies[0].messages[1])
  expect(bodies[1].messages.at(-1).content).toContain('ORIGINAL learner response')
  expect(loadWritingFeedback(item.id, sampleAnswer)?.issues[0].quote).toBe(sampleAnswer)
  expect(loadWritingFeedback(item.id, 'a different answer')).toBeNull()
})

it('rejects a second invented quotation and never stores the invalid feedback', async () => {
  const invalid = { ...sampleFeedback, issues: [{ ...sampleFeedback.issues[0], quote: 'Invented text.' }] }
  const request = mockWritingModel([invalid, invalid])
  await expect(coachWriting(item, sampleAnswer)).rejects.toThrow(/없는 문장/)
  expect(request.mock.calls.filter(([url]) => url.endsWith('/api/chat'))).toHaveLength(2)
  expect(loadWritingFeedback(item.id, sampleAnswer)).toBeNull()
})

it('labels tone changes as optional suggestions and does not strike out a valid original phrase', async () => {
  const answer = 'Please tell me how to confirm the reservation.'
  mockWritingModel([{ ...sampleFeedback, issues: [{ quote: answer, category: 'tone', explanationKo: '선택적으로 더 부드럽게 표현할 수 있습니다.', correction: 'Could you please tell me how to confirm the reservation?' }] }])
  await coachWriting(item, answer)
  const view = renderToStaticMarkup(createElement(WritingCoach, { item, response: answer, onApply: () => {} }))
  expect(view).toContain('선택적 어조 제안')
  expect(view).toContain('정상 표현을 잘못 고칠 수')
  expect(view).toContain(answer)
  expect(view).not.toContain('<del>')
})

it('repairs escaped email paragraph display and aligns correction punctuation without editing original quotes', async () => {
  const answer = 'Please tell me how to confirm.'
  const original = { ...sampleFeedback, issues: [{ quote: answer, category: 'tone', explanationKo: '선택적으로 요청을 더 부드럽게 표현할 수 있습니다.', correction: 'Could you please tell me how to confirm.' }], revisedResponse: 'Dear Coordinator,\\n\\nCould you please tell me how to confirm?\\n\\nBest regards, Mina' }
  mockWritingModel([original])
  const result = await coachWriting(item, answer)
  expect(result.revisedResponse).toContain('Dear Coordinator,\n\n')
  expect(result.revisedResponse).not.toContain('\\n')
  expect(result.issues[0].correction).toBe('Could you please tell me how to confirm?')
  expect(result.issues[0].quote).toBe(answer)
})

it('sends the actual interview question and context without borrowing email instructions', async () => {
  const question = 'Do you prefer working alone or with a group?'
  const interview: BaseItem = { id: 'unit-interview', section: 'speaking', kind: 'interview', module: 1, title: 'Interview', timeSeconds: 45, instruction: 'Explain your preference with an example.', context: 'Discuss your approach to studying.', audioText: question }
  const request = vi.fn(async () => new Response(JSON.stringify({ message: { content: JSON.stringify({ summaryKo: '이유가 명확합니다.', strengthsKo: ['관점이 있습니다.', '근거가 있습니다.'], improvementsKo: ['사례를 구체화하세요.', '주어를 확인하세요.'], revisedResponse: 'I prefer working with a group.' }) } })))
  vi.stubGlobal('fetch', request)
  await coachSpeakingText(interview, 'I prefer working with a group.', new AbortController().signal)
  const body = JSON.parse((request.mock.calls[0][1] as RequestInit).body as string)
  const context = JSON.parse(body.messages[1].content)
  expect(context.interviewQuestion).toBe(question)
  expect(context.context).toBe(interview.context)
  expect(context.instruction).not.toContain('library')
  expect(context.learnerTranscript).toBe('I prefer working with a group.')
})

it('rejects repeat coaching that paraphrases the exact reference', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: { content: JSON.stringify({ summaryKo: '단어를 확인하세요.', strengthsKo: ['주요 단어가 있습니다.'], improvementsKo: ['원문을 유지하세요.'], revisedResponse: 'Return the book soon.' }) } }))))
  const repeat: BaseItem = { id: 'unit-repeat', section: 'speaking', kind: 'repeat', module: 1, title: 'Repeat', timeSeconds: 12, instruction: 'Repeat exactly.', audioText: 'Please return the library book tomorrow.' }
  await expect(coachSpeakingText(repeat, 'Please return the book tomorrow.', new AbortController().signal)).rejects.toThrow(/원문을 바꾼/)
})

it('refuses an email task or a missing interview question before any speaking-model call', async () => {
  const request = vi.fn()
  vi.stubGlobal('fetch', request)
  await expect(coachSpeakingText(item, 'My answer.', new AbortController().signal)).rejects.toThrow(/말하기 코칭/)
  const missing: BaseItem = { id: 'missing-question', section: 'speaking', kind: 'interview', module: 1, title: 'Interview', instruction: 'Answer.', timeSeconds: 45 }
  await expect(coachSpeakingText(missing, 'My answer.', new AbortController().signal)).rejects.toThrow(/질문을 찾을/)
  expect(request).not.toHaveBeenCalled()
})

it('rejects a removed interview outcome and retries once with the original transcript intact', async () => {
  const transcript = 'I prefer groups. We finished earlier than expected. Everyone need a plan.'
  const interview: BaseItem = { id: 'outcome-preservation', section: 'speaking', kind: 'interview', module: 1, title: 'Interview', instruction: 'Explain your preference with an example.', audioText: 'Do you prefer groups?', timeSeconds: 45 }
  const base = { summaryKo: '경험과 결과가 이유를 뒷받침합니다.', strengthsKo: ['이유와 예시가 있습니다.'], improvementsKo: ['단수 주어 everyone에 needs를 사용하세요.'] }
  let call = 0
  const request = vi.fn(async () => new Response(JSON.stringify({ message: { content: JSON.stringify({ ...base, revisedResponse: call++ === 0 ? 'I prefer groups. Everyone needs a plan.' : 'I prefer groups. We finished earlier than expected. Everyone needs a plan.' }) } })))
  vi.stubGlobal('fetch', request)
  const result = await coachSpeakingText(interview, transcript, new AbortController().signal)
  expect(request).toHaveBeenCalledTimes(2)
  expect(result.revisedResponse).toContain('We finished earlier than expected.')
  const bodies = request.mock.calls.map((call) => JSON.parse((call[1] as RequestInit).body as string))
  expect(bodies[1].messages[1]).toEqual(bodies[0].messages[1])
  expect(JSON.parse(bodies[1].messages[1].content).learnerTranscript).toBe(transcript)
})

it('fails closed after two speaking results remove an original sentence', async () => {
  const interview: BaseItem = { id: 'outcome-rejection', section: 'speaking', kind: 'interview', module: 1, title: 'Interview', instruction: 'Explain.', audioText: 'Why groups?', timeSeconds: 45 }
  const request = vi.fn(async () => new Response(JSON.stringify({ message: { content: JSON.stringify({ summaryKo: '문법을 고쳤습니다.', strengthsKo: ['이유가 있습니다.'], improvementsKo: ['동사를 고치세요.'], revisedResponse: 'I prefer groups.' }) } })))
  vi.stubGlobal('fetch', request)
  await expect(coachSpeakingText(interview, 'I prefer groups. We finished early.', new AbortController().signal)).rejects.toThrow(/문장이 줄어/)
  expect(request).toHaveBeenCalledTimes(2)
})
live('checks an actual installed local writing coach and grounded corrections', async () => {
  traceLiveCoach()
  const answer = 'Dear Coordinator, Our group has reserved the room for Friday. We need it because we prepares a project presentation. The repair means that we cannot practice together before our deadline. Could we use another room on Saturday morning instead? We are five students and need a screen for our slides. Please tell me how we should confirm the new reservation. Thank you for helping us find a solution. Best regards, Mina'
  const result = await coachWriting(item, answer, new AbortController().signal)
  expect(result.issues.every((issue) => answer.includes(issue.quote))).toBe(true)
  expect(result.criteria).toHaveLength(5)
  expect(result.revisedResponse.length).toBeGreaterThan(40)
  expect(result.issues.some((issue) => issue.quote.includes('we prepares') && /\bwe prepare\b/i.test(issue.correction))).toBe(true)
  expect(result.revisedResponse).toMatch(/Saturday morning/)
  expect(result.revisedResponse).toMatch(/five/)
  expect(result.revisedResponse).toMatch(/screen/)
  expect(result.verdict).toMatch(/[가-힣]/)
  console.info('LIVE_WRITING_REVIEW', JSON.stringify({ model: result.model, score: result.estimatedScore, verdict: result.verdict, issues: result.issues, revisedResponse: result.revisedResponse }))
}, 210_000)
live('checks actual installed speaking text feedback without a pronunciation score', async () => {
  traceLiveCoach()
  const question = 'Do you prefer working alone or with a group? Explain one reason and give an example.'
  const interview: BaseItem = { id: 'integration-only-interview', section: 'speaking', kind: 'interview', module: 1, title: 'Take an Interview', timeSeconds: 45, instruction: 'Answer the interview question with a reason and an example.', context: 'You are discussing approaches to studying with classmates.', audioText: question, taskChecklist: ['State a preference', 'Give a reason', 'Support it with an example'] }
  const result = await coachSpeakingText(interview, 'I prefer working with a group because we can share ideas. Last month I prepared a science presentation with two classmates. One person found examples, another checked the slides, and I practiced the explanation. We finished earlier than I expected. However, everyone need to agree on a clear plan so that we do not repeat the same work.', new AbortController().signal)
  expect(result.summaryKo).toBeTruthy()
  expect(result.summaryKo).toMatch(/[가-힣]/)
  expect(result.revisedResponse).toBeTruthy()
  expect(result).not.toHaveProperty('pronunciationScore')
  expect(result.revisedResponse).toMatch(/science presentation/)
  expect(result.revisedResponse).toMatch(/two classmates/)
  expect(result.revisedResponse).toMatch(/finished (earlier than I expected|sooner than expected)/)
  expect(result.revisedResponse).not.toContain('**')
  expect(result.revisedResponse).not.toMatch(/Dear|Best regards|reservation|Coordinator/i)
  expect(result.improvementsKo.join(' ')).toMatch(/need|needs/)
  console.info('LIVE_SPEAKING_TEXT_REVIEW', JSON.stringify(result))
}, 150_000)
