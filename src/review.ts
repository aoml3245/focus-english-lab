import type { Answer, BaseItem, SavedSession } from './types'

export function isCorrect(item: BaseItem, response: Answer | undefined) {
  if (Array.isArray(response)) return response.join('|').toLowerCase() === String(item.answer).toLowerCase()
  return response === item.answer
}

export function displayAnswer(item: BaseItem, answer: Answer | undefined) {
  if (answer === undefined) return '응답 없음'
  if (typeof answer === 'number') return item.options?.[answer] || (item.kind === 'repeat' || item.kind === 'interview' ? `${answer}초 녹음` : String(answer))
  if (Array.isArray(answer)) return item.kind === 'sentence-build' ? `${item.starter} ${answer.join(' ')}` : answer.join(' / ')
  if (item.kind === 'sentence-build') return `${item.starter} ${answer.split('|').join(' ')}`
  return answer.split('|').join(' / ')
}

export function getSessionStats(items: BaseItem[], session: SavedSession) {
  const objective = items.filter((item) => item.answer !== undefined)
  const correct = objective.filter((item) => isCorrect(item, session.answers[item.id])).length
  const answered = items.filter((item) => session.answers[item.id] !== undefined).length
  const practiceBand = objective.length ? Math.max(1, Math.min(6, Math.round((1 + (correct / objective.length) * 5) * 2) / 2)) : null
  return { objective, correct, answered, practiceBand, mistakes: objective.filter((item) => !isCorrect(item, session.answers[item.id])) }
}
