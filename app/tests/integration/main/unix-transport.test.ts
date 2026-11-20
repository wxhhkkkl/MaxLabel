import { describe, expect, it, vi } from 'vitest'
import { createUnixAdapter, sendRawToCups, type ExecFileAsync } from '@main/printing/transports/unix'
import type { SerialPortModule } from '@main/printing/transports/serial'
import { sendUsb, type UsbModule } from '@main/printing/transports/usb'
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

  it('leaves a serial batch uncertain when canceled while draining written bytes', async () => {
    const controller = new AbortController()
    const double = createSerialPortDouble()
    const close = vi.spyOn(double.SerialPort.prototype, 'close')
    vi.spyOn(double.SerialPort.prototype, 'drain').mockImplementation((callback) => {
      controller.abort()
      callback()
    })
    const adapter = createUnixAdapter({ serialPort: double as unknown as SerialPortModule })
    await expect(adapter.sendCommand(Buffer.from('label'), { type: 'com', encoding: 'utf8', comPort: 'mock' }, controller.signal))
      .resolves.toMatchObject({ ok: false, status: 'unknown' })
    expect(double.written).toHaveLength(1)
    expect(close).toHaveBeenCalledOnce()
  })
})

describe('USB adapter', () => {
  function usbDouble(options: { claimError?: Error; transferError?: Error; failureChunk?: number; port?: number } = {}) {
    const transfers: Buffer[] = []
    const release = vi.fn((_reset: boolean, callback: () => void) => callback())
    const device = {
      deviceDescriptor: { idVendor: 0x04b8, idProduct: 0x0202, bDeviceClass: 0 },
      configDescriptor: { interfaces: [[{ bInterfaceClass: 7 }]] },
      busNumber: 1,
      deviceAddress: 2,
      portNumbers: options.port === undefined ? undefined : [2, options.port],
      open: vi.fn(),
      close: vi.fn(),
      interface: () => ({
        claim: () => { if (options.claimError) throw options.claimError },
        release,
        endpoints: [{
          direction: 'out',
          makeTransfer: (_timeout: number, callback: (error: Error | undefined, buffer: Buffer, actual: number) => void) => ({
            submit(data: Buffer) {
              transfers.push(data)
              const error = transfers.length === (options.failureChunk ?? 1) ? options.transferError : undefined
              callback(error, data, error ? 0 : data.length)
            },
            cancel: vi.fn()
          })
        }]
      })
    }
    return { module: { getDeviceList: () => [device] } as unknown as UsbModule, transfers, device, release }
  }

  it('lists and writes to a printer-class USB device', async () => {
    const { module, transfers } = usbDouble()
    const adapter = createUnixAdapter({ usb: module, execFileAsync: exec })
    expect(await adapter.listUsbPrinterPorts()).toEqual(['USB-04b8:0202@1:2'])
    const result = await adapter.sendCommand(Buffer.from('USB'), { type: 'usb', encoding: 'utf8', usbPort: 'USB-04b8:0202 (Epson)' })
    expect(result.ok).toBe(true)
    expect(Buffer.concat(transfers).toString()).toBe('USB')
  })

  it('reports permission/claim errors and invalid labels', async () => {
    const { module, device, release } = usbDouble({ claimError: new Error('LIBUSB_ERROR_ACCESS') })
    const adapter = createUnixAdapter({ usb: module, execFileAsync: exec })
    expect((await adapter.sendCommand(Buffer.from('x'), { type: 'usb', encoding: 'utf8', usbPort: 'USB-04b8:0202' })).message).toMatch(/udev|权限/)
    expect(device.close).toHaveBeenCalledOnce()
    expect(release).not.toHaveBeenCalled()
    expect((await adapter.sendCommand(Buffer.from('x'), { type: 'usb', encoding: 'utf8', usbPort: 'bad' })).ok).toBe(false)
  })

  it('uses the physical port to distinguish identical printers and rejects ambiguous old labels', async () => {
    const first = usbDouble({ port: 1 })
    const second = usbDouble({ port: 2 })
    const usb = { getDeviceList: () => [first.device, second.device] } as unknown as UsbModule
    const adapter = createUnixAdapter({ usb, execFileAsync: exec })
    expect(await adapter.listUsbPrinterPorts()).toEqual(['USB-04b8:0202@1-2.1', 'USB-04b8:0202@1-2.2'])
    const port = { type: 'usb', encoding: 'utf8' } as const
    await expect(adapter.sendCommand(Buffer.from('x'), { ...port, usbPort: 'USB-04b8:0202' }))
      .resolves.toMatchObject({ ok: false, message: expect.stringContaining('多台同型号') })
    await expect(adapter.sendCommand(Buffer.from('only second'), { ...port, usbPort: 'USB-04b8:0202@1-2.2' }))
      .resolves.toMatchObject({ ok: true })
    expect(first.device.open).not.toHaveBeenCalled()
    expect(Buffer.concat(second.transfers).toString()).toBe('only second')
  })

  it('releases and closes the device after a failed transfer', async () => {
    const { module, device, release } = usbDouble({ transferError: new Error('disconnected'), failureChunk: 2 })
    const adapter = createUnixAdapter({ usb: module, execFileAsync: exec })
    await expect(adapter.sendCommand(Buffer.alloc(8192), { type: 'usb', encoding: 'utf8', usbPort: 'USB-04b8:0202@1:2' }))
      .resolves.toMatchObject({ ok: false, status: 'unknown', bytesWritten: 4096, message: expect.stringContaining('disconnected') })
    expect(release).toHaveBeenCalledOnce()
    expect(device.close).toHaveBeenCalledOnce()
  })

  it('cancels a pending final transfer and releases the claimed device', async () => {
    const controller = new AbortController()
    let complete!: () => void
    const close = vi.fn()
    const release = vi.fn((_reset: boolean, callback: () => void) => callback())
    let completeCanceled!: () => void
    const cancel = vi.fn(() => { completeCanceled(); return true })
    const makeTransfer = vi.fn((_timeout: number, callback: (error: Error | undefined, buffer: Buffer, actual: number) => void) => ({
      submit(data: Buffer) {
        complete = () => callback(undefined, data, data.length)
        completeCanceled = () => callback(new Error('Transfer aborted'), data, 0)
      },
      cancel
    }))
    const usb = { getDeviceList: () => [{
      deviceDescriptor: { idVendor: 1, idProduct: 2 },
      open: vi.fn(),
      close,
      interface: () => ({
        claim: vi.fn(), release,
        endpoints: [{ direction: 'out', makeTransfer }]
      })
    }] } as unknown as UsbModule
    const result = sendUsb(usb, 'USB-0001:0002', Buffer.from('final'), controller.signal)
    controller.abort()
    if (!cancel.mock.calls.length) complete()
    await expect(result).resolves.toMatchObject({ ok: false, status: 'unknown' })
    expect(makeTransfer.mock.calls[0][0]).toBeGreaterThan(0)
    expect(cancel).toHaveBeenCalledOnce()
    expect(release).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })
})
