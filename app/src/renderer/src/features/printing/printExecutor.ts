import { resolvePrintJob } from '../../../../shared/print/scene'
import { buildResolvedCommands } from '../../../../shared/print/engine'
import { buildExecutablePrintPlan } from '../../../../shared/print/plan'
import { layoutCount } from '../../rendering/pageLayout'
import { pageSizeMm, renderLabelDataUrl } from '../../print/renderLabel'
import { prepareBitmapsForPrintJob } from '../../print/bitmapSource'
import { MAX_DRIVER_DATA_BYTES } from '../../../../shared/print/limits'
import { activeDatasetView, createPrintContext, snapshotResolvedScene } from './printJob'
import { printJobJournal } from './printJobJournal'
import type { LabelDoc, PrinterConfig } from '../../../../shared/domain'
import { runGlobalScript } from '../../../../shared/domain/datasource'
import type { DocTab } from '../workspace/useDocumentWorkspace'

export interface PrintAdvancedOptions {
  autoCount: boolean
  copyField: boolean
  copyFieldName: string
  firstCopyAsk: boolean
  dupcheck: boolean
  currentOnly: boolean
  updateSerial: boolean
}

export interface PrintExecutionOptions {
  allowScript: boolean
  printNonPrintable: boolean
  advanced: PrintAdvancedOptions
  keyboardValues: Record<string, string>
}

export interface PrintExecutionDeps {
  sourceDoc: LabelDoc
  printTab: DocTab
  printer: PrinterConfig
  options: PrintExecutionOptions
  refreshAutoDb: (sourceDoc: LabelDoc, tabKey: string, expectedRevision?: number, signal?: AbortSignal) => Promise<{ doc: LabelDoc | undefined; error: string | null; revision?: number }>
  bumpSerial: (tabKey: string, count: number, expectedRevision: number, savePath?: string) => Promise<{ ok: boolean; message?: string }>
  logPrint: (mode: string, test: boolean, dataSnapshot: string[] | undefined, targetDoc: LabelDoc, summary: { logicalCount: number; physicalCount: number; copies: number; status: 'completed' | 'submitted' | 'partial' | 'failed' | 'canceled' | 'unknown'; sentCount: number }) => Promise<void>
  setBusy: (busy: boolean) => void
  setStatus: (status: string) => void
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
export async function executePrint(test: boolean, deps: PrintExecutionDeps, keyboardValues: Record<string, string>): Promise<void> {
  const { sourceDoc, printTab, printer, options } = deps
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
    printJobJournal.begin({ jobId: journalId, title: printDoc.name, mode, logicalCount: plan.logicalLabelCount, physicalCount: plan.physicalLabelCount, batchCount: mode === 'command' ? Math.ceil(plan.pages.length / PRINT_BATCH_PAGES) : 1 })
  }
  deps.setBusy(true)
  deps.setStatus(test ? '正在测试打印…' : '正在打印…')
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
    const layout = layoutOf(printDoc)
    const datasetView = activeDatasetView(printDoc, printTab.datasetName)
    const recordCount = datasetView.rows.length
    let pcount = test || options.advanced.currentOnly
      ? 1
      : (options.advanced.autoCount && recordCount > 0
          ? Math.max(1, recordCount - printTab.recordIdx)
          : printTab.count)
    const beginContext = runGlobalScript(printDoc.globalScript, createPrintContext({
      doc: printDoc,
      printer,
      copies: printTab.copies,
      count: pcount,
      keyboardValues,
      recordIndex: printTab.recordIdx,
      labelIndex: 1,
      datasetName: datasetView.name,
      allowScript: options.allowScript,
      now: jobNow
    }), test ? 2 : 2)
    if (options.allowScript && printDoc.globalScript && beginContext.totalLabels <= 0) {
      deps.setStatus('脚本设置的输出标签数量小于等于 0，未打印')
      return
    }
    if (options.allowScript && printDoc.globalScript && beginContext.totalLabels !== pcount * Math.max(1, printTab.copies)) pcount = beginContext.totalLabels
    let firstCopies: number | undefined
    assertPrintActive(signal)
    if (!test && options.advanced.firstCopyAsk) {
      const value = window.prompt('请输入第一个标签的拷贝数量：', String(printTab.copies))
      if (value === null) {
        deps.setStatus('已取消打印')
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
      copyField: !test && options.advanced.copyField ? options.advanced.copyFieldName : undefined
    }
    const executablePlan = buildExecutablePrintPlan(planInput, {
      deduplicateRecords: !test && options.advanced.dupcheck && recordCount > 0
    })
    plannedSummary = executablePlan

    if (!executablePlan.pages.length) {
      deps.setStatus('没有可打印的数据库记录，请检查起始记录和查询结果')
      return
    }

    const logAttempt = async (status: PrintLogStatus, sentCount: number) => {
      if (test || attemptLogged || !printMode) return
      attemptLogged = true
      await deps.logPrint(printMode, test, resolvedSnapshots.length ? [...resolvedSnapshots] : undefined, printDoc, { ...printSummary(executablePlan, printTab.copies), status, sentCount })
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
      if (sentLabelCount > 0) finalMessage += `（已发送 ${sentLabelCount} 张）`
      if (!serial.ok) finalMessage += '；已发送标签的序列号未回写：' + (serial.message ?? '未知错误')
      deps.setStatus(finalMessage)
    }

    if (printer.port.type === 'driver') {
      printMode = 'driver'
      startJournal('driver', executablePlan)
      attempted = true
      const pageSize = pageSizeMm(printDoc, layout)
      const driverPages: Array<{ dataUrl: string; copies: number }> = []
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
          recordIndex: first.recordIndex,
          labelIndex: first.labelIndex,
          datasetName: datasetView.name,
          allowScript: options.allowScript,
          sharedVars: beginContext.sharedVars,
          now: jobNow
        })
        context.totalLabels = executablePlan.physicalLabelCount
        const resolvedJob = resolvePrintJob(printDoc, context, layout, { ...executablePlan, pages: [page], physicalPageCount: 1 }, { includeSuppressed: options.printNonPrintable })
        if (resolvedJob.pages[0]) resolvedSnapshots.push(...snapshotResolvedScene(resolvedJob.pages[0].scene))
        const dataUrl = await renderLabelDataUrl(printDoc, {
          dpi: printer.dpi,
          layout,
          scene: resolvedJob.pages[0]?.scene,
          includeSuppressed: options.printNonPrintable
        })
        if (!dataUrl) {
          printJobJournal.finish(journalId, 'failed', '无法渲染标签')
          await logAttempt('failed', 0)
          deps.setStatus('打印失败：无法渲染标签')
          return
        }
        driverBytes += encodedBytes(dataUrl)
        if (driverBytes > MAX_DRIVER_DATA_BYTES) {
          throw new Error(`驱动打印任务图片超过 ${Math.round(MAX_DRIVER_DATA_BYTES / 1024 / 1024)} MB，请减少打印数量或降低分辨率`)
        }
        driverPages.push({ dataUrl, copies: page.copies })
        deps.setStatus('正在准备驱动打印（' + (index + 1) + '/' + executablePlan.physicalPageCount + ' 页）…')
      }
      assertPrintActive(signal)
      attempted = true
      const result = await window.maxlabel.printLabel({ pages: driverPages, widthMm: pageSize.widthMm, heightMm: pageSize.heightMm, printerName: printer.printerName }, jobId)
      if (!result.ok) {
        const status: PrintLogStatus = result.canceled ? 'canceled' : result.status === 'unknown' ? 'unknown' : 'failed'
        printJobJournal.finish(journalId, status, result.message)
        await logAttempt(status, 0)
        const serial = await commitKnownSerials()
        deps.setStatus(result.canceled ? '已取消驱动打印' : '驱动打印未完成：' + (result.message ?? '系统打印任务未提交'))
        if (!serial.ok) deps.setStatus('打印未完成，且已发送标签的序列号未回写：' + (serial.message ?? '未知错误'))
        return
      }
      sentLabelCount = executablePlan.physicalLabelCount
      sentLogicalCount = executablePlan.logicalLabelCount
      printJobJournal.progress(journalId, { sentLogicalCount, sentPhysicalCount: sentLabelCount, batchIndex: 1 })
      if (!test) await logAttempt('submitted', sentLabelCount)
      const serial = await commitKnownSerials()
      if (serial.ok) printJobJournal.serialCommitted(journalId)
      printJobJournal.finish(journalId, 'submitted')
      const planWarningText = executablePlan.warnings.slice(0, 3).join('；') + (executablePlan.warnings.length > 3 ? `；另有 ${executablePlan.warnings.length - 3} 条提示` : '')
      deps.setStatus('驱动打印任务已提交（' + executablePlan.physicalLabelCount + ' 张）' + (recordCount > 0 ? '· 数据库逐记录' : '') + (executablePlan.warnings.length ? '（提示：' + planWarningText + '）' : '') + (!serial.ok ? '· 序列号未回写：' + (serial.message ?? '未知错误') : '') + (test ? '· 测试打印不计日志、不推进序列号' : ''))
      return
    }

    printMode = 'command'
    startJournal('command', executablePlan)
    const warnings: string[] = [...executablePlan.warnings]
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
        recordIndex: first.recordIndex,
        labelIndex: first.labelIndex,
        datasetName: datasetView.name,
        allowScript: options.allowScript,
        sharedVars: beginContext.sharedVars,
        now: jobNow
      })
      context.totalLabels = executablePlan.physicalLabelCount
      const resolvedJob = resolvePrintJob(printDoc, context, layout, batchPlan, { includeSuppressed: options.printNonPrintable })
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
        await finishCommandFailure(sentLabelCount > 0 ? 'partial' : 'failed', '打印已阻止：当前指令集无法完整输出标签内容。' + detail)
        return
      }
      if (!commandResult.segments.length) {
        await finishCommandFailure(sentLabelCount > 0 ? 'partial' : 'failed', '打印失败：生成的指令为空')
        return
      }
      const result = await window.maxlabel.printCommand({
        segments: commandResult.segments,
        encoding: printer.port.encoding,
        port: printer.port
      }, jobId)
      if (!result.ok) {
        const status: PrintLogStatus = result.canceled ? 'canceled' : result.status === 'unknown' ? 'unknown' : sentLabelCount > 0 ? 'partial' : 'failed'
        printJobJournal.finish(journalId, status, result.message)
        await logAttempt(status, sentLabelCount)
        const serial = await commitKnownSerials()
        const serialMessage = serial.ok ? '' : '；已发送标签的序列号未回写：' + (serial.message ?? '未知错误')
        deps.setStatus((result.canceled ? `已取消打印（已发送 ${sentLabelCount} 张）` : '打印失败：第 ' + (Math.floor(offset / PRINT_BATCH_PAGES) + 1) + ' 批未完成（已发送 ' + sentLabelCount + ' 张）：' + (result.message ?? '未知错误')) + serialMessage)
        return
      }
      sentLabelCount += commandResult.labelCount
      sentLogicalCount += batchPages.reduce((sum, page) => sum + page.cells.length, 0)
      printJobJournal.progress(journalId, { sentLogicalCount, sentPhysicalCount: sentLabelCount, batchIndex: Math.floor(offset / PRINT_BATCH_PAGES) + 1 })
      // 只有传输层接受整批后，才把这批已解析数据写入日志；失败/未知批次不伪装成已发送。
      resolvedSnapshots.push(...batchSnapshots)
      deps.setStatus('正在发送打印任务（已发送 ' + sentLabelCount + '/' + executablePlan.physicalLabelCount + ' 张）…')
    }
    const serial = await commitKnownSerials()
    if (serial.ok) printJobJournal.serialCommitted(journalId)
    printJobJournal.finish(journalId, 'submitted')
    if (!test) await logAttempt('submitted', sentLabelCount)
    const warningText = warnings.slice(0, 3).join('；') + (warnings.length > 3 ? `；另有 ${warnings.length - 3} 条提示` : '')
    const warning = warnings.length ? '（提示：' + warningText + '）' : ''
    deps.setStatus('已发送 · ' + sentLabelCount + ' 张' + warning + (!serial.ok ? '· 序列号未回写：' + (serial.message ?? '未知错误') : '') + (test ? '· 测试打印不计日志、不推进序列号' : ''))
  } catch (err) {
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
        if (!serial.ok) deps.setStatus((canceled ? `已取消打印（已发送 ${sentLabelCount} 张）` : '打印失败：' + (err instanceof Error ? err.message : String(err))) + '；序列号未回写：' + (serial.message ?? '未知错误'))
        else deps.setStatus(canceled ? `已取消打印（已发送 ${sentLabelCount} 张，已推进已确认批次序列号）` : '打印失败：' + (err instanceof Error ? err.message : String(err)))
        return
      } catch { /* 保留下面的原始错误状态。 */ }
    }
    deps.setStatus(canceled ? `已取消打印（已发送 ${sentLabelCount} 张）` : '打印失败：' + (err instanceof Error ? err.message : String(err)))
  } finally {
    deps.setBusy(false)
  }
}
