/** True when the tab that started the active print/preview/export is being closed. */
export function closingIncludesTrackedTab(trackedTab: string | null, closing: Iterable<string>): boolean {
  if (!trackedTab) return false
  for (const key of closing) {
    if (key === trackedTab) return true
  }
  return false
}
