import { describe, expect, it } from 'vitest'
import type { GroupObj, TextObj } from '@shared/domain/objects'
import { collectKeyboardLabels, mergeKeyboardOrder } from '@/dialogs/KeyInputOrderDialog'
import { sampleDoc } from '../../helpers/factories'

const text = sampleDoc().objects[1] as TextObj

describe('keyboard input order', () => {
  it('collects unique keyboard labels in document order, including groups and sub-sources', () => {
    const doc = sampleDoc()
    const group: GroupObj = {
      id: 'g1',
      type: 'group',
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      rotation: 0,
      children: [{ ...text, id: 't4', source: { kind: 'keyboard', label: '颜色' } }]
    }
    doc.objects = [
      { ...text, id: 't1', source: { kind: 'keyboard', label: '批号' } },
      { ...text, id: 't2', source: { kind: 'keyboard', label: '数量' } },
      { ...text, id: 't3', source: { kind: 'keyboard', label: '批号' } },
      group,
      { ...text, id: 't5', source: { kind: 'constant', value: 'x' }, subSources: [{ kind: 'keyboard', label: '子串' }] }
    ]
    expect(collectKeyboardLabels(doc)).toEqual(['批号', '数量', '颜色', '子串'])
  })

  it('keeps saved order first and appends newly discovered labels', () => {
    expect(mergeKeyboardOrder(['A', 'B', 'C'], ['C', 'A'])).toEqual(['C', 'A', 'B'])
    expect(mergeKeyboardOrder(['A', 'B'], ['X', 'B', 'A', 'Y'])).toEqual(['B', 'A'])
    expect(mergeKeyboardOrder([], ['X'])).toEqual([])
  })
})
