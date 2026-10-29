import type { BarcodeObj, LabelObject } from '../../types'
import { isSquareMatrixCode } from '../../editor/barcodeTypes'

/** 原版 uses a tenth of a millimetre as the coarse output step for
 * printer-driven objects.  Keeping this in the editor adapter makes the
 * displayed frame and the persisted document use the same unit. */
export const RESIZE_STEP_MM = 0.1
export const MIN_OBJECT_SIZE_MM = 0.5

export function snapResizeMm(value: number, step = RESIZE_STEP_MM): number {
  if (!Number.isFinite(value)) return MIN_OBJECT_SIZE_MM
  return Math.max(MIN_OBJECT_SIZE_MM, Number((Math.round(value / step) * step).toFixed(2)))
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

export type FabricPoint = { x: number; y: number }

/**
 * 缩放时必须保持不动的点：拖哪个手柄，就固定它**对面**的角（角手柄）或边中点（边手柄）。
 *
 * `coords` 顺序与 fabric 的 `getCoords()` 一致：左上 / 右上 / 右下 / 左下。
 * 约束会把 fabric 自己算出的缩放改掉（等比、0.1mm 吸附），不改左/上位置时对面那个角会跟着漂，
 * 表现为「拖左上角，整个对象莫名平移」——改完缩放要按这个点把对象平移回去。
 */
export function fixedResizePoint(coords: readonly FabricPoint[], corner: string): FabricPoint | null {
  const [tl, tr, br, bl] = coords
  if (!tl || !tr || !br || !bl) return null
  const mid = (a: FabricPoint, b: FabricPoint): FabricPoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  switch (corner) {
    case 'tl': return { ...br }
    case 'tr': return { ...bl }
    case 'br': return { ...tl }
    case 'bl': return { ...tr }
    case 'mr': return mid(tl, bl)
    case 'ml': return mid(tr, br)
    case 'mt': return mid(bl, br)
    case 'mb': return mid(tl, tr)
    default: return null
  }
}

export interface FabricResizeInput {
  object: LabelObject
  baseWidthPx: number
  baseHeightPx: number
  scaleX: number
  scaleY: number
  /** 画布对象创建时记录的缩放比（`dataBoxScaleX/Y`）：文字的 scaleX 初始等于 fontWidthScale。 */
  baseScaleX?: number
  baseScaleY?: number
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

/** Apply the three size rules documented by 原版 to Fabric's live
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

  // 方形二维码（QR / 微型 QR / 汉信码）：模块阵列必须保持正方形，任何手柄都等比缩放。
  // 注意**不能**把 widthMm/heightMm 直接设成相等：带供人识读文字时画布图片是
  // 「二维码 + 下方文字」的长方形，强行让两者相等会把二维码本身横向拉宽。
  // 这里按「相对创建缩放的比例」等比缩放整张图片（文字跟着一起缩放），
  // 模型框由 syncFromFabric 按图片高度收成正方形。
  if (input.object.type === 'barcode' && isSquareMatrixCode((input.object as BarcodeObj).symbology, (input.object as BarcodeObj).barcodeOptions)) {
    const baseX = Math.abs(input.baseScaleX ?? 1) || 1
    const baseY = Math.abs(input.baseScaleY ?? 1) || 1
    const factorX = Math.abs(input.scaleX) / baseX
    const factorY = Math.abs(input.scaleY) / baseY
    const factor = corner
      ? Math.max(factorX, factorY)
      : input.corner === 'mr' || input.corner === 'ml' ? factorX : factorY
    widthMm = factor * baseX * width / input.pixelsPerMm
    heightMm = factor * baseY * height / input.pixelsPerMm
  } else if (input.object.type === 'text' && corner) {
    // Text's corner handles keep the rendered glyph ratio.  Middle handles
    // intentionally do not, matching the original app's "长扁字" behavior.
    // 比例必须用**当前视觉尺寸**，而不是字框本身：纵向拉伸过的字在模型里是
    // “字号变大 + 宽度缩放变小”，字框又回到了原比例，直接用 width/height 会让
    // 一碰角手柄就把拉伸取消掉。视觉比例 = 字框比例 × 创建时的 纵向/横向 缩放比
    // （创建时 scaleX = fontWidthScale、scaleY = 1；拖动过程中这两个值不能用，
    //   它们正是被这次拖动改写的量）。
    const baseX = Math.abs(input.baseScaleX ?? 1) || 1
    const baseY = Math.abs(input.baseScaleY ?? 1) || 1
    heightMm = widthMm * (height / width) * (baseY / baseX)
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
