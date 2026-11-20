import { describe, expect, it, vi } from 'vitest'
import { defaultPrinterConfig, type PrinterConfig } from '@shared/domain/printer'
import { withResolvedUsbPort } from '@/features/printing/usbPort'

function usbPrinter(overrides: Partial<PrinterConfig> = {}): PrinterConfig {
  return {
    ...defaultPrinterConfig(),
    printerName: 'Gprinter GPL-N (203 dpi)',
    port: { type: 'usb', encoding: 'utf8' },
    ...overrides
  }
}

describe('打印前补 USB 端口', () => {
  it('仅有一个候选设备时补全端口', async () => {
    const listPorts = vi.fn(async () => ({ usbPrinterPorts: ['USB001 (Gprinter GPL-N)'] }))
    const next = await withResolvedUsbPort(usbPrinter(), listPorts)

    expect(next.port).toMatchObject({ type: 'usb', usbPort: 'USB001 (Gprinter GPL-N)' })
  })

  it('优先匹配队列对应端口，多台无法区分时保持未设置', async () => {
    const listPorts = vi.fn(async () => ({ usbPrinterPorts: ['USB001 (Other)', 'USB002 (Mine)'] }))
    const listQueues = vi.fn(async () => ({ printers: [{ name: 'Gprinter GPL-N (203 dpi)', displayName: 'Mine', port: 'USB002' }] }))
    expect((await withResolvedUsbPort(usbPrinter(), listPorts, listQueues)).port.usbPort).toBe('USB002 (Mine)')
    expect((await withResolvedUsbPort(usbPrinter(), listPorts)).port.usbPort).toBeUndefined()
    expect((await withResolvedUsbPort(usbPrinter(), async () => ({ usbPrinterPorts: ['USB001 (Other)'] }), listQueues)).port.usbPort).toBeUndefined()
  })

  it('已经记住端口、非 USB 端口都原样返回', async () => {
    const listPorts = vi.fn(async () => ({ usbPrinterPorts: ['USB001 (Other)'] }))
    const configured = usbPrinter({ port: { type: 'usb', encoding: 'utf8', usbPort: 'USB003 (Mine)' } })
    expect(await withResolvedUsbPort(configured, listPorts)).toBe(configured)

    const driver = usbPrinter({ port: { type: 'driver', encoding: 'utf8' } })
    expect(await withResolvedUsbPort(driver, listPorts)).toBe(driver)
    expect(listPorts).not.toHaveBeenCalled()
  })

  it('枚举失败或没有端口时保持原配置', async () => {
    const failing = vi.fn(async () => { throw new Error('PowerShell failed') })
    expect((await withResolvedUsbPort(usbPrinter(), failing)).port.usbPort).toBeUndefined()

    const empty = vi.fn(async () => ({ usbPrinterPorts: [] }))
    expect((await withResolvedUsbPort(usbPrinter(), empty)).port.usbPort).toBeUndefined()
  })
  it('returns on cancellation before system enumeration finishes', async () => {
    const controller = new AbortController()
    const printer = usbPrinter()
    const resolving = withResolvedUsbPort(printer, () => new Promise(() => {}), undefined, controller.signal)
    controller.abort()
    await expect(resolving).resolves.toBe(printer)
  })
})
