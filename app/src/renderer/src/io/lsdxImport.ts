// MaxLabel .lsdx 标签文件导入器（XML → MaxLabel LabelDoc）
// 依据：MaxLabel V6.39 实测保存的 .lsdx 样例（XML utf-8，坐标单位 1/100mm）。
// 覆盖：页面/标签尺寸、拼版布局、条码（含码制映射）、文本、线/矩形/椭圆、组合、
// 常量/序列号/数据库/键盘变量、内嵌/外链图片、基础表格和 RFID 参数。
// MaxLabel 私有字段仍采用“保留可编辑对象 + 明确告警”的策略，不静默丢弃。

import { uid, round2 } from '../types'
import { DATE_FORMATS, TIME_FORMATS } from '../../../shared/domain/dateFormats'
import type {
  BarcodeObj,
  DataSource,
  EllipseObj,
  GroupObj,
  ImageObj,
  LabelDoc,
  LabelObject,
  LengthLimit,
  LineObj,
  RectObj,
  RfidObj,
  TableObj,
  TextObj
} from '../types'
import { defaultPrinterConfig } from '../../../shared/domain/printer'
import type { CommandSet, PrinterConfig } from '../../../shared/domain/printer'
import { MAX_IMAGE_DECOMPRESSED_BYTES } from '../../../shared/print/limits'
import { validateBarcodeContent } from '../../../shared/domain/barcodeCharset'
import { validateImageDataUrl } from '../print/imageValidation'

export interface LsdxImportResult {
  doc: LabelDoc
  warnings: string[]
}

export interface LsdxImportOptions {
  /** Absolute path of the source file, used to resolve relative pictures. */
  sourcePath?: string
}

const MAX_LSDX_XML_LENGTH = 16 * 1024 * 1024
const MAX_LSDX_OBJECTS = 10000
const MAX_LSDX_GROUP_DEPTH = 32

/** MaxLabel 码制编号 → bwip-js bcid（btype=2 经样例确认 Code128，其余按原版对话框顺序推断，可修订） */
const BTYPE_MAP: Record<number, string> = {
  0: 'code128', // Code 128（自动）
  1: 'code39', // Code 39
  2: 'code128', // Code 128（样例确认）
  3: 'ean13', // EAN-13
  4: 'ean8', // EAN-8
  5: 'upca', // UPC-A
  6: 'upce', // UPC-E
  7: 'interleaved2of5', // ITF-25
  8: 'code93', // Code 93
  9: 'codabar', // Codabar
  10: 'itf14', // ITF-14
  11: 'qrcode', // QR Code（样例确认：8×8mm 方框 + 日期内容）
  12: 'matrix2of5', // Matrix 25
  13: 'datalogic2of5', // 中国邮政码
  14: 'databaromni', // GS1 DataBar
  15: 'qrcode', // QR Code（旧表保留，兼容历史文件）
  16: 'datamatrix', // Data Matrix
  17: 'pdf417', // PDF417
  18: 'hanxin' // 汉信码
}

const MM = 100 // lsdx 坐标单位：1/100mm

function rotToDeg(r: string | null): number {
  const v = Number(r ?? '0')
  if (v === 0) return 0
  if (v === 90) return 90
  if (v === 180) return 180
  if (v === 270) return 270
  if (r === 'none' || r === '') return 0
  return Number.isFinite(v) ? v : 0
}

function num(el: Element | null, attr: string, dflt = 0): number {
  if (!el) return dflt
  const v = el.getAttribute(attr)
  if (v === null || v === '') return dflt
  const n = Number(v)
  return Number.isFinite(n) ? n : dflt
}

function rgbToHex(s: string | null | undefined, dflt = '#000000'): string {
  if (!s) return dflt
  const parts = s.split(',').map((x) => parseInt(x.trim(), 10))
  if (parts.length < 3 || parts.some((x) => !Number.isFinite(x))) return dflt
  const c = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
  return '#' + c(parts[0]) + c(parts[1]) + c(parts[2])
}

/** 序列号保存值 → 前缀 + 数值起始 + 位数（"1" → 1 位，"SN-001" → 前缀 SN-、3 位）。 */
function serialFromSaved(saved: string): { prefix: string; start: number; digits: number } {
  const match = /^(.*?)(\d+)$/.exec(saved.trim())
  if (match) {
    const value = Number(match[2])
    if (Number.isFinite(value)) {
      return { prefix: match[1], start: value, digits: Math.min(64, Math.max(1, match[2].length)) }
    }
  }
  const digits = saved.replace(/\D/g, '')
  return { prefix: '', start: 1, digits: Math.max(1, Math.min(64, digits.length || 1)) }
}

/**
 * 原版（GDI）对 Arial 这类拉丁字体做字体链接：拉丁字用 Arial，缺字形的汉字由宋体补。
 * 浏览器只有 font-family 栈能表达同样的逐字回退，所以中文文本写成 `Arial, 宋体`。
 */
function lsdxFontFamily(face: string | null | undefined, text: string): string {
  const base = (face ?? '').trim() || 'Arial'
  const hasCjk = /[㐀-鿿]/.test(text)
  const baseIsCjk = /[㐀-鿿]/.test(base) || /simsun|宋体/i.test(base)
  return hasCjk && !baseIsCjk ? `${base}, 宋体` : base
}

function b64ToUtf8(b64: string): string {
  try {
    const bin = atob(b64.replace(/\s+/g, ''))
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return ''
  }
}

/**
 * 解析 objvarlink：以 ":" 分段，每段 "对象id,变量id"（变量可省）。
 * 例：":2,1" → 对象2←变量1；":1:4,3:5" → 对象4←变量3；":2,1:4,3:6,5:8,7:9:16:17" → 2←1、4←3、6←5、8←7、9/16/17 无变量
 */
function parseObjVarLink(link: string | null | undefined): Map<string, string> {
  const m = new Map<string, string>()
  if (!link) return m
  for (const seg of link.split(':').filter(Boolean)) {
    const parts = seg.split(',')
    const objId = parts[0]
    if (!objId) continue
    if (parts.length > 1 && parts[1]) m.set(objId, parts[1])
  }
  return m
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function hasPngHead(b: Uint8Array): boolean {
  return b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
}
function hasJpegHead(b: Uint8Array): boolean {
  return b.length > 3 && b[0] === 0xff && b[1] === 0xd8
}
function hasGifHead(b: Uint8Array): boolean {
  return b.length > 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38
}
function hasBmpHead(b: Uint8Array): boolean {
  return b.length > 2 && b[0] === 0x42 && b[1] === 0x4d
}

function bytesToDataUrl(b: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i])
  const mime = hasPngHead(b) ? 'image/png' : hasJpegHead(b) ? 'image/jpeg' : hasGifHead(b) ? 'image/gif' : hasBmpHead(b) ? 'image/bmp' : 'image/png'
  return 'data:' + mime + ';base64,' + btoa(bin)
}

/** MaxLabel labelformat/form flags: corner=1 is rounded paper; corner=2 is oval paper. */
function paperShapeFromLsdx(form: Element | null): 'rect' | 'roundRect' | 'ellipse' {
  const corner = Math.round(num(form, 'corner', 0))
  if (corner === 2) return 'ellipse'
  if (corner === 1) return 'roundRect'
  return 'rect'
}

/** 原版保存的打印机名 → 指令集（未识别的按 TSPL，与程序默认一致）。 */
function commandSetFromPrinterName(name: string): CommandSet {
  const token = name.toUpperCase()
  if (/ZPL|EPL/.test(token) || /ZEBRA|斑马/.test(token)) return 'zpl'
  if (/CPCL/.test(token)) return 'cpcl'
  if (/ESC\/?POS/.test(token)) return 'escpos'
  return 'tspl'
}

/**
 * 变量的「长度限制」：原版 `<limit maxlength filled fillchar cutout>`。
 * 只导入最大长度与截断方向；填充（filled/fillchar）表示不足时的补位方向，
 * 只有在同时设置了最小长度时才有意义，本模型用 min 表达，这里不臆测最小长度。
 */
function lengthLimitOf(variable: Element): LengthLimit | undefined {
  const limit = variable.querySelector('limit')
  if (!limit) return undefined
  const max = Math.floor(num(limit, 'maxlength', 0))
  if (!Number.isFinite(max) || max <= 0) return undefined
  const cutout = limit.getAttribute('cutout')
  return {
    mode: 'max',
    max,
    ...(cutout === 'left' || cutout === 'right' ? { trimDir: cutout } : {})
  }
}

function directoryOf(filePath: string): string {
  const normalized = filePath.replace(/[\\/]+/g, '/')
  const slash = normalized.lastIndexOf('/')
  return slash >= 0 ? normalized.slice(0, slash) : ''
}

function isAbsolutePath(filePath: string): boolean {
  return /^([A-Za-z]:[\\/]|\\\\|\/)/.test(filePath)
}

function resolvePicturePath(baseDir: string, reference: string): string {
  if (!baseDir || isAbsolutePath(reference)) return reference
  return `${baseDir.replace(/[\\/]+$/, '')}/${reference.replace(/^[\\/]+/, '')}`
}

/** zlib deflate 解压（MaxLabel 内嵌图片 compress=2） */
async function inflateDeflate(bin: Uint8Array): Promise<Uint8Array> {
  if (bin.byteLength > MAX_IMAGE_DECOMPRESSED_BYTES) throw new Error('MaxLabel 内嵌图片压缩数据超过限制')
  const ds = new DecompressionStream('deflate')
  const stream = new Blob([bin.buffer as ArrayBuffer]).stream().pipeThrough(ds)
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const next = await reader.read()
    if (next.done) break
    total += next.value.byteLength
    if (total > MAX_IMAGE_DECOMPRESSED_BYTES) {
      await reader.cancel()
      throw new Error(`MaxLabel 内嵌图片解压后超过 ${Math.round(MAX_IMAGE_DECOMPRESSED_BYTES / 1024 / 1024)} MB 限制`)
    }
    chunks.push(next.value)
  }
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength }
  return result
}

export async function importLsdx(xml: string, suggestedName?: string, options: LsdxImportOptions = {}): Promise<LsdxImportResult> {
  if (typeof xml !== 'string' || xml.length === 0 || xml.length > MAX_LSDX_XML_LENGTH) {
    throw new Error(`MaxLabel 文件超过 ${Math.round(MAX_LSDX_XML_LENGTH / 1024 / 1024)} MB 限制`)
  }
  const warnings: string[] = []
  const sourceDir = options.sourcePath ? directoryOf(options.sourcePath) : ''
  const state = { objectCount: 0 }
  const parser = new DOMParser()
  const docXml = parser.parseFromString(xml, 'text/xml')
  if (docXml.querySelector('parsererror')) throw new Error('MaxLabel 文件 XML 解析失败')
  const root = docXml.documentElement
  if (!root || root.tagName !== 'labelshopdocument') {
    throw new Error('不是有效的 MaxLabel 标签文件（labelshopdocument 根节点缺失）')
  }

  const labelForm = root.querySelector('labelform')
  const labelEl = labelForm?.querySelector('label')
  const wMm = labelEl ? num(labelEl, 'width', 0) / MM : 0
  const hMm = labelEl ? num(labelEl, 'height', 0) / MM : 0
  if (!wMm || !hMm) throw new Error('标签文件中未找到有效的标签尺寸')

  // 拼版布局
  const formEl = labelForm?.querySelector('form') ?? null
  const shape = paperShapeFromLsdx(formEl)
  const holeSizeMm = formEl ? num(formEl, 'holesize', 0) / MM : 0
  // <paper> 有两个：第一个是格式目录信息（无 width/height），第二个才是实际纸张。
  const paperEl = Array.from(labelForm?.querySelectorAll('paper') ?? [])
    .find((el) => num(el, 'width', 0) > 0 && num(el, 'height', 0) > 0) ?? null
  const pageWidthMm = paperEl ? round2(num(paperEl, 'width', 0) / MM) : undefined
  const pageHeightMm = paperEl ? round2(num(paperEl, 'height', 0) / MM) : undefined
  // LabelShop 帮助「标签格式设置_页面/其它」：<page left/top> 是页面边缘到第一行/列标签的
  // 距离（左空/上空，决定标签阵列在纸张中的起点）；<paper leftoffect/topoffect> 是打印位置微调。
  // 旧实现把 paper 的微调当成左空/上空，且完全忽略 <page>，导致首行标签贴在纸张边缘，
  // 页式打印机（如佳能 G2010）的非打印边距会切掉标签顶部。
  const pageEl = labelForm?.querySelector('page') ?? null
  const pageLeftMm = pageEl ? round2(num(pageEl, 'left', 0) / MM) : 0
  const pageTopMm = pageEl ? round2(num(pageEl, 'top', 0) / MM) : 0
  const pageOffsetXMm = paperEl ? round2(num(paperEl, 'leftoffect', 0) / MM) : 0
  const pageOffsetYMm = paperEl ? round2(num(paperEl, 'topoffect', 0) / MM) : 0
  const paperColor = paperEl?.getAttribute('color')
  const layout: LabelDoc['layout'] = {
    rows: labelEl ? Math.max(1, num(labelEl, 'rows', 1)) : 1,
    cols: labelEl ? Math.max(1, num(labelEl, 'cols', 1)) : 1,
    rowGapMm: labelEl ? num(labelEl, 'rowgap', 0) / MM : 0,
    colGapMm: labelEl ? num(labelEl, 'colgap', 0) / MM : 0,
    shape,
    ...(holeSizeMm > 0 ? { innerDiameterMm: holeSizeMm } : {}),
    ...(pageWidthMm && pageWidthMm > 0 ? { pageWidthMm } : {}),
    ...(pageHeightMm && pageHeightMm > 0 ? { pageHeightMm } : {}),
    ...(pageLeftMm !== 0 ? { pageLeftMm } : {}),
    ...(pageTopMm !== 0 ? { pageTopMm } : {}),
    ...(pageOffsetXMm !== 0 ? { offsetXMm: pageOffsetXMm } : {}),
    ...(pageOffsetYMm !== 0 ? { offsetYMm: pageOffsetYMm } : {}),
    ...(paperColor ? { labelColor: rgbToHex(paperColor, '#ffffff') } : {})
  }

  // 数据库字段表：databasefield 第一段是字段序号，字段名缺失时按它补全。
  const fieldNames = new Map<string, string>()
  root.querySelectorAll('database Connection fields field').forEach((f) => {
    const fieldId = f.getAttribute('id')
    const fieldName = f.getAttribute('name')
    if (fieldId !== null && fieldName) fieldNames.set(fieldId, fieldName)
  })

  // 变量表
  const variables = new Map<string, { type: string; source: DataSource; sample?: string; limit?: LengthLimit }>()
  labelForm?.querySelectorAll('variable').forEach((v) => {
    const id = v.getAttribute('id')
    if (!id) return
    const type = v.getAttribute('type') || 'constant'
    // MaxLabel 把变量当前值以 base64 存在 data 属性里；数据库变量在没导入数据集时
    // 这是唯一能还原版面的值（原版重新打开也是显示它）。
    const savedValue = b64ToUtf8(v.getAttribute('data') || '')
    let source: DataSource = { kind: 'constant', value: '' }
    if (type === 'constant') {
      source = { kind: 'constant', value: b64ToUtf8(v.getAttribute('data') || '') }
    } else if (type === 'serial') {
      // serealchars 是允许字符集（如 "0123456789"），不是起始值；起始/当前值在 data。
      // digits=0 会让文档归一化直接拒绝导入，至少要 1 位。
      const serial = serialFromSaved(savedValue)
      // 原版属性名（实测 `商品导出.lsdx`）：
      //   serialrepeat    相同序列值重复次数（默认 1）
      //   serealreptype   重复基准：0 = 按记录、1 = 按标签数
      //   serealreset     按标签数推进时，每条记录开始是否回到初始值：0/1
      const repeat = Math.max(1, Math.floor(num(v, 'serialrepeat', 1)))
      source = {
        kind: 'serial',
        prefix: serial.prefix,
        start: serial.start,
        step: Number.isFinite(num(v, 'serialstep', 1)) ? num(v, 'serialstep', 1) : 1,
        digits: serial.digits,
        current: serial.start,
        repeat,
        repeatBasis: v.getAttribute('serealreptype') === '1' ? 'label' : 'record',
        ...(v.getAttribute('serealreset') === '1' ? { resetEachRecord: true } : {})
      }
    } else if (type === 'database') {
      // 绑定信息只在 databasefield 这个竖线复合串上：`字段序号|字段名|数据库名|…`
      // （真机样例 `1|商品名称|Database1|1|0|0`）。变量自身的 dataset/field 属性并不存在。
      const parts = (v.getAttribute('databasefield') || '').split('|').map((part) => part.trim())
      const dataset = v.getAttribute('dataset') || v.getAttribute('datasetname') || v.getAttribute('databasename') || parts[2] || ''
      const field = parts[1] || fieldNames.get(parts[0] ?? '') || v.getAttribute('field') || ''
      if (dataset && field) {
        // 文件里只有「保存时那一行的值」，不是数据集本身；绑定（数据集 + 字段名）必须留着，
        // 这样用户再引入原数据库时只要在数据源页选数据集，字段就能自动对上，不用逐个重绑。
        // 保存值同时留成样本值：数据集没引入前版面照常显示它，不会整片空白。
        source = { kind: 'database', dataset, field, ...(savedValue ? { sampleValue: savedValue } : {}) }
        warnings.push('数据库变量 ' + id + ' 已保留字段绑定（数据集 ' + dataset + ' / 字段 ' + field + '）；当前模板未携带该数据集的数据，版面按文件内保存的值显示，打印前请在数据源页选择数据集')
      } else {
        // 连绑定都解析不出来（老文件只存了值），退回固定文本，至少版面不是空白。
        source = { kind: 'constant', value: savedValue }
        warnings.push('数据库变量 ' + id + ' 未携带数据集/字段名，已按文件内保存的值导入为固定文本；如需按数据库打印，请在数据源页重新绑定')
      }
    } else if (type === 'date' || type === 'time') {
      // 日期/时间变量：datatimetype 是原版「日期格式 / 时间格式」下拉的 0 基下标
      // （实测 datatimetype="3" 的保存值 02-11-26 = dd-MM-yy，="30" 的 26/11/02 = yy/MM/dd），
      // datatimeoffect 是偏移秒数（样例 259200 = 3 天）。丢掉它，二维码里的日期会永远停在保存那天。
      const formats = type === 'time' ? TIME_FORMATS : DATE_FORMATS
      const index = num(v, 'datatimetype', 0)
      const explicit = (v.getAttribute('datatimeformat') || '').trim()
      const format = /[yMdHhms]/.test(explicit)
        ? explicit
        : (formats[index]?.value ?? (type === 'time' ? 'HH:mm:ss' : 'yyyy-MM-dd'))
      if (!/[yMdHhms]/.test(explicit) && !formats[index]) {
        warnings.push('变量 ' + id + ' 的' + (type === 'time' ? '时间' : '日期') + '格式编号 ' + index + ' 未确认，按 ' + format + ' 导入')
      }
      const seconds = num(v, 'datatimeoffect', 0)
      source = type === 'time'
        ? { kind: 'time', format, region: 'default', offset: Math.round(seconds / 60) }
        : { kind: 'date', format, offset: round2(seconds / 86400) }
    } else if (type === 'script') {
      // scriptjs / scriptpriv 是 base64（JS / VBScript 两个版本）；scripttext 只在
      // 老文件里出现，按原样使用（不猜它是否 base64）。
      const scriptJs = b64ToUtf8(v.getAttribute('scriptjs') || '')
      const scriptVb = b64ToUtf8(v.getAttribute('scriptpriv') || '')
      const code = (scriptJs || scriptVb || v.getAttribute('scripttext') || '').trim()
      if (code) {
        source = {
          kind: 'script',
          code,
          ...(scriptJs ? { language: 'javascript' as const } : scriptVb ? { language: 'vbscript' as const } : {})
        }
      } else {
        source = { kind: 'constant', value: savedValue }
        warnings.push('脚本变量 ' + id + ' 没有可读的脚本内容，已按文件内保存的值导入为固定文本')
      }
    } else if (type === 'keyboard') {
      source = { kind: 'keyboard', label: v.getAttribute('keyboardprompt') || '' }
    } else {
      source = { kind: 'constant', value: savedValue }
      warnings.push('变量 ' + id + ' 的类型（' + type + '）暂不支持，已按文件内保存的值导入为固定文本')
    }
    variables.set(id, { type, source, sample: savedValue, limit: lengthLimitOf(v) })
  })

  // 对象-变量关联
  const objVarLink = parseObjVarLink(labelForm?.querySelector('objvarlink')?.getAttribute('link'))

  const objects: LabelObject[] = []
  const walkObjs = async (container: Element | null | undefined, list: LabelObject[]) => {
    if (!container) return
    for (const drawEl of Array.from(container.querySelectorAll(':scope > drawobj'))) {
      const obj = await convertDrawObj(drawEl, objVarLink, variables, warnings, sourceDir, 0, state)
      if (obj) list.push(obj)
    }
  }

  await walkObjs(labelForm?.querySelector('labelobjects'), objects)

  // 打印机绑定 + 全局脚本：原版模板会随文件保存目标打印机与 OnBeginPrint 等脚本。
  const printerEl = root.querySelector('printer')
  const lsdxPrinterName = (printerEl?.getAttribute('name') || printerEl?.getAttribute('dev') || '').trim()
  const lsdxPrinterDpi = num(printerEl, 'dpix', 0) || num(printerEl, 'dpiy', 0)
  const printer: PrinterConfig | undefined = lsdxPrinterName || lsdxPrinterDpi > 0
    ? {
        ...defaultPrinterConfig(),
        driver: commandSetFromPrinterName(lsdxPrinterName),
        ...(lsdxPrinterDpi > 0 ? { dpi: lsdxPrinterDpi } : {}),
        ...(lsdxPrinterName ? { printerName: lsdxPrinterName, model: lsdxPrinterName } : {}),
        port: { type: 'driver', encoding: 'utf8' }
      }
    : undefined
  const globalScript = b64ToUtf8(printerEl?.getAttribute('script') || '')
  const orientation = rotToDeg(labelEl?.getAttribute('rotation') ?? null) as 0 | 90 | 180 | 270

  const doc: LabelDoc = {
    version: 1,
    name: suggestedName ? suggestedName.replace(/\.lsdx$/i, '') : '导入标签',
    widthMm: wMm,
    heightMm: hMm,
    objects,
    layout,
    ...(orientation !== 0 ? { orientation } : {}),
    ...(printer ? { printer } : {}),
    ...(globalScript.trim() ? { globalScript } : {})
  }

  return { doc, warnings }
}

async function convertDrawObj(
  drawEl: Element,
  objVarLink: Map<string, string>,
  variables: Map<string, { type: string; source: DataSource; sample?: string; limit?: LengthLimit }>,
  warnings: string[],
  sourceDir: string,
  depth: number,
  state: { objectCount: number }
): Promise<LabelObject | null> {
  if (depth > MAX_LSDX_GROUP_DEPTH) throw new Error(`MaxLabel 分组嵌套超过 ${MAX_LSDX_GROUP_DEPTH} 层限制`)
  state.objectCount += 1
  if (state.objectCount > MAX_LSDX_OBJECTS) throw new Error(`MaxLabel 对象数量超过 ${MAX_LSDX_OBJECTS} 个限制`)
  const type = drawEl.getAttribute('type') || ''
  const id = drawEl.getAttribute('id') || ''
  const left = num(drawEl, 'left') / MM
  const top = num(drawEl, 'top') / MM
  const right = num(drawEl, 'right') / MM
  const bottom = num(drawEl, 'bottom') / MM
  const x = left
  const y = top
  const w = Math.max(0.01, right - left)
  const h = Math.max(0.01, bottom - top)
  const rotation = rotToDeg(drawEl.getAttribute('rotation'))
  const base = { id: uid(), x: round2(x), y: round2(y), w: round2(w), h: round2(h), rotation }

  // 数据源：优先对象-变量关联，其次对象内联文本
  const varId = objVarLink.get(id)
  const varEntry = varId ? variables.get(varId) : undefined
  const varSource = varEntry?.source
  const varLimit = varEntry?.limit

  const fontEl = drawEl.querySelector('font')
  const colorEl = drawEl.querySelector('color')

  switch (type) {
    case 'drawbarcode': {
      const barcodeEl = drawEl.querySelector('barcode')
      const btype = num(barcodeEl, 'btype', 2)
      let symbology = BTYPE_MAP[btype] || 'code128'
      if (!BTYPE_MAP[btype]) warnings.push('条码对象 ' + id + ' 码制编号 ' + btype + ' 未确认，按 Code128 打开')
      // 常量条码的正文在 <text> 里；变量条码用 varSource。
      const barcodeTextEl = drawEl.querySelector('text')
      const barcodeText = barcodeTextEl
        ? (barcodeTextEl.getAttribute('str') ?? barcodeTextEl.getAttribute('text') ?? barcodeTextEl.getAttribute('value') ?? barcodeTextEl.textContent ?? '')
        : ''
      const barcodeSource = varSource ?? { kind: 'constant', value: barcodeText }
      // btype 枚举没有公开文档；若当前映射的码制连内容都编不了（例如 Code25 遇到连字符），
      // 退回 Code128，避免导入后直接显示“条码数据无效”。数据库变量用文件里的样本值来判断
      // （绑定现在保留为 database 源，不再退化成常量）。
      const barcodeSample = barcodeSource.kind === 'constant' ? barcodeSource.value : (varEntry?.sample || barcodeText)
      if (barcodeSample && !validateBarcodeContent(symbology, barcodeSample).ok
        && validateBarcodeContent('code128', barcodeSample).ok) {
        warnings.push('条码对象 ' + id + ' 的码制 ' + symbology + ' 无法编码当前内容，已按 Code128 导入')
        symbology = 'code128'
      }
      const barwidth = num(barcodeEl, 'barwidth', 0)
      const radio = num(barcodeEl, 'radio', 0)
      const wide = num(barcodeEl, 'wide', 0)
      const readable = num(barcodeEl, 'readable', 0)
      const template = barcodeEl?.getAttribute('templtestr') || ''
      const obj: BarcodeObj = {
        ...base,
        type: 'barcode',
        symbology,
        // 二维码/矩阵码默认不输出供人识读文字（原版导入后也不带）。
        showText: !['qrcode', 'microqrcode', 'datamatrix', 'pdf417', 'hanxin'].includes(symbology) && readable !== 0,
        source: barcodeSource,
        ...(varLimit ? { lengthLimit: varLimit } : {}),
        barcodeOptions: {
          // lsdx 的 barwidth 是「1/100 密耳」：833 → 8.33 mil、1000 → 10.00 mil（真机 X 尺寸的默认档）、
          // 1500 → 15.00 mil —— 三个样例都正好落在真机下拉 1/600 英寸的档位上。
          // 按 1/10000mm 读会小 2.54 倍：二维码模块数从 21 变 53，属性页还显示成 6.67 mil。
          // 文档校验要求 xSizeMil ≥ 1、xSizeMm ≥ 0.01；极端的原版占位值（如 barwidth=25）
          // 不能让整个模板打不开，按最小合法值导入。
          ...(barwidth > 0
            ? {
                xSizeMil: Math.max(1, round2(barwidth / 100)),
                xSizeMm: Math.max(0.01, Math.round((barwidth / 100) * 0.0254 * 1000) / 1000)
              }
            : {}),
          w2n: radio > 0 && wide > 0 && Math.abs(wide - radio) > 1 ? round2(wide / radio) : undefined
        }
      }
      if (template) obj.charTemplate = template
      return obj
    }
    case 'drawtext': {
      // 文本内容：子元素 <text> 的 str 属性 / 文本节点 / drawobj text 属性，多路兼容
      const textEl = drawEl.querySelector('text')
      let value = ''
      if (textEl) {
        value =
          textEl.getAttribute('str') ??
          textEl.getAttribute('text') ??
          textEl.getAttribute('value') ??
          textEl.textContent ??
          ''
      } else {
        value = drawEl.getAttribute('text') || drawEl.getAttribute('str') || ''
      }
      // 文字内容对齐在 <text align>（drawobj 的 halign 在样例里恒为 0）。
      // 枚举：0=左对齐，1=右对齐，2=居中。
      const textAlign = num(textEl, 'align', 0)
      const italic = num(fontEl, 'italic', 0)
      const underline = num(fontEl, 'underline', 0)
      const strike = num(fontEl, 'steikeout', 0)
      const source = varSource ?? { kind: 'constant', value }
      // 数据库变量现在保留绑定、不带内容；字体回退仍按文件里保存的样本值判断（中文要挂宋体），
      // 否则「拉丁字体 + 中文」的字体链接会在导入后丢掉。
      const displayText = source.kind === 'constant' ? source.value : (varEntry?.sample || value)
      const face = fontEl?.getAttribute('facename') ?? ''
      // style 的 bit0 是粗体，对所有字体生效（宋体没有真粗体会由浏览器合成）。
      const wantsBold = (num(fontEl, 'style', 0) & 1) !== 0 || num(fontEl, 'weight', 0) >= 700 || fontEl?.getAttribute('bold') === '1'
      // font/width 是真机「字体宽度方向缩放倍数(&H)」×10000：10000=1.00、8482=0.85，0=未设置。
      // 丢掉它，压扁过的字会按 1.00 打出来（字宽多出约 18%）。
      const widthRaw = num(fontEl, 'width', 0)
      const fontWidthScale = widthRaw > 0 ? Math.max(0.1, Math.min(10, widthRaw / 10000)) : 1
      // text.type：0 = 单行、1 = 多行（多行按对象框宽度折行）；text.width>0 是显式行宽。
      const textType = num(textEl, 'type', 0) === 1 ? 'multi' as const : 'single' as const
      const lineWidthRaw = num(textEl, 'width', 0)
      const obj: TextObj = {
        ...base,
        type: 'text',
        fontFamily: lsdxFontFamily(face, displayText),
        // lsdx 的 font/height 是 1/100 磅（1200 = 12.00pt），不是 1/100mm。
        fontSize: fontEl ? Math.max(0.5, (num(fontEl, 'height', 400) / 100) * 25.4 / 72) : Math.max(0.5, h * 0.8),
        bold: wantsBold,
        italic: italic !== 0,
        underline: underline !== 0,
        strikeout: strike !== 0,
        align: textAlign === 2 ? 'center' : textAlign === 1 ? 'right' : 'left',
        color: rgbToHex(fontEl?.getAttribute('color'), '#000000'),
        ...(fontWidthScale !== 1 ? { fontWidthScale } : {}),
        ...(textType === 'multi' ? { textType } : {}),
        ...(textType === 'multi' && lineWidthRaw > 0 ? { lineWidth: round2(lineWidthRaw / MM) } : {}),
        ...(varLimit ? { lengthLimit: varLimit } : {}),
        source
      }
      return obj
    }
    case 'drawline': {
      const lineEl = drawEl.querySelector('line')
      const obj: LineObj = {
        ...base,
        type: 'line',
        stroke: rgbToHex(lineEl?.getAttribute('linecolor'), '#000000'),
        strokeWidth: lineEl ? Math.max(0.05, num(lineEl, 'linewidth', 30) / MM) : 0.3
      }
      return obj
    }
    case 'drawrect': {
      const rectEl = drawEl.querySelector('rect')
      const stroke = rgbToHex(rectEl?.getAttribute('linecolor') || rectEl?.getAttribute('color') || colorEl?.getAttribute('colors')?.split(',')[0], '#000000')
      const fillAttr = rectEl?.getAttribute('fill') || rectEl?.getAttribute('filled')
      const obj: RectObj = {
        ...base,
        type: 'rect',
        fill: fillAttr !== null && fillAttr !== undefined ? rgbToHex(fillAttr, '#ffffff') : 'transparent',
        stroke,
        strokeWidth: rectEl ? Math.max(0.05, num(rectEl, 'linewidth', 30) / MM) : 0.3
      }
      return obj
    }
    case 'drawellipse': {
      const el = drawEl.querySelector('ellipse')
      const stroke = rgbToHex(el?.getAttribute('linecolor') || el?.getAttribute('color'), '#000000')
      const obj: EllipseObj = {
        ...base,
        type: 'ellipse',
        fill: 'transparent',
        stroke,
        strokeWidth: el ? Math.max(0.05, num(el, 'linewidth', 30) / MM) : 0.3
      }
      return obj
    }
    case 'drawgroup': {
      const children: LabelObject[] = []
      const objectsEl = drawEl.querySelector('objects')
      for (const child of Array.from(objectsEl?.querySelectorAll(':scope > drawobj') ?? [])) {
        const c = await convertDrawObj(child, objVarLink, variables, warnings, sourceDir, depth + 1, state)
        if (c) children.push(c)
      }
      const obj: GroupObj = {
        ...base,
        type: 'group',
        children
      }
      return obj
    }
    case 'drawpicture': {
      const picEl = drawEl.querySelector('picture')
      const ptype = num(picEl, 'type', 0)
      const file = picEl?.getAttribute('file') || ''
      const dataB64 = (picEl?.textContent || '').trim()
      try {
        if (ptype === 0 && dataB64) {
          // 内嵌图片：可能为原始图片 base64（PNG/JPEG/GIF/BMP）或 zlib 压缩数据（compress=2）
          const raw = b64ToBytes(dataB64)
          let imgBytes: Uint8Array | null = null
          if (hasPngHead(raw) || hasJpegHead(raw) || hasGifHead(raw) || hasBmpHead(raw)) imgBytes = raw
          else imgBytes = await inflateDeflate(raw)
          if (imgBytes && imgBytes.length > 0) {
            if (imgBytes.byteLength > MAX_IMAGE_DECOMPRESSED_BYTES) throw new Error('MaxLabel 内嵌图片超过大小限制')
            const src = bytesToDataUrl(imgBytes)
            await validateImageDataUrl(src)
            const obj: ImageObj = { ...base, type: 'image', src, imgType: 'embed' }
            return obj
          }
        }
        if (ptype === 1 && file) {
          // 外链图片：读取本地文件并嵌入
          const resolvedFile = resolvePicturePath(sourceDir, file)
          const r = (await window.maxlabel.readImage(resolvedFile)) as { ok: boolean; dataUrl?: string; message?: string }
          if (r.ok && r.dataUrl) {
            const obj: ImageObj = { ...base, type: 'image', src: r.dataUrl, imgType: 'embed' }
            return obj
          }
          warnings.push('图片对象 ' + id + ' 引用的文件不存在或无法读取：' + file + '（已按相对路径解析；请重新插入图片）')
          return null
        }
      } catch (e) {
        warnings.push('图片对象 ' + id + ' 图像数据解码失败：' + String((e as { message?: string }).message ?? e))
        return null
      }
      warnings.push('图片对象 ' + id + ' 无可用图像数据，请打开后重新插入图片')
      return null
    }
    case 'drawtable': {
      const tableEl = drawEl.querySelector('table')
      const rows = Math.max(1, Math.min(100, Math.floor(num(tableEl ?? drawEl, 'rows', num(tableEl ?? drawEl, 'rowcount', 1)))))
      const cols = Math.max(1, Math.min(100, Math.floor(num(tableEl ?? drawEl, 'cols', num(tableEl ?? drawEl, 'colcount', 1)))))
      warnings.push('表格对象 ' + id + ' 已导入基础网格；单元格文本、合并和专用样式请打开后核对')
      return {
        ...base,
        type: 'table',
        rows,
        cols,
        borderWidth: Math.max(0.05, num(tableEl ?? drawEl, 'linewidth', 30) / MM),
        borderColor: rgbToHex(tableEl?.getAttribute('linecolor') || colorEl?.getAttribute('colors')?.split(',')[0], '#000000')
      } as TableObj
    }
    case 'drawrfid': {
      const rfidEl = drawEl.querySelector('rfid')
      const rawBank = (rfidEl?.getAttribute('bank') || rfidEl?.getAttribute('memory') || 'EPC').toUpperCase()
      const bank = rawBank === 'USER' || rawBank === 'TID' ? rawBank : 'EPC'
      warnings.push('RFID 对象 ' + id + ' 已导入基础写入参数，请按目标打印机核对区段和锁定策略')
      return {
        ...base,
        type: 'rfid',
        bank,
        source: varSource ?? { kind: 'constant', value: '' },
        lock: num(rfidEl, 'lock', 0) !== 0,
        readerType: rfidEl?.getAttribute('readertype') || rfidEl?.getAttribute('reader') || undefined,
        startBlock: Math.max(0, Math.floor(num(rfidEl, 'startblock', 0))),
        dataType: rfidEl?.getAttribute('datatype') === 'hex' ? 'hex' : 'ascii'
      } as RfidObj
    }
    default:
      warnings.push('未知对象类型「' + type + '」已跳过')
      return null
  }
}
