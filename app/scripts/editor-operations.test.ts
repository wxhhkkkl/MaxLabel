import assert from 'node:assert'
import type { LabelObject } from '../src/shared/model'
import { alignObjects, distributeObjects, groupObjects, objectBounds, reorderObjects, rotateObjects, ungroupObjects } from '../src/renderer/src/features/editor/operations'
import { replaceDatasetReferences } from '../src/shared/domain/objects'
import { clientToCanvasPoint } from '../src/renderer/src/editor/canvasCoordinates'
import { detectDelimiter, parseCSV } from '../src/renderer/src/editor/dataImport'

const rect = (id: string, x: number, y: number, w = 10, h = 5): LabelObject => ({ id, type: 'rect', x, y, w, h, rotation: 0, fill: 'transparent', stroke: '#000', strokeWidth: 0.2 })

const source = [rect('a', 1, 2), rect('b', 20, 8), rect('c', 50, 14)]
assert.deepStrictEqual(alignObjects(source, 'left').map((item) => item.x), [1, 1, 1])
assert.deepStrictEqual(distributeObjects(source, 'h').map((item) => item.x), [1, 25.5, 50])
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

const point0 = clientToCanvasPoint({ x: 150, y: 100 }, { left: 100, top: 50, width: 100, height: 100 }, 100, 100, 1, 0)
assert.deepStrictEqual(point0, { x: 50, y: 50 })
const point90 = clientToCanvasPoint({ x: 50, y: 100 }, { left: 50, top: 100, width: 100, height: 200 }, 200, 100, 1, 90)
assert.deepStrictEqual(point90, { x: 0, y: 100 })
const point270 = clientToCanvasPoint({ x: 100, y: 50 }, { left: 100, top: 50, width: 100, height: 200 }, 200, 100, 1, 270)
assert.deepStrictEqual(point270, { x: 200, y: 0 })

assert.strictEqual(detectDelimiter('name\tvalue\nA\t1\nB\t2'), '\t')
assert.strictEqual(detectDelimiter('name;value\nA;1'), ';')
assert.deepStrictEqual(parseCSV('name\tvalue\n"A,B"\t1', '\t'), [['name', 'value'], ['A,B', '1']])

console.log('16 editor operation checks passed')
