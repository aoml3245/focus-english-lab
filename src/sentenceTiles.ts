function wordCount(tile: string) {
  return tile.trim().split(/\s+/).length
}

function hashSeed(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function deterministicShuffle(values: string[], seed: string) {
  const shuffled = [...values]
  let state = hashSeed(seed) || 1
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const target = state % (index + 1)
    ;[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]]
  }
  if (shuffled.length > 1 && shuffled.every((value, index) => value === values[index])) {
    shuffled.push(shuffled.shift()!)
  }
  return shuffled
}

function normalizeCorrectTiles(source: string[]) {
  let tiles = source.flatMap((tile) => wordCount(tile) > 3 ? tile.trim().split(/\s+/) : [tile.trim()])
  while (tiles.length < 5) {
    const longestIndex = tiles.reduce((best, tile, index) => wordCount(tile) > wordCount(tiles[best]) ? index : best, 0)
    if (wordCount(tiles[longestIndex]) === 1) break
    const replacement = tiles[longestIndex].split(/\s+/)
    tiles = [...tiles.slice(0, longestIndex), ...replacement, ...tiles.slice(longestIndex + 1)]
  }
  return tiles
}

export function prepareSentenceTiles(source: string[], seed: string, distractor?: string) {
  const correct = normalizeCorrectTiles(source)
  const choices = distractor ? [...correct, distractor] : correct
  return {
    correct,
    choices: deterministicShuffle(choices, seed),
    answer: correct.join('|'),
  }
}
