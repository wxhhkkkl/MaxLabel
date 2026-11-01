import { describe, expect, it } from 'vitest'
import type { PrinterConfig } from '@shared/domain/printer'
import { canChoosePrinter } from '@/features/printing/printerSelectMode'

/**
 * 打印面板「打印机」下拉的可选性（020 现场问题）
 *
 * 判定曾经写成 `doc.printer?.port.type !== 'driver'` —— 模板**没存过打印机配置**时
 * `doc.printer` 是 undefined，条件为真，下拉被误禁用（老模板正是这种）。
 * 没配置应当等同于「系统默认打印机（驱动）」。
 */
function printer(portType: PrinterConfig['port']['type']): PrinterConfig {
  return { driver: 'tspl', dpi: 203, port: { type: portType, encoding: 'utf8' } } as unknown as PrinterConfig
}

describe('打印机下拉可选性', () => {
  it('模板没有打印机配置时按驱动模式处理，可选', () => {
    expect(canChoosePrinter(undefined)).toBe(true)
  })

  it('驱动模式可选', () => {
    expect(canChoosePrinter(printer('driver'))).toBe(true)
  })

  it('文件 / TCP / 串口等直连模式下，打印机名无意义，不可选', () => {
    expect(canChoosePrinter(printer('file'))).toBe(false)
    expect(canChoosePrinter(printer('tcp'))).toBe(false)
    expect(canChoosePrinter(printer('com'))).toBe(false)
  })
})
