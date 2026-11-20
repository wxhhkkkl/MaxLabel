import { createHash, randomUUID } from 'node:crypto'
import { mkdir, open, readdir, readFile, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { PrintBatchReceipt, PrintRecoveryResult, PrintTransportResult, RecoverablePrintJob } from '../../shared/ipcContract'
import { MAX_PRINT_PHYSICAL_LABELS } from '../../shared/print/plan'

interface Receipt extends RecoverablePrintJob {
  nextBatch: number
  owner?: number
}

export function validateBatchReceipt(value: unknown): PrintBatchReceipt | undefined {
  if (value === undefined) return
  const batch = value as PrintBatchReceipt | null
  if (!batch || typeof batch.title !== 'string' || batch.title.length > 4096 ||
    (batch.staged !== undefined && typeof batch.staged !== 'boolean') ||
    !validMetadata(batch) || !validRecords(batch) ||
    ![batch.total, batch.index, batch.first, batch.last].every((n) => Number.isInteger(n) && n >= 1 && n <= MAX_PRINT_PHYSICAL_LABELS) ||
    batch.first > batch.last || batch.last > batch.total) throw new Error('打印批次范围无效')
  return batch
}

function validMetadata(value: { template?: string; printer?: string; submittedAt?: string; dataset?: string }) {
  return [value.template, value.printer, value.submittedAt, value.dataset].every((text) => text === undefined || (typeof text === 'string' && text.length <= 4096))
}

function validRecords(value: { records?: number[]; recordsTruncated?: boolean }) {
  return (value.recordsTruncated === undefined || typeof value.recordsTruncated === 'boolean') &&
    (value.records === undefined || (Array.isArray(value.records) && value.records.length <= 24 &&
      value.records.every((index) => Number.isSafeInteger(index) && index > 0)))
}

export function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}

export function printReceipts(directory: string, owner = process.pid, isAlive: (pid: number, jobId: string) => boolean = processExists) {
  const pathFor = (id: string) => join(directory, createHash('sha256').update(id).digest('hex') + '.json')
  async function save(receipt: Receipt) {
    await mkdir(directory, { recursive: true })
    const path = pathFor(receipt.jobId)
    const temp = path + '.' + randomUUID() + '.tmp'
    try {
      const file = await open(temp, 'wx', 0o600)
      try {
        await file.writeFile(JSON.stringify(receipt))
        await file.sync()
      } finally {
        await file.close()
      }
      await rename(temp, path)
    } finally {
      await rm(temp, { force: true }).catch(() => {})
    }
  }

  async function readFileReceipt(path: string): Promise<Receipt | undefined> {
    try {
      const entry = JSON.parse(await readFile(path, 'utf8')) as Receipt | null
      if (!entry || typeof entry.jobId !== 'string' || pathFor(entry.jobId) !== path || typeof entry.title !== 'string' ||
        !Number.isInteger(entry.physicalCount) || entry.physicalCount < 1 || entry.physicalCount > MAX_PRINT_PHYSICAL_LABELS ||
        !Number.isInteger(entry.sentPhysicalCount) || entry.sentPhysicalCount < 0 || entry.sentPhysicalCount > entry.physicalCount ||
        !Number.isInteger(entry.nextBatch) || entry.nextBatch < 1 ||
        (entry.owner !== undefined && (!Number.isSafeInteger(entry.owner) || entry.owner <= 0)) ||
        !validMetadata(entry) ||
        (entry.uncertain !== undefined && (!entry.uncertain || !Number.isInteger(entry.uncertain.first) ||
          !Number.isInteger(entry.uncertain.last) || entry.uncertain.first !== entry.sentPhysicalCount + 1 ||
          entry.uncertain.last < entry.uncertain.first || entry.uncertain.last > entry.physicalCount ||
          !validMetadata(entry.uncertain) || !validRecords(entry.uncertain)))) throw new Error('打印回执格式无效')
      return entry
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  return {
    async begin(jobId: string, batch: PrintBatchReceipt) {
      const receipt = await readFileReceipt(pathFor(jobId)) ?? {
        jobId, title: batch.title, physicalCount: batch.total, sentPhysicalCount: 0, nextBatch: 1,
        template: batch.template, printer: batch.printer, submittedAt: new Date().toISOString()
      }
      if (receipt.owner !== undefined && receipt.owner !== owner) throw new Error('打印任务属于另一个实例')
      if (receipt.uncertain || receipt.nextBatch !== batch.index || receipt.sentPhysicalCount + 1 !== batch.first ||
        receipt.physicalCount !== batch.total) throw new Error('打印批次顺序无效或上一批尚待核对')
      receipt.owner = owner
      await save({ ...receipt, uncertain: {
        first: batch.first, last: batch.last, dataset: batch.dataset, records: batch.records, recordsTruncated: batch.recordsTruncated
      } })
      return async (result: PrintTransportResult): Promise<PrintTransportResult> => {
        if (result.status === 'unknown') return result
        try {
          await save({
            ...receipt,
            sentPhysicalCount: result.ok ? batch.last : receipt.sentPhysicalCount,
            nextBatch: result.ok ? batch.index + 1 : receipt.nextBatch
          })
          return result
        } catch {
          return { ok: false, status: 'unknown', message: '无法保存批次结果，请核对打印机输出' }
        }
      }
    },
    async pending(): Promise<PrintRecoveryResult> {
      const names = await readdir(directory).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return []
        throw error
      })
      const jobs: PrintRecoveryResult['jobs'] = []
      let unreadableCount = 0
      for (const name of names) {
        if (!/^[a-f0-9]{64}\.json$/.test(name)) continue
        try {
          const receipt = await readFileReceipt(join(directory, name))
          if (receipt && (receipt.owner === undefined || !isAlive(receipt.owner, receipt.jobId)) && (receipt.uncertain || receipt.sentPhysicalCount)) jobs.push(receipt)
        } catch {
          unreadableCount++
        }
      }
      return { jobs, unreadableCount }
    },
    async acknowledge(jobId: string) {
      const receipt = await readFileReceipt(pathFor(jobId))
      if (receipt?.owner !== undefined && isAlive(receipt.owner, jobId)) throw new Error('打印任务仍由运行中的实例持有')
      await rm(pathFor(jobId), { force: true })
    },
    async finish(jobId: string, discard: boolean) {
      const receipt = await readFileReceipt(pathFor(jobId))
      if (!receipt || receipt.owner !== owner) return
      if ((discard && !receipt.uncertain) || (!receipt.uncertain && !receipt.sentPhysicalCount)) {
        await rm(pathFor(jobId), { force: true })
      } else {
        delete receipt.owner
        await save(receipt)
      }
    }
  }
}
