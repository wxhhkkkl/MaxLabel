import { describe, expect, it } from 'vitest'
import { windowsDriverPrinterName } from '@/features/printers/windowsDriverSettings'

describe('Windows 驱动打印设置入口', () => {
  it('只有驱动端口才返回打印机名', () => {
    expect(windowsDriverPrinterName({ printerName: 'A', port: { type: 'usb' } }, [])).toBeUndefined()
    expect(windowsDriverPrinterName({ printerName: 'A', port: { type: 'driver' } }, [])).toBe('A')
  })

  it('模板未指定打印机时退回系统默认打印机', () => {
    const installed = [{ name: 'B' }, { name: 'C', isDefault: true }]
    expect(windowsDriverPrinterName({ port: { type: 'driver' } }, installed)).toBe('C')
    expect(windowsDriverPrinterName({ port: { type: 'driver' } }, [{ name: 'B' }])).toBe('B')
    expect(windowsDriverPrinterName({ port: { type: 'driver' } }, [])).toBeUndefined()
  })
})
