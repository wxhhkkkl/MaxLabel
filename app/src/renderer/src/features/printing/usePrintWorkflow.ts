import { useCallback, useEffect, useRef } from 'react'
import type { AsyncOperation } from '../shell/useAsyncOperation'
import { executePrint, type PrintExecutionDeps } from './printExecutor'
import { uid } from '../../../../shared/domain'

type RunnablePrintDeps = Omit<PrintExecutionDeps, 'signal' | 'jobId' | 'setBusy' | 'setStatus'> & Pick<PrintExecutionDeps, 'setBusy' | 'setStatus'>

/** Owns print-job lifetime, cancellation and stale UI guards outside App.tsx. */
export function usePrintWorkflow(beginAsyncOperation: () => AsyncOperation) {
  const active = useRef<{ operation: AsyncOperation; jobId: string; controller: AbortController; cancelled: boolean } | null>(null)

  const cancel = useCallback(() => {
    const current = active.current
    if (!current) return
    current.cancelled = true
    current.operation.cancel()
    current.controller.abort()
    void window.maxlabel.cancelPrint(current.jobId).catch(() => {})
  }, [])

  useEffect(() => () => { cancel() }, [cancel])

  const run = useCallback((test: boolean, deps: RunnablePrintDeps, keyboardValues: Record<string, string>, scaleValues?: Record<string, string[]>): AsyncOperation & { done: Promise<void> } => {
    const previous = active.current
    if (previous) {
      previous.operation.cancel()
      previous.controller.abort()
      void window.maxlabel.cancelPrint(previous.jobId).catch(() => {})
    }
    const operation = beginAsyncOperation()
    const controller = new AbortController()
    const jobId = uid()
    active.current = { operation, jobId, controller, cancelled: false }
    const guardedStatus = (message: string) => {
      const current = active.current
      // A user-cancelled job must still be allowed to publish its terminal status
      // ("已取消打印…"); a stale job superseded by a newer one must not.
      if (current?.jobId === jobId && (operation.isCurrent() || current.cancelled)) deps.setStatus(message)
    }
    const guardedBusy = (value: boolean) => { if (operation.isCurrent()) deps.setBusy(value) }
    const done = executePrint(test, { ...deps, setBusy: guardedBusy, setStatus: guardedStatus, signal: controller.signal, jobId }, keyboardValues, scaleValues).finally(() => {
      operation.cancel()
      if (active.current?.jobId === jobId) active.current = null
    })
    void done.catch(() => undefined)
    return Object.assign(operation, { done })
  }, [beginAsyncOperation])

  return { run, cancel }
}
