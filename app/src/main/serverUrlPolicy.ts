const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/** Cloud and license endpoints may use HTTP only on the local machine. */
export function normalizeServerUrl(value: unknown): string | null {
  const raw = String(value ?? '').trim().replace(/\/+$/, '')
  if (!raw || raw.toLowerCase() === 'offline') return ''
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (parsed.username || parsed.password || !parsed.hostname) return null
    // A server base URL may contain a reverse-proxy path prefix, but query
    // strings and fragments would swallow or rewrite the appended /api path.
    if (parsed.search || parsed.hash) return null
    if (parsed.protocol === 'http:' && !LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) return null
    return parsed.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

export function requireServerUrl(value: unknown): string {
  const normalized = normalizeServerUrl(value)
  if (!normalized) throw new Error('服务器地址无效；远程服务器必须使用 HTTPS，本机地址可使用 HTTP')
  return normalized
}
