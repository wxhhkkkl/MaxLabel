import { useCallback, useEffect, useRef } from 'react'
import type { AsyncOperation } from '../shell/useAsyncOperation'
import { executePrint, type PrintExecutionDeps } from './printExecutor'
import { uid } from '../../../../shared/domain'

type RunnablePrintDeps = Omit<PrintExecutionDeps, 'signal' | 'jobId' | 'setBusy' | 'setStatus'> & Pick<PrintExecutionDeps, 'setBusy' | 'setStatus'>

/** Owns print-job lifetime, cancellation and stale UI guards outside App.tsx. */
export function usePrintWorkflow(beginAsyncOperation: () => AsyncOperation) {
  const active = useRef<{ operation: AsyncOperation; jobId: string; controller: AbortController } | null>(null)

  const cancel = useCallback(() => {
    const current = active.current
    if (!current) return
    current.operation.cancel()
    current.controller.abort()
    void window.maxlabel.cancelPrint(current.jobId).catch(() => {})
  }, [])

  useEffect(() => () => { cancel() }, [cancel])

  const run = useCallback((test: boolean, deps: RunnablePrintDeps, keyboardValues: Record<string, string>): AsyncOperation => {
    const previous = active.current
    if (previous) {
      previous.operation.cancel()
      previous.controller.abort()
      void window.maxlabel.cancelPrint(previous.jobId).catch(() => {})
    }
    const operation = beginAsyncOperation()
    const controller = new AbortController()
    const jobId = uid()
    active.current = { operation, jobId, controller }
    const guardedStatus = (message: string) => { if (operation.isCurrent()) deps.setStatus(message) }
    const guardedBusy = (value: boolean) => { if (operation.isCurrent()) deps.setBusy(value) }
    void executePrint(test, { ...deps, setBusy: guardedBusy, setStatus: guardedStatus, signal: controller.signal, jobId }, keyboardValues).finally(() => {
      operation.cancel()
      if (active.current?.jobId === jobId) active.current = null
    })
    return operation
  }, [beginAsyncOperation])

  return { run, cancel }
}
