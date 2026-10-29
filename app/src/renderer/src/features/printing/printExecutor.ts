import { resolvePrintJob } from '../../../../shared/print/scene'
import { translate, localizeIpcMessage } from '../../../../shared/i18n/translate'
import type { Language } from '../../../../shared/i18n/types'
import { localizeErrorText } from '../../../../shared/i18n/errors.en-US'
import { buildResolvedCommands, type CommandSegment } from '../../../../shared/print/engine'
import { buildExecutablePrintPlan } from '../../../../shared/print/plan'
import { layoutCount } from '../../rendering/pageLayout'
import { pageSizeMm } from '../../print/renderLabel'
import { renderDriverPage } from '../../print/driverPage'
import { prepareBitmapsForPrintJob } from '../../print/bitmapSource'
import { MAX_DRIVER_DATA_BYTES } from '../../../../shared/print/limits'
import type { DriverPrintPage } from '../../../../shared/ipcContract'
import { activeDatasetView, createPrintContext, snapshotResolvedScene } from './printJob'
import { printJobJournal } from './printJobJournal'
import type { LabelDoc, PrinterConfig } from '../../../../shared/domain'
import { runGlobalScript } from '../../../../shared/domain/datasource'
import { prepareDocumentForPrint } from '../../../../shared/print/layout'
import type { DocTab } from '../workspace/useDocumentWorkspace'
import { hasWeighSources, resolveWeights, ScaleResolutionError, scaleErrorMessage } from '../scale/resolveWeights'
import { findInvalidBarcodeRecords, recordIndicesSkippingInvalid, type BarcodePreflightIssue } from './barcodePreflight'
import { findSerialBoundaryViolation } from '../../../../shared/print/serialBounds'

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
  sourceDoc: LabelDoc
  printTab: DocTab
  printer: PrinterConfig
  options: PrintExecutionOptions
  refreshAutoDb: (sourceDoc: LabelDoc, tabKey: string, expectedRevision?: number, signal?: AbortSignal) => Promise<{ doc: LabelDoc | undefined; error: string | null; revision?: number }>
  bumpSerial: (tabKey: string, count: number, expectedRevision: number, savePath?: string) => Promise<{ ok: boolean; message?: string }>
  /**
   * 正式打印前发现条码内容不合法时询问用户：true = 跳过这些记录继续打印，false = 中止。
   * 未提供时按中止处理（不允许静默打印出坏码）。
   */
  confirmBarcodePreflight?: (issues: BarcodePreflightIssue[], signal?: AbortSignal) => Promise<boolean>
  logPrint: (mode: string, test: boolean, dataSnapshot: string[] | undefined, targetDoc: LabelDoc, summary: { logicalCount: number; physicalCount: number; copies: number; status: 'completed' | 'submitted' | 'partial' | 'failed' | 'canceled' | 'unknown'; sentCount: number }) => Promise<void>
  setBusy: (busy: boolean) => void
  setStatus: (status: string) => void
  language?: Language
  signal?: AbortSignal
  jobId?: string
}

function layoutOf(doc: LabelDoc) {
  return doc.layout && (doc.layout.rows > 1 || doc.layout.cols > 1) ? doc.layout : undefined
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

/** 单一打印执行入口：驱动打印和原生指令打印共享同一份 PrintPlan。 */
export async function executePrint(test: boolean, deps: PrintExecutionDeps, keyboardValues: Record<string, string>, providedScaleValues?: Record<string, string[]>): Promise<void> {
  const { sourceDoc, printTab, printer, options } = deps
  const tr = (key: string, params?: Record<string, string | number>) => translate(deps.language ?? 'zh-CN', key, params)
  const printTabKey = printTab.key
  let printRevision = printTab.revision
  const jobNow = Date.now()
  const printPath = printTab.path
  const signal = deps.signal
  const jobId = deps.jobId
  let printMode: 'driver' | 'command' | undefined
  let attempted = false
  let attemptLogged = false
  let sentLabelCount = 0
  let sentLogicalCount = 0
  let serialCommitAttempted = false
  let printDoc = sourceDoc
  const resolvedSnapshots: string[] = []
  let plannedSummary = { logicalLabelCount: printTab.count, physicalLabelCount: 0 }
  const journalId = jobId ?? `local-${jobNow}`
  let journalStarted = false
  const startJournal = (mode: 'driver' | 'command', plan: { logicalLabelCount: number; physicalLabelCount: number; pages: readonly unknown[] }) => {
    if (test || journalStarted) return
    journalStarted = true
    printJobJournal.begin({ jobId: journalId, title: printDoc.name, mode, logicalCount: plan.logicalLabelCount, physicalCount: plan.physicalLabelCount, batchCount: mode === 'command' && printer.port.type !== 'file' ? Math.ceil(plan.pages.length / PRINT_BATCH_PAGES) : 1 })
  }
  deps.setBusy(true)
  deps.setStatus(test ? tr('print.status.testing') : tr('print.status.printing'))
  try {
    assertPrintActive(signal)
    if (!test) {
      const refreshed = await deps.refreshAutoDb(sourceDoc, printTabKey, printRevision, signal)
      assertPrintActive(signal)
      if (refreshed.error) {
        deps.setStatus(refreshed.error)
        return
      }
      if (refreshed.revision !== undefined) printRevision = refreshed.revision
      printDoc = refreshed.doc ?? sourceDoc
    }
    printDoc = prepareDocumentForPrint(printDoc, {
      autoRotateOutput: options.autoRotateOutput,
      rotate180: options.advanced.rotate180,
      printBorder: options.advanced.printBorder === true
    })
    const layout = layoutOf(printDoc)
    const datasetView = activeDatasetView(printDoc, printTab.datasetName)
    const recordCount = datasetView.rows.length
    // Auto-print ignores the print count entirely: one stable reading, one label.
    let pcount = options.singleLogicalLabel === true || test || options.advanced.currentOnly
      ? 1
      : (options.advanced.autoCount && recordCount > 0
          ? Math.max(1, recordCount - printTab.recordIdx)
          : printTab.count)
    // One fresh stable reading per logical label. Auto-print supplies the value it
    // already captured for its single label and must not trigger a second read.
    let scaleValues = providedScaleValues
    if (hasWeighSources(printDoc)) {
      if (!scaleValues) {
        deps.setStatus(tr('scale.reading'))
        scaleValues = await resolveWeights(printDoc, { count: Math.max(1, pcount), language: deps.language, signal })
      }
      assertPrintActive(signal)
    }
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
    }), test ? 2 : 2)
    if (options.allowScript && printDoc.globalScript && beginContext.totalLabels <= 0) {
      deps.setStatus(tr('print.status.scriptZero'))
      return
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
        return
      }
      firstCopies = Math.max(1, parseInt(value.trim() || '1', 10) || 1)
    }
    const planInput = {
      test,
      requestedCount: pcount,
      recordStart: printTab.recordIdx,
      dataset: datasetView.name ? { name: datasetView.name, columns: datasetView.columns, rows: datasetView.rows } : undefined,
      cellsPerPage: layoutCount(layout),
      startSlot: printTab.startLabel,
      defaultCopies: printTab.copies,
      firstCopies,
      physicalLabelLimit: scriptTotal,
      copyField: !test && options.advanced.copyField ? options.advanced.copyFieldName : undefined
    }
    let executablePlan = buildExecutablePrintPlan(planInput, {
      deduplicateRecords: !test && options.advanced.dupcheck && recordCount > 0
    })
    plannedSummary = executablePlan

    if (!executablePlan.pages.length) {
      deps.setStatus(tr('print.status.noRecords'))
      return
    }

    const firstCell = executablePlan.pages[0]?.cells[0]
    const planContext = createPrintContext({
      doc: printDoc,
      printer,
      copies: firstCell?.copies ?? printTab.copies,
      count: executablePlan.logicalLabelCount,
      keyboardValues,
      scaleValues,
      recordIndex: firstCell?.recordIndex ?? printTab.recordIdx,
      labelIndex: firstCell?.labelIndex ?? 1,
      datasetName: datasetView.name,
      allowScript: options.allowScript,
      sharedVars: beginContext.sharedVars,
      now: jobNow
    })

    // 条码序列号的边界值：会越过终点就整单中止（一页不打、序列号也不推进）。
    const boundary = findSerialBoundaryViolation(printDoc, executablePlan, planContext, options.printNonPrintable)
    if (boundary) {
      deps.setStatus(tr('print.status.serialBoundary', {
        end: boundary.endText,
        available: boundary.available,
        required: boundary.required
      }))
      return
    }

    // 正式打印前先把每条记录的条码内容过一遍：坏数据在这里就告诉用户，
    // 而不是打到一半才由 bwip-js 抛错、整批中止（驱动模式一页都打不出）。
    if (!test && recordCount > 0) {
      deps.setStatus(tr('print.status.preflightChecking'))
      const issues = await findInvalidBarcodeRecords({
        doc: printDoc,
        layout,
        plan: executablePlan,
        ctx: planContext,
        includeSuppressed: options.printNonPrintable,
        signal
      })
      assertPrintActive(signal)
      if (issues.length) {
        const invalidRecords = new Set(issues.map((item) => item.recordIndex))
        const skip = deps.confirmBarcodePreflight ? await deps.confirmBarcodePreflight(issues, signal) : false
        assertPrintActive(signal)
        if (!skip) {
          deps.setStatus(tr('print.status.preflightAborted', { count: invalidRecords.size }))
          return
        }
        const remaining = recordIndicesSkippingInvalid(executablePlan, invalidRecords)
        if (!remaining.length) {
          deps.setStatus(tr('print.status.preflightNoRecords'))
          return
        }
        executablePlan = buildExecutablePrintPlan({ ...planInput, requestedCount: remaining.length, recordIndices: remaining })
        executablePlan.warnings.push(tr('print.status.preflightSkipped', { count: invalidRecords.size }))
        plannedSummary = executablePlan
      }
      deps.setStatus(tr('print.status.printing'))
    }

    const logAttempt = async (status: PrintLogStatus, sentCount: number) => {
      if (test || attemptLogged || !printMode) return
      attemptLogged = true
      try {
        await deps.logPrint(printMode, test, resolvedSnapshots.length ? [...resolvedSnapshots] : undefined, printDoc, { ...printSummary(executablePlan, printTab.copies), status, sentCount })
      } catch {
        // A log failure must never turn a completed print into a failed job.
      }
    }

    const commitKnownSerials = async (): Promise<{ ok: boolean; message?: string }> => {
      if (test || !options.advanced.updateSerial || sentLogicalCount <= 0 || serialCommitAttempted) return { ok: true }
      serialCommitAttempted = true
      return deps.bumpSerial(printTabKey, sentLogicalCount, printRevision, printPath)
    }

    const finishCommandFailure = async (status: PrintLogStatus, message: string): Promise<void> => {
      printJobJournal.finish(journalId, status === 'completed' ? 'submitted' : status, message)
      await logAttempt(status, sentLabelCount)
      const serial = await commitKnownSerials()
      let finalMessage = message
      if (sentLabelCount > 0) finalMessage += tr('print.status.sentSuffix', { sent: sentLabelCount })
      if (!serial.ok) finalMessage += tr('print.status.serialNotWrittenPrefix', { message: serial.message ?? tr('print.status.unknown') })
      deps.setStatus(finalMessage)
    }

    if (printer.port.type === 'driver') {
      printMode = 'driver'
      startJournal('driver', executablePlan)
      attempted = true
      const pageSize = pageSizeMm(printDoc, layout)
      const driverPages: DriverPrintPage[] = []
      let driverBytes = 0
      for (const [index, page] of executablePlan.pages.entries()) {
        assertPrintActive(signal)
        const first = page.cells[0]
        if (!first) continue
        const context = createPrintContext({
          doc: printDoc,
          printer,
          copies: page.copies,
          count: executablePlan.logicalLabelCount,
          keyboardValues,
          scaleValues,
          recordIndex: first.recordIndex,
          labelIndex: first.labelIndex,
          datasetName: datasetView.name,
          allowScript: options.allowScript,
          sharedVars: beginContext.sharedVars,
          now: jobNow
        })
        context.totalLabels = executablePlan.physicalLabelCount
        const resolvedJob = resolvePrintJob(printDoc, context, layout, { ...executablePlan, pages: [page], physicalPageCount: 1 }, { includeSuppressed: options.printNonPrintable, scriptState, finishScript: index === executablePlan.pages.length - 1 })
        if (resolvedJob.pages[0]) resolvedSnapshots.push(...snapshotResolvedScene(resolvedJob.pages[0].scene))
        const rendered = await renderDriverPage(printDoc, {
          dpi: printer.dpi,
          layout,
          scene: resolvedJob.pages[0]?.scene,
          includeSuppressed: options.printNonPrintable
        })
        driverBytes += encodedBytes(rendered.kind === 'svg' ? rendered.svg : rendered.dataUrl)
        if (driverBytes > MAX_DRIVER_DATA_BYTES) {
          throw new Error(tr('print.status.driverTooLarge', { mb: Math.round(MAX_DRIVER_DATA_BYTES / 1024 / 1024) }))
        }
        driverPages.push(rendered.kind === 'svg' ? { svg: rendered.svg, copies: page.copies } : { dataUrl: rendered.dataUrl, copies: page.copies })
        deps.setStatus(tr('print.status.preparing', { page: index + 1, total: executablePlan.physicalPageCount }))
      }
      assertPrintActive(signal)
      attempted = true
      const result = await window.maxlabel.printLabel({ pages: driverPages, widthMm: pageSize.widthMm, heightMm: pageSize.heightMm, printerName: printer.printerName }, jobId)
      if (!result.ok) {
        const status: PrintLogStatus = result.canceled ? 'canceled' : result.status === 'unknown' ? 'unknown' : 'failed'
        printJobJournal.finish(journalId, status, result.message)
        await logAttempt(status, 0)
        const serial = await commitKnownSerials()
        deps.setStatus(result.canceled ? tr('print.status.canceled') : tr('print.status.driverFailed', { message: localizeIpcMessage(deps.language ?? 'zh-CN', { message: result.message ?? '', messageKey: result.messageKey, messageParams: result.messageParams }) || tr('print.status.unknown') }))
        if (!serial.ok) deps.setStatus(tr('print.status.printIncompleteSerial', { message: serial.message ?? tr('print.status.unknown') }))
        return
      }
      sentLabelCount = executablePlan.physicalLabelCount
      sentLogicalCount = executablePlan.logicalLabelCount
      printJobJournal.progress(journalId, { sentLogicalCount, sentPhysicalCount: sentLabelCount, batchIndex: 1 })
      if (!test) await logAttempt('submitted', sentLabelCount)
      const serial = await commitKnownSerials()
      if (serial.ok) printJobJournal.serialCommitted(journalId)
      printJobJournal.finish(journalId, 'submitted')
      const planWarningText = executablePlan.warnings.slice(0, 3).join(tr('print.status.warningSeparator')) + (executablePlan.warnings.length > 3 ? tr('print.status.moreWarnings', { count: executablePlan.warnings.length - 3 }) : '')
      deps.setStatus(tr('print.status.driverSubmitted', { count: executablePlan.physicalLabelCount }) + (recordCount > 0 ? ' · ' + tr('print.status.databaseRecord') : '') + (executablePlan.warnings.length ? ' (' + planWarningText + ')' : '') + (!serial.ok ? ' · ' + tr('print.status.serialNotWritten', { message: serial.message ?? tr('print.status.unknown') }) : '') + (test ? ' · ' + tr('print.status.testNote') : ''))
      return
    }

    printMode = 'command'
    startJournal('command', executablePlan)
    const warnings: string[] = [...executablePlan.warnings]
    const fileOutput = printer.port.type === 'file'
    const fileSegments: CommandSegment[] = []
    const fileSnapshots: string[] = []
    let fileBytes = 0
    attempted = true
    for (let offset = 0; offset < executablePlan.pages.length; offset += PRINT_BATCH_PAGES) {
      assertPrintActive(signal)
      const batchPages = executablePlan.pages.slice(offset, offset + PRINT_BATCH_PAGES)
      const batchPhysicalLabelCount = batchPages.reduce((sum, page) => sum + page.cells.reduce((pageSum, cell) => pageSum + cell.copies, 0), 0)
      const batchPlan = { ...executablePlan, pages: batchPages, physicalPageCount: batchPages.length, physicalLabelCount: batchPhysicalLabelCount }
      const first = batchPages[0]?.cells[0]
      if (!first) continue
      const context = createPrintContext({
        doc: printDoc,
        printer,
        copies: first.copies,
        count: executablePlan.logicalLabelCount,
        keyboardValues,
        scaleValues,
        recordIndex: first.recordIndex,
        labelIndex: first.labelIndex,
        datasetName: datasetView.name,
        allowScript: options.allowScript,
        sharedVars: beginContext.sharedVars,
        now: jobNow
      })
      context.totalLabels = executablePlan.physicalLabelCount
      const resolvedJob = resolvePrintJob(printDoc, context, layout, batchPlan, { includeSuppressed: options.printNonPrintable, scriptState, finishScript: offset + PRINT_BATCH_PAGES >= executablePlan.pages.length })
      const preparedJob = await prepareBitmapsForPrintJob(resolvedJob, printer)
      const batchSnapshots = preparedJob.pages.flatMap((page) => snapshotResolvedScene(page.scene))
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
        includePostamble: offset + PRINT_BATCH_PAGES >= executablePlan.pages.length
      })
      warnings.push(...commandResult.warnings)
      const blockingWarnings = commandResult.warningDetails.filter((item) => item.severity === 'error')
      if (blockingWarnings.length) {
        const detail = blockingWarnings.slice(0, 3).map((item) => item.message).join('；')
        await finishCommandFailure(sentLabelCount > 0 ? 'partial' : 'failed', tr('print.status.blocked') + detail)
        return
      }
      if (!commandResult.segments.length) {
        await finishCommandFailure(sentLabelCount > 0 ? 'partial' : 'failed', tr('print.status.emptyCommands'))
        return
      }
      assertPrintActive(signal)
      if (fileOutput) {
        fileBytes += commandResult.segments.reduce((sum, segment) => sum + (segment.type === 'text' ? encodedBytes(segment.str) : segment.data.byteLength), 0)
        if (fileBytes > 64 * 1024 * 1024 || fileSegments.length + commandResult.segments.length > 100000) throw new Error(tr('print.status.fileTooLarge'))
        fileSegments.push(...commandResult.segments)
        fileSnapshots.push(...batchSnapshots)
        deps.setStatus(tr('print.status.preparingFile', { page: Math.min(offset + PRINT_BATCH_PAGES, executablePlan.pages.length), total: executablePlan.pages.length }))
        continue
      }
      const result = await window.maxlabel.printCommand({
        segments: commandResult.segments,
        encoding: printer.port.encoding,
        port: printer.port,
        language: deps.language
      }, jobId)
      if (!result.ok) {
        const status: PrintLogStatus = result.canceled ? 'canceled' : result.status === 'unknown' ? 'unknown' : sentLabelCount > 0 ? 'partial' : 'failed'
        printJobJournal.finish(journalId, status, result.message)
        await logAttempt(status, sentLabelCount)
        const serial = await commitKnownSerials()
        const serialMessage = serial.ok ? '' : tr('print.status.warningSeparator') + tr('print.status.serialNotWritten', { message: serial.message ?? tr('print.status.unknown') })
        const localizedFailure = localizeIpcMessage(deps.language ?? 'zh-CN', { message: result.message ?? '', messageKey: result.messageKey, messageParams: result.messageParams })
        deps.setStatus((result.canceled ? tr('print.status.canceledSent', { sent: sentLabelCount }) : tr('print.status.batchFailed', { batch: Math.floor(offset / PRINT_BATCH_PAGES) + 1, sent: sentLabelCount, message: localizedFailure || tr('print.status.unknown') })) + serialMessage)
        return
      }
      sentLabelCount += commandResult.labelCount
      sentLogicalCount += batchPages.reduce((sum, page) => sum + page.cells.length, 0)
      printJobJournal.progress(journalId, { sentLogicalCount, sentPhysicalCount: sentLabelCount, batchIndex: Math.floor(offset / PRINT_BATCH_PAGES) + 1 })
      // 只有传输层接受整批后，才把这批已解析数据写入日志；失败/未知批次不伪装成已发送。
      resolvedSnapshots.push(...batchSnapshots)
      deps.setStatus(tr('print.status.sending', { sent: sentLabelCount, total: executablePlan.physicalLabelCount }))
    }
    if (fileOutput) {
      assertPrintActive(signal)
      const result = await window.maxlabel.printCommand({ segments: fileSegments, encoding: printer.port.encoding, port: printer.port, language: deps.language }, jobId)
      if (!result.ok) {
        await finishCommandFailure(result.canceled ? 'canceled' : result.status === 'unknown' ? 'unknown' : 'failed', result.canceled ? tr('print.status.canceled') : tr('print.status.saveFileFailed', { message: localizeIpcMessage(deps.language ?? 'zh-CN', { message: result.message ?? '', messageKey: result.messageKey, messageParams: result.messageParams }) || tr('print.status.unknown') }))
        return
      }
      sentLabelCount = executablePlan.physicalLabelCount
      sentLogicalCount = executablePlan.logicalLabelCount
      resolvedSnapshots.push(...fileSnapshots)
      printJobJournal.progress(journalId, { sentLogicalCount, sentPhysicalCount: sentLabelCount, batchIndex: 1 })
    }
    const serial = await commitKnownSerials()
    if (serial.ok) printJobJournal.serialCommitted(journalId)
    printJobJournal.finish(journalId, 'submitted')
    if (!test) await logAttempt('submitted', sentLabelCount)
    const warningText = warnings.slice(0, 3).join(tr('print.status.warningSeparator')) + (warnings.length > 3 ? tr('print.status.moreWarnings', { count: warnings.length - 3 }) : '')
    const warning = warnings.length ? tr('print.status.hintPrefix') + warningText + tr('print.status.hintSuffix') : ''
    deps.setStatus(tr('print.status.sent', { sent: sentLabelCount }) + warning + (!serial.ok ? ' · ' + tr('print.status.serialNotWritten', { message: serial.message ?? tr('print.status.unknown') }) : '') + (test ? ' · ' + tr('print.status.testNote') : ''))
  } catch (err) {
    if (err instanceof ScaleResolutionError) {
      deps.setStatus(err.canceled || signal?.aborted ? tr('print.status.canceled') : scaleErrorMessage(deps.language ?? 'zh-CN', err))
      return
    }
    const canceled = signal?.aborted || err instanceof PrintCancelledError
    if (journalStarted) printJobJournal.finish(journalId, canceled ? 'canceled' : sentLabelCount > 0 ? 'partial' : 'failed', err instanceof Error ? err.message : String(err))
    if (!test && attempted && printMode && !attemptLogged) {
      attemptLogged = true
      try {
        await deps.logPrint(printMode, test, resolvedSnapshots.length ? [...resolvedSnapshots] : undefined, printDoc, { ...printSummary(plannedSummary, printTab.copies), status: canceled ? 'canceled' : sentLabelCount > 0 ? 'partial' : 'failed', sentCount: sentLabelCount })
      } catch { /* 日志失败不应覆盖原始打印结果。 */ }
    }
    if (!test && options.advanced.updateSerial && sentLogicalCount > 0 && !serialCommitAttempted) {
      serialCommitAttempted = true
      try {
        const serial = await deps.bumpSerial(printTabKey, sentLogicalCount, printRevision, printPath)
        if (!serial.ok) deps.setStatus((canceled ? tr('print.status.canceledSent', { sent: sentLabelCount }) : tr('print.status.failed', { message: localizeErrorText(deps.language ?? 'zh-CN', err instanceof Error ? err.message : String(err)) })) + tr('print.status.serialNotWrittenSuffix', { message: serial.message ?? tr('print.status.unknown') }))
        else deps.setStatus(canceled ? tr('print.status.canceledSentProgress', { sent: sentLabelCount }) : tr('print.status.failed', { message: localizeErrorText(deps.language ?? 'zh-CN', err instanceof Error ? err.message : String(err)) }))
        return
      } catch { /* 保留下面的原始错误状态。 */ }
    }
    deps.setStatus(canceled ? tr('print.status.canceledSent', { sent: sentLabelCount }) : tr('print.status.failed', { message: localizeErrorText(deps.language ?? 'zh-CN', err instanceof Error ? err.message : String(err)) }))
  } finally {
    deps.setBusy(false)
  }
}
