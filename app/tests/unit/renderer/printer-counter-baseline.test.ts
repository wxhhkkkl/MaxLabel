// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import type { PrinterConfig } from '@shared/domain/printer'
import {
  COUNTER_BASELINE_STORAGE_KEY,
  counterSinceReset,
  readCounterBaseline,
  writeCounterBaseline
} from '@/features/printers/counterBaseline'

/**
 * 设备计数器复位（020 现场需求）：换打印头后从这里重新计数，用来估算下次更换。
 *
 * 打印机内部的终身计数器是**硬件只读**的，我们能复位的是「本软件记录的起点」——
 * 所以存基线、显示「自复位以来」，而不是假装清掉了设备上的数。
 */

function printer(name = 'TSPL-A'): PrinterConfig {
  return { driver: 'tspl', dpi: 203, printerName: name, port: { type: 'windows', name } } as unknown as PrinterConfig
}

const reading = {
  meters: 1200,
  labels: 30000,
  meterSource: 'printer' as const,
  labelSource: 'printer' as const,
  local: { labels: 0, meters: 0, rows: 0 },
  notes: []
}

describe('设备计数器基线 —— 存取', () => {
  beforeEach(() => { localStorage.clear() })

  it('复位后能读回同一台打印机的基线', () => {
    const baseline = writeCounterBaseline(printer(), reading, '2026-11-01T10:00:00.000Z')
    expect(baseline).toMatchObject({ meters: 1200, labels: 30000, meterSource: 'printer', at: '2026-11-01T10:00:00.000Z' })
    expect(readCounterBaseline(printer())).toMatchObject({ meters: 1200, labels: 30000 })
  })

  it('不同打印机互不影响', () => {
    writeCounterBaseline(printer('TSPL-A'), reading)
    expect(readCounterBaseline(printer('TSPL-B'))).toBeNull()
    expect(readCounterBaseline(printer('TSPL-A'))).not.toBeNull()
  })

  it('存档损坏时当作未复位，不抛异常', () => {
    localStorage.setItem(COUNTER_BASELINE_STORAGE_KEY, '{oops')
    expect(readCounterBaseline(printer())).toBeNull()
  })

  it('只记录本次读数里真实存在的项（读不到长度就不编一个）', () => {
    const baseline = writeCounterBaseline(printer(), { ...reading, meters: undefined, meterSource: undefined })
    expect(baseline.meters).toBeUndefined()
    expect(readCounterBaseline(printer())?.meters).toBeUndefined()
    expect(readCounterBaseline(printer())?.labels).toBe(30000)
  })
})

describe('设备计数器基线 —— 自复位以来的差值', () => {
  const baseline = { meters: 1200, labels: 30000, meterSource: 'printer' as const, labelSource: 'printer' as const, at: '2026-11-01T10:00:00.000Z' }
  /** 复位之后又打了一些 */
  const later = { ...reading, meters: 2000, labels: 42000 }

  it('同一来源时直接相减', () => {
    expect(counterSinceReset(later, baseline)).toEqual({ meters: 800, labels: 12000, metersStale: false, labelsStale: false })
  })

  it('来源变了（设备 ↔ 本软件累计）就不给差值，避免把两个口径混算', () => {
    const localReading = { ...reading, meterSource: 'local' as const }
    const since = counterSinceReset(localReading, baseline)
    expect(since.metersStale).toBe(true)
    expect(since.meters).toBeUndefined()
    expect(since.labelsStale).toBe(false)
  })

  it('当前值小于基线（设备被人为清零）时按 0 处理，不显示负数', () => {
    expect(counterSinceReset({ ...reading, meters: 200, labels: 100 }, baseline)).toMatchObject({ meters: 0, labels: 0 })
  })

  it('基线里没有某项时该项标记为不可比', () => {
    const since = counterSinceReset(later, { ...baseline, meters: undefined, meterSource: undefined })
    expect(since.metersStale).toBe(true)
    expect(since.labels).toBe(12000)
  })
})
