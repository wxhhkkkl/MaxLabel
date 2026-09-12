// ---------- 云端模板存储（本地离线实现） ----------
// 提供与真实 HTTP 后端一致的 API 契约（register/login/save/list/load/delete），
// 当前以 userData/cloud-store.json 落盘，未配置服务地址时支持离线使用，配置后可替换为线上接口。
import { app } from 'electron'
import { mkdir, rename, rm, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto'
import { decryptSecureText, encryptSecureText } from './secureJsonStore'
import { readBoundedFile } from './ipc/validation'

interface CloudAccount {
  email: string
  passwordHash: string
  passwordSalt: string
  /** Metadata lives in the small account index; template bodies are blobs. */
  templates: Array<{ id: string; name: string; json?: string; updatedAt: string }>
}
interface CloudStore {
  accounts: Record<string, CloudAccount>
  sessions: Record<string, { email: string; expiresAt: number }>
}

const MAX_OFFLINE_TEMPLATES = 1000
const MAX_OFFLINE_TEMPLATE_BYTES = 256 * 1024 * 1024

function storePath(): string {
  return join(app.getPath('userData'), 'cloud-store.json')
}

function templateBlobPath(email: string, id: string): string {
  const key = createHash('sha256').update(`${email}:${id}`).digest('hex')
  return join(app.getPath('userData'), 'cloud-templates', `${key}.json`)
}

async function writeTemplateBlob(email: string, id: string, json: string): Promise<void> {
  const target = templateBlobPath(email, id)
  const temporary = `${target}.${randomUUID()}.tmp`
  try {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(temporary, json, 'utf-8')
    await rename(temporary, target)
  } finally {
    await rm(temporary, { force: true }).catch(() => {})
  }
}

async function readTemplateBlob(email: string, id: string): Promise<string> {
  return (await readBoundedFile(templateBlobPath(email, id), 16 * 1024 * 1024)).toString('utf-8')
}

async function templateByteLength(email: string, template: { id: string; json?: string }): Promise<number> {
  const json = template.json ?? await readTemplateBlob(email, template.id).catch(() => '')
  return Buffer.byteLength(json, 'utf8')
}

async function loadStore(): Promise<CloudStore> {
  const path = storePath()
  try {
    const raw = (await readBoundedFile(path, 256 * 1024 * 1024)).toString('utf-8')
    const data = JSON.parse(raw) as Partial<CloudStore>
    if (!data.accounts || typeof data.accounts !== 'object' || Array.isArray(data.accounts) || !data.sessions || typeof data.sessions !== 'object' || Array.isArray(data.sessions)) throw new Error('bad store')
    const accounts: CloudStore['accounts'] = {}
    for (const [email, account] of Object.entries(data.accounts)) {
      if (!account || typeof account !== 'object' || typeof account.email !== 'string' || typeof account.passwordHash !== 'string' || !Array.isArray(account.templates)) throw new Error('bad account')
      const templates = account.templates.map((template) => {
        if (!template || typeof template !== 'object' || typeof template.id !== 'string' || typeof template.name !== 'string' || typeof template.updatedAt !== 'string') throw new Error('bad template')
        if (template.json !== undefined && typeof template.json !== 'string') throw new Error('bad template')
        return { id: template.id, name: template.name, ...(template.json === undefined ? {} : { json: template.json }), updatedAt: template.updatedAt }
      })
      if (templates.length > MAX_OFFLINE_TEMPLATES || templates.reduce((sum, item) => sum + Buffer.byteLength(item.json ?? '', 'utf8'), 0) > MAX_OFFLINE_TEMPLATE_BYTES) throw new Error('本地云模板数量或总容量超过限制')
      accounts[email] = { email: account.email, passwordHash: account.passwordHash, passwordSalt: typeof account.passwordSalt === 'string' ? account.passwordSalt : '', templates }
    }
    const sessions: CloudStore['sessions'] = {}
    let migratedPlaintextSessions = false
    for (const [token, value] of Object.entries(data.sessions as Record<string, string | { email: string; expiresAt: number }>)) {
      const email = typeof value === 'string' ? value : value.email
      const expiresAt = typeof value === 'string' ? Date.now() + 30 * 86400000 : value.expiresAt
      if (email && accounts[email] && Number.isFinite(expiresAt) && expiresAt > Date.now()) {
        let storageKey = token
        if (!token.startsWith('enc:')) {
          try {
            storageKey = storedSessionToken(token)
            migratedPlaintextSessions = true
          } catch {
            // 保留旧明文会话，避免安全存储不可用时丢失离线账号；下次可继续迁移。
          }
        }
        sessions[storageKey] = { email, expiresAt }
      }
    }
    const store = { accounts, sessions }
    let migratedTemplateBlobs = false
    for (const account of Object.values(store.accounts)) {
      for (const template of account.templates) {
        if (template.json === undefined) continue
        await writeTemplateBlob(account.email, template.id, template.json)
        delete template.json
        migratedTemplateBlobs = true
      }
    }
    if (migratedTemplateBlobs) await saveStore(store)
    if (migratedPlaintextSessions) await saveStore(store).catch(() => {})
    return store
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { accounts: {}, sessions: {} }
    const quarantine = `${path}.corrupt-${Date.now()}`
    try { await rename(path, quarantine) } catch { /* 保留原始错误，避免静默覆盖用户数据。 */ }
    throw new Error('本地云模板存储损坏，已隔离原文件：' + quarantine)
  }
}

async function saveStore(store: CloudStore): Promise<void> {
  const target = storePath()
  const temporary = target + '.' + randomUUID() + '.tmp'
  try {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(temporary, JSON.stringify(store, null, 2), 'utf-8')
    await rename(temporary, target)
  } finally {
    await rm(temporary, { force: true }).catch(() => {})
  }
}

let storeMutationQueue: Promise<void> = Promise.resolve()

async function currentStore(): Promise<CloudStore> {
  await storeMutationQueue.catch(() => {})
  return loadStore()
}

async function withStoreMutation<T>(update: (store: CloudStore) => Promise<T> | T): Promise<T> {
  const run = storeMutationQueue.catch(() => {}).then(async () => {
    const store = await loadStore()
    const result = await update(store)
    await saveStore(store)
    return result
  })
  storeMutationQueue = run.then(() => undefined, () => undefined)
  return run
}

function hashPwd(pwd: string, salt: string): Buffer {
  return scryptSync(pwd, salt, 32)
}

function passwordMatches(password: string, account: CloudAccount): boolean {
  if (!account.passwordSalt || !account.passwordHash) return false
  try {
    const expected = Buffer.from(account.passwordHash, 'hex')
    const actual = hashPwd(password, account.passwordSalt)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

function legacyPasswordMatches(email: string, password: string, account: CloudAccount): boolean {
  return createHash('sha256').update(`${email}::${password}`).digest('hex') === account.passwordHash
}

function storedSessionToken(token: string): string {
  try { return `enc:${encryptSecureText(token)}` } catch { return `plain:${token}` }
}

function sessionEntry(store: CloudStore, token: string | undefined): [string, { email: string; expiresAt: number }] | undefined {
  if (!token) return undefined
  const direct = store.sessions[token] ?? store.sessions[`plain:${token}`]
  if (direct) return [store.sessions[token] ? token : `plain:${token}`, direct]
  for (const [stored, session] of Object.entries(store.sessions)) {
    if (!stored.startsWith('enc:')) continue
    try {
      if (decryptSecureText(stored.slice(4)) === token) return [stored, session]
    } catch {
      // Ignore sessions that can no longer be decrypted on this machine.
    }
  }
  return undefined
}

export interface CloudResult<T = unknown> {
  ok: boolean
  error?: string
  data?: T
}

export async function offlineCloudRegister(email: string, password: string): Promise<CloudResult<{ token: string; email: string }>> {
  const e = String(email || '').trim().toLowerCase()
  const p = String(password || '')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { ok: false, error: '邮箱格式不正确' }
  if (p.length < 6) return { ok: false, error: '密码至少 6 位' }
  return withStoreMutation((store) => {
    if (store.accounts[e]) return { ok: false, error: '该邮箱已注册，请直接登录' }
    const salt = randomBytes(16).toString('hex')
    store.accounts[e] = { email: e, passwordSalt: salt, passwordHash: hashPwd(p, salt).toString('hex'), templates: [] }
    const token = randomUUID() + randomUUID()
    store.sessions[storedSessionToken(token)] = { email: e, expiresAt: Date.now() + 30 * 86400000 }
    return { ok: true, data: { token, email: e } }
  })
}

export async function offlineCloudLogin(email: string, password: string): Promise<CloudResult<{ token: string; email: string }>> {
  const e = String(email || '').trim().toLowerCase()
  const p = String(password || '')
  return withStoreMutation((store) => {
    const acct = store.accounts[e]
    if (!acct) return { ok: false, error: '账号不存在，请先注册' }
    if (!acct.passwordSalt) {
      if (!legacyPasswordMatches(e, p, acct)) return { ok: false, error: '密码错误' }
      const salt = randomBytes(16).toString('hex')
      acct.passwordSalt = salt
      acct.passwordHash = hashPwd(p, salt).toString('hex')
    } else if (!passwordMatches(p, acct)) return { ok: false, error: '密码错误' }
    const token = randomUUID() + randomUUID()
    store.sessions[storedSessionToken(token)] = { email: e, expiresAt: Date.now() + 30 * 86400000 }
    return { ok: true, data: { token, email: e } }
  })
}

export async function offlineCloudLogout(token: string): Promise<CloudResult<{ ok: boolean }>> {
  return withStoreMutation((store) => {
    const entry = sessionEntry(store, token)
    if (entry) delete store.sessions[entry[0]]
    return { ok: true, data: { ok: true } }
  })
}

function accountOf(store: CloudStore, token: string | undefined): CloudAccount | null {
  const session = sessionEntry(store, token)?.[1]
  if (!session || session.expiresAt <= Date.now()) return null
  return store.accounts[session.email] ?? null
}

export async function offlineCloudSave(token: string, name: string, json: string): Promise<CloudResult<{ id: string; name: string }>> {
  return withStoreMutation(async (store) => {
    const acct = accountOf(store, token)
    if (!acct) return { ok: false, error: '未登录或会话失效' }
    const clean = String(name || '未命名模板').trim().slice(0, 255) || '未命名模板'
    if (Buffer.byteLength(String(json ?? ''), 'utf8') > 16 * 1024 * 1024) return { ok: false, error: '模板内容超过 16 MB 限制' }
    try { JSON.parse(String(json ?? '')) } catch { return { ok: false, error: '模板内容不是有效 JSON' } }
    const existing = acct.templates.find((t) => t.name === clean)
    const id = existing?.id ?? randomUUID()
    const currentBytes = (await Promise.all(acct.templates.map((item) => templateByteLength(acct.email, item)))).reduce((sum, value) => sum + value, 0)
    const existingBytes = existing ? await templateByteLength(acct.email, existing) : 0
    const nextBytes = currentBytes - existingBytes + Buffer.byteLength(json, 'utf8')
    if (!existing && acct.templates.length >= MAX_OFFLINE_TEMPLATES) return { ok: false, error: `离线云模板最多 ${MAX_OFFLINE_TEMPLATES} 个` }
    if (nextBytes > MAX_OFFLINE_TEMPLATE_BYTES) return { ok: false, error: '离线云模板总容量超过 256 MB' }
    await writeTemplateBlob(acct.email, id, json)
    if (existing) {
      delete existing.json
      existing.updatedAt = new Date().toISOString()
    } else {
      acct.templates.push({ id, name: clean, updatedAt: new Date().toISOString() })
    }
    return { ok: true, data: { id, name: clean } }
  })
}

export async function offlineCloudList(token: string): Promise<CloudResult<Array<{ id: string; name: string; updatedAt: string }>>> {
  const acct = accountOf(await currentStore(), token)
  if (!acct) return { ok: false, error: '未登录或会话失效' }
  return {
    ok: true,
    data: acct.templates.map((t) => ({ id: t.id, name: t.name, updatedAt: t.updatedAt }))
  }
}

export async function offlineCloudLoad(token: string, id: string): Promise<CloudResult<{ name: string; json: string }>> {
  const acct = accountOf(await currentStore(), token)
  if (!acct) return { ok: false, error: '未登录或会话失效' }
  const t = acct.templates.find((x) => x.id === id)
  if (!t) return { ok: false, error: '模板不存在' }
  try {
    const json = t.json ?? await readTemplateBlob(acct.email, id)
    return { ok: true, data: { name: t.name, json } }
  } catch {
    return { ok: false, error: '模板内容损坏或丢失' }
  }
}

export async function offlineCloudDelete(token: string, id: string): Promise<CloudResult<{ ok: boolean }>> {
  return withStoreMutation((store) => {
    const acct = accountOf(store, token)
    if (!acct) return { ok: false, error: '未登录或会话失效' }
    acct.templates = acct.templates.filter((t) => t.id !== id)
    return { ok: true, data: { ok: true } }
  })
}
