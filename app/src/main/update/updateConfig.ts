/** 固定更新源；打包构建只接受这里的地址，运行时不可改。 */
export const DEFAULT_UPDATE_FEED = 'https://new.yuwangchenfa.com/updates/'

/**
 * 商城根地址（013）：客户端向它查询「有没有更新、feed 在哪」（Q89）。
 * 与更新源同域，打包后不可改。
 */
export const DEFAULT_MALL_BASE_URL = 'https://new.yuwangchenfa.com'

export interface UpdateFeedOptions {
  packaged: boolean
  /** 仅非打包构建允许覆盖（本地 feed / 自动化测试）。 */
  override?: string
}

function validFeed(value: string, allowHttp: boolean): string | null {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' || (allowHttp && url.protocol === 'http:')) return url.toString()
  } catch { /* 非法地址按未配置处理 */ }
  return null
}

/**
 * 更新源地址：
 * - 打包构建：永远使用固定 HTTPS 地址，忽略运行时覆盖（避免把更新源变成任意 URL）；
 * - 非打包构建：允许 MAXLABEL_UPDATE_URL 指向本地/测试 feed；非法时回退固定地址。
 */
export function resolveUpdateFeedUrl(options: UpdateFeedOptions): string {
  const override = String(options.override ?? '').trim()
  if (override && !options.packaged) {
    const parsed = validFeed(override, true)
    if (parsed) return parsed
  }
  return DEFAULT_UPDATE_FEED
}
