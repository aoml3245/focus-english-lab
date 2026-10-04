import type { Answer, BaseItem, SavedSession } from './types'

export function isCorrect(item: BaseItem, response: Answer | undefined): boolean {
  if (item.answer === undefined || response === undefined) return false
  if (item.kind === 'sentence-build') {
    const normalize = (value: string) => value.split('|').map((tile) => tile.trim().toLowerCase()).join('|')
    const submitted = normalize(Array.isArray(response) ? response.join('|') : String(response))
    return [String(item.answer), ...(item.acceptedAnswers || [])].some((candidate) => normalize(candidate) === submitted)
  }
  if (item.kind === 'complete-words') {
    const score = scoreItem(item, response)
    return score.total > 0 && score.correct === score.total
  }
  return response === item.answer
}

export function scoreItem(item: BaseItem, response: Answer | undefined): { correct: number; total: number } {
  if (item.answer === undefined) return { correct: 0, total: 0 }
  if (item.kind !== 'complete-words') return { correct: isCorrect(item, response) ? 1 : 0, total: 1 }
  const expected = String(item.answer).split('|')
  const actual = Array.isArray(response) ? response : typeof response === 'string' ? response.split('|') : []
  const correct = expected.reduce((count, suffix, index) => count + (actual[index]?.trim().toLowerCase() === suffix.trim().toLowerCase() ? 1 : 0), 0)
  return { correct, total: expected.length }
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
  const scores = objective.map((item) => scoreItem(item, session.answers[item.id]))
  const correct = scores.reduce((sum, score) => sum + score.correct, 0)
  const total = scores.reduce((sum, score) => sum + score.total, 0)
  const answered = items.filter((item) => session.answers[item.id] !== undefined).length
  const sectionStats = (['reading', 'listening', 'writing', 'speaking'] as const).map((section) => {
    const sectionItems = items.filter((item) => item.section === section)
    const results = sectionItems.map((item) => scoreItem(item, session.answers[item.id]))
    const total = results.reduce((sum, result) => sum + result.total, 0)
    const correct = results.reduce((sum, result) => sum + result.correct, 0)
    return { section, correct, total, percent: total ? Math.round(correct / total * 100) : null,
      constructed: sectionItems.filter((item) => item.answer === undefined).length,
      constructedAnswered: sectionItems.filter((item) => item.answer === undefined && session.answers[item.id] !== undefined).length }
  })
  return { objective, total, correct, answered, percent: total ? Math.round(correct / total * 100) : null, sectionStats, mistakes: objective.filter((item) => !isCorrect(item, session.answers[item.id])) }
}
