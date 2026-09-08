// ---------- 授权/激活（可对外售卖） ----------
// 在线鉴权：客户端输入 license key → 连接部署在服务器上的 FastAPI 云服务
// （POST /api/license/activate、/api/license/check），服务器校验 key 有效性并绑定机器码。
// 激活必须在线；使用期间本地缓存授权，启动时在线复查（断网时降级用缓存）。
import { app } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { createHash, createHmac, randomBytes } from 'crypto'
import { hostname, cpus, platform } from 'os'
import { httpPostJson } from './net'

// 演示用签名密钥（仅随机样例 key 用；正式激活一律走服务器）
const SIGN_SECRET = 'maxlabel-sign-v1-9f2c1a7b'

export type Edition = 'trial' | 'pro' | 'enterprise'

export interface LicenseState {
  active: boolean
  edition: Edition
  machineId: string
  /** 试用到期时间（ISO），trial 模式有效 */
  trialExpiresAt: string | null
  /** 激活的许可证持有人/邮箱（如有） */
  holder: string | null
  /** 激活使用的授权密钥（在线激活后保存，用于复查） */
  key?: string | null
  /** 授权到期时间（ISO，服务器下发；null=永久） */
  expiresAt?: string | null
  /** 上次在线复查时间（ISO） */
  lastCheckAt?: string | null
}

function licensePath(): string {
  return join(app.getPath('userData'), 'license.json')
}

export function machineId(): string {
  const cpu = cpus()
    .slice(0, 4)
    .map((c) => c.model)
    .join('|')
  return createHash('sha256').update(`${platform()}|${hostname()}|${cpu}`).digest('hex').slice(0, 16)
}

function sign(data: string): string {
  return createHmac('sha256', SIGN_SECRET).update(data).digest('hex').slice(0, 12)
}

/** 生成演示样例密钥：hex(body).hex(sig)，显示为 4 位一组（仅供演示/测试） */
export function generateLicenseKey(machine: string, edition: Edition, days: number, holder = 'user'): string {
  const bodyRaw = `${machine}:${edition}:${Date.now()}:${days}:${holder}`
  const bodyHex = Buffer.from(bodyRaw, 'utf-8').toString('hex')
  const sig = sign(bodyRaw)
  const joined = `${bodyHex}.${sig}`.toUpperCase()
  return joined.match(/.{1,4}/g)!.join('-')
}

async function persist(state: LicenseState): Promise<void> {
  await writeFile(licensePath(), JSON.stringify(state, null, 2), 'utf-8')
}

export async function readLicenseState(): Promise<LicenseState> {
  const mid = machineId()
  try {
    const raw = await readFile(licensePath(), 'utf-8')
    const s = JSON.parse(raw) as LicenseState
    if (s.machineId === mid) return s
    // 机器变化 → 退回试用
    return { active: false, edition: 'trial', machineId: mid, trialExpiresAt: null, holder: null }
  } catch {
    return { active: false, edition: 'trial', machineId: mid, trialExpiresAt: null, holder: null }
  }
}

function normalizeServer(serverUrl: string): string {
  return String(serverUrl || '').trim().replace(/\/+$/, '')
}

/** 在线激活：POST /api/license/activate { key, machine_id } */
export async function activateLicense(
  key: string,
  serverUrl: string
): Promise<{ ok: boolean; error?: string; state?: LicenseState }> {
  const mid = machineId()
  const base = normalizeServer(serverUrl)
  if (!base) return { ok: false, error: '未配置云服务器地址，请在「系统选项」中填写' }
  let res
  try {
    res = await httpPostJson(`${base}/api/license/activate`, { key: String(key || '').trim(), machine_id: mid })
  } catch {
    return { ok: false, error: '无法连接云服务器，请检查服务器地址和网络' }
  }
  let data: { active?: boolean; edition?: Edition; holder?: string; expires_at?: string | null }
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
    edition: data.edition ?? 'pro',
    machineId: mid,
    trialExpiresAt: null,
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
  const base = normalizeServer(serverUrl)
  const cur = await readLicenseState()
  if (!base || !cur.key) return { ok: false, error: '未配置服务器或未激活' }
  try {
    const res = await httpPostJson(`${base}/api/license/check`, { key: cur.key, machine_id: cur.machineId })
    const data = JSON.parse(res.body) as { active?: boolean; edition?: Edition; expires_at?: string | null }
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

/** 开启试用（例如首次运行给予 15 天） */
export async function startTrial(days = 15): Promise<LicenseState> {
  const mid = machineId()
  const expires = new Date(Date.now() + days * 86400000).toISOString()
  const state: LicenseState = { active: false, edition: 'trial', machineId: mid, trialExpiresAt: expires, holder: null }
  await persist(state)
  return state
}

export function randomLicenseSample(): string {
  // 仅用于演示：生成当前机器的 pro 版样例密钥
  return generateLicenseKey(machineId(), 'pro', 365)
}
