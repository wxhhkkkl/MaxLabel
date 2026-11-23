import { compilePrintTemplate, resolvePrintJob } from '../../../../shared/print/scene'
import { translate, localizeIpcMessage } from '../../../../shared/i18n/translate'
import type { Language } from '../../../../shared/i18n/types'
import { localizeErrorText } from '../../../../shared/i18n/errors.en-US'
import { buildResolvedCommands, type CommandSegment } from '../../../../shared/print/engine'
import { buildCompactPrintPlan, type CompactPrintPlan, type PrintPlanPage, type PrintPlanCell } from '../../../../shared/print/plan'
import { layoutCount } from '../../rendering/pageLayout'
import { pageSizeMm } from '../../print/renderLabel'
import { printLayoutOf, singleLabelLayout } from '../../../../shared/print/layout'
import { renderDriverPage } from '../../print/driverPage'
import { nativeTextPrintRequested } from '../../print/nativeText'
import { prepareBitmapsForPrintJob } from '../../print/bitmapSource'
import { MAX_DRIVER_DATA_BYTES, MAX_DRIVER_PAGES } from '../../../../shared/print/limits'
import { PrintLogSnapshot } from '../../../../shared/print/logSnapshot'
import type { CommandPayload, DriverPrintPage, PrintBatchReceipt, PrintTransportResult } from '../../../../shared/ipcContract'
import { activeDatasetView, createPrintContext, snapshotResolvedScene } from './printJob'
import { printJobJournal } from './printJobJournal'
import type { LabelDoc, PrinterConfig } from '../../../../shared/domain'
import { runGlobalScript, type SerialAdvanceCounts } from '../../../../shared/domain/datasource'
import { prepareDocumentForPrint } from '../../../../shared/print/layout'
import { effectiveStartLabel } from './startSlot'
import type { DocTab } from '../workspace/useDocumentWorkspace'
import { hasWeighSources, resolveWeights, ScaleResolutionError, scaleErrorMessage } from '../scale/resolveWeights'
import { findInvalidBarcodeRecords, recordIndicesSkippingInvalid, type BarcodePreflightIssue } from './barcodePreflight'
import { checkPrintSerialBounds } from '../../../../shared/print/serialBounds'

export interface PrintAdvancedOptions {
  autoCount: boolean
  copyField: boolean
  copyFieldName: string
  firstCopyAsk: boolean
  dupcheck: boolean
  currentOnly: boolean
  updateSerial: boolean
  rotate180?: boolean
  /** 打印对话框「打印标签边框」：按标签形状给每枚标签加一圈线框。 */
  printBorder?: boolean
}

export interface PrintProgress {
  /** 已完成单位数（驱动打印=已准备页数；指令打印=已发送标签数） */
  done: number
  /** 总单位数；0 表示总数未知，界面显示不确定进度 */
  total: number
}

export interface PrintExecutionOptions {
  allowScript: boolean
  printNonPrintable: boolean
  autoRotateOutput: boolean
  advanced: PrintAdvancedOptions
  keyboardValues: Record<string, string>
  /** Electronic-scale auto-print: one stable reading prints exactly one logical label. */
  singleLogicalLabel?: boolean
}

export interface PrintExecutionDeps {
  refreshRecovery?: () => Promise<void>
  resolvePrinter?: (signal?: AbortSignal) => Promise<PrinterConfig>
  sourceDoc: LabelDoc
  printTab: DocTab
  printer: PrinterConfig
  options: PrintExecutionOptions
  refreshAutoDb: (sourceDoc: LabelDoc, tabKey: string, expectedRevision?: number, signal?: AbortSignal) => Promise<{ doc: LabelDoc | undefined; error: string | null; revision?: number }>
  bumpSerial: (tabKey: string, count: number | SerialAdvanceCounts, expectedRevision: number, savePath?: string) => Promise<{ ok: boolean; message?: string }>

  /**
   * 正式打印前发现条码内容不合法时询问用户：true = 跳过这些记录继续打印，false = 中止。
   * 未提供时按中止处理（不允许静默打印出坏码）。
   */
  confirmBarcodePreflight?: (issues: BarcodePreflightIssue[], signal?: AbortSignal) => Promise<boolean>
  logPrint: (mode: string, test: boolean, dataSnapshot: string[] | undefined, targetDoc: LabelDoc, summary: { logicalCount: number; physicalCount: number; copies: number; status: PrintLogStatus; sentCount: number; dataSnapshotTruncated?: boolean }) => Promise<void>
  setBusy: (busy: boolean) => void
  setStatus: (status: string) => void
  /** 打印进度：null = 任务结束（成功提交/失败/取消），供编辑页顶部的进度条显示。 */
  setPrintProgress?: (progress: PrintProgress | null) => void
  language?: Language
  signal?: AbortSignal
  jobId?: string
}

const PRINT_BATCH_PAGES = 24

function encodedBytes(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function printSummary(plan: { logicalLabelCount: number; physicalLabelCount: number }, fallbackCopies: number) {
  const ratio = plan.logicalLabelCount > 0 ? plan.physicalLabelCount / plan.logicalLabelCount : fallbackCopies
  return {
    logicalCount: plan.logicalLabelCount,
    physicalCount: plan.physicalLabelCount,
    copies: Number.isInteger(ratio) ? ratio : fallbackCopies
  }
}

class PrintCancelledError extends Error {
  constructor() { super('打印已取消'); this.name = 'PrintCancelledError' }
}

function assertPrintActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw new PrintCancelledError()
}

type PrintLogStatus = 'completed' | 'submitted' | 'partial' | 'failed' | 'canceled' | 'unknown'

function receiptRecords(plan: CompactPrintPlan, dataset: string | undefined, first: number, last: number) {
  if (!dataset) return {}
  const records = new Set<number>()
  for (let index = first; index <= last; index++) {
    records.add(plan.records[index].recordIndex + 1)
    if (records.size > 24) return { dataset, records: [...records].slice(0, 24), recordsTruncated: true }
  }
  return { dataset, records: [...records] }
}

/** 单一打印执行入口：驱动打印和原生指令打印共享同一份 PrintPlan。 */
export async function executePrint(test: boolean, deps: PrintExecutionDeps, keyboardValues: Record<string, string>, providedScaleValues?: Record<string, string[]>): Promise<boolean> {
  const { sourceDoc, printTab, options } = deps
  let printer = deps.printer
  const tr = (key: string, params?: Record<string, string | number>) => translate(deps.language ?? 'zh-CN', key, params)
  const printTabKey = printTab.key
  let printRevision = printTab.revision
  const jobNow = Date.now()
  const printPath = printTab.path
  const signal = deps.signal
  const jobId = deps.jobId
  let hasSpool = false
  let submissionPending = false
  let journaledSubmission = false
  let printMode: 'driver' | 'command' | undefined
  let attempted = false
  let attemptLogged = false
  let sentLabelCount = 0
  let sentLogicalCount = 0
  // 物理标签数不再等于逻辑记录数（拷贝会铺成多个 cell），用 logicalIndex 去重统计记录数。
  let printDoc = sourceDoc
  let resolvedSnapshots = new PrintLogSnapshot()
  let logWriteFailed = false
  // 场景解析阶段跳过的内容（多联版式里放到标签格之外的对象）。
  const sceneWarnings = new Set<string>()
  const reportQualityWarning = (message: string) => sceneWarnings.add(localizeErrorText(deps.language ?? 'zh-CN', message))
  let plannedSummary = { logicalLabelCount: printTab.count, physicalLabelCount: 0 }
  const journalId = jobId ?? `local-${jobNow}`
  const submit = async (send: () => Promise<PrintTransportResult>): Promise<PrintTransportResult> => {
    journaledSubmission = true
    submissionPending = true
    try {
      const result = await send()
      submissionPending = result.status === 'unknown'
      return result
    } catch (error) {
      return { ok: false, status: 'unknown', message: error instanceof Error ? error.message : String(error) }
    }
  }
  let journalStarted = false
  const startJournal = (mode: 'driver' | 'command', plan: { logicalLabelCount: number; physicalLabelCount: number; physicalPageCount: number }) => {
    if (test || journalStarted) return
    journalStarted = true
    printJobJournal.begin({ jobId: journalId, title: printDoc.name, mode, logicalCount: plan.logicalLabelCount, physicalCount: plan.physicalLabelCount, batchCount: mode === 'command' && printer.port.type !== 'file' ? Math.ceil(plan.physicalPageCount / PRINT_BATCH_PAGES) : 1, requiresSerialCommit: options.advanced.updateSerial, mainManaged: printer.port.type !== 'file' })
  }
  const logAttempt = async (status: PrintLogStatus, sentCount: number) => {
    if (test || attemptLogged || !printMode) return
    attemptLogged = true
    try {
      await deps.logPrint(printMode, test, resolvedSnapshots.rows.length ? resolvedSnapshots.rows : undefined, printDoc, {
        ...printSummary(plannedSummary, printTab.copies),
        status,
        sentCount,
        ...(resolvedSnapshots.truncated ? { dataSnapshotTruncated: true } : {})
      })
    } catch {
      logWriteFailed = true
    }
  }
  const reportTerminal = (message: string) => deps.setStatus(message + (logWriteFailed ? ' · ' + tr('print.status.logWriteFailed') : ''))
  let serialResult: { ok: boolean; message?: string } | undefined
  const commitKnownSerials = async (): Promise<{ ok: boolean; message?: string }> => {
    if (test || !options.advanced.updateSerial || sentLogicalCount <= 0) return { ok: true }
    if (serialResult) return serialResult
    try {
      serialResult = await deps.bumpSerial(printTabKey, { labels: sentLabelCount, records: sentLogicalCount }, printRevision, printPath)
    } catch (error) {
      serialResult = { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
    if (serialResult.ok) printJobJournal.serialCommitted(journalId)
    return serialResult
  }
  deps.setBusy(true)
  deps.setStatus(test ? tr('print.status.testing') : tr('print.status.printing'))
  deps.setPrintProgress?.({ done: 0, total: 0 })
  try {
    assertPrintActive(signal)
    if (deps.resolvePrinter) {
      printer = await deps.resolvePrinter(signal)
      assertPrintActive(signal)
      if (printer.port.type === 'usb' && !printer.port.usbPort?.trim()) {
        deps.setStatus(tr('print.status.selectUsbPort'))
        return false
      }
    }
    const port = printer.port
    const endpoint = port.tcpHost ? [port.tcpHost, port.tcpPort].filter(Boolean).join(':') : port.usbPort ?? port.comPort ?? port.lptPort
    const receiptDestination = {
      template: printPath?.slice(0, 4096),
      printer: [printer.printerName, endpoint ?? (port.type === 'driver' ? '' : port.type)].filter(Boolean).join(' · ').slice(0, 4096) || undefined
    }
    if (!test) {
      const refreshed = await deps.refreshAutoDb(sourceDoc, printTabKey, printRevision, signal)
      assertPrintActive(signal)
      if (refreshed.error) {
        deps.setStatus(refreshed.error)
        return false
      }
      if (refreshed.revision !== undefined) printRevision = refreshed.revision
      printDoc = refreshed.doc ?? sourceDoc
    }
    printDoc = prepareDocumentForPrint(printDoc, {
      autoRotateOutput: options.autoRotateOutput,
      rotate180: options.advanced.rotate180,
      printBorder: options.advanced.printBorder === true
    })
    let layout = printLayoutOf(printDoc, printDoc.layout)
    const compiled = compilePrintTemplate(printDoc, { includeSuppressed: options.printNonPrintable })
    const datasetView = activeDatasetView(printDoc, printTab.datasetName)
    const recordCount = datasetView.rows.length
    // Auto-print ignores the print count entirely: one stable reading, one label.
    let pcount = options.singleLogicalLabel === true || test || options.advanced.currentOnly
      ? 1
      : (options.advanced.autoCount && recordCount > 0
          ? Math.max(1, recordCount - printTab.recordIdx)
          : printTab.count)
    let scaleValues = providedScaleValues
    const beginContext = runGlobalScript(printDoc.globalScript, createPrintContext({
      doc: printDoc,
      printer,
      copies: printTab.copies,
      count: pcount,
      keyboardValues,
      scaleValues,
      recordIndex: printTab.recordIdx,
      labelIndex: 1,
      datasetName: datasetView.name,
      allowScript: options.allowScript,
      now: jobNow
    }), 2)
    if (options.allowScript && printDoc.globalScript && beginContext.totalLabels <= 0) {
      deps.setStatus(tr('print.status.scriptZero'))
      return false
    }
    const scriptTotal = beginContext.totalLabelsOverridden ? beginContext.totalLabels : undefined
    if (scriptTotal !== undefined && options.singleLogicalLabel !== true) pcount = scriptTotal
    const scriptState = { sharedVars: { ...beginContext.sharedVars }, scriptVars: { ...beginContext.scriptVars } }
    let firstCopies: number | undefined
    assertPrintActive(signal)
    if (!test && options.advanced.firstCopyAsk && options.singleLogicalLabel !== true) {
      const value = window.prompt(tr('prompt.firstCopies'), String(printTab.copies))
      if (value === null) {
        deps.setStatus(tr('print.status.canceled'))
        return false
      }
      firstCopies = Math.max(1, parseInt(value.trim() || '1', 10) || 1)
    }
    const planInput = {
      test,
      requestedCount: pcount,
      recordStart: printTab.recordIdx,
      dataset: datasetView.name ? { name: datasetView.name, columns: datasetView.columns, rows: datasetView.rows } : undefined,
      cellsPerPage: layoutCount(layout),
      startSlot: effectiveStartLabel(printer.port.type, printTab.startLabel),
      defaultCopies: printTab.copies,
      firstCopies,
      physicalLabelLimit: scriptTotal,
      copyField: !test && options.advanced.copyField ? options.advanced.copyFieldName : undefined
    }
    let executablePlan = buildCompactPrintPlan(planInput, {
      deduplicateRecords: !test && options.advanced.dupcheck && recordCount > 0
    })
    // 单枚标签（测试打印/当前记录/数量 1）按 LabelShop 的「打印到文件」口径出标签本身，
    // 不把 A4/多联纸的整页边距带给打印机。
    if (executablePlan.physicalLabelCount === 1 && printTab.copies === 1 &&
      effectiveStartLabel(printer.port.type, printTab.startLabel) === 1) {
      layout = singleLabelLayout(printDoc, layout, printDoc.layout) ?? layout
    }
    plannedSummary = executablePlan

    if (!executablePlan.physicalPageCount) {
      deps.setStatus(tr('print.status.noRecords'))
      return false
    }

    // Read once per logical label in the final plan after copy and count rules.
    if (!scaleValues && hasWeighSources(printDoc, options.printNonPrintable)) {
      deps.setStatus(tr('scale.reading'))
      scaleValues = await resolveWeights(printDoc, {
        count: executablePlan.logicalLabelCount,
        language: deps.language,
        signal,
        includeSuppressed: options.printNonPrintable
      })
      assertPrintActive(signal)
    }

    const jobContext = (cell: PrintPlanCell | undefined, copies = cell?.copies ?? printTab.copies) => ({
      ...createPrintContext({
        doc: printDoc,
        printer,
        copies,
        count: executablePlan.logicalLabelCount,
        keyboardValues,
        scaleValues,
        recordIndex: cell?.recordIndex ?? printTab.recordIdx,
        labelIndex: cell?.labelIndex ?? 1,
        datasetName: datasetView.name,
        allowScript: options.allowScript,
        sharedVars: beginContext.sharedVars,
        scriptVars: beginContext.scriptVars,
        now: jobNow
      }),
      totalLabels: executablePlan.physicalLabelCount
    })

    let skippedRecords = 0
    for (;;) {
      const planContext = jobContext(executablePlan.pageBatches(1).next().value?.[0]?.cells[0])
      const boundary = await checkPrintSerialBounds(printDoc, executablePlan, planContext, options.printNonPrintable, signal)
      assertPrintActive(signal)
      if (boundary) {
        deps.setStatus(tr('print.status.serialBoundary', {
          end: boundary.endText,
          available: boundary.available,
          required: boundary.required
        }))
        return false
      }

      if (test || recordCount === 0) break
      deps.setStatus(tr('print.status.preflightChecking'))
      const issues = await findInvalidBarcodeRecords({
        compiled,
        doc: printDoc,
        layout,
        plan: executablePlan,
        ctx: planContext,
        includeSuppressed: options.printNonPrintable,
        signal
      })
      assertPrintActive(signal)
      if (!issues.length) break
      const invalidRecords = new Set(issues.map((item) => item.recordIndex))
      const skip = deps.confirmBarcodePreflight ? await deps.confirmBarcodePreflight(issues, signal) : false
      assertPrintActive(signal)
      if (!skip) {
        deps.setStatus(tr('print.status.preflightAborted', { count: invalidRecords.size }))
        return false
      }
      const remaining = recordIndicesSkippingInvalid(executablePlan, invalidRecords)
      if (!remaining.length) {
        deps.setStatus(tr('print.status.preflightNoRecords'))
        return false
      }
      if (scaleValues) {
        const indexOfRecord = new Map<number, number>()
        executablePlan.records.forEach(({ recordIndex }, index) => indexOfRecord.set(recordIndex, index))
        scaleValues = Object.fromEntries(Object.entries(scaleValues).map(([label, values]) =>
          [label, remaining.map((recordIndex) => values[indexOfRecord.get(recordIndex)!] ?? '')]
        ))
      }
      // Filtering can change script variables such as V_TOTALLABELS and V_LABELNO.
      executablePlan = buildCompactPrintPlan({ ...planInput, requestedCount: remaining.length, recordIndices: remaining })
      plannedSummary = executablePlan
      skippedRecords += invalidRecords.size
    }
    if (skippedRecords) executablePlan.warnings.push(tr('print.status.preflightSkipped', { count: skippedRecords }))
    if (!test && recordCount > 0) deps.setStatus(tr('print.status.printing'))

    const finishCommandFailure = async (status: PrintLogStatus, message: string): Promise<void> => {
      const serial = await commitKnownSerials()
      printJobJournal.finish(journalId, status === 'completed' ? 'submitted' : status, message)
      await logAttempt(status, sentLabelCount)
      let finalMessage = message
      if (sentLabelCount > 0) finalMessage += tr('print.status.sentSuffix', { sent: sentLabelCount })
      if (!serial.ok) finalMessage += tr('print.status.serialNotWrittenPrefix', { message: serial.message ?? tr('print.status.unknown') })
      reportTerminal(finalMessage)
    }

    if (printer.port.type === 'driver') {
      const pageCount = executablePlan.physicalPageCount
      if (pageCount > MAX_DRIVER_PAGES) {
        deps.setStatus(tr('print.status.driverTooManyPages', { max: MAX_DRIVER_PAGES }))
        return false
      }
      if (compiled.some((object) => object.type === 'rfid')) {
        deps.setStatus(tr('print.status.driverRfid'))
        return false
      }
      printMode = 'driver'
      startJournal('driver', executablePlan)
      attempted = true
      const pageSize = pageSizeMm(printDoc, layout)
      const driverPages: DriverPrintPage[] = []
      let driverBytes = 0
      for (const [page] of executablePlan.pageBatches(1)) {
        const index = page.pageIndex
        assertPrintActive(signal)
        const first = page.cells[0]
        if (!first) continue
        const context = jobContext(first, page.copies)
        const resolvedJob = resolvePrintJob(printDoc, context, layout, { ...executablePlan, pages: [page], physicalPageCount: 1 }, { compiled, scriptState, finishScript: index === executablePlan.physicalPageCount - 1 })
        if (resolvedJob.pages[0]) {
          if (!test && !resolvedSnapshots.truncated) resolvedSnapshots.append(snapshotResolvedScene(resolvedJob.pages[0].scene))
          for (const warning of resolvedJob.pages[0].scene.warnings ?? []) sceneWarnings.add(warning)
        }
        const rendered = await renderDriverPage(printDoc, {
          dpi: printer.dpi,
          layout,
          scene: resolvedJob.pages[0]?.scene,
          includeSuppressed: options.printNonPrintable,
          nativeText: nativeTextPrintRequested(),
          onQualityWarning: reportQualityWarning
        })
        driverBytes += encodedBytes(rendered.kind === 'svg' ? rendered.svg : rendered.dataUrl) * page.copies
        if (driverBytes > MAX_DRIVER_DATA_BYTES) {
          throw new Error(tr('print.status.driverTooLarge', { mb: Math.round(MAX_DRIVER_DATA_BYTES / 1024 / 1024) }))
        }
        driverPages.push(rendered.kind === 'svg' ? { svg: rendered.svg, copies: page.copies } : { dataUrl: rendered.dataUrl, copies: page.copies })
        deps.setStatus(tr('print.status.preparing', { page: index + 1, total: executablePlan.physicalPageCount }))
        deps.setPrintProgress?.({ done: index + 1, total: executablePlan.physicalPageCount })
      }
      assertPrintActive(signal)
      attempted = true
      const result = await submit(() => window.maxlabel.printLabel(
        { pages: driverPages, widthMm: pageSize.widthMm, heightMm: pageSize.heightMm, printerName: printer.printerName },
        journalId,
        { ...receiptDestination, ...receiptRecords(executablePlan, datasetView.name, 0, executablePlan.logicalLabelCount - 1), title: printDoc.name, total: executablePlan.physicalLabelCount, index: 1, first: 1, last: executablePlan.physicalLabelCount }
      ))
      if (!result.ok) {
        const status: PrintLogStatus = result.status === 'unknown' ? 'unknown' : result.canceled ? 'canceled' : 'failed'
        printJobJournal.finish(journalId, status, result.message)
        await logAttempt(status, 0)
        const message = localizeIpcMessage(deps.language ?? 'zh-CN', { message: result.message ?? '', messageKey: result.messageKey, messageParams: result.messageParams }) || tr('print.status.unknown')
        reportTerminal(result.messageKey === 'print.status.driverDialogUnverified' ? message
          : status === 'unknown' ? tr('print.status.outputUnknown', { sent: 0, message })
            : result.canceled ? tr('print.status.canceled') : tr('print.status.driverFailed', { message }))
        return false
      }
      sentLabelCount = executablePlan.physicalLabelCount
      sentLogicalCount = executablePlan.logicalLabelCount
      printJobJournal.progress(journalId, { sentLogicalCount, sentPhysicalCount: sentLabelCount, batchIndex: 1 })
      const serial = await commitKnownSerials()
      printJobJournal.finish(journalId, 'submitted')
      await logAttempt('submitted', sentLabelCount)
      const allWarnings = [...new Set([...executablePlan.warnings, ...sceneWarnings])]
      const planWarningText = allWarnings.slice(0, 3).join(tr('print.status.warningSeparator')) + (allWarnings.length > 3 ? tr('print.status.moreWarnings', { count: allWarnings.length - 3 }) : '')
      reportTerminal(tr('print.status.driverSubmitted', { count: executablePlan.physicalLabelCount }) + (recordCount > 0 ? ' · ' + tr('print.status.databaseRecord') : '') + (allWarnings.length ? ' (' + planWarningText + ')' : '') + (!serial.ok ? ' · ' + tr('print.status.serialNotWritten', { message: serial.message ?? tr('print.status.unknown') }) : '') + (test ? ' · ' + tr('print.status.testNote') : ''))
      return serial.ok && !signal?.aborted
    }

    printMode = 'command'
    startJournal('command', executablePlan)
    const warnings: string[] = [...executablePlan.warnings]
    const fileOutput = printer.port.type === 'file'
    const fileSegments: CommandSegment[] = []
    const fileSnapshots = new PrintLogSnapshot()
    const stagedSnapshots = new PrintLogSnapshot()
    const batches: Array<{ payload: CommandPayload; receipt: PrintBatchReceipt; snapshotEnd: number; truncated: boolean; logicalCount: number }> = []
    const stage = !fileOutput && executablePlan.physicalPageCount > PRINT_BATCH_PAGES
    let preparedLabels = 0
    let fileBytes = 0
    attempted = true
    const resolveBatch = (batchPages: PrintPlanPage[], state: typeof scriptState) => {
      const offset = batchPages[0].pageIndex
      const batchPhysicalLabelCount = batchPages.reduce((sum, page) => sum + page.cells.reduce((pageSum, cell) => pageSum + cell.copies, 0), 0)
      const batchPlan = { ...executablePlan, pages: batchPages, physicalPageCount: batchPages.length, physicalLabelCount: batchPhysicalLabelCount }
      const finishScript = offset + PRINT_BATCH_PAGES >= executablePlan.physicalPageCount
      const resolvedJob = resolvePrintJob(printDoc, jobContext(batchPages[0]?.cells[0]), layout, batchPlan, { compiled, scriptState: state, finishScript })
      return { batchPlan, resolvedJob, finishScript }
    }
    for (const pages of executablePlan.pageBatches(PRINT_BATCH_PAGES)) {
      const offset = pages[0].pageIndex
      assertPrintActive(signal)
      const { batchPlan, resolvedJob, finishScript } = resolveBatch(pages, scriptState)
      const preparedJob = await prepareBitmapsForPrintJob(resolvedJob, printer, reportQualityWarning)
      const commandResult = buildResolvedCommands(printer, {
        count: executablePlan.logicalLabelCount,
        copy: printTab.copies,
        title: printDoc.name,
        datasets: printDoc.datasets ?? {},
        sharedVars: beginContext.sharedVars,
        keyboardValues,
        layout,
        plan: batchPlan,
        resolvedPages: preparedJob.pages.map((page) => page.scene),
        totalLabels: executablePlan.physicalLabelCount,
        datasetName: datasetView.name,
        allowScript: options.allowScript,
        printNonPrintable: options.printNonPrintable,
        includePreamble: offset === 0,
        includePostamble: finishScript
      })
      warnings.push(...commandResult.warnings)
      const blockingWarnings = commandResult.warningDetails.filter((item) => item.severity === 'error')
      if (blockingWarnings.length) {
        const detail = blockingWarnings.slice(0, 3).map((item) => item.message).join('；')
        await finishCommandFailure(sentLabelCount > 0 ? 'partial' : 'failed', tr('print.status.blocked') + detail)
        return false
      }
      if (!commandResult.segments.length) {
        await finishCommandFailure(sentLabelCount > 0 ? 'partial' : 'failed', tr('print.status.emptyCommands'))
        return false
      }
      assertPrintActive(signal)
      if (fileOutput) {
        fileBytes += commandResult.segments.reduce((sum, segment) => sum + (segment.type === 'text' ? encodedBytes(segment.str) : segment.data.byteLength), 0)
        if (fileBytes > 64 * 1024 * 1024 || fileSegments.length + commandResult.segments.length > 100000) throw new Error(tr('print.status.fileTooLarge'))
        fileSegments.push(...commandResult.segments)
        if (!test) for (const { scene } of preparedJob.pages) {
          if (fileSnapshots.truncated) break
          fileSnapshots.append(snapshotResolvedScene(scene))
        }
        deps.setStatus(tr('print.status.preparingFile', { page: Math.min(offset + PRINT_BATCH_PAGES, executablePlan.physicalPageCount), total: executablePlan.physicalPageCount }))
        deps.setPrintProgress?.({ done: Math.min(offset + PRINT_BATCH_PAGES, executablePlan.physicalPageCount), total: executablePlan.physicalPageCount })
        continue
      }
      const payload: CommandPayload = {
        segments: commandResult.segments,
        encoding: printer.port.encoding,
        port: printer.port,
        language: deps.language
      }
      const receipt = {
        ...receiptDestination,
        ...receiptRecords(executablePlan, datasetView.name, pages[0].cells[0].logicalIndex, pages.at(-1)!.cells.at(-1)!.logicalIndex),
        title: printDoc.name, total: executablePlan.physicalLabelCount, index: batches.length + 1,
        first: preparedLabels + 1, last: preparedLabels + commandResult.labelCount, staged: stage
      }
      if (stage) {
        hasSpool = true
        await window.maxlabel.stagePrintCommand(journalId, { index: receipt.index, final: finishScript, payload })
        deps.setStatus(tr('print.status.preparing', { page: Math.min(offset + PRINT_BATCH_PAGES, executablePlan.physicalPageCount), total: executablePlan.physicalPageCount }))
      }
      preparedLabels = receipt.last
      if (!test) for (const { scene } of preparedJob.pages) {
        if (stagedSnapshots.truncated) break
        stagedSnapshots.append(snapshotResolvedScene(scene))
      }
      batches.push({ payload: stage ? { encoding: payload.encoding, port: payload.port, language: payload.language } : payload, receipt, snapshotEnd: stagedSnapshots.rows.length, truncated: stagedSnapshots.truncated, logicalCount: pages.at(-1)!.cells.at(-1)!.logicalIndex + 1 })
    }
    for (const { payload, receipt, snapshotEnd, truncated, logicalCount } of batches) {
      assertPrintActive(signal)
      const result = await submit(() => window.maxlabel.printCommand(payload, journalId, receipt))
      if (!result.ok) {
        const status: PrintLogStatus = result.status === 'unknown' ? 'unknown' : result.canceled ? 'canceled' : sentLabelCount > 0 ? 'partial' : 'failed'
        const serial = await commitKnownSerials()
        printJobJournal.finish(journalId, status, result.message)
        await logAttempt(status, sentLabelCount)
        const serialMessage = serial.ok ? '' : tr('print.status.warningSeparator') + tr('print.status.serialNotWritten', { message: serial.message ?? tr('print.status.unknown') })
        const localizedFailure = localizeIpcMessage(deps.language ?? 'zh-CN', { message: result.message ?? '', messageKey: result.messageKey, messageParams: result.messageParams })
        const message = localizedFailure || tr('print.status.unknown')
        const statusMessage = status === 'unknown'
          ? tr('print.status.outputUnknown', { sent: sentLabelCount, message })
          : result.canceled ? tr('print.status.canceledSent', { sent: sentLabelCount })
            : tr('print.status.batchFailed', { batch: receipt.index, sent: sentLabelCount, message })
        reportTerminal(statusMessage + serialMessage)
        return false
      }
      sentLabelCount = receipt.last
      sentLogicalCount = logicalCount
      printJobJournal.progress(journalId, { sentLogicalCount, sentPhysicalCount: sentLabelCount, batchIndex: receipt.index })
      for (let row = resolvedSnapshots.rows.length; row < snapshotEnd; row++) resolvedSnapshots.rows.push(stagedSnapshots.rows[row])
      resolvedSnapshots.truncated = truncated
      deps.setStatus(tr('print.status.sending', { sent: sentLabelCount, total: executablePlan.physicalLabelCount }))
      deps.setPrintProgress?.({ done: sentLabelCount, total: executablePlan.physicalLabelCount })
    }
    if (fileOutput) {
      assertPrintActive(signal)
      const result = await window.maxlabel.printCommand({ segments: fileSegments, encoding: printer.port.encoding, port: printer.port, language: deps.language }, jobId)
      if (!result.ok) {
        await finishCommandFailure(result.canceled ? 'canceled' : result.status === 'unknown' ? 'unknown' : 'failed', result.canceled ? tr('print.status.canceled') : tr('print.status.saveFileFailed', { message: localizeIpcMessage(deps.language ?? 'zh-CN', { message: result.message ?? '', messageKey: result.messageKey, messageParams: result.messageParams }) || tr('print.status.unknown') }))
        return false
      }
      sentLabelCount = executablePlan.physicalLabelCount
      sentLogicalCount = executablePlan.logicalLabelCount
      resolvedSnapshots = fileSnapshots
      printJobJournal.progress(journalId, { sentLogicalCount, sentPhysicalCount: sentLabelCount, batchIndex: 1 })
    }
    const serial = await commitKnownSerials()
    printJobJournal.finish(journalId, 'submitted')
    if (!test) await logAttempt('submitted', sentLabelCount)
    const allWarnings = [...new Set([...sceneWarnings, ...warnings])]
    const warningText = allWarnings.slice(0, 3).join(tr('print.status.warningSeparator')) + (allWarnings.length > 3 ? tr('print.status.moreWarnings', { count: allWarnings.length - 3 }) : '')
    const warning = warnings.length ? tr('print.status.hintPrefix') + warningText + tr('print.status.hintSuffix') : ''
    reportTerminal(tr('print.status.sent', { sent: sentLabelCount }) + warning + (!serial.ok ? ' · ' + tr('print.status.serialNotWritten', { message: serial.message ?? tr('print.status.unknown') }) : '') + (test ? ' · ' + tr('print.status.testNote') : ''))
    return serial.ok && !signal?.aborted
  } catch (err) {
    if (err instanceof ScaleResolutionError) {
      deps.setStatus(err.canceled || signal?.aborted ? tr('print.status.canceled') : scaleErrorMessage(deps.language ?? 'zh-CN', err))
      return false
    }
    const canceled = signal?.aborted || err instanceof PrintCancelledError
    const status = canceled ? 'canceled' : sentLabelCount > 0 ? 'partial' : 'failed'
    const error = err instanceof Error ? err.message : String(err)
    const serial = await commitKnownSerials()
    if (journalStarted) printJobJournal.finish(journalId, status, error)
    if (attempted) await logAttempt(status, sentLabelCount)
    const message = canceled
      ? tr(sentLabelCount > 0 && serial.ok ? 'print.status.canceledSentProgress' : 'print.status.canceledSent', { sent: sentLabelCount })
      : tr('print.status.failed', { message: localizeErrorText(deps.language ?? 'zh-CN', error) })
    reportTerminal(message + (!serial.ok ? tr('print.status.serialNotWrittenSuffix', { message: serial.message ?? tr('print.status.unknown') }) : ''))
    return false
  } finally {
    if (hasSpool) await window.maxlabel.stagePrintCommand(journalId).catch(() => {})
    if (journaledSubmission || hasSpool) {
      const discard = !submissionPending && (test || !options.advanced.updateSerial || sentLabelCount === 0 || serialResult?.ok === true)
      await window.maxlabel.printRecovery?.({ jobId: journalId, discard }).catch(() => {})
      if (!discard) await deps.refreshRecovery?.().catch(() => {})
    }
    deps.setBusy(false)
    deps.setPrintProgress?.(null)
  }
}
