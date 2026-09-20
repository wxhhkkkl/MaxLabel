import * as fabric from 'fabric'
import type { GroupObj, LabelObject, TableObj } from '../../types'
import { round2 } from '../../types'
import { affineRotationDegrees, applyAffine, identityAffine, invertAffine, multiplyAffine, rotationAround, type Affine2D } from '../../../../shared/domain/transform'

function matrixPoint(matrix: number[], x: number, y: number): { x: number; y: number } {
  return { x: matrix[0] * x + matrix[2] * y + matrix[4], y: matrix[1] * x + matrix[3] * y + matrix[5] }
}

function fabricMatrix(matrix: number[]): Affine2D {
  return { a: matrix[0], b: matrix[1], c: matrix[2], d: matrix[3], e: matrix[4], f: matrix[5] }
}

/** 条码/文字的 fabric 画布对象尺寸是「渲染内容」尺寸（条码按缩放比等比缩小放在对象框里、
 *  文字是文本自然宽度），与模型的「对象框」并不相等。round-114 实测：拿渲染框的 left/top
 *  直接回写模型，会让一次**纯拖动**把对象框改小并位移（条码 8mm → 5.08mm、文字 11mm → 16mm）。
 *  这里统一按创建时的对齐方式把渲染框换算回模型框。 */
function boxAlignment(object: LabelObject): { x: 'left' | 'center' | 'right'; y: 'top' | 'middle' | 'bottom' } {
  if (object.type === 'text') {
    const align = (object as { align?: string }).align
    const vAlign = (object as { verticalAlign?: string }).verticalAlign
    return {
      x: align === 'center' ? 'center' : align === 'right' ? 'right' : 'left',
      y: vAlign === 'middle' ? 'middle' : vAlign === 'bottom' ? 'bottom' : 'top'
    }
  }
  if (object.type === 'barcode') {
    const align = (object as { barcodeAlign?: string }).barcodeAlign
    return { x: align === 'left' ? 'left' : align === 'right' ? 'right' : 'center', y: 'middle' }
  }
  // 其它对象（矩形/线条/表格/图片…）的画布框就是模型框，模型 x/y 存的是框左上角
  return { x: 'left', y: 'top' }
}

/** 模型框左上角相对「渲染框」的局部位移（像素）。renderW/renderH 是渲染框尺寸，
 *  boxWpx/boxHpx 是模型框尺寸。 */
function modelBoxOffset(
  object: LabelObject,
  renderW: number,
  renderH: number,
  boxWpx: number,
  boxHpx: number
): { x: number; y: number } {
  const align = boxAlignment(object)
  return {
    x: align.x === 'center' ? -boxWpx / 2 : align.x === 'right' ? renderW / 2 - boxWpx : -renderW / 2,
    y: align.y === 'middle' ? -boxHpx / 2 : align.y === 'bottom' ? renderH / 2 - boxHpx : -renderH / 2
  }
}

/** 创建时记在画布对象上的缩放比（fabricObjects.ts 写入）。缩放比没变说明用户只是移动/旋转，
 *  此时模型框尺寸必须原样保留；变了才是真的改过尺寸，按渲染框换算新尺寸。 */
function boxScaleUnchanged(object: LabelObject, fabricObject: fabric.Object): boolean {
  if (object.type !== 'text' && object.type !== 'barcode') return false
  const baseX = Number((fabricObject as { dataBoxScaleX?: number }).dataBoxScaleX)
  const baseY = Number((fabricObject as { dataBoxScaleY?: number }).dataBoxScaleY)
  if (!Number.isFinite(baseX) || !Number.isFinite(baseY)) return false
  return Math.abs(Number(fabricObject.scaleX ?? 1) - baseX) < 1e-6 && Math.abs(Number(fabricObject.scaleY ?? 1) - baseY) < 1e-6
}

function syncWorldLeaf(object: LabelObject, fabricObject: fabric.Object, scale: number, modelToWorld: Affine2D = identityAffine): LabelObject {
  const matrix = fabricObject.calcTransformMatrix()
  const inverse = invertAffine(modelToWorld)
  const worldScaleX = Math.hypot(matrix[0], matrix[1])
  const worldScaleY = Math.hypot(matrix[2], matrix[3])
  // Stroke participates in the visual anchor but is not part of the model's
  // logical width/height, matching the top-level sync behavior.
  const renderedWidth = Number(fabricObject.width ?? 0) * worldScaleX / scale
  const renderedHeight = Number(fabricObject.height ?? 0) * worldScaleY / scale
  const keepBox = boxScaleUnchanged(object, fabricObject)
  const width = keepBox ? object.w : renderedWidth
  const height = keepBox ? object.h : renderedHeight
  // 渲染框 / 模型框的对齐换算（见 modelBoxOffset 注释）：组内子对象同样要按模型框回写，
  // 否则拖动整组会把组里的条码/文字越拖越小。位移必须**在对象自己的局部坐标系里**算、
  // 再经矩阵变换（组/对象自身可能带旋转，直接在画布坐标里加减宽高的一半会偏）。
  const offset = modelBoxOffset(
    object,
    Number(fabricObject.width ?? 0) * Math.abs(Number(fabricObject.scaleX ?? 1)),
    Number(fabricObject.height ?? 0) * Math.abs(Number(fabricObject.scaleY ?? 1)),
    width * scale,
    height * scale
  )
  const boxTopLeftPx = matrixPoint(matrix, offset.x, offset.y)
  const point = applyAffine(inverse, { x: boxTopLeftPx.x / scale, y: boxTopLeftPx.y / scale })
  const rotation = round2(affineRotationDegrees(fabricMatrix(matrix)) - affineRotationDegrees(modelToWorld))
  const base = { ...object, x: round2(point.x), y: round2(point.y), w: round2(Math.max(width, 0.1)), h: round2(Math.max(height, 0.1)), rotation }
  if (object.type === 'text') {
    const text = fabricObject as fabric.Text
    return { ...object, ...base, fontFamily: text.fontFamily || 'Arial', fontSize: round2((text.fontSize ?? 10) / scale), bold: text.fontWeight === 'bold', italic: text.fontStyle === 'italic', underline: text.underline === true, align: (text.textAlign as typeof object.align) || 'left', color: (text.fill as string) || '#000000' } as LabelObject
  }
  if (object.type === 'rect' || object.type === 'ellipse') {
    const shape = fabricObject as fabric.Rect
    return { ...object, ...base, fill: (shape.fill as string) || '#ffffff', stroke: (shape.stroke as string) || '#000000', strokeWidth: round2(((shape.strokeWidth ?? 0) * (shape.scaleX ?? 1)) / scale) } as LabelObject
  }
  return { ...object, ...base }
}

function syncWorldGroup(object: GroupObj, fabricObject: fabric.Group, scale: number, parentTransform: Affine2D = identityAffine): GroupObj {
  const center = fabricObject.getCenterPoint()
  const worldCenter = { x: center.x / scale, y: center.y / scale }
  const inverseParent = invertAffine(parentTransform)
  const groupCenter = applyAffine(inverseParent, worldCenter)
  const worldAngle = affineRotationDegrees(fabricMatrix(fabricObject.calcTransformMatrix()))
  const localRotation = round2(worldAngle - affineRotationDegrees(parentTransform))
  const modelToWorld = multiplyAffine(parentTransform, rotationAround(groupCenter.x, groupCenter.y, localRotation))
  const children = object.children.map((child) => {
    const target = fabricObject.getObjects().find((item) => (item as fabric.Object & { dataId?: string }).dataId === child.id)
    if (!target) return child
    if (child.type === 'group' && target.type === 'group') return syncWorldGroup(child, target as fabric.Group, scale, modelToWorld)
    return syncWorldLeaf(child, target, scale, modelToWorld)
  })
  const groupScaleX = Number(fabricObject.scaleX ?? 1)
  const groupScaleY = Number(fabricObject.scaleY ?? 1)
  return {
    ...object,
    x: round2(groupCenter.x),
    y: round2(groupCenter.y),
    // Fabric recomputes a group's measured bounds when a child is rotated.
    // Preserve the document dimensions for move/rotate operations and only
    // change them when the group itself was scaled.
    w: round2(Math.max(object.w * groupScaleX, 0.1)),
    h: round2(Math.max(object.h * groupScaleY, 0.1)),
    rotation: localRotation,
    children
  }
}

/** Fabric 对象变换后的毫米模型同步；这是画布适配器，不包含应用状态。 */
export function syncFromFabric(object: LabelObject, fabricObject: fabric.Object, scale: number): LabelObject {
  if (object.type === 'group' && fabricObject.type === 'group') return syncWorldGroup(object, fabricObject as fabric.Group, scale)
  const keepBox = boxScaleUnchanged(object, fabricObject)
  const renderedWidth = ((fabricObject.width ?? 0) * (fabricObject.scaleX ?? 1)) / scale
  const renderedHeight = ((fabricObject.height ?? 0) * (fabricObject.scaleY ?? 1)) / scale
  const width = keepBox ? object.w : renderedWidth
  const height = keepBox ? object.h : renderedHeight
  // 条码/文字的画布框是渲染内容尺寸：位置一律按「模型框」回写（见 modelBoxOffset）。
  // 顶层对象的 x/y 是「未旋转框的左上角」，所以这里在文档坐标里直接减半个框，
  // 不能走矩阵（对象自身的旋转不该参与——旋转是绕框中心做的）。
  const boxTopLeft = (): { x: number; y: number } => {
    const center = matrixPoint(fabricObject.calcTransformMatrix(), 0, 0)
    const offset = modelBoxOffset(
      object,
      Math.abs(Number(fabricObject.width ?? 0) * Number(fabricObject.scaleX ?? 1)),
      Math.abs(Number(fabricObject.height ?? 0) * Number(fabricObject.scaleY ?? 1)),
      width * scale,
      height * scale
    )
    return { x: round2((center.x + offset.x) / scale), y: round2((center.y + offset.y) / scale) }
  }
  const base = { ...object, x: round2((fabricObject.left ?? 0) / scale), y: round2((fabricObject.top ?? 0) / scale), w: round2(Math.max(width, 0.1)), h: round2(Math.max(height, 0.1)), rotation: round2(fabricObject.angle ?? 0) }
  if (object.type === 'text') {
    if (object.arc || object.textType === 'circle') return { ...object, ...base, fontSize: round2(object.fontSize * (fabricObject.scaleY ?? 1)) } as LabelObject
    const text = fabricObject as fabric.Text
    return { ...object, ...base, ...boxTopLeft(), fontFamily: text.fontFamily || 'Arial', fontSize: round2((text.fontSize ?? 10) / scale), bold: text.fontWeight === 'bold', italic: text.fontStyle === 'italic', underline: text.underline === true, align: (text.textAlign as typeof object.align) || 'left', color: (text.fill as string) || '#000000' } as LabelObject
  }
  if (object.type === 'rect' || object.type === 'ellipse') {
    const shape = fabricObject as fabric.Rect
    return { ...object, ...base, fill: (shape.fill as string) || '#ffffff', stroke: (shape.stroke as string) || '#000000', strokeWidth: round2(((shape.strokeWidth ?? 0) * (shape.scaleX ?? 1)) / scale) } as LabelObject
  }
  if (object.type === 'line') {
    const line = fabricObject as fabric.Line
    return { ...object, ...base, stroke: (line.stroke as string) || '#000000', strokeWidth: round2(((line.strokeWidth ?? 0) * (line.scaleX ?? 1)) / scale) } as LabelObject
  }
  if (object.type === 'table') {
    const table = object as TableObj
    return { ...table, ...base }
  }
  if (object.type === 'barcode') {
    return { ...object, ...base, ...boxTopLeft() }
  }
  return { ...object, ...base }
}
