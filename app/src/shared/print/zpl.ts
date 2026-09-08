// ---------- ZPL（Zebra 及兼容机指令集） ----------
import type { BarcodeObj, DataCtx, LabelDoc, PrinterConfig, RfidObj, TableObj, TextObj } from '../model'
import { resolveObjectText } from '../model'
import { mm2dot } from './geometry'
import { zplGfaCommand } from './bitmap'

const ZPL_SYM: Record<string, string> = {
  code128: 'C', // ^BC
  ean13: 'E', // ^BE
  ean8: '8', // ^B8
  upca: 'U', // ^BU
  upce: '9', // ^B9
  code39: '3', // ^B3
  code93: 'I', // ^BI
  itf14: '2', // ^B2
  interleaved2of5: '2', // ^B2
  codabar: 'K', // ^BK
  qrcode: 'Q', // ^BQ
  datamatrix: 'D', // ^BD
  pdf417: '7' // ^B7
}

/** 旋转角 → ZPL 旋转字符 */
function rotChar(d: number): string {
  const r = (((Math.round(d / 90) % 4) + 4) % 4) * 90
  return r === 0 ? 'N' : r === 90 ? 'R' : r === 180 ? 'I' : 'B'
}

/** ZPL 字段数据转义（^ ~ 需 ^^ ~~ 转义） */
function fd(s: string): string {
  return s.replace(/\^/g, '^^').replace(/~/g, '~~')
}

export function buildZPL(doc: LabelDoc, printer: PrinterConfig, ctx: DataCtx, warnings: string[]): string {
  const d = printer.dpi
  const L: string[] = []
  L.push('^XA')
  L.push(`^PW${mm2dot(doc.widthMm, d)}`)
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
  for (const obj of doc.objects) {
    if (obj.visible === false) continue
    if (obj.type === 'text') {
      const t = zplText(obj, d, ctx, warnings)
      if (t) L.push(t)
    } else if (obj.type === 'barcode') {
      const b = zplBarcode(obj, d, ctx, warnings)
      if (b) L.push(b)
    } else if (obj.type === 'rfid') {
      const r = zplRfid(obj, d, ctx, warnings)
      if (r) L.push(r)
    } else if (obj.type === 'rect') {
      L.push(
        `^FO${mm2dot(obj.x, d)},${mm2dot(obj.y, d)}^GB${mm2dot(obj.w, d)},${mm2dot(obj.h, d)},${mm2dot(Math.max(0.1, obj.strokeWidth), d)}^FS`
      )
    } else if (obj.type === 'line') {
      const thick = mm2dot(Math.max(0.1, obj.strokeWidth), d)
      if (obj.w >= obj.h) L.push(`^FO${mm2dot(obj.x, d)},${mm2dot(obj.y, d)}^GB${mm2dot(obj.w, d)},${thick},${thick}^FS`)
      else L.push(`^FO${mm2dot(obj.x, d)},${mm2dot(obj.y, d)}^GB${thick},${mm2dot(obj.h, d)},${thick}^FS`)
    } else if (obj.type === 'table') {
      zplTable(obj, d, L)
    } else if (obj.type === 'ellipse') {
      warnings.push('ZPL 无椭圆指令，已跳过（驱动打印模式可输出）')
    } else if (obj.type === 'image') {
      const mono = ctx.images?.[obj.id]
      if (mono) {
        L.push(zplGfaCommand(mm2dot(obj.x, d), mm2dot(obj.y, d), mono))
      } else {
        warnings.push('图片对象在指令打印中需下载位图（P1.2 实现），已跳过')
      }
    }
  }
  L.push('^XZ')
  return L.join('\n')
}

function zplText(obj: TextObj, d: number, ctx: DataCtx, warnings: string[]): string {
  const text = resolveObjectText(obj, ctx)
  if (!text) return ''
  // 弧形文字：位图回退
  if (obj.arc) {
    const mono = ctx.images?.[obj.id]
    if (mono) {
      return zplGfaCommand(mm2dot(obj.x, d), mm2dot(obj.y, d), mono)
    }
    warnings.push('弧形文字在 ZPL 需下载位图，已跳过')
    return ''
  }
  // 含中文：若已预渲染为位图，则走 ^GFA 嵌入（更可靠，避免打印机缺中文字体）
  if (/[^\x00-\x7F]/.test(text)) {
    const mono = ctx.images?.[obj.id]
    if (mono) {
      return zplGfaCommand(mm2dot(obj.x, d), mm2dot(obj.y, d), mono)
    }
    warnings.push('含中文的文本在 ZPL 需下载中文字体（P1.2），当前按内置字体输出')
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
  return `^FO${x},${y}^A${font}${rotChar(obj.rotation)},${h},${w}^FD${fd(text)}^FS`
}

/** RFID：Zebra ^RF 字段（需 RFID 打印头）。数据按数据源解析 */
function zplRfid(obj: RfidObj, d: number, ctx: DataCtx, warnings: string[]): string {
  const text = resolveObjectText(obj, ctx)
  if (!text) return ''
  warnings.push('RFID 写入指令随固件而异，请在真机验证')
  const L: string[] = []
  L.push(`^FO${mm2dot(obj.x, d)},${mm2dot(obj.y, d)}^RFW,H,${obj.bank},${fd(text)}^FS`)
  if (obj.lock) {
    const ap = obj.accessPwd ?? '00000000'
    L.push(`^FO${mm2dot(obj.x, d)},${mm2dot(obj.y, d)}^RFL,H,${ap}^FS`)
  }
  return L.join('\n')
}

function zplBarcode(obj: BarcodeObj, d: number, ctx: DataCtx, warnings: string[]): string {
  const text = resolveObjectText(obj, ctx)
  if (!text) return ''
  const x = mm2dot(obj.x, d)
  const y = mm2dot(obj.y, d)
  const h = mm2dot(obj.h, d)
  const r = rotChar(obj.rotation)
  if (obj.symbology === 'qrcode') {
    warnings.push('ZPL 二维码参数请在真机验证')
    return `^FO${x},${y}^BQ${r},2,3^FDMA,${fd(text)}^FS`
  }
  if (obj.symbology === 'datamatrix') {
    warnings.push('ZPL DataMatrix 参数请在真机验证')
    return `^FO${x},${y}^BD${r}^FD${fd(text)}^FS`
  }
  if (obj.symbology === 'pdf417') {
    warnings.push('ZPL PDF417 参数请在真机验证')
    return `^FO${x},${y}^B7${r},3,6,${h}^FD${fd(text)}^FS`
  }
  const type = ZPL_SYM[obj.symbology] ?? 'BC'
  return `^FO${x},${y}^BY2,3,${h}^B${type}${r},${obj.showText ? 'Y' : 'N'},N^FD${fd(text)}^FS`
}

/** 表格：外框 ^GB + 内部网格线 */
function zplTable(obj: TableObj, d: number, L: string[]): void {
  const x = mm2dot(obj.x, d)
  const y = mm2dot(obj.y, d)
  const w = mm2dot(obj.w, d)
  const h = mm2dot(obj.h, d)
  const t = mm2dot(Math.max(0.1, obj.borderWidth), d)
  L.push(`^FO${x},${y}^GB${w},${h},${t}^FS`)
  for (let i = 1; i < obj.cols; i++) {
    const cx = Math.round(x + (w * i) / obj.cols)
    L.push(`^FO${cx},${y}^GB1,${h},${t}^FS`)
  }
  for (let j = 1; j < obj.rows; j++) {
    const cy = Math.round(y + (h * j) / obj.rows)
    L.push(`^FO${x},${cy}^GB${w},1,${t}^FS`)
  }
}
