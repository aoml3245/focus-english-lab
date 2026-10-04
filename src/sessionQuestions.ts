import legacyRevisions from './legacyQuestionRevisions.json'
import type { BaseItem, SavedSession } from './types'

const legacyById = new Map((legacyRevisions as unknown as BaseItem[]).map((item) => [item.id, item]))

/** Resolve the actual question/options seen by the learner, not a later rewrite. */
export function resolveSessionItems(session: SavedSession, currentItems: ReadonlyMap<string, BaseItem>) {
  const snapshots = new Map((session.itemSnapshots || []).map((item) => [item.id, item]))
  return (session.itemIds || []).flatMap((id) => {
    const item = snapshots.get(id) || (!session.questionBankRevision ? legacyById.get(id) : undefined) || currentItems.get(id)
    return item ? [item] : []
  })
}
