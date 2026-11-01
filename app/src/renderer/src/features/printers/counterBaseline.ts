import type { PrinterConfig } from '../../../../shared/domain/printer'
import { printerNameOf } from '../../../../shared/print/engine'
import type { CounterSource } from './printerCounters'

/**
 * 设备计数器的**复位基线**。
 *
 * 打印机内部的终身计数器是硬件只读的（协议查询也只给读），我们改不了它。
 * 现场的用法是：换打印头时点一次「复位」，之后看「自复位以来」的张数/长度
 * 来估算下一次更换 —— 所以这里存的是**起点快照**，不是把设备清零。
 */
export interface CounterBaseline {
  meters?: number
  labels?: number
  meterSource?: CounterSource
  labelSource?: CounterSource
  /** 复位时刻（ISO 字符串） */
  at: string
}

export interface CounterSinceReset {
  meters?: number
  labels?: number
  /** 当前读数与基线来源不同（设备 ↔ 本软件累计），差值不可比 */
  metersStale: boolean
  labelsStale: boolean
}

export const COUNTER_BASELINE_STORAGE_KEY = 'maxlabel.counterBaselines'

/** 基线按打印机区分：同一台机器换个名字/驱动就是另一个计数对象。 */
export function baselineKeyOf(printer: PrinterConfig): string {
  return printerNameOf(printer)
}

function readAll(): Record<string, CounterBaseline> {
  try {
    const raw = localStorage.getItem(COUNTER_BASELINE_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, CounterBaseline>
  } catch {
    return {}
  }
}

function writeAll(value: Record<string, CounterBaseline>): void {
  try {
    localStorage.setItem(COUNTER_BASELINE_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // 偏好是可选能力，写失败不影响打印。
  }
}

export function readCounterBaseline(printer: PrinterConfig): CounterBaseline | null {
  const entry = readAll()[baselineKeyOf(printer)]
  if (!entry || typeof entry !== 'object' || typeof entry.at !== 'string') return null
  return entry
}

/** 以当前读数为新的起点；读不到的项不写，避免编一个假基线。 */
export function writeCounterBaseline(
  printer: PrinterConfig,
  reading: { meters?: number; labels?: number; meterSource?: CounterSource; labelSource?: CounterSource },
  now: string = new Date().toISOString()
): CounterBaseline {
  const baseline: CounterBaseline = { at: now }
  if (typeof reading.meters === 'number') {
    baseline.meters = reading.meters
    baseline.meterSource = reading.meterSource
  }
  if (typeof reading.labels === 'number') {
    baseline.labels = reading.labels
    baseline.labelSource = reading.labelSource
  }
  const all = readAll()
  all[baselineKeyOf(printer)] = baseline
  writeAll(all)
  return baseline
}

/** 自复位以来增加了多少；来源不一致或缺项时该维度标记为不可比。 */
export function counterSinceReset(
  reading: { meters?: number; labels?: number; meterSource?: CounterSource; labelSource?: CounterSource },
  baseline: CounterBaseline
): CounterSinceReset {
  const metersComparable = typeof baseline.meters === 'number'
    && typeof reading.meters === 'number'
    && baseline.meterSource === reading.meterSource
  const labelsComparable = typeof baseline.labels === 'number'
    && typeof reading.labels === 'number'
    && baseline.labelSource === reading.labelSource
  return {
    // 设备被人为清零时当前值会小于基线，按 0 处理，别显示负数
    meters: metersComparable ? Math.max(0, (reading.meters as number) - (baseline.meters as number)) : undefined,
    labels: labelsComparable ? Math.max(0, (reading.labels as number) - (baseline.labels as number)) : undefined,
    metersStale: !metersComparable,
    labelsStale: !labelsComparable
  }
}
