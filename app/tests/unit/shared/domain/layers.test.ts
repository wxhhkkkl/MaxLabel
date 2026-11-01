import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LAYER_ID,
  MAX_DOCUMENT_LAYERS,
  createDefaultLayer,
  isObjectLocked,
  isObjectVisible,
  layerById,
  normalizeLayers,
  objectCountOfLayer,
  orderedObjects,
  orderedVisibleObjects
} from '@shared/domain/layers'
import type { LabelDoc } from '@shared/domain/document'
import type { LabelObject } from '@shared/domain/objects'

/** 造一个最小对象（只带图层相关字段） */
function obj(id: string, layerId: string | undefined, extra: Partial<LabelObject> = {}): LabelObject {
  return { id, type: 'rect', x: 0, y: 0, w: 10, h: 10, rotation: 0, ...(layerId ? { layerId } : {}), ...extra } as LabelObject
}

function doc(layers: LabelDoc['layers'], objects: LabelObject[]): LabelDoc {
  return { version: 3, name: 't', widthMm: 100, heightMm: 100, objects, layers } as LabelDoc
}

describe('layers —— 默认图层与归一化', () => {
  it('createDefaultLayer 返回 default / 默认 / 可见 / 未锁定', () => {
    expect(createDefaultLayer()).toEqual({
      id: DEFAULT_LAYER_ID,
      name: '默认',
      visible: true,
      locked: false
    })
  })

  it('缺失或空数组都补默认图层', () => {
    expect(normalizeLayers(undefined).map((layer) => layer.id)).toEqual([DEFAULT_LAYER_ID])
    expect(normalizeLayers([]).map((layer) => layer.id)).toEqual([DEFAULT_LAYER_ID])
  })

  it('保留顺序、去重 id、裁剪名称，并保证默认图层在最底层', () => {
    const layers = normalizeLayers([
      { id: 'l1', name: '  图层 1  ' },
      { id: 'l1', name: '重复 id' },
      { id: 'l2', name: '' },
      { id: DEFAULT_LAYER_ID, name: '底层' }
    ])
    expect(layers[0].id).toBe(DEFAULT_LAYER_ID)
    expect(layers.map((layer) => layer.id)).toEqual([DEFAULT_LAYER_ID, 'l1', 'l2'])
    expect(layers[1].name).toBe('图层 1')
    expect(layers[2].name).toBe('l2')
  })

  it(`最多保留 ${MAX_DOCUMENT_LAYERS} 个图层`, () => {
    const many = Array.from({ length: MAX_DOCUMENT_LAYERS + 5 }, (_, i) => ({ id: `l${i}`, name: `图层${i}` }))
    expect(normalizeLayers([...many, { id: DEFAULT_LAYER_ID, name: '默认' }])).toHaveLength(MAX_DOCUMENT_LAYERS)
  })

  it('layerById 找不到时返回 undefined', () => {
    const layers = normalizeLayers([{ id: 'l1', name: '图层 1' }])
    expect(layerById(layers, 'l1')?.name).toBe('图层 1')
    expect(layerById(layers, 'nope')).toBeUndefined()
    expect(layerById(layers, null)).toBeUndefined()
  })
})

describe('layers —— 有效可见 / 锁定', () => {
  const layers = normalizeLayers([
    { id: 'hidden', name: '隐藏层', visible: false },
    { id: 'locked', name: '锁定层', locked: true }
  ])

  it('对象自身隐藏 + 图层隐藏都算不可见', () => {
    const d = doc(layers, [])
    expect(isObjectVisible(d, obj('a', DEFAULT_LAYER_ID))).toBe(true)
    expect(isObjectVisible(d, obj('b', DEFAULT_LAYER_ID, { visible: false }))).toBe(false)
    expect(isObjectVisible(d, obj('c', 'hidden'))).toBe(false)
  })

  it('对象锁定 + 图层锁定都算锁定', () => {
    const d = doc(layers, [])
    expect(isObjectLocked(d, obj('a', DEFAULT_LAYER_ID))).toBe(false)
    expect(isObjectLocked(d, obj('b', DEFAULT_LAYER_ID, { locked: true }))).toBe(true)
    expect(isObjectLocked(d, obj('c', 'locked'))).toBe(true)
  })

  it('未知 layerId 归默认图层（可见、未锁定）', () => {
    const d = doc(layers, [])
    expect(isObjectVisible(d, obj('a', 'missing'))).toBe(true)
    expect(isObjectLocked(d, obj('a', 'missing'))).toBe(false)
  })
})

describe('layers —— 排序与计数', () => {
  const layers = normalizeLayers([
    { id: 'bottom', name: '底' },
    { id: 'top', name: '顶' },
    { id: DEFAULT_LAYER_ID, name: '默认' }
  ])
  // normalizeLayers 会把默认层放到最底层：default → bottom → top
  const d = doc(layers, [
    obj('t1', 'top'),
    obj('d1', DEFAULT_LAYER_ID),
    obj('b1', 'bottom'),
    obj('t2', 'top'),
    obj('d2', DEFAULT_LAYER_ID),
    obj('hidden-top', 'top', { visible: false })
  ])

  it('按图层从底到顶、层内保持原顺序', () => {
    expect(orderedObjects(d).map((o) => o.id)).toEqual(['d1', 'd2', 'b1', 't1', 't2', 'hidden-top'])
  })

  it('orderedVisibleObjects 过滤隐藏图层与隐藏对象', () => {
    const withHiddenLayer = doc(
      normalizeLayers([{ id: 'hidden', name: '隐藏层', visible: false }, { id: DEFAULT_LAYER_ID, name: '默认' }]),
      [obj('x', 'hidden'), obj('y', DEFAULT_LAYER_ID)]
    )
    expect(orderedVisibleObjects(withHiddenLayer).map((o) => o.id)).toEqual(['y'])
    expect(orderedVisibleObjects(d).map((o) => o.id)).toEqual(['d1', 'd2', 'b1', 't1', 't2'])
  })

  it('objectCountOfLayer 统计该层对象数（分组算 1 个）', () => {
    expect(objectCountOfLayer(d, 'default')).toBe(2)
    expect(objectCountOfLayer(d, 'top')).toBe(3)
    expect(objectCountOfLayer(d, 'missing')).toBe(0)
  })
})
