// ---------- ZPL（Zebra 及兼容机指令集） ----------
import type { BarcodeObj, RfidObj, TableObj, TextObj } from '../domain/objects'
import type { MonoBitmap } from '../domain/units'
import type { PrinterConfig } from '../domain/printer'
import { mm2dot } from './geometry'
import { zplGfaCommand } from './bitmap'
import type { ResolvedPrintScene } from './scene'
import { pushProtocolWarning, type WarningTarget } from './warnings'
import { tableColXs, tableRowYs, tableSegmentHidden } from '../table'

const ZPL_SYM: Record<string, string> = {
  code128: 'C', // ^BC
  ean13: 'E', // ^BE
  ean8: '8', // ^B8
  upca: 'U', // ^BU
  upce: '9', // ^B9
  code39: '3', // ^B3
  code93: 'A', // ^BA
  itf14: '2', // ^B2
  interleaved2of5: '2', // ^B2
  codabar: 'K', // ^BK
  qrcode: 'Q', // ^BQ
  datamatrix: 'X', // ^BX
  pdf417: '7' // ^B7
}

/** 旋转角 → ZPL 旋转字符 */
function rotChar(d: number): string {
  const r = (((Math.round(d / 90) % 4) + 4) % 4) * 90
  return r === 0 ? 'N' : r === 90 ? 'R' : r === 180 ? 'I' : 'B'
}

/** 搭配 ^FH\ 使用十六进制转义字段分隔符，避免数据提前结束命令。 */
function fd(s: string): string {
  return s.replace(/\\/g, '\\5C').replace(/\^/g, '\\5E').replace(/~/g, '\\7E').replace(/[\r\n]/g, ' ')
}

function field(data: string): string {
  return `^FH\\^FD${fd(data)}^FS`
}

export function buildZPL(scene: ResolvedPrintScene, printer: PrinterConfig, warnings: WarningTarget): string {
  const d = printer.dpi
  const L: string[] = []
  L.push('^XA')
  L.push(`^PW${mm2dot(scene.widthMm, d)}`)
  L.push(`^LL${mm2dot(scene.heightMm, d)},Y`)
  L.push(`^PR${printer.speed}`)
  // 浓度映射：density 1-15 → ^MD -30..30
  L.push(`^MD${Math.max(-30, Math.min(30, Math.round((printer.density - 8) * 2)))}`)
  L.push(`^MT${printer.printMode === 'transfer' ? 'T' : 'D'}`)
  if (printer.labelType === 'gap') L.push('^MNY')
  else if (printer.labelType === 'mark') L.push('^MNM')
  else L.push('^MNN')
  if (printer.mediaHandle === 'tear') L.push('^MMT')
  else if (printer.mediaHandle === 'peel') L.push('^MMP')
  else if (printer.mediaHandle === 'cut') L.push('^MMC')
  L.push(`^LT${mm2dot(printer.topOffsetMm, d)}`)
  L.push('^LH0,0')
  if (scene.pageBitmap) L.push(zplGfaCommand(0, 0, scene.pageBitmap))
  for (const primitive of scene.primitives) {
    if (scene.pageBitmap && primitive.kind !== 'rfid') continue
    if (primitive.kind === 'text') {
      const t = zplText(primitive.object, primitive.value, primitive.bitmap, d, warnings)
      if (t) L.push(t)
    } else if (primitive.kind === 'barcode') {
      const b = zplBarcode(primitive.object, primitive.value, d, warnings)
      if (b) L.push(b)
    } else if (primitive.kind === 'rfid') {
      const r = zplRfid(primitive.object, primitive.value, d, warnings)
      if (r) L.push(r)
    } else if (primitive.kind === 'rect') {
      const obj = primitive.object
      L.push(
        `^FO${mm2dot(obj.x, d)},${mm2dot(obj.y, d)}^GB${mm2dot(obj.w, d)},${mm2dot(obj.h, d)},${mm2dot(Math.max(0.1, obj.strokeWidth), d)}^FS`
      )
    } else if (primitive.kind === 'line') {
      const obj = primitive.object
      const thick = mm2dot(Math.max(0.1, obj.strokeWidth), d)
      if (obj.w >= obj.h) L.push(`^FO${mm2dot(obj.x, d)},${mm2dot(obj.y, d)}^GB${mm2dot(obj.w, d)},${thick},${thick}^FS`)
      else L.push(`^FO${mm2dot(obj.x, d)},${mm2dot(obj.y, d)}^GB${thick},${mm2dot(obj.h, d)},${thick}^FS`)
    } else if (primitive.kind === 'table') {
      zplTable(primitive.object, d, L)
    } else if (primitive.kind === 'ellipse') {
      pushProtocolWarning(warnings, 'unsupported-ellipse', 'ZPL 无椭圆指令，已跳过（驱动打印模式可输出）', 'error')
    } else if (primitive.kind === 'image') {
      const obj = primitive.object
      const mono = primitive.bitmap
      if (mono) {
        L.push(zplGfaCommand(mm2dot(obj.x, d), mm2dot(obj.y, d), mono))
      } else {
        pushProtocolWarning(warnings, 'missing-image-bitmap', '图片对象缺少预渲染位图，ZPL 指令无法完整输出，已跳过', 'error')
      }
    }
  }
  L.push(`^PQ${scene.copy}`)
  L.push('^XZ')
  return L.join('\n')
}

function zplText(obj: TextObj, text: string, mono: MonoBitmap | undefined, d: number, warnings: WarningTarget): string {
  if (!text) return ''
  // 弧形文字：位图回退
  if (obj.arc) {
    if (mono) {
      return zplGfaCommand(mm2dot(obj.x, d), mm2dot(obj.y, d), mono)
    }
    pushProtocolWarning(warnings, 'missing-text-bitmap', '弧形文字在 ZPL 需下载位图，已跳过', 'error')
    return ''
  }
  // 含中文：若已预渲染为位图，则走 ^GFA 嵌入（更可靠，避免打印机缺中文字体）
  if (/[^\x00-\x7F]/.test(text)) {
    if (mono) {
      return zplGfaCommand(mm2dot(obj.x, d), mm2dot(obj.y, d), mono)
    }
    pushProtocolWarning(warnings, 'native-chinese-fallback', '含中文的文本缺少预渲染位图，当前按 ZPL 内置字体输出，字形可能不一致')
  }
  const h = mm2dot(obj.fontSize, d)
  const w = Math.max(1, Math.round(h * 0.55))
  let x = mm2dot(obj.x, d)
  const estWmm = (text.length * w) / (d / 25.4)
  if (obj.align === 'center') x = mm2dot(obj.x, d) + mm2dot(Math.max(0, (obj.w - estWmm) / 2), d)
  else if (obj.align === 'right') x = mm2dot(obj.x, d) + mm2dot(Math.max(0, obj.w - estWmm), d)
  const y = mm2dot(obj.y, d)
  // 打印机内建字体：^A<fontName>（A-Z / 0）；未指定用默认 A0
  const font = obj.printerFont && /^[A-Z0]$/i.test(obj.printerFont) ? obj.printerFont.toUpperCase() : '0'
  return `^FO${x},${y}^A${font}${rotChar(obj.rotation)},${h},${w}${field(text)}`
}

/** RFID：Zebra ^RF 字段（需 RFID 打印头）。数据按数据源解析 */
function zplRfid(obj: RfidObj, text: string, d: number, warnings: WarningTarget): string {
  if (!text) return ''
  pushProtocolWarning(warnings, 'rfid-firmware-dependent', 'RFID 写入指令随固件而异，请在真机验证')
  if (obj.readerType && obj.readerType !== 'auto') pushProtocolWarning(warnings, 'rfid-reader-profile-ignored', `当前 ZPL 适配器未实现读写器类型“${obj.readerType}”，已按打印机默认读写器输出`)
  if (obj.bank === 'TID') {
    pushProtocolWarning(warnings, 'rfid-read-only-bank', 'TID 区通常为只读，ZPL 已跳过写入', 'error')
    return ''
  }
  const L: string[] = []
  const raw = obj.dataType === 'ascii' || (obj.dataType !== 'hex' && !/^[0-9A-Fa-f]+$/.test(text)) ? asciiToHex(text) : text.toUpperCase()
  if (!/^[0-9A-F]*$/.test(raw) || raw.length % 2 !== 0) {
    pushProtocolWarning(warnings, 'invalid-rfid-hex', 'ZPL RFID 十六进制数据长度无效，已跳过', 'error')
    return ''
  }
  const command = obj.bank === 'EPC'
    ? '^RFW,H,,,A'
    : `^RFW,H,${Math.max(0, obj.startBlock ?? 0)},${raw.length / 2},3`
  L.push(`^FO${mm2dot(obj.x, d)},${mm2dot(obj.y, d)}${command}${field(raw)}`)
  if (obj.lock || obj.lockOp) {
    const ap = obj.accessPwd ?? '00000000'
    const op = obj.lockOp === 'unlock' ? 'U' : obj.lockOp === 'permanent' ? 'P' : 'L'
    L.push(`^RFS,H,P${field(ap)}`)
    L.push(obj.bank === 'EPC' ? `^RLM,,,${op}^FS` : `^RLM,,,,${op}^FS`)
  }
  return L.join('\n')
}

function asciiToHex(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) out += s.charCodeAt(i).toString(16).padStart(2, '0')
  return out.toUpperCase()
}

function zplBarcode(obj: BarcodeObj, text: string, d: number, warnings: WarningTarget): string {
  if (!text) return ''
  const x = mm2dot(obj.x, d)
  const y = mm2dot(obj.y, d)
  const h = mm2dot(obj.h, d)
  const r = rotChar(obj.rotation)
  if (obj.symbology === 'qrcode') {
    const cell = Math.max(1, Math.min(10, Math.round(mm2dot(obj.barcodeOptions?.xSizeMm || 0.5, d))))
    return `^FO${x},${y}^BQ${r},2,${cell}${field(`MA,${text}`)}`
  }
  if (obj.symbology === 'datamatrix') {
    const cell = Math.max(1, Math.min(100, Math.round(mm2dot(obj.barcodeOptions?.xSizeMm || 0.5, d))))
    return `^FO${x},${y}^BX${r},${cell},200${field(text)}`
  }
  if (obj.symbology === 'pdf417') {
    const ecc = Math.max(0, Math.min(8, Number(obj.barcodeOptions?.eclevel ?? 2) || 2))
    return `^FO${x},${y}^B7${r},3,${ecc},0,0,${obj.barcodeOptions?.truncated ? 'Y' : 'N'}${field(text)}`
  }
  const type = ZPL_SYM[obj.symbology]
  if (!type) {
    pushProtocolWarning(warnings, 'unsupported-barcode', `ZPL 不支持原生码制 ${obj.symbology}，已跳过`, 'error')
    return ''
  }
  const narrow = Math.max(1, Math.round(mm2dot(obj.barcodeOptions?.xSizeMm || 0.25, d)))
  const ratio = Math.max(2, Math.min(3, obj.barcodeOptions?.w2n || 2))
  const human = obj.showText ? 'Y' : 'N'
  const command = type === '3'
    ? `^B3${r},N,${h},${human},N`
    : type === 'C'
      ? `^BC${r},${h},${human},N,N`
      : `^B${type}${r},${h},${human},N`
  return `^FO${x},${y}^BY${narrow},${ratio},${h}${command}${field(text)}`
}

/** 表格：外框 ^GB + 内部网格线 */
function zplTable(obj: TableObj, d: number, L: string[]): void {
  const x = mm2dot(obj.x, d)
  const y = mm2dot(obj.y, d)
  const w = mm2dot(obj.w, d)
  const h = mm2dot(obj.h, d)
  const t = mm2dot(Math.max(0.1, obj.borderWidth), d)
  L.push(`^FO${x},${y}^GB${w},${h},${t}^FS`)
  const xs = tableColXs(obj)
  const ys = tableRowYs(obj)
  for (let i = 1; i < obj.cols; i++) {
    for (let j = 0; j < obj.rows; j++) {
      if (tableSegmentHidden(obj, j, i, 'v')) continue
      const x1 = mm2dot(obj.x + xs[i], d)
      const y1 = mm2dot(obj.y + ys[j], d)
      const height = mm2dot(ys[j + 1] - ys[j], d)
      L.push(`^FO${x1},${y1}^GB${Math.max(1, t)},${height},${t}^FS`)
    }
  }
  for (let j = 1; j < obj.rows; j++) {
    for (let i = 0; i < obj.cols; i++) {
      if (tableSegmentHidden(obj, j, i, 'h')) continue
      const x1 = mm2dot(obj.x + xs[i], d)
      const y1 = mm2dot(obj.y + ys[j], d)
      const width = mm2dot(xs[i + 1] - xs[i], d)
      L.push(`^FO${x1},${y1}^GB${width},${Math.max(1, t)},${t}^FS`)
    }
  }
}
