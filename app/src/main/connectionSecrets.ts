import { decryptSecureText, encryptSecureText, readSecureJson, updateSecureJson } from './secureJsonStore'

interface SecretStore { secrets: Record<string, string> }

const SAFE_PREFIX = 'safe:'
const PLAIN_PREFIX = 'plain:'

function encodeSecret(value: string): string {
  try {
    return SAFE_PREFIX + encryptSecureText(value)
  } catch {
    // Never silently put a newly entered database password on disk in plain
    // text. Existing legacy plain: entries remain readable only so users can
    // migrate them after enabling the platform keyring.
    throw new Error('当前系统没有可用的安全凭据存储，未保存数据库密码')
  }
}

function decodeSecret(encoded: string): string {
  if (encoded.startsWith(PLAIN_PREFIX)) return encoded.slice(PLAIN_PREFIX.length)
  return decryptSecureText(encoded.startsWith(SAFE_PREFIX) ? encoded.slice(SAFE_PREFIX.length) : encoded)
}

async function loadStore(): Promise<SecretStore> {
  const store = await readSecureJson('connection-secrets.json', { secrets: {} }, '数据库凭据存储损坏')
  if (!store.secrets || typeof store.secrets !== 'object' || Array.isArray(store.secrets)) throw new Error('数据库凭据存储损坏')
  return store
}

export async function saveConnectionSecret(id: string, password?: string): Promise<void> {
  await updateSecureJson('connection-secrets.json', { secrets: {} }, '数据库凭据存储损坏', (store: SecretStore) => {
    if (!password) delete store.secrets[id]
    else store.secrets[id] = encodeSecret(password)
  })
}

export async function readConnectionSecret(id: string): Promise<string> {
  const store = await loadStore()
  const encoded = store.secrets[id]
  if (!encoded) return ''
  try {
    const value = decodeSecret(encoded)
    if (encoded.startsWith(PLAIN_PREFIX)) {
      try { await saveConnectionSecret(id, value) } catch { /* 保留旧凭据，等待系统安全存储恢复。 */ }
    }
    return value
  } catch {
    return ''
  }
}

export async function deleteConnectionSecret(id: string): Promise<void> {
  return saveConnectionSecret(id)
}
