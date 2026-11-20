import { afterEach, expect, it, vi } from 'vitest'
import { printJobJournal } from '@/features/printing/printJobJournal'

afterEach(() => vi.unstubAllGlobals())

it('keeps uncertain output and uncommitted serials available for restart recovery', () => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
  const begin = (jobId: string, requiresSerialCommit = true) => {
    const entry = { jobId, requiresSerialCommit, title: 'fixture', mode: 'command' as const, logicalCount: 1, physicalCount: 1, batchCount: 1 }
    printJobJournal.begin(entry)
  }
  const sent = (jobId: string) => printJobJournal.progress(jobId, { sentLogicalCount: 1, sentPhysicalCount: 1, batchIndex: 1 })

  begin('interrupted')
  begin('unknown')
  printJobJournal.finish('unknown', 'unknown')
  begin('unsaved')
  sent('unsaved')
  printJobJournal.finish('unsaved', 'submitted')
  begin('partial')
  sent('partial')
  printJobJournal.serialCommitted('partial')
  printJobJournal.finish('partial', 'partial')
  for (let index = 0; index < 45; index++) {
    const id = 'complete-' + index
    begin(id, false)
    sent(id)
    printJobJournal.finish(id, 'submitted')
  }
  expect(printJobJournal.pending().map((job) => job.jobId)).toEqual(['interrupted', 'unknown', 'unsaved'])
})

it('allows the operator to acknowledge only the jobs they reviewed', () => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
  for (const jobId of ['reviewed', 'waiting']) {
    printJobJournal.begin({ jobId, title: jobId, mode: 'command', logicalCount: 1, physicalCount: 1, batchCount: 1 })
    printJobJournal.finish(jobId, 'unknown')
  }
  expect(printJobJournal.acknowledge(['reviewed'])).toBe(true)
  expect(printJobJournal.pending().map((job) => job.jobId)).toEqual(['waiting'])
})
