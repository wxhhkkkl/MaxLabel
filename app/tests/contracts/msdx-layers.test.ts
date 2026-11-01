import { describe, expect, it } from 'vitest'
import { DOCUMENT_MODEL_VERSION } from '@shared/domain'
import { DEFAULT_LAYER_ID } from '@shared/domain/layers'
import type { LabelDoc } from '@shared/domain/document'
import { fromDocJson, toMsdx } from '@/io/msdx'
import { sampleDoc } from '../helpers/factories'

/** 造一个带图层的文档：默认层 + 一个隐藏且锁定的上层 */
function layeredDoc(): LabelDoc {
  const base = sampleDoc()
  return {
    ...base,
    version: DOCUMENT_MODEL_VERSION,
    layers: [
      { id: DEFAULT_LAYER_ID, name: '默认', visible: true, locked: false },
      { id: 'l2', name: '图层 2', visible: false, locked: true }
    ],
    objects: base.objects.map((object, index) =>
      index === 0 ? { ...object, layerId: 'l2' } : { ...object, layerId: DEFAULT_LAYER_ID })
  }
}

describe('msdx v3 —— 图层持久化', () => {
  it('信封版本升到 3', () => {
    const envelope = JSON.parse(toMsdx(layeredDoc())) as { version: number }
    expect(envelope.version).toBe(3)
  })

  it('往返保留图层顺序、可见/锁定与对象归属', () => {
    const decoded = fromDocJson(toMsdx(layeredDoc()))
    expect(decoded.layers).toEqual([
      { id: DEFAULT_LAYER_ID, name: '默认', visible: true, locked: false },
      { id: 'l2', name: '图层 2', visible: false, locked: true }
    ])
    expect(decoded.objects[0].layerId).toBe('l2')
    expect(decoded.objects.slice(1).every((object) => object.layerId === DEFAULT_LAYER_ID)).toBe(true)
  })

  it('v2 信封打开后补默认图层，不丢对象', () => {
    const v2Doc = { ...layeredDoc(), version: 2 } as Record<string, unknown>
    delete v2Doc.layers
    const envelope = JSON.stringify({
      format: 'maxlabel-msdx',
      version: 2,
      app: 'MaxLabel',
      doc: v2Doc
    })
    const decoded = fromDocJson(envelope)
    expect(decoded.objects).toHaveLength(layeredDoc().objects.length)
    expect(decoded.layers?.map((layer) => layer.id)).toEqual([DEFAULT_LAYER_ID])
    expect(decoded.objects.every((object) => object.layerId === DEFAULT_LAYER_ID)).toBe(true)
  })
})
