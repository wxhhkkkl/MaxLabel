import { describe, expect, it } from 'vitest'
import { propertyTabsFor } from '@/features/object-properties/propertyTabs'
import { parseGeometryDraft } from '@/features/object-properties/geometryDraft'
import { textObject } from '../../helpers/color'

describe('property tabs', () => {
  it('orders tabs per object type', () => {
    expect(propertyTabsFor('text').map((tab) => tab.key)).toEqual(['datasource', 'font', 'text', 'general'])
    expect(propertyTabsFor('barcode').map((tab) => tab.key)).toEqual(['datasource', 'barcode', 'font', 'general'])
    expect(propertyTabsFor('rfid').map((tab) => tab.key)).toEqual(['general', 'rfid', 'datasource'])
    expect(propertyTabsFor('image').map((tab) => tab.key)).toEqual(['image', 'general'])
    expect(propertyTabsFor('table').map((tab) => tab.key)).toEqual(['table', 'general'])
    for (const type of ['rect', 'ellipse', 'line'] as const) {
      expect(propertyTabsFor(type).map((tab) => tab.key)).toEqual(['shape', 'general'])
    }
    expect(propertyTabsFor('group').map((tab) => tab.key)).toEqual(['general'])
  })
})

describe('geometry draft', () => {
  const object = textObject({ x: 4, y: 5, w: 40, h: 8, rotation: 15 })

  it('parses valid numbers', () => {
    expect(parseGeometryDraft(object, { x: '10', y: '20', w: '30', h: '12', rotation: '90' }))
      .toEqual({ x: 10, y: 20, w: 30, h: 12, rotation: 90 })
  })

  it('falls back on invalid numbers', () => {
    expect(parseGeometryDraft(object, { x: 'abc', y: '', w: 'bad', h: '', rotation: 'x' }))
      .toEqual({ x: 4, y: 5, w: 40, h: 8, rotation: 15 })
  })

  it('enforces a 0.1 mm minimum size', () => {
    expect(parseGeometryDraft(object, { x: '1', y: '2', w: '0', h: '-5', rotation: '0' }))
      .toEqual({ x: 1, y: 2, w: 0.1, h: 0.1, rotation: 0 })
  })
})
