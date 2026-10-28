import { describe, expect, it } from 'vitest'
import { applyObjectFormat } from '@shared/domain/datasource'
import type { LabelObject } from '@shared/domain/objects'
import { flattenObjects, replaceDatasetReferences } from '@shared/domain/objects'
import { tableMergeAt, tableSegmentHidden } from '@shared/table'
import { clientToCanvasPoint } from '@/editor/canvasCoordinates'
import { editorAvailability } from '@/features/editor/editorAvailability'
import {
  alignObjects,
  centerObjects,
  distributeObjects,
  groupObjects,
  isPositionLocked,
  objectBounds,
  reorderObjects,
  resizeObjects,
  rotateObjects,
  ungroupObjects
} from '@/features/editor/operations'
import { createLabelObject } from '@/features/editor/objectFactory'
import { constrainFabricResize, RESIZE_STEP_MM, snapResizeMm } from '@/features/editor/resizeBehavior'

const rect = (id: string, x: number, y: number, w = 10, h = 5): LabelObject => ({
  id,
  type: 'rect',
  x,
  y,
  w,
  h,
  rotation: 0,
  fill: 'transparent',
  stroke: '#000',
  strokeWidth: 0.2
})

const source = [rect('a', 1, 2), rect('b', 20, 8), rect('c', 50, 14)]

describe('align, distribute and reference semantics', () => {
  it('aligns and distributes selected objects', () => {
    expect(alignObjects(source, 'left').map((item) => item.x)).toEqual([1, 1, 1])
    expect(distributeObjects(source, 'h').map((item) => item.x)).toEqual([1, 25.5, 50])
  })

  it('uses the first selected (blue-handle) object as the reference', () => {
    const reference = rect('reference', 40, 10, 10, 5)
    const peers = [rect('left-peer', 5, 20, 8, 5), rect('right-peer', 70, 30, 12, 5)]
    expect(alignObjects([reference, ...peers], 'left').map((item) => item.x)).toEqual([40, 40, 40])
    expect(alignObjects([reference, ...peers], 'right').map((item) => item.x)).toEqual([40, 42, 38])
    expect(alignObjects([reference, ...peers], 'midH').map((item) => item.y)).toEqual([10, 10, 10])
    expect(resizeObjects([reference, ...peers], 'w').map((item) => item.w)).toEqual([10, 10, 10])
    expect(resizeObjects([reference, ...peers], 'h').map((item) => item.h)).toEqual([5, 5, 5])
    expect(resizeObjects([reference, ...peers], 'wh').map((item) => [item.w, item.h])).toEqual([
      [10, 5],
      [10, 5],
      [10, 5]
    ])
    expect(resizeObjects([rect('solo', 0, 0)], 'w').map((item) => item.w)).toEqual([10])
  })

  it('centers multiple objects as one visual group and distributes equal gaps', () => {
    const centered = centerObjects([rect('center-a', 10, 5, 5, 5), rect('center-b', 60, 5, 10, 5)], 'h', { widthMm: 100, heightMm: 70 })
    expect(centered.map((item) => item.x)).toEqual([20, 70])

    const distributedH = distributeObjects([rect('dh1', 5, 2, 10, 4), rect('dh2', 30, 2, 20, 4), rect('dh3', 80, 2, 5, 4)], 'h')
    expect(distributedH.map((item) => item.x)).toEqual([5, 37.5, 80])
    const hBounds = distributedH.map(objectBounds)
    expect(Math.abs(hBounds[1].left - hBounds[0].right - (hBounds[2].left - hBounds[1].right))).toBeLessThan(0.001)

    const distributedV = distributeObjects([rect('dv1', 2, 5, 4, 5), rect('dv2', 2, 25, 4, 15), rect('dv3', 2, 70, 4, 10)], 'v')
    expect(distributedV.map((item) => item.y)).toEqual([5, 32.5, 70])
    const vBounds = distributedV.map(objectBounds)
    expect(Math.abs(vBounds[1].top - vBounds[0].bottom - (vBounds[2].top - vBounds[1].bottom))).toBeLessThan(0.001)
  })
})

describe('resize and group geometry', () => {
  const groupFixture: LabelObject = {
    id: 'resize-group',
    type: 'group',
    x: 25,
    y: 25,
    w: 10,
    h: 10,
    rotation: 0,
    children: [rect('resize-child', 20, 20, 10, 10)]
  }
  const snapshot = structuredClone(groupFixture)

  it.each([
    ['w', 30, 10],
    ['h', 10, 20],
    ['wh', 30, 20]
  ] as const)('resizes a group in %s mode and preserves its centre', (mode, width, height) => {
    const group = resizeObjects([rect('size-reference', 0, 0, 30, 20), groupFixture], mode)[1]
    expect(group.type).toBe('group')
    expect([group.w, group.h]).toEqual([width, height])
    const leaf = flattenObjects([group])[0]
    expect([leaf.w, leaf.h]).toEqual([width, height])
    expect([leaf.x + leaf.w / 2, leaf.y + leaf.h / 2]).toEqual([25, 25])
  })

  it('does not mutate the source group', () => {
    expect(groupFixture).toEqual(snapshot)
  })

  it('scales nested groups and rejects anisotropic scaling of rotated children', () => {
    const nested: LabelObject = {
      ...groupFixture,
      children: [{ id: 'nested-resize', type: 'group', x: 25, y: 25, w: 10, h: 10, rotation: 90, children: [rect('nested-resize-leaf', 20, 20, 10, 10)] }]
    }
    const scaled = resizeObjects([rect('nested-reference', 0, 0, 30, 20), nested], 'wh')[1]
    expect(scaled.type).toBe('group')
    if (scaled.type === 'group' && scaled.children[0].type === 'group') {
      expect([scaled.children[0].w, scaled.children[0].h]).toEqual([20, 30])
    }
    expect(flattenObjects([scaled]).map((object) => [object.w, object.h, object.rotation])).toEqual([[20, 30, 90]])

    const angled: LabelObject = { ...groupFixture, children: [{ ...rect('angled-resize', 20, 20), rotation: 45 }] }
    expect(() => resizeObjects([rect('skew-reference', 0, 0, 30, 20), angled], 'wh')).toThrow(/非等比缩放/)
    const uniform = resizeObjects([rect('uniform-reference', 0, 0, 20, 20), angled], 'wh')[1]
    expect(flattenObjects([uniform]).map((object) => [object.w, object.h, object.rotation])).toEqual([[20, 10, 45]])
  })

  it('reorders forward, backward and to the back', () => {
    expect(reorderObjects(source, new Set(['b']), 'forward').map((item) => item.id)).toEqual(['a', 'c', 'b'])
    expect(reorderObjects(source, new Set(['b']), 'backward').map((item) => item.id)).toEqual(['b', 'a', 'c'])
    expect(reorderObjects(source, new Set(['c']), 'back').map((item) => item.id)).toEqual(['c', 'a', 'b'])
  })

  it('reorders, rotates and computes rotated bounds', () => {
    expect(reorderObjects(source, new Set(['a']), 'front').map((item) => item.id)).toEqual(['b', 'c', 'a'])
    const rotated = rotateObjects([rect('r1', 10, 10, 10, 4), rect('r2', 30, 10, 10, 4)], 90)
    expect(Math.round(rotated[0].x)).toBe(20)
    expect(Math.round(rotated[0].y)).toBe(0)
    expect(objectBounds({ ...rect('rb', 10, 10, 10, 4), rotation: 45 }).right).toBeGreaterThan(19.9)
  })
})

describe('group, ungroup and dataset references', () => {
  it('replaces dataset references recursively', () => {
    const nested = {
      id: 'g',
      type: 'group' as const,
      x: 20,
      y: 20,
      w: 20,
      h: 10,
      rotation: 0,
      children: [{ ...rect('child', 1, 1), source: { kind: 'database' as const, dataset: 'orders', field: 'name' } }]
    }
    const cleaned = replaceDatasetReferences([nested], 'orders')
    expect(cleaned[0].type).toBe('group')
    expect((cleaned[0] as typeof nested).children[0].source).toEqual({ kind: 'constant', value: '' })
  })

  it('groups and ungroups without losing nested transforms', () => {
    const grouped = groupObjects(source, new Set(['a', 'b']), 'g')
    expect(grouped.groupId).toBe('g')
    expect(grouped.objects).toHaveLength(2)
    expect(grouped.objects[1].type).toBe('group')
    expect(ungroupObjects(grouped.objects, new Set(['g'])).map((item) => item.id)).toEqual(['c', 'a', 'b'])
    expect(ungroupObjects(source, new Set(['missing']))).toBe(source)

    for (const angle of [0, 90, 180, 270, 37]) {
      const rotatedGroup: LabelObject = {
        id: 'outer',
        type: 'group',
        x: 30,
        y: 25,
        w: 40,
        h: 30,
        rotation: angle,
        children: [
          { ...rect('direct', 12, 16), rotation: 15 },
          {
            id: 'inner',
            type: 'group',
            x: 40,
            y: 30,
            w: 20,
            h: 10,
            rotation: 30,
            children: [rect('inner-leaf', 33, 27), { id: 'deep', type: 'group', x: 45, y: 34, w: 5, h: 5, rotation: 20, children: [rect('deep-leaf', 43, 32, 2, 2)] }]
          }
        ]
      }
      const snapshot = structuredClone(rotatedGroup)
      const before = flattenObjects([rotatedGroup])
      const ungrouped = ungroupObjects([rotatedGroup], new Set(['outer']))
      expect(ungrouped[1].type).toBe('group')
      const after = flattenObjects(ungrouped)
      expect(after.map((object) => object.id)).toEqual(before.map((object) => object.id))
      before.forEach((object, index) => {
        for (const key of ['x', 'y', 'rotation'] as const) {
          expect(Math.abs(after[index][key] - object[key])).toBeLessThanOrEqual(0.03)
        }
      })
      expect(rotatedGroup).toEqual(snapshot)
    }
  })

  it('uses visual union bounds and unlocks grouped members', () => {
    const locked = { ...rect('locked-member', 30, 30, 10, 10), locked: true }
    const rotated = { ...rect('rotated-member', 50, 30, 20, 4), rotation: 90 }
    const grouped = groupObjects([locked, rotated], new Set(['locked-member', 'rotated-member']), 'gu')
    const union = grouped.objects[0]
    const lockedBounds = objectBounds(locked)
    const rotatedBounds = objectBounds(rotated)
    const round2 = (value: number) => Math.round(value * 100) / 100
    expect([union.x, union.y, union.w, union.h]).toEqual([
      round2((Math.min(lockedBounds.left, rotatedBounds.left) + Math.max(lockedBounds.right, rotatedBounds.right)) / 2),
      round2((Math.min(lockedBounds.top, rotatedBounds.top) + Math.max(lockedBounds.bottom, rotatedBounds.bottom)) / 2),
      round2(Math.max(lockedBounds.right, rotatedBounds.right) - Math.min(lockedBounds.left, rotatedBounds.left)),
      round2(Math.max(lockedBounds.bottom, rotatedBounds.bottom) - Math.min(lockedBounds.top, rotatedBounds.top))
    ])
    expect(union.type === 'group' ? (union.children.find((child) => child.id === 'locked-member')?.locked ?? false) : 'bad').toBe(false)
    expect(isPositionLocked(locked)).toBe(true)
    expect(isPositionLocked(rect('free', 1, 1))).toBe(false)
  })
})

describe('canvas coordinates and resize constraints', () => {
  it('maps client points at 0/90/270 degrees', () => {
    expect(clientToCanvasPoint({ x: 150, y: 100 }, { left: 100, top: 50, width: 100, height: 100 }, 100, 100, 1, 0)).toEqual({ x: 50, y: 50 })
    expect(clientToCanvasPoint({ x: 50, y: 100 }, { left: 50, top: 100, width: 100, height: 200 }, 200, 100, 1, 90)).toEqual({ x: 0, y: 100 })
    expect(clientToCanvasPoint({ x: 100, y: 50 }, { left: 100, top: 50, width: 100, height: 200 }, 200, 100, 1, 270)).toEqual({ x: 200, y: 0 })
  })

  it('snaps and constrains barcode, square and text resizes', () => {
    expect(snapResizeMm(4.04)).toBe(4)
    expect(snapResizeMm(4.06)).toBe(4.1)

    const barcode = constrainFabricResize({
      object: { ...rect('barcode', 1, 1, 20, 10), type: 'barcode', symbology: 'code128', showText: true, source: { kind: 'constant', value: '1' } } as LabelObject,
      baseWidthPx: 80,
      baseHeightPx: 40,
      scaleX: 1.013,
      scaleY: 1.027,
      corner: 'br',
      shiftKey: false,
      pixelsPerMm: 4
    })
    expect(Math.abs(barcode.widthMm * 10 - Math.round(barcode.widthMm * 10))).toBeLessThan(RESIZE_STEP_MM / 10)
    expect(Math.abs(barcode.heightMm * 10 - Math.round(barcode.heightMm * 10))).toBeLessThan(RESIZE_STEP_MM / 10)

    const square = constrainFabricResize({ object: rect('square', 1, 1, 20, 10), baseWidthPx: 80, baseHeightPx: 40, scaleX: 1.4, scaleY: 1.1, corner: 'br', shiftKey: true, pixelsPerMm: 4 })
    expect(square.widthMm).toBe(square.heightMm)

    const text = constrainFabricResize({
      object: { ...rect('font', 1, 1, 20, 10), type: 'text', fontFamily: '微软雅黑', fontSize: 4, bold: false, align: 'left', color: '#000', source: { kind: 'constant', value: 'A' } } as LabelObject,
      baseWidthPx: 80,
      baseHeightPx: 40,
      scaleX: 1.4,
      scaleY: 0.7,
      corner: 'br',
      shiftKey: false,
      pixelsPerMm: 4
    })
    expect(text.widthMm / text.heightMm).toBe(2)

    const textMiddle = constrainFabricResize({
      object: { ...rect('font2', 1, 1, 20, 10), type: 'text', fontFamily: '微软雅黑', fontSize: 4, bold: false, align: 'left', color: '#000', source: { kind: 'constant', value: 'A' } } as LabelObject,
      baseWidthPx: 80,
      baseHeightPx: 40,
      scaleX: 1.4,
      scaleY: 0.7,
      corner: 'e',
      shiftKey: false,
      pixelsPerMm: 4
    })
    expect(textMiddle.widthMm / textMiddle.heightMm).not.toBe(2)
  })
})

describe('availability, table helpers and factory defaults', () => {
  it('projects the availability matrix consistently', () => {
    expect(editorAvailability({ isStart: true, hasDatabase: true, selectionCount: 2, selectedGroup: true }).canDatabaseNavigate).toBe(false)
    expect(editorAvailability({ isStart: true, hasDatabase: true, selectionCount: 2, selectedGroup: true }).canGroup).toBe(false)
    expect(editorAvailability({ isStart: true, hasDatabase: true, selectionCount: 2, selectedGroup: true }).canUngroup).toBe(false)
    expect(editorAvailability({ isStart: false, hasDatabase: false, selectionCount: 0, selectedGroup: false }).canDatabaseNavigate).toBe(false)
    expect(editorAvailability({ isStart: false, hasDatabase: true, selectionCount: 1, selectedGroup: false }).canDatabaseNavigate).toBe(true)
    expect(editorAvailability({ isStart: false, hasDatabase: true, selectionCount: 2, selectedGroup: false }).canGroup).toBe(true)
    expect(editorAvailability({ isStart: false, hasDatabase: true, selectionCount: 1, selectedGroup: true }).canUngroup).toBe(true)
  })

  it('handles merged table segments and object formatting', () => {
    const merged = { id: 'table', type: 'table' as const, x: 1, y: 1, w: 30, h: 20, rotation: 0, rows: 3, cols: 3, borderWidth: 0.3, borderColor: '#000', merges: [{ r: 0, c: 0, r2: 1, c2: 1 }] }
    expect(tableMergeAt(merged, 1, 1)).toEqual(merged.merges[0])
    expect(tableSegmentHidden(merged, 0, 1, 'v')).toBe(true)
    expect(tableSegmentHidden(merged, 1, 1, 'v')).toBe(true)
    expect(tableSegmentHidden(merged, 1, 0, 'h')).toBe(true)
    expect(tableSegmentHidden(merged, 1, 2, 'h')).toBe(false)

    expect(applyObjectFormat('12.34', undefined, { start: 0, length: 0, cutType: 'keepInt' })).toBe('12')
    expect(applyObjectFormat('12.34', undefined, { start: 0, length: 0, cutType: 'keepDecimal' })).toBe('.34')
    expect(applyObjectFormat('  12.34  ', undefined, { start: 0, length: 0, cutType: 'trimLeft' })).toBe('12.34  ')
    expect(applyObjectFormat('  12.34  ', undefined, { start: 0, length: 0, cutType: 'trimRight' })).toBe('  12.34')
  })

  it('defaults table keepSize to false and honors the option', () => {
    const defaultTable = createLabelObject('table', 0, 0)
    expect(defaultTable?.type === 'table' && Boolean(defaultTable.keepSize)).toBe(false)
    const keptTable = createLabelObject('table', 0, 0, { tableKeepSize: true })
    expect(keptTable?.type === 'table' && keptTable.keepSize).toBe(true)
  })
})
