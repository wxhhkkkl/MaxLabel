import { createServer, type Server } from 'node:net'
import { describe, expect, it } from 'vitest'
import { queryTcp } from '@main/printing/transports/tcpQuery'
import { queryCommand } from '@main/printing/commandTransport'
import { counterQueriesFor } from '@shared/print/counters'

async function fakePrinter(reply: string | null): Promise<{ server: Server; port: number }> {
  const server = createServer((socket) => {
    socket.on('data', () => { if (reply !== null) socket.write(reply) })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return { server, port }
}

describe('打印机计数器查询（TCP）', () => {
  it('读取 TSPL 里程响应并解析为米', async () => {
    const { server, port } = await fakePrinter('133\r')
    try {
      const query = counterQueriesFor('tspl')[0]
      const result = await queryTcp(Buffer.from(query.command, 'ascii'), { tcpHost: '127.0.0.1', tcpPort: port }, { timeoutMs: 2000, quietMs: 80 })
      expect(result.ok).toBe(true)
      expect(query.parse(result.text ?? '')).toBe(133)
    } finally {
      server.close()
    }
  })

  it('打印机不回应时返回可读失败原因，不挂起', async () => {
    const { server, port } = await fakePrinter(null)
    try {
      const result = await queryTcp(Buffer.from('~!@\r\n', 'ascii'), { tcpHost: '127.0.0.1', tcpPort: port }, { timeoutMs: 600, quietMs: 50 })
      expect(result.ok).toBe(false)
      expect(result.message).toContain('没有返回数据')
    } finally {
      server.close()
    }
  })

  it.skipIf(process.platform !== 'win32')('USB 队列不存在时返回可读原因（同时覆盖 winspool 查询脚本编译）', async () => {
    const result = await queryCommand(
      Buffer.from('~!@\r\n', 'ascii'),
      { type: 'usb', usbPort: 'USB999 (maxlabel-test)', encoding: 'utf8' },
      { timeoutMs: 800 }
    )
    expect(result.ok).toBe(false)
    // 端口名不是队列名：先按 PortName 找队列，找不到要给出可操作原因。
    expect(result.message).toMatch(/没有对应的打印队列|无法打开打印队列/)
  })
})
