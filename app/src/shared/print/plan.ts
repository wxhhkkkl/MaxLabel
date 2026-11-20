import type { Dataset } from '../domain/datasource'

export interface PrintPlanInput {
  test: boolean
  requestedCount: number
  recordStart: number
  dataset?: Dataset
  cellsPerPage: number
  /** 首页从第几个拼版位置开始（原版 的“起始标签”），从 1 开始。 */
  startSlot?: number
  /** Optional source record indexes after application-level filtering (for example duplicate removal). */
  recordIndices?: number[]
  defaultCopies: number
  firstCopies?: number
  copyField?: string
  /** Script-defined total output budget, including copies. */
  physicalLabelLimit?: number
}

export interface PrintPlanCell {
  logicalIndex: number
  recordIndex: number
  labelIndex: number
  /** 本物理标签在该记录拷贝中的 0 基序号（序列号“每条记录复位”用）。 */
  recordLabelIndex?: number
  copies: number
  /** 页面中的实际槽位，允许首张纸前面保留空白位置。 */
  slotIndex: number
}

export interface PrintPlanPage {
  pageIndex: number
  cells: PrintPlanCell[]
  copies: number
}

export interface PrintPlan {
  pages: PrintPlanPage[]
  logicalLabelCount: number
  physicalPageCount: number
  physicalLabelCount: number
  serialAdvanceCount: number
  cellsPerPage: number
  startSlot: number
  recordStart: number
  recordCount: number
  warnings: string[]
}

export interface ExecutablePrintPlanOptions {
  /** Remove duplicate source records while preserving their first-seen order. */
  deduplicateRecords?: boolean
}

export const MAX_PRINT_LOGICAL_LABELS = 100000
export const MAX_PRINT_COPIES = 99999
export const MAX_PRINT_PHYSICAL_LABELS = 1000000

function positiveInt(value: number, fallback: number, max: number): number {
  if (!Number.isInteger(value) || value <= 0) return fallback
  if (value > max) throw new Error(`打印数量超过限制（最大 ${max}）`)
  return value
}

function copyForRecord(input: PrintPlanInput, recordIndex: number, logicalIndex: number): number {
  if (input.test) return 1
  if (logicalIndex === 0 && input.firstCopies && input.firstCopies > 0) return positiveInt(Math.floor(input.firstCopies), 1, MAX_PRINT_COPIES)
  const base = positiveInt(input.defaultCopies, 1, MAX_PRINT_COPIES)
  if (!input.copyField || !input.dataset) return base
  const column = input.dataset.columns.indexOf(input.copyField)
  const value = column >= 0 ? Number(input.dataset.rows[recordIndex]?.[column]) : NaN
  return Number.isFinite(value) && value >= 1 ? positiveInt(Math.floor(value), base, MAX_PRINT_COPIES) : base
}

export interface CompactPrintPlan extends Omit<PrintPlan, 'pages'> {
  records: ReadonlyArray<{ recordIndex: number; copies: number }>
  pageBatches(size: number): Generator<PrintPlanPage[], void>
}

export function* printPageBatches(plan: PrintPlan | CompactPrintPlan, size: number): IterableIterator<PrintPlanPage[]> {
  if ('pageBatches' in plan) {
    yield* plan.pageBatches(size)
  } else {
    for (let offset = 0; offset < plan.pages.length; offset += size) yield plan.pages.slice(offset, offset + size)
  }
}

export function buildCompactPrintPlan(input: PrintPlanInput, options: ExecutablePrintPlanOptions = {}): CompactPrintPlan {
  const plan = compactPlan(input)
  if (!options.deduplicateRecords || input.test || !input.dataset?.rows.length || !plan.records.length) return plan
  const seen = new Set<string>()
  const recordIndices: number[] = []
  for (const { recordIndex } of plan.records) {
    const row = input.dataset.rows[recordIndex]
    const fingerprint = row ? JSON.stringify(row) : `record:${recordIndex}`
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)
    recordIndices.push(recordIndex)
  }
  if (recordIndices.length === plan.recordCount) return plan
  const filtered = compactPlan({ ...input, requestedCount: recordIndices.length, recordIndices })
  filtered.warnings.push('已按逻辑记录去除重复标签')
  return filtered
}

function compactPlan(input: PrintPlanInput): CompactPrintPlan {
  const cellsPerPage = positiveInt(input.cellsPerPage, 1, 10000)
  const startSlot = Math.max(0, Math.min(cellsPerPage - 1, Math.floor((input.startSlot ?? 1) - 1)))
  const requested = input.test ? 1 : positiveInt(input.requestedCount, 1, MAX_PRINT_LOGICAL_LABELS)
  const limited = !input.test && input.physicalLabelLimit !== undefined
  const physicalLimit = limited ? positiveInt(input.physicalLabelLimit!, MAX_PRINT_PHYSICAL_LABELS, MAX_PRINT_PHYSICAL_LABELS) : MAX_PRINT_PHYSICAL_LABELS
  const recordStart = Math.max(0, Math.floor(input.recordStart || 0))
  const rawIndices = input.recordIndices?.length ? input.recordIndices.slice(0, requested) : Array.from({ length: requested }, (_, index) => recordStart + index)
  const dataset = input.dataset
  const sourceIndices = dataset ? rawIndices.filter((index) => index >= 0 && index < dataset.rows.length) : rawIndices
  const recordCount = dataset ? sourceIndices.length : requested
  const warnings: string[] = []
  if (dataset && recordCount < requested) warnings.push(`可用数据库记录不足，实际打印 ${recordCount} 张`)
  if (!input.test && dataset && recordCount === 0) warnings.push('起始记录超出数据库范围，未生成打印页')
  if (startSlot > 0) warnings.push('已从第 ' + (startSlot + 1) + ' 个拼版位置开始打印')

  const selected = input.test ? [recordStart] : dataset ? sourceIndices : Array.from({ length: requested }, (_, index) => recordStart + index)
  const records: Array<{ recordIndex: number; copies: number }> = []
  let physicalLabelCount = 0
  for (const recordIndex of selected) {
    if (limited && physicalLabelCount >= physicalLimit) break
    const count = copyForRecord(input, recordIndex, records.length)
    const copies = limited ? Math.min(count, physicalLimit - physicalLabelCount) : count
    physicalLabelCount += copies
    if (physicalLabelCount > MAX_PRINT_PHYSICAL_LABELS) {
      throw new Error(`实际打印标签数量超过限制（最大 ${MAX_PRINT_PHYSICAL_LABELS} 张）`)
    }
    records.push({ recordIndex, copies })
  }

  return {
    records,
    logicalLabelCount: records.length,
    physicalPageCount: physicalLabelCount ? Math.ceil((physicalLabelCount + startSlot) / cellsPerPage) : 0,
    physicalLabelCount,
    serialAdvanceCount: records.length,
    cellsPerPage,
    startSlot,
    recordStart,
    recordCount: input.physicalLabelLimit === undefined ? recordCount : records.length,
    warnings,
    *pageBatches(size) {
      let batch: PrintPlanPage[] = []
      let cells: PrintPlanCell[] = []
      let slotIndex = startSlot
      let pageIndex = 0
      let labelIndex = 0
      for (const [logicalIndex, record] of records.entries()) {
        for (let copy = 0; copy < record.copies; copy++) {
          cells.push({ logicalIndex, recordIndex: record.recordIndex, labelIndex: ++labelIndex, recordLabelIndex: copy, copies: 1, slotIndex: slotIndex++ })
          if (slotIndex < cellsPerPage) continue
          batch.push({ pageIndex: pageIndex++, cells, copies: 1 })
          cells = []
          slotIndex = 0
          if (batch.length === size) {
            yield batch
            batch = []
          }
        }
      }
      if (cells.length) batch.push({ pageIndex, cells, copies: 1 })
      if (batch.length) yield batch
    }
  }
}

function materialize(plan: CompactPrintPlan): PrintPlan {
  const { records: _records, pageBatches, ...summary } = plan
  const pages: PrintPlanPage[] = []
  for (const batch of pageBatches(256)) pages.push(...batch)
  return { ...summary, pages }
}

export function buildPrintPlan(input: PrintPlanInput): PrintPlan {
  return materialize(buildCompactPrintPlan(input))
}

export function buildExecutablePrintPlan(input: PrintPlanInput, options: ExecutablePrintPlanOptions = {}): PrintPlan {
  return materialize(buildCompactPrintPlan(input, options))
}
