import type { BarcodeOptions } from '../types'
import {
  BARCODE_PIXELS_PER_MM,
  MAX_TEXT_CANVAS_PIXELS,
  MAX_TEXT_CANVAS_SIDE,
  loadBwip,
  readableBarcodeText,
  resolveBarcode,
  toBwipOptions,
  type BarcodeTextStyle
} from '../editor/barcode'

export interface VectorBarcodeOptions {
  barcodeOptions?: BarcodeOptions
  moduleWidthMm?: number
  wideRatio?: number
  reductionMm?: number
  showText?: boolean
  color?: string
  backgroundTransparent?: boolean
  humanTextStyle?: BarcodeTextStyle
}

export interface VectorBarcodeFragment {
  markup: string
  width: number
  height: number
}

let vectorBarcodeSerial = 0

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function parseViewBox(markup: string): { width: number; height: number } {
  const match = /viewBox\s*=\s*"0\s+0\s+([\d.]+)\s+([\d.]+)"/i.exec(markup)
  if (!match) throw new Error('条码 SVG 缺少 viewBox')
  return { width: Number(match[1]), height: Number(match[2]) }
}

function namespaceIds(markup: string, prefix: string): string {
  return markup
    .replace(/\bid="([^"]+)"/g, `id="${prefix}$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${prefix}$1"`)
}

function innerSvg(markup: string): string {
  return markup.replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '')
}

interface HumanTextMetrics {
  text: string
  font: string
  fontSizePx: number
  textWidth: number
  textHeight: number
  gap: number
  above: boolean
  chars: string[]
  spacing: number
  widthScale: number
}

function measureHumanText(symbology: string, rbText: string, style: BarcodeTextStyle, options: VectorBarcodeOptions): HumanTextMetrics | null {
  if (options.showText !== true || options.barcodeOptions?.humanPosition === 'none') return null
  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) throw new Error('无法创建条码文字度量上下文')
  const text = readableBarcodeText(symbology, rbText)
  const fontSizePx = Math.max(1, (style.fontSize ?? 8 * 25.4 / 72) * BARCODE_PIXELS_PER_MM)
  const font = `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${fontSizePx}px ${JSON.stringify(style.fontFamily ?? 'Arial')}`
  measure.font = font
  const chars = Array.from(text)
  const spacing = (style.charSpacing ?? 0) * BARCODE_PIXELS_PER_MM
  const textWidth = Math.max(1, measure.measureText(text).width + Math.max(0, chars.length - 1) * spacing)
  return {
    text,
    font,
    fontSizePx,
    textWidth,
    textHeight: Math.ceil(fontSizePx * 1.5),
    gap: Math.max(0, Math.round((options.barcodeOptions?.humanOffsetMm ?? 0) * BARCODE_PIXELS_PER_MM)),
    above: options.barcodeOptions?.humanPosition === 'above',
    chars,
    spacing,
    widthScale: Math.max(0.1, style.fontWidthScale ?? 1)
  }
}

function humanTextMarkup(metrics: HumanTextMetrics, style: BarcodeTextStyle, color: string, left: number, textY: number): string {
  const family = style.fontFamily ?? 'Arial'
  const fill = style.reverse ? '#ffffff' : color
  const node = (x: number, value: string): string =>
    `<text x="${x}" y="${metrics.fontSizePx * 0.15}" font-family="${escapeXml(family)}" font-size="${metrics.fontSizePx}" font-weight="${style.bold ? 'bold' : 'normal'}" font-style="${style.italic ? 'italic' : 'normal'}" fill="${escapeXml(fill)}" dominant-baseline="text-before-edge">${escapeXml(value)}</text>`
  let body = ''
  if (metrics.spacing === 0) body = node(0, metrics.text)
  else {
    const measure = document.createElement('canvas').getContext('2d')
    if (!measure) throw new Error('无法创建条码文字度量上下文')
    measure.font = metrics.font
    let x = 0
    for (const char of metrics.chars) {
      body += node(x, char)
      x += measure.measureText(char).width + metrics.spacing
    }
  }
  const decorations = [
    style.underline ? metrics.fontSizePx * 1.2 : undefined,
    style.strikeout ? metrics.fontSizePx * 0.65 : undefined
  ]
    .filter((value): value is number => value !== undefined)
    .map((y) => `<line x1="0" y1="${y}" x2="${metrics.textWidth}" y2="${y}" stroke="${escapeXml(fill)}" stroke-width="${Math.max(1, metrics.fontSizePx / 16)}"/>`)
    .join('')
  const reverse = style.reverse
    ? `<rect x="0" y="0" width="${metrics.textWidth}" height="${metrics.textHeight}" fill="${escapeXml(color)}"/>`
    : ''
  return `<g transform="translate(${left} ${textY}) scale(${metrics.widthScale} 1)">${reverse}${body}${decorations}</g>`
}

/**
 * Vector barcode fragment for driver printing. Bars come from bwip-js SVG;
 * the human-readable text mirrors `drawHumanText`'s canvas metrics so the
 * vector and raster paths keep the same box for fit/align.
 */
export async function barcodeToSvgFragment(
  symbology: string,
  text: string,
  heightMm: number,
  options: VectorBarcodeOptions = {}
): Promise<VectorBarcodeFragment> {
  const bwipjs = await loadBwip()
  const rb = resolveBarcode(symbology, text, options.barcodeOptions)
  const metrics = options.humanTextStyle ? measureHumanText(symbology, rb.text, options.humanTextStyle, options) : null
  const customText = metrics !== null
  const xmod: Record<string, unknown> = {}
  if (options.moduleWidthMm && options.moduleWidthMm > 0) xmod.xsize = options.moduleWidthMm
  if (options.wideRatio && options.wideRatio > 0) xmod.w2n = options.wideRatio
  const toSvg = (bwipjs as unknown as { toSVG: (options: Record<string, unknown>) => string }).toSVG
  if (typeof toSvg !== 'function') throw new Error('当前 bwip-js 版本不支持矢量条码')
  const svg = toSvg({
    bcid: rb.bcid,
    text: rb.text,
    scale: 8,
    height: Math.max(2, heightMm - (options.reductionMm ?? 0)),
    includetext: customText ? false : options.showText === true,
    ...xmod,
    ...toBwipOptions(rb.bcid, rb.text, options)
  })
  const prefix = `mlvb${vectorBarcodeSerial++}_`
  const namespaced = namespaceIds(svg, prefix)
  const bar = parseViewBox(namespaced)
  const barInner = innerSvg(namespaced)
  const color = options.color ?? '#000000'
  const transparent = options.backgroundTransparent === true
  const textWidth = metrics ? metrics.textWidth * metrics.widthScale : 0
  const textExtra = metrics ? metrics.textHeight + metrics.gap : 0
  const width = Math.ceil(Math.max(bar.width, textWidth))
  const height = Math.ceil(bar.height + textExtra)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width > MAX_TEXT_CANVAS_SIDE || height > MAX_TEXT_CANVAS_SIDE || width * height > MAX_TEXT_CANVAS_PIXELS) {
    throw new Error('条码文字图片尺寸超限，请减小字号、字宽、间距或导出分辨率')
  }
  const barX = (width - bar.width) / 2
  const barY = metrics?.above ? textExtra : 0
  const textLeft = metrics
    ? options.barcodeOptions?.humanAlign === 'left'
      ? 0
      : options.barcodeOptions?.humanAlign === 'right'
        ? width - textWidth
        : (width - textWidth) / 2
    : 0
  const textY = metrics ? (metrics.above ? 0 : bar.height + metrics.gap) : 0
  const humanText = metrics ? humanTextMarkup(metrics, options.humanTextStyle!, color, textLeft, textY) : ''
  const background = transparent ? '' : `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${background}<svg x="${barX}" y="${barY}" width="${bar.width}" height="${bar.height}" viewBox="0 0 ${bar.width} ${bar.height}">${barInner}</svg>${humanText}</svg>`
  return { markup, width, height }
}
