import { useCallback, useEffect, useRef } from 'react'
import type { AsyncOperation } from '../shell/useAsyncOperation'
import type { DocTab } from '../workspace/useDocumentWorkspace'
import type { LabelDoc, PrinterConfig } from '../../../../shared/domain'
import { translate } from '../../../../shared/i18n/translate'
import type { Language } from '../../../../shared/i18n/types'
import { localizeErrorText } from '../../../../shared/i18n/errors.en-US'
import { renderPrintPreviewPages } from './printPreviewService'

interface PreviewWorkflowInput {
  doc: LabelDoc
  tab: DocTab
  printer: PrinterConfig
  autoCount: boolean
  advanced: { copyField: boolean; copyFieldName: string; firstCopyAsk: boolean; dupcheck: boolean; currentOnly: boolean; updateSerial: boolean; rotate180?: boolean }
  firstCopies?: number
  keyboardValues: Record<string, string>
  allowScript: boolean
  includeSuppressed: boolean
  autoRotateOutput: boolean
  tabsRef: { current: DocTab[] }
  setPreviewUrl: (url: string | null) => void
  setBusy: (busy: boolean) => void
  setStatus: (status: string) => void
  language?: Language
}

/** Preview preparation and stale-tab protection live outside the composition root. */
export function usePreviewWorkflow(beginAsyncOperation: () => AsyncOperation) {
  const active = useRef<{ operation: AsyncOperation; controller: AbortController } | null>(null)

  const cancel = useCallback(() => {
    active.current?.operation.cancel()
    active.current?.controller.abort()
  }, [])

  useEffect(() => () => { cancel() }, [cancel])

  const run = useCallback((input: PreviewWorkflowInput): AsyncOperation => {
    active.current?.operation.cancel()
    active.current?.controller.abort()
    const operation = beginAsyncOperation()
    const controller = new AbortController()
    const { doc, tab } = input
    const tr = (key: string, params?: Record<string, string | number>) => translate(input.language ?? 'zh-CN', key, params)
    active.current = { operation, controller }
    const isFresh = () => operation.isCurrent() && input.tabsRef.current.find((item) => item.key === tab.key)?.revision === tab.revision
    input.setBusy(true)
    void (async () => {
      try {
        const preview = await renderPrintPreviewPages({ doc, tab, printer: input.printer, autoCount: input.autoCount, advanced: input.advanced, firstCopies: input.firstCopies, keyboardValues: input.keyboardValues, allowScript: input.allowScript, includeSuppressed: input.includeSuppressed, autoRotateOutput: input.autoRotateOutput, signal: controller.signal })
        if (!isFresh()) return
        if (!preview.pages.length) {
          input.setStatus(tr('print.preview.noImage'))
          return
        }
        try {
          const result = await window.maxlabel.previewOpen({ pages: preview.pages, widthMm: preview.widthMm, heightMm: preview.heightMm, truncated: preview.truncated, language: input.language })
          if (isFresh() && preview.truncated) input.setStatus(tr('print.preview.truncated'))
          if (isFresh() && !result.ok) input.setPreviewUrl(preview.pages[0])
        } catch {
          if (isFresh()) input.setPreviewUrl(preview.pages[0])
        }
      } catch (error) {
        if (operation.isCurrent()) input.setStatus(tr('print.preview.failed', { message: localizeErrorText(input.language ?? 'zh-CN', error instanceof Error ? error.message : String(error)) }))
      } finally {
        if (operation.isCurrent()) input.setBusy(false)
        operation.cancel()
        if (active.current?.operation === operation) active.current = null
      }
    })()
    return operation
  }, [beginAsyncOperation])

  return { run, cancel }
}
