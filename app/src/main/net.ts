// ---------- 极简 HTTP 工具（供主进程连接云服务器） ----------
import { request as httpRequest } from 'http'
import { request as httpsRequest } from 'https'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export function httpRequestJson(
  url: string,
  method: HttpMethod,
  payload?: unknown,
  headers: Record<string, string> = {},
  timeoutMs = 8000,
  maxResponseBytes = 16 * 1024 * 1024
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
        if (total > maxResponseBytes) {
          const limitMb = Math.max(1, Math.round(maxResponseBytes / 1024 / 1024))
          fail(new Error(`服务器响应超过 ${limitMb} MB 限制`))
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

/**
 * multipart/form-data 上传（共享内容：Excel / 图片）。
 * 只支持一个文件字段 + 若干文本字段。
 */
export function httpRequestMultipart(
  url: string,
  fields: Record<string, string>,
  file: { name: string; type: string; data: Buffer },
  headers: Record<string, string> = {},
  timeoutMs = 30000,
  maxResponseBytes = 16 * 1024 * 1024
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      reject(error)
    }
    const boundary = `----maxlabel${Date.now()}${Math.random().toString(16).slice(2)}`
    const parts: Buffer[] = []
    for (const [key, value] of Object.entries(fields)) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`, 'utf-8'))
    }
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name.replace(/"/g, '')}"\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`, 'utf-8'))
    parts.push(file.data)
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8'))
    const body = Buffer.concat(parts)
    const parsed = new URL(url)
    const requestFn = parsed.protocol === 'https:' ? httpsRequest : httpRequest
    const req = requestFn(parsed, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(body.length),
        ...headers
      }
    }, (res) => {
      const chunks: Buffer[] = []
      let total = 0
      res.on('data', (chunk: Buffer) => {
        total += chunk.length
        if (total > maxResponseBytes) {
          const limitMb = Math.max(1, Math.round(maxResponseBytes / 1024 / 1024))
          fail(new Error(`服务器响应超过 ${limitMb} MB 限制`))
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
    req.write(body)
    req.end()
  })
}
