import { describe, expect, it } from 'vitest'
import type { GroupObj, TextObj } from '@shared/domain/objects'
import { collectKeyboardLabels, mergeKeyboardOrder } from '@/dialogs/KeyInputOrderDialog'
import { sampleDoc } from '../../helpers/factories'

const text = sampleDoc().objects[1] as TextObj

describe('keyboard input order', () => {
  it('also collects the 提示 of a serial number whose initial value comes from keyboard input', () => {
    const doc = sampleDoc()
    doc.objects = [
      {
        ...text,
        id: 's1',
        source: {
          kind: 'serial', prefix: '', start: 1, step: 1, digits: 1, current: 1,
          charset: '', repeat: 1, repeatBasis: 'record',
          initialValueSource: 'keyboard', initialValueField: '起始编号'
        }
      },
      // 提示为空时不该弹一个空名字的框
      {
        ...text,
        id: 's2',
        source: {
          kind: 'serial', prefix: '', start: 1, step: 1, digits: 1, current: 1,
          charset: '', repeat: 1, repeatBasis: 'record',
          initialValueSource: 'keyboard', initialValueField: '  '
        }
      }
    ]
    expect(collectKeyboardLabels(doc)).toEqual(['起始编号'])
  })

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
