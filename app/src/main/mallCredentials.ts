import { randomUUID } from 'crypto'
import type { MallMember } from '../shared/ipcContract'
import { decryptSecureText, encryptSecureText, readSecureJson, updateSecureJson } from './secureJsonStore'

const FILE = 'mall-credentials.json'
const CORRUPT = '商城登录凭据存储损坏'

export interface MallTokens {
  accessToken: string
  refreshToken: string
  expiresTime: number
}

interface StoredCredential {
  tokens?: MallTokens
  member?: MallMember | null
  deviceId?: string
  savedAt?: number
}

interface CredentialStore {
  entries: Record<string, string>
}

export interface MallCredential {
  tokens: MallTokens
  member: MallMember | null
  deviceId: string
  savedAt: number
}

function normalizedBase(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '')
}

async function loadStore(): Promise<CredentialStore> {
  const store = await readSecureJson(FILE, { entries: {} }, CORRUPT)
  if (!store.entries || typeof store.entries !== 'object' || Array.isArray(store.entries)) {
    throw new Error(CORRUPT)
  }
  return store
}

function decode(encoded: string | undefined): StoredCredential | null {
  if (!encoded) return null
  try {
    const parsed = JSON.parse(decryptSecureText(encoded)) as StoredCredential
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function validTokens(value: unknown): value is MallTokens {
  if (!value || typeof value !== 'object') return false
  const tokens = value as Partial<MallTokens>
  return typeof tokens.accessToken === 'string' && tokens.accessToken.length > 0
    && typeof tokens.refreshToken === 'string' && tokens.refreshToken.length > 0
    && typeof tokens.expiresTime === 'number' && Number.isFinite(tokens.expiresTime)
}

export async function readMallCredential(baseUrl: string): Promise<MallCredential | null> {
  const stored = decode((await loadStore()).entries[normalizedBase(baseUrl)])
  if (!stored || !validTokens(stored.tokens)) return null
  return {
    tokens: stored.tokens,
    member: stored.member ?? null,
    deviceId: typeof stored.deviceId === 'string' ? stored.deviceId : '',
    savedAt: typeof stored.savedAt === 'number' ? stored.savedAt : 0
  }
}

export async function saveMallCredential(
  baseUrl: string,
  tokens: MallTokens,
  member: MallMember | null
): Promise<void> {
  await updateSecureJson(FILE, { entries: {} }, CORRUPT, (store: CredentialStore) => {
    const key = normalizedBase(baseUrl)
    const existing = decode(store.entries[key])
    const deviceId = existing?.deviceId || randomUUID()
    try {
      store.entries[key] = encryptSecureText(JSON.stringify({
        tokens,
        member,
        deviceId,
        savedAt: Date.now()
      } satisfies StoredCredential))
    } catch {
      // 令牌是凭据：没有平台密钥环时拒绝明文落盘。
      throw new Error('当前系统没有可用的安全凭据存储，未保存商城登录凭据')
    }
  })
}

export async function clearMallCredential(baseUrl: string): Promise<void> {
  await updateSecureJson(FILE, { entries: {} }, CORRUPT, (store: CredentialStore) => {
    delete store.entries[normalizedBase(baseUrl)]
  })
}

/** 随机设备标识（不是机器指纹），用于打印记录区分设备。 */
export async function readMallDeviceId(baseUrl: string): Promise<string> {
  const key = normalizedBase(baseUrl)
  const stored = decode((await loadStore()).entries[key])
  if (stored?.deviceId) return stored.deviceId
  const deviceId = randomUUID()
  await updateSecureJson(FILE, { entries: {} }, CORRUPT, (store: CredentialStore) => {
    const current = decode(store.entries[key])
    const id = current?.deviceId || deviceId
    store.entries[key] = encryptSecureText(JSON.stringify({
      ...current,
      deviceId: id
    } satisfies StoredCredential))
  })
  return deviceId
}
