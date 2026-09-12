import assert from 'node:assert'
import type { LabelDoc } from '../src/renderer/src/types'
import { DocumentHistoryStack } from '../src/renderer/src/features/workspace/documentHistoryStack'

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

console.log('9 document history checks passed')
