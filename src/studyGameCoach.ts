import { getCoachModelStatus } from './writingCoachEngine'
import type { StudyQuestion } from './studyGamesEngine'

export type StudyAnswerFeedback = {
  score: number
  verdictKo: string
  goodPointKo: string
  correctionKo: string
  improvedAnswer: string
  model: string
}

const FEEDBACK_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'number', minimum: 0, maximum: 100 },
    verdictKo: { type: 'string' },
    goodPointKo: { type: 'string' },
    correctionKo: { type: 'string' },
    improvedAnswer: { type: 'string' },
  },
  required: ['score', 'verdictKo', 'goodPointKo', 'correctionKo', 'improvedAnswer'],
}

export async function evaluateStudyAnswer(question: StudyQuestion, response: string): Promise<StudyAnswerFeedback> {
  const status = await getCoachModelStatus()
  if (!status.connected) throw new Error('Ollama가 실행 중이지 않습니다.')
  if (!status.installed.includes(status.selected)) throw new Error('글쓰기 코칭용 로컬 모델이 필요합니다.')
  if (status.selected.toLowerCase().includes('translate')) throw new Error('번역 전용 모델 대신 글쓰기 코칭용 모델을 선택해 주세요.')
  const direction = question.task === 'translation'
    ? 'Evaluate a Korean translation of an English sentence. Preserve legitimate paraphrases and judge meaning, nuance, and Korean naturalness.'
    : 'Evaluate an English translation of a Korean sentence. Preserve legitimate paraphrases and judge meaning, grammar, vocabulary, and naturalness.'
  const prompt = `${direction}\nSOURCE: ${question.task === 'translation' ? question.entry.example : question.entry.translation}\nREFERENCE ANSWER: ${question.answer}\nLEARNER ANSWER: ${response}\nReturn concise teaching feedback. All explanations must be Korean. improvedAnswer must be in the learner answer language. The reference is one acceptable answer, not the only possible wording. Before returning, verify that goodPointKo describes only words or meaning actually present in LEARNER ANSWER. If the learner omitted the source meaning, goodPointKo may acknowledge only the attempt or answer language and must not invent a translated detail. The score, verdict, good point, and correction must be mutually consistent.`
  const result = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: status.selected,
      messages: [
        { role: 'system', content: 'You are a precise but encouraging bilingual English-Korean tutor. Evaluate meaning before surface word overlap. Ground every claim about the learner in the exact learner answer; never praise content that is absent. Never claim this is an official test score.' },
        { role: 'user', content: prompt },
      ],
      stream: false,
      format: FEEDBACK_SCHEMA,
      think: false,
      options: { temperature: 0.1, num_ctx: 4096, num_predict: 700 },
      keep_alive: '10m',
    }),
    signal: AbortSignal.timeout(120000),
  })
  if (!result.ok) throw new Error(`로컬 LLM 응답 오류 (${result.status})`)
  const payload = await result.json() as { message?: { content?: string } }
  if (!payload.message?.content) throw new Error('평가 결과가 비어 있습니다.')
  const parsed = JSON.parse(payload.message.content) as Omit<StudyAnswerFeedback, 'model'>
  return { ...parsed, score: Math.max(0, Math.min(100, Number(parsed.score))), model: status.selected }
}
