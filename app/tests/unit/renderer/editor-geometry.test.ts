// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { GroupObj } from '@shared/domain/objects'
import { boxAlignment, modelBoxOffset, syncFromFabric } from '@/features/canvas/syncFromFabric'
import { makeObject } from '@/rendering/fabricObjects'
import { barcodeObject, textObject } from '../../helpers/color'
import { rectObject } from '../../helpers/canvas'

describe('Fabric ↔ model group geometry', () => {
  it('preserves group centre, rotation and child transforms', async () => {
    const group: GroupObj = {
      id: 'group',
      type: 'group',
      x: 35,
      y: 30,
      w: 50,
      h: 20,
      rotation: 30,
      children: [
        { id: 'left', type: 'rect', x: 10, y: 20, w: 10, h: 10, rotation: 0, fill: '#fff', stroke: '#000', strokeWidth: 0 },
        { id: 'right', type: 'rect', x: 50, y: 30, w: 10, h: 10, rotation: 15, fill: '#fff', stroke: '#000', strokeWidth: 0 }
      ]
    }

    const fabricGroup = await makeObject(group, 1)
    expect(fabricGroup?.type).toBe('group')
    if (!fabricGroup) throw new Error('group was not created')
    const synced = syncFromFabric(group, fabricGroup, 1) as GroupObj

    const close = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.02)
    close(synced.x, group.x)
    close(synced.y, group.y)
    close(synced.rotation, group.rotation)
    for (const expected of group.children) {
      const actual = synced.children.find((child) => child.id === expected.id)
      expect(actual).toBeDefined()
      if (!actual) continue
      close(actual.x, expected.x)
      close(actual.y, expected.y)
      close(actual.rotation, expected.rotation)
    }
  })

  it('keeps text and barcode model sizes unchanged after a pure move', async () => {
    const close = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.02)

    const text = textObject({ align: 'right', verticalAlign: 'bottom' })
    const fabricText = await makeObject(text, 1)
    if (!fabricText) throw new Error('text was not created')
    const textBase = syncFromFabric(text, fabricText, 1)
    fabricText.set({ left: Number(fabricText.left ?? 0) + 50, top: Number(fabricText.top ?? 0) + 30 })
    fabricText.setCoords()
    const syncedText = syncFromFabric(text, fabricText, 1)
    close(syncedText.x - textBase.x, 50)
    close(syncedText.y - textBase.y, 30)
    close(syncedText.w, text.w)
    close(syncedText.h, text.h)

    for (const [align, expectedX] of [['left', -50], ['center', -25], ['right', 0]] as const) {
      const barcode = barcodeObject({ barcodeAlign: align })
      expect(boxAlignment(barcode)).toEqual({ x: align, y: 'middle' })
      expect(modelBoxOffset(barcode, 100, 40, 50, 20)).toEqual({ x: expectedX, y: -10 })
    }
  })

  it('moves nested groups without changing child geometry', async () => {
    const group: GroupObj = {
      id: 'outer',
      type: 'group',
      x: 20,
      y: 20,
      w: 40,
      h: 20,
      rotation: 0,
      children: [
        {
          id: 'inner',
          type: 'group',
          x: 30,
          y: 25,
          w: 15,
          h: 8,
          rotation: 0,
          children: [rectObject('leaf', 32, 27, 6, 4)]
        }
      ]
    }
    const fabricGroup = await makeObject(group, 1)
    if (!fabricGroup) throw new Error('group was not created')
    fabricGroup.set({ left: Number(fabricGroup.left ?? 0) + 30, top: Number(fabricGroup.top ?? 0) + 20 })
    fabricGroup.setCoords()
    const synced = syncFromFabric(group, fabricGroup, 1) as GroupObj
    const close = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.02)
    close(synced.x, group.x + 30)
    close(synced.y, group.y + 20)
    const inner = synced.children[0] as GroupObj
    close(inner.w, 15)
    close(inner.h, 8)
    close(inner.children[0].w, 6)
    close(inner.children[0].h, 4)
  })
})
