import { describe, expect, it } from 'vitest'
import type { GroupObj } from '@shared/domain/objects'
import { syncFromFabric } from '@/features/canvas/syncFromFabric'
import { makeObject } from '@/rendering/fabricObjects'

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
})
