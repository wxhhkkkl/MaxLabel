import * as fabric from 'fabric'
import type { DataCtx, LabelDoc } from '../types'
import { PX_PER_MM } from '../types'
import { makeObject, type ObjectRenderOptions } from '../rendering/fabricObjects'
import { pageSizeMm, type PageLayout } from '../rendering/pageLayout'
import { materializeScenePrimitive, resolvePrintPageScene, resolvePrintPlanPageScene, type ResolvedPrintScene } from '../../../shared/print/scene'
import type { PrintPlanPage } from '../../../shared/print/plan'
import { MAX_RENDER_PIXELS } from '../../../shared/print/limits'
import { pageCells, orientedLabelSize } from '../../../shared/print/layout'

export { pageSizeMm } from '../rendering/pageLayout'
export interface RenderOptions {
  dpi: number
  ctx?: DataCtx
  background?: string
  layout?: PageLayout
  /** 当打印计划已决定每个单元的数据与槽位时，必须使用该页，避免驱动渲染与原生指令分叉。 */
  planPage?: PrintPlanPage
  /** Already resolved output scene; prevents a second evaluation of dynamic data. */
  scene?: ResolvedPrintScene
  includeSuppressed?: boolean
  /** Main-process image access is supplied by the renderer host. */
  resolveImage?: ObjectRenderOptions['resolveImage']
}

/** Same geometry as the editor, rasterized at target DPI without editor overlays. */
export async function renderLabel(doc: LabelDoc, opts: RenderOptions): Promise<HTMLCanvasElement> {
  if (!Number.isFinite(opts.dpi) || opts.dpi <= 0) throw new Error('无效的打印分辨率')
  const size = pageSizeMm(doc, opts.layout)
  const dpm = opts.dpi / 25.4
  const pixelWidth = Math.max(1, Math.round(size.widthMm * dpm))
  const pixelHeight = Math.max(1, Math.round(size.heightMm * dpm))
  if (pixelWidth * pixelHeight > MAX_RENDER_PIXELS) {
    throw new Error(`渲染画布过大（${pixelWidth}×${pixelHeight}，最大 ${MAX_RENDER_PIXELS.toLocaleString()} 像素）`)
  }
  const canvas = document.createElement('canvas')
  canvas.width = pixelWidth
  canvas.height = pixelHeight
  const output = new fabric.StaticCanvas(canvas, {
    width: canvas.width, height: canvas.height,
    backgroundColor: opts.background ?? '#ffffff',
    enableRetinaScaling: false, renderOnAddRemove: false
  })
  try {
    // Preserve editor font metrics; apply DPI only in the viewport transform.
    const zoom = dpm / PX_PER_MM
    output.setViewportTransform([zoom, 0, 0, zoom, 0, 0])
    const ctx = opts.ctx ?? {
      labelIndex: 1, recordIndex: 0, copy: 1, count: 1, totalLabels: 1,
      title: doc.name, printerName: '', datasets: doc.datasets ?? {}, sharedVars: {}, keyboardValues: {}, allowScript: false, now: Date.now()
    }
    const scene = opts.scene ?? (opts.planPage
      ? resolvePrintPlanPageScene(doc, ctx, opts.layout, opts.planPage, undefined, { includeSuppressed: opts.includeSuppressed })
      : resolvePrintPageScene(doc, ctx, opts.layout, undefined, { includeSuppressed: opts.includeSuppressed }))
    for (const primitive of scene.primitives) {
      const object = await makeObject(materializeScenePrimitive(primitive), PX_PER_MM, { output: true, ctx: primitive.context, colorTable: doc.colorIndexTable, resolveImage: opts.resolveImage })
      if (object) output.add(object)
    }
    output.renderAll()
    const result = document.createElement('canvas')
    result.width = canvas.width
    result.height = canvas.height
    const g = result.getContext('2d')
    if (!g) throw new Error('无法创建输出画布')
    const shape = opts.scene?.labelShape ?? doc.layout?.shape ?? 'rect'
    const labelSize = orientedLabelSize(doc)
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, result.width, result.height)
    const cells = opts.scene?.labelCells ?? pageCells(doc, opts.layout).map((cell) => ({ ...cell, widthMm: labelSize.widthMm, heightMm: labelSize.heightMm }))
    for (const cell of cells) {
      const x = cell.x * dpm
      const y = cell.y * dpm
      const w = cell.widthMm * dpm
      const h = cell.heightMm * dpm
      g.save()
      g.beginPath()
      if (shape === 'ellipse') {
        g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
      } else if (shape === 'roundRect') {
        g.roundRect(x, y, w, h, Math.min(w, h) * 0.12)
      } else {
        g.rect(x, y, w, h)
      }
      g.clip()
      g.drawImage(canvas, 0, 0)
      g.restore()
    }
    return result
  } finally {
    await output.dispose()
  }
}
export async function renderLabelDataUrl(doc: LabelDoc, opts: RenderOptions): Promise<string> {
  return (await renderLabel(doc, opts)).toDataURL('image/png')
}
