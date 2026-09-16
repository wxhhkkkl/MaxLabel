// ---------- 启动自动检查更新（帮助 install_upgrade.html） ----------
// 原版：签赋LabelShop 启动时会自动检查更新程序，有新版本就给出提示；
// 「帮助 → 查找更新版本」是同一件事的手工入口（查找到更新的版本后按提示下载更新）。
// 复刻版以「系统选项 → 云服务器地址」为清单来源（GET <base>/api/version），
// 也允许用 MAXLABEL_UPDATE_URL 指向任意清单地址（自建分发 / 离线部署时使用）。
// 网络失败一律静默：启动检查不得打扰用户，手工检查则如实回报失败原因。
import { httpGet } from './net'
import { normalizeServerUrl } from './serverUrlPolicy'

export interface UpdateManifest {
  version: string
  url?: string
  notes?: string
}

export interface UpdateCheckResult {
  /** update=有新版本；latest=已是最新；unavailable=未能取得版本清单（不打扰用户）。 */
  status: 'update' | 'latest' | 'unavailable'
  current: string
  latest?: string
  url?: string
  notes?: string
  message?: string
}

const VERSION_PATTERN = /^\d+(\.\d+)*$/

/** 去掉 `v` 前缀与 `-beta.1` 之类的预发布后缀，只留数字段。 */
export function normalizeVersion(value: unknown): string | null {
  const raw = String(value ?? '').trim().replace(/^v/i, '')
  const core = raw.split(/[-+]/)[0]
  return VERSION_PATTERN.test(core) ? core : null
}

/** 逐段比较版本号：a<b 返回 -1，a=b 返回 0，a>b 返回 1。非法版本按 0 处理。 */
export function compareVersions(a: unknown, b: unknown): number {
  const left = (normalizeVersion(a) ?? '0').split('.').map(Number)
  const right = (normalizeVersion(b) ?? '0').split('.').map(Number)
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

/** 解析版本清单：接受 `{version}` 或 `{latest}`，可选 `url`/`notes`。 */
export function parseVersionManifest(body: string): UpdateManifest | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(String(body ?? ''))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const raw = parsed as Record<string, unknown>
  const version = normalizeVersion(raw.version ?? raw.latest ?? raw.version_name)
  if (!version) return null
  const url = typeof raw.url === 'string' && raw.url.trim() ? raw.url.trim() : undefined
  const notes = typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes.trim() : undefined
  return { version, url, notes }
}

/**
 * 版本清单地址：优先显式覆盖（MAXLABEL_UPDATE_URL / 调用方传入），
 * 否则取云服务器地址下的 `/api/version`；未配置服务器时返回 null。
 */
export function resolveManifestUrl(serverUrl: unknown, override?: string): string | null {
  const explicit = String(override ?? process.env['MAXLABEL_UPDATE_URL'] ?? '').trim()
  if (explicit) return explicit
  const base = normalizeServerUrl(serverUrl)
  if (!base) return null
  return `${base}/api/version`
}

/**
 * 检查更新。任何网络/解析失败都收敛成 `unavailable`，绝不抛出——
 * 启动路径靠这一点保证「检查失败不打扰用户」。
 */
export async function checkForUpdate(options: {
  currentVersion: string
  serverUrl?: unknown
  manifestUrl?: string
  timeoutMs?: number
}): Promise<UpdateCheckResult> {
  const current = normalizeVersion(options.currentVersion) ?? '0'
  const manifestUrl = resolveManifestUrl(options.serverUrl, options.manifestUrl)
  if (!manifestUrl) return { status: 'unavailable', current, message: '未配置云服务器地址，无法检查更新' }
  let response: { status: number; body: string }
  try {
    response = await httpGet(manifestUrl, options.timeoutMs ?? 5000)
  } catch {
    return { status: 'unavailable', current, message: '无法连接更新服务器，请检查网络或云服务器地址' }
  }
  if (response.status !== 200) {
    return { status: 'unavailable', current, message: `更新服务器返回 ${response.status}` }
  }
  const manifest = parseVersionManifest(response.body)
  if (!manifest) return { status: 'unavailable', current, message: '更新服务器返回的版本清单无法识别' }
  return {
    status: compareVersions(manifest.version, current) > 0 ? 'update' : 'latest',
    current,
    latest: manifest.version,
    url: manifest.url,
    notes: manifest.notes
  }
}
