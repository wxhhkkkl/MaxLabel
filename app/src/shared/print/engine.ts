// ---------- 指令打印总入口：按打印机配置生成批量指令 ----------
import type { Dataset } from '../domain/datasource'
import type { LabelDoc } from '../domain/document'
import type { MonoBitmap } from '../domain/units'
import type { PrinterConfig } from '../domain/printer'
import { buildTSPL } from './tspl'
import { buildZPL } from './zpl'
import { buildCPCL } from './cpcl'
import { buildEPL } from './epl'
import { buildTPCL } from './tpcl'
import { buildPGL } from './pgl'
import { buildSATO } from './sato'
import { encodePcx } from './pcx'
import { buildEscPosParts } from './escpos'
import { escposProfileFor } from './escposProfiles'
import { mm2dot } from './geometry'
import { filterNativeOutputScene, resolvePrintPageScene, resolvePrintPlanPageScene, type ResolvedPrintScene } from './scene'
import { layoutCount, type PageLayout } from './layout'
import type { PrintPlan } from './plan'
import { primitiveNeedsRasterization, printerCapabilities, sceneNeedsPageBitmap, textNeedsBitmap, type PrinterCapabilities } from './capabilities'
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

/**
 * 二进制段占位标记：对象位图或整页位图。
 * RAW 直接写 1=墨点的位图；PCX 先编码成 1-bit PCX（PGL/SATO 的内联图形格式）。
 */
const BIN_RE = /@@RAW:(\d+):([\w-]+)(?::(body|tail))?@@|@@PAGE_RAW:(\d+)@@|@@PCX:(\d+):([\w-]+)@@|@@PAGE_PCX:(\d+)@@/g
// 可选的第一个捕获组是补零宽度（SATO 要求 5 位长度）。
const PCX_LEN_RE = /@@PCX_LEN(\d*):(\d+):([\w-]+)@@|@@PAGE_PCX_LEN(\d*):(\d+)@@/g

function tsplBitmapPart(bitmap: MonoBitmap, part: string | undefined): Uint8Array {
  if (!part) return bitmap.bytes
  const { height, width, bytesPerRow, bytes } = bitmap
  const bodyStride = bytesPerRow - 1
  const result = new Uint8Array(height * (part === 'body' ? bodyStride : 1))
  const shift = width % 8
  for (let y = 0; y < height; y++) {
    const start = y * bytesPerRow
    const last = start + bodyStride
    if (part === 'body') result.set(bytes.subarray(start, last), y * bodyStride)
    else result[y] = (bytes[last - 1] << shift) | (bytes[last] >>> (8 - shift))
  }
  return result
}

function invertBytes(bytes: Uint8Array): Uint8Array {
  const inverted = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) inverted[i] = bytes[i] ^ 0xff
  return inverted
}

function textToSegments(text: string, imagesByLabel: Array<Record<string, MonoBitmap>>, images: Record<string, MonoBitmap>, pageBitmaps: Array<MonoBitmap | undefined>, invertBitmapBytes = false): CommandSegment[] {
  const bitmapOf = (label: string, id: string, page: string): MonoBitmap | undefined =>
    page
      ? pageBitmaps[parseInt(page, 10)]
      : imagesByLabel[parseInt(label, 10) - 1]?.[id] ?? images[id]

  const pcxCache = new Map<string, Uint8Array>()
  const pcxOf = (key: string, mono: MonoBitmap): Uint8Array => {
    const cached = pcxCache.get(key)
    if (cached) return cached
    const encoded = encodePcx(mono)
    pcxCache.set(key, encoded)
    return encoded
  }

  // 先替换长度占位（SATO `GP<长度>,` 需要 PCX 字节数），再切分二进制段。
  const expanded = text.replace(
    PCX_LEN_RE,
    (full: string, padObject: string, label: string, id: string, padPage: string, page: string) => {
      const mono = bitmapOf(label, id, page)
      if (!mono) return '0'
      const length = pcxOf(full, mono).length
      const pad = Number(padObject ?? padPage ?? 0)
      return pad > 0 ? String(length).padStart(pad, '0') : String(length)
    }
  )

  const segs: CommandSegment[] = []
  let last = 0
  let m: RegExpExecArray | null
  BIN_RE.lastIndex = 0
  while ((m = BIN_RE.exec(expanded))) {
    if (m.index > last) segs.push({ type: 'text', str: expanded.slice(last, m.index) })
    if (m[5] || m[7]) {
      const mono = bitmapOf(m[5], m[6], m[7])
      if (mono) segs.push({ type: 'bin', data: pcxOf(m[0], mono) })
    } else {
      const mono = bitmapOf(m[1], m[2], m[4])
      if (mono) segs.push({ type: 'bin', data: invertBitmapBytes ? invertBytes(tsplBitmapPart(mono, m[3])) : mono.bytes })
    }
    last = m.index + m[0].length
  }
  if (last < expanded.length) segs.push({ type: 'text', str: expanded.slice(last) })
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
  const escPosParts: Array<string | Uint8Array> = []
  const images = job.images ?? {}
  const pageBitmaps: Array<MonoBitmap | undefined> = []
  const resolvedPages = job.resolvedPages
  const escPosWidth = printer.driver === 'escpos' ? escposProfileFor(printer).printableDots : undefined
  // 场景生成阶段跳过的内容（多联版式里放到标签格外）要在打印状态里说明，不能静默丢。
  const sceneWarnings = new Set<string>()
  for (const scene of resolvedPages) for (const warning of scene.warnings ?? []) sceneWarnings.add(warning)
  const resolvedImagesByLabel: Array<Record<string, MonoBitmap>> = []
  for (const scene of resolvedPages) {
    for (const primitive of scene.primitives) {
      const byLabel = resolvedImagesByLabel[primitive.labelIndex - 1] ?? {}
      let stored = false
      if ('bitmap' in primitive && primitive.bitmap) {
        byLabel[primitive.object.id] = primitive.bitmap
        stored = true
      }
      // 条码人读文字位图与整条对象位图分开传输，原生 BARCODE 仍然有效。
      if (primitive.kind === 'barcode' && primitive.humanTextBitmap) {
        byLabel[`${primitive.object.id}-humantext`] = primitive.humanTextBitmap
        stored = true
      }
      if (stored) resolvedImagesByLabel[primitive.labelIndex - 1] = byLabel
    }
  }
  // 打印机参数命令：作业开始前发送一次（自定义命令，如复位/初始化参数）
  const appendUserCommand = (command: string) => {
    if (printer.driver === 'escpos') escPosParts.push(command, '\n')
    else blocks.push(command)
  }
  if (printer.preCmd && job.includePreamble !== false) appendUserCommand(printer.preCmd)
  const gridCount = layoutCount(job.layout)
  const pageCount = resolvedPages.length
  for (let i = 0; i < pageCount; i++) {
    const page = resolvedPages[i]
    const width = Math.max(mm2dot(page.widthMm, capabilities.coordinateDpi), page.pageBitmap?.width ?? 0)
    if (escPosWidth !== undefined && width > escPosWidth) {
      pushProtocolWarning(warningCollector, 'escpos-print-width', `ESC/POS 标签宽度 ${width} 点超过打印机可打印宽度 ${escPosWidth} 点，请缩窄标签或选择正确的打印机档案`, 'error')
      continue
    }
    const resolvedScene = filterNativeOutputScene(page)
    // 标签内容命令：每个物理页面内容前发送。
    if (printer.contentCmd) appendUserCommand(printer.contentCmd)
    pageBitmaps[i] = resolvedScene?.pageBitmap
    if (!resolvedScene.pageBitmap && (page.primitives.some((primitive) => primitive.clipCell) || sceneNeedsPageBitmap(page, printer))) {
      pushProtocolWarning(warningCollector, 'missing-page-bitmap', `第 ${i + 1} 页缺少整页预渲染位图（可能包含椭圆、旋转或复杂样式），已阻止原生协议输出以避免版式不一致`, 'error')
      continue
    }
    if (!resolvedScene.pageBitmap) {
      const missingBitmaps = resolvedScene.primitives.filter((primitive) => {
        if (primitive.kind === 'rfid') return false
        if ('bitmap' in primitive && primitive.bitmap) return false
        return primitive.kind === 'text'
          ? textNeedsBitmap(primitive.object as import('../domain/objects').TextObj, primitive.value, printer)
          : primitiveNeedsRasterization(primitive, printer)
      })
      if (missingBitmaps.length) {
        pushProtocolWarning(warningCollector, 'missing-object-bitmap', `第 ${i + 1} 页有 ${missingBitmaps.length} 个图元缺少对象位图，已按原生指令输出，样式可能与画布不一致`, 'warning')
      }
    }
    if (printer.driver === 'tspl') blocks.push(buildTSPL(resolvedScene, printer, warningCollector, String(i)))
    else if (printer.driver === 'zpl') blocks.push(buildZPL(resolvedScene, printer, warningCollector))
    else if (printer.driver === 'escpos') {
      escPosParts.push(...buildEscPosParts(resolvedScene, printer, warningCollector, String(i)))
      if (!resolvedScene.pageBitmap) escPosParts.push('\n')
    }
    else if (printer.driver === 'epl') blocks.push(buildEPL(resolvedScene, printer, warningCollector, String(i)))
    else if (printer.driver === 'tpcl') blocks.push(buildTPCL(resolvedScene, printer, warningCollector, String(i)))
    else if (printer.driver === 'pgl') blocks.push(buildPGL(resolvedScene, printer, warningCollector, String(i)))
    else if (printer.driver === 'sato') blocks.push(buildSATO(resolvedScene, printer, warningCollector, String(i)))
    else blocks.push(buildCPCL(resolvedScene, printer, warningCollector))
  }
  // 打印后处理命令：作业结束后发送（如切纸/回退），放在最后
  if (printer.postCmd && job.includePostamble !== false) appendUserCommand(printer.postCmd)
  for (const warning of sceneWarnings) pushProtocolWarning(warningCollector, 'object-outside-label-skipped', warning, 'warning')
  let rawText = blocks.length ? blocks.join('\n') + '\n' : ''
  // CPCL 规范以 CRLF 终止命令与二维条码数据段；统一转换，避免蓝牙/串口固件漏解析。
  if (printer.driver === 'cpcl') rawText = rawText.replace(/\r?\n/g, '\r\n')
  // TSPL BITMAP uses 0=black, while MonoBitmap uses 1=black.
  const invalidWidth = warningCollector.entries.some((warning) => warning.code === 'escpos-print-width')
  const segments = invalidWidth ? [] : printer.driver === 'escpos'
    ? escPosParts.flatMap((part): CommandSegment[] => typeof part === 'string'
      ? textToSegments(part, resolvedImagesByLabel, images, pageBitmaps)
      : [{ type: 'bin', data: part }])
    : textToSegments(rawText, resolvedImagesByLabel, images, pageBitmaps, printer.driver === 'tspl')
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

const DRIVER_LABEL: Record<string, string> = { tspl: 'TSPL', zpl: 'ZPL', cpcl: 'CPCL', escpos: 'ESC/POS' }

export function printerNameOf(p: PrinterConfig): string {
  const target = p.printerName ? ` · ${p.printerName}` : ''
  return `${DRIVER_LABEL[p.driver] ?? p.driver.toUpperCase()} @${p.dpi}dpi${target}`
}
