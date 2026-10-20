import { describe, expect, it } from 'vitest'
import type { LabelObject } from '@shared/domain/objects'
import { createLabelObject } from '@/features/editor/objectFactory'

function create(type: Parameters<typeof createLabelObject>[0], defaults: Parameters<typeof createLabelObject>[3] = {}): LabelObject {
  const object = createLabelObject(type, 5, 6, defaults)
  if (!object) throw new Error(`${type} was not created`)
  return object
}

describe('new object defaults', () => {
  it('creates text and data objects with the documented defaults', () => {
    expect(create('text')).toMatchObject({ type: 'text', x: 5, y: 6, w: 40, h: 8, fontSize: 4, align: 'center', source: { kind: 'constant', value: '文字内容' } })
    expect(create('data')).toMatchObject({ type: 'text', w: 44, h: 8, source: { kind: 'constant', value: '数据字段' } })
  })

  it('creates barcode and RFID defaults', () => {
    expect(create('barcode')).toMatchObject({ type: 'barcode', w: 44, h: 10, symbology: 'code128', showText: true, source: { kind: 'constant', value: '1234567890' } })
    expect(create('rfid')).toMatchObject({ type: 'rfid', w: 44, h: 10, bank: 'EPC', lock: false, source: { kind: 'serial', prefix: 'E2' } })
  })

  it('creates shape, line and image defaults', () => {
    expect(create('rect')).toMatchObject({ type: 'rect', fill: '#ffffff', stroke: '#000000', strokeWidth: 0.3 })
    expect(create('ellipse')).toMatchObject({ type: 'ellipse', fill: '#ffffff', stroke: '#000000' })
    expect(create('line')).toMatchObject({ type: 'line', w: 30, h: 0, stroke: '#000000' })
    expect(create('diagonal')).toMatchObject({ type: 'line', w: 30, h: 8 })
    expect(create('image')).toMatchObject({ type: 'image', w: 24, h: 16, imgType: 'embed', keepAspect: true })
  })

  it('reads the table keepSize default from system options', () => {
    expect(create('table')).toMatchObject({ type: 'table', w: 44, h: 24, rows: 3, cols: 2, keepSize: false })
    expect(create('table', { tableKeepSize: true })).toMatchObject({ keepSize: true })
  })

  it('returns null for a non-creatable type', () => {
    expect(createLabelObject('group', 0, 0)).toBeNull()
    expect(createLabelObject('unknown' as never, 0, 0)).toBeNull()
  })
})
