// ---------- 指令打印总入口：按打印机配置生成批量指令 ----------
import type { Dataset } from '../domain/datasource'
import type { LabelDoc } from '../domain/document'
import type { MonoBitmap } from '../domain/units'
import type { PrinterConfig } from '../domain/printer'
import { buildTSPL } from './tspl'
import { buildZPL } from './zpl'
import { buildCPCL } from './cpcl'
import { resolvePrintPageScene, resolvePrintPlanPageScene, type ResolvedPrintScene } from './scene'
import { layoutCount, type PageLayout } from './layout'
import type { PrintPlan } from './plan'
import { printerCapabilities, sceneNeedsNativeFontRasterization, sceneNeedsRasterization, type PrinterCapabilities } from './capabilities'
import { ProtocolWarningCollector, pushProtocolWarning } from './warnings'

/** 指令输出分段：文本（按编码转字节）或二进制（原始字节，用于图片/位图嵌入） */
export type CommandSegment = { type: 'text'; str: string } | { type: 'bin'; data: Uint8Array }

export interface PrintJobOptions {
  /** 打印数量（每张标签的数据实例数，序列号/数据库记录依据它推进） */
  count: number
  /** 单签拷贝 */
  copy: number
  title: string
  datasets: Record<string, Dataset>
  sharedVars?: Record<string, string>
  /** 键盘输入数据源在打印时收集到的值（按提示标签） */
  keyboardValues?: Record<string, string>
  /** 预渲染单色位图（静态：图片对象），按对象 id */
  images?: Record<string, MonoBitmap>
  /** 逐张标签的预渲染位图（可变中文文本等），索引 = 标签序号-1 */
  imagesByLabel?: Array<Record<string, MonoBitmap>>
  /** 页面拼版行列：每「张」输出 rows×cols 个标签，标签序号全局递增 */
  layout?: PageLayout
  /** Optional unified plan; when present, count/copy are legacy fallbacks only. */
  plan?: PrintPlan
  datasetName?: string
  allowScript?: boolean
  printNonPrintable?: boolean
  /** Resolved scenes for the current batch. When present, LabelDoc is not re-evaluated. */
  resolvedPages?: ReadonlyArray<ResolvedPrintScene>
  /** Total physical labels in the complete job, used by dynamic contexts. */
  totalLabels?: number
  /** Batch controls used by streaming print jobs. */
  includePreamble?: boolean
  includePostamble?: boolean
}

export interface BuildResult {
  /** 分段指令（文本段按编码转字节、二进制段原样），供主进程拼装发送 */
  segments: CommandSegment[]
  /** 纯文本视图（调试/兼容；二进制段以 [BIN:n] 占位） */
  text: string
  encoding: 'utf8' | 'gbk'
  /** 物理标签数 = 打印数量 × 单签拷贝 */
  labelCount: number
  warnings: string[]
  warningDetails: Array<{ code: string; message: string; driver: PrinterConfig['driver']; severity: 'warning' | 'error' }>
  capabilities: PrinterCapabilities
}

/** 二进制段占位标记：对象位图或整页位图。 */
const BIN_RE = /@@RAW:(\d+):([\w-]+)@@|@@PAGE_RAW:(\d+)@@/g

function textToSegments(text: string, imagesByLabel: Array<Record<string, MonoBitmap>>, images: Record<string, MonoBitmap>, pageBitmaps: Array<MonoBitmap | undefined>): CommandSegment[] {
  const segs: CommandSegment[] = []
  let last = 0
  let m: RegExpExecArray | null
  BIN_RE.lastIndex = 0
  while ((m = BIN_RE.exec(text))) {
    if (m.index > last) segs.push({ type: 'text', str: text.slice(last, m.index) })
    const mono = m[3]
      ? pageBitmaps[parseInt(m[3], 10)]
      : imagesByLabel[parseInt(m[1], 10) - 1]?.[m[2]] ?? images[m[2]]
    if (mono) segs.push({ type: 'bin', data: mono.bytes })
    last = m.index + m[0].length
  }
  if (last < text.length) segs.push({ type: 'text', str: text.slice(last) })
  return segs
}

/**
 * Legacy compatibility entry point. New application code must call
 * buildResolvedCommands after resolving the print job once.
 */
export function buildCommands(doc: LabelDoc, printer: PrinterConfig, job: PrintJobOptions): BuildResult {
  if (job.resolvedPages?.length) return buildResolvedCommands(printer, { ...job, resolvedPages: job.resolvedPages })
  return buildLegacyCommands(doc, printer, job)
}

/** Protocol adapters consume only resolved scenes; they never evaluate data sources. */
export function buildResolvedCommands(printer: PrinterConfig, job: PrintJobOptions & { resolvedPages: ReadonlyArray<ResolvedPrintScene> }): BuildResult {
  const warningCollector = new ProtocolWarningCollector()
  const capabilities = printerCapabilities(printer)
  const blocks: string[] = []
  const images = job.images ?? {}
  const pageBitmaps: Array<MonoBitmap | undefined> = []
  const resolvedPages = job.resolvedPages
  const resolvedImagesByLabel: Array<Record<string, MonoBitmap>> = []
  for (const scene of resolvedPages) {
    for (const primitive of scene.primitives) {
      if (!('bitmap' in primitive) || !primitive.bitmap) continue
      const byLabel = resolvedImagesByLabel[primitive.labelIndex - 1] ?? {}
      byLabel[primitive.object.id] = primitive.bitmap
      resolvedImagesByLabel[primitive.labelIndex - 1] = byLabel
    }
  }
  // 打印机参数命令：作业开始前发送一次（自定义命令，如复位/初始化参数）
  if (printer.preCmd && job.includePreamble !== false) blocks.push(printer.preCmd)
  const gridCount = layoutCount(job.layout)
  const pageCount = resolvedPages.length
  for (let i = 0; i < pageCount; i++) {
    const resolvedScene = resolvedPages[i]
    // 标签内容命令：每个物理页面内容前发送。
    if (printer.contentCmd) blocks.push(printer.contentCmd)
    pageBitmaps[i] = resolvedScene?.pageBitmap
    if (sceneNeedsRasterization(resolvedScene, printer) && !resolvedScene.pageBitmap) {
      pushProtocolWarning(warningCollector, 'missing-page-bitmap', `第 ${i + 1} 页缺少整页预渲染位图（可能包含椭圆、旋转或复杂样式），已阻止原生协议输出以避免版式不一致`, 'error')
      continue
    }
    if (sceneNeedsNativeFontRasterization(resolvedScene) && !resolvedScene.pageBitmap) {
      pushProtocolWarning(warningCollector, 'native-font-family-ignored', '文本未指定打印机内建字体；直接导出指令会使用打印机默认字体，正式打印请先预渲染或设置 printerFont', 'warning')
    }
    if (printer.driver === 'tspl') blocks.push(buildTSPL(resolvedScene, printer, warningCollector, String(i)))
    else if (printer.driver === 'zpl') blocks.push(buildZPL(resolvedScene, printer, warningCollector))
    else blocks.push(buildCPCL(resolvedScene, printer, warningCollector))
  }
  // 打印后处理命令：作业结束后发送（如切纸/回退），放在最后
  if (printer.postCmd && job.includePostamble !== false) blocks.push(printer.postCmd)
  let rawText = blocks.length ? blocks.join('\n') + '\n' : ''
  // CPCL 规范以 CRLF 终止命令与二维条码数据段；统一转换，避免蓝牙/串口固件漏解析。
  if (printer.driver === 'cpcl') rawText = rawText.replace(/\r?\n/g, '\r\n')
  const segments = textToSegments(rawText, resolvedImagesByLabel, images, pageBitmaps)
  const text = segments.map((s) => (s.type === 'text' ? s.str : `[BIN:${s.data.length}B]`)).join('')
  return {
    segments,
    text,
    encoding: printer.port.encoding,
    labelCount: job.plan?.physicalLabelCount ?? job.count * job.copy * gridCount,
    warnings: warningCollector.messages,
    warningDetails: warningCollector.entries.map((warning) => ({ ...warning, driver: printer.driver })),
    capabilities
  }
}

/** Compatibility-only resolver for existing callers and protocol unit fixtures. */
function buildLegacyCommands(doc: LabelDoc, printer: PrinterConfig, job: PrintJobOptions): BuildResult {
  const datasets = job.datasets ?? {}
  const sharedVars = job.sharedVars ?? {}
  const keyboardValues = job.keyboardValues ?? {}
  const images = job.images ?? {}
  const imagesByLabel = job.imagesByLabel ?? []
  const gridCount = layoutCount(job.layout)
  const pages = job.plan?.pages
  const pageCount = pages ? pages.length : job.count
  const resolvedPages: ResolvedPrintScene[] = []
  const now = Date.now()
  for (let i = 0; i < pageCount; i++) {
    const page = pages?.[i]
    const labelNo = page?.cells[0]?.labelIndex ?? i * gridCount + 1
    const recordIndex = page?.cells[0]?.recordIndex ?? labelNo - 1
    const pageCopy = page?.copies ?? job.copy
    const ctx = {
      labelIndex: labelNo,
      recordIndex,
      copy: pageCopy,
      count: job.plan?.logicalLabelCount ?? job.totalLabels ?? job.count * gridCount,
      totalLabels: job.totalLabels ?? job.count * gridCount,
      title: job.title,
      printerName: printerNameOf(printer),
      datasets,
      sharedVars: { ...sharedVars },
      keyboardValues,
      images: imagesByLabel[labelNo - 1] ?? images,
      allowScript: job.allowScript === true,
      now,
      activeDataset: job.datasetName ?? Object.keys(datasets)[0],
      recordRow: (job.datasetName ? datasets[job.datasetName] : datasets[Object.keys(datasets)[0]])?.rows[recordIndex]
    }
    resolvedPages.push(page
      ? resolvePrintPlanPageScene(doc, ctx, job.layout, page, (index) => imagesByLabel[index - 1] ?? images, { includeSuppressed: job.printNonPrintable })
      : resolvePrintPageScene(doc, ctx, job.layout, (index) => imagesByLabel[index - 1] ?? images, { includeSuppressed: job.printNonPrintable }))
  }
  return buildResolvedCommands(printer, { ...job, resolvedPages })
}

const DRIVER_LABEL: Record<string, string> = { tspl: 'TSPL', zpl: 'ZPL', cpcl: 'CPCL' }

export function printerNameOf(p: PrinterConfig): string {
  const target = p.printerName ? ` · ${p.printerName}` : ''
  return `${DRIVER_LABEL[p.driver] ?? p.driver.toUpperCase()} @${p.dpi}dpi${target}`
}
