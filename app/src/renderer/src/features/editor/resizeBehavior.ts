import type { LabelObject } from '../../types'

/** LabelShop uses a tenth of a millimetre as the coarse output step for
 * printer-driven objects.  Keeping this in the editor adapter makes the
 * displayed frame and the persisted document use the same unit. */
export const LABELSHOP_RESIZE_STEP_MM = 0.1
export const LABELSHOP_MIN_OBJECT_SIZE_MM = 0.5

export function snapResizeMm(value: number, step = LABELSHOP_RESIZE_STEP_MM): number {
  if (!Number.isFinite(value)) return LABELSHOP_MIN_OBJECT_SIZE_MM
  return Math.max(LABELSHOP_MIN_OBJECT_SIZE_MM, Number((Math.round(value / step) * step).toFixed(2)))
}

function isCornerHandle(corner: string): boolean {
  // Fabric names middle controls mr/ml/mt/mb and corner controls tl/tr/bl/br.
  // Treating every two-character name as a corner would make a middle text
  // handle preserve its ratio accidentally.
  return corner === 'tl' || corner === 'tr' || corner === 'bl' || corner === 'br'
}

function hasSquareShiftBehavior(object: LabelObject): boolean {
  return object.type === 'rect' || object.type === 'ellipse' || object.type === 'line' || object.type === 'table'
}

function hasOutputStep(object: LabelObject): boolean {
  return object.type === 'barcode' || (object.type === 'text' && Boolean(object.printerFont))
}

export interface FabricResizeInput {
  object: LabelObject
  baseWidthPx: number
  baseHeightPx: number
  scaleX: number
  scaleY: number
  corner: string
  shiftKey: boolean
  pixelsPerMm: number
}

export interface FabricResizeOutput {
  scaleX: number
  scaleY: number
  widthMm: number
  heightMm: number
}

/** Apply the three size rules documented by LabelShop to Fabric's live
 * transform: barcode/printer-font dimensions snap to output steps; SHIFT
 * squares geometric objects; text corner handles preserve the font ratio,
 * while edge handles remain independently scalable. */
export function constrainFabricResize(input: FabricResizeInput): FabricResizeOutput {
  const width = Math.max(1, Math.abs(input.baseWidthPx))
  const height = Math.max(1, Math.abs(input.baseHeightPx))
  const signX = input.scaleX < 0 ? -1 : 1
  const signY = input.scaleY < 0 ? -1 : 1
  const corner = isCornerHandle(input.corner)
  let widthMm = Math.abs(input.scaleX) * width / input.pixelsPerMm
  let heightMm = Math.abs(input.scaleY) * height / input.pixelsPerMm

  if (input.object.type === 'text' && corner) {
    // Text's corner handles keep the rendered glyph ratio.  Middle handles
    // intentionally do not, matching LabelShop's "长扁字" behavior.
    heightMm = widthMm * (height / width)
  } else if (input.shiftKey && hasSquareShiftBehavior(input.object)) {
    const side = Math.max(widthMm, heightMm)
    widthMm = side
    heightMm = side
  }

  if (hasOutputStep(input.object)) {
    widthMm = snapResizeMm(widthMm)
    heightMm = snapResizeMm(heightMm)
  }

  return {
    scaleX: signX * widthMm * input.pixelsPerMm / width,
    scaleY: signY * heightMm * input.pixelsPerMm / height,
    widthMm,
    heightMm
  }
}
