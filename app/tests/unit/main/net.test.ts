import { createServer, type RequestListener, type Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { httpRequestJson } from '@main/net'

let server: Server | undefined

afterEach(async () => {
  if (!server) return
  await new Promise<void>((resolve) => server!.close(() => resolve()))
  server = undefined
})

function listen(handler: RequestListener): Promise<string> {
  return new Promise((resolve) => {
    server = createServer(handler)
    server.listen(0, '127.0.0.1', () => {
      const address = server!.address()
      if (!address || typeof address === 'string') throw new Error('no port')
      resolve(`http://127.0.0.1:${address.port}/`)
    })
  })
}

describe('httpRequestJson', () => {
  it('supports PUT and forwards the JSON body', async () => {
    const url = await listen((req, res) => {
      let body = ''
      req.on('data', (chunk: Buffer) => { body += chunk })
      req.on('end', () => {
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ method: req.method, body }))
      })
    })
    const response = await httpRequestJson(url, 'PUT', { name: '模板' }, {}, 2000)
    expect(response.status).toBe(200)
    expect(JSON.parse(response.body)).toEqual({ method: 'PUT', body: '{"name":"模板"}' })
  })

  it('rejects a response larger than the caller-supplied limit', async () => {
    const url = await listen((_req, res) => {
      res.setHeader('content-type', 'application/json')
      res.end('x'.repeat(64))
    })
    await expect(httpRequestJson(url, 'GET', undefined, {}, 2000, 16))
      .rejects.toThrow(/响应超过/)
  })
})
