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

/** Build one deterministic plan shared by driver and native-command output. */
export function buildPrintPlan(input: PrintPlanInput): PrintPlan {
  const cellsPerPage = positiveInt(input.cellsPerPage, 1, 10000)
  const startSlot = Math.max(0, Math.min(cellsPerPage - 1, Math.floor((input.startSlot ?? 1) - 1)))
  const requested = input.test ? 1 : positiveInt(input.requestedCount, 1, MAX_PRINT_LOGICAL_LABELS)
  const physicalLimit = input.test || input.physicalLabelLimit === undefined ? MAX_PRINT_PHYSICAL_LABELS : positiveInt(input.physicalLabelLimit, MAX_PRINT_PHYSICAL_LABELS, MAX_PRINT_PHYSICAL_LABELS)
  const limited = !input.test && input.physicalLabelLimit !== undefined
  const recordStart = Math.max(0, Math.floor(input.recordStart || 0))
  const hasRecords = input.dataset !== undefined
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
  let logicalLabelCount = hasRecords ? recordCount : requested
  const warnings: string[] = []
  if (hasRecords && recordCount < requested) warnings.push(`可用数据库记录不足，实际打印 ${recordCount} 张`)
  if (!input.test && hasRecords && recordCount === 0) warnings.push('起始记录超出数据库范围，未生成打印页')
  if (startSlot > 0) warnings.push('已从第 ' + (startSlot + 1) + ' 个拼版位置开始打印')
  const pages: PrintPlanPage[] = []
  let logicalIndex = 0
  let physicalLabelCount = 0
  // 本次实际要输出的逻辑记录（无数据集时按 requested 生成）。
  const recordIndicesToPrint: number[] = []
  if (input.test) {
    recordIndicesToPrint.push(recordStart)
  } else if (hasRecords) {
    recordIndicesToPrint.push(...sourceRecordIndices.slice(0, recordCount))
  } else {
    for (let index = 0; index < requested; index += 1) recordIndicesToPrint.push(recordStart + index)
  }

  let cells: PrintPlanCell[] = []
  const flushPage = () => {
    if (!cells.length) return
    pages.push({ pageIndex: pages.length, cells, copies: 1 })
    cells = []
  }
  // 每个物理标签实例都有独立的 labelIndex（记录相同），序列号“按标签数”才能逐张推进；
  // 单联也拆成独立页，不再用打印机的整页份数（份数无法改变序列号）。
  let physicalIndex = 0

  while (logicalIndex < recordIndicesToPrint.length && (!limited || physicalLabelCount < physicalLimit)) {
    const recordIndex = recordIndicesToPrint[logicalIndex]
    let copies = copyForRecord(input, recordIndex, logicalIndex)
    if (limited) copies = Math.min(copies, physicalLimit - physicalLabelCount)
    if (copies <= 0) break
    if (physicalLabelCount + copies > MAX_PRINT_PHYSICAL_LABELS) {
      throw new Error(`实际打印标签数量超过限制（最大 ${MAX_PRINT_PHYSICAL_LABELS} 张）`)
    }
    for (let copy = 0; copy < copies; copy += 1) {
      physicalIndex += 1
      const pageOffset = pages.length === 0 ? startSlot : 0
      if (cells.length + pageOffset >= cellsPerPage) flushPage()
      const slotOffset = pages.length === 0 ? startSlot : 0
      cells.push({ logicalIndex, recordIndex, labelIndex: physicalIndex, recordLabelIndex: copy, copies: 1, slotIndex: cells.length + slotOffset })
      physicalLabelCount += 1
      if (cellsPerPage === 1) flushPage()
    }
    logicalIndex += 1
  }
  flushPage()

  logicalLabelCount = logicalIndex

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
    recordCount: input.physicalLabelLimit === undefined ? recordCount : logicalLabelCount,
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
