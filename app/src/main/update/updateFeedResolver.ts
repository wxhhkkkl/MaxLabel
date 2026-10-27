/**
 * 向商城查询「有没有更新、去哪下载」（013 / Q89）。
 *
 * 判定在服务端：客户端只上报当前版本与平台架构，拿回 `feedUrl` 或「无更新」。
 * 任何失败（网络、超时、响应异常）都按「本次不更新」静默处理（FR-348），
 * 不影响软件正常使用。
 */

export interface RemoteFeedOptions {
  /** 商城根地址，例如 https://new.yuwangchenfa.com */
  baseUrl: string
  /** 租户编号（app-api 必带，否则后端 400） */
  tenantId: string
  currentVersion: string
  platform?: string
  arch?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

/** Node 的 platform 映射到商城约定的取值 */
export function mapPlatform(value: string): string | null {
  switch (value) {
    case 'win32':
      return 'windows'
    case 'darwin':
      return 'macos'
    case 'linux':
      return 'linux'
    default:
      return null
  }
}

/** Node 的 arch 映射到商城约定的取值 */
export function mapArch(value: string): string | null {
  switch (value) {
    case 'x64':
      return 'x64'
    case 'arm64':
      return 'arm64'
    case 'ia32':
      return 'x86'
    default:
      return null
  }
}

/**
 * @returns 有更新时返回该版本的 feed 目录；无更新或任何失败返回 null
 */
export async function resolveRemoteFeed(options: RemoteFeedOptions): Promise<string | null> {
  const platform = options.platform ?? mapPlatform(process.platform)
  const arch = options.arch ?? mapArch(process.arch)
  if (!options.baseUrl || !platform || !arch) return null

  const url = new URL('/app-api/software/update/check', options.baseUrl)
  url.searchParams.set('currentVersion', options.currentVersion)
  url.searchParams.set('platform', platform)
  url.searchParams.set('arch', arch)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 5000)
  try {
    const doFetch = options.fetchImpl ?? fetch
    const response = await doFetch(url.toString(), {
      signal: controller.signal,
      headers: { 'tenant-id': options.tenantId }
    })
    if (!response.ok) return null
    const body = (await response.json()) as { code?: number; data?: { hasUpdate?: boolean; feedUrl?: string } }
    if (body?.code !== 0 || !body.data?.hasUpdate || !body.data.feedUrl) return null
    return body.data.feedUrl
  } catch {
    // 超时 / 断网 / 响应不是 JSON —— 一律降级为「本次不更新」
    return null
  } finally {
    clearTimeout(timeout)
  }
}
