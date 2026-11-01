import type { PrinterConfig } from '../../../../shared/domain/printer'
import { counterQueriesFor, estimateLocalCounters, type LocalCounterEstimate, type PrintCounterLogRow } from '../../../../shared/print/counters'
import { printerNameOf } from '../../../../shared/print/engine'

export type CounterSource = 'printer' | 'local'

export interface CounterNote {
  key: string
  params?: Record<string, string | number>
}

export interface PrinterCounterReading {
  /** 设备/本机可得的累计长度（米）。 */
  meters?: number
  /** 设备/本机可得的累计标签张数。 */
  labels?: number
  meterSource?: CounterSource
  labelSource?: CounterSource
  /** 本软件打印日志累计（始终计算，便于对照）。 */
  local: LocalCounterEstimate
  notes: CounterNote[]
}

/**
 * 读取当前打印机计数器。
 *
 * 设备字段优先用协议查询（TSPL `~!@`、Zebra SGD）；协议/端口读不到时，
 * 用本机打印日志估算，并在 notes 里明确标注来源，绝不把估算冒充设备终身值。
 */
export async function readPrinterCounters(printer: PrinterConfig): Promise<PrinterCounterReading> {
  const notes: CounterNote[] = []
  const seen = new Set<string>()
  const note = (key: string, params?: CounterNote['params']) => {
    const id = key + JSON.stringify(params ?? {})
    if (seen.has(id)) return
    seen.add(id)
    notes.push(params ? { key, params } : { key })
  }
  const reading: PrinterCounterReading = {
    local: { labels: 0, meters: 0, rows: 0 },
    notes
  }
  const queries = counterQueriesFor(printer.driver)
  if (!queries.length) note('printer.counter.noProtocol')
  if (printer.driver === 'cpcl') note('printer.counter.cpclNote')
  // preload/main 是旧进程时不会暴露新方法：给出可操作提示，而不是抛 raw TypeError。
  const canQuery = typeof window.maxlabel.queryPrinter === 'function'
  if (!canQuery && queries.length) note('printer.counter.clientOutdated')
  for (const query of canQuery ? queries : []) {
    let result: { ok: boolean; text?: string; message?: string }
    try {
      result = await window.maxlabel.queryPrinter({ text: query.command, encoding: 'utf8', port: printer.port, timeoutMs: 2500 })
    } catch (error) {
      note('printer.counter.readFailed', { message: error instanceof Error ? error.message : String(error) })
      continue
    }
    const value = result.ok && result.text ? query.parse(result.text) : undefined
    if (value === undefined) {
      if (result.message) note('printer.counter.readFailed', { message: result.message })
      else note('printer.counter.emptyResponse')
      continue
    }
    if (query.field === 'meters') {
      reading.meters = value
      reading.meterSource = 'printer'
    } else {
      reading.labels = value
      reading.labelSource = 'printer'
    }
  }

  try {
    const logs = await window.maxlabel.listPrintLogs()
    const printerName = printer.printerName?.trim() ? printerNameOf(printer) : undefined
    reading.local = estimateLocalCounters((logs.ok ? logs.logs ?? [] : []) as PrintCounterLogRow[], printerName)
    if (!printerName && reading.local.labels > 0) note('printer.counter.allPrinters')
  } catch {
    note('printer.counter.localUnavailable')
  }

  if (reading.labels === undefined && reading.local.labels > 0) {
    reading.labels = reading.local.labels
    reading.labelSource = 'local'
    note('printer.counter.localLabels')
  }
  if (reading.meters === undefined && reading.local.meters > 0) {
    reading.meters = reading.local.meters
    reading.meterSource = 'local'
    note('printer.counter.localMeters')
  }
  if (reading.meters === undefined) note('printer.counter.metersUnavailable')
  if (reading.meters !== undefined && reading.meterSource === 'printer' && (printer.driver === 'zpl' || printer.driver === 'cpcl')) {
    note('printer.counter.zebraLengthNote')
  }
  return reading
}
