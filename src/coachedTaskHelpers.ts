import type { BaseItem } from './types'

export type CoachedItem = BaseItem & {
  modelResponse: string
  taskChecklist: string[]
  commonMistakes: string[]
  rewriteGuidance: string[]
  targetSkills: string[]
  responseTimeSeconds?: number
}

export type WritingCase = {
  topic: string
  prompt: string
  checklist: string[]
  model: string
  mistakes: string[]
  rewrite: string
  passage?: string
}

export function writingItem(data: WritingCase, kind: 'email' | 'discussion', index: number): CoachedItem {
  return {
    id: `coached-${kind}-${String(index + 1).padStart(2, '0')}`,
    section: 'writing', module: 1, kind,
    title: kind === 'email' ? 'Write an Email' : 'Write for an Academic Discussion',
    sourceFamily: 'authored-coached-2026', topic: data.topic, difficulty: 'B2',
    timeSeconds: kind === 'email' ? 420 : 600,
    instruction: kind === 'email'
      ? '받는 사람과 목적에 맞춰 이메일을 작성하세요. 요청된 내용을 모두 포함하되 제시되지 않은 허가나 결과를 단정하지 마세요.'
      : '토론의 질문에 자신의 입장을 제시하고, 이유와 구체적인 예로 뒷받침하세요. 다른 의견과 연결하되 그대로 반복하지 마세요.',
    prompt: data.prompt, passage: data.passage,
    modelResponse: data.model,
    taskChecklist: data.checklist,
    commonMistakes: data.mistakes,
    rewriteGuidance: [data.rewrite, '예시의 문장 순서를 외우기보다 같은 목적을 자신의 표현으로 전달해 보세요.', '초안을 다시 읽고 요청 내용의 누락, 시제, 연결 표현을 확인하세요.'],
    targetSkills: kind === 'email' ? ['과제 요구 충족', '상황 설명', '정중하고 실행 가능한 요청'] : ['명확한 입장', '이유와 사례의 연결', '다른 관점에 대한 응답'],
    explanation: kind === 'email'
      ? `먼저 연락 목적을 밝히고, 상황과 영향, 원하는 조치를 차례로 연결하세요. ${data.checklist.join(' / ')}. 예시 답안은 가능한 표현의 한 사례입니다. 정답 문구를 복사하는 대신 필요한 정보와 상대방에게 요청할 결정을 확인하세요.`
      : `첫 문장에서 입장을 분명히 한 뒤, 이유가 실제 사례에서 어떻게 작용하는지 설명하세요. ${data.checklist.join(' / ')}. 반대 의견은 인정하거나 조건을 붙여 대응하고, 과장된 효과 대신 제안이 작동할 조건을 제시하세요.`,
  }
}
