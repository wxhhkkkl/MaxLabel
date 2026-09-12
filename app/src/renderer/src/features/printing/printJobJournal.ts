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
    return Array.isArray(value) ? value.filter((item): item is PrintJournalEntry => Boolean(item && typeof item === 'object' && typeof (item as PrintJournalEntry).jobId === 'string')) : []
  } catch {
    return []
  }
}

function writeEntries(entries: PrintJournalEntry[]): void {
  try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES))) } catch { /* journal must never block printing */ }
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
    return readEntries().filter((entry) => entry.status === 'running')
  }
}
