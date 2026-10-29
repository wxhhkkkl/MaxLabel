import { resolvePrintJob } from '../../../../shared/print/scene'
import type { PrintPlan } from '../../../../shared/print/plan'
import type { PageLayout } from '../../../../shared/print/layout'
import type { BarcodeObj, LabelObject } from '../../../../shared/domain/objects'
import { validateBarcodeContent } from '../../../../shared/domain/barcodeCharset'
import { loadBwip, resolveBarcode, toBwipOptions } from '../../editor/barcode'
import type { DataCtx, LabelDoc } from '../../types'

/** 一条「数据源里的条码内容不符合当前码型」的问题记录。 */
export interface BarcodePreflightIssue {
  /** 数据集中的记录序号（0 基，显示时 +1）。 */
  recordIndex: number
  /** 逻辑标签序号（1 基）。 */
  labelIndex: number
  /** 码制 id（`barcodeCharsetName` 转显示名）。 */
  symbology: string
  /** 面向用户的原因；来自校验表时是中文，来自 bwip-js 兜底时是编码器原文。 */
  message: string
}

export interface BarcodePreflightInput {
  doc: LabelDoc
  layout?: PageLayout
  plan: PrintPlan
  ctx: DataCtx
  includeSuppressed?: boolean
  signal?: AbortSignal
}

type BwipModule = Awaited<ReturnType<typeof loadBwip>>

/** bwip-js 的异常形如 `bwipp.ean13badLength#6878: EAN-13 must be 12 or 13 digits`。 */
const BWIP_ERROR_PREFIX = /^bwipp\.[^:]+:\s*/

function hasBarcode(objects: LabelObject[]): boolean {
  return objects.some((object) => (object.type === 'group' ? hasBarcode(object.children) : object.type === 'barcode'))
}

/** 校验表给中文提示；校验表没覆盖的码制（25 码、ITF14、二维码容量等）再真编码一次兜底。 */
function checkBarcodeText(
  bwip: BwipModule,
  object: BarcodeObj,
  value: string,
  cache: Map<string, string | null>
): string | null {
  // 同一种「码制 + 内容 + 专属选项」只真正编码一次（千行数据里重复值很常见）。
  const key = `${object.symbology}\u0000${value}\u0000${JSON.stringify(object.barcodeOptions ?? null)}`
  if (cache.has(key)) return cache.get(key) ?? null
  const known = validateBarcodeContent(object.symbology, value)
  let problem: string | null = known.ok ? null : known.message
  if (!problem) {
    try {
      const resolved = resolveBarcode(object.symbology, value, object.barcodeOptions)
      bwip.raw({
        ...toBwipOptions(object.symbology, value, { barcodeOptions: object.barcodeOptions }),
        bcid: resolved.bcid,
        text: resolved.text
      })
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error)
      problem = raw.replace(BWIP_ERROR_PREFIX, '')
    }
  }
  cache.set(key, problem)
  return problem
}

/** 与打印执行器相同的批大小：逐批解析、用完即弃，避免大任务把整份场景常驻内存。 */
const PREFLIGHT_BATCH_PAGES = 24

/** 扫描计划中每一条逻辑标签的条码内容，返回不合法项（按记录序号排序）。 */
export async function findInvalidBarcodeRecords(input: BarcodePreflightInput): Promise<BarcodePreflightIssue[]> {
  if (!hasBarcode(input.doc.objects)) return []
  const bwip = await loadBwip()
  const { ctx, plan } = input
  // 与正式打印同样的场景解析路径；脚本状态用副本，不污染真正的打印序列。
  const scriptState = { sharedVars: { ...ctx.sharedVars }, scriptVars: { ...ctx.scriptVars } }
  const cache = new Map<string, string | null>()
  const seen = new Set<string>()
  const issues: BarcodePreflightIssue[] = []
  for (let offset = 0; offset < plan.pages.length; offset += PREFLIGHT_BATCH_PAGES) {
    if (input.signal?.aborted) break
    const pages = plan.pages.slice(offset, offset + PREFLIGHT_BATCH_PAGES)
    const job = resolvePrintJob(input.doc, ctx, input.layout, { ...plan, pages, physicalPageCount: pages.length }, {
      includeSuppressed: input.includeSuppressed === true,
      scriptState,
      finishScript: false
    })
    for (const page of job.pages) {
      for (const primitive of page.scene.primitives) {
        if (input.signal?.aborted) return issues
        if (primitive.kind !== 'barcode') continue
        const recordIndex = primitive.context.recordIndex
        const key = `${recordIndex}:${primitive.object.id}`
        if (seen.has(key)) continue
        const message = checkBarcodeText(bwip, primitive.object, primitive.value, cache)
        if (!message) continue
        seen.add(key)
        issues.push({ recordIndex, labelIndex: primitive.labelIndex, symbology: primitive.object.symbology, message })
      }
    }
  }
  return issues.sort((a, b) => a.recordIndex - b.recordIndex || a.symbology.localeCompare(b.symbology))
}

/** 按打印顺序取出记录序号，去掉不合法记录；没有剩余记录时返回空数组。 */
export function recordIndicesSkippingInvalid(plan: PrintPlan, invalid: ReadonlySet<number>): number[] {
  const cells = plan.pages.flatMap((page) => page.cells).sort((a, b) => a.logicalIndex - b.logicalIndex)
  const seen = new Set<number>()
  const result: number[] = []
  for (const cell of cells) {
    if (invalid.has(cell.recordIndex) || seen.has(cell.recordIndex)) continue
    seen.add(cell.recordIndex)
    result.push(cell.recordIndex)
  }
  return result
}
