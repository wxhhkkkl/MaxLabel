import { EventEmitter } from 'node:events'
import { expect, it, vi } from 'vitest'
import { createUnixAdapter } from '@main/printing/transports/unix'
import { sendCommand as sendWindowsCommand } from '@main/printing/transports/windows'

const { createConnection } = vi.hoisted(() => ({ createConnection: vi.fn() }))
vi.mock('node:net', () => ({ createConnection }))

const port = { type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: 9100 } as const

function mockSocket() {
  const socket = Object.assign(new EventEmitter(), {
    setTimeout: vi.fn(),
    write: vi.fn((_data, done) => done()),
    end: vi.fn(),
    destroy: vi.fn()
  })
  createConnection.mockReturnValue(socket)
  return socket
}

it.each([['Windows', sendWindowsCommand], ['Unix', createUnixAdapter().sendCommand]] as const)('distinguishes TCP outcomes on %s', async (_platform, send) => {
  const bytes = Buffer.from('fixture')
  const failedSocket = mockSocket()
  const failed = send(bytes, port)
  failedSocket.emit('error', new Error('connection refused'))
  await expect(failed).resolves.toMatchObject({ ok: false, status: 'failed' })

  const events = [
    (socket: ReturnType<typeof mockSocket>) => socket.emit('error', new Error('connection reset after write')),
    (socket: ReturnType<typeof mockSocket>) => socket.setTimeout.mock.calls[0][1](),
    (_socket: ReturnType<typeof mockSocket>, controller: AbortController) => controller.abort()
  ]
  for (const event of events) {
    const socket = mockSocket()
    const controller = new AbortController()
    const result = send(bytes, port, controller.signal)
    socket.emit('connect')
    expect(socket.write).toHaveBeenCalledOnce()
    event(socket, controller)
    socket.emit('close')
    await expect(result).resolves.toMatchObject({ ok: false, status: 'unknown' })
  }
})
