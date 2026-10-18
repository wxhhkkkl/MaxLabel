import type bwipjs from 'bwip-js'
import type { BarcodeObj } from '../../../shared/domain/objects'
import { eanCheckDigit, usesTwentyFiveOptions } from '../../../shared/domain/barcodeCharset'

type BwipModule = typeof import('bwip-js')
const MAX_TEXT_CANVAS_SIDE = 16384
const MAX_TEXT_CANVAS_PIXELS = 16 * 1024 * 1024
export type BarcodeTextStyle = Pick<BarcodeObj, 'fontFamily' | 'fontSize' | 'bold' | 'italic' | 'underline' | 'strikeout' | 'reverse' | 'fontWidthScale' | 'charSpacing'>

function readableBarcodeText(symbology: string, text: string): string {
  const dataLength = symbology === 'ean13' ? 12 : symbology === 'ean8' ? 7 : symbology === 'upca' ? 11 : symbology === 'itf14' ? 13 : undefined
  return dataLength !== undefined && text.length === dataLength && /^\d+$/.test(text) ? text + eanCheckDigit(text) : text
}

function drawHumanText(canvas: HTMLCanvasElement, text: string, pixelsPerMm: number, style: BarcodeTextStyle, options?: import('../types').BarcodeOptions, color = '#000000', transparent = false): HTMLCanvasElement {
  const output = document.createElement('canvas')
  const measure = output.getContext('2d')!
  const fontSize = Math.max(1, (style.fontSize ?? 8 * 25.4 / 72) * pixelsPerMm)
  const font = `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${fontSize}px ${JSON.stringify(style.fontFamily ?? 'Arial')}`
  measure.font = font
  const chars = Array.from(text)
  const spacing = (style.charSpacing ?? 0) * pixelsPerMm
  const widthScale = Math.max(0.1, style.fontWidthScale ?? 1)
  const textWidth = Math.max(1, measure.measureText(text).width + Math.max(0, chars.length - 1) * spacing)
  const textHeight = Math.ceil(fontSize * 1.5)
  const gap = Math.max(0, Math.round((options?.humanOffsetMm ?? 0) * pixelsPerMm))
  const width = Math.ceil(Math.max(canvas.width, textWidth * widthScale))
  const height = canvas.height + textHeight + gap
  if (!Number.isFinite(width) || !Number.isFinite(height) || width > MAX_TEXT_CANVAS_SIDE || height > MAX_TEXT_CANVAS_SIDE || width * height > MAX_TEXT_CANVAS_PIXELS) {
    throw new Error('条码文字图片尺寸超限，请减小字号、字宽、间距或导出分辨率')
  }
  output.width = width
  output.height = height
  const context = output.getContext('2d')!
  if (!transparent) { context.fillStyle = '#ffffff'; context.fillRect(0, 0, output.width, output.height) }
  const above = options?.humanPosition === 'above'
  context.drawImage(canvas, (output.width - canvas.width) / 2, above ? textHeight + gap : 0)
  const left = options?.humanAlign === 'left' ? 0 : options?.humanAlign === 'right' ? output.width - textWidth * widthScale : (output.width - textWidth * widthScale) / 2
  context.translate(left, above ? 0 : canvas.height + gap)
  context.scale(widthScale, 1)
  if (style.reverse) { context.fillStyle = color; context.fillRect(0, 0, textWidth, textHeight) }
  context.font = font
  context.fillStyle = style.reverse ? '#ffffff' : color
  context.textBaseline = 'top'
  if (spacing === 0) context.fillText(text, 0, fontSize * 0.15)
  else {
    let x = 0
    for (const char of chars) { context.fillText(char, x, fontSize * 0.15); x += context.measureText(char).width + spacing }
  }
  context.strokeStyle = context.fillStyle
  context.lineWidth = Math.max(1, fontSize / 16)
  for (const y of [style.underline ? fontSize * 1.2 : undefined, style.strikeout ? fontSize * 0.65 : undefined]) {
    if (y === undefined) continue
    context.beginPath(); context.moveTo(0, y); context.lineTo(textWidth, y); context.stroke()
  }
  return output
}

async function loadBwip(): Promise<BwipModule> {
  const module = await import('bwip-js')
  return module.default
}

/** 模10校验字符（Interleaved 2 of 5 / Code39 / Codabar 通用加权算法） */
export function mod10CheckDigit(text: string): string {
  const digits = text.replace(/[^0-9]/g, '')
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    const d = parseInt(digits[digits.length - 1 - i], 10) || 0
    sum += i % 2 === 0 ? d * 3 : d
  }
  return String((10 - (sum % 10)) % 10)
}

/** 图书馆用校验码（ISBN-13 风格加权，奇位×1 偶位×3） */
export function libraryCheckDigit(text: string): string {
  const digits = text.replace(/[^0-9]/g, '')
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    const d = parseInt(digits[i], 10) || 0
    sum += i % 2 === 0 ? d * 1 : d * 3
  }
  const c = (10 - (sum % 10)) % 10
  return c === 10 ? '0' : String(c)
}

/**
 * 根据各码制专属选项解析实际渲染用码制与文本：
 * - RSS 类型映射为对应 GS1 DataBar 变体 bcid
 * - Codabar 起始/终止符与校验字符附加到文本
 * - Code39 校验字符附加到文本
 * - 25 码（Code25 / ITF25 / Matrix25 / 中国邮政码）共用的「校验字符」选项（模10）附加到文本
 */
export function resolveBarcode(
  symbology: string,
  text: string,
  bo?: import('../types').BarcodeOptions
): { bcid: string; text: string } {
  let bcid = symbology
  let t = text
  if (symbology === 'codabar') bcid = 'rationalizedCodabar'
  if (symbology === 'databaromni' && bo?.rssType && bo.rssType !== 'omni') {
    const map: Record<string, string> = { truncated: 'databartruncated', stacked: 'databarstacked', stackedomni: 'databarstackedomni', limited: 'databarlimited' }
    bcid = map[bo.rssType] || symbology
  }
  if (symbology === 'databaromni') {
    const value = t.trim()
    if (/^\d{13,14}$/.test(value)) t = `(01)${value}`
    else if (/^01\d{13,14}$/.test(value)) t = `(01)${value.slice(2)}`
  }
  if (symbology === 'codabar') {
    const start = bo?.codabarStart ? bo.codabarStart.toUpperCase() : 'A'
    const stop = bo?.codabarStop ? bo.codabarStop.toUpperCase() : 'B'
    let body = t
    if (bo?.codabarCheck === 'mod10') body += mod10CheckDigit(t)
    else if (bo?.codabarCheck === 'library') body += libraryCheckDigit(t)
    t = start + body + stop
  }
  if (bo) {
    if (symbology === 'code39') {
      if (bo.code39Check === 'mod10') t += mod10CheckDigit(t)
      else if (bo.code39Check === 'library') t += libraryCheckDigit(t)
    } else if (usesTwentyFiveOptions(symbology) && bo.itf25Check) {
      // 帮助 label_object_page_barcode_itl25.html：25 码特殊选项包括 Code25、ITF25、
      // Matrix25 和中国邮政码，签赋LabelShop 中 25 码使用模10校验字符。
      t += mod10CheckDigit(t)
    }
  }
  return { bcid, text: t }
}

/** 将各码制专属选项映射为 bwip-js 渲染参数 */
export function toBwipOptions(symbology: string, text: string, opts?: { barcodeOptions?: import('../types').BarcodeOptions }): Record<string, unknown> {
  const bo = opts?.barcodeOptions
  const o: Record<string, unknown> = {}
  if (!bo) return o
  // 真机 `X 尺寸(&X):` 的 `固定宽度` 档（下拉最后一项）＝**不指定窄条宽度**，由对象宽度决定；
  // 其余 60 个 mil 档按 mil → mm 转发（`probe-sym-pdf417-combos.txt` combo[2]）。
  if (!bo.xSizeFixed) {
    if (bo.xSizeMm && bo.xSizeMm > 0) o.xsize = bo.xSizeMm
    else if (bo.xSizeMil && bo.xSizeMil > 0) o.xsize = bo.xSizeMil * 0.0254
  }
  if (bo.w2n && bo.w2n > 0) o.w2n = bo.w2n
  // PDF 417 的 `层数(&R):` / `列数(&C):`（真机 89 项 / 31 项下拉，`自动` = 不指定）。
  // bwip-js 的 pdf417 编码器接受 `rows` / `columns`（实测两者都会改变输出）。
  if (symbology === 'pdf417') {
    if (bo.pdf417Rows && bo.pdf417Rows > 0) o.rows = bo.pdf417Rows
    if (bo.pdf417Columns && bo.pdf417Columns > 0) o.columns = bo.pdf417Columns
  }
  if (bo.humanPosition === 'above') o.textyoffset = 1
  if (bo.humanPosition === 'none') o.includetext = false
  // 'default'（真机「供人识读字符 · 位置」的第一项）= 由码制默认决定，不额外设置
  if (bo.humanAlign) o.textxalign = bo.humanAlign
  if (bo.humanOffsetMm !== undefined) o.textyoffset = bo.humanOffsetMm
  if (bo.gs1 && (symbology === 'code128' || symbology === 'qrcode' || symbology === 'datamatrix')) o.gs1 = true
  if (symbology === 'datamatrix') o.eclevel = 'S' // DataMatrix page only exposes ECC200.
  // 纠错级别按码制校验后再转发：真机各码制的取值集不同（QR/Micro QR `L|M|Q|H`、
  // PDF 417 `自动|0…8`、汉信码 `1…4`），「自动」在真机是不设值交给编码器（`probe-sym-pdf417-combos.txt`
  // combo[4] = `自动 / 0 / 1 … 8`、`probe-sym-hanxin-combos.txt` combo[2] = `1 / 2 / 3 / 4`）。
  // 不校验就转发会把 `auto` 之类送进 bwip-js（PDF 417 期待数值）→ 这里按各码制的合法集过滤。
  if (bo.eclevel) {
    if (symbology === 'qrcode' && /^[LMQH]$/.test(bo.eclevel)) o.eclevel = bo.eclevel
    else if (symbology === 'pdf417' && /^[0-8]$/.test(bo.eclevel)) o.eclevel = bo.eclevel
    else if (symbology === 'hanxin' && /^[1-4]$/.test(bo.eclevel)) o.eclevel = bo.eclevel
    else if (symbology === 'datamatrix') o.eclevel = 'S' // ECC200
  }
  if (symbology === 'code128' && bo.charset === 'manual') o.parsefnc = true
  if (symbology === 'code39') {
    if (bo.code39Check === 'mod43') {
      o.includecheck = true
      o.includecheckintext = bo.code39Stars === false ? false : true
    }
  }
  if (bo.encoding === 'utf8') {
    o.parse = true
    o.alttext = text
  }
  // 真机「符号版本」下拉（QR 41 项 / Data Matrix 31 项 / Micro QR 5 项 / 汉信码 85 项）：
  // 选「自动」时不设 version，交给 bwip 自己算。
  if (symbology === 'qrcode' && bo.qrVersion && bo.qrVersion !== 'auto') o.version = parseInt(bo.qrVersion, 10)
  if (symbology === 'datamatrix' && bo.dmVersion && bo.dmVersion !== 'auto') o.version = parseInt(bo.dmVersion, 10)
  if (symbology === 'microqrcode' && bo.microQrVersion && bo.microQrVersion !== 'auto') {
    const map: Record<string, number> = { M1: 1, M2: 2, M3: 3, M4: 4 }
    o.version = map[bo.microQrVersion] ?? 1
  }
  if (symbology === 'hanxin' && bo.hanxinVersion && bo.hanxinVersion !== 'auto') {
    const version = parseInt(String(bo.hanxinVersion).replace(/^v/, ''), 10)
    if (Number.isFinite(version)) o.version = version
  }
  return o
}

/** 生成条码图片 dataURL（PNG） */
export async function barcodeToDataURL(symbology: string, text: string, heightMm: number, opts?: { barcodeOptions?: import('../types').BarcodeOptions; moduleWidthMm?: number; wideRatio?: number; showText?: boolean; color?: string; backgroundTransparent?: boolean; reductionMm?: number; humanTextStyle?: BarcodeTextStyle }): Promise<string> {
  try {
    const bwipjs = await loadBwip()
    const canvas = document.createElement('canvas')
    const rb = resolveBarcode(symbology, text, opts?.barcodeOptions)
    const customText = opts?.showText === true && opts.barcodeOptions?.humanPosition !== 'none' && opts.humanTextStyle !== undefined
    const xmod: Record<string, unknown> = {}
    if (opts?.moduleWidthMm && opts.moduleWidthMm > 0) xmod.xsize = opts.moduleWidthMm
    if (opts?.wideRatio && opts.wideRatio > 0) xmod.w2n = opts.wideRatio
    bwipjs.toCanvas(canvas, {
      bcid: rb.bcid,
      text: rb.text,
      scale: 8, // 像素/毫米，生成高分辨率再等比缩放
      height: Math.max(2, heightMm - (opts?.reductionMm ?? 0)),
      includetext: opts?.showText === true,
      foregroundcolor: (opts?.color ?? '#000000').replace('#', ''),
      // 透明底**不能**写成 `FFFFFF00`：bwip-js 不接受 8 位带 alpha 的颜色，会把**整张图渲染成全黑**
      // （round-63 实测：透明像素 0%、暗像素 100%，表现为「新建条码全黑」——新建的条码默认 backgroundTransparent=true）。
      // 要透明底就**不传 backgroundcolor**（bwip 会保留画布透明底：实测 透明 53.2% / 暗 46.8%，条码正常）。
      ...(opts?.backgroundTransparent ? {} : { backgroundcolor: 'FFFFFF' }),
      ...xmod,
      ...toBwipOptions(rb.bcid, rb.text, opts),
      ...(customText ? { includetext: false } : {})
    } as unknown as bwipjs.RenderOptions)
    return (customText ? drawHumanText(canvas, readableBarcodeText(symbology, rb.text), 8 * 72 / 25.4, opts!.humanTextStyle!, opts?.barcodeOptions, opts?.color, opts?.backgroundTransparent) : canvas).toDataURL('image/png')
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err))
  }
}

/** 按目标 DPI 高分辨率生成条码（用于批量导出），可含边空与内容文字，zoom 为放大倍数 */
export async function barcodeToDataURLEx(
  symbology: string,
  text: string,
  heightMm: number,
  opts: { dpi: number; zoom?: number; marginMm: number; marginTopBottomMm?: number; showText: boolean; barcodeOptions?: import('../types').BarcodeOptions; reductionMm?: number; moduleWidthMm?: number; wideRatio?: number; humanTextStyle?: BarcodeTextStyle }
): Promise<string> {
  try {
    const bwipjs = await loadBwip()
    const canvas = document.createElement('canvas')
    const scale = (opts.dpi / 25.4) * (opts.zoom ?? 1)
    const rb = resolveBarcode(symbology, text, opts.barcodeOptions)
    const customText = opts.showText && opts.barcodeOptions?.humanPosition !== 'none' && opts.humanTextStyle !== undefined
    bwipjs.toCanvas(
      canvas,
      {
        bcid: rb.bcid,
        text: rb.text,
        scale,
        height: Math.max(2, heightMm - (opts.reductionMm ?? 0)),
        includetext: opts.showText,
        backgroundcolor: 'FFFFFF',
        paddingx: opts.marginMm * scale,
        paddingy: (opts.marginTopBottomMm ?? opts.marginMm) * scale,
        ...(opts.moduleWidthMm && opts.moduleWidthMm > 0 ? { xsize: opts.moduleWidthMm } : {}),
        ...(opts.wideRatio && opts.wideRatio > 0 ? { w2n: opts.wideRatio } : {}),
        ...toBwipOptions(rb.bcid, rb.text, { barcodeOptions: opts.barcodeOptions }),
        ...(customText ? { includetext: false } : {})
      } as unknown as bwipjs.RenderOptions
    )
    return (customText ? drawHumanText(canvas, readableBarcodeText(symbology, rb.text), scale * 72 / 25.4, opts.humanTextStyle!, opts.barcodeOptions) : canvas).toDataURL('image/png')
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err))
  }
}
