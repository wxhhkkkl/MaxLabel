import { serialInitialValue, serialNumberText, serialSequenceIndex, type DataCtx, type SerialSource } from '../domain/datasource'
import type { LabelDoc } from '../domain/document'
import type { LabelObject } from '../domain/objects'
import type { PrintPlan } from './plan'

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
  plan: PrintPlan,
  ctx: DataCtx,
  includeSuppressed = false
): SerialBoundaryViolation | null {
  const cells = plan.pages.flatMap((page) => page.cells)
  if (!cells.length) return null
  for (const source of barcodeSerialSources(doc.objects, includeSuppressed)) {
    // 字符序列（A-Z 等）没有数值边界；步长为 0 时值不会前进。
    const charset = source.charset && source.charset.length > 1 ? source.charset : ''
    if (charset && !/^\d+$/.test(charset)) continue
    if (source.step === 0) continue
    const available = availableSteps(source, serialInitialValue(source, ctx))
    const required = Math.max(
      1,
      ...cells.map((cell) => serialSequenceIndex(source, cell.labelIndex, { ...ctx, recordIndex: cell.recordIndex }) + 1)
    )
    if (required > available) {
      return { endText: serialNumberText(source, source.end as number), available, required }
    }
  }
  return null
}
