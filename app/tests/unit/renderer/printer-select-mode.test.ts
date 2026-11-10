import { describe, expect, it } from 'vitest'
import type { PrinterConfig } from '@shared/domain/printer'
import type { PrinterCatalogEntry } from '@shared/domain/printerCatalog.generated'
import { builtInPrinterValue } from '@/features/shell/installedPrinters'
import {
  applyPrinterSelection,
  CURRENT_DIRECT_PRINTER_VALUE,
  printerSelectionValue
} from '@/features/printing/printerSelectMode'

function printer(portType: PrinterConfig['port']['type'], printerName?: string): PrinterConfig {
  return {
    driver: 'tspl',
    dpi: 203,
    port: { type: portType, encoding: 'utf8' },
    ...(printerName ? { printerName } : {})
  } as unknown as PrinterConfig
}

const builtIn: PrinterCatalogEntry = {
  id: 'ls-001',
  name: 'Gprinter GPL-N (203 dpi)',
  brand: 'Gprinter',
  brandLabel: '佳博 (Gprinter)',
  model: 'GPL',
  commandSet: 'N',
  dpi: 203
}

describe('打印机下拉选择值', () => {
  it('未配置打印机时跟随系统默认', () => {
    expect(printerSelectionValue(undefined, [])).toBe('')
    expect(printerSelectionValue(printer('driver'), [])).toBe('')
  })

  it('Windows 驱动打印机显示为打印机名', () => {
    expect(printerSelectionValue(printer('driver', 'Microsoft Print to PDF'), [])).toBe('Microsoft Print to PDF')
  })

  it('已安装的内置打印机显示为直连条目', () => {
    expect(printerSelectionValue(printer('usb', builtIn.name), [builtIn])).toBe(builtInPrinterValue(builtIn.id))
  })

  it('自定义直连端口显示为当前直连项', () => {
    expect(printerSelectionValue(printer('tcp', '网络打印机'), [builtIn])).toBe(CURRENT_DIRECT_PRINTER_VALUE)
  })
})

describe('打印机下拉选择落地', () => {
  it('选 Windows 打印机时把端口切到驱动', () => {
    const next = applyPrinterSelection(printer('tcp', '旧打印机'), 'Microsoft Print to PDF', [])
    expect(next).toMatchObject({ printerName: 'Microsoft Print to PDF', port: { type: 'driver' } })
  })

  it('选系统默认时清掉打印机名并使用驱动', () => {
    const next = applyPrinterSelection(printer('driver', 'Microsoft Print to PDF'), '', [])
    expect(next.printerName).toBeUndefined()
    expect(next.port.type).toBe('driver')
  })

  it('选内置直连打印机时使用它的指令集、DPI 和 USB 端口', () => {
    const next = applyPrinterSelection(printer('tcp'), builtInPrinterValue(builtIn.id), [builtIn])
    expect(next).toMatchObject({
      driver: 'tspl',
      dpi: 203,
      printerName: builtIn.name,
      port: { type: 'usb' }
    })
  })

  it('已经是同一台内置打印机且配置了 TCP 端口时保持原端口', () => {
    const current = printer('tcp', builtIn.name)
    const next = applyPrinterSelection(current, builtInPrinterValue(builtIn.id), [builtIn])
    expect(next).toBe(current)
    expect(next.port.type).toBe('tcp')
  })

  it('选当前直连项时保持配置不变', () => {
    const current = printer('com', '串口打印机')
    const next = applyPrinterSelection(current, CURRENT_DIRECT_PRINTER_VALUE, [builtIn])
    expect(next).toBe(current)
    expect(next.port.type).toBe('com')
  })
})
