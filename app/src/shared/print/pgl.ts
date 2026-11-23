// ---------- PGL 指令适配器（Printronix Graphics Language） ----------
//
// 真机 golden（Printronix PGL-N）：
//   !PTX_SETUP / ENGINE-WIDTH;2480:LENGTH;787. / PTX_END
//   ~PAPER;LABELS 2;SPEED IPS 4;SLEW IPS 4;ROTATE 180
//   ~LOGO;GRAPHIC1;PCX … ~RASTEREND / END        上传 1-bit PCX
//   ~CREATE;LSFROM / SCALE;DOT;203;203
//   LOGO / 137;75;GRAPHIC1 / STOP                 放置位图
//   BARCODE / C128B;… / *data* / STOP
//   END / ~EXECUTE;LSFROM / ~REPEAT;1
//
// 文字与其它图形/码制作为 PCX LOGO 输出；偶数位纯数字 Code128 走原生 BARCODE
// （golden 已给出 C128B/XRD 数据格式与 *…* 数据定界）。PGL 的 H 单位按 0.1 英寸，
// 高度取条码对象总高（柱体 + 人读文字）。

import type { PrinterConfig } from '../domain/printer'
import type { BarcodeObj, TextObj } from '../domain/objects'
import type { ResolvedPrintScene } from './scene'
import { pushProtocolWarning, type WarningTarget } from './warnings'

/** PGL 内建 OCR 字库：golden 中 `Printronix OCR-A/B` → `C10A`/`C10B`。 */
const PGL_OCR_FONTS: Record<string, string> = { OA: 'C10A', OB: 'C10B' }

/** PGL 原生 ALPHA 文字：仅 OCR 字库、纯 ASCII、左对齐、无样式/旋转。 */
export function pglNativeTextEligible(text: TextObj, value: string): boolean {
  if (!text.printerFont || !PGL_OCR_FONTS[text.printerFont]) return false
  if (!value || /[^\x20-\x7e]/.test(value) || value.includes('*') || value.includes('\n')) return false
  if (text.align !== 'left') return false
  if (text.bold || text.italic || text.underline || text.strikeout || text.reverse) return false
  if (text.backgroundColor) return false
  if (text.verticalAlign !== undefined && text.verticalAlign !== 'top') return false
  if (text.arc || text.textType === 'circle') return false
  if ((text.fontWidthScale ?? 1) !== 1 || (text.charSpacing ?? 0) !== 0) return false
  if (text.flipX || text.flipY) return false
  if (Math.abs(((text.rotation % 360) + 360) % 360) > 0.001) return false
  return /^#(000|000000)$|^black$/i.test(text.color.trim())
}

function pglAlphaElement(text: TextObj, value: string, dpi: number): string {
  // ALPHA 参数：SR;SC;VE;HE（dot 坐标下即 y;x）。
  // LabelShop 把 OCR-A/B 字号固定为 10.6pt，VE/HE 始终为 0；这里保持同一口径。
  return `ISET;0\nALPHA\n${PGL_OCR_FONTS[text.printerFont!]};${dots(text.y, dpi)};${dots(text.x, dpi)};0;0;*${value}*\nSTOP`
}

/** 1/1000 英寸（golden：63mm → 2480，20mm → 787）。 */
function mils(mm: number): number {
  return Math.max(1, Math.round((mm / 25.4) * 1000))
}

function dots(mm: number, dpi: number): number {
  return Math.max(0, Math.round((mm / 25.4) * dpi))
}

function logoName(labelIndex: number, id: string): string {
  return `ML${labelIndex}_${id.replace(/[^A-Za-z0-9]/g, '_')}`
}

/** 原生 BARCODE 覆盖 Code128 / Code39 / Code93 / Codabar（100 份 LabelShop 参考输出实测）。 */
export const PGL_NATIVE_BARCODES: ReadonlySet<string> = new Set(['code128', 'code39', 'code93', 'codabar'])

export function pglNativeBarcodeEligible(bar: BarcodeObj, value: string): boolean {
  if (!PGL_NATIVE_BARCODES.has(bar.symbology)) return false
  if (!value || /[^\x20-\x7e]/.test(value) || value.includes('\n') || value.includes('*')) return false
  if (Math.abs(((bar.rotation ?? 0) % 360 + 360) % 360) > 0.001) return false
  const options = bar.barcodeOptions ?? {}
  const allowed = new Set(['xSizeMm', 'xSizeMil', 'w2n', 'humanPosition', 'humanAlign', 'humanOffsetMm', 'charset', 'code39Check', 'codabarStart', 'codabarStop', 'codabarCheck'])
  if (!Object.keys(options).every((key) => allowed.has(key))) return false
  // 校验字符/自定义起止符不猜 PGL 编码；退回位图。
  if (bar.symbology === 'code39' && options.code39Check && options.code39Check !== 'none') return false
  if (bar.symbology === 'codabar' && options.codabarCheck && options.codabarCheck !== 'none') return false
  return true
}

/**
 * PGL BARCODE 元素；`H` 为 0.1 英寸，数据用 `*…*` 包裹。
 * `SO`(0x0E) + `%`/`&`/`'` 分别强制 Start A/B/C；纯数字偶数长度用 Start C。
 */
function pglBarcodeElement(bar: BarcodeObj, value: string, dpi: number): string {
  const narrow = Math.max(1, Math.round(((bar.barcodeOptions?.xSizeMm ?? 0.25) / 25.4) * dpi))
  // golden/100 样本对照：XRD 的数值就是窄条点数（Codabar 允许 1）。
  const unit = Math.max(1, narrow)
  const ratio8 = [unit, unit, unit * 2, unit * 2, unit * 3, unit * 3, unit * 4, unit * 4].join(':')
  const height = Math.max(0.1, bar.h / 2.54).toFixed(2)
  let type: string
  let data = value
  let ratio: string
  switch (bar.symbology) {
    case 'code39': {
      // LabelShop：C3/9;XRD3:3:9:9（窄:窄:宽:宽，宽=窄×3）
      const wide = Math.max(unit, Math.round(unit * (bar.barcodeOptions?.w2n ?? 3)))
      type = 'C3/9'
      ratio = [unit, unit, wide, wide].join(':')
      break
    }
    case 'code93':
      // LabelShop：CODE93;XRD2:2:4:4:6:6:8:8
      type = 'CODE93'
      ratio = ratio8
      break
    case 'codabar': {
      // LabelShop：CODABAR;XRD1:1:3:3；数据自带起止符 *A…A*
      const start = (bar.barcodeOptions?.codabarStart ?? 'a').toUpperCase()
      const stop = (bar.barcodeOptions?.codabarStop ?? 'b').toUpperCase()
      type = 'CODABAR'
      ratio = [unit, unit, unit * 3, unit * 3].join(':')
      data = `${start}${value}${stop}`
      break
    }
    default: {
      type = 'C128B'
      ratio = ratio8
      // 纯数字偶数长度按 golden 显式 Start C；其它内容交给 PGL 自动子集。
      if (/^\d+$/.test(value) && value.length % 2 === 0) data = `\x0E'${value}`
    }
  }
  // PGL 的起点参数是「行;列」，SCALE;DOT 下即 y;x。
  return `BARCODE\n${type};XRD${ratio};H${height};${dots(bar.y, dpi)};${dots(bar.x, dpi)}\n*${data}*\nSTOP`
}

export function buildPGL(
  scene: ResolvedPrintScene,
  printer: PrinterConfig,
  warnings: WarningTarget,
  pageToken = String(Math.max(0, scene.labelIndex - 1))
): string {
  const dpi = printer.dpi
  const L: string[] = []
  L.push('!PTX_SETUP')
  L.push(`ENGINE-WIDTH;${mils(scene.widthMm)}:LENGTH;${mils(scene.heightMm)}.`)
  L.push('PTX_END')
  L.push('~NORMAL')
  L.push(
    `~PAPER;LABELS 1;SPEED IPS ${Math.max(1, Math.round(printer.speed))};SLEW IPS ${Math.max(1, Math.round(printer.speed))}`
  )
  L.push('~PIOFF')

  const uploads: string[] = []
  const placements: string[] = []
  const names: string[] = []
  const addLogo = (xMm: number, yMm: number, name: string, labelIndex: number, id: string): void => {
    names.push(name)
    uploads.push(`~LOGO;${name};PCX\n@@PCX:${labelIndex}:${id}@@\n~RASTEREND\nEND`)
    placements.push(`LOGO\n${dots(xMm, dpi)};${dots(yMm, dpi)};${name}\nSTOP`)
  }

  if (scene.pageBitmap) {
    addLogo(0, 0, logoName(scene.labelIndex, 'page'), scene.labelIndex, 'page')
    for (const primitive of scene.primitives) {
      if (!primitive.overlayNative || primitive.kind !== 'barcode') continue
      if (pglNativeBarcodeEligible(primitive.object, primitive.value)) {
        placements.push(pglBarcodeElement(primitive.object, primitive.value, dpi))
      }
    }
  } else {
    let missing = 0
    for (const primitive of scene.primitives) {
      if (primitive.kind === 'rfid') {
        pushProtocolWarning(warnings, 'pgl-rfid', `PGL 不支持 RFID 写入（对象 ${primitive.object.id}），已跳过`, 'warning')
        continue
      }
      if (primitive.kind === 'text' && pglNativeTextEligible(primitive.object, primitive.value)) {
        placements.push(pglAlphaElement(primitive.object, primitive.value, dpi))
        continue
      }
      if (primitive.kind === 'barcode' && pglNativeBarcodeEligible(primitive.object, primitive.value)) {
        const bar = primitive.object
        placements.push(pglBarcodeElement(bar, primitive.value, dpi))
        const humanText = primitive.humanTextBitmap
        if (humanText) {
          addLogo(
            humanText.originXMm ?? bar.x,
            humanText.originYMm ?? bar.y,
            logoName(primitive.labelIndex, `${primitive.object.id}-humantext`),
            primitive.labelIndex,
            `${primitive.object.id}-humantext`
          )
        }
        continue
      }
      const bitmap = 'bitmap' in primitive ? primitive.bitmap : undefined
      if (!bitmap) {
        missing++
        continue
      }
      addLogo(
        bitmap.originXMm ?? primitive.object.x,
        bitmap.originYMm ?? primitive.object.y,
        logoName(primitive.labelIndex, primitive.object.id),
        primitive.labelIndex,
        primitive.object.id
      )
    }
    if (missing > 0) {
      pushProtocolWarning(
        warnings,
        'pgl-missing-bitmap',
        `PGL 页面 ${pageToken} 有 ${missing} 个图元缺少预渲染位图，已跳过；请确认打印预览/位图生成链路`,
        'error'
      )
    }
  }

  for (const upload of uploads) L.push(upload)
  // 长度 0 = 变长表单，以最长图元结束（与 LabelShop 的显式长度等效，且不依赖模板尺寸）。
  L.push('~CREATE;MAXLBL;0')
  L.push(`SCALE;DOT;${dpi};${dpi}`)
  for (const placement of placements) L.push(placement)
  L.push('END')
  L.push('~EXECUTE;MAXLBL')
  L.push(`~REPEAT;${Math.max(1, scene.copy)}`)
  L.push('~NORMAL')
  L.push('~DELETE FORM;MAXLBL')
  for (const name of names) L.push(`~DELETE LOGO;${name}`)
  return L.join('\n') + '\n'
}
