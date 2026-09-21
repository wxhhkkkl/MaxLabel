import assert from 'node:assert'
import type { LabelObject } from '../src/shared/model'
import { alignObjects, centerObjects, distributeObjects, groupObjects, isPositionLocked, objectBounds, reorderObjects, resizeObjects, rotateObjects, ungroupObjects } from '../src/renderer/src/features/editor/operations'
import { replaceDatasetReferences } from '../src/shared/domain/objects'
import { applyObjectFormat } from '../src/shared/domain/datasource'
import { clientToCanvasPoint } from '../src/renderer/src/editor/canvasCoordinates'
import { detectDelimiter, parseCSV } from '../src/renderer/src/editor/dataImport'
import { constrainFabricResize, LABELSHOP_RESIZE_STEP_MM, snapResizeMm } from '../src/renderer/src/features/editor/resizeBehavior'
import { editorAvailability } from '../src/renderer/src/features/editor/editorAvailability'
import { tableMergeAt, tableSegmentHidden } from '../src/shared/table'

const rect = (id: string, x: number, y: number, w = 10, h = 5): LabelObject => ({ id, type: 'rect', x, y, w, h, rotation: 0, fill: 'transparent', stroke: '#000', strokeWidth: 0.2 })

const source = [rect('a', 1, 2), rect('b', 20, 8), rect('c', 50, 14)]
assert.deepStrictEqual(alignObjects(source, 'left').map((item) => item.x), [1, 1, 1])
assert.deepStrictEqual(distributeObjects(source, 'h').map((item) => item.x), [1, 25.5, 50])

// LabelShop's blue-handle object is the alignment reference, even when it is
// not the leftmost/rightmost object in the selection.
const alignmentReference = rect('reference', 40, 10, 10, 5)
const alignmentPeers = [rect('left-peer', 5, 20, 8, 5), rect('right-peer', 70, 30, 12, 5)]
assert.deepStrictEqual(alignObjects([alignmentReference, ...alignmentPeers], 'left').map((item) => item.x), [40, 40, 40])
assert.deepStrictEqual(alignObjects([alignmentReference, ...alignmentPeers], 'right').map((item) => item.x), [40, 42, 38])
assert.deepStrictEqual(alignObjects([alignmentReference, ...alignmentPeers], 'midH').map((item) => item.y), [10, 10, 10])

// toolbar_align.html: 尺寸三项「设定与参考对象的宽度/高度相同」——参考对象是首个选取
// （蓝色句柄）对象，不是选区里最大的那个。
assert.deepStrictEqual(resizeObjects([alignmentReference, ...alignmentPeers], 'w').map((item) => item.w), [10, 10, 10])
assert.deepStrictEqual(resizeObjects([alignmentReference, ...alignmentPeers], 'h').map((item) => item.h), [5, 5, 5])
assert.deepStrictEqual(resizeObjects([alignmentReference, ...alignmentPeers], 'wh').map((item) => [item.w, item.h]), [[10, 5], [10, 5], [10, 5]])
assert.deepStrictEqual(resizeObjects([rect('solo', 0, 0)], 'w').map((item) => item.w), [10])

// Multiple selected objects are centered as one visual group, preserving the
// gap between them instead of stacking every object on the paper center.
const centered = centerObjects([rect('center-a', 10, 5, 5, 5), rect('center-b', 60, 5, 10, 5)], 'h', { widthMm: 100, heightMm: 70 })
assert.deepStrictEqual(centered.map((item) => item.x), [20, 70])

// Distribution keeps the first/last visual edges fixed and equalizes gaps,
// including when the selected objects have different widths/heights.
const distributedH = distributeObjects([rect('dh1', 5, 2, 10, 4), rect('dh2', 30, 2, 20, 4), rect('dh3', 80, 2, 5, 4)], 'h')
assert.deepStrictEqual(distributedH.map((item) => item.x), [5, 37.5, 80])
const hBounds = distributedH.map(objectBounds)
assert.ok(Math.abs((hBounds[1].left - hBounds[0].right) - (hBounds[2].left - hBounds[1].right)) < 0.001)
const distributedV = distributeObjects([rect('dv1', 2, 5, 4, 5), rect('dv2', 2, 25, 4, 15), rect('dv3', 2, 70, 4, 10)], 'v')
assert.deepStrictEqual(distributedV.map((item) => item.y), [5, 32.5, 70])
const vBounds = distributedV.map(objectBounds)
assert.ok(Math.abs((vBounds[1].top - vBounds[0].bottom) - (vBounds[2].top - vBounds[1].bottom)) < 0.001)

assert.deepStrictEqual(reorderObjects(source, new Set(['a']), 'front').map((item) => item.id), ['b', 'c', 'a'])
const rotated = rotateObjects([rect('r1', 10, 10, 10, 4), rect('r2', 30, 10, 10, 4)], 90)
assert.strictEqual(Math.round(rotated[0].x), 20)
assert.strictEqual(Math.round(rotated[0].y), 0)
assert.ok(objectBounds({ ...rect('rb', 10, 10, 10, 4), rotation: 45 }).right > 19.9)

const nested = { id: 'g', type: 'group' as const, x: 20, y: 20, w: 20, h: 10, rotation: 0, children: [
  { ...rect('child', 1, 1), source: { kind: 'database' as const, dataset: 'orders', field: 'name' } }
] }
const cleaned = replaceDatasetReferences([nested], 'orders')
assert.strictEqual((cleaned[0].type === 'group' && cleaned[0].children[0].type === 'rect') ? 'ok' : 'bad', 'ok')
assert.deepStrictEqual((cleaned[0] as typeof nested).children[0].source, { kind: 'constant', value: '' })

const grouped = groupObjects(source, new Set(['a', 'b']), 'g')
assert.strictEqual(grouped.groupId, 'g')
assert.strictEqual(grouped.objects.length, 2)
assert.strictEqual(grouped.objects[1].type, 'group')
const restored = ungroupObjects(grouped.objects, new Set(['g']))
assert.deepStrictEqual(restored.map((item) => item.id), ['c', 'a', 'b'])
assert.strictEqual(ungroupObjects(source, new Set(['missing'])), source)

// label_object_align_group.html + label_object_page_general.html: the new group box is
// the union of the *visual* bounds (rotation included) and a locked member loses its
// position lock once it is grouped.
const lockedMember = { ...rect('locked-member', 30, 30, 10, 10), locked: true }
const rotatedMember = { ...rect('rotated-member', 50, 30, 20, 4), rotation: 90 }
const groupedUnion = groupObjects([lockedMember, rotatedMember], new Set(['locked-member', 'rotated-member']), 'gu')
const unionGroup = groupedUnion.objects[0]
const lockedBounds = objectBounds(lockedMember)
const rotatedBounds = objectBounds(rotatedMember)
const round2 = (value: number) => Math.round(value * 100) / 100
assert.deepStrictEqual(
  [unionGroup.x, unionGroup.y, unionGroup.w, unionGroup.h],
  [
    round2((Math.min(lockedBounds.left, rotatedBounds.left) + Math.max(lockedBounds.right, rotatedBounds.right)) / 2),
    round2((Math.min(lockedBounds.top, rotatedBounds.top) + Math.max(lockedBounds.bottom, rotatedBounds.bottom)) / 2),
    round2(Math.max(lockedBounds.right, rotatedBounds.right) - Math.min(lockedBounds.left, rotatedBounds.left)),
    round2(Math.max(lockedBounds.bottom, rotatedBounds.bottom) - Math.min(lockedBounds.top, rotatedBounds.top))
  ]
)
assert.strictEqual(unionGroup.type === 'group' ? (unionGroup.children.find((child) => child.id === 'locked-member')?.locked ?? false) : 'bad', false)
assert.strictEqual(isPositionLocked(lockedMember), true)
assert.strictEqual(isPositionLocked(rect('free', 1, 1)), false)

const point0 = clientToCanvasPoint({ x: 150, y: 100 }, { left: 100, top: 50, width: 100, height: 100 }, 100, 100, 1, 0)
assert.deepStrictEqual(point0, { x: 50, y: 50 })
const point90 = clientToCanvasPoint({ x: 50, y: 100 }, { left: 50, top: 100, width: 100, height: 200 }, 200, 100, 1, 90)
assert.deepStrictEqual(point90, { x: 0, y: 100 })
const point270 = clientToCanvasPoint({ x: 100, y: 50 }, { left: 100, top: 50, width: 100, height: 200 }, 200, 100, 1, 270)
assert.deepStrictEqual(point270, { x: 200, y: 0 })

assert.strictEqual(detectDelimiter('name\tvalue\nA\t1\nB\t2'), '\t')
assert.strictEqual(detectDelimiter('name;value\nA;1'), ';')
assert.deepStrictEqual(parseCSV('name\tvalue\n"A,B"\t1', '\t'), [['name', 'value'], ['A,B', '1']])

assert.strictEqual(snapResizeMm(4.04), 4)
assert.strictEqual(snapResizeMm(4.06), 4.1)
const barcodeResize = constrainFabricResize({ object: { ...rect('barcode', 1, 1, 20, 10), type: 'barcode', symbology: 'code128', showText: true, source: { kind: 'constant', value: '1' } } as LabelObject, baseWidthPx: 80, baseHeightPx: 40, scaleX: 1.013, scaleY: 1.027, corner: 'br', shiftKey: false, pixelsPerMm: 4 })
assert.ok(Math.abs(barcodeResize.widthMm * 10 - Math.round(barcodeResize.widthMm * 10)) < LABELSHOP_RESIZE_STEP_MM / 10)
assert.ok(Math.abs(barcodeResize.heightMm * 10 - Math.round(barcodeResize.heightMm * 10)) < LABELSHOP_RESIZE_STEP_MM / 10)
const squareResize = constrainFabricResize({ object: rect('square', 1, 1, 20, 10), baseWidthPx: 80, baseHeightPx: 40, scaleX: 1.4, scaleY: 1.1, corner: 'br', shiftKey: true, pixelsPerMm: 4 })
assert.strictEqual(squareResize.widthMm, squareResize.heightMm)
const textCorner = constrainFabricResize({ object: { ...rect('font', 1, 1, 20, 10), type: 'text', fontFamily: '微软雅黑', fontSize: 4, bold: false, align: 'left', color: '#000', source: { kind: 'constant', value: 'A' } } as LabelObject, baseWidthPx: 80, baseHeightPx: 40, scaleX: 1.4, scaleY: 0.7, corner: 'br', shiftKey: false, pixelsPerMm: 4 })
assert.strictEqual(textCorner.widthMm / textCorner.heightMm, 2)
const textMiddle = constrainFabricResize({ object: { ...rect('font2', 1, 1, 20, 10), type: 'text', fontFamily: '微软雅黑', fontSize: 4, bold: false, align: 'left', color: '#000', source: { kind: 'constant', value: 'A' } } as LabelObject, baseWidthPx: 80, baseHeightPx: 40, scaleX: 1.4, scaleY: 0.7, corner: 'e', shiftKey: false, pixelsPerMm: 4 })
assert.notStrictEqual(textMiddle.widthMm / textMiddle.heightMm, 2)

// The menu and both editor bars consume the same availability projection.
// Keep the complete matrix here so a future surface cannot accidentally
// enable a command that the other surfaces disable.
const startAvailability = editorAvailability({ isStart: true, hasDatabase: true, selectionCount: 2, selectedGroup: true })
assert.strictEqual(startAvailability.canDatabaseNavigate, false)
assert.strictEqual(startAvailability.canGroup, false)
assert.strictEqual(startAvailability.canUngroup, false)
const emptyAvailability = editorAvailability({ isStart: false, hasDatabase: false, selectionCount: 0, selectedGroup: false })
assert.strictEqual(emptyAvailability.canDatabaseNavigate, false)
assert.strictEqual(emptyAvailability.canGroup, false)
assert.strictEqual(emptyAvailability.canUngroup, false)
const selectedAvailability = editorAvailability({ isStart: false, hasDatabase: true, selectionCount: 1, selectedGroup: false })
assert.strictEqual(selectedAvailability.canDatabaseNavigate, true)
assert.strictEqual(selectedAvailability.canGroup, false)
assert.strictEqual(selectedAvailability.canUngroup, false)
const twoObjectsAvailability = editorAvailability({ isStart: false, hasDatabase: true, selectionCount: 2, selectedGroup: false })
assert.strictEqual(twoObjectsAvailability.canGroup, true)
const groupAvailability = editorAvailability({ isStart: false, hasDatabase: true, selectionCount: 1, selectedGroup: true })
assert.strictEqual(groupAvailability.canUngroup, true)

const mergedTable = { id: 'table', type: 'table' as const, x: 1, y: 1, w: 30, h: 20, rotation: 0, rows: 3, cols: 3, borderWidth: 0.3, borderColor: '#000', merges: [{ r: 0, c: 0, r2: 1, c2: 1 }] }
assert.deepStrictEqual(tableMergeAt(mergedTable, 1, 1), mergedTable.merges[0])
assert.strictEqual(tableSegmentHidden(mergedTable, 0, 1, 'v'), true)
assert.strictEqual(tableSegmentHidden(mergedTable, 1, 1, 'v'), true)
assert.strictEqual(tableSegmentHidden(mergedTable, 1, 0, 'h'), true)
assert.strictEqual(tableSegmentHidden(mergedTable, 1, 2, 'h'), false)

// 帮助 datasource_advanced_cut.html：截短的「保留」也可以单独保留数字的整数或者小数部分（含小数点）。
assert.strictEqual(applyObjectFormat('12.34', undefined, { start: 0, length: 0, cutType: 'keepInt' }), '12')
assert.strictEqual(applyObjectFormat('12.34', undefined, { start: 0, length: 0, cutType: 'keepDecimal' }), '.34')
assert.strictEqual(applyObjectFormat('  12.34  ', undefined, { start: 0, length: 0, cutType: 'trimLeft' }), '12.34  ')
assert.strictEqual(applyObjectFormat('  12.34  ', undefined, { start: 0, length: 0, cutType: 'trimRight' }), '  12.34')
console.log('40 editor operation checks passed')