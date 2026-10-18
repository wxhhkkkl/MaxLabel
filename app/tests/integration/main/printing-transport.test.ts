import { createServer } from 'node:net'
import { describe, expect, it, vi } from 'vitest'
import type { PortConfig } from '@shared/domain/printer'

vi.mock('child_process', () => {
  const execFile = (() => undefined) as unknown as {
    (...args: unknown[]): unknown
    [key: symbol]: unknown
  }
  execFile[Symbol.for('nodejs.util.promisify.custom')] = async (_exe: string, args: string[]) => {
    ;(globalThis as { __transportScript?: string }).__transportScript = args[args.length - 1]
    return { stdout: (globalThis as { __transportResult?: string }).__transportResult ?? '', stderr: '' }
  }
  return { execFile }
})

vi.mock('fs/promises', () => ({
  writeFile: vi.fn(async () => undefined),
  rm: vi.fn(async () => undefined)
}))

import { sendCommand } from '@main/printing/commandTransport'

const tcpPort = (port: number): PortConfig => ({ type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: port })

describe('TCP transport', () => {
  it('sends bytes to a listening socket', async () => {
    const received: Buffer[] = []
    let resolveReceived!: () => void
    const receivedDone = new Promise<void>((resolve) => {
      resolveReceived = resolve
    })
    const server = createServer((socket) => {
      socket.on('data', (chunk) => received.push(chunk))
      socket.on('end', () => {
        socket.end()
        resolveReceived()
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('no port')
    try {
      const result = await sendCommand(Buffer.from('TEXT 1,1'), tcpPort(address.port))
      expect(result.ok).toBe(true)
      expect(result.status).toBe('accepted')
      await receivedDone
      expect(Buffer.concat(received).toString()).toBe('TEXT 1,1')
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('reports connection failures and pre-aborted sends', async () => {
    const server = createServer()
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('no port')
    const port = address.port
    await new Promise<void>((resolve) => server.close(() => resolve()))

    const failed = await sendCommand(Buffer.from('X'), tcpPort(port))
    expect(failed.ok).toBe(false)
    expect(failed.status).toBe('failed')

    const controller = new AbortController()
    controller.abort()
    const canceled = await sendCommand(Buffer.from('X'), tcpPort(9999), controller.signal)
    expect(canceled.canceled).toBe(true)
    expect(canceled.status).toBe('canceled')
  })
})

describe('USB / serial / LPT transport', () => {
  it('accepts only completed USB queue writes', async () => {
    if (process.platform !== 'win32') return
    const globalState = globalThis as { __transportResult?: string; __transportScript?: string }
    for (const output of ['OK:Queue:0', 'OK:Queue:1', 'OK:Queue:5', 'OK:Queue:garbage', 'INCOMPLETE:Queue:4']) {
      globalState.__transportResult = output
      const result = await sendCommand(Buffer.from('test'), { type: 'usb', encoding: 'utf8', usbPort: 'USB001' })
      expect(result.ok, output).toBe(false)
      expect(result.status, output).toBe('unknown')
    }
    globalState.__transportResult = 'OK:Queue:with:colon:4'
    const accepted = await sendCommand(Buffer.from('test'), { type: 'usb', encoding: 'utf8', usbPort: 'USB001' })
    expect(accepted.ok).toBe(true)
    expect(globalState.__transportScript).toMatch(/StartDocPrinter\(.*-eq 0/)
    expect(globalState.__transportScript).toMatch(/if \(-not \$ok -or -not \$endPageOk -or -not \$endDocOk/)
  })

  it('validates serial and LPT configuration', async () => {
    expect((await sendCommand(Buffer.from('x'), { type: 'com', encoding: 'utf8' })).ok).toBe(false)
    expect((await sendCommand(Buffer.from('x'), { type: 'bluetooth', encoding: 'utf8' })).ok).toBe(false)
    const badLpt = await sendCommand(Buffer.from('x'), { type: 'lpt', encoding: 'utf8', lptPort: 'USB1' })
    expect(badLpt.ok).toBe(false)
    expect(badLpt.message).toMatch(/LPT 端口名称无效/)

    if (process.platform === 'win32') {
      const lpt = await sendCommand(Buffer.from('x'), { type: 'lpt', encoding: 'utf8', lptPort: 'LPT1' })
      expect(lpt.ok).toBe(true)
      expect(lpt.status).toBe('accepted')
    }
  })

  it('rejects unsupported port types', async () => {
    const result = await sendCommand(Buffer.from('x'), { type: 'driver', encoding: 'utf8' })
    expect(result.ok).toBe(false)
    expect(result.status).toBe('failed')
  })
})
