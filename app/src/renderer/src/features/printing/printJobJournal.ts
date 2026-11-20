export type PrintJournalStatus = 'running' | 'submitted' | 'partial' | 'failed' | 'canceled' | 'unknown'

export interface PrintJournalEntry {
  jobId: string
  title: string
  mode: 'driver' | 'command'
  logicalCount: number
  physicalCount: number
  sentLogicalCount: number
  sentPhysicalCount: number
  batchIndex: number
  batchCount: number
  serialCommitted: boolean
  requiresSerialCommit?: boolean
  mainManaged?: boolean
  acknowledged?: boolean
  status: PrintJournalStatus
  message?: string
  updatedAt: string
}

const STORAGE_KEY = 'maxlabel.print-job-journal.v1'
const MAX_ENTRIES = 40

function readEntries(): PrintJournalEntry[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return []
    const value = JSON.parse(raw) as unknown
    return Array.isArray(value) ? value.filter((item): item is PrintJournalEntry =>
      Boolean(item && typeof item === 'object' && typeof item.jobId === 'string' && typeof item.title === 'string')) : []
  } catch {
    return []
  }
}

function writeEntries(entries: PrintJournalEntry[]): boolean {
  const recentClosed = new Set(entries.filter((entry) => !needsRecovery(entry)).slice(-MAX_ENTRIES))
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.filter((entry) => needsRecovery(entry) || recentClosed.has(entry))))
    return true
  } catch {
    return false
  }
}

function needsRecovery(entry: PrintJournalEntry): boolean {
  return !entry.mainManaged && !entry.acknowledged && (entry.status === 'running' || entry.status === 'unknown' ||
    (entry.sentPhysicalCount > 0 && entry.requiresSerialCommit !== false && !entry.serialCommitted))
}

function update(jobId: string, patch: Partial<PrintJournalEntry>): void {
  const entries = readEntries()
  const index = entries.findIndex((entry) => entry.jobId === jobId)
  if (index < 0) return
  entries[index] = { ...entries[index], ...patch, updatedAt: new Date().toISOString() }
  writeEntries(entries)
}

export const printJobJournal = {
  begin(entry: Omit<PrintJournalEntry, 'updatedAt' | 'status' | 'serialCommitted' | 'sentLogicalCount' | 'sentPhysicalCount' | 'batchIndex'>): void {
    const entries = readEntries().filter((item) => item.jobId !== entry.jobId)
    entries.push({ ...entry, sentLogicalCount: 0, sentPhysicalCount: 0, batchIndex: 0, serialCommitted: false, status: 'running', updatedAt: new Date().toISOString() })
    writeEntries(entries)
  },
  progress(jobId: string, patch: Pick<PrintJournalEntry, 'sentLogicalCount' | 'sentPhysicalCount' | 'batchIndex'>): void {
    update(jobId, patch)
  },
  serialCommitted(jobId: string): void {
    update(jobId, { serialCommitted: true })
  },
  finish(jobId: string, status: Exclude<PrintJournalStatus, 'running'>, message?: string): void {
    update(jobId, { status, ...(message ? { message } : {}) })
  },
  pending(): PrintJournalEntry[] {
    return readEntries().filter(needsRecovery)
  },
  acknowledge(jobIds: string[]): boolean {
    const reviewed = new Set(jobIds)
    return writeEntries(readEntries().map((entry) => reviewed.has(entry.jobId) ? { ...entry, acknowledged: true } : entry))
  }
}
