import { describe, expect, it } from 'vitest'
import type { PrinterConfig } from '@shared/domain/printer'
import { mediaSupportOfSelection } from '@/features/label-formats/mediaType'

/**
 * 介质可选性（020 现场）：新建标签时，当前打印机能打哪种介质，另一种单选要置灰。
 */
function printer(over: Partial<PrinterConfig> = {}): PrinterConfig {
  return { driver: 'tspl', dpi: 203, port: { type: 'driver', encoding: 'utf8' }, ...over } as unknown as PrinterConfig
}

describe('介质可选性', () => {
  it('内置标签机只支持卷筒', () => {
    expect(mediaSupportOfSelection(printer(), 'ls:zenpert-tspl-300')).toEqual({ roll: true, sheet: false })
  })

  it('Windows 驱动两种都放行（驱动按页面渲染，页面尺寸任意）', () => {
    expect(mediaSupportOfSelection(printer(), 'Zenpert TSPL-N (300 dpi)')).toEqual({ roll: true, sheet: true })
    expect(mediaSupportOfSelection(printer(), 'Zebra ZT230')).toEqual({ roll: true, sheet: true })
    expect(mediaSupportOfSelection(printer(), 'HP LaserJet Pro M329')).toEqual({ roll: true, sheet: true })
    // 020 现场：PDF 虚拟打印机没有物理介质限制
    expect(mediaSupportOfSelection(printer(), 'Microsoft Print to PDF')).toEqual({ roll: true, sheet: true })
  })

  it('直连端口（TCP/COM）按卷筒处理', () => {
    expect(mediaSupportOfSelection(printer({ port: { type: 'tcp', encoding: 'utf8' } as never }), '')).toEqual({ roll: true, sheet: false })
  })

  it('认不出打印机时两种都放行，不拦人', () => {
    expect(mediaSupportOfSelection(printer(), '')).toEqual({ roll: true, sheet: true })
  })
})
