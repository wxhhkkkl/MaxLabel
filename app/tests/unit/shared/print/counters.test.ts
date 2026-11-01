import { describe, expect, it } from 'vitest'
import {
  counterQueriesFor,
  estimateLocalCounters,
  parseSgdNumber,
  parseTsplMileage,
  parseZebraPrintLength
} from '@shared/print/counters'

describe('打印机计数器查询', () => {
  it('TSPL 用 ~!@ 读取里程（整数米，CR 结尾）', () => {
    const queries = counterQueriesFor('tspl')
    expect(queries.map((query) => query.field)).toEqual(['meters'])
    expect(queries[0].command).toBe('~!@\r\n')
    expect(parseTsplMileage('133\r')).toBe(133)
    expect(parseTsplMileage('  1024\r\n')).toBe(1024)
    expect(parseTsplMileage('')).toBeUndefined()
  })

  it('ZPL / CPCL 用 SGD 读取张数和长度', () => {
    for (const driver of ['zpl', 'cpcl'] as const) {
      const queries = counterQueriesFor(driver)
      expect(queries.map((query) => query.field).sort()).toEqual(['labels', 'meters'])
      expect(queries.every((query) => query.command.startsWith('! U1 getvar "odometer.'))).toBe(true)
    }
  })

  it('ESC/POS 没有标准计数器', () => {
    expect(counterQueriesFor('escpos')).toEqual([])
  })

  it('解析 SGD 数字（忽略引号和回显）', () => {
    expect(parseSgdNumber('! U1 getvar "odometer.total_label_count"\r\n"31084"\r\n')).toBe(31084)
    expect(parseSgdNumber('"302"\r\n')).toBe(302)
    expect(parseSgdNumber('error')).toBeUndefined()
  })

  it('解析 Zebra 打印长度（厘米/英寸 → 米）', () => {
    expect(parseZebraPrintLength('"8560 INCHES, 21744 CENTIMETERS"')).toBe(217.44)
    expect(parseZebraPrintLength('"100 INCHES"')).toBe(2.54)
    expect(parseZebraPrintLength('"0"')).toBe(0)
    expect(parseZebraPrintLength('n/a')).toBeUndefined()
  })
})

describe('本机打印日志估算', () => {
  it('按已发送张数/计划张数累计，跳过测试和失败任务', () => {
    const estimate = estimateLocalCounters([
      { status: 'completed', physicalCount: 10, sentCount: 10, labelHeightMm: 50, test: false },
      { status: 'partial', physicalCount: 5, sentCount: 3, labelHeightMm: 40, test: false },
      { status: 'failed', physicalCount: 8, sentCount: 0, labelHeightMm: 50, test: false },
      { status: 'canceled', physicalCount: 8, sentCount: 0, labelHeightMm: 50, test: false },
      { status: 'submitted', physicalCount: 100, sentCount: 100, labelHeightMm: 60, test: true }
    ])
    expect(estimate.labels).toBe(13)
    expect(estimate.meters).toBeCloseTo(0.5 + 0.12, 6)
  })

  it('历史日志没有标签高度时只计张数，长度按已有记录累计', () => {
    const estimate = estimateLocalCounters([
      { status: 'completed', physicalCount: 10 },
      { status: 'completed', physicalCount: 10, labelHeightMm: 50 }
    ])
    expect(estimate.labels).toBe(20)
    expect(estimate.meters).toBe(0.5)
  })

  it('可以按打印机名称筛选', () => {
    const rows = [
      { status: 'completed', physicalCount: 4, labelHeightMm: 50, printer: 'TSPL @203dpi · A' },
      { status: 'completed', physicalCount: 6, labelHeightMm: 50, printer: 'TSPL @203dpi · B' }
    ]
    expect(estimateLocalCounters(rows, 'tspl @203dpi · a').labels).toBe(4)
    expect(estimateLocalCounters(rows).labels).toBe(10)
  })
})
