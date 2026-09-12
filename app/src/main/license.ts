// ---------- 授权/激活（可对外售卖） ----------
// 在线鉴权：客户端输入 license key → 连接部署在服务器上的 FastAPI 云服务
// （POST /api/license/activate、/api/license/check），服务器校验 key 有效性并绑定机器码。
// 激活必须在线；使用期间本地缓存授权，启动时在线复查（断网时降级用缓存）。
import { createHash } from 'crypto'
import { hostname, cpus, platform } from 'os'
import { httpPostJson } from './net'
import { normalizeServerUrl } from './serverUrlPolicy'
import { decryptSecureText, encryptSecureText, readSecureJson, updateSecureJson } from './secureJsonStore'

export interface LicenseState {
  active: boolean
  machineId: string
  /** 激活的许可证持有人/邮箱（如有） */
  holder: string | null
  /** 激活使用的授权密钥（在线激活后保存，用于复查） */
  key?: string | null
  /** 授权到期时间（ISO，服务器下发；null=永久） */
  expiresAt?: string | null
  /** 上次在线复查时间（ISO） */
  lastCheckAt?: string | null
}
type StoredLicense = Omit<LicenseState, 'key'> & { key?: string | null; keyEncoding?: 'safeStorage' | 'plain' }
export function machineId(): string {
  const cpu = cpus()
    .slice(0, 4)
    .map((c) => c.model)
    .join('|')
  return createHash('sha256').update(`${platform()}|${hostname()}|${cpu}`).digest('hex').slice(0, 16)
}

async function persist(state: LicenseState): Promise<void> {
  await updateSecureJson<StoredLicense>('license.json', {} as StoredLicense, '本地授权文件损坏', (store) => {
    let key = state.key ? state.key : null
    let keyEncoding: StoredLicense['keyEncoding'] = 'plain'
    if (state.key) {
      try {
        key = encryptSecureText(state.key)
        keyEncoding = 'safeStorage'
      } catch {
        // safeStorage 不可用时仍保存授权状态，读取时按明文兼容格式处理。
      }
    }
    Object.assign(store, {
      active: state.active,
      machineId: state.machineId,
      holder: state.holder,
      key,
      keyEncoding,
      expiresAt: state.expiresAt ?? null,
      lastCheckAt: state.lastCheckAt ?? null
    })
  })
}

export async function readLicenseState(): Promise<LicenseState> {
  const mid = machineId()
  try {
    const s = await readSecureJson<StoredLicense>('license.json', {} as StoredLicense, '本地授权文件损坏')
    if (s.machineId === mid) {
      let key: string | null | undefined = s.key
      let migratePlaintextKey = false
      if (s.keyEncoding === 'safeStorage' && s.key) {
        try { key = decryptSecureText(s.key) } catch {
          // 安全存储不可解密时不能把缓存显示为“授权有效”。
          return { active: false, machineId: mid, holder: null, key: null, expiresAt: s.expiresAt ?? null, lastCheckAt: s.lastCheckAt ?? null }
        }
      } else if (typeof key === 'string' && key) {
        migratePlaintextKey = true
      }
      const state = { active: s.active === true && Boolean(key), machineId: mid, holder: s.holder ?? null, key: key ?? null, expiresAt: s.expiresAt ?? null, lastCheckAt: s.lastCheckAt ?? null }
      if (migratePlaintextKey) await persist(state).catch(() => {})
      return state
    }
    return { active: false, machineId: mid, holder: null }
  } catch {
    return { active: false, machineId: mid, holder: null }
  }
}

function normalizeServer(serverUrl: string): string {
  const normalized = normalizeServerUrl(serverUrl)
  if (normalized === null) throw new Error('服务器地址无效；远程服务器必须使用 HTTPS，本机地址可使用 HTTP')
  return normalized
}

/** 在线激活：POST /api/license/activate { key, machine_id } */
export async function activateLicense(
  key: string,
  serverUrl: string
): Promise<{ ok: boolean; error?: string; state?: LicenseState }> {
  const mid = machineId()
  let base = ''
  try { base = normalizeServer(serverUrl) } catch (error) { return { ok: false, error: error instanceof Error ? error.message : '云服务器地址无效' } }
  if (!base) return { ok: false, error: '未配置云服务器地址，请在「系统选项」中填写' }
  let res
  try {
    res = await httpPostJson(`${base}/api/license/activate`, { key: String(key || '').trim(), machine_id: mid })
  } catch {
    return { ok: false, error: '无法连接云服务器，请检查服务器地址和网络' }
  }
  let data: { active?: boolean; holder?: string; expires_at?: string | null }
  try {
    data = JSON.parse(res.body)
  } catch {
    return { ok: false, error: `服务器响应异常（HTTP ${res.status}）` }
  }
  if (res.status !== 200 || !data.active) {
    return { ok: false, error: data.holder ? undefined : (data as unknown as { detail?: string }).detail ?? '激活失败' }
  }
  const state: LicenseState = {
    active: true,
    machineId: mid,
    holder: data.holder ?? '已授权',
    key: String(key || '').trim(),
    expiresAt: data.expires_at ?? null,
    lastCheckAt: new Date().toISOString()
  }
  await persist(state)
  return { ok: true, state }
}

/** 在线复查：POST /api/license/check { key, machine_id }；失败不清除本地缓存 */
export async function checkLicenseOnline(serverUrl: string): Promise<{ ok: boolean; error?: string }> {
  let base = ''
  try { base = normalizeServer(serverUrl) } catch { return { ok: false, error: '云服务器地址无效' } }
  const cur = await readLicenseState()
  if (!base || !cur.key) return { ok: false, error: '未配置服务器或未激活' }
  try {
    const res = await httpPostJson(`${base}/api/license/check`, { key: cur.key, machine_id: cur.machineId })
    const data = JSON.parse(res.body) as { active?: boolean; expires_at?: string | null }
    if (res.status === 200 && data.active) {
      await persist({ ...cur, lastCheckAt: new Date().toISOString(), expiresAt: data.expires_at ?? cur.expiresAt ?? null })
      return { ok: true }
    }
    // 服务器判定失效（撤销/过期/换机）→ 本地也置为失效
    await persist({ ...cur, active: false, holder: null })
    return { ok: false, error: (data as unknown as { detail?: string }).detail ?? '授权已失效' }
  } catch {
    return { ok: false, error: '无法连接云服务器（保留本地授权）' }
  }
}
