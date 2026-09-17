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
  // LabelShop treats the first selected object (the blue-handle object) as
  // the reference object.  Do not align to the union's outer edge: that
  // makes the result depend on whichever object happens to be furthest out.
  const reference = objectBounds(objects[0])
  const referenceCenterX = (reference.left + reference.right) / 2
  const referenceCenterY = (reference.top + reference.bottom) / 2
  return objects.map((object) => {
    const bounds = objectBounds(object)
    const dx = mode === 'left' ? reference.left - bounds.left
      : mode === 'right' ? reference.right - bounds.right
        : mode === 'midV' ? referenceCenterX - (bounds.left + bounds.right) / 2 : 0
    const dy = mode === 'top' ? reference.top - bounds.top
      : mode === 'bottom' ? reference.bottom - bounds.bottom
        : mode === 'midH' ? referenceCenterY - (bounds.top + bounds.bottom) / 2 : 0
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
  // Help (toolbar_align.html): "水平同宽"将所有被选取的对象水平方向尺寸设定与参考对象的宽度相同.
  // The reference object is the first selected one, exactly as in alignObjects().
  const width = objects[0].w
  const height = objects[0].h
  return objects.map((object) => ({
    ...object,
    w: mode === 'w' || mode === 'wh' ? width : object.w,
    h: mode === 'h' || mode === 'wh' ? height : object.h
  }))
}

export function centerObjects(objects: LabelObject[], mode: CenterOperation, doc: Pick<LabelDoc, 'widthMm' | 'heightMm'>): LabelObject[] {
  if (!objects.length) return objects
  const union = unionBounds(objects)
  const dx = mode === 'h' ? doc.widthMm / 2 - (union.left + union.right) / 2 : 0
  const dy = mode === 'v' ? doc.heightMm / 2 - (union.top + union.bottom) / 2 : 0
  // Move the selected objects as one visual group.  Centering each object
  // independently would stack them all on the label's center.
  return objects.map((object) => translateBy(object, dx, dy))
}

export function distributeObjects(objects: LabelObject[], mode: DistributionOperation): LabelObject[] {
  if (objects.length < 3) return objects
  const horizontal = mode === 'h'
  const entries = objects
    .map((object) => ({ object, bounds: objectBounds(object) }))
    .sort((a, b) => (horizontal ? a.bounds.left - b.bounds.left : a.bounds.top - b.bounds.top) || a.object.id.localeCompare(b.object.id))
  const first = entries[0].bounds
  const last = entries[entries.length - 1].bounds
  const sizes = entries.map(({ bounds }) => horizontal ? bounds.right - bounds.left : bounds.bottom - bounds.top)
  const totalSize = sizes.reduce((sum, size) => sum + size, 0)
  const available = (horizontal ? last.right - first.left : last.bottom - first.top) - totalSize
  const gap = available / (entries.length - 1)
  let cursor = horizontal ? first.left : first.top
  const deltas = new Map<string, number>()
  entries.forEach(({ object, bounds }, index) => {
    const start = horizontal ? bounds.left : bounds.top
    deltas.set(object.id, cursor - start)
    cursor += sizes[index] + gap
  })
  return objects.map((object) => {
    const delta = deltas.get(object.id) ?? 0
    return translateBy(object, horizontal ? delta : 0, horizontal ? 0 : delta)
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
