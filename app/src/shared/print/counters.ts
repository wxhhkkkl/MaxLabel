import type { CommandSet } from '../domain/printer'

export type CounterField = 'meters' | 'labels'

export interface CounterQuery {
  field: CounterField
  /** 原样发给打印机的 ASCII 指令（已带换行）。 */
  command: string
  parse: (raw: string) => number | undefined
}

function lastMeaningfulLine(raw: string): string {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  return lines[lines.length - 1] ?? ''
}

/** TSPL `~!@`：返回里程的整数部分（米），以 CR 结尾。 */
export function parseTsplMileage(raw: string): number | undefined {
  const match = /\d+/.exec(lastMeaningfulLine(raw))
  if (!match) return undefined
  const meters = Number(match[0])
  return Number.isFinite(meters) ? meters : undefined
}

/** Zebra SGD 数值：响应通常是带引号的一行，部分固件会回显查询指令。 */
export function parseSgdNumber(raw: string): number | undefined {
  const value = lastMeaningfulLine(raw).replace(/["']/g, '')
  const match = /-?\d+/.exec(value)
  if (!match) return undefined
  const number = Number(match[0])
  return Number.isFinite(number) ? number : undefined
}

/**
 * Zebra `odometer.total_print_length` 形如 `"8560 INCHES, 21744 CENTIMETERS"`
 * （总走纸长度，含回退）。统一换算成米；从未打印过时固件可能只返回 `"0"`。
 */
export function parseZebraPrintLength(raw: string): number | undefined {
  const text = raw.toUpperCase()
  const centimeters = /([\d.]+)\s*CENTIMET(?:ER|RE)S/.exec(text)
  if (centimeters) {
    const meters = Number(centimeters[1]) / 100
    return Number.isFinite(meters) ? Math.round(meters * 1000) / 1000 : undefined
  }
  const inches = /([\d.]+)\s*INCH(?:ES)?/.exec(text)
  if (inches) {
    const meters = Number(inches[1]) * 0.0254
    return Number.isFinite(meters) ? Math.round(meters * 1000) / 1000 : undefined
  }
  if (lastMeaningfulLine(raw).replace(/["']/g, '') === '0') return 0
  return undefined
}

/**
 * 当前驱动可查询的计数器。
 *
 * - TSPL/TSPL2：`~!@` 返回里程（米）；标准指令没有可回读的张数，张数由本机日志估算。
 * - ZPL / CPCL（Zebra 系）：SGD `odometer.total_label_count` / `odometer.total_print_length`。
 * - ESC/POS：没有标准寿命计数器。
 */
export function counterQueriesFor(driver: CommandSet): CounterQuery[] {
  if (driver === 'tspl') {
    return [{ field: 'meters', command: '~!@\r\n', parse: parseTsplMileage }]
  }
  if (driver === 'zpl' || driver === 'cpcl') {
    return [
      { field: 'labels', command: '! U1 getvar "odometer.total_label_count"\r\n', parse: parseSgdNumber },
      { field: 'meters', command: '! U1 getvar "odometer.total_print_length"\r\n', parse: parseZebraPrintLength }
    ]
  }
  return []
}

export interface PrintCounterLogRow {
  count?: unknown
  copies?: unknown
  physicalCount?: unknown
  sentCount?: unknown
  status?: unknown
  test?: unknown
  printer?: unknown
  labelHeightMm?: unknown
}

export interface LocalCounterEstimate {
  /** 本软件累计打印标签张数。 */
  labels: number
  /** 有标签高度记录的任务累计长度（米）；没有高度的旧记录按 0 长度跳过。 */
  meters: number
  /** 参与统计的任务条数。 */
  rows: number
}

function finiteCount(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

/**
 * 用本机打印日志（print-log.jsonl）估算「本软件累计」。
 * 打印机不支持张数/长度查询时，用它给一个明确标注来源的参考值；不冒充设备终身计数。
 */
export function estimateLocalCounters(rows: readonly PrintCounterLogRow[], printerName?: string): LocalCounterEstimate {
  const wanted = printerName?.trim().toLowerCase() ?? ''
  let labels = 0
  let meters = 0
  let used = 0
  for (const row of rows) {
    if (row.test === true) continue
    if (row.status === 'failed' || row.status === 'canceled') continue
    if (wanted) {
      const name = typeof row.printer === 'string' ? row.printer.trim().toLowerCase() : ''
      if (name !== wanted) continue
    }
    const count = finiteCount(row.count) ?? 0
    const copies = finiteCount(row.copies) ?? 1
    const rowLabels = finiteCount(row.sentCount) ?? finiteCount(row.physicalCount) ?? count * copies
    if (rowLabels <= 0) continue
    used += 1
    labels += rowLabels
    // 旧日志没有标签高度：这一条只计张数，不参与长度累计。
    const height = finiteCount(row.labelHeightMm)
    if (height && height > 0) meters += (rowLabels * height) / 1000
  }
  return { labels, meters: Math.round(meters * 1000) / 1000, rows: used }
}
