import type { Section } from './types'

export { QUESTION_BANK as PRACTICE_ITEMS, buildFullPracticeSet, buildSectionPractice, countBySection, CONTEXT_TOPIC_COUNT } from './bank'

export const SECTION_META: Record<Section, { label: string; minutes: number; tasks: string }> = {
  reading: { label: 'Reading', minutes: 30, tasks: 'Complete Words · Daily Life · Academic Passage' },
  listening: { label: 'Listening', minutes: 29, tasks: 'Response · Conversation · Announcement · Talk' },
  writing: { label: 'Writing', minutes: 23, tasks: 'Build a Sentence · Email · Academic Discussion' },
  speaking: { label: 'Speaking', minutes: 8, tasks: 'Listen and Repeat · Take an Interview' },
}
