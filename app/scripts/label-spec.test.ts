import assert from 'node:assert/strict'
import type { LabelDoc } from '../src/shared/domain'
import { labelSpecOf } from '../src/renderer/src/features/workspace/labelSpec'

const base: LabelDoc = {
  version: 2,
  name: '规格测试',
  widthMm: 100,
  heightMm: 70,
  objects: []
}

assert.equal(labelSpecOf(base), '100mm x 70mm')
assert.equal(labelSpecOf({ ...base, widthMm: 100.5, heightMm: 70.25, layout: { rows: 4, cols: 2, rowGapMm: 2, colGapMm: 2, shape: 'roundRect' } }), '100.5mm x 70.25mm 圆角8枚/页')
assert.equal(labelSpecOf({ ...base, layout: { rows: 4, cols: 2, rowGapMm: 2, colGapMm: 2, shape: 'roundRect', pagesPerBox: 20 } }), '100mm x 70mm 圆角8枚/页 20页/盒')
assert.equal(labelSpecOf({ ...base, layout: { rows: 1, cols: 1, rowGapMm: 2, colGapMm: 2, shape: 'ellipse', pagesPerBox: 20 } }), '100mm x 70mm')
assert.equal(labelSpecOf({ ...base, layout: { rows: 2, cols: 2, rowGapMm: 2, colGapMm: 2, shape: 'disc' } }), '100mm x 70mm 圆形4枚/页')
assert.equal(labelSpecOf({ ...base, layout: { rows: 2, cols: 2, rowGapMm: 2, colGapMm: 2, shape: 'rect' } }), '100mm x 70mm 直角4枚/页')

console.log('6 label specification checks passed')
