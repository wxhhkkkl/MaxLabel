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
import { commandSetForLanguageFamily, defaultPrinterConfig, printerLanguageFamily } from '../../../shared/domain/printer'
import type { CommandSet, PrinterConfig } from '../../../shared/domain/printer'
import { MAX_IMAGE_DECOMPRESSED_BYTES } from '../../../shared/print/limits'
import { eanCheckDigit } from '../../../shared/domain/barcodeCharset'
import { PX_PER_MM } from '../../../shared/domain/units'
import { TWO_DIMENSIONAL_SYMBOLOGIES, barcodeHumanTextBlockMm, type BarcodeOptions } from '../../../shared/domain/objects'
import { validateImageDataUrl } from '../print/imageValidation'
import { matchLsdxPrinterFont } from './lsdxPrinterFonts'
import type { RectShape } from '../../../shared/domain/shapes'

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

/**
 * MaxLabel 码制编号 → bwip-js bcid。
 * 证据（2026-11-19 用本机 LabelShop 6.39 逐码制读回「条码符号类型(码制)」下拉）：
 *   1=Code 39、2=Code 128、3=EAN-13、4=Interleaved 25、5=Code 93、6=UPC-A、7=EAN-8、
 *   8=UPC-E、9=CodaBar（即前 9 项与下拉顺序一致：btype = 下标 + 1）；
 *   11=QR Code、19=China Post、20=Data Matrix、23=ITF 14。
 * 没有真机证据的编号不再猜（未知编号会告警并按 Code128 打开）。
 */
const BTYPE_MAP: Record<number, string> = {
  1: 'code39', // Code 39
  2: 'code128', // Code 128
  3: 'ean13', // EAN-13
  4: 'interleaved2of5', // Interleaved 25
  5: 'code93', // Code 93
  6: 'upca', // UPC-A
  7: 'ean8', // EAN-8
  8: 'upce', // UPC-E
  9: 'codabar', // CodaBar
  11: 'qrcode', // QR Code
  19: 'datalogic2of5', // China Post 中国邮政码
  20: 'datamatrix', // Data Matrix
  23: 'itf14' // ITF 14
}

const MM = 100 // lsdx 坐标单位：1/100mm

/**
 * 条码「特殊选项」（原版 `baroption` / `baroption2`）。
 * 枚举顺序来自 parity 分支的真机 probe（`probe-46-barcode-page-combos.txt`、
 * `probe-sym-*.txt`），只写入当前码制对应的项，避免把默认占位值带进别的码制。
 * 语义未取证的值（EAN 附加码、PDF417 行列/纠错、RSS 类型、Micro QR 等）不在这里猜。
 */
function barcodeSpecialOptions(symbology: string, drawEl: Element): BarcodeOptions {
  const opt = drawEl.querySelector('baroption')
  const opt2 = drawEl.querySelector('baroption2')
  const out: BarcodeOptions = {}
  switch (symbology) {
    case 'code128': {
      // 字符集下拉：自动 / 字符集A / 字符集B / 字符集C
      const charsets = ['auto', 'a', 'b', 'c'] as const
      const index = Math.round(num(opt, 'c128codeset', 0))
      if (charsets[index]) out.charset = charsets[index]
      if (num(opt, 'c128ean', 0) !== 0) out.gs1 = true
      break
    }
    case 'code39': {
      // 校验字符：无 / 模10校验 / 模43校验 / 图书馆用校验码
      const checks = ['none', 'mod10', 'mod43', 'library'] as const
      const index = Math.round(num(opt, 'check', 0))
      if (checks[index]) out.code39Check = checks[index]
      break
    }
    case 'codabar': {
      // 校验字符：无 / 模10校验 / 图书馆用校验码
      const checks = ['none', 'mod10', 'library'] as const
      const checkIndex = Math.round(num(opt, 'check', 0))
      if (checks[checkIndex]) out.codabarCheck = checks[checkIndex]
      // 起始符/终止符下拉：自动 + a…d（自动时不写，沿用模型默认）
      const start = Math.round(num(opt, 'codabarechar', 0))
      if (start >= 1 && start <= 4) out.codabarStart = (['a', 'b', 'c', 'd'] as const)[start - 1]
      const stop = Math.round(num(opt, 'codabarschar', 0))
      if (stop >= 1 && stop <= 4) out.codabarStop = (['a', 'b', 'c', 'd'] as const)[stop - 1]
      break
    }
    case 'interleaved2of5':
    case 'matrix2of5':
    case 'datalogic2of5': {
      // 25 码共用一组特殊选项：校验字符（模 10）
      if (num(opt, 'check', 0) !== 0) out.itf25Check = true
      break
    }
    case 'itf14': {
      // 保护框：无 / 方框 / 保护条；粗细、空白区是与 X 尺寸的比值
      const bearerModes = ['none', 'box', 'bar'] as const
      const bearer = Math.round(num(opt, 'itf14bar', 0))
      if (bearerModes[bearer]) out.itf14BearerMode = bearerModes[bearer]
      if (num(opt, 'itf14check', 0) !== 0) out.itf14Check = true
      const bearerRatio = num(opt, 'itf14barwidth', 0)
      if (bearerRatio > 0) out.itf14BearerRatio = bearerRatio
      const quietRatio = num(opt, 'itf14barspace', 0)
      if (quietRatio > 0) out.itf14QuietRatio = quietRatio
      break
    }
    case 'ean13':
    case 'ean8':
    case 'upca':
    case 'upce': {
      // 附加码下拉：无 / 2 位 / 5 位（模板库中 eanaddon="1" 对应 2 位附加码）
      const addons = ['none', '2', '5'] as const
      const index = Math.round(num(opt, 'eanaddon', 0))
      if (addons[index] && addons[index] !== 'none') out.eanAddon = addons[index]
      break
    }
    case 'qrcode': {
      // 纠错级别：L / M / Q / H；符号版本：0 = 自动，1…40
      const levels = ['L', 'M', 'Q', 'H'] as const
      const eccIndex = Math.round(num(opt2, 'qrecc', 1))
      if (levels[eccIndex]) out.eclevel = levels[eccIndex]
      const version = Math.round(num(opt2, 'qrver', 0))
      if (version >= 1 && version <= 40) out.qrVersion = String(version)
      // 字符编码：codepage=65001 是 UTF-8（模板库里 UTF-8 二维码的存法）
      if (opt2?.getAttribute('codepage') === '65001') out.encoding = 'utf8'
      break
    }
    case 'datamatrix':
    case 'hanxin': {
      // 字符编码：codepage=65001 是 UTF-8
      if (opt2?.getAttribute('codepage') === '65001') out.encoding = 'utf8'
      break
    }
  }
  return out
}

/** 真机旋转下拉的保存值不是数字：none/right/invert/left 分别对应 0/90/180/270 度。 */
const ROTATION_NAMES: Record<string, number> = { none: 0, right: 90, invert: 180, left: 270 }

function rotToDeg(r: string | null): number {
  const key = (r ?? '').trim().toLowerCase()
  let labelShopDeg = 0
  if (key in ROTATION_NAMES) labelShopDeg = ROTATION_NAMES[key]
  else {
    const v = Number(key)
    if (!Number.isFinite(v)) return 0
    // 老版本（labelshopdocument version 1.5，如模板库 11.1125 系列）把旋转存成
    // 档位下标 0/1/2/3；其二维码缩略图证实 rotation="2" 是 180°（定位角转到右上/右下/左下）。
    labelShopDeg = Number.isInteger(v) && v >= 0 && v <= 3 ? v * 90 : v
  }
  // LabelShop 的旋转下拉是**逆时针**角度：实测同一对象 270° 时画布上等价 90° 顺时针，
  // 改成 90° 后等价 90° 逆时针。编辑器 / Fabric / 打印机指令统一用顺时针角度，
  // 所以导入时换算成 360 - angle；否则旋转对象会整体反 180°（本次 76.30 顺丰面单的根因）。
  return ((360 - (labelShopDeg % 360)) % 360 + 360) % 360
}

/**
 * .lsdx 的 drawobj left/top/right/bottom 是**旋转后的显示包围盒**：
 * 一个「竖排」文字对象存成 19×114mm 的高框，旋转属性再让文字在框内转 90°。
 * MaxLabel 的模型是「未旋转框 + 绕原点旋转」，所以要把显示框反算回未旋转框：
 * 90°/270° 交换宽高，再按对齐原点求出未旋转框的左上角。
 *
 * 证据：76.30 顺丰面单（v1.5）中 `新舒颜修护洁面乳` 存 19.39×114.11mm / rotation=left，
 * LabelShop 画布上正好占这个竖框；按旧逻辑把竖框再转 90° 会变成横跨标签的巨条。
 */
function unrotateLsdxBox(
  left: number,
  top: number,
  right: number,
  bottom: number,
  rotation: number
): { x: number; y: number; w: number; h: number } {
  const displayW = Math.max(0.01, right - left)
  const displayH = Math.max(0.01, bottom - top)
  // MaxLabel 的 makeObject 统一绕「模型框中心」旋转（rotateAroundModelCenter），
  // 所以未旋转框与显示框同心；90°/270° 交换宽高即可。
  const swapped = rotation === 90 || rotation === 270
  const w = swapped ? displayH : displayW
  const h = swapped ? displayW : displayH
  const cx = (left + right) / 2
  const cy = (top + bottom) / 2
  return {
    x: round2(cx - w / 2),
    y: round2(cy - h / 2),
    w: round2(w),
    h: round2(h)
  }
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

/**
 * 用浏览器实测文本宽度（毫米，已含 fontWidthScale 的视觉宽度）。原版 .lsdx 的文字框是
 * GDI 按字宽自动收紧的包围盒，GDI 与浏览器的字形推进有细微差异（实测最多约 3%），
 * 多行文本严格按框宽折行会把末尾的词挤到下一行、压住下面的对象。量不到（无 DOM / 无
 * canvas，例如 Node 单测）时返回 null，调用方保留原框宽。
 */
function measureTextWidthMm(
  text: string,
  style: { fontSizeMm: number; fontFamily: string; bold: boolean; italic: boolean; fontWidthScale: number }
): number | null {
  try {
    if (!text || typeof document === 'undefined') return null
    const context = document.createElement('canvas').getContext('2d')
    if (!context) return null
    context.font = `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${Math.max(1, style.fontSizeMm * PX_PER_MM)}px ${style.fontFamily}`
    const longest = text.split(/\r?\n/).reduce((max, line) => Math.max(max, context.measureText(line).width), 0)
    return Number.isFinite(longest) && longest > 0 ? (longest / PX_PER_MM) * style.fontWidthScale : null
  } catch {
    return null
  }
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

/**
 * 原版保存的打印机名 → 指令集。同族机型复用现有引擎（EZPL/GPLZ/BPLZ→ZPL、PPLA/BPLA→TSPL 等）；
 * 无法识别的私有指令集按 TSPL 绑定并告警，避免静默按错误协议打印。
 */
function commandSetFromPrinterName(name: string, warnings: string[]): CommandSet {
  const family = printerLanguageFamily(name)
  const driver = commandSetForLanguageFamily(family)
  if (driver) return driver
  if (family === 'other' && /ZEBRA|斑马/i.test(name)) return 'zpl'
  if (name) {
    const note = '打印机「' + name + '」的指令集（私有指令集）暂未支持，已按 TSPL 绑定；请勿直接打印'
    if (!warnings.includes(note)) warnings.push(note)
  }
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

/**
 * EAN/UPC/ITF14 的校验位修正：真机模板里存在校验位与内容不符的常量条码。
 * 导入时保留原码制，按前 dataChars 位重算末位，而不是把整条码退成 Code128。
 */
function normalizeEanCheckDigit(symbology: string, value: string): { value: string; corrected: boolean; message?: string } {
  const dataLength = symbology === 'ean13' ? 12 : symbology === 'ean8' ? 7 : symbology === 'upca' ? 11 : symbology === 'itf14' ? 13 : undefined
  if (dataLength === undefined) return { value, corrected: false }
  if (!/^\d+$/.test(value)) return { value, corrected: false, message: '内容不是纯数字' }
  if (value.length === dataLength) return { value, corrected: false }
  if (value.length === dataLength + 1) {
    const expected = eanCheckDigit(value.slice(0, dataLength))
    if (value.slice(-1) === expected) return { value, corrected: false }
    return { value: value.slice(0, dataLength) + expected, corrected: true }
  }
  return { value, corrected: false, message: `需要 ${dataLength} 位数据（可加 1 位校验字符），当前 ${value.length} 位` }
}

/**
 * 原版把打印机内建字体按**驱动显示名**保存（字体名来自 LabelShop.exe 内置名单）。
 * 按名单匹配成 TSPL/ZPL 字库；同族推断和无法支持的厂商都给出明确告警。
 */
function resolveLsdxPrinterFont(face: string | null | undefined, warnings: string[]): string | undefined {
  const name = (face ?? '').trim()
  const match = matchLsdxPrinterFont(name)
  if (match?.kind === 'mapped') {
    if (match.family !== 'verified') {
      const target =
        match.family === 'tspl-family'
          ? 'TSPL/PPLA'
          : match.family === 'zpl-family'
            ? 'ZPL/EZPL'
            : match.family === 'tpcl-family'
              ? 'TPCL'
              : match.family === 'sato-family'
                ? 'SATO'
                : 'PGL'
      const note =
        '字体「' + name + '」按 ' + target + ' 同族字库 ' + match.font + ' 导入，请确认目标打印机为 ' + target
      if (!warnings.includes(note)) warnings.push(note)
    }
    return match.font
  }
  if (match?.kind === 'unsupported') {
    const note = '字体「' + name + '」属于 ' + match.brand + ' 打印机字库（' + match.reason + '），已按普通字体导入；打印前请在字体页确认'
    if (!warnings.includes(note)) warnings.push(note)
    return undefined
  }
  if (/^(GP|Gprinter|HPRT|Tsc|Zebra|Argox|Xprinter)\b/i.test(name)) {
    const note = '字体「' + name + '」是打印机内建字体，当前未识别为 TSPL/ZPL 字库，已按普通字体导入；打印前请在字体页确认'
    if (!warnings.includes(note)) warnings.push(note)
  }
  return undefined
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
  // 原版卷筒标签把行数存成上限 255（帮助：标签打印机的行数没有意义）。
  // 文档模型上限是 100，直接导入会判成「拼版行列无效」，故按 1 行/列导入并告警。
  const rawRows = labelEl ? Math.max(1, Math.floor(num(labelEl, 'rows', 1))) : 1
  const rawCols = labelEl ? Math.max(1, Math.floor(num(labelEl, 'cols', 1))) : 1
  if (rawRows > 100 || rawCols > 100) {
    warnings.push('标签行列数 ' + rawRows + '×' + rawCols + ' 超过上限（原版卷筒标签用 255 表示不限），已按 1×1 导入，请在标签格式中确认')
  }
  const layout: LabelDoc['layout'] = {
    rows: rawRows > 100 ? 1 : rawRows,
    cols: rawCols > 100 ? 1 : rawCols,
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
      if (serial.start > Number.MAX_SAFE_INTEGER) {
        // 20 位现场序列号（如 40002006117030101022）超出 JS 安全整数，模型无法无损保存；
        // 按固定文本导入并明确告警，避免整份模板打不开。
        source = { kind: 'constant', value: savedValue }
        warnings.push('序列号变量 ' + id + ' 的数值 ' + savedValue + ' 超出模型安全整数范围，已按固定文本导入；如需序列打印请在数据源页重新设置')
      } else {
        source = {
          kind: 'serial',
          prefix: serial.prefix,
          start: serial.start,
          step: Number.isFinite(num(v, 'serialstep', 1)) ? num(v, 'serialstep', 1) : 1,
          digits: serial.digits,
          current: serial.start,
          repeat,
          repeatBasis: v.getAttribute('serealreptype') === '1' ? 'label' : 'record',
          ...(v.getAttribute('serealreset') === '1' ? { resetEachRecord: true } : {}),
          // 「允许字符集」决定序列号进位时能出现哪些字符（现场样例 "0123456789"）。
          ...(v.getAttribute('serealchars') ? { charset: v.getAttribute('serealchars')! } : {})
        }
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
      const obj = await convertDrawObj(drawEl, objVarLink, variables, warnings, sourceDir, 0, state, hMm)
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
        driver: commandSetFromPrinterName(lsdxPrinterName, warnings),
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
  state: { objectCount: number },
  labelHeightMm: number
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
  // 原版「常规」页的对象名称标识（drawobj/name），只作可读标识，不参与渲染/打印。
  const objectName = (drawEl.getAttribute('name') || '').trim()
  // 「常规」页的开关存在 drawobj/style 位掩码里（真机逐项设置实测）：
  //   1=位置锁定、4=不打印输出、16=水平镜像、32=垂直镜像、256=背景不透明。
  // 默认（不带 256）是透明背景，模型用 backgroundTransparent=true 表达。
  const styleBits = Math.round(num(drawEl, 'style', 0))
  const base = {
    id: uid(),
    x: round2(x),
    y: round2(y),
    w: round2(w),
    h: round2(h),
    rotation,
    ...(styleBits & 1 ? { locked: true } : {}),
    ...(styleBits & 4 ? { suppressPrint: true } : {}),
    ...(styleBits & 16 ? { flipX: true } : {}),
    ...(styleBits & 32 ? { flipY: true } : {}),
    ...((styleBits & 256) === 0 ? { backgroundTransparent: true } : {}),
    ...(objectName ? { name: objectName } : {})
  }

  // 数据源：优先对象-变量关联，其次对象内联文本
  const varId = objVarLink.get(id)
  const varEntry = varId ? variables.get(varId) : undefined
  const varSource = varEntry?.source
  const varLimit = varEntry?.limit

  const fontEl = drawEl.querySelector('font')
  const colorEl = drawEl.querySelector('color')

  switch (type) {
    case 'drawbarcode': {
      // 与文字相同：.lsdx 的框是旋转后的显示框，先反算未旋转框再交给条码摆位。
      const barcodeBox = unrotateLsdxBox(left, top, right, bottom, rotation)
      const barcodeEl = drawEl.querySelector('barcode')
      const btype = num(barcodeEl, 'btype', 2)
      let symbology = BTYPE_MAP[btype] || 'code128'
      if (!BTYPE_MAP[btype]) warnings.push('条码对象 ' + id + ' 码制编号 ' + btype + ' 未确认，按 Code128 打开')
      // 常量条码的正文在 <text> 里；变量条码用 varSource。
      const barcodeTextEl = drawEl.querySelector('text')
      const barcodeText = barcodeTextEl
        ? (barcodeTextEl.getAttribute('str') ?? barcodeTextEl.getAttribute('text') ?? barcodeTextEl.getAttribute('value') ?? barcodeTextEl.textContent ?? '')
        : ''
      let barcodeSource = varSource ?? { kind: 'constant', value: barcodeText }
      // 保留原码制：不再按内容退回 Code128（码制编号已按真机逐项确认）。
      // 常量内容若是 EAN/UPC/ITF14 且校验位错误，按内容重算校验位；其余不匹配只告警。
      // 变量条码的保存值只是样本，打印时由数据集/序列号决定，不能拿它判断码制。
      if (barcodeSource.kind === 'constant' && barcodeSource.value) {
        const fixed = normalizeEanCheckDigit(symbology, barcodeSource.value)
        if (fixed.corrected) {
          warnings.push('条码对象 ' + id + ' 的 ' + symbology + ' 校验位已按内容修正：' + barcodeSource.value + ' → ' + fixed.value)
          barcodeSource = { ...barcodeSource, value: fixed.value }
        } else if (fixed.message) {
          warnings.push('条码对象 ' + id + ' 的内容与码制 ' + symbology + ' 不匹配（' + fixed.message + '），已保留原码制')
        }
      }
      const barcodeSample = barcodeSource.kind === 'constant' ? barcodeSource.value : (varEntry?.sample || barcodeText)
      const barwidth = num(barcodeEl, 'barwidth', 0)
      // 条宽比有两种存法：
      //  - 现场模板：wide="200/250/300"（宽窄比 ×100）；
      //  - 旧版/精简模板（如 fixtures/lsdx/minimal.lsdx）：wide=5、radio=2（直接是宽窄比）。
      const wide = num(barcodeEl, 'wide', 0)
      const radio = num(barcodeEl, 'radio', 0)
      const readable = num(barcodeEl, 'readable', 0)
      const template = barcodeEl?.getAttribute('templtestr') || ''
      const is2D = TWO_DIMENSIONAL_SYMBOLOGIES.has(symbology)
      // 原版「位置」下拉（probe-46-barcode-page-combos.txt combo[18]）：
      // 0=默认、1=无、2=条码上方、3=条码下方。现场 .lsdx 的默认值就是 3（条码下方）。
      // 旧实现按 `readable !== 0` 判断，把「默认」当成无文字、「无」反而当成有文字，方向正好相反。
      const readableIndex = Math.round(readable)
      const humanPosition: 'default' | 'none' | 'above' | 'below' =
        readableIndex === 1 ? 'none' : readableIndex === 2 ? 'above' : readableIndex === 3 ? 'below' : 'default'
      // 「对齐方式」下拉（combo[19]）：0=左齐、1=右齐、2=居中、3=撑满。
      const humanAligns = ['left', 'right', 'center', 'justify'] as const
      const humanAlign = humanAligns[Math.max(0, Math.min(3, Math.round(num(barcodeEl, 'ralign', 2))))]
      // 「垂直偏移」是供人识读文字与条码的间距，单位 1/100mm。
      const hriOffset = num(barcodeEl, 'ready', 0)
      // 「缩减量」用于压低条码高度，单位 1/100mm（模型字段 reductionMm）。
      const reduction = num(barcodeEl, 'reduction', 0)
      // 供人识读字符的字间距（baroption 同级的「字体 → 字间距」），与 drawtext 同口径 1/100mm。
      const barcodeCharExtra = num(barcodeEl, 'charextra', 0)
      // 供人识读文字的字体与文字对象同口径：font/height 是 1/100 磅、font/width 是
      // 宽度方向缩放倍数 ×10000。没有 <font> 时不写字段，沿用条码模型默认（Arial 8pt）。
      const hriFace = fontEl?.getAttribute('facename')
      const hriPrinterFont = resolveLsdxPrinterFont(hriFace, warnings)
      const hriItalic = num(fontEl, 'italic', 0) !== 0
      const hriUnderline = num(fontEl, 'underline', 0) !== 0
      const hriStrike = num(fontEl, 'steikeout', 0) !== 0
      const hriFontStyle = num(fontEl, 'style', 0)
      const hriBold = (hriFontStyle & 1) !== 0 || num(fontEl, 'weight', 0) >= 700 || fontEl?.getAttribute('bold') === '1'
      const hriReverse = (hriFontStyle & 4) !== 0
      const hriWidthRaw = num(fontEl, 'width', 0)
      const hriFontWidthScale = hriWidthRaw > 0 ? Math.max(0.1, Math.min(10, hriWidthRaw / 10000)) : 1
      const hriFontSize = fontEl ? Math.max(0.1, (num(fontEl, 'height', 800) / 100) * 25.4 / 72) : undefined
      const obj: BarcodeObj = {
        ...base,
        ...barcodeBox,
        type: 'barcode',
        symbology,
        // 二维码/矩阵码默认不输出供人识读文字（原版导入后也不带）。
        showText: !is2D && humanPosition !== 'none',
        ...(fontEl ? { fontFamily: lsdxFontFamily(fontEl.getAttribute('facename'), barcodeSample || '') } : {}),
        ...(hriPrinterFont && !is2D ? { printerFont: hriPrinterFont } : {}),
        ...(hriFontSize !== undefined ? { fontSize: hriFontSize } : {}),
        ...(fontEl ? { bold: hriBold, italic: hriItalic, underline: hriUnderline, strikeout: hriStrike, ...(hriReverse ? { reverse: true } : {}) } : {}),
        ...(fontEl && hriFontWidthScale !== 1 ? { fontWidthScale: hriFontWidthScale } : {}),
        ...(barcodeCharExtra > 0 ? { charSpacing: round2(barcodeCharExtra / MM) } : {}),
        ...(reduction > 0 ? { reductionMm: round2(reduction / MM) } : {}),
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
          w2n: (() => {
            const ratio = wide >= 100 ? round2(wide / 100) : radio > 0 && wide > 0 ? round2(wide / radio) : undefined
            // 文档校验要求 1 ≤ w2n ≤ 10；无法确认的占位值不写入，沿用默认 2。
            return ratio !== undefined && ratio >= 1 && ratio <= 10 ? ratio : undefined
          })(),
          ...(!is2D ? { humanPosition, humanAlign } : {}),
          ...(!is2D && hriOffset > 0 ? { humanOffsetMm: round2(hriOffset / MM) } : {}),
          ...barcodeSpecialOptions(symbology, drawEl)
        }
      }
      if (template) obj.charTemplate = template
      // 原版 <barcode high> 是码区高度（1/100mm），对象框高 = 码高 + 供人识读文字；
      // 复刻版的对象框是「码区 + 文字块」整高，所以按码高反推框高。否则一维码会被
      // 压矮（现场 .lsdx「30 29」：原版 3.52mm，导入后 2.08mm）。二维码的框就是码区，不变。
      const codeHeightMm = num(barcodeEl, 'high', 0) / MM
      if (codeHeightMm > 0 && !TWO_DIMENSIONAL_SYMBOLOGIES.has(symbology)) {
        const savedBottom = base.y + base.h
        obj.h = round2(codeHeightMm + (obj.showText ? barcodeHumanTextBlockMm(obj) : 0))
        // 复刻版预留的人读文字块比原版高（1.5×字号 vs 原版约 1×字号），贴底的条码框会
        // 被推出标签；原框本来在标签内时上移溢出的那一点即可，否则一个 0.3mm 的越界就会
        // 把整页逼成位图（直连打印的数据量会大很多）。
        const overflow = obj.y + obj.h - labelHeightMm
        if (savedBottom <= labelHeightMm && overflow > 0) obj.y = round2(Math.max(0, obj.y - overflow))
      }
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
      // 枚举：0=左对齐，1=右对齐，2=居中，3=撑满（帮助 label_object_page_text.html）。
      const textAlign = num(textEl, 'align', 0)
      const alignValue: TextObj['align'] =
        textAlign === 3 ? 'justify' : textAlign === 2 ? 'center' : textAlign === 1 ? 'right' : 'left'
      // 字符模板：template 开关 + templtestr 模板串（"?" 代表原数据字符）。
      const textTemplate = (textEl?.getAttribute('templtestr') || '').trim()
      const italic = num(fontEl, 'italic', 0)
      const underline = num(fontEl, 'underline', 0)
      const strike = num(fontEl, 'steikeout', 0)
      const source = varSource ?? { kind: 'constant', value }
      // 数据库变量现在保留绑定、不带内容；字体回退仍按文件里保存的样本值判断（中文要挂宋体），
      // 否则「拉丁字体 + 中文」的字体链接会在导入后丢掉。
      const displayText = source.kind === 'constant' ? source.value : (varEntry?.sample || value)
      const face = fontEl?.getAttribute('facename') ?? ''
      const printerFont = resolveLsdxPrinterFont(face, warnings)
      // style 的 bit0 是粗体，对所有字体生效（宋体没有真粗体会由浏览器合成）；
      // bit2（值 4）是「黑底白字」（模板库 55 个黑底白字版模板实测 style=5 = 粗体+反白）。
      const fontStyle = num(fontEl, 'style', 0)
      const wantsBold = (fontStyle & 1) !== 0 || num(fontEl, 'weight', 0) >= 700 || fontEl?.getAttribute('bold') === '1'
      const wantsReverse = (fontStyle & 4) !== 0
      // font/width 是真机「字体宽度方向缩放倍数(&H)」×10000：10000=1.00、8482=0.85，0=未设置。
      // 丢掉它，压扁过的字会按 1.00 打出来（字宽多出约 18%）。
      const widthRaw = num(fontEl, 'width', 0)
      const fontWidthScale = widthRaw > 0 ? Math.max(0.1, Math.min(10, widthRaw / 10000)) : 1
      // text.type：现场 .lsdx 取证 **0 = 多行、1 = 单行、2 = 圆形**（缺省按单行）。
      // 证据：需要按框宽折行的「商品名称」存 type="0"；单行短文本存 type="1"；
      // 真机 LabelShop 6.39 新建圆形文字存 type="2"（case-circle2.lsdx）。
      // text.width>0 是显式行宽。
      const rawTextType = num(textEl, 'type', 1)
      const textType: 'single' | 'multi' | 'circle' = rawTextType === 0 ? 'multi' : rawTextType === 2 ? 'circle' : 'single'
      const lineWidthRaw = num(textEl, 'width', 0)
      // 字间距（drawtext 的「字体 → 字间距」）：真机 1.50mm 存 charextra="150" → 1/100mm。
      const charExtra = num(textEl, 'charextra', 0)
      // 圆形文字参数（真机 case-circle2.lsdx）：圆半径 1/100mm，角度/弧度是度；
      // 回绕方向 0=顺时针/1=逆时针，文字方向 0=向外/1=向内。
      const circle = textType === 'circle'
        ? {
            radius: num(textEl, 'circr', 0),
            start: num(textEl, 'circstart', 0),
            extent: num(textEl, 'circradian', 0),
            way: num(textEl, 'circway', 0),
            textWay: num(textEl, 'circtw', 0)
          }
        : null
      // 多行：垂直对齐在 drawobj/tvalign（0 顶部 / 1 中间 / 2 底部），
      // 行距模式在 text/spactype（0 单倍 / 1 一倍半 / 2 两倍 / 3 自定义），自定义值在 text/spacing（1/100mm）。
      const textVertical = Math.round(num(drawEl, 'tvalign', 0))
      // .lsdx 的框是旋转后的显示框：先反算出未旋转框，字体/折行/落点都按它计算。
      const textBox = unrotateLsdxBox(left, top, right, bottom, rotation)
      const spaceType = Math.round(num(textEl, 'spactype', 0))
      const spacingRaw = num(textEl, 'spacing', 0)
      // 文字停靠在 drawobj/tpalign（0 两端 / 1 左侧 / 2 中间 / 3 右侧），仅在「撑满」时有意义。
      const textDockRaw = Math.round(num(drawEl, 'tpalign', 0))
      const textDock: TextObj['textDock'] | undefined =
        textDockRaw === 1 ? 'left' : textDockRaw === 2 ? 'center' : textDockRaw === 3 ? 'right' : undefined
      const fontFamily = lsdxFontFamily(face, displayText)
      // lsdx 的 font/height 是 1/100 磅（1200 = 12.00pt），不是 1/100mm。
      const fontSize = fontEl ? Math.max(0.5, (num(fontEl, 'height', 400) / 100) * 25.4 / 72) : Math.max(0.5, textBox.h * 0.8)
      // 原版按 GDI 字宽收紧的框装不下浏览器实测文本时，把折行宽度记成实测宽度
      // （+0.5mm 余量），保留原版的一行排版；否则浏览器会把末尾的词折到下一行，
      // 多出的行压住下面的对象（现场 .lsdx「水性快干环氧」）。
      // 只对「框高就是一行」的对象这样做：框高跨多行说明原版已经按框宽折过行，
      // 再放宽会把原本的多行排版拉开、盖住相邻对象。
      const singleLineBox = textBox.h <= fontSize * 1.8
      const measuredWidth = textType === 'multi' && lineWidthRaw === 0 && singleLineBox
        ? measureTextWidthMm(displayText, { fontSizeMm: fontSize, fontFamily, bold: wantsBold, italic: italic !== 0, fontWidthScale })
        : null
      const autoLineWidth = measuredWidth !== null && measuredWidth > textBox.w ? round2(measuredWidth + 0.5) : undefined
      const obj: TextObj = {
        ...base,
        ...textBox,
        type: 'text',
        fontFamily,
        fontSize,
        bold: wantsBold,
        italic: italic !== 0,
        underline: underline !== 0,
        strikeout: strike !== 0,
        ...(wantsReverse ? { reverse: true } : {}),
        align: alignValue,
        color: rgbToHex(fontEl?.getAttribute('color'), '#000000'),
        ...(printerFont ? { printerFont } : {}),
        ...(fontWidthScale !== 1 ? { fontWidthScale } : {}),
        ...(charExtra > 0 ? { charSpacing: round2(charExtra / MM) } : {}),
        ...(textTemplate && num(textEl, 'template', 0) !== 0 ? { charTemplate: textTemplate } : {}),
        ...(textType === 'multi'
          ? {
              textType,
              ...(textVertical === 1 ? { verticalAlign: 'middle' as const } : textVertical === 2 ? { verticalAlign: 'bottom' as const } : {}),
              ...(spaceType === 1 ? { lineSpacing: 1.5 } : spaceType === 2 ? { lineSpacing: 2 } : spaceType === 3 && spacingRaw > 0 ? { lineSpacingMm: round2(spacingRaw / MM) } : {})
            }
          : textType === 'circle'
            ? {
                textType,
                arc: true,
                ...(circle && circle.radius > 0 ? { arcRadius: round2(circle.radius / MM) } : {}),
                ...(circle && circle.start !== 0 ? { arcAngle: circle.start } : {}),
                ...(circle && circle.extent > 0 ? { arcExtent: circle.extent } : {}),
                ...(circle && circle.way === 1 ? { arcDir: 'ccw' as const } : {}),
                ...(circle && circle.textWay === 1 ? { arcTextDir: 'in' as const } : {})
              }
            : {}),
        ...(textDock ? { textDock } : {}),
        ...(textType === 'multi' && lineWidthRaw > 0 ? { lineWidth: round2(lineWidthRaw / MM) } : {}),
        ...(autoLineWidth !== undefined ? { lineWidth: autoLineWidth } : {}),
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
      // 真机「方框和圆形属性」的「形状」下拉：矩形 / 圆角矩形 / 椭圆。
      // 现场 .lsdx 把椭圆存成 <drawrect><rect type="ellipse"/>（test123 的 id=17），
      // 圆角矩形存 type="roundrect" + roundness="200,200"（1/100mm）。
      const shapeAttr = (rectEl?.getAttribute('type') || '').toLowerCase()
      const shape: RectShape = shapeAttr === 'ellipse' ? 'ellipse' : shapeAttr === 'roundrect' ? 'roundRect' : 'rect'
      // 「填充方框内部」存 fill="solid" + fillcolor（填充色）；未填充时没有 fill 属性。
      const filled = rectEl?.getAttribute('fill') === 'solid' || rectEl?.getAttribute('filled') === '1'
      const fill = filled ? rgbToHex(rectEl?.getAttribute('fillcolor'), '#ffffff') : 'transparent'
      const roundness = Number.parseFloat((rectEl?.getAttribute('roundness') || '').split(',')[0])
      const cornerRadius = shape === 'roundRect' && Number.isFinite(roundness) && roundness > 0 ? round2(roundness / MM) : undefined
      const obj: RectObj = {
        ...base,
        type: 'rect',
        ...(shape !== 'rect' ? { shape } : {}),
        ...(cornerRadius !== undefined ? { cornerRadius } : {}),
        ...(filled ? { fillEnabled: true } : {}),
        fill,
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
        const c = await convertDrawObj(child, objVarLink, variables, warnings, sourceDir, depth + 1, state, labelHeightMm)
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
      // 真机「图片」页（case-general.lsdx 实测）：
      //   缩放方式 0 原始尺寸 / 1 比例缩放 / 2 适合边框 / 3 保持边框尺寸
      //   对齐方式 0 中心 / 1 左上 / 2 上中 / 3 右上 / 4 右中 / 5 右下 / 6 下中 / 7 左下 / 8 左中
      //   无效图片 0 终止打印 / 1 询问 / 2 打印标记 / 3 全部忽略
      const fitValues = ['original', 'scale', 'fit', 'fitBox'] as const
      const alignValues = ['center', 'topLeft', 'topCenter', 'topRight', 'middleRight', 'bottomRight', 'bottomCenter', 'bottomLeft', 'middleLeft'] as const
      const onerr = Math.round(num(picEl, 'onerr', 0))
      const imageOptions = {
        imageFit: fitValues[Math.max(0, Math.min(3, Math.round(num(picEl, 'scale', 1))))],
        keepAspect: num(picEl, 'keep', 1) !== 0,
        imageAlign: alignValues[Math.max(0, Math.min(8, Math.round(num(picEl, 'dbalign', 0))))],
        missingImage: onerr === 3 ? 'skip' as const : onerr === 2 ? 'placeholder' as const : 'error' as const
      }
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
            const obj: ImageObj = { ...base, type: 'image', src, imgType: 'embed', ...imageOptions }
            return obj
          }
        }
        if (ptype === 1 && file) {
          // 链接式图片：保留链接（与真机一致），打印时再读文件；缺图由「无效图片」策略处理。
          const resolvedFile = resolvePicturePath(sourceDir, file)
          const r = (await window.maxlabel.readImage(resolvedFile)) as { ok: boolean; dataUrl?: string; message?: string }
          const obj: ImageObj = { ...base, type: 'image', src: r.ok && r.dataUrl ? r.dataUrl : '', imgType: 'link', linkPath: resolvedFile, ...imageOptions }
          if (!r.ok || !r.dataUrl) {
            warnings.push('图片对象 ' + id + ' 引用的文件当前无法读取：' + file + '（已保留链接；打印时按「无效图片」策略处理）')
          }
          return obj
        }
      } catch (e) {
        warnings.push('图片对象 ' + id + ' 图像数据解码失败：' + String((e as { message?: string }).message ?? e))
        return null
      }
      if (ptype === 2 || ptype === 3) {
        // 数据源图片 / 目录中的文件：图片文件名来自绑定的变量，file 是图片路径或所在目录。
        // 保留对象框、目录与数据绑定（不再丢弃），打印前由用户确认目录/数据集。
        const fileLike = /\.(png|jpe?g|gif|bmp|webp|tiff?)$/i.test(file)
        const dir = file ? (fileLike ? directoryOf(file) : file) : ''
        const obj: ImageObj = {
          ...base,
          type: 'image',
          src: '',
          imgType: 'datasource',
          ...(dir ? { linkPath: dir } : {}),
          ...(varSource ? { source: varSource } : {}),
          ...(varLimit ? { lengthLimit: varLimit } : {}),
          ...imageOptions
        }
        warnings.push('图片对象 ' + id + ' 是' + (ptype === 2 ? '数据源图片' : '目录中的文件图片') + '：已保留目录与数据绑定，打印前请确认图片目录/数据集')
        return obj
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
