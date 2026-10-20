export type PrintHistoryStatus = 'completed' | 'submitted' | 'partial' | 'failed' | 'canceled' | 'unknown'

export interface PrintHistoryRow {
  time: string
  title: string
  mode: string
  count: number
  copies: number
  physicalCount?: number
  sentCount?: number
  status?: PrintHistoryStatus
  test: boolean
  printer: string
  dataSnapshot?: string[]
}

/** Catalog key for a stored status; unknown/absent values read as “submitted”. */
export function historyStatusKey(status: PrintHistoryStatus | undefined): string {
  if (status === 'partial') return 'history.status.partial'
  if (status === 'failed') return 'history.status.failed'
  if (status === 'canceled') return 'history.status.canceled'
  if (status === 'unknown') return 'history.status.unknown'
  return 'history.status.submitted'
}

/** Planned physical labels: stored value, or count × copies when absent. */
export function historyPhysicalCount(row: Pick<PrintHistoryRow, 'count' | 'copies' | 'physicalCount'>): number {
  return row.physicalCount ?? (row.count ?? 0) * (row.copies ?? 0)
}

/** Newest first; returns a copy so the source array is untouched. */
export function sortLogsNewestFirst<T extends { time: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => String(b.time).localeCompare(String(a.time)))
}
