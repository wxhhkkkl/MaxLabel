import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LAYER_ID,
  activeLayerAfterDelete,
  addLayer,
  deleteLayer,
  duplicateLayer,
  moveLayer,
  normalizeLayers,
  orderedObjects,
  renameLayer
} from '@shared/domain/layers'
import type { LabelDoc } from '@shared/domain/document'
import type { LabelObject } from '@shared/domain/objects'

function obj(id: string, layerId: string): LabelObject {
  return { id, type: 'rect', x: 0, y: 0, w: 10, h: 10, rotation: 0, layerId } as LabelObject
}

function baseDoc(): LabelDoc {
  return {
    version: 3, name: 't', widthMm: 100, heightMm: 100,
    layers: normalizeLayers([
      { id: DEFAULT_LAYER_ID, name: '默认' },
      { id: 'l2', name: '图层 2' }
    ]),
    objects: [obj('a', DEFAULT_LAYER_ID), obj('b', 'l2'), obj('c', 'l2')]
  } as LabelDoc
}

/** 测试用确定性 id 生成器（禁止 Math.random） */
function seqUid(): () => string {
  let n = 0
  return () => `new-${++n}`
}

describe('US2 —— 图层命令（纯函数，交给 applyDocument 入撤销栈）', () => {
  it('新建图层追加在末尾，默认层仍在首位', () => {
    const after = addLayer(baseDoc(), { id: 'l3', name: '图层 3', visible: true, locked: false })
    expect(after.layers?.map((layer) => layer.id)).toEqual([DEFAULT_LAYER_ID, 'l2', 'l3'])
  })

  it('重命名去空白、裁剪长度；空名称不改', () => {
    const renamed = renameLayer(baseDoc(), 'l2', '  标签底图  ')
    expect(renamed.layers?.find((layer) => layer.id === 'l2')?.name).toBe('标签底图')
    const before = baseDoc()
    expect(renameLayer(before, 'l2', '   ')).toBe(before)
    const long = renameLayer(baseDoc(), 'l2', 'x'.repeat(200))
    expect(long.layers?.find((layer) => layer.id === 'l2')?.name).toHaveLength(128)
  })

  it('删除非空图层连同对象删除；默认图层拒绝删除；空图层保留', () => {
    const deleted = deleteLayer(baseDoc(), 'l2')
    expect(deleted.layers?.map((layer) => layer.id)).toEqual([DEFAULT_LAYER_ID])
    expect(deleted.objects.map((object) => object.id)).toEqual(['a'])

    expect(deleteLayer(baseDoc(), DEFAULT_LAYER_ID)).toEqual(baseDoc())

    const withEmpty = addLayer(baseDoc(), { id: 'empty', name: '空层', visible: true, locked: false })
    const after = deleteLayer(withEmpty, 'l2')
    expect(after.layers?.some((layer) => layer.id === 'empty')).toBe(true)
  })

  it('复制图层：副本在原层上方、对象新 id、分组子对象也换 id', () => {
    const source = baseDoc()
    source.objects.push({
      id: 'g', type: 'group', x: 0, y: 0, w: 10, h: 10, rotation: 0, layerId: 'l2',
      children: [obj('child', 'l2')]
    } as LabelObject)
    const { doc, layerId } = duplicateLayer(source, 'l2', seqUid())
    const index = doc.layers?.findIndex((layer) => layer.id === layerId) ?? -1
    const sourceIndex = doc.layers?.findIndex((layer) => layer.id === 'l2') ?? -1
    expect(index).toBe(sourceIndex + 1)
    const copies = doc.objects.filter((object) => object.layerId === layerId)
    expect(copies).toHaveLength(3)
    expect(copies.every((object) => object.id.startsWith('new-'))).toBe(true)
    const copiedGroup = copies.find((object) => object.type === 'group')
    expect(copiedGroup?.type).toBe('group')
    if (copiedGroup?.type === 'group') {
      expect(copiedGroup.children[0].id.startsWith('new-')).toBe(true)
    }
    // 原文档未被修改
    expect(source.layers).toHaveLength(2)
  })

  it('图层上移/下移同时移动对象段；默认图层不能被移动', () => {
    const moved = moveLayer(baseDoc(), 'l2', -1)
    expect(moved.layers?.map((layer) => layer.id)).toEqual([DEFAULT_LAYER_ID, 'l2'])
    // 只有两层时 l2 已经在上方，-1 无效果
    expect(moved.objects.map((o) => o.id)).toEqual(['a', 'b', 'c'])

    const three = addLayer(baseDoc(), { id: 'l3', name: '图层 3', visible: true, locked: false })
    const down = moveLayer(three, 'l3', -1)
    expect(down.layers?.map((layer) => layer.id)).toEqual([DEFAULT_LAYER_ID, 'l3', 'l2'])
    // 顺序重建后，对象段跟着图层走
    expect(orderedObjects(down).map((o) => o.id)).toEqual(['a', 'b', 'c'])

    expect(moveLayer(baseDoc(), DEFAULT_LAYER_ID, 1)).toEqual(baseDoc())
  })

  it('删除活动图层后：先上方相邻、再下方相邻、最后默认（Q5）', () => {
    const layers = normalizeLayers([
      { id: DEFAULT_LAYER_ID, name: '默认' },
      { id: 'l2', name: '图层 2' },
      { id: 'l3', name: '图层 3' }
    ])
    expect(activeLayerAfterDelete(layers, 'l2', 'l2')).toBe('l3')
    expect(activeLayerAfterDelete(layers, 'l3', 'l3')).toBe('l2')
    expect(activeLayerAfterDelete(normalizeLayers([]), DEFAULT_LAYER_ID, DEFAULT_LAYER_ID)).toBe(DEFAULT_LAYER_ID)
  })

  it('每个命令都返回新文档（撤销栈依赖不可变更新）', () => {
    const before = baseDoc()
    const after = addLayer(before, { id: 'l3', name: '图层 3', visible: true, locked: false })
    expect(after).not.toBe(before)
    expect(before.layers).toHaveLength(2)
  })
})
