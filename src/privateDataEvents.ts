export const PRIVATE_DATA_CHANGED_EVENT = 'focus-english-lab:private-data-changed'
export const PRIVATE_DATA_APPLIED_EVENT = 'focus-english-lab:private-data-applied'

export function notifyPrivateDataChanged() {
  window.dispatchEvent(new Event(PRIVATE_DATA_CHANGED_EVENT))
}

export function notifyPrivateDataApplied() {
  window.dispatchEvent(new Event(PRIVATE_DATA_APPLIED_EVENT))
}
