import type { BaseItem } from './types'
import { coachedWritingItems } from './coachedWriting'
import { coachedSpeakingItems } from './coachedSpeaking'

export const coachedTaskBank: BaseItem[] = [...coachedWritingItems, ...coachedSpeakingItems]
