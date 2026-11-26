import { createServer, type Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { httpGetBinary } from '@main/net'

let server: Server
let base = ''

beforeAll(async () => {
  server = createServer((request, response) => {
    if (request.url === '/image') {
      response.writeHead(200, { 'Content-Type': 'image/png' })
      response.end(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      return
    }
    response.writeHead(404)
    response.end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('test server has no port')
  base = `http://127.0.0.1:${address.port}`
})

afterAll(() => {
  server.close()
})

describe('httpGetBinary', () => {
  it('returns raw bytes and content type', async () => {
    const result = await httpGetBinary(`${base}/image`)
    expect(result.status).toBe(200)
    expect(result.contentType).toBe('image/png')
    expect([...result.body]).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('returns non-200 responses without throwing', async () => {
    const result = await httpGetBinary(`${base}/missing`)
    expect(result.status).toBe(404)
    expect(result.body.length).toBe(0)
  })

  it('rejects responses above the byte limit', async () => {
    await expect(httpGetBinary(`${base}/image`, 3000, 2)).rejects.toThrow(/限制/)
  })
})
