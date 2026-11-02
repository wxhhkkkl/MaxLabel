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
  it('端口为空时枚举并补上，同时写入缓存', async () => {
    const cache: Record<string, string> = {}
    const listPorts = vi.fn(async () => ({ usbPrinterPorts: ['USB001 (Gprinter GPL-N)'] }))
    const next = await withResolvedUsbPort(usbPrinter(), listPorts, cache)

    expect(next.port).toMatchObject({ type: 'usb', usbPort: 'USB001 (Gprinter GPL-N)' })
    expect(cache['Gprinter GPL-N (203 dpi)']).toBe('USB001 (Gprinter GPL-N)')
  })

  it('已有缓存时不再枚举（避免每次打印都跑 PowerShell）', async () => {
    const cache = { 'Gprinter GPL-N (203 dpi)': 'USB002 (Cached)' }
    const listPorts = vi.fn(async () => ({ usbPrinterPorts: ['USB001 (Fresh)'] }))
    const next = await withResolvedUsbPort(usbPrinter(), listPorts, cache)

    expect(next.port.usbPort).toBe('USB002 (Cached)')
    expect(listPorts).not.toHaveBeenCalled()
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
})
