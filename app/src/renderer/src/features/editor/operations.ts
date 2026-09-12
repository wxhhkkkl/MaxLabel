import type { GroupObj, LabelDoc, LabelObject } from '../../types'
import { round2, uid } from '../../types'

export type AlignOperation = 'left' | 'right' | 'top' | 'bottom' | 'midV' | 'midH'
export type SameSizeOperation = 'w' | 'h' | 'wh'
export type CenterOperation = 'h' | 'v'
export type DistributionOperation = 'h' | 'v'
export type OrderOperation = 'front' | 'forward' | 'backward' | 'back'
export type SnapOperation = 'top' | 'left' | 'right' | 'bottom'

type Bounds = { left: number; top: number; right: number; bottom: number }

function objectCenter(object: LabelObject): { x: number; y: number } {
  return object.type === 'group'
    ? { x: object.x, y: object.y }
    : { x: object.x + object.w / 2, y: object.y + object.h / 2 }
}

function setObjectCenter(object: LabelObject, center: { x: number; y: number }): LabelObject {
  return object.type === 'group'
    ? { ...object, x: round2(center.x), y: round2(center.y) }
    : { ...object, x: round2(center.x - object.w / 2), y: round2(center.y - object.h / 2) }
}

/** Bounds in document coordinates, including the object's current rotation. */
export function objectBounds(object: LabelObject): Bounds {
  const center = objectCenter(object)
  const angle = ((object.rotation || 0) * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const corners = [
    { x: -object.w / 2, y: -object.h / 2 },
    { x: object.w / 2, y: -object.h / 2 },
    { x: object.w / 2, y: object.h / 2 },
    { x: -object.w / 2, y: object.h / 2 }
  ].map((point) => ({
    x: center.x + point.x * cos - point.y * sin,
    y: center.y + point.x * sin + point.y * cos
  }))
  return {
    left: Math.min(...corners.map((point) => point.x)),
    top: Math.min(...corners.map((point) => point.y)),
    right: Math.max(...corners.map((point) => point.x)),
    bottom: Math.max(...corners.map((point) => point.y))
  }
}

function unionBounds(objects: LabelObject[]): Bounds {
  const bounds = objects.map(objectBounds)
  return {
    left: Math.min(...bounds.map((item) => item.left)),
    top: Math.min(...bounds.map((item) => item.top)),
    right: Math.max(...bounds.map((item) => item.right)),
    bottom: Math.max(...bounds.map((item) => item.bottom))
  }
}

function translateBy(object: LabelObject, dx: number, dy: number): LabelObject {
  const center = objectCenter(object)
  return setObjectCenter(object, { x: center.x + dx, y: center.y + dy })
}

export function alignObjects(objects: LabelObject[], mode: AlignOperation): LabelObject[] {
  if (objects.length < 2) return objects
  const union = unionBounds(objects)
  const centerX = (union.left + union.right) / 2
  const centerY = (union.top + union.bottom) / 2
  return objects.map((object) => {
    const bounds = objectBounds(object)
    const dx = mode === 'left' ? union.left - bounds.left
      : mode === 'right' ? union.right - bounds.right
        : mode === 'midV' ? centerX - (bounds.left + bounds.right) / 2 : 0
    const dy = mode === 'top' ? union.top - bounds.top
      : mode === 'bottom' ? union.bottom - bounds.bottom
        : mode === 'midH' ? centerY - (bounds.top + bounds.bottom) / 2 : 0
    return translateBy(object, dx, dy)
  })
}

/** Rotate selected objects around their combined visual center. */
export function rotateObjects(objects: LabelObject[], degrees: number): LabelObject[] {
  if (!objects.length || !degrees) return objects
  const union = unionBounds(objects)
  const pivot = { x: (union.left + union.right) / 2, y: (union.top + union.bottom) / 2 }
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return objects.map((object) => {
    const center = objectCenter(object)
    const dx = center.x - pivot.x
    const dy = center.y - pivot.y
    const next = setObjectCenter(object, {
      x: pivot.x + dx * cos - dy * sin,
      y: pivot.y + dx * sin + dy * cos
    })
    return { ...next, rotation: round2(((object.rotation || 0) + degrees) % 360 + 360) % 360 }
  })
}

export function resizeObjects(objects: LabelObject[], mode: SameSizeOperation): LabelObject[] {
  if (objects.length < 2) return objects
  const width = Math.max(...objects.map((object) => object.w))
  const height = Math.max(...objects.map((object) => object.h))
  return objects.map((object) => ({
    ...object,
    w: mode === 'w' || mode === 'wh' ? width : object.w,
    h: mode === 'h' || mode === 'wh' ? height : object.h
  }))
}

export function centerObjects(objects: LabelObject[], mode: CenterOperation, doc: Pick<LabelDoc, 'widthMm' | 'heightMm'>): LabelObject[] {
  return objects.map((object) => {
    const bounds = objectBounds(object)
    // Center the visual bounding box, so a rotated object is not visibly off-center.
    return translateBy(object, mode === 'h' ? doc.widthMm / 2 - (bounds.left + bounds.right) / 2 : 0, mode === 'v' ? doc.heightMm / 2 - (bounds.top + bounds.bottom) / 2 : 0)
  })
}

export function distributeObjects(objects: LabelObject[], mode: DistributionOperation): LabelObject[] {
  if (objects.length < 3) return objects
  const axis = mode === 'h' ? 'x' : 'y'
  const centerOnAxis = (object: LabelObject) => {
    const center = objectCenter(object)
    return axis === 'x' ? center.x : center.y
  }
  const sorted = [...objects].sort((a, b) => centerOnAxis(a) - centerOnAxis(b))
  const first = centerOnAxis(sorted[0])
  const lastObject = sorted[sorted.length - 1]
  const last = centerOnAxis(lastObject)
  const step = (last - first) / (sorted.length - 1)
  const positions = new Map(sorted.map((object, index) => [object.id, first + step * index]))
  return objects.map((object) => {
    const center = objectCenter(object)
    return setObjectCenter(object, axis === 'x'
      ? { x: positions.get(object.id) ?? center.x, y: center.y }
      : { x: center.x, y: positions.get(object.id) ?? center.y })
  })
}

export function snapObjects(objects: LabelObject[], edge: SnapOperation, doc: Pick<LabelDoc, 'widthMm' | 'heightMm'>): LabelObject[] {
  return objects.map((object) => {
    const bounds = objectBounds(object)
    return translateBy(object,
      edge === 'left' ? -bounds.left : edge === 'right' ? doc.widthMm - bounds.right : 0,
      edge === 'top' ? -bounds.top : edge === 'bottom' ? doc.heightMm - bounds.bottom : 0)
  })
}

export function reorderObjects(objects: LabelObject[], selectedIds: ReadonlySet<string>, mode: OrderOperation): LabelObject[] {
  const selected = objects.filter((object) => selectedIds.has(object.id))
  const rest = objects.filter((object) => !selectedIds.has(object.id))
  if (mode === 'front') return [...rest, ...selected]
  if (mode === 'back') return [...selected, ...rest]
  const next = [...objects]
  if (mode === 'forward') {
    for (let index = next.length - 2; index >= 0; index--) {
      if (selectedIds.has(next[index].id) && !selectedIds.has(next[index + 1].id)) [next[index], next[index + 1]] = [next[index + 1], next[index]]
    }
  } else {
    for (let index = 1; index < next.length; index++) {
      if (selectedIds.has(next[index].id) && !selectedIds.has(next[index - 1].id)) [next[index], next[index - 1]] = [next[index - 1], next[index]]
    }
  }
  return next
}

/** Same z-order operation applied inside whichever group owns each selected object. */
export function reorderObjectsDeep(objects: LabelObject[], selectedIds: ReadonlySet<string>, mode: OrderOperation): LabelObject[] {
  const reordered = reorderObjects(objects, selectedIds, mode)
  return reordered.map((object) => {
    if (object.type !== 'group' || selectedIds.has(object.id)) return object
    const children = reorderObjectsDeep(object.children, selectedIds, mode)
    return children === object.children ? object : { ...object, children }
  })
}

export function groupObjects(objects: LabelObject[], selectedIds: ReadonlySet<string>, groupId = uid()): { objects: LabelObject[]; groupId?: string } {
  const selected = objects.filter((object) => selectedIds.has(object.id))
  if (selected.length < 2) return { objects }
  const minX = Math.min(...selected.map((object) => object.x))
  const minY = Math.min(...selected.map((object) => object.y))
  const maxX = Math.max(...selected.map((object) => object.x + object.w))
  const maxY = Math.max(...selected.map((object) => object.y + object.h))
  const group: GroupObj = {
    id: groupId,
    type: 'group',
    x: round2((minX + maxX) / 2),
    y: round2((minY + maxY) / 2),
    w: round2(maxX - minX),
    h: round2(maxY - minY),
    rotation: 0,
    children: selected.map((object) => ({ ...object }))
  }
  return { objects: [...objects.filter((object) => !selectedIds.has(object.id)), group], groupId }
}

export function ungroupObjects(objects: LabelObject[], selectedIds: ReadonlySet<string>): LabelObject[] {
  if (!objects.some((object) => selectedIds.has(object.id) && object.type === 'group')) return objects
  return objects.flatMap((object) => selectedIds.has(object.id) && object.type === 'group' ? object.children : [object])
}
