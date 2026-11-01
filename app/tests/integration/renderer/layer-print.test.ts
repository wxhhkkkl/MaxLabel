import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYER_ID, normalizeLayers } from '@shared/domain/layers'
import type { DataCtx, SerialSource } from '@shared/domain/datasource'
import type { LabelDoc } from '@shared/domain/document'
import type { LabelObject } from '@shared/domain/objects'
import { buildPrintPlan } from '@shared/print/plan'
import { compilePrintTemplate } from '@shared/print/scene'
import { findSerialBoundaryViolation } from '@shared/print/serialBounds'
import { dataCtx } from '../../helpers/factories'

/**
 * 打印必须按**图层可见性**过滤（019 / US3 / R9）
 *
 * 画布上隐藏图层的对象已经看不到了，打印时却把它们印出来 —— 这是图层功能最容易
 * 踩的空：两个消费方各读各的 `doc.objects`。
 */

function rect(id: string, layerId: string, extra: Partial<LabelObject> = {}): LabelObject {
  return { id, type: 'rect', x: 0, y: 0, w: 10, h: 10, rotation: 0, layerId, ...extra } as LabelObject
}

function doc(
  layers: Array<{ id: string; name: string; visible?: boolean; locked?: boolean }>,
  objects: LabelObject[]
): LabelDoc {
  return {
    version: 3,
    name: 't',
    widthMm: 100,
    heightMm: 100,
    layers: normalizeLayers(layers),
    objects
  } as LabelDoc
}

function compiledIds(d: LabelDoc): string[] {
  return compilePrintTemplate(d).map((object) => object.id)
}

describe('US3 —— 打印按图层可见性过滤', () => {
  it('隐藏图层上的对象不进入打印模板', () => {
    const d = doc(
      [
        { id: DEFAULT_LAYER_ID, name: '默认' },
        { id: 'hidden', name: '隐藏层', visible: false }
      ],
      [rect('a', DEFAULT_LAYER_ID), rect('b', 'hidden')]
    )
    expect(compiledIds(d)).toEqual(['a'])
  })

  it('锁定图层照常打印（锁定只挡编辑，不挡输出）', () => {
    const d = doc(
      [
        { id: DEFAULT_LAYER_ID, name: '默认' },
        { id: 'locked', name: '锁定层', locked: true }
      ],
      [rect('a', DEFAULT_LAYER_ID), rect('b', 'locked')]
    )
    expect(compiledIds(d)).toEqual(['a', 'b'])
  })

  it('打印顺序按图层从底到顶，而不是数组原始顺序', () => {
    const d = doc(
      [
        { id: DEFAULT_LAYER_ID, name: '默认' },
        { id: 'top', name: '上层' }
      ],
      // 数组里上层对象在前，但默认层应在下层先印
      [rect('b', 'top'), rect('a', DEFAULT_LAYER_ID)]
    )
    expect(compiledIds(d)).toEqual(['a', 'b'])
  })

  it('对象自身隐藏仍然被排除（回归：原有语义不变）', () => {
    const d = doc([{ id: DEFAULT_LAYER_ID, name: '默认' }], [
      rect('a', DEFAULT_LAYER_ID),
      rect('b', DEFAULT_LAYER_ID, { visible: false } as Partial<LabelObject>)
    ])
    expect(compiledIds(d)).toEqual(['a'])
  })
})

describe('US3 —— 序列号边界值只看会被打印的条码', () => {
  function serial(overrides: Partial<SerialSource> = {}): SerialSource {
    return { kind: 'serial', prefix: '', start: 1, step: 1, digits: 1, current: 1, serialType: 'boundary', ...overrides }
  }

  function barcode(id: string, layerId: string, overrides: Partial<SerialSource> = {}): LabelObject {
    return {
      id,
      type: 'barcode',
      x: 0,
      y: 0,
      w: 30,
      h: 10,
      rotation: 0,
      symbology: 'code128',
      showText: false,
      layerId,
      source: serial(overrides)
    } as LabelObject
  }

  function planFor(count: number) {
    return buildPrintPlan({
      test: false,
      requestedCount: count,
      recordStart: 0,
      cellsPerPage: 1,
      defaultCopies: 1
    })
  }

  const ctx: DataCtx = dataCtx({})

  it('隐藏图层上的条码越界不拦截打印', () => {
    const d = doc(
      [
        { id: DEFAULT_LAYER_ID, name: '默认' },
        { id: 'hidden', name: '隐藏层', visible: false }
      ],
      [barcode('bc', 'hidden', { end: 2, repeatBasis: 'label' })]
    )
    expect(findSerialBoundaryViolation(d, planFor(5), ctx)).toBeNull()
  })

  it('可见图层上的条码越界仍然拦截（回归）', () => {
    const d = doc([{ id: DEFAULT_LAYER_ID, name: '默认' }], [
      barcode('bc', DEFAULT_LAYER_ID, { end: 2, repeatBasis: 'label' })
    ])
    expect(findSerialBoundaryViolation(d, planFor(5), ctx)).not.toBeNull()
  })
})
