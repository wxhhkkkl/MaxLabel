// @vitest-environment jsdom
import * as fabric from 'fabric'
import { describe, expect, it } from 'vitest'
import { syncFromFabric } from '@/features/canvas/syncFromFabric'
import { BARCODE_PIXELS_PER_MM } from '@/editor/barcode'
import type { BarcodeObj, GroupObj, LabelObject } from '@shared/domain/objects'
import { barcodeObject } from '../../helpers/color'

const SC = 96 / 25.4
const RATIO = SC / BARCODE_PIXELS_PER_MM
const natural = (mm: number) => mm * BARCODE_PIXELS_PER_MM

/** 与 fabricObjects.ts 的分组渲染同构：子对象 left/top 是「绝对坐标 - 组中心」。 */
function childNode(object: BarcodeObj, group: GroupObj): fabric.Rect {
  const node = new fabric.Rect({
    width: natural(object.w),
    height: natural(object.h),
    scaleX: RATIO,
    scaleY: RATIO,
    left: (object.x - group.x) * SC,
    top: (object.y + object.h / 2 - group.y) * SC,
    originX: 'left',
    originY: 'center'
  })
  ;(node as unknown as { dataBoxScaleX?: number }).dataBoxScaleX = RATIO
  ;(node as unknown as { dataBoxScaleY?: number }).dataBoxScaleY = RATIO
  ;(node as unknown as { dataId?: string }).dataId = object.id
  return node
}

function buildFabricGroup(group: GroupObj): fabric.Group {
  const children = group.children.map((child) => childNode(child as BarcodeObj, group))
  const anchors = children.map((child) => ({ left: child.left, top: child.top }))
  const fabricGroup = new fabric.Group(children, {
    left: group.x * SC,
    top: group.y * SC,
    originX: 'center',
    originY: 'center'
  })
  // 组构造会按实测包围盒重排子对象：恢复模型锚点（fabricObjects.ts 同样这么做）
  fabricGroup.getObjects().forEach((child, index) => child.set(anchors[index]))
  fabricGroup.setCoords()
  return fabricGroup
}

/**
 * 现场反馈：两个条码组合后拖动整组，打印结果偏右。
 *
 * 组内子对象的绝对坐标（模型 x/y）必须随组中心等量平移；条码的渲染框与模型框
 * 在画布上是「中心对齐、尺寸不同」，同步时若把像素位移直接喂给 fabric 矩阵，
 * 会被对象自身的 scaleX/scaleY 再缩放一次，子对象就会比组多走半个框。
 */
describe('组合拖动后组内条码的模型坐标', () => {
  const group: GroupObj = {
    id: 'group-print',
    type: 'group',
    x: 25,
    y: 20,
    w: 20,
    h: 30,
    rotation: 0,
    children: [
      barcodeObject({ id: 'a', x: 15, y: 5, w: 20, h: 10 }),
      barcodeObject({ id: 'b', x: 15, y: 25, w: 20, h: 10 })
    ]
  }

  it('组中心平移多少，组内条码的绝对坐标就平移多少', () => {
    const fabricGroup = buildFabricGroup(group)
    const dx = 10
    const dy = 5
    fabricGroup.set({ left: (fabricGroup.left ?? 0) + dx * SC, top: (fabricGroup.top ?? 0) + dy * SC })
    fabricGroup.setCoords()

    const synced = syncFromFabric(group, fabricGroup, SC) as GroupObj
    expect(synced.x).toBeCloseTo(25 + dx, 1)
    expect(synced.y).toBeCloseTo(20 + dy, 1)
    for (const [index, child] of synced.children.entries()) {
      const before = group.children[index] as LabelObject
      expect(child.x).toBeCloseTo(before.x + dx, 1)
      expect(child.y).toBeCloseTo(before.y + dy, 1)
    }
  })

  it('旋转过的组整体拖动时，组内条码同样只跟随平移', () => {
    const fabricGroup = buildFabricGroup(group)
    fabricGroup.set({ angle: 90 })
    fabricGroup.setCoords()
    const rotated = syncFromFabric(group, fabricGroup, SC) as GroupObj

    const dx = 10
    const dy = 5
    fabricGroup.set({ left: (fabricGroup.left ?? 0) + dx * SC, top: (fabricGroup.top ?? 0) + dy * SC })
    fabricGroup.setCoords()
    const moved = syncFromFabric(group, fabricGroup, SC) as GroupObj

    expect(moved.x).toBeCloseTo(rotated.x + dx, 1)
    expect(moved.y).toBeCloseTo(rotated.y + dy, 1)
    for (const [index, child] of moved.children.entries()) {
      expect(child.x).toBeCloseTo(rotated.children[index].x + dx, 1)
      expect(child.y).toBeCloseTo(rotated.children[index].y + dy, 1)
    }
  })
})
