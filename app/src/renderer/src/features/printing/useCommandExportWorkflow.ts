import { useCallback, useEffect, useRef } from 'react'
import type { AsyncOperation } from '../shell/useAsyncOperation'
import type { DocTab } from '../workspace/useDocumentWorkspace'
import type { LabelDoc, PrinterConfig } from '../../../../shared/domain'
import { buildExportCommand } from './printPreviewService'
import { uid } from '../../../../shared/domain'
import { localizeErrorText } from '../../../../shared/i18n/errors.en-US'
import type { Language } from '../../../../shared/i18n/types'

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
  tr: (key: string, params?: Record<string, string | number>) => string
  language: Language
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
          guardedStatus(input.tr('status.exportEmpty'))
          return
        }
        const response = await window.maxlabel.printCommand({ segments: result.segments, encoding: input.printer.port.encoding, port: { type: 'file', encoding: input.printer.port.encoding } }, jobId)
        if (isFresh()) guardedStatus(response.ok ? (response.message ?? input.tr('status.exportDone')) : response.canceled ? input.tr('status.exportCanceled') : input.tr('status.exportFailed', { message: response.message ?? input.tr('common.unknownError') }))
      } catch (error) {
        if (operation.isCurrent()) input.setStatus(input.tr('status.exportFailed', { message: localizeErrorText(input.language, error instanceof Error ? error.message : String(error)) }))
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
