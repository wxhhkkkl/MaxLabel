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

function localObjectSize(fabricObject: fabric.Object): { width: number; height: number } {
  const stroke = 'strokeWidth' in fabricObject ? Number((fabricObject as fabric.Object & { strokeWidth?: number }).strokeWidth ?? 0) : 0
  return { width: Math.max(0.1, Number(fabricObject.width ?? 0) + stroke), height: Math.max(0.1, Number(fabricObject.height ?? 0) + stroke) }
}

function syncWorldLeaf(object: LabelObject, fabricObject: fabric.Object, scale: number, modelToWorld: Affine2D = identityAffine): LabelObject {
  const matrix = fabricObject.calcTransformMatrix()
  const localSize = localObjectSize(fabricObject)
  const topLeftPx = matrixPoint(matrix, -localSize.width / 2, -localSize.height / 2)
  const inverse = invertAffine(modelToWorld)
  const point = applyAffine(inverse, { x: topLeftPx.x / scale, y: topLeftPx.y / scale })
  const worldScaleX = Math.hypot(matrix[0], matrix[1])
  const worldScaleY = Math.hypot(matrix[2], matrix[3])
  // Stroke participates in the visual anchor but is not part of the model's
  // logical width/height, matching the top-level sync behavior.
  const width = Number(fabricObject.width ?? 0) * worldScaleX / scale
  const height = Number(fabricObject.height ?? 0) * worldScaleY / scale
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
  const width = ((fabricObject.width ?? 0) * (fabricObject.scaleX ?? 1)) / scale
  const height = ((fabricObject.height ?? 0) * (fabricObject.scaleY ?? 1)) / scale
  const base = { ...object, x: round2((fabricObject.left ?? 0) / scale), y: round2((fabricObject.top ?? 0) / scale), w: round2(Math.max(width, 0.1)), h: round2(Math.max(height, 0.1)), rotation: round2(fabricObject.angle ?? 0) }
  if (object.type === 'text') {
    if (object.arc || object.textType === 'circle') return { ...object, ...base, fontSize: round2(object.fontSize * (fabricObject.scaleY ?? 1)) } as LabelObject
    const text = fabricObject as fabric.Text
    const actualWidth = ((fabricObject.width ?? 0) * (fabricObject.scaleX ?? 1)) / scale
    const actualHeight = ((fabricObject.height ?? 0) * (fabricObject.scaleY ?? 1)) / scale
    let x = (fabricObject.left ?? 0) / scale
    let y = (fabricObject.top ?? 0) / scale
    if (fabricObject.originX === 'center') x -= actualWidth / 2
    else if (fabricObject.originX === 'right') x -= actualWidth
    if (fabricObject.originY === 'center') y -= actualHeight / 2
    else if (fabricObject.originY === 'bottom') y -= actualHeight
    return { ...object, ...base, x: round2(x), y: round2(y), fontFamily: text.fontFamily || 'Arial', fontSize: round2((text.fontSize ?? 10) / scale), bold: text.fontWeight === 'bold', italic: text.fontStyle === 'italic', underline: text.underline === true, align: (text.textAlign as typeof object.align) || 'left', color: (text.fill as string) || '#000000' } as LabelObject
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
    let x = (fabricObject.left ?? 0) / scale
    let y = (fabricObject.top ?? 0) / scale
    if (fabricObject.originX === 'center') x -= width / 2
    else if (fabricObject.originX === 'right') x -= width
    if (fabricObject.originY === 'center') y -= height / 2
    else if (fabricObject.originY === 'bottom') y -= height
    return { ...object, ...base, x: round2(x), y: round2(y) }
  }
  return { ...object, ...base }
}
