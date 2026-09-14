import { useCallback, useEffect, useRef } from 'react'
import type { AsyncOperation } from '../shell/useAsyncOperation'
import type { DocTab } from '../workspace/useDocumentWorkspace'
import type { LabelDoc, PrinterConfig } from '../../../../shared/domain'
import { buildExportCommand } from './printPreviewService'
import { uid } from '../../../../shared/domain'

interface CommandExportInput {
  doc: LabelDoc
  tab: DocTab
  printer: PrinterConfig
  keyboardValues: Record<string, string>
  allowScript: boolean
  includeSuppressed: boolean
  autoRotateOutput: boolean
  tabsRef: { current: DocTab[] }
  setBusy: (busy: boolean) => void
  setStatus: (status: string) => void
}

/** Keeps command-file export lifecycle out of the top-level application component. */
export function useCommandExportWorkflow(beginAsyncOperation: () => AsyncOperation) {
  const active = useRef<{ operation: AsyncOperation; jobId: string } | null>(null)

  const cancel = useCallback(() => {
    const current = active.current
    if (!current) return
    current.operation.cancel()
    void window.maxlabel.cancelPrint(current.jobId).catch(() => {})
  }, [])

  useEffect(() => () => { cancel() }, [cancel])

  const run = useCallback((input: CommandExportInput): AsyncOperation => {
    const previous = active.current
    if (previous) {
      previous.operation.cancel()
      void window.maxlabel.cancelPrint(previous.jobId).catch(() => {})
    }
    const operation = beginAsyncOperation()
    const jobId = uid()
    const { doc, tab } = input
    active.current = { operation, jobId }
    const isFresh = () => operation.isCurrent() && input.tabsRef.current.find((item) => item.key === tab.key)?.revision === tab.revision
    const guardedStatus = (message: string) => { if (operation.isCurrent()) input.setStatus(message) }
    const guardedBusy = (value: boolean) => { if (operation.isCurrent()) input.setBusy(value) }
    guardedBusy(true)
    void (async () => {
      try {
        if (!isFresh()) return
        const result = await buildExportCommand({ doc, tab, printer: input.printer, keyboardValues: input.keyboardValues, allowScript: input.allowScript, includeSuppressed: input.includeSuppressed, autoRotateOutput: input.autoRotateOutput })
        if (!isFresh()) return
        if (!result.segments.length) {
          guardedStatus('导出失败：生成的指令为空')
          return
        }
        const response = await window.maxlabel.printCommand({ segments: result.segments, encoding: input.printer.port.encoding, port: { type: 'file', encoding: input.printer.port.encoding } }, jobId)
        if (isFresh()) guardedStatus(response.ok ? (response.message ?? '指令文件已导出') : response.canceled ? '已取消导出' : '导出失败：' + (response.message ?? '未知错误'))
      } catch (error) {
        if (operation.isCurrent()) input.setStatus('导出失败：' + (error instanceof Error ? error.message : String(error)))
      } finally {
        guardedBusy(false)
        operation.cancel()
        if (active.current?.jobId === jobId) active.current = null
      }
    })()
    return operation
  }, [beginAsyncOperation])

  return { run, cancel }
}
