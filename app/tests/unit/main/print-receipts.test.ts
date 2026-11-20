import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { printReceipts } from '@main/printing/printReceipts'

it('recovers confirmed labels and the exact in-flight range across journal instances', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'maxlabel-receipts-test-'))
  try {
    const first = { title: 'fixture', total: 25, index: 1, first: 1, last: 24, template: 'C:/labels/fixture.msdx', printer: 'Printer A' }
    const second = { ...first, index: 2, first: 25, last: 25, dataset: 'SKU', records: [143] }
    const running = printReceipts(dir, 101, () => true)
    const other = printReceipts(dir, 102, () => true)
    const record = await running.begin('job', first)
    await record({ ok: true, status: 'accepted' })
    expect((await other.pending()).jobs).toEqual([])
    await expect(other.acknowledge('job')).rejects.toThrow('持有')
    const recordSecond = await running.begin('job', second)
    await recordSecond({ ok: false, status: 'unknown' })
    const broken = join(dir, 'a'.repeat(64) + '.json')
    await writeFile(broken, '{')
    const restored = printReceipts(dir, 102, () => false)
    expect(await restored.pending()).toEqual({ unreadableCount: 1, jobs: [expect.objectContaining({
      jobId: 'job', sentPhysicalCount: 24, template: first.template, printer: first.printer,
      submittedAt: expect.any(String), uncertain: { first: 25, last: 25, dataset: 'SKU', records: [143] }
    })] })
    expect(await readFile(broken, 'utf8')).toBe('{')
    await expect(restored.begin('job', second)).rejects.toThrow('另一个实例')
    await running.finish('job', false)
    expect((await other.pending()).jobs).toHaveLength(1)
    await restored.acknowledge('job')
    expect(await restored.pending()).toEqual({ jobs: [], unreadableCount: 1 })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
