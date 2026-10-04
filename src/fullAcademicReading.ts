import type { BaseItem } from './types'
import { B1_PASSAGES } from './fullAcademicReadingB1'
import { B2_PASSAGES } from './fullAcademicReadingB2'
import { C1_PASSAGES } from './fullAcademicReadingC1'

export type FullAcademicQuestion = [
  prompt: string,
  correct: string,
  wrong: [string, string, string],
  reasonsKo: [correct: string, wrong1: string, wrong2: string, wrong3: string],
]

export type FullAcademicPassage = {
  topic: string
  passage: string
  questions: [FullAcademicQuestion, FullAcademicQuestion, FullAcademicQuestion, FullAcademicQuestion, FullAcademicQuestion]
}

const drafts = [
  ...B1_PASSAGES.map((draft) => ({ ...draft, difficulty: 'B1' as const })),
  ...B2_PASSAGES.map((draft) => ({ ...draft, difficulty: 'B2' as const })),
  ...C1_PASSAGES.map((draft) => ({ ...draft, difficulty: 'C1' as const })),
]

const questionSkills = ['핵심 주장 파악', '세부 정보 확인', '근거 기반 추론', '문맥 속 어휘', '글의 구조 파악'] as const

if (B1_PASSAGES.length !== 10 || B2_PASSAGES.length !== 10 || C1_PASSAGES.length !== 10) {
  throw new Error('Full academic reading requires ten passages at each difficulty.')
}

export const fullAcademicReading: BaseItem[] = drafts.flatMap((draft, passageIndex) => {
  const passageId = `full-academic-${String(passageIndex + 1).padStart(2, '0')}`
  return draft.questions.map(([prompt, correct, wrong, reasonsKo], questionIndex) => {
    const answer = (passageIndex * 5 + questionIndex) % 4
    const options = [...wrong]
    options.splice(answer, 0, correct)
    const reasons = [reasonsKo[1], reasonsKo[2], reasonsKo[3]]
    reasons.splice(answer, 0, reasonsKo[0])
    const explanation = options.map((_, index) => `${'ABCD'[index]}: ${reasons[index]}`).join(' ')
    return {
      id: `${passageId}-${questionIndex}`,
      section: 'reading',
      module: 1,
      kind: 'multiple-choice',
      title: 'Read an Academic Passage',
      instruction: '학술 지문만을 근거로 핵심 주장, 세부 정보, 추론, 어휘, 글의 구조를 판단하세요.',
      topic: draft.topic,
      difficulty: draft.difficulty,
      timeSeconds: 120,
      stimulusGroupId: passageId,
      sequenceIndex: questionIndex,
      sourceFamily: 'authored-full-academic-reading',
      targetSkills: [questionSkills[questionIndex]],
      passage: draft.passage,
      prompt,
      options,
      answer,
      explanation,
    } satisfies BaseItem
  })
})
