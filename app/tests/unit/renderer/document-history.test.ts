import { describe, expect, it } from 'vitest'
import { DOCUMENT_MODEL_VERSION, type LabelDoc } from '@shared/domain/document'
import { advanceDocumentSerials, serialProgressRebaser } from '@/features/printing/printJob'
import { DocumentHistoryStack } from '@/features/workspace/documentHistoryStack'

const doc = (name: string): LabelDoc => ({
  version: DOCUMENT_MODEL_VERSION,
  name,
  widthMm: 40,
  heightMm: 30,
  orientation: 0,
  objects: []
})

describe('DocumentHistoryStack', () => {
  it('bounds undo, supports redo and invalidates redo after a new action', () => {
    const stack = new DocumentHistoryStack(2)
    const first = doc('first')
    const second = doc('second')
    const third = doc('third')
    const fourth = doc('fourth')

    stack.push(first)
    stack.push(second)
    stack.push(third)
    expect(stack.canUndo).toBe(true)
    expect(stack.undo(fourth)?.name).toBe('third')
    expect(stack.undo(third)?.name).toBe('second')
    expect(stack.undo(second)).toBeUndefined()
    expect(stack.canRedo).toBe(true)
    expect(stack.redo(first)?.name).toBe('third')
    stack.push(doc('new action'))
    expect(stack.canRedo).toBe(false)
  })

  it('shares immutable datasets instead of cloning all rows', () => {
    const stack = new DocumentHistoryStack()
    const original = doc('mutable')
    original.datasets = { big: { name: 'big', columns: ['value'], rows: [['1']] } }
    stack.push(original)
    original.name = 'changed after push'
    const restored = stack.undo(doc('current'))
    expect(restored?.name).toBe('mutable')
    expect(restored?.datasets).toBe(original.datasets)
  })

  it('rebases committed serial progress across print jobs without mutating snapshots', () => {
    const serialDoc: LabelDoc = {
      version: DOCUMENT_MODEL_VERSION,
      name: 'serial history',
      widthMm: 50,
      heightMm: 30,
      objects: [
        {
          id: 'g',
          type: 'group',
          x: 20,
          y: 10,
          w: 20,
          h: 10,
          rotation: 0,
          children: [
            {
              id: 't',
              type: 'text',
              x: 10,
              y: 5,
              w: 20,
              h: 5,
              rotation: 0,
              fontFamily: 'Arial',
              fontSize: 3,
              bold: false,
              align: 'left',
              color: '#000',
              source: { kind: 'serial', prefix: '', start: 1, current: 1, step: 1, digits: 1 },
              subSources: [{ kind: 'serial', prefix: '', start: 10, current: 10, step: -1, digits: 1 }]
            }
          ]
        }
      ]
    }

    const progressHistory = new DocumentHistoryStack()
    progressHistory.push(serialDoc)
    const moved = { ...serialDoc, name: 'moved' }
    progressHistory.push(moved)
    const resized = { ...moved, name: 'resized' }
    const beforePrint = progressHistory.undo(resized)!
    const committed = advanceDocumentSerials(beforePrint, 1)
    progressHistory.rebase(serialProgressRebaser(committed))

    const readSerials = (value: LabelDoc) => {
      const group = value.objects[0]
      expect(group.type).toBe('group')
      if (group.type !== 'group') throw new Error('expected a group')
      const text = group.children[0]
      expect(text.type).toBe('text')
      if (text.type !== 'text' || text.source.kind !== 'serial' || text.subSources?.[0].kind !== 'serial') throw new Error('expected serial sources')
      return [text.source.current, text.subSources[0].current]
    }

    const undoPrint = progressHistory.undo(committed)!
    expect(undoPrint.name).toBe(serialDoc.name)
    expect(readSerials(undoPrint)).toEqual([2, 9])
    expect(readSerials(progressHistory.redo(undoPrint)!)).toEqual([2, 9])

    const redoPrint = progressHistory.redo(committed)!
    expect(redoPrint.name).toBe('resized')
    expect(readSerials(redoPrint)).toEqual([2, 9])

    const secondCommit = advanceDocumentSerials(redoPrint, 2)
    progressHistory.rebase(serialProgressRebaser(secondCommit))
    expect(readSerials(progressHistory.undo(secondCommit)!)).toEqual([4, 7])
    expect(readSerials(serialDoc)).toEqual([1, 10])
  })
})
