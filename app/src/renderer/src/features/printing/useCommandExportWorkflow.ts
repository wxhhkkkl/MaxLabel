import { useCallback, useEffect, useRef } from 'react'
import type { AsyncOperation } from '../shell/useAsyncOperation'
import type { DocTab } from '../workspace/useDocumentWorkspace'
import type { LabelDoc, PrinterConfig } from '../../../../shared/domain'
import { buildExportCommand } from './printPreviewService'
import { uid } from '../../../../shared/domain'
import { localizeErrorText } from '../../../../shared/i18n/errors.en-US'
import type { Language } from '../../../../shared/i18n/types'
import { ScaleResolutionError, scaleErrorMessage } from '../scale/resolveWeights'

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
  const active = useRef<{ operation: AsyncOperation; jobId: string; controller: AbortController } | null>(null)

  const cancel = useCallback(() => {
    const current = active.current
    if (!current) return
    current.operation.cancel()
    current.controller.abort()
    void window.maxlabel.cancelPrint(current.jobId).catch(() => {})
  }, [])

  useEffect(() => () => { cancel() }, [cancel])

  const run = useCallback((input: CommandExportInput): AsyncOperation & { done: Promise<void> } => {
    const previous = active.current
    if (previous) {
      previous.operation.cancel()
      previous.controller.abort()
      void window.maxlabel.cancelPrint(previous.jobId).catch(() => {})
    }
    const operation = beginAsyncOperation()
    const jobId = uid()
    const controller = new AbortController()
    const { doc, tab } = input
    active.current = { operation, jobId, controller }
    const isFresh = () => operation.isCurrent() && input.tabsRef.current.find((item) => item.key === tab.key)?.revision === tab.revision
    const guardedStatus = (message: string) => { if (operation.isCurrent()) input.setStatus(message) }
    const guardedBusy = (value: boolean) => { if (operation.isCurrent()) input.setBusy(value) }
    guardedBusy(true)
    const done = (async () => {
      try {
        if (!isFresh()) return
        const result = await buildExportCommand({ doc, tab, printer: input.printer, keyboardValues: input.keyboardValues, allowScript: input.allowScript, includeSuppressed: input.includeSuppressed, autoRotateOutput: input.autoRotateOutput, language: input.language, signal: controller.signal })
        if (!isFresh()) return
        if (!result.segments.length) {
          guardedStatus(input.tr('status.exportEmpty'))
          return
        }
        const response = await window.maxlabel.printCommand({ segments: result.segments, encoding: input.printer.port.encoding, port: { type: 'file', encoding: input.printer.port.encoding }, language: input.language }, jobId)
        if (isFresh()) guardedStatus(response.ok ? (response.message ?? input.tr('status.exportDone')) : response.canceled ? input.tr('status.exportCanceled') : input.tr('status.exportFailed', { message: response.message ?? input.tr('common.unknownError') }))
      } catch (error) {
        if (!operation.isCurrent()) return
        if (error instanceof ScaleResolutionError && (error.canceled || controller.signal.aborted)) {
          input.setStatus(input.tr('status.exportCanceled'))
          return
        }
        const message = error instanceof ScaleResolutionError
          ? scaleErrorMessage(input.language, error)
          : localizeErrorText(input.language, error instanceof Error ? error.message : String(error))
        input.setStatus(input.tr('status.exportFailed', { message }))
      } finally {
        guardedBusy(false)
        operation.cancel()
        if (active.current?.jobId === jobId) active.current = null
      }
    })()
    void done.catch(() => undefined)
    return Object.assign(operation, { done })
  }, [beginAsyncOperation])

  return { run, cancel }
}
