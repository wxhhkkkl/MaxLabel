// ---------- TPCL 指令适配器（Toshiba TEC；TOSHIBA-TEC TPCL-N 机型） ----------
//
// 首版位图优先：文本/条码/图形全部使用预渲染对象位图，通过 `SG` 图形指令以
// 十六进制点阵输出，保证打印与画布一致。命令帧格式为 `[ESC]<命令> [LF] [NUL]`。
//
// 参考（公开 TPCL 手册）：
//   [ESC]C                          清空图像缓冲
//   [ESC]D:<宽>,<长>                标签尺寸（0.1mm，宽 4 位、长 4–5 位）
//   [ESC]SG;x,y,w,h,1,<hex>         图形（mode 1 = 十六进制，8 dots/byte）
//   [ESC]XS;I,<份数>,<拷贝>C4000    打印

import type { PrinterConfig } from '../domain/printer'
import type { MonoBitmap } from '../domain/units'
import { barcodeHumanTextBlockMm, type BarcodeObj, type TextObj } from '../domain/objects'
import type { ResolvedPrintScene } from './scene'
import { pushProtocolWarning, type WarningTarget } from './warnings'

/**
 * TPCL 原生条码码表（Toshiba B-EX/BV/B-SX 手册一致）：
 *   0=EAN8、2=ITF、3=Code39、4=NW7(Codabar)、5=EAN13、6=UPC-E、
 *   9/A=Code128、C=Code93、K=UPC-A；
 *   附加码：EAN13 7/8、UPC-E G/H、EAN8 I/J、UPC-A L/M。
 */
export const TPCL_NATIVE_BARCODES: ReadonlySet<string> = new Set([
  'ean8', 'interleaved2of5', 'code39', 'codabar', 'ean13', 'upce', 'code128', 'code93', 'upca'
])

const TPCL_BARCODE_TYPES: Record<string, string> = {
  ean8: '0',
  interleaved2of5: '2',
  code39: '3',
  codabar: '4',
  ean13: '5',
  upce: '6',
  code128: 'A',
  code93: 'C',
  upca: 'K'
}

/** EAN/UPC 附加码的 type 后缀表。 */
const TPCL_ADDON_TYPES: Record<string, Record<'2' | '5', string>> = {
  ean13: { '2': '7', '5': '8' },
  upce: { '2': 'G', '5': 'H' },
  ean8: { '2': 'I', '5': 'J' },
  upca: { '2': 'L', '5': 'M' }
}

/** TPCL 原生字体（A=Helvetica bold、B=比例、C/D/E/F/K 等）。 */
export const TPCL_NATIVE_FONTS: ReadonlySet<string> = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'K'])
/** 203dpi 下 Font A 的基准点阵高度（用于换算放大倍数）。 */
const TPCL_BASE_FONT_HEIGHT_DOTS = 24

// TPCL 的备用定界符 `{ 正文 | }`（LabelShop 真机 golden 即此形式）。纯 ASCII，
// 避免 ESC/NUL 经过文本输出、日志、剪贴板时被截断或转义。
function frame(body: string): string {
  return `{${body}|}`
}

// TPCL 坐标以 0.1mm 为单位；LabelShop golden 对小数做截断（30 dot→0037、62 dot→0077），
// 这里保持同样口径，避免 0.1mm 级偏移。
function mm01(mm: number): string {
  return String(Math.max(0, Math.floor(mm * 10 + 1e-6))).padStart(4, '0')
}

function toHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0').toUpperCase()
  return out
}

/** 原生 PC 文字：仅显式 TPCL 打印机字体、纯 ASCII、左对齐、无样式/旋转、黑色。 */
export function tpclNativeTextEligible(text: TextObj, value: string): boolean {
  if (!text.printerFont || !TPCL_NATIVE_FONTS.has(text.printerFont)) return false
  if (!value || /[^\x20-\x7e]/.test(value) || value.includes('\n') || value.includes('\x00')) return false
  if (text.align !== 'left') return false
  if (text.bold || text.italic || text.underline || text.strikeout || text.reverse) return false
  if (text.backgroundColor) return false
  if (text.verticalAlign !== undefined && text.verticalAlign !== 'top') return false
  if (text.lineSpacing !== undefined || text.lineSpacingMm !== undefined) return false
  if (text.arc || text.textType === 'circle') return false
  if ((text.fontWidthScale ?? 1) !== 1) return false
  if ((text.charSpacing ?? 0) !== 0) return false
  if (text.flipX || text.flipY) return false
  if (Math.abs(((text.rotation % 360) + 360) % 360) > 0.001) return false
  if (!/^#(000|000000)$|^black$/i.test(text.color.trim())) return false
  return true
}

function tpclTextCommand(field: string, text: TextObj, value: string, dpi: number): string {
  const targetDots = (text.fontSize / 25.4) * dpi
  const base = TPCL_BASE_FONT_HEIGHT_DOTS * (dpi / 203)
  // 1=0.5×、2=1×、3=1.5× … 7=3.5×
  const magnitude = Math.max(1, Math.min(7, Math.round((targetDots / base) * 2)))
  return frame(`PC${field};${mm01(text.x)},${mm01(text.y)},${magnitude},${magnitude},${text.printerFont},00,B=${value}`)
}

function tpclBarcodeType(bar: BarcodeObj, value: string): string | undefined {
  const base = TPCL_BARCODE_TYPES[bar.symbology]
  if (!base) return undefined
  if (Math.abs(((bar.rotation ?? 0) % 360 + 360) % 360) > 0.001) return undefined
  if (!value || /[^\x20-\x7e]/.test(value) || value.includes('\n') || value.includes('\x00')) return undefined
  const options = bar.barcodeOptions ?? {}
  const isEan = Object.prototype.hasOwnProperty.call(TPCL_ADDON_TYPES, bar.symbology)
  const allowed = new Set(['xSizeMm', 'xSizeMil', 'w2n', 'humanPosition', 'humanAlign', 'humanOffsetMm', 'charset', 'code39Check', 'codabarCheck'])
  if (isEan) allowed.add('eanAddon')
  if (bar.symbology === 'codabar' && options.codabarCheck && options.codabarCheck !== 'none') return undefined
  if (Object.keys(options).some((key) => !allowed.has(key))) return undefined
  if (!isEan) return base
  const addon = options.eanAddon === '2' ? '2' : options.eanAddon === '5' ? '5' : undefined
  return addon ? TPCL_ADDON_TYPES[bar.symbology][addon] : base
}

/** 原生 XB 条码是否可用。 */
export function tpclNativeBarcodeEligible(bar: BarcodeObj, value: string): boolean {
  return tpclBarcodeType(bar, value) !== undefined
}

function tpclBarcodeCommands(field: string, bar: BarcodeObj, value: string, type: string, dpi: number): string[] {
  const module = Math.max(1, Math.min(15, Math.round(((bar.barcodeOptions?.xSizeMm ?? 0.254) / 25.4) * dpi)))
  const textBlockMm = bar.showText ? barcodeHumanTextBlockMm(bar, bar.barcodeOptions) : 0
  const height = Math.max(1, Math.min(9999, Math.round(Math.max(0.1, bar.h - textBlockMm) * 10)))
  // 真机 golden：Code128 纯数字偶数长度时用 >5 显式 Start Code C。
  const data = bar.symbology === 'code128' && /^\d+$/.test(value) && value.length % 2 === 0
    ? '>5' + value
    : bar.symbology === 'codabar'
      ? `${(bar.barcodeOptions?.codabarStart ?? 'a').toUpperCase()}${value}${(bar.barcodeOptions?.codabarStop ?? 'a').toUpperCase()}`
      : value
  return [frame(`XB${field};${mm01(bar.x)},${mm01(bar.y)},${type},1,${String(module).padStart(2, '0')},0,${String(height).padStart(4, '0')},+0000000000,000,0,00=${data}`)]
}

function sgCommand(bitmap: MonoBitmap, xMm: number, yMm: number): string {
  const width = String(Math.max(8, bitmap.width)).padStart(4, '0')
  const height = String(bitmap.height).padStart(4, '0')
  // mode 1：十六进制、8 dots/byte、覆盖写。
  return frame(`SG;${mm01(xMm)},${mm01(yMm)},${width},${height},1,${toHex(bitmap.bytes)}`)
}

export function buildTPCL(
  scene: ResolvedPrintScene,
  printer: PrinterConfig,
  warnings: WarningTarget,
  pageToken = String(Math.max(0, scene.labelIndex - 1))
): string {
  const dpi = printer.dpi
  let fieldNo = 0
  const nextField = () => {
    const field = String(fieldNo).padStart(2, '0')
    fieldNo = (fieldNo + 1) % 100
    return field
  }
  const L: string[] = []
  // D 命令参数（0.1mm）：标签间距（标签高 + 间隙）、有效打印宽度、有效打印长度。
  // golden（D0230 = 20mm 标签 + 3mm 间隙）确认 TPCL 默认间隙为 3mm。
  const gapMm = printer.labelType === 'gap' ? 3 : 0
  L.push(frame(`D${mm01(scene.heightMm + gapMm)},${mm01(scene.widthMm)},${mm01(scene.heightMm)}`))
  L.push(frame('C'))

  if (scene.pageBitmap) {
    L.push(sgCommand(scene.pageBitmap, 0, 0))
    for (const primitive of scene.primitives) {
      if (!primitive.overlayNative || primitive.kind !== 'barcode') continue
      const type = tpclBarcodeType(primitive.object, primitive.value)
      if (type) L.push(...tpclBarcodeCommands(nextField(), primitive.object, primitive.value, type, dpi))
    }
    L.push(frame(`XS;I,0001,${String(Math.max(1, scene.copy)).padStart(4, '0')}C4000`))
    return L.join('')
  }

  let missing = 0
  for (const primitive of scene.primitives) {
    if (primitive.kind === 'rfid') {
      pushProtocolWarning(warnings, 'tpcl-rfid', `TPCL 不支持 RFID 写入（对象 ${primitive.object.id}），已跳过`, 'warning')
      continue
    }
    if (primitive.kind === 'text') {
      const text = primitive.object
      if (tpclNativeTextEligible(text, primitive.value)) {
        L.push(tpclTextCommand(nextField(), text, primitive.value, dpi))
        continue
      }
    }
    if (primitive.kind === 'barcode') {
      const bar = primitive.object
      const type = tpclBarcodeType(bar, primitive.value)
      if (type) {
        L.push(...tpclBarcodeCommands(nextField(), bar, primitive.value, type, dpi))
        // 人读文字按画布字体位图叠加；条码柱体保持原生 XB。
        const human = primitive.humanTextBitmap
        if (human) L.push(sgCommand(human, human.originXMm ?? bar.x, human.originYMm ?? bar.y))
        continue
      }
    }
    const bitmap = 'bitmap' in primitive ? primitive.bitmap : undefined
    if (!bitmap) {
      missing++
      continue
    }
    const object = primitive.object
    L.push(sgCommand(bitmap, bitmap.originXMm ?? object.x, bitmap.originYMm ?? object.y))
  }
  if (missing > 0) {
    pushProtocolWarning(
      warnings,
      'tpcl-missing-bitmap',
      `TPCL 页面 ${pageToken} 有 ${missing} 个图元缺少预渲染位图，已跳过；请确认打印预览/位图生成链路`,
      'error'
    )
  }
  L.push(frame(`XS;I,0001,${String(Math.max(1, scene.copy)).padStart(4, '0')}C4000`))
  return L.join('')
}
