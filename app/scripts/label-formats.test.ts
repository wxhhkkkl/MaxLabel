import assert from 'node:assert/strict'
import { LABEL_FORMATS } from '../src/shared/domain/labelFormats.generated'

assert.equal(LABEL_FORMATS.length, 275)
assert.deepEqual([...new Set(LABEL_FORMATS.map((format) => format.brandId))], [1, 2])
assert.equal(LABEL_FORMATS.filter((format) => format.brandId === 1).length, 225)
assert.equal(LABEL_FORMATS.filter((format) => format.brandId === 2).length, 50)
assert.equal(new Set(LABEL_FORMATS.map((format) => format.categoryId)).size, 17)

const defaultFormat = LABEL_FORMATS.find((format) => format.code === '608053')
assert.ok(defaultFormat)
assert.equal(defaultFormat.name, '100mm x 70mm 圆角8枚/页 20页/盒')
assert.equal(defaultFormat.pageWidthMm, 210)
assert.equal(defaultFormat.pageHeightMm, 297)
assert.equal(defaultFormat.cols, 2)
assert.equal(defaultFormat.rows, 4)
assert.equal(defaultFormat.colGapMm, 2)
assert.equal(defaultFormat.rowGapMm, 2)

const damagedName = LABEL_FORMATS.find((format) => format.code === '608020')
assert.ok(damagedName)
assert.equal(damagedName.name.includes('?'), true)
assert.equal(damagedName.name.includes(' '), true)

console.log('12 label format library checks passed')
