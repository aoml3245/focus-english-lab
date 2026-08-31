import type { BaseItem } from './types'
import { AUTHORED_FORM_03_IDS } from './authoredForm03'
import { AUTHORED_FORM_04_IDS } from './authoredForm04'
import { AUTHORED_FORM_05_IDS } from './authoredForm05'
import { AUTHORED_FORM_06_IDS } from './authoredForm06'
import { AUTHORED_FORM_07_IDS } from './authoredForm07'
import { AUTHORED_FORM_08_IDS } from './authoredForm08'
import { AUTHORED_FORM_09_IDS } from './authoredForm09'
import { AUTHORED_FORM_10_IDS } from './authoredForm10'
import { AUTHORED_FORM_11_IDS } from './authoredForm11'
import { AUTHORED_FORM_12_IDS } from './authoredForm12'
import { AUTHORED_FORM_13_IDS } from './authoredForm13'
import { AUTHORED_FORM_14_IDS } from './authoredForm14'
import { AUTHORED_FORM_15_IDS } from './authoredForm15'
import { AUTHORED_FORM_16_IDS } from './authoredForm16'
import { AUTHORED_FORM_17_IDS } from './authoredForm17'
import { AUTHORED_FORM_18_IDS } from './authoredForm18'
import { AUTHORED_FORM_19_IDS } from './authoredForm19'
import { AUTHORED_FORM_20_IDS } from './authoredForm20'
import { AUTHORED_FORM_21_IDS } from './authoredForm21'
import { AUTHORED_FORM_22_IDS } from './authoredForm22'
import {
  AUTHORED_FORM_23_IDS, AUTHORED_FORM_24_IDS, AUTHORED_FORM_25_IDS, AUTHORED_FORM_26_IDS,
  AUTHORED_FORM_27_IDS, AUTHORED_FORM_28_IDS, AUTHORED_FORM_29_IDS, AUTHORED_FORM_30_IDS,
} from './authoredForms23to30'

const ids = (value: string) => value.trim().split(/\s+/)

export const AUTHORED_FORM_IDS: string[][] = [
  ids(`
    r-cloze-4 r-cloze-1 r-daily-9 r-daily-6 r-daily-7 r-daily-4
    r-academic-3-0 r-academic-3-1 a-r-fungal-networks-0 a-r-fungal-networks-1 a-r-fungal-networks-2
    r-cloze-3 r-daily-11 r-daily-5 a2-r-freezer a2-r-language-exchange a2-r-accommodations a2-r-garden
    a-r-dawn-chorus-0 a-r-dawn-chorus-1 a-r-dawn-chorus-2 ctx-5-r0 ctx-5-r1
    l-response-4 l-response-5 a2-l-response-6 a2-l-response-14 l-response-9 a2-l-response-15 a2-l-response-3 a2-l-response-10 l-response-10
    ctx-4-l0 ctx-4-l1 a-l-conversation-printer-0 a-l-conversation-printer-1 a-l-conversation-printer-2
    a-l-announcement-theater-0 a-l-announcement-theater-1 a2-l-ann-stockroom-0 a2-l-ann-stockroom-1
    l-set-7-0 l-set-7-1 l-set-6-0 l-set-6-1 a-l-talk-beavers-0 a-l-talk-beavers-1
    a-l-response-archive l-response-3 l-response-0 a2-l-response-12 l-response-15 l-response-11 a2-l-response-4 a2-l-response-11
    ctx-9-l0 ctx-9-l1 a2-l-conversation-scanner-0 a2-l-conversation-scanner-1 a2-l-conversation-scanner-2
    a2-l-ann-trail-0 a2-l-ann-trail-1 a-l-announcement-rare-books-0 a-l-announcement-rare-books-1
    a-l-talk-sunk-cost-0 a-l-talk-sunk-cost-1 a-l-talk-volcanoes-0 a-l-talk-volcanoes-1 a2-l-talk-bilingual-0 a2-l-talk-bilingual-1
    w-sentence-14 w-sentence-12 w-sentence-5 w-sentence-9 w-sentence-13 w-sentence-18 w-sentence-2 w-sentence-15 w-sentence-8 w-sentence-4
    w-email-5 ctx-8-w1
    s-repeat-1-0 s-repeat-1-1 s-repeat-1-2 s-repeat-1-3 s-repeat-1-4 s-repeat-1-5 s-repeat-1-6
    s-interview-7-0 s-interview-7-1 s-interview-7-2 s-interview-7-3
  `),
  ids(`
    r-cloze-0 r-cloze-7 r-daily-2 a2-r-practice-rooms a2-r-parking r-daily-3
    r-academic-7-0 r-academic-7-1 a-r-tooth-isotopes-0 a-r-tooth-isotopes-1 a-r-tooth-isotopes-2
    r-cloze-2 r-daily-10 r-daily-8 a2-r-lost-property r-daily-1 a2-r-career-fair r-daily-0
    ctx-9-r0 ctx-9-r1 a-r-palimpsests-0 a-r-palimpsests-1 a-r-palimpsests-2
    l-response-13 a2-l-response-8 l-response-1 l-response-7 a2-l-response-9 a2-l-response-7 l-response-2 l-response-14 a2-l-response-0
    ctx-5-l0 ctx-5-l1 a-l-conversation-field-trip-0 a-l-conversation-field-trip-1 a-l-conversation-field-trip-2
    l-set-3-0 l-set-3-1 a2-l-ann-election-0 a2-l-ann-election-1
    a2-l-talk-anchoring-0 a2-l-talk-anchoring-1 a2-l-talk-navigation-0 a2-l-talk-navigation-1 a2-l-talk-tree-rings-0 a2-l-talk-tree-rings-1
    l-response-12 l-response-6 a2-l-response-5 l-response-8 a2-l-response-2 a2-l-response-1 a2-l-response-16 a2-l-response-13
    ctx-1-l0 ctx-1-l1 a2-l-conversation-recorders-0 a2-l-conversation-recorders-1 a2-l-conversation-recorders-2
    a2-l-ann-screening-0 a2-l-ann-screening-1 l-set-4-0 l-set-4-1
    a2-l-talk-pottery-0 a2-l-talk-pottery-1 l-set-5-0 l-set-5-1 a2-l-talk-albedo-0 a2-l-talk-albedo-1
    w-sentence-1 w-sentence-3 w-sentence-10 w-sentence-17 w-sentence-0 w-sentence-16 w-sentence-6 w-sentence-11 w-sentence-19 w-sentence-7
    ctx-2-w0 ctx-2-w1
    s-repeat-2-0 s-repeat-2-1 s-repeat-2-2 s-repeat-2-3 s-repeat-2-4 s-repeat-2-5 s-repeat-2-6
    s-interview-2-0 s-interview-2-1 s-interview-2-2 s-interview-2-3
  `),
  AUTHORED_FORM_03_IDS,
  AUTHORED_FORM_04_IDS,
  AUTHORED_FORM_05_IDS,
  AUTHORED_FORM_06_IDS,
  AUTHORED_FORM_07_IDS,
  AUTHORED_FORM_08_IDS,
  AUTHORED_FORM_09_IDS,
  AUTHORED_FORM_10_IDS,
  AUTHORED_FORM_11_IDS,
  AUTHORED_FORM_12_IDS,
  AUTHORED_FORM_13_IDS,
  AUTHORED_FORM_14_IDS,
  AUTHORED_FORM_15_IDS,
  AUTHORED_FORM_16_IDS,
  AUTHORED_FORM_17_IDS,
  AUTHORED_FORM_18_IDS,
  AUTHORED_FORM_19_IDS,
  AUTHORED_FORM_20_IDS,
  AUTHORED_FORM_21_IDS,
  AUTHORED_FORM_22_IDS,
  AUTHORED_FORM_23_IDS,
  AUTHORED_FORM_24_IDS,
  AUTHORED_FORM_25_IDS,
  AUTHORED_FORM_26_IDS,
  AUTHORED_FORM_27_IDS,
  AUTHORED_FORM_28_IDS,
  AUTHORED_FORM_29_IDS,
  AUTHORED_FORM_30_IDS,
]

export function materializeAuthoredForms(bank: BaseItem[]) {
  const byId = new Map(bank.map((item) => [item.id, item]))
  return AUTHORED_FORM_IDS.map((formIds, index) => formIds.map((id, itemIndex) => {
    const item = byId.get(id)
    if (!item) throw new Error(`Authored form ${index + 1} references missing item ${id}.`)
    const module = itemIndex < 11 || (itemIndex >= 23 && itemIndex < 47) ? 1 : itemIndex < 23 || (itemIndex >= 47 && itemIndex < 70) ? 2 : 1
    return { ...item, module }
  }))
}
