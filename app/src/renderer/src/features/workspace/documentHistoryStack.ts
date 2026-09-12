import type { LabelDoc } from '../../types'

/**
 * History is an object-model history, not a data-cache history. Dataset rows
 * and connection definitions are immutable from the renderer's point of view
 * and are therefore intentionally shared. Cloning them for every mouse move
 * made a large data-bound label consume hundreds of MB after a few edits.
 */
function cloneDoc(doc: LabelDoc): LabelDoc {
  return {
    ...doc,
    objects: structuredClone(doc.objects),
    printer: doc.printer ? structuredClone(doc.printer) : doc.printer,
    keyboardOrder: doc.keyboardOrder ? [...doc.keyboardOrder] : doc.keyboardOrder,
    colorIndexTable: doc.colorIndexTable ? [...doc.colorIndexTable] : doc.colorIndexTable,
    datasets: doc.datasets,
    connections: doc.connections
  }
}

/**
 * Per-document bounded undo/redo history.
 * The stack owns cloning and redo invalidation so callers cannot accidentally
 * share mutable document state with the history.
 */
export class DocumentHistoryStack {
  private readonly undoStack: LabelDoc[] = []
  private readonly redoStack: LabelDoc[] = []

  constructor(private readonly limit = 50) {}

  push(before: LabelDoc): void {
    this.undoStack.push(cloneDoc(before))
    if (this.undoStack.length > this.limit) this.undoStack.splice(0, this.undoStack.length - this.limit)
    this.redoStack.length = 0
  }

  undo(current: LabelDoc): LabelDoc | undefined {
    const previous = this.undoStack.pop()
    if (!previous) return undefined
    this.redoStack.push(cloneDoc(current))
    return cloneDoc(previous)
  }

  redo(current: LabelDoc): LabelDoc | undefined {
    const next = this.redoStack.pop()
    if (!next) return undefined
    this.undoStack.push(cloneDoc(current))
    return cloneDoc(next)
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }
}
