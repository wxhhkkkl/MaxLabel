import type bwipjs from 'bwip-js'
import { usesTwentyFiveOptions } from '../../../shared/domain/barcodeCharset'

type BwipModule = typeof import('bwip-js')

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
  if (bo) {
    if (symbology === 'databaromni' && bo.rssType && bo.rssType !== 'omni') {
      const map: Record<string, string> = { truncated: 'databartruncated', stacked: 'databarstacked', stackedomni: 'databarstackedomni', limited: 'databarlimited' }
      bcid = map[bo.rssType] || symbology
    }
    if (symbology === 'codabar') {
      const start = bo.codabarStart ? bo.codabarStart.toUpperCase() : ''
      const stop = bo.codabarStop ? bo.codabarStop.toUpperCase() : ''
      let body = t
      if (bo.codabarCheck === 'mod10') body += mod10CheckDigit(t)
      else if (bo.codabarCheck === 'library') body += libraryCheckDigit(t)
      t = start + body + stop
    } else if (symbology === 'code39') {
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
  if (bo.xSizeMm && bo.xSizeMm > 0) o.xsize = bo.xSizeMm
  else if (bo.xSizeMil && bo.xSizeMil > 0) o.xsize = bo.xSizeMil * 0.0254
  if (bo.w2n && bo.w2n > 0) o.w2n = bo.w2n
  if (bo.humanPosition === 'above') o.textyoffset = 1
  if (bo.humanPosition === 'none') o.includetext = false
  // 'default'（真机「供人识读字符 · 位置」的第一项）= 由码制默认决定，不额外设置
  if (bo.humanAlign) o.textxalign = bo.humanAlign
  if (bo.humanOffsetMm !== undefined) o.textyoffset = bo.humanOffsetMm
  if (bo.gs1 && (symbology === 'code128' || symbology === 'qrcode' || symbology === 'datamatrix')) o.gs1 = true
  if (symbology === 'datamatrix') o.eclevel = 'S' // DataMatrix page only exposes ECC200.
  if (bo.eclevel) {
    if (symbology === 'qrcode') o.eclevel = bo.eclevel
    else if (symbology === 'pdf417') o.eclevel = bo.eclevel
    else if (symbology === 'hanxin') o.eclevel = bo.eclevel
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
export async function barcodeToDataURL(symbology: string, text: string, heightMm: number, opts?: { barcodeOptions?: import('../types').BarcodeOptions; moduleWidthMm?: number; wideRatio?: number; showText?: boolean; color?: string; backgroundTransparent?: boolean; reductionMm?: number }): Promise<string> {
  try {
    const bwipjs = await loadBwip()
    const canvas = document.createElement('canvas')
    const rb = resolveBarcode(symbology, text, opts?.barcodeOptions)
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
      ...toBwipOptions(rb.bcid, rb.text, opts)
    } as unknown as bwipjs.RenderOptions)
    return canvas.toDataURL('image/png')
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err))
  }
}

/** 按目标 DPI 高分辨率生成条码（用于批量导出），可含边空与内容文字，zoom 为放大倍数 */
export async function barcodeToDataURLEx(
  symbology: string,
  text: string,
  heightMm: number,
  opts: { dpi: number; zoom?: number; marginMm: number; marginTopBottomMm?: number; showText: boolean; barcodeOptions?: import('../types').BarcodeOptions; reductionMm?: number; moduleWidthMm?: number; wideRatio?: number }
): Promise<string> {
  try {
    const bwipjs = await loadBwip()
    const canvas = document.createElement('canvas')
    const scale = (opts.dpi / 25.4) * (opts.zoom ?? 1)
    const rb = resolveBarcode(symbology, text, opts.barcodeOptions)
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
        ...toBwipOptions(rb.bcid, rb.text, { barcodeOptions: opts.barcodeOptions })
      } as unknown as bwipjs.RenderOptions
    )
    return canvas.toDataURL('image/png')
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err))
  }
}
