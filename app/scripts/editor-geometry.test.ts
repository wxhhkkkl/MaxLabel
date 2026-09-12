import { makeObject } from '../src/renderer/src/rendering/fabricObjects'
import { syncFromFabric } from '../src/renderer/src/features/canvas/syncFromFabric'
import type { GroupObj } from '../src/types'

function assertClose(actual: number, expected: number, label: string): void {
  if (Math.abs(actual - expected) > 0.02) throw new Error(`${label}: expected ${expected}, got ${actual}`)
}

async function main(): Promise<void> {
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
  if (!fabricGroup || fabricGroup.type !== 'group') throw new Error('分组未创建')
  const synced = syncFromFabric(group, fabricGroup, 1) as GroupObj
  assertClose(synced.x, group.x, '组中心 X')
  assertClose(synced.y, group.y, '组中心 Y')
  assertClose(synced.rotation, group.rotation, '组旋转')
  for (const expected of group.children) {
    const actual = synced.children.find((child) => child.id === expected.id)
    if (!actual) throw new Error(`缺少子对象 ${expected.id}`)
    assertClose(actual.x, expected.x, `${expected.id} X`)
    assertClose(actual.y, expected.y, `${expected.id} Y`)
    assertClose(actual.rotation, expected.rotation, `${expected.id} 旋转`)
  }
  console.log('1 editor geometry check passed')
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
