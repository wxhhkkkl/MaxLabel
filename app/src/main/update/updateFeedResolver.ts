import { isTrustedUpdateUrl } from './updateConfig'

export class UpdateFeedError extends Error {
  constructor(message: string, readonly messageKey: string, readonly messageParams?: Record<string, string | number>) {
    super(message)
  }
}

/**
 * 向商城查询「有没有更新、去哪下载」（013 / Q89）。
 *
 * 判定在服务端：客户端只上报当前版本与平台架构，拿回 `feedUrl` 或「无更新」。
 * 仅在服务端明确表示无更新时返回 null。查询失败由调用方按启动或手动入口呈现。
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
 * @returns 有更新时返回该版本的 feed 目录，无更新时返回 null
 */
export async function resolveRemoteFeed(options: RemoteFeedOptions): Promise<string | null> {
  const platform = options.platform ?? mapPlatform(process.platform)
  const arch = options.arch ?? mapArch(process.arch)
  if (!isTrustedUpdateUrl(options.baseUrl)) throw new UpdateFeedError('更新地址不在受信任的来源内', 'update.error.feedSource')
  if (!platform || !arch) throw new UpdateFeedError('当前平台或处理器架构不支持在线更新', 'update.error.unsupportedPlatform')

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
      redirect: 'error',
      headers: { 'tenant-id': options.tenantId }
    })
    if (!response.ok) throw new UpdateFeedError(`更新服务请求失败（HTTP ${response.status}）`, 'update.error.service', { status: response.status })
    const body = await response.json().catch((error) => {
      if (controller.signal.aborted) throw error
      throw new UpdateFeedError('更新服务返回的版本信息无效', 'update.error.invalidFeedResponse')
    }) as { code?: number; data?: { hasUpdate?: boolean; feedUrl?: string } }
    if (body?.code !== 0 || typeof body.data?.hasUpdate !== 'boolean') throw new UpdateFeedError('更新服务返回的版本信息无效', 'update.error.invalidFeedResponse')
    if (!body.data.hasUpdate) return null
    if (!isTrustedUpdateUrl(body.data.feedUrl)) throw new UpdateFeedError('更新地址不在受信任的来源内', 'update.error.feedSource')
    return body.data.feedUrl
  } finally {
    clearTimeout(timeout)
  }
}
