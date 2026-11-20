import { serialInitialValue, serialNumberText, serialSequenceIndex, serialUsesRecords, type DataCtx, type SerialSource } from '../domain/datasource'
import type { LabelDoc } from '../domain/document'
import type { LabelObject } from '../domain/objects'
import { orderedVisibleObjects } from '../domain/layers'
import type { CompactPrintPlan, PrintPlan } from './plan'

/** 本次打印会越过序列号终点值时返回它；否则返回 null。 */
export interface SerialBoundaryViolation {
  /** 终点值（已按补零规则格式化）。 */
  endText: string
  /** 从当前值到终点还能输出多少个序列值。 */
  available: number
  /** 本次任务需要的序列值个数。 */
  required: number
}

/** 只收集真正会打印的条码对象上的序列号源（含子串），文字/RFID 等不受边界约束。 */
function barcodeSerialSources(objects: LabelObject[], includeSuppressed: boolean): SerialSource[] {
  const sources: SerialSource[] = []
  const visit = (object: LabelObject): void => {
    if (object.visible === false || (object.suppressPrint && !includeSuppressed)) return
    if (object.type === 'group') {
      object.children.forEach(visit)
      return
    }
    if (object.type !== 'barcode') return
    for (const source of [object.source, ...(object.subSources ?? [])]) {
      if (source?.kind === 'serial' && source.serialType === 'boundary' && source.end !== undefined) sources.push(source)
    }
  }
  objects.forEach(visit)
  return sources
}

/** 从当前值出发，按步长走到终点（含两端）还能输出多少个值。 */
function availableSteps(source: SerialSource, initial: number): number {
  const end = source.end as number
  if (source.step > 0) return end >= initial ? Math.floor((end - initial) / source.step) + 1 : 0
  return initial >= end ? Math.floor((initial - end) / -source.step) + 1 : 0
}

/** 仅条码对象的序列号受边界值约束；越界时报出第一个越界项。 */
export function findSerialBoundaryViolation(
  doc: LabelDoc,
  plan: PrintPlan | CompactPrintPlan,
  ctx: DataCtx,
  includeSuppressed = false
): SerialBoundaryViolation | null {
  const checks = scanSerialBounds(doc, plan, ctx, includeSuppressed)
  for (;;) {
    const next = checks.next()
    if (next.done) return next.value
  }
}

/** Let the renderer process cancellation during a large record scan. */
export async function checkPrintSerialBounds(
  doc: LabelDoc, plan: CompactPrintPlan, ctx: DataCtx, includeSuppressed: boolean, signal?: AbortSignal
): Promise<SerialBoundaryViolation | null> {
  const checks = scanSerialBounds(doc, plan, ctx, includeSuppressed)
  let resumeAt = performance.now() + 12
  while (!signal?.aborted) {
    const next = checks.next()
    if (next.done) return next.value
    if (performance.now() < resumeAt) continue
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    resumeAt = performance.now() + 12
  }
  return null
}

function* scanSerialBounds(
  doc: LabelDoc, plan: PrintPlan | CompactPrintPlan, ctx: DataCtx, includeSuppressed: boolean
): Generator<void, SerialBoundaryViolation | null> {
  if (!plan.physicalLabelCount) return null
  // 019：隐藏图层上的条码不会被打印，它的序列号也不该拦截本次打印
  for (const source of barcodeSerialSources(orderedVisibleObjects(doc), includeSuppressed)) {
    // 字符序列（A-Z 等）没有数值边界；步长为 0 时值不会前进。
    const charset = source.charset && source.charset.length > 1 ? source.charset : ''
    if (charset && !/^\d+$/.test(charset)) continue
    if (source.step === 0) continue
    const databaseStart = source.initialValueSource === 'database'
    const available = databaseStart ? 0 : availableSteps(source, serialInitialValue(source, ctx))
    if ('records' in plan && !databaseStart && !source.resetEachRecord && !serialUsesRecords(source, ctx)) {
      const required = serialSequenceIndex(source, plan.physicalLabelCount, ctx) + 1
      if (required > available) return { endText: serialNumberText(source, source.end as number), available, required }
      continue
    }
    let required = 1
    const cellContext = { ...ctx }
    if ('records' in plan) {
      let printed = 0
      for (const [index, record] of plan.records.entries()) {
        cellContext.logicalLabelIndex = index
        cellContext.recordIndex = record.recordIndex
        cellContext.recordLabelIndex = record.copies - 1
        const lastSteps = serialSequenceIndex(source, printed + record.copies, cellContext) + 1
        if (databaseStart) {
          const recordAvailable = availableSteps(source, serialInitialValue(source, cellContext))
          if (lastSteps > recordAvailable) {
            cellContext.recordLabelIndex = 0
            const firstSteps = serialSequenceIndex(source, printed + 1, cellContext) + 1
            return { endText: serialNumberText(source, source.end as number), available: recordAvailable, required: Math.max(firstSteps, recordAvailable + 1) }
          }
        } else {
          required = Math.max(required, lastSteps)
        }
        printed += record.copies
        if ((index + 1) % 256 === 0) yield
      }
    } else {
      for (const page of plan.pages) {
        for (const cell of page.cells) {
          cellContext.logicalLabelIndex = cell.logicalIndex
          cellContext.recordIndex = cell.recordIndex
          cellContext.recordLabelIndex = cell.recordLabelIndex
          const steps = serialSequenceIndex(source, cell.labelIndex, cellContext) + 1
          if (databaseStart) {
            const recordAvailable = availableSteps(source, serialInitialValue(source, cellContext))
            if (steps > recordAvailable) {
              return { endText: serialNumberText(source, source.end as number), available: recordAvailable, required: steps }
            }
          } else {
            required = Math.max(required, steps)
          }
        }
      }
    }
    if (!databaseStart && required > available) {
      return { endText: serialNumberText(source, source.end as number), available, required }
    }
  }
  return null
}
