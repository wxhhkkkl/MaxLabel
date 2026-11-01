import { describe, expect, it } from 'vitest'
import { DOCUMENT_MODEL_VERSION, normalizeDocument } from '@shared/domain'
import { DEFAULT_LAYER_ID } from '@shared/domain/layers'
import type { LabelObject } from '@shared/domain/objects'
import { sampleDoc } from '../../../helpers/factories'

describe('文档迁移 —— 真图层（v2 → v3）', () => {
  it('文档模型版本升到 3', () => {
    expect(DOCUMENT_MODEL_VERSION).toBe(3)
  })

  it('没有 layers 的旧文档补默认图层，所有对象归默认', () => {
    const old = { ...sampleDoc(), version: 2 } as Record<string, unknown>
    delete old.layers
    const doc = normalizeDocument(old)
    expect(doc.layers?.map((layer) => layer.id)).toEqual([DEFAULT_LAYER_ID])
    expect(doc.objects.every((object) => object.layerId === DEFAULT_LAYER_ID)).toBe(true)
  })

  it('未知 layerId 归默认图层', () => {
    const source = {
      ...sampleDoc(),
      layers: [{ id: 'real', name: '真实层' }],
      objects: sampleDoc().objects.map((object, index) =>
        index === 0 ? { ...object, layerId: 'missing' } : { ...object, layerId: 'real' })
    }
    const doc = normalizeDocument(source)
    expect(doc.objects[0].layerId).toBe(DEFAULT_LAYER_ID)
    expect(doc.objects[1].layerId).toBe('real')
  })

  it('分组子对象跟随父组图层，且不能单独跨层', () => {
    const child: LabelObject = {
      id: 'c1', type: 'rect', x: 1, y: 1, w: 5, h: 5, rotation: 0,
      layerId: 'other'
    } as LabelObject
    const group: LabelObject = {
      id: 'g1', type: 'group', x: 0, y: 0, w: 10, h: 10, rotation: 0,
      layerId: 'real',
      children: [child]
    } as LabelObject
    const source = {
      ...sampleDoc(),
      layers: [{ id: 'real', name: '真实层' }],
      objects: [group]
    }
    const doc = normalizeDocument(source)
    const normalizedGroup = doc.objects[0]
    expect(normalizedGroup.layerId).toBe('real')
    expect(normalizedGroup.type).toBe('group')
    if (normalizedGroup.type === 'group') {
      expect(normalizedGroup.children.every((item) => item.layerId === 'real')).toBe(true)
    }
  })

  it('图层名称为空时回退 id，重名允许但保留唯一 id', () => {
    const doc = normalizeDocument({
      ...sampleDoc(),
      layers: [
        { id: 'a', name: '同名' },
        { id: 'b', name: '同名' },
        { id: 'c', name: '' }
      ]
    })
    expect(doc.layers?.map((layer) => layer.name)).toContain('同名')
    expect(doc.layers?.find((layer) => layer.id === 'c')?.name).toBe('c')
  })
})
