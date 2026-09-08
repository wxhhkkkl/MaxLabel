// ---------- 指令打印总入口：按打印机配置生成批量指令 ----------
import type { Dataset, LabelDoc, MonoBitmap, PrinterConfig } from '../model'
import { flattenObjects } from '../model'
import { buildTSPL } from './tspl'
import { buildZPL } from './zpl'
import { buildCPCL } from './cpcl'
import { monoToBmp } from './bitmap'

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
  layout?: { rows: number; cols: number }
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
}

/** 二进制段占位标记：@@BIN:<标签序号>:<对象id>@@（区分逐张可变位图） */
const BIN_RE = /@@BIN:(\d+):([\w-]+)@@/g

function textToSegments(text: string, imagesByLabel: Array<Record<string, MonoBitmap>>, images: Record<string, MonoBitmap>): CommandSegment[] {
  const segs: CommandSegment[] = []
  let last = 0
  let m: RegExpExecArray | null
  BIN_RE.lastIndex = 0
  while ((m = BIN_RE.exec(text))) {
    if (m.index > last) segs.push({ type: 'text', str: text.slice(last, m.index) })
    const labelIdx = parseInt(m[1], 10) - 1
    const mono = imagesByLabel[labelIdx]?.[m[2]] ?? images[m[2]]
    if (mono) segs.push({ type: 'bin', data: monoToBmp(mono) })
    last = m.index + m[0].length
  }
  if (last < text.length) segs.push({ type: 'text', str: text.slice(last) })
  return segs
}

export function buildCommands(doc: LabelDoc, printer: PrinterConfig, job: PrintJobOptions): BuildResult {
  const warnings: string[] = []
  const blocks: string[] = []
  const datasets = job.datasets ?? {}
  const sharedVars = job.sharedVars ?? {}
  const keyboardValues = job.keyboardValues ?? {}
  const images = job.images ?? {}
  const imagesByLabel = job.imagesByLabel ?? []
  // 打印机参数命令：作业开始前发送一次（自定义命令，如复位/初始化参数）
  if (printer.preCmd) blocks.push(printer.preCmd)
  const gridCount = (job.layout?.rows && job.layout?.cols && job.layout.rows > 1 && job.layout.cols > 1) ? job.layout.rows * job.layout.cols : 1
  let g = 0
  for (let i = 0; i < job.count; i++) {
    for (let k = 0; k < gridCount; k++) {
      const labelNo = g + 1
      g++
      const ctx = {
        labelIndex: labelNo,
        recordIndex: i,
        copy: job.copy,
        count: job.count,
        totalLabels: job.count,
        title: job.title,
        printerName: printerNameOf(printer),
        datasets,
        sharedVars,
        keyboardValues,
        images: imagesByLabel[i] ?? images
      }
      // 标签内容命令：每张标签内容前发送（自定义命令）
      if (printer.contentCmd) blocks.push(printer.contentCmd)
      if (printer.driver === 'tspl') blocks.push(buildTSPL({ ...doc, objects: flattenObjects(doc.objects) }, printer, ctx, warnings))
      else if (printer.driver === 'zpl') blocks.push(buildZPL({ ...doc, objects: flattenObjects(doc.objects) }, printer, ctx, warnings))
      else blocks.push(buildCPCL({ ...doc, objects: flattenObjects(doc.objects) }, printer, ctx, warnings))
    }
  }
  // 打印后处理命令：作业结束后发送（如切纸/回退），放在最后
  if (printer.postCmd) blocks.push(printer.postCmd)
  const rawText = blocks.length ? blocks.join('\n') + '\n' : ''
  const segments = textToSegments(rawText, imagesByLabel, images)
  const text = segments.map((s) => (s.type === 'text' ? s.str : `[BIN:${s.data.length}B]`)).join('')
  return {
    segments,
    text,
    encoding: printer.port.encoding,
    labelCount: job.count * job.copy * gridCount,
    warnings
  }
}

const DRIVER_LABEL: Record<string, string> = { tspl: 'TSPL', zpl: 'ZPL', cpcl: 'CPCL' }

export function printerNameOf(p: PrinterConfig): string {
  return `${DRIVER_LABEL[p.driver] ?? p.driver.toUpperCase()} @${p.dpi}dpi`
}
