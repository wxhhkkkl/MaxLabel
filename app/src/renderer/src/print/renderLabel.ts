// ---------- 独立标签渲染器 ----------
// 用于「预览」与「Windows 驱动图形打印」：以给定 DataCtx（数据库/键盘输入/序列号等）
// 渲染单张标签为 Canvas / dataURL，使可变数据在图形打印与预览中也生效。
// 编辑器（Fabric）负责交互编辑；本渲染器负责输出保真。
import bwipjs from 'bwip-js'
import { toBwipOptions, resolveBarcode } from '../editor/barcode'
import type { BarcodeObj, DataCtx, DataSource, LabelDoc, LabelObject, RfidObj, TextObj } from '../types'
import { flattenObjects, resolveObjectText, resolveObjectColor, TableObj, RectObj, EllipseObj } from '../types'
import { tableColXs, tableRowYs, tableSegmentHidden } from '../../../shared/table'

export interface RenderOptions {
  dpi: number
  ctx?: DataCtx
  background?: string
  /** 页面标签拼版（多标签布局，用于页式打印机/驱动打印） */
  layout?: { rows: number; cols: number; rowGapMm: number; colGapMm: number; printOrder?: 'row' | 'col'; startPos?: 'tl' | 'tr' | 'bl' | 'br'; offsetXMm?: number; offsetYMm?: number }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace(/^#/, '')
  if (h.length === 3) return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function colorStyle(color: string): string {
  if (!color || color === 'transparent') return 'transparent'
  const [r, g, b] = hexToRgb(color)
  return `rgb(${r},${g},${b})`
}

function setStroke(g: CanvasRenderingContext2D, color: string, widthPx: number): void {
  if (color === 'transparent') {
    g.strokeStyle = 'transparent'
    return
  }
  g.strokeStyle = colorStyle(color)
  g.lineWidth = Math.max(0.25, widthPx)
}

function drawText(g: CanvasRenderingContext2D, obj: TextObj, dpm: number, ctx?: DataCtx, sharedTable?: string[]): void {
  const text = resolveObjectText(obj, ctx)
  if (!text) return
  if (obj.arc) {
    drawArcText(g, obj, dpm, text)
    return
  }
  const fontSizePx = obj.fontSize * dpm
  g.font = `${obj.bold ? 'bold ' : ''}${fontSizePx}px ${obj.fontFamily}, sans-serif`
  g.fillStyle = colorStyle(resolveObjectColor(obj, ctx, obj.color, sharedTable))
  g.textBaseline = 'top'
  const lines = text.split('\n')
  const lineH = fontSizePx * (obj.lineSpacing ?? 1.2)
  const boxW = obj.w * dpm

  g.save()
  g.translate((obj.x + obj.w / 2) * dpm, (obj.y + obj.h / 2) * dpm)
  g.rotate((obj.rotation * Math.PI) / 180)
  // 背景颜色 / 反白（黑底白字）
  const bg = obj.reverse ? '#000000' : obj.backgroundColor
  if (bg && bg !== 'transparent') {
    g.fillStyle = colorStyle(bg)
    g.fillRect(-obj.w * dpm / 2, -obj.h * dpm / 2, obj.w * dpm, obj.h * dpm)
  }
  if (obj.reverse) g.fillStyle = '#FFFFFF'
  const ox = -obj.w * dpm / 2 // 框左边缘；每行按行宽独立计算对齐偏移
  let oy = -obj.h * dpm / 2
  const blockH = lines.length * lineH
  if (obj.verticalAlign === 'middle') oy += (obj.h * dpm - blockH) / 2
  else if (obj.verticalAlign === 'bottom') oy += obj.h * dpm - blockH
  for (let i = 0; i < lines.length; i++) {
    let lineAlignOff = 0
    if (obj.align === 'center') lineAlignOff = (boxW - g.measureText(lines[i]).width) / 2
    else if (obj.align === 'right') lineAlignOff = boxW - g.measureText(lines[i]).width
    const tx = ox + lineAlignOff
    const ty = oy + i * lineH
    g.fillText(lines[i], tx, ty)
    // 下划线 / 删除线
    const lw = Math.max(1, fontSizePx * 0.06)
    const lineW = g.measureText(lines[i]).width
    g.fillStyle = obj.reverse ? '#FFFFFF' : colorStyle(resolveObjectColor(obj, ctx, obj.color, sharedTable))
    if (obj.underline) g.fillRect(tx, ty + fontSizePx * 0.95, lineW, lw)
    if (obj.strikeout) g.fillRect(tx, ty + fontSizePx * 0.5, lineW, lw)
  }
  g.restore()
}

function drawBarcode(g: CanvasRenderingContext2D, obj: BarcodeObj, dpm: number, ctx?: DataCtx): void {
  const text = resolveObjectText(obj, ctx)
  if (!text) return
  const scale = Math.max(4, Math.round(dpm))
  try {
    const bc = document.createElement('canvas')
    const rb = resolveBarcode(obj.symbology, text, obj.barcodeOptions)
    const xmod: Record<string, unknown> = {}
    // X 尺寸（窄条宽度）与宽条比例 → bwip xsize / w2n（默认缺省由 bwip 按码高自动推算）
    const mw = (obj as { moduleWidthMm?: number }).moduleWidthMm
    const wr = (obj as { wideRatio?: number }).wideRatio
    if (mw && mw > 0) xmod.xsize = mw
    if (wr && wr > 0) xmod.w2n = wr
    bwipjs.toCanvas(bc, {
      bcid: rb.bcid,
      text: rb.text,
      scale,
      height: Math.max(2, obj.h),
      includetext: obj.showText,
      backgroundcolor: 'FFFFFF',
      ...xmod,
      ...toBwipOptions(rb.bcid, rb.text, { barcodeOptions: obj.barcodeOptions })
    } as unknown as bwipjs.RenderOptions)
    const dw = obj.w * dpm
    const dh = obj.h * dpm
    const ratio = Math.min(dw / Math.max(1, bc.width), dh / Math.max(1, bc.height))
    const drawW = bc.width * ratio
    const drawH = bc.height * ratio
    g.save()
    g.translate((obj.x + obj.w / 2) * dpm, (obj.y + obj.h / 2) * dpm)
    g.rotate((obj.rotation * Math.PI) / 180)
    g.drawImage(bc, -drawW / 2, -drawH / 2, drawW, drawH)
    g.restore()
  } catch (err) {
    // 条码生成失败：绘制占位框 + 文本，避免静默失败
    g.save()
    g.translate((obj.x + obj.w / 2) * dpm, (obj.y + obj.h / 2) * dpm)
    g.rotate((obj.rotation * Math.PI) / 180)
    g.strokeStyle = '#EA6668'
    g.lineWidth = 1
    g.strokeRect(-obj.w * dpm / 2, -obj.h * dpm / 2, obj.w * dpm, obj.h * dpm)
    g.fillStyle = '#EA6668'
    g.font = `${Math.max(8, Math.round(obj.h * dpm * 0.3))}px sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('条码错误', 0, 0)
    g.restore()
    console.error('barcode render error', obj.symbology, text, err)
  }
}

function drawRect(g: CanvasRenderingContext2D, o: RectObj, dpm: number, ctx?: DataCtx, sharedTable?: string[]): void {
  g.fillStyle = colorStyle(resolveObjectColor(o, ctx, o.fill, sharedTable))
  g.fillRect(o.x * dpm, o.y * dpm, o.w * dpm, o.h * dpm)
  if (o.stroke !== 'transparent') {
    setStroke(g, o.stroke, o.strokeWidth * dpm)
    g.strokeRect(o.x * dpm, o.y * dpm, o.w * dpm, o.h * dpm)
  }
}

function drawEllipse(g: CanvasRenderingContext2D, o: EllipseObj, dpm: number, ctx?: DataCtx, sharedTable?: string[]): void {
  const cx = (o.x + o.w / 2) * dpm
  const cy = (o.y + o.h / 2) * dpm
  const rx = (o.w * dpm) / 2
  const ry = (o.h * dpm) / 2
  g.save()
  g.beginPath()
  g.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2)
  g.fillStyle = colorStyle(resolveObjectColor(o, ctx, o.fill, sharedTable))
  g.fill()
  if (o.stroke !== 'transparent') {
    setStroke(g, o.stroke, o.strokeWidth * dpm)
    g.stroke()
  }
  g.restore()
}

function drawTable(g: CanvasRenderingContext2D, o: TableObj, dpm: number): void {
  const x = o.x * dpm
  const y = o.y * dpm
  const t = Math.max(0.5, o.borderWidth * dpm)
  const colXs = tableColXs(o).map((v) => x + v * dpm)
  const rowYs = tableRowYs(o).map((v) => y + v * dpm)
  setStroke(g, o.borderColor, t)
  g.save()
  g.strokeRect(x, y, colXs[colXs.length - 1], rowYs[rowYs.length - 1])
  for (let i = 1; i < o.cols; i++) {
    for (let j = 0; j < o.rows; j++) {
      if (tableSegmentHidden(o, j, i, 'v')) continue
      g.beginPath()
      g.moveTo(colXs[i], rowYs[j])
      g.lineTo(colXs[i], rowYs[j + 1])
      g.stroke()
    }
  }
  for (let j = 1; j < o.rows; j++) {
    for (let i = 0; i < o.cols; i++) {
      if (tableSegmentHidden(o, j, i, 'h')) continue
      g.beginPath()
      g.moveTo(colXs[i], rowYs[j])
      g.lineTo(colXs[i + 1], rowYs[j])
      g.stroke()
    }
  }
  g.restore()
}

/** 弧形文字：沿对象框顶部半圆弧排布 */
function drawArcText(g: CanvasRenderingContext2D, obj: TextObj, dpm: number, text: string): void {
  const fontSizePx = obj.fontSize * dpm
  g.save()
  g.font = `${obj.bold ? 'bold ' : ''}${fontSizePx}px ${obj.fontFamily}, sans-serif`
  g.fillStyle = colorStyle(resolveObjectColor(obj, undefined, obj.color, undefined))
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  // 圆形文字参数：半径（0=按对象宽自动）、弧度范围（默认 180°）、起始角度、回绕方向、文字方向
  const extentDeg = obj.arcExtent && obj.arcExtent > 0 ? Math.min(360, obj.arcExtent) : 180
  const startDeg = obj.arcAngle ?? 0
  const radius = (obj.arcRadius && obj.arcRadius > 0 ? obj.arcRadius : obj.w) * dpm
  const cx = obj.x * dpm
  const cy = (obj.y + obj.h / 2) * dpm
  g.translate(cx, cy)
  const cw = obj.arcDir === 'ccw' ? 1 : -1
  for (let i = 0; i < text.length; i++) {
    const t = text.length === 1 ? 0.5 : i / Math.max(1, text.length - 1)
    const ang = (-(startDeg + (cw < 0 ? t * extentDeg : -t * extentDeg)) * Math.PI) / 180
    const x = radius * Math.cos(ang)
    const y = -radius * Math.sin(ang)
    g.save()
    g.translate(x, y)
    const baseRot = ang - Math.PI / 2
    const ch = obj.arcTextDir === 'in' ? baseRot + Math.PI : baseRot
    g.rotate(ch)
    g.fillText(text[i], 0, 0)
    g.restore()
  }
  g.restore()
}

/** RFID：标签上不打印，绘制占位说明框（虚线 + 数据） */
function drawRfid(g: CanvasRenderingContext2D, obj: RfidObj, dpm: number, ctx?: DataCtx): void {
  const text = resolveObjectText(obj, ctx)
  const x = obj.x * dpm
  const y = obj.y * dpm
  const w = obj.w * dpm
  const h = obj.h * dpm
  g.save()
  g.setLineDash([4, 3])
  g.strokeStyle = '#5B8FF9'
  g.lineWidth = 1
  g.strokeRect(x, y, w, h)
  g.setLineDash([])
  g.fillStyle = '#5B8FF9'
  g.font = `${Math.max(9, Math.round(Math.min(w, h) * 0.16))}px sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('RFID ' + obj.bank + (text ? ' · ' + text : ''), x + w / 2, y + h / 2)
  g.restore()
}

async function drawImageObj(g: CanvasRenderingContext2D, o: { x: number; y: number; w: number; h: number; src: string; imgType?: string; linkPath?: string; source?: DataSource }, dpm: number, ctx?: DataCtx): Promise<void> {
  let src = o.src
  if (o.imgType === 'link' && o.linkPath) {
    try {
      const r = await window.maxlabel.readImage(o.linkPath)
      src = r.ok && r.dataUrl ? r.dataUrl : ''
    } catch {
      src = ''
    }
  } else if (o.imgType === 'datasource') {
    let name = ''
    if (o.source) {
      try {
        name = resolveObjectText({ source: o.source } as never, ctx as never)
      } catch {
        name = ''
      }
    }
    if (name) {
      const dir = o.linkPath ? o.linkPath.replace(/[\\/]+$/, '') : ''
      const full = dir ? dir + '\\' + name : name
      try {
        const r = await window.maxlabel.readImage(full)
        src = r.ok && r.dataUrl ? r.dataUrl : ''
      } catch {
        src = ''
      }
    } else {
      src = ''
    }
  }
  if (!src) return
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      g.save()
      g.translate((o.x + o.w / 2) * dpm, (o.y + o.h / 2) * dpm)
      g.drawImage(img, -o.w * dpm / 2, -o.h * dpm / 2, o.w * dpm, o.h * dpm)
      g.restore()
      resolve()
    }
    img.onerror = () => resolve()
    img.src = src
  })
}

function drawObjectInner(g: CanvasRenderingContext2D, obj: LabelObject, dpm: number, ctx?: DataCtx, sharedTable?: string[]): Promise<void> {
  switch (obj.type) {
    case 'text':
      drawText(g, obj, dpm, ctx, sharedTable)
      return Promise.resolve()
    case 'barcode':
      drawBarcode(g, obj, dpm, ctx)
      return Promise.resolve()
    case 'rfid':
      drawRfid(g, obj, dpm, ctx)
      return Promise.resolve()
    case 'rect':
      drawRect(g, obj, dpm, ctx, sharedTable)
      return Promise.resolve()
    case 'ellipse':
      drawEllipse(g, obj, dpm, ctx, sharedTable)
      return Promise.resolve()
    case 'table':
      drawTable(g, obj, dpm)
      return Promise.resolve()
    case 'line': {
      g.save()
      setStroke(g, obj.stroke, obj.strokeWidth * dpm)
      g.beginPath()
      g.moveTo(obj.x * dpm, obj.y * dpm)
      g.lineTo((obj.x + obj.w) * dpm, (obj.y + obj.h) * dpm)
      g.stroke()
      g.restore()
      return Promise.resolve()
    }
    case 'image':
      return drawImageObj(g, obj, dpm, ctx)
    case 'group':
      // 分组对象在渲染前已展平（flattenObjects），此处不应出现
      return Promise.resolve()
  }
}

function drawObject(g: CanvasRenderingContext2D, obj: LabelObject, dpm: number, ctx?: DataCtx, sharedTable?: string[]): Promise<void> {
  // 不打印输出：打印/预览时跳过该对象
  if ((obj as { suppressPrint?: boolean }).suppressPrint) return Promise.resolve()
  const flipX = (obj as { flipX?: boolean }).flipX === true
  const flipY = (obj as { flipY?: boolean }).flipY === true
  if (!flipX && !flipY) return drawObjectInner(g, obj, dpm, ctx, sharedTable)
  // 镜像：以对象中心为基准翻转画布后渲染
  const cx = (obj.x + obj.w / 2) * dpm
  const cy = (obj.y + obj.h / 2) * dpm
  g.save()
  g.translate(cx, cy)
  g.scale(flipX ? -1 : 1, flipY ? -1 : 1)
  g.translate(-cx, -cy)
  const r = drawObjectInner(g, obj, dpm, ctx, sharedTable)
  if (r && typeof r.then === 'function') return r.then(() => { g.restore() })
  g.restore()
  return Promise.resolve()
}

/** 渲染标签为 Canvas（毫米 → 像素按 dpi 换算）；支持多标签拼版 layout */
export async function renderLabel(doc: LabelDoc, opts: RenderOptions): Promise<HTMLCanvasElement> {
  const dpm = opts.dpi / 25.4
  const rows = opts.layout?.rows && opts.layout.rows > 0 ? opts.layout.rows : 1
  const cols = opts.layout?.cols && opts.layout.cols > 0 ? opts.layout.cols : 1
  const rowGap = (opts.layout?.rowGapMm ?? 0) * dpm
  const colGap = (opts.layout?.colGapMm ?? 0) * dpm
  const W = Math.max(1, Math.ceil(doc.widthMm * dpm))
  const H = Math.max(1, Math.ceil(doc.heightMm * dpm))
  const pageW = Math.max(W, Math.ceil(W * cols + colGap * (cols - 1)))
  const pageH = Math.max(H, Math.ceil(H * rows + rowGap * (rows - 1)))
  const canvas = document.createElement('canvas')
  canvas.width = pageW
  canvas.height = pageH
  const g = canvas.getContext('2d')
  if (!g) return canvas
  g.fillStyle = opts.background ?? '#ffffff'
  g.fillRect(0, 0, pageW, pageH)
  const objs = flattenObjects(doc.objects)
  // 打印顺序：row=先行后列（默认），col=先列后行；拼版内每格标签序号递增
  const order = opts.layout?.printOrder ?? 'row'
  const startPos = opts.layout?.startPos ?? 'tl'
  const cells: Array<[number, number]> = []
  for (let gi = 0; gi < rows * cols; gi++) {
    const r = order === 'col' ? gi % rows : Math.floor(gi / cols)
    const c = order === 'col' ? Math.floor(gi / rows) : gi % cols
    cells.push([r, c])
  }
  // 起始位置：tr 列反向、bl 行反向、br 行列均反向
  let seq = cells
  if (startPos === 'tr') seq = cells.map(([r, c]) => [r, cols - 1 - c])
  else if (startPos === 'bl') seq = cells.map(([r, c]) => [rows - 1 - r, c])
  else if (startPos === 'br') seq = cells.map(([r, c]) => [rows - 1 - r, cols - 1 - c])
  const ox = (opts.layout?.offsetXMm ?? 0) * dpm
  const oy = (opts.layout?.offsetYMm ?? 0) * dpm
  for (let gi = 0; gi < seq.length; gi++) {
    const [r, c] = seq[gi]
    g.save()
    g.translate(c * (W + colGap) + ox, r * (H + rowGap) + oy)
    const gridCtx = opts.ctx ? { ...opts.ctx, labelIndex: gi + 1, totalLabels: seq.length } : undefined
    for (const obj of objs) {
      if (obj.visible === false) continue
      await drawObject(g, obj, dpm, gridCtx, doc.colorIndexTable)
    }
    g.restore()
  }
  return canvas
}

export async function renderLabelDataUrl(doc: LabelDoc, opts: RenderOptions): Promise<string> {
  const canvas = await renderLabel(doc, opts)
  return canvas.toDataURL('image/png')
}

/** 页面拼版尺寸（mm）：单张时等于标签尺寸 */
export function pageSizeMm(doc: LabelDoc, layout?: RenderOptions['layout']): { widthMm: number; heightMm: number } {
  const rows = layout?.rows && layout.rows > 0 ? layout.rows : 1
  const cols = layout?.cols && layout.cols > 0 ? layout.cols : 1
  return {
    widthMm: Math.round((doc.widthMm * cols + (layout?.colGapMm ?? 0) * (cols - 1)) * 100) / 100,
    heightMm: Math.round((doc.heightMm * rows + (layout?.rowGapMm ?? 0) * (rows - 1)) * 100) / 100
  }
}
