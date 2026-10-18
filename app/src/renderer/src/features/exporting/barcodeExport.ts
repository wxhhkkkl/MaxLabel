import type { LabelDoc } from '../../../../shared/domain/document'
import { defaultPrinterConfig } from '../../../../shared/domain/printer'
import { runGlobalScript } from '../../../../shared/domain/datasource'
import { resolvePrintJob, type ResolvedPrintScene } from '../../../../shared/print/scene'
import { buildPrintPlan } from '../../../../shared/print/plan'
import { createPrintContext } from '../printing/printJob'

export function resolveBarcodeExportScenes(doc: LabelDoc, count: number, allowScript: boolean, previewOnly = false): ReadonlyArray<ResolvedPrintScene> {
  const context = createPrintContext({ doc, printer: defaultPrinterConfig(), count, copies: 1, allowScript })
  context.printerName = ''
  const begin = runGlobalScript(doc.globalScript, context, 1)
  const requestedCount = begin.totalLabelsOverridden ? begin.totalLabels : count
  if (requestedCount <= 0) return []
  const plan = buildPrintPlan({ test: false, requestedCount, recordStart: 0, cellsPerPage: 1, defaultCopies: 1 })
  const outputPlan = previewOnly ? { ...plan, pages: plan.pages.slice(0, 1) } : plan
  return resolvePrintJob(doc, begin, undefined, outputPlan, { finishScript: !previewOnly }).pages.map((page) => page.scene)
}

export function barcodeExportFilename(options: { text: string; index: number; count: number; naming: 'serial' | 'content' | 'content_serial'; prefix: string; format: 'bmp' | 'png'; objectIndex: number; objectCount: number }): string {
  const { text, index, count, naming, prefix, format, objectIndex, objectCount } = options
  const safe = text.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40)
  const serial = String(index + 1).padStart(Math.max(4, String(count).length), '0')
  const stem = naming === 'serial' ? serial : naming === 'content' && count === 1 ? safe : `${safe}_${serial}`
  const objectSuffix = objectCount > 1 ? `_b${objectIndex + 1}` : ''
  const cleanPrefix = prefix.trim().replace(/[\\/:*?"<>|]/g, '_').slice(0, 160)
  return `${cleanPrefix ? cleanPrefix + '_' : ''}${stem}${objectSuffix}.${format}`
}
