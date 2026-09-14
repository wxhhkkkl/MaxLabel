import type { LabelDoc, PrinterConfig } from '../../../../shared/domain'
import { buildResolvedCommands, type BuildResult } from '../../../../shared/print/engine'
import { buildExecutablePrintPlan } from '../../../../shared/print/plan'
import { resolvePrintJob } from '../../../../shared/print/scene'
import { layoutCount } from '../../rendering/pageLayout'
import { pageSizeMm, renderLabelDataUrl } from '../../print/renderLabel'
import { prepareBitmapsForPrintJob } from '../../print/bitmapSource'
import { printerCapabilities } from '../../../../shared/print/capabilities'
import { MAX_PREVIEW_DATA_BYTES, MAX_PREVIEW_PAGES } from '../../../../shared/print/limits'
import { activeDatasetView, createPrintContext } from './printJob'
import { runGlobalScript } from '../../../../shared/domain/datasource'
import type { DocTab } from '../workspace/useDocumentWorkspace'

function layoutOf(doc: LabelDoc) {
  return doc.layout && (doc.layout.rows > 1 || doc.layout.cols > 1) ? doc.layout : undefined
}

function encodedBytes(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

export async function renderPrintPreviewPages(input: {
  doc: LabelDoc
  tab: DocTab
  printer: PrinterConfig
  autoCount: boolean
  advanced: { copyField: boolean; copyFieldName: string; firstCopyAsk: boolean; dupcheck: boolean; currentOnly: boolean; updateSerial: boolean }
  firstCopies?: number
  keyboardValues: Record<string, string>
  allowScript: boolean
  includeSuppressed: boolean
  signal?: AbortSignal
}): Promise<{ pages: string[]; widthMm: number; heightMm: number; truncated: boolean }> {
  const { doc, tab, printer } = input
  const layout = layoutOf(doc)
  const datasetView = activeDatasetView(doc, tab.datasetName)
  const hasDb = datasetView.rows.length > 0
  const cellsPerPage = layoutCount(layout)
  let requestedCount = input.advanced.currentOnly
    ? 1
    : input.autoCount && hasDb
      ? Math.max(1, datasetView.rows.length - tab.recordIdx)
      : Math.max(1, tab.count)
  const initialContext = createPrintContext({ doc, printer, copies: tab.copies, count: requestedCount, keyboardValues: input.keyboardValues, recordIndex: tab.recordIdx, labelIndex: 1, datasetName: tab.datasetName, allowScript: input.allowScript })
  const beginContext = runGlobalScript(doc.globalScript, initialContext, 1)
  if (input.allowScript && doc.globalScript && beginContext.totalLabels <= 0) return { pages: [], ...pageSizeMm(doc, layout), truncated: false }
  if (input.allowScript && doc.globalScript && beginContext.totalLabels !== initialContext.totalLabels) requestedCount = beginContext.totalLabels
  const fullPlan = buildExecutablePrintPlan({
    test: false,
    requestedCount,
    recordStart: tab.recordIdx,
    dataset: datasetView.name ? { name: datasetView.name, columns: datasetView.columns, rows: datasetView.rows } : undefined,
    cellsPerPage,
    startSlot: tab.startLabel,
    defaultCopies: tab.copies,
    firstCopies: input.firstCopies,
    copyField: input.advanced.copyField ? input.advanced.copyFieldName : undefined
  }, { deduplicateRecords: input.advanced.dupcheck })
  const previewPages = fullPlan.pages.slice(0, MAX_PREVIEW_PAGES)
  const previewPhysicalLabelCount = previewPages.reduce((sum, page) => sum + page.cells.reduce((pageSum, cell) => pageSum + cell.copies, 0), 0)
  const plan = { ...fullPlan, pages: previewPages, physicalPageCount: previewPages.length, physicalLabelCount: previewPhysicalLabelCount }
  const truncated = fullPlan.pages.length > previewPages.length
  const firstCell = plan.pages[0]?.cells[0]
  if (!firstCell) return { pages: [], ...pageSizeMm(doc, layout), truncated }
  const baseContext = createPrintContext({ doc, printer, copies: fullPlan.pages[0]?.copies ?? tab.copies, count: fullPlan.logicalLabelCount, keyboardValues: input.keyboardValues, recordIndex: firstCell.recordIndex, labelIndex: firstCell.labelIndex, datasetName: tab.datasetName, allowScript: input.allowScript, sharedVars: beginContext.sharedVars })
  baseContext.totalLabels = fullPlan.physicalLabelCount
  const resolvedJob = resolvePrintJob(doc, baseContext, layout, plan, { includeSuppressed: input.includeSuppressed })
  const renderDpi = printerCapabilities(printer).coordinateDpi
  const pages: string[] = []
  let totalBytes = 0
  for (const page of resolvedJob.pages) {
    if (input.signal?.aborted) throw new Error('预览已取消')
    const dataUrl = await renderLabelDataUrl(doc, { dpi: renderDpi, layout, scene: page.scene, includeSuppressed: input.includeSuppressed })
    totalBytes += encodedBytes(dataUrl)
    if (totalBytes > MAX_PREVIEW_DATA_BYTES) throw new Error(`预览数据超过 ${Math.round(MAX_PREVIEW_DATA_BYTES / 1024 / 1024)} MB，请缩小预览范围或降低打印分辨率`)
    pages.push(dataUrl)
  }
  const size = pageSizeMm(doc, layout)
  return { pages, widthMm: size.widthMm, heightMm: size.heightMm, truncated }
}

export async function buildExportCommand(input: {
  doc: LabelDoc
  tab: DocTab
  printer: PrinterConfig
  keyboardValues: Record<string, string>
  allowScript: boolean
  includeSuppressed: boolean
}): Promise<BuildResult> {
  const { doc, tab, printer } = input
  const layout = layoutOf(doc)
  const datasetView = activeDatasetView(doc, tab.datasetName)
  const plan = buildExecutablePrintPlan({
    test: true,
    requestedCount: 1,
    recordStart: tab.recordIdx,
    dataset: datasetView.name ? { name: datasetView.name, columns: datasetView.columns, rows: datasetView.rows } : undefined,
    cellsPerPage: layoutCount(layout),
    startSlot: 1,
    defaultCopies: 1
  })
  const firstCell = plan.pages[0]?.cells[0]
  if (!firstCell) throw new Error('无法生成导出指令')
  const beginContext = runGlobalScript(doc.globalScript, createPrintContext({ doc, printer, copies: 1, count: 1, keyboardValues: input.keyboardValues, recordIndex: tab.recordIdx, labelIndex: 1, datasetName: tab.datasetName, allowScript: input.allowScript }), 1)
  const context = createPrintContext({ doc, printer, copies: 1, count: plan.logicalLabelCount, keyboardValues: input.keyboardValues, recordIndex: firstCell.recordIndex, labelIndex: firstCell.labelIndex, datasetName: tab.datasetName, allowScript: input.allowScript, sharedVars: beginContext.sharedVars })
  context.totalLabels = plan.physicalLabelCount
  const resolvedJob = await prepareBitmapsForPrintJob(
    resolvePrintJob(doc, context, layout, plan, { includeSuppressed: input.includeSuppressed }),
    printer
  )
  const result = buildResolvedCommands(printer, {
    count: plan.logicalLabelCount,
    copy: 1,
    title: doc.name,
    datasets: doc.datasets ?? {},
    sharedVars: {},
    keyboardValues: input.keyboardValues,
    layout,
    plan,
    resolvedPages: resolvedJob.pages.map((page) => page.scene),
    totalLabels: plan.physicalLabelCount,
    datasetName: tab.datasetName,
    allowScript: input.allowScript,
    printNonPrintable: input.includeSuppressed
  })
  const blocking = result.warningDetails.filter((item) => item.severity === 'error')
  if (blocking.length) throw new Error('指令导出已阻止：' + blocking.slice(0, 3).map((item) => item.message).join('；'))
  return result
}
