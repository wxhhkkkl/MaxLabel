import { vi } from 'vitest'

/** Minimal execFile double with the promisify.custom hook used by the transport. */
export function createExecFileDouble(result: { stdout?: string; stderr?: string; error?: Error } = {}) {
  const execFile = (() => undefined) as unknown as {
    (...args: unknown[]): unknown
    [key: symbol]: unknown
  }
  execFile[Symbol.for('nodejs.util.promisify.custom')] = async () => {
    if (result.error) throw result.error
    return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
  }
  return execFile
}

/** Minimal serialport module double; tests can override write/close behavior. */
export function createSerialPortDouble(options: { writeError?: Error; openError?: Error } = {}) {
  const written: Buffer[] = []
  class SerialPort {
    static list = vi.fn(async () => [{ path: '/dev/ttyUSB0', manufacturer: 'Test' }])
    readonly written = written
    constructor(public path: string, public opts: Record<string, unknown>) {}
    open(callback: (error?: Error) => void) { callback(options.openError) }
    write(data: Buffer, callback: (error?: Error) => void) { written.push(data); callback(options.writeError) }
    drain(callback: (error?: Error) => void) { callback() }
    close(callback: (error?: Error) => void) { callback() }
  }
  return { SerialPort, written }
}

/** Minimal usb module double used by the USB adapter tests. */
export function createUsbDouble() {
  return {
    getDeviceList: vi.fn(() => []),
    findDevice: vi.fn(() => undefined)
  }
}
