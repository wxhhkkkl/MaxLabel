import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LAYER_ID,
  creatableLayerId,
  isObjectLocked,
  isObjectVisible,
  moveObjectsToLayer,
  normalizeLayers,
  orderedObjects,
  setLayerLocked,
  setLayerVisible
} from '@shared/domain/layers'
import type { LabelDoc } from '@shared/domain/document'
import type { LabelObject } from '@shared/domain/objects'

function obj(id: string, layerId: string, extra: Partial<LabelObject> = {}): LabelObject {
  return { id, type: 'rect', x: 0, y: 0, w: 10, h: 10, rotation: 0, layerId, ...extra } as LabelObject
}

function doc(): LabelDoc {
  return {
    version: 3, name: 't', widthMm: 100, heightMm: 100,
    layers: normalizeLayers([
      { id: DEFAULT_LAYER_ID, name: '默认' },
      { id: 'l2', name: '图层 2' }
    ]),
    objects: [
      obj('a', DEFAULT_LAYER_ID),
      obj('b', DEFAULT_LAYER_ID),
      { id: 'g', type: 'group', x: 0, y: 0, w: 10, h: 10, rotation: 0, layerId: 'l2', children: [obj('c1', 'l2'), obj('c2', 'l2')] } as LabelObject
    ]
  } as LabelDoc
}

describe('US1 —— 对象归属与图层传播', () => {
  it('把对象移到其它图层后，排序与归属一起变化', () => {
    const before = doc()
    const after = moveObjectsToLayer(before, new Set(['b']), 'l2')
    expect(after.objects.find((o) => o.id === 'b')?.layerId).toBe('l2')
    expect(orderedObjects(after).map((o) => o.id)).toEqual(['a', 'b', 'g'])
    // 原文档未被修改（撤销栈依赖不可变更新）
    expect(before.objects.find((o) => o.id === 'b')?.layerId).toBe(DEFAULT_LAYER_ID)
  })

  it('移动分组时组内对象跟随，且不能单独跨层', () => {
    const after = moveObjectsToLayer(doc(), new Set(['g']), DEFAULT_LAYER_ID)
    const group = after.objects.find((o) => o.id === 'g')
    expect(group?.layerId).toBe(DEFAULT_LAYER_ID)
    expect(group?.type).toBe('group')
    if (group?.type === 'group') {
      expect(group.children.every((child) => child.layerId === DEFAULT_LAYER_ID)).toBe(true)
    }
  })

  it('隐藏图层后其下对象全部不可见；取消隐藏后恢复', () => {
    const hidden = setLayerVisible(doc(), 'l2', false)
    expect(isObjectVisible(hidden, hidden.objects.find((o) => o.id === 'g')!)).toBe(false)
    expect(isObjectVisible(hidden, hidden.objects.find((o) => o.id === 'a')!)).toBe(true)
    const shown = setLayerVisible(hidden, 'l2', true)
    expect(isObjectVisible(shown, shown.objects.find((o) => o.id === 'g')!)).toBe(true)
  })

  it('锁定图层后其下对象全部锁定', () => {
    const locked = setLayerLocked(doc(), 'l2', true)
    expect(isObjectLocked(locked, locked.objects.find((o) => o.id === 'g')!)).toBe(true)
    expect(isObjectLocked(locked, locked.objects.find((o) => o.id === 'a')!)).toBe(false)
  })

  it('活动图层隐藏/锁定时不允许新建对象（Q4=B）', () => {
    const hidden = setLayerVisible(doc(), 'l2', false)
    expect(creatableLayerId(hidden, 'l2')).toBeNull()
    const locked = setLayerLocked(doc(), 'l2', true)
    expect(creatableLayerId(locked, 'l2')).toBeNull()
    expect(creatableLayerId(doc(), 'l2')).toBe('l2')
  })
})
