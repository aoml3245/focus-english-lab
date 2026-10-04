import type { BaseItem } from './types'

/** Original text only: keep the opening sentence, then remove ten alternating half-words. */
export function withCtestFormat(item: BaseItem): BaseItem {
  if (item.kind !== 'complete-words' || !item.passage || typeof item.answer !== 'string') return item
  const suffixes = item.answer.split('|')
  let restored = 0
  const full = item.passage.replace(/___/g, () => suffixes[restored++] ?? '')
  if (restored !== suffixes.length) throw new Error(`Invalid cloze reconstruction: ${item.id}`)
  const opening = full.search(/[.!?](?:\s|$)/)
  if (opening < 0) throw new Error(`Missing intact opening sentence: ${item.id}`)
  const answers: string[] = []
  const completedWords: string[] = []
  let wordIndex = 0
  const tail = full.slice(opening + 1).replace(/\b[A-Za-z]+(?:['’\-][A-Za-z]+)*\b/g, (word) => {
    const index = wordIndex++
    if (index % 2 === 0 || answers.length === 10) return word
    const split = Math.floor(word.length / 2)
    answers.push(word.slice(split))
    completedWords.push(word)
    return `${word.slice(0, split)}___`
  })
  if (answers.length !== 10) throw new Error(`C-test needs twenty words after its opening: ${item.id}`)
  return { ...item, passage: full.slice(0, opening + 1) + tail, answer: answers.join('|'), explanation: `첫 문장은 그대로 두고 이후 두 번째 단어마다 뒤쪽 철자를 완성합니다. 각 빈칸에 들어갈 철자와 완성 단어는 ${completedWords.map((word, index) => `${index + 1}. ${answers[index]} → ${word}`).join(' / ')}입니다. 아래 완성 지문에서 앞뒤 문맥과 품사·시제·수 일치를 확인하세요.` }
}

export function completedClozePassage(item: BaseItem) {
  if (item.kind !== 'complete-words' || !item.passage || typeof item.answer !== 'string') return undefined
  const suffixes = item.answer.split('|')
  let index = 0
  return item.passage.replace(/___/g, () => suffixes[index++] || '')
}
