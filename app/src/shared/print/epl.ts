// ---------- EPL2 指令适配器（Zebra Eltron 系；Argox PPLB / SNBC BPLE / Postek PPLE 同族） ----------
//
// 首版策略：**位图优先**。EPL2 的原生文字/条码受固件字库和码制编号影响，
// 为了保证打印与画布完全一致，文本、条码、图形全部使用预渲染对象位图，
// 通过 `GW`（Graphic Write）按十六进制点阵输出。等 golden 样本到位后再逐步
// 把简单文本/条码换成原生 `A`/`B` 指令。
//
// EPL2 相关命令：
//   N            清空图像缓冲
//   q<w>         标签宽度（点）
//   Q<h>,<gap>   标签长度、间隙（点）
//   D<0-15>      打印浓度
//   S<1-6>       打印速度
//   R<x>,<y>     参考点偏移（点）
//   GW<x>,<y>,<w>,<h>,<hex>  写点阵图（w = 每行字节数，1=黑点）
//   P<n>         打印 n 份

import type { PrinterConfig } from '../domain/printer'
import type { MonoBitmap } from '../domain/units'
import { barcodeHumanTextBlockMm, type BarcodeObj, type TextObj } from '../domain/objects'
import type { ResolvedPrintScene } from './scene'
import { pushProtocolWarning, type WarningTarget } from './warnings'

const MM_PER_INCH = 25.4

/**
 * EPL2 `B` 指令支持的 1D 码制（Zebra EPL2 / Argox PPLB / Printronix EGL 手册一致）：
 *   Code39=3、Code128=1、Code93=9、Codabar=K、Interleaved25=2；
 *   EAN-13=E30/E32/E35（+2/+5 附加码）、EAN-8=E80/E82/E85、
 *   UPC-A=UA0/UA2/UA5、UPC-E=UE0/UE2/UE5。
 */
export const EPL_NATIVE_BARCODES: ReadonlySet<string> = new Set([
  'code39', 'code128', 'code93', 'codabar', 'interleaved2of5', 'ean13', 'ean8', 'upca', 'upce'
])

/** type 前缀；EAN/UPC 再拼附加码后缀 0/2/5。 */
const EPL_BARCODE_TYPES: Record<string, string> = {
  code39: '3',
  code128: '1',
  code93: '9',
  codabar: 'K',
  interleaved2of5: '2',
  ean13: 'E3',
  ean8: 'E8',
  upca: 'UA',
  upce: 'UE'
}

const EAN_FAMILY = new Set(['ean13', 'ean8', 'upca', 'upce'])

/** EPL2 内建点阵字体（203dpi 的常见规格，其它 dpi 按比例缩放）。 */
export const EPL_NATIVE_FONTS: ReadonlySet<string> = new Set(['1', '2', '3', '4', '5'])
const EPL_FONT_METRICS: Record<string, { width: number; height: number }> = {
  '1': { width: 8, height: 12 },
  '2': { width: 10, height: 16 },
  '3': { width: 12, height: 20 },
  '4': { width: 14, height: 24 },
  '5': { width: 32, height: 48 }
}

function dots(mm: number, dpi: number): number {
  return Math.max(0, Math.round((mm / MM_PER_INCH) * dpi))
}

/** 能否用原生 B 指令（码制、旋转、内容字符、选项都必须受控）。 */
function nativeBarcodeType(bar: BarcodeObj, value: string): string | undefined {
  const base = EPL_BARCODE_TYPES[bar.symbology]
  if (!base) return undefined
  if (Math.abs(((bar.rotation ?? 0) % 360) + 360) % 360 > 0.001) return undefined
  // EPL 的引号/反斜杠/非 ASCII 需要转义或下载字库，先继续位图。
  if (!value || /[^\x20-\x7e]/.test(value) || value.includes('"') || value.includes('\\')) return undefined
  const options = bar.barcodeOptions ?? {}
  const isEan = EAN_FAMILY.has(bar.symbology)
  const allowed = new Set(['xSizeMm', 'xSizeMil', 'w2n'])
  if (isEan) allowed.add('eanAddon')
  if (Object.keys(options).some((key) => !allowed.has(key))) return undefined
  if (!isEan) return base
  const addon = options.eanAddon === '2' ? '2' : options.eanAddon === '5' ? '5' : '0'
  return base + addon
}

/** 原生 A 文字：仅显式选择 EPL 打印机字体、纯 ASCII、左对齐、无样式/旋转以外的几何处理。 */
export function eplNativeTextEligible(text: TextObj, value: string): boolean {
  if (!text.printerFont || !EPL_NATIVE_FONTS.has(text.printerFont)) return false
  if (!value || /[^\x20-\x7e]/.test(value) || value.includes('"') || value.includes('\\')) return false
  if (text.align !== 'left') return false
  if (text.bold || text.italic || text.underline || text.strikeout || text.reverse) return false
  if (text.backgroundColor) return false
  if (text.verticalAlign !== undefined && text.verticalAlign !== 'top') return false
  if (text.lineSpacing !== undefined || text.lineSpacingMm !== undefined) return false
  if (text.arc || text.textType === 'circle') return false
  if ((text.fontWidthScale ?? 1) !== 1) return false
  if ((text.charSpacing ?? 0) !== 0) return false
  if (text.flipX || text.flipY) return false
  if (!/^#(000|000000)$|^black$/i.test(text.color.trim())) return false
  const normalized = ((text.rotation % 360) + 360) % 360
  if (Math.abs(normalized - Math.round(normalized / 90) * 90) > 0.001) return false
  return true
}

/**
 * LabelShop 的 EPL 输出把每个对象的 x 统一左移 8 dot（1 mm @203dpi）：
 * 同一模板 TSPL 的 30,18 / 62,125 / 220,33 在 EPL golden 中是 22,18 / 54,125 / 212,33。
 * 这是 EPL 机型的打印原点差，按 golden 补偿才能与画布位置一致。
 */
const EPL_X_OFFSET_MM = 1

function eplObjectX(xMm: number, dpi: number): number {
  return dots(Math.max(0, xMm - EPL_X_OFFSET_MM), dpi)
}

function nativeTextCommand(text: TextObj, value: string, dpi: number): string {
  const metrics = EPL_FONT_METRICS[text.printerFont!]
  const scale = dpi / 203
  const baseHeight = metrics.height * scale
  const targetDots = (text.fontSize / MM_PER_INCH) * dpi
  const v = Math.max(1, Math.min(9, Math.round(targetDots / baseHeight)))
  const h = Math.max(1, Math.min(8, v))
  const rotation = ((Math.round(text.rotation / 90) % 4) + 4) % 4
  return `A${eplObjectX(text.x, dpi)},${dots(text.y, dpi)},${rotation},${text.printerFont},${h},${v},N,"${value}"`
}

function nativeBarcodeCommand(bar: BarcodeObj, value: string, type: string, dpi: number, human: 'B' | 'N'): string {
  const x = eplObjectX(bar.x, dpi)
  const y = dots(bar.y, dpi)
  const options = bar.barcodeOptions ?? {}
  const narrow = Math.max(1, Math.round(dots(options.xSizeMm ?? 0.254, dpi)))
  const ratio = options.w2n ?? 2
  const wide = Math.max(2, Math.min(30, Math.round(narrow * ratio)))
  const textBlockMm = bar.showText ? barcodeHumanTextBlockMm(bar, options) : 0
  const height = Math.max(1, dots(Math.max(0.1, bar.h - textBlockMm), dpi))
  return `B${x},${y},0,${type},${narrow},${wide},${height},${human},"${value}"`
}

function toHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0').toUpperCase()
  return out
}

function gwCommand(bitmap: MonoBitmap, xMm: number, yMm: number, dpi: number, shiftOrigin = true): string {
  const x = shiftOrigin ? eplObjectX(xMm, dpi) : dots(xMm, dpi)
  return `GW${x},${dots(yMm, dpi)},${bitmap.bytesPerRow},${bitmap.height},${toHex(bitmap.bytes)}`
}

export function buildEPL(
  scene: ResolvedPrintScene,
  printer: PrinterConfig,
  warnings: WarningTarget,
  pageToken = String(Math.max(0, scene.labelIndex - 1))
): string {
  const dpi = printer.dpi
  const L: string[] = []
  L.push('N')
  L.push(`q${dots(scene.widthMm, dpi)}`)
  const gapMm = printer.labelType === 'gap' ? 2 : 0
  L.push(`Q${dots(scene.heightMm, dpi)},${dots(gapMm, dpi)}`)
  L.push(`D${Math.max(0, Math.min(15, Math.round(printer.density)))}`)
  L.push(`S${Math.max(1, Math.min(6, Math.round(printer.speed)))}`)
  if (printer.topOffsetMm > 0) L.push(`R0,${dots(printer.topOffsetMm, dpi)}`)

  // 整页位图：直接输出一张 GW。
  if (scene.pageBitmap) {
    L.push(gwCommand(scene.pageBitmap, 0, 0, dpi, false))
    L.push(`P${Math.max(1, scene.copy)}`)
    return L.join('\n')
  }

  let missing = 0
  for (const primitive of scene.primitives) {
    if (primitive.kind === 'rfid') {
      pushProtocolWarning(warnings, 'epl-rfid', `EPL2 不支持 RFID 写入（对象 ${primitive.object.id}），已跳过`, 'warning')
      continue
    }
    if (primitive.kind === 'text') {
      const text = primitive.object
      if (eplNativeTextEligible(text, primitive.value)) {
        L.push(nativeTextCommand(text, primitive.value, dpi))
        continue
      }
    }
    if (primitive.kind === 'barcode') {
      const bar = primitive.object
      const type = nativeBarcodeType(bar, primitive.value)
      if (type) {
        const humanText = primitive.humanTextBitmap
        if (bar.showText && !humanText) {
          pushProtocolWarning(
            warnings,
            'epl-native-hri',
            `EPL2 条码 ${bar.id} 的供人识读文字没有预渲染位图，改由打印机固件绘制，字宽可能与画布不同`,
            'warning'
          )
        }
        // 有画布 HRI 位图时用 N 关闭固件文字，再用 GW 叠加，保证字宽/位置与画布一致。
        L.push(nativeBarcodeCommand(bar, primitive.value, type, dpi, humanText ? 'N' : (bar.showText ? 'B' : 'N')))
        if (humanText) {
          L.push(gwCommand(humanText, humanText.originXMm ?? bar.x, humanText.originYMm ?? bar.y, dpi))
        }
        continue
      }
    }
    const bitmap = 'bitmap' in primitive ? primitive.bitmap : undefined
    if (!bitmap) {
      missing++
      continue
    }
    const object = primitive.object
    L.push(gwCommand(bitmap, bitmap.originXMm ?? object.x, bitmap.originYMm ?? object.y, dpi))
  }
  if (missing > 0) {
    pushProtocolWarning(
      warnings,
      'epl-missing-bitmap',
      `EPL2 页面 ${pageToken} 有 ${missing} 个图元缺少预渲染位图，已跳过；请确认打印预览/位图生成链路`,
      'error'
    )
  }
  L.push(`P${Math.max(1, scene.copy)}`)
  return L.join('\n')
}
