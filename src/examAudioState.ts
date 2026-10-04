import type { BaseItem, PracticeMode } from './types'

export function requiresExamAudioPreflight(mode: PracticeMode, items: BaseItem[]) {
  return mode === 'mock' && items.some((item) => (item.section === 'listening' || item.section === 'speaking') && Boolean(item.audioText))
}

export function stimulusWasPlayed(item: BaseItem, played: readonly string[] = []) {
  return item.kind === 'listen-choice' && played.includes(item.stimulusGroupId || item.id)
}
