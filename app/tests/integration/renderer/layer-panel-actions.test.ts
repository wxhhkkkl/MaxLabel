import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LAYER_ID,
  activeLayerAfterDelete,
  deleteLayer,
  duplicateLayer,
  hasDuplicateLayerName,
  moveLayer,
  normalizeLayers,
  objectCountOfLayer,
  orderedObjects,
  renameLayer
} from '@shared/domain/layers'
import { DocumentHistoryStack } from '@/features/workspace/documentHistoryStack'
import type { LabelDoc } from '@shared/domain/document'
import type { LabelObject } from '@shared/domain/objects'

/**
 * 图层面板工具栏的六个动作（019 / US2 / T018）
 *
 * 面板只是触发器：真正决定「复制插在原层上方」「删除连对象一起删」「移动图层时
 * 对象段一起走」的是 shared 里的纯函数 —— 这里钉住的就是这些行为，以及
 * **一次用户动作 = 一步撤销**。
 */

function obj(id: string, layerId: string, extra: Partial<LabelObject> = {}): LabelObject {
  return { id, type: 'rect', x: 0, y: 0, w: 10, h: 10, rotation: 0, layerId, ...extra } as LabelObject
}

function baseDoc(): LabelDoc {
  return {
    version: 3,
    name: 't',
    widthMm: 100,
    heightMm: 100,
    layers: normalizeLayers([
      { id: DEFAULT_LAYER_ID, name: '默认' },
      { id: 'l2', name: '图层 2' },
      { id: 'l3', name: '图层 3' }
    ]),
    objects: [obj('a', DEFAULT_LAYER_ID), obj('b', 'l2'), obj('c', 'l2'), obj('d', 'l3')]
  } as LabelDoc
}

/** 确定性 id（禁止 Math.random） */
function seqUid(): () => string {
  let n = 0
  return () => `new-${++n}`
}

describe('US2 —— 复制图层（Q2 / Q6）', () => {
  it('副本插在原层上方、同层对象换新 id 后一并复制，并返回新图层 id', () => {
    const { doc, layerId } = duplicateLayer(baseDoc(), 'l2', seqUid())

    expect(doc.layers?.map((layer) => layer.id)).toEqual([DEFAULT_LAYER_ID, 'l2', layerId, 'l3'])
    expect(layerId).not.toBe('l2')
    // 副本图层名带后缀
    expect(doc.layers?.find((layer) => layer.id === layerId)?.name).toContain('副本')

    const copies = doc.objects.filter((object) => object.layerId === layerId)
    expect(copies).toHaveLength(2)
    // 对象换新 id，不与被复制对象共用
    expect(copies.map((object) => object.id)).not.toEqual(['b', 'c'])
    expect(new Set(doc.objects.map((object) => object.id)).size).toBe(doc.objects.length)
  })

  it('复制默认图层也能工作（默认层只是不能删）', () => {
    const { doc, layerId } = duplicateLayer(baseDoc(), DEFAULT_LAYER_ID, seqUid())
    expect(doc.layers?.[1].id).toBe(layerId)
    expect(doc.objects.filter((object) => object.layerId === layerId)).toHaveLength(1)
  })
})

describe('US2 —— 删除图层（Q1 / Q5）', () => {
  it('删除非空图层连同对象一起删除，默认图层拒绝删除', () => {
    const before = baseDoc()
    expect(objectCountOfLayer(before, 'l2')).toBe(2) // 面板提示用这个数

    const after = deleteLayer(before, 'l2')
    expect(after.layers?.map((layer) => layer.id)).toEqual([DEFAULT_LAYER_ID, 'l3'])
    expect(after.objects.map((object) => object.id)).toEqual(['a', 'd'])

    expect(deleteLayer(before, DEFAULT_LAYER_ID)).toBe(before)
  })

  it('删除后活动图层先取上方相邻，再取下方相邻', () => {
    const layers = normalizeLayers([{ id: DEFAULT_LAYER_ID, name: '默认' }, { id: 'l2', name: '图层 2' }, { id: 'l3', name: '图层 3' }])
    expect(activeLayerAfterDelete(layers, 'l2', 'l2')).toBe('l3')
    expect(activeLayerAfterDelete(layers, 'l3', 'l3')).toBe('l2')
  })
})

describe('US2 —— 移动图层（R2）', () => {
  it('上移图层时对象段一起移动（跨层顺序由 orders 体现）', () => {
    const d = baseDoc()
    // 初始：默认(a) → l2(b,c) → l3(d)
    expect(orderedObjects(d).map((object) => object.id)).toEqual(['a', 'b', 'c', 'd'])

    const up = moveLayer(d, 'l3', -1)
    expect(up.layers?.map((layer) => layer.id)).toEqual([DEFAULT_LAYER_ID, 'l3', 'l2'])
    expect(orderedObjects(up).map((object) => object.id)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('默认图层不能下移（永远在最底层）', () => {
    const d = baseDoc()
    expect(moveLayer(d, DEFAULT_LAYER_ID, 1)).toBe(d)
  })
})

describe('US2 —— 重名提示（FR-022：允许同名，但要提示）', () => {
  const layers = normalizeLayers([
    { id: DEFAULT_LAYER_ID, name: '默认' },
    { id: 'l2', name: '图层 2' }
  ])

  it('改成其他图层已有的名字 → 判为重名', () => {
    expect(hasDuplicateLayerName(layers, 'l2', '默认')).toBe(true)
    expect(hasDuplicateLayerName(layers, 'l2', '  默认  ')).toBe(true)
  })

  it('改成自己原来的名字、或全新名字 → 不算重名', () => {
    expect(hasDuplicateLayerName(layers, 'l2', '图层 2')).toBe(false)
    expect(hasDuplicateLayerName(layers, 'l2', '底图')).toBe(false)
  })

  it('重名仍然允许保存（按 id 区分）', () => {
    const renamed = renameLayer({ ...baseDoc(), layers }, 'l2', '默认')
    expect(renamed.layers?.filter((layer) => layer.name === '默认')).toHaveLength(2)
  })
})

describe('US2 —— 一次用户动作 = 一步撤销', () => {
  it('复制图层只压入一步，撤销后回到原状态', () => {
    const stack = new DocumentHistoryStack()
    const before = baseDoc()

    const { doc: after } = duplicateLayer(before, 'l2', seqUid())
    stack.push(before)

    expect(after.layers).toHaveLength(4)
    const undone = stack.undo(after)
    expect(undone?.layers).toHaveLength(3)
    expect(stack.canUndo).toBe(false)
  })

  it('删除图层同样只压入一步', () => {
    const stack = new DocumentHistoryStack()
    const before = baseDoc()

    const after = deleteLayer(before, 'l2')
    stack.push(before)

    expect(after.objects).toHaveLength(2)
    expect(stack.undo(after)?.objects).toHaveLength(4)
    expect(stack.canUndo).toBe(false)
  })
})
