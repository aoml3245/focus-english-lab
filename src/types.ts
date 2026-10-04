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
  /** Curated, grammatically valid tile orders; never an arbitrary permutation. */
  acceptedAnswers?: string[]
  words?: string[]
  starter?: string
  timeSeconds: number
  topic?: string
  context?: string
  difficulty?: 'B1' | 'B2' | 'C1'
  grammarFocus?: string
  stimulusGroupId?: string
  scenarioId?: string
  sequenceIndex?: number
  sourceFamily?: string
  explanation?: string
  modelResponse?: string
  taskChecklist?: string[]
  commonMistakes?: string[]
  rewriteGuidance?: string[]
  targetSkills?: string[]
  responseTimeSeconds?: number
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
  practiceLabel?: string
  questionBankRevision?: string
  itemSnapshots?: BaseItem[]
  playedStimulusGroupIds?: string[]
  adaptive?: {
    version: 1
    candidates: Partial<Record<'reading' | 'listening', { lower: BaseItem[]; upper: BaseItem[] }>>
    decisions: Partial<Record<'reading' | 'listening', { route: 'lower' | 'upper'; correct: number; total: number; decidedAt: string }>>
  }
  reviewSource?: 'exact' | 'transfer'
  moduleDeadlines?: Record<string, string>
}
