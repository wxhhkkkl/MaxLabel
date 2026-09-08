// ---------- 极简 HTTP 工具（供主进程连接云服务器） ----------
import { get, request } from 'http'

export function httpGet(
  url: string,
  timeoutMs = 3000
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = get(url, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') })
      })
    })
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('timeout'))
    })
    req.on('error', (e) => reject(e))
  })
}

export function httpPostJson(
  url: string,
  payload: unknown,
  timeoutMs = 8000
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload ?? {})
    const req = request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') })
        })
      }
    )
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('timeout'))
    })
    req.on('error', (e) => reject(e))
    req.write(body)
    req.end()
  })
}
