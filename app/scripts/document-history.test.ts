import assert from 'node:assert'
import type { LabelDoc } from '../src/renderer/src/types'
import { DocumentHistoryStack } from '../src/renderer/src/features/workspace/documentHistoryStack'
import { advanceDocumentSerials, serialProgressRebaser } from '../src/renderer/src/features/printing/printJob'

const doc = (name: string): LabelDoc => ({
  version: 1,
  name,
  width: 40,
  height: 30,
  unit: 'mm',
  orientation: 0,
  objects: []
})

const stack = new DocumentHistoryStack(2)
const first = doc('first')
const second = doc('second')
const third = doc('third')
const fourth = doc('fourth')

stack.push(first)
stack.push(second)
stack.push(third)
assert.strictEqual(stack.canUndo, true)
assert.strictEqual(stack.undo(fourth)?.name, 'third')
assert.strictEqual(stack.undo(third)?.name, 'second')
assert.strictEqual(stack.undo(second), undefined)
assert.strictEqual(stack.canRedo, true)
assert.strictEqual(stack.redo(first)?.name, 'third')
stack.push(doc('new action'))
assert.strictEqual(stack.canRedo, false)

const original = doc('mutable')
original.datasets = { big: { name: 'big', columns: ['value'], rows: [['1']] } }
stack.push(original)
original.name = 'changed after push'
const restoredMutable = stack.undo(doc('current'))
assert.strictEqual(restoredMutable?.name, 'mutable')
assert.strictEqual(restoredMutable?.datasets, original.datasets, 'history must share immutable datasets instead of cloning all rows')

const serialDoc: LabelDoc = { version: 1, name: 'serial history', widthMm: 50, heightMm: 30, objects: [
  { id: 'g', type: 'group', x: 20, y: 10, w: 20, h: 10, rotation: 0, children: [
    { id: 't', type: 'text', x: 10, y: 5, w: 20, h: 5, rotation: 0, fontFamily: 'Arial', fontSize: 3, bold: false, align: 'left', color: '#000',
      source: { kind: 'serial', prefix: '', start: 1, current: 1, step: 1, digits: 1 },
      subSources: [{ kind: 'serial', prefix: '', start: 10, current: 10, step: -1, digits: 1 }] }
  ] }
] }
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
  assert.ok(group.type === 'group')
  const text = group.children[0]
  assert.ok(text.type === 'text' && text.source.kind === 'serial' && text.subSources?.[0].kind === 'serial')
  return [text.source.current, text.subSources[0].current]
}
const undoPrint = progressHistory.undo(committed)!
assert.strictEqual(undoPrint.name, serialDoc.name, 'design edits still undo after printing')
assert.deepStrictEqual(readSerials(undoPrint), [2, 9], 'undo keeps committed positive and negative-step serials')
assert.deepStrictEqual(readSerials(progressHistory.redo(undoPrint)!), [2, 9])
const redoPrint = progressHistory.redo(committed)!
assert.strictEqual(redoPrint.name, 'resized', 'existing redo entries survive the print commit')
assert.deepStrictEqual(readSerials(redoPrint), [2, 9])
const secondCommit = advanceDocumentSerials(redoPrint, 2)
progressHistory.rebase(serialProgressRebaser(secondCommit))
assert.deepStrictEqual(readSerials(progressHistory.undo(secondCommit)!), [4, 7], 'multiple jobs never restore an earlier print counter')
assert.deepStrictEqual(readSerials(serialDoc), [1, 10], 'rebasing never mutates previous caller-owned snapshots')

console.log('PASS document history isolation, bounds, undo/redo and committed serial progress')
