import { describe, expect, it, vi } from 'vitest'
import { createUnixAdapter, sendRawToCups, type ExecFileAsync } from '@main/printing/transports/unix'
import type { SerialPortModule } from '@main/printing/transports/serial'
import type { UsbModule } from '@main/printing/transports/usb'
import { createSerialPortDouble } from '../../helpers/platformDoubles'

const lpCalls: string[][] = []
const exec: ExecFileAsync = async (file, args) => {
  if (file === 'lpstat' && args[0] === '-p') return { stdout: 'printer Office is idle.  enabled since today\nprinter Label is disabled since today\n' }
  if (file === 'lpstat' && args[0] === '-d') return { stdout: 'system default destination: Office\n' }
  if (file === 'lp') { lpCalls.push(args); return { stdout: 'request id is Office-1 (1 file(s))\n' } }
  throw new Error(`unexpected command ${file} ${args.join(' ')}`)
}

describe('CUPS adapter', () => {
  it('parses queues and the default destination', async () => {
    const adapter = createUnixAdapter({ execFileAsync: exec })
    await expect(adapter.listPrinterFacts()).resolves.toEqual({
      ports: { office: 'Office', label: 'Label' },
      defaultName: 'Office'
    })
  })

  it('submits a raw file to a queue without shell interpolation', async () => {
    const result = await sendRawToCups(Buffer.from('RAW'), 'Office', { execFileAsync: exec })
    expect(result.ok).toBe(true)
    expect(result.status).toBe('accepted')
    expect(lpCalls.at(-1)?.slice(0, 4)).toEqual(['-d', 'Office', '-o', 'raw'])
    expect((await sendRawToCups(Buffer.from('x'), 'bad\nqueue', { execFileAsync: exec })).ok).toBe(false)
  })

  it('rejects LPT and honors pre-aborted TCP', async () => {
    const adapter = createUnixAdapter({ execFileAsync: exec })
    expect((await adapter.sendCommand(Buffer.from('x'), { type: 'lpt', encoding: 'utf8', lptPort: 'LPT1' })).ok).toBe(false)
    const controller = new AbortController()
    controller.abort()
    const canceled = await adapter.sendCommand(Buffer.from('x'), { type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: 9 }, controller.signal)
    expect(canceled.canceled).toBe(true)
  })
})

describe('serial adapter', () => {
  it('writes bytes with framing and lists devices', async () => {
    const double = createSerialPortDouble()
    const adapter = createUnixAdapter({ serialPort: double as unknown as SerialPortModule, execFileAsync: exec })
    const result = await adapter.sendCommand(Buffer.from('SERIAL'), {
      type: 'com', encoding: 'utf8', comPort: '/dev/ttyUSB0', baudRate: 9600, dataBits: 7, parity: 'even', stopBits: 'two', flowControl: 'rtsCts'
    })
    expect(result.ok).toBe(true)
    expect(double.written.map((item) => item.toString())).toEqual(['SERIAL'])
    expect(await adapter.listSerialPorts()).toEqual([{ path: '/dev/ttyUSB0', manufacturer: 'Test', serialNumber: undefined, vendorId: undefined, productId: undefined, accessible: true }])
  })

  it('returns a failed result when the device cannot open', async () => {
    const double = createSerialPortDouble({ openError: new Error('permission denied') })
    const adapter = createUnixAdapter({ serialPort: double as unknown as SerialPortModule, execFileAsync: exec })
    const result = await adapter.sendCommand(Buffer.from('x'), { type: 'com', encoding: 'utf8', comPort: '/dev/ttyUSB0' })
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/permission denied/)
  })
})

describe('USB adapter', () => {
  function usbDouble(options: { claimError?: Error } = {}) {
    const transfers: Buffer[] = []
    const device = {
      deviceDescriptor: { idVendor: 0x04b8, idProduct: 0x0202, bDeviceClass: 7 },
      busNumber: 1,
      deviceAddress: 2,
      open: vi.fn(),
      close: vi.fn(),
      interface: () => ({
        claim: () => { if (options.claimError) throw options.claimError },
        release: (_reset: boolean, callback: () => void) => callback(),
        endpoints: [{ direction: 'out', transfer: (data: Buffer, callback: (error?: Error) => void) => { transfers.push(data); callback() } }]
      })
    }
    return { module: { getDeviceList: () => [device] } as unknown as UsbModule, transfers, device }
  }

  it('lists and writes to a printer-class USB device', async () => {
    const { module, transfers } = usbDouble()
    const adapter = createUnixAdapter({ usb: module, execFileAsync: exec })
    expect(await adapter.listUsbPrinterPorts()).toEqual(['USB-04b8:0202'])
    const result = await adapter.sendCommand(Buffer.from('USB'), { type: 'usb', encoding: 'utf8', usbPort: 'USB-04b8:0202 (Epson)' })
    expect(result.ok).toBe(true)
    expect(Buffer.concat(transfers).toString()).toBe('USB')
  })

  it('reports permission/claim errors and invalid labels', async () => {
    const { module } = usbDouble({ claimError: new Error('LIBUSB_ERROR_ACCESS') })
    const adapter = createUnixAdapter({ usb: module, execFileAsync: exec })
    expect((await adapter.sendCommand(Buffer.from('x'), { type: 'usb', encoding: 'utf8', usbPort: 'USB-04b8:0202' })).message).toMatch(/udev|权限/)
    expect((await adapter.sendCommand(Buffer.from('x'), { type: 'usb', encoding: 'utf8', usbPort: 'bad' })).ok).toBe(false)
  })
})
