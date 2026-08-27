export type Section = 'reading' | 'listening' | 'writing' | 'speaking'
export type PracticeMode = 'study' | 'mock' | 'section'

export type ItemKind =
  | 'complete-words'
  | 'multiple-choice'
  | 'listen-choice'
  | 'sentence-build'
  | 'email'
  | 'discussion'
  | 'repeat'
  | 'interview'

export interface BaseItem {
  id: string
  section: Section
  module: number
  kind: ItemKind
  title: string
  instruction: string
  prompt?: string
  passage?: string
  audioText?: string
  options?: string[]
  answer?: string | number
  words?: string[]
  starter?: string
  timeSeconds: number
  topic?: string
  context?: string
  difficulty?: 'B1' | 'B2' | 'C1'
  explanation?: string
}

export type Answer = string | number | string[]

export interface SavedSession {
  id: string
  itemIds?: string[]
  startedAt: string
  updatedAt: string
  itemIndex: number
  answers: Record<string, Answer>
  completed: boolean
  mode?: PracticeMode
  reviewedItemIds?: string[]
  randomEligible?: boolean
}
