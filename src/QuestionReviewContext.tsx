import type { BaseItem } from './types'
import { completedClozePassage } from './clozeFormat'

export function QuestionReviewContext({ item }: { item: BaseItem }) {
  return <div className="question-review-context">
    {(item.passage || item.audioText) && <blockquote><strong>{item.passage ? '당시 지문' : '음성 원문'}</strong><p>{item.passage || item.audioText}</p></blockquote>}
    {item.kind === 'sentence-build' && <p><strong>문장 시작:</strong> {item.starter}<br /><strong>제공된 조각:</strong> {item.words?.join(' / ')}</p>}
    {item.options && <ol type="A" aria-label="문제의 모든 보기">{item.options.map((option, index) => <li key={index}>{option}</li>)}</ol>}
    {item.kind === 'complete-words' && <blockquote><strong>정답을 넣은 완성 지문</strong><p>{completedClozePassage(item)}</p></blockquote>}
  </div>
}
