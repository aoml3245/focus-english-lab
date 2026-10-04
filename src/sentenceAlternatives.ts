import type { BaseItem } from './types'

// Same supplied tiles, with an independently checked adverb/adjunct placement.
const alternatives: Record<string, string[]> = {
  'w-sentence-0': ['how|to|more clearly|organize|the evidence'],
  'w-sentence-10': ['for beginners|than|the|previous|version|was'],
  'w-sentence-11': ['so that|he|can|correctly|analyze|the survey data'],
  'w-sentence-19': ['during testing|to|a|sudden|change|in temperature'],
  'f19-sentence-6': ['regional absences|could|reflect|modern research|as|easily|as ancient exchange'],
  'f25-sentence-4': ['in|the|same|habitat|each variant|is favored|under a different|set of conditions'],
  'f29-sentence-5': ['the data|to be shared|for this purpose|with students|outside the course'],
  'f30-sentence-9': ['on Thursday|the room|would have been|available for|our rehearsal'],
}

export function withSentenceAlternatives(item: BaseItem): BaseItem {
  return alternatives[item.id] ? { ...item, acceptedAnswers: alternatives[item.id] } : item
}
