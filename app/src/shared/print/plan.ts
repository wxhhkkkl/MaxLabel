import type { Dataset } from '../domain/datasource'

export interface PrintPlanInput {
  test: boolean
  requestedCount: number
  recordStart: number
  dataset?: Dataset
  cellsPerPage: number
  /** 首页从第几个拼版位置开始（LabelShop 的“起始标签”），从 1 开始。 */
  startSlot?: number
  /** Optional source record indexes after application-level filtering (for example duplicate removal). */
  recordIndices?: number[]
  defaultCopies: number
  firstCopies?: number
  copyField?: string
}

export interface PrintPlanCell {
  logicalIndex: number
  recordIndex: number
  labelIndex: number
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

/** Build one deterministic plan shared by driver and native-command output. */
export function buildPrintPlan(input: PrintPlanInput): PrintPlan {
  const cellsPerPage = positiveInt(input.cellsPerPage, 1, 10000)
  const startSlot = Math.max(0, Math.min(cellsPerPage - 1, Math.floor((input.startSlot ?? 1) - 1)))
  const requested = input.test ? 1 : positiveInt(input.requestedCount, 1, MAX_PRINT_LOGICAL_LABELS)
  const recordStart = Math.max(0, Math.floor(input.recordStart || 0))
  const hasRecords = Boolean(input.dataset && input.dataset.rows.length > 0)
  const rawRecordIndices = input.recordIndices?.length
    ? input.recordIndices.slice(0, requested)
    : Array.from({ length: requested }, (_, index) => recordStart + index)
  const sourceRecordIndices = hasRecords
    ? rawRecordIndices.filter((index) => index >= 0 && index < input.dataset!.rows.length)
    : rawRecordIndices
  const recordCount = hasRecords
    ? sourceRecordIndices.length
    : requested
  // 测试打印的语义是只输出一张逻辑标签；拼版页仍保留起始位置，
  // 但不能因为多标签布局而把同一张测试标签复制到整页。
  const logicalLabelCount = hasRecords ? recordCount : requested
  const warnings: string[] = []
  if (hasRecords && recordCount < requested) warnings.push(`可用数据库记录不足，实际打印 ${recordCount} 张`)
  if (!input.test && hasRecords && recordCount === 0) warnings.push('起始记录超出数据库范围，未生成打印页')
  if (startSlot > 0) warnings.push('已从第 ' + (startSlot + 1) + ' 个拼版位置开始打印')
  const pages: PrintPlanPage[] = []
  let logicalIndex = 0
  let physicalLabelCount = 0
  let splitForCopies = false

  while (logicalIndex < logicalLabelCount) {
    const firstRecordIndex = hasRecords ? (sourceRecordIndices[logicalIndex] ?? recordStart + logicalIndex) : recordStart
    const firstCopies = copyForRecord(input, firstRecordIndex, logicalIndex)
    const cells: PrintPlanCell[] = []
    const firstPageOffset = pages.length === 0 ? startSlot : 0
    while (cells.length + firstPageOffset < cellsPerPage && logicalIndex < logicalLabelCount) {
      const recordIndex = hasRecords ? (sourceRecordIndices[logicalIndex] ?? recordStart + logicalIndex) : recordStart
      const copies = copyForRecord(input, recordIndex, logicalIndex)
      // Native copies apply to the complete physical page, so split mixed-copy pages.
      if (cells.length > 0 && copies !== firstCopies) {
        splitForCopies = true
        break
      }
      if (physicalLabelCount + copies > MAX_PRINT_PHYSICAL_LABELS) {
        throw new Error(`实际打印标签数量超过限制（最大 ${MAX_PRINT_PHYSICAL_LABELS} 张）`)
      }
      cells.push({ logicalIndex, recordIndex, labelIndex: logicalIndex + 1, copies, slotIndex: cells.length + firstPageOffset })
      physicalLabelCount += copies
      logicalIndex += 1
    }
    if (cells.length === 0) break
    pages.push({ pageIndex: pages.length, cells, copies: firstCopies })
  }

  if (splitForCopies) {
    warnings.push('数据库拷贝数量不同，已按拷贝数自动拆分拼版页')
  }

  return {
    pages,
    logicalLabelCount,
    physicalPageCount: pages.length,
    physicalLabelCount,
    // Copies repeat the same logical label and must not advance serial values.
    serialAdvanceCount: logicalLabelCount,
    cellsPerPage,
    startSlot,
    recordStart,
    recordCount,
    warnings
  }
}

/**
 * Build the final plan consumed by every output path. Keeping filtering here
 * prevents preview, native commands and the Windows driver from disagreeing
 * about record count or copy-field behaviour.
 */
export function buildExecutablePrintPlan(input: PrintPlanInput, options: ExecutablePrintPlanOptions = {}): PrintPlan {
  const plan = buildPrintPlan(input)
  if (!options.deduplicateRecords || input.test || !input.dataset || !input.dataset.rows.length || !plan.pages.length) return plan

  const seen = new Set<string>()
  const recordIndices: number[] = []
  const cells = plan.pages.flatMap((page) => page.cells).sort((a, b) => a.logicalIndex - b.logicalIndex)
  for (const cell of cells) {
    const row = input.dataset.rows[cell.recordIndex]
    const fingerprint = row ? JSON.stringify(row) : `record:${cell.recordIndex}`
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)
    recordIndices.push(cell.recordIndex)
  }
  if (recordIndices.length === plan.recordCount) return plan

  const filtered = buildPrintPlan({ ...input, requestedCount: recordIndices.length, recordIndices })
  filtered.warnings.push('已按逻辑记录去除重复标签')
  return filtered
}
