import * as fabric from 'fabric'
import { materializeScenePrimitive } from '../../../shared/print/scene'
import { composePageSvg } from '../../../shared/print/pageSvg'
import { PX_PER_MM, type LabelDoc } from '../types'
import { makeObject } from '../rendering/fabricObjects'
import { pageSizeMm } from '../rendering/pageLayout'
import { outputCells, resolveOutputScene, type RenderOptions } from './renderLabel'

/** Vector page for driver printing; throws VectorUnsupportedError for unsafe primitives. */
export async function renderLabelSvg(doc: LabelDoc, opts: RenderOptions): Promise<string> {
  const size = pageSizeMm(doc, opts.layout)
  const pageWidthPx = Math.max(1, Math.round(size.widthMm * PX_PER_MM))
  const pageHeightPx = Math.max(1, Math.round(size.heightMm * PX_PER_MM))
  const canvasElement = document.createElement('canvas')
  canvasElement.width = pageWidthPx
  canvasElement.height = pageHeightPx
  const canvas = new fabric.StaticCanvas(canvasElement, {
    width: pageWidthPx,
    height: pageHeightPx,
    backgroundColor: opts.background ?? '#ffffff',
    enableRetinaScaling: false,
    renderOnAddRemove: false
  })
  try {
    const scene = resolveOutputScene(doc, opts)
    for (const primitive of scene.primitives) {
      const object = await makeObject(materializeScenePrimitive(primitive), PX_PER_MM, {
        output: true,
        ctx: primitive.context,
        colorTable: doc.colorIndexTable,
        resolveImage: opts.resolveImage,
        vectorBarcodes: 'svg'
      })
      if (object) canvas.add(object)
    }
    canvas.renderAll()
    const fabricSvg = canvas.toSVG({
      suppressPreamble: true,
      width: `${size.widthMm}mm`,
      height: `${size.heightMm}mm`,
      viewBox: { x: 0, y: 0, width: pageWidthPx, height: pageHeightPx }
    })
    const shape = scene.labelShape ?? doc.layout?.shape ?? 'rect'
    const geometry = scene.paperGeometry ?? doc.layout ?? {}
    return composePageSvg(fabricSvg, outputCells(doc, scene, opts.layout), geometry, shape, pageWidthPx, pageHeightPx)
  } finally {
    await canvas.dispose()
  }
}
