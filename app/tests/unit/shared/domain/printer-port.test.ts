import { describe, expect, it } from 'vitest'
import { defaultNewLabelPort, defaultPrinterConfig, formatUsbPrinterPort } from '@shared/domain/printer'

const savedPort = (patch: Record<string, unknown> = {}) => ({ ...defaultPrinterConfig().port, ...patch })

describe('新建标签的默认端口', () => {
  it('默认打印方式=驱动：选中的系统打印机用驱动端口', () => {
    const port = defaultNewLabelPort('driver', savedPort({ type: 'usb', usbPort: 'USB001 (A)' }), { systemPrinterName: 'Zenpert 4T530', queuePort: 'USB001' })
    expect(port.type).toBe('driver')
  })

  it('内置驱动打印机（没有系统打印机名）保持自己的端口配置', () => {
    const builtIn = savedPort({ type: 'usb', usbPort: 'USB001 (Gprinter GP-1324D)' })
    expect(defaultNewLabelPort('driver', builtIn, {})).toEqual(builtIn)
    expect(defaultNewLabelPort('command', builtIn, {})).toEqual(builtIn)
  })

  it('直连模式：USB 队列上的系统打印机默认走 USB RAW', () => {
    const port = defaultNewLabelPort('command', savedPort({ type: 'driver' }), { systemPrinterName: 'Zenpert 4T530', queuePort: 'USB001' })
    expect(port).toMatchObject({ type: 'usb', usbPort: formatUsbPrinterPort('USB001', 'Zenpert 4T530') })
  })

  it('直连模式下换了一台 USB 打印机，端口跟着换', () => {
    const port = defaultNewLabelPort('command', savedPort({ type: 'usb', usbPort: 'USB001 (Old)' }), { systemPrinterName: 'New Label Printer', queuePort: 'USB002' })
    expect(port.usbPort).toBe(formatUsbPrinterPort('USB002', 'New Label Printer'))
  })

  it('直连模式保留已配置的 TCP 端口', () => {
    const tcp = savedPort({ type: 'tcp', tcpHost: '192.168.1.9', tcpPort: 9100 })
    expect(defaultNewLabelPort('command', tcp, { systemPrinterName: 'Net Printer', queuePort: 'WSD-1' })).toEqual(tcp)
  })

  it('直连模式没有 USB 队列时退回指令文件', () => {
    const port = defaultNewLabelPort('command', savedPort({ type: 'driver' }), { systemPrinterName: 'HP LaserJet', queuePort: 'WSD-1' })
    expect(port.type).toBe('file')
  })
})
