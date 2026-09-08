// ---------- 云端模板存储（本地模拟服务端） ----------
// 提供与真实 HTTP 后端一致的 API 契约（register/login/save/list/load/delete），
// 当前以 userData/cloud-store.json 落盘模拟服务端行为，便于离线演示与后续替换为线上接口。
import { app } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { createHash, randomUUID } from 'crypto'

interface CloudAccount {
  email: string
  passwordHash: string
  templates: Array<{ id: string; name: string; json: string; updatedAt: string }>
}
interface CloudStore {
  accounts: Record<string, CloudAccount>
  sessions: Record<string, string> // token -> email
}

function storePath(): string {
  return join(app.getPath('userData'), 'cloud-store.json')
}

async function loadStore(): Promise<CloudStore> {
  try {
    const raw = await readFile(storePath(), 'utf-8')
    const data = JSON.parse(raw) as CloudStore
    if (!data.accounts || !data.sessions) throw new Error('bad store')
    return data
  } catch {
    return { accounts: {}, sessions: {} }
  }
}

async function saveStore(store: CloudStore): Promise<void> {
  await writeFile(storePath(), JSON.stringify(store, null, 2), 'utf-8')
}

function hashPwd(pwd: string, salt: string): string {
  return createHash('sha256').update(salt + '::' + pwd).digest('hex')
}

export interface CloudResult<T = unknown> {
  ok: boolean
  error?: string
  data?: T
}

export async function cloudRegister(email: string, password: string): Promise<CloudResult<{ token: string; email: string }>> {
  const e = String(email || '').trim().toLowerCase()
  const p = String(password || '')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { ok: false, error: '邮箱格式不正确' }
  if (p.length < 6) return { ok: false, error: '密码至少 6 位' }
  const store = await loadStore()
  if (store.accounts[e]) return { ok: false, error: '该邮箱已注册，请直接登录' }
  const salt = randomUUID()
  store.accounts[e] = { email: e, passwordHash: hashPwd(p, salt), templates: [] }
  const token = randomUUID() + randomUUID()
  store.sessions[token] = e
  await saveStore(store)
  return { ok: true, data: { token, email: e } }
}

export async function cloudLogin(email: string, password: string): Promise<CloudResult<{ token: string; email: string }>> {
  const e = String(email || '').trim().toLowerCase()
  const p = String(password || '')
  const store = await loadStore()
  const acct = store.accounts[e]
  if (!acct) return { ok: false, error: '账号不存在，请先注册' }
  // 本地模拟：盐未持久化，此处用邮箱作为盐的确定性哈希（模拟；真实后端请使用安全口令库）
  if (acct.passwordHash !== hashPwd(p, e)) return { ok: false, error: '密码错误' }
  const token = randomUUID() + randomUUID()
  store.sessions[token] = e
  await saveStore(store)
  return { ok: true, data: { token, email: e } }
}

async function accountOf(token: string | undefined): Promise<CloudAccount | null> {
  if (!token) return null
  const store = await loadStore()
  const email = store.sessions[token]
  if (!email) return null
  return store.accounts[email] ?? null
}

export async function cloudSave(token: string, name: string, json: string): Promise<CloudResult<{ id: string; name: string }>> {
  const store = await loadStore()
  const email = store.sessions[token]
  const acct = email ? store.accounts[email] : undefined
  if (!acct) return { ok: false, error: '未登录或会话失效' }
  const clean = String(name || '未命名模板')
  const existing = acct.templates.find((t) => t.name === clean)
  if (existing) {
    existing.json = json
    existing.updatedAt = new Date().toISOString()
  } else {
    acct.templates.push({ id: randomUUID(), name: clean, json, updatedAt: new Date().toISOString() })
  }
  await saveStore(store)
  return { ok: true, data: { id: existing?.id ?? '', name: clean } }
}

export async function cloudList(token: string): Promise<CloudResult<Array<{ id: string; name: string; updatedAt: string }>>> {
  const acct = await accountOf(token)
  if (!acct) return { ok: false, error: '未登录或会话失效' }
  return {
    ok: true,
    data: acct.templates.map((t) => ({ id: t.id, name: t.name, updatedAt: t.updatedAt }))
  }
}

export async function cloudLoad(token: string, id: string): Promise<CloudResult<{ name: string; json: string }>> {
  const acct = await accountOf(token)
  if (!acct) return { ok: false, error: '未登录或会话失效' }
  const t = acct.templates.find((x) => x.id === id)
  if (!t) return { ok: false, error: '模板不存在' }
  return { ok: true, data: { name: t.name, json: t.json } }
}

export async function cloudDelete(token: string, id: string): Promise<CloudResult<{ ok: boolean }>> {
  const store = await loadStore()
  const email = store.sessions[token]
  const acct = email ? store.accounts[email] : undefined
  if (!acct) return { ok: false, error: '未登录或会话失效' }
  acct.templates = acct.templates.filter((t) => t.id !== id)
  await saveStore(store)
  return { ok: true, data: { ok: true } }
}
