import { useCallback, useRef } from 'react'
import type { LabelDoc } from '../../types'
import { DocumentHistoryStack } from './documentHistoryStack'

export type DocumentMutation = (doc: LabelDoc) => LabelDoc

export interface DocumentMutationOptions {
  /** Consecutive updates with the same key are treated as one user action. */
  coalesceKey?: string
}

/** 单文档撤销/恢复栈；后续可替换为命令模型而不影响 App。 */
export function useDocumentHistory(
  documentKey: string,
  doc: LabelDoc | undefined,
  setDocument: (patch: (doc: LabelDoc) => LabelDoc) => void,
  setStatus: (message: string) => void
) {
  const stacksRef = useRef(new Map<string, DocumentHistoryStack>())
  const lastMutationRef = useRef<{ documentKey: string; key?: string; at: number }>({ documentKey, at: 0 })
  const stack = () => {
    const existing = stacksRef.current.get(documentKey)
    if (existing) return existing
    const created = new DocumentHistoryStack()
    stacksRef.current.set(documentKey, created)
    return created
  }

  const pushHistory = useCallback((before: LabelDoc) => {
    stack().push(before)
  }, [documentKey])

  const resetMutationGrouping = useCallback(() => {
    lastMutationRef.current = { documentKey, at: 0 }
  }, [documentKey])

  const forgetDocument = useCallback((key: string) => {
    stacksRef.current.delete(key)
    if (lastMutationRef.current.documentKey === key) lastMutationRef.current = { documentKey: key, at: 0 }
  }, [])

  /**
   * The only entry point user-facing document mutations should use. It keeps
   * history and redo invalidation next to the state update, while allowing
   * noisy form controls to commit one logical action.
   */
  const applyDocument = useCallback((mutation: DocumentMutation, options: DocumentMutationOptions = {}) => {
    setDocument((current) => {
      const next = mutation(current)
      if (next === current) return current
      const now = Date.now()
      const previous = lastMutationRef.current
      const coalesced = Boolean(
        options.coalesceKey &&
        previous.documentKey === documentKey &&
        previous.key === options.coalesceKey &&
        now - previous.at < 700
      )
      if (!coalesced) pushHistory(current)
      lastMutationRef.current = { documentKey, key: options.coalesceKey, at: now }
      return next
    })
  }, [documentKey, pushHistory, setDocument])

  const undo = useCallback(() => {
    if (!doc) return
    const previous = stack().undo(doc)
    if (!previous) return
    resetMutationGrouping()
    setDocument(() => previous)
    setStatus('已撤销')
  }, [doc, resetMutationGrouping, setDocument, setStatus])

  const redo = useCallback(() => {
    if (!doc) return
    const next = stack().redo(doc)
    if (!next) return
    resetMutationGrouping()
    setDocument(() => next)
    setStatus('已恢复')
  }, [doc, resetMutationGrouping, setDocument, setStatus])

  return {
    pushHistory,
    applyDocument,
    resetMutationGrouping,
    forgetDocument,
    undo,
    redo,
    canUndo: stack().canUndo,
    canRedo: stack().canRedo
  }
}
