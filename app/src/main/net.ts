// ---------- 极简 HTTP 工具（供主进程连接云服务器） ----------
import { request as httpRequest } from 'http'
import { request as httpsRequest } from 'https'

type HttpMethod = 'GET' | 'POST' | 'DELETE'

export function httpRequestJson(
  url: string,
  method: HttpMethod,
  payload?: unknown,
  headers: Record<string, string> = {},
  timeoutMs = 8000
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      reject(error)
    }
    const parsed = new URL(url)
    const requestFn = parsed.protocol === 'https:' ? httpsRequest : httpRequest
    const body = payload === undefined ? '' : JSON.stringify(payload)
    const req = requestFn(parsed, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) } : {}),
        ...headers
      }
    }, (res) => {
      const chunks: Buffer[] = []
      let total = 0
      res.on('data', (chunk: Buffer) => {
        total += chunk.length
        if (total > 16 * 1024 * 1024) {
          fail(new Error('服务器响应超过 16 MB 限制'))
          res.destroy()
          return
        }
        chunks.push(chunk)
      })
      res.on('end', () => {
        if (settled) return
        settled = true
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') })
      })
      res.on('error', (error) => fail(error instanceof Error ? error : new Error(String(error))))
    })
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')))
    req.on('error', (error) => fail(error instanceof Error ? error : new Error(String(error))))
    if (body) req.write(body)
    req.end()
  })
}

export function httpGet(
  url: string,
  timeoutMs = 3000
): Promise<{ status: number; body: string }> {
  return httpRequestJson(url, 'GET', undefined, {}, timeoutMs)
}

export function httpPostJson(
  url: string,
  payload: unknown,
  timeoutMs = 8000
): Promise<{ status: number; body: string }> {
  return httpRequestJson(url, 'POST', payload ?? {}, {}, timeoutMs)
}
