import { decryptSecureText, encryptSecureText, readSecureJson, updateSecureJson } from './secureJsonStore'

interface CloudCredential { token: string; email: string }
interface CloudCredentialStore { entries: Record<string, string | CloudCredential> }

async function loadStore(): Promise<CloudCredentialStore> {
  const store = await readSecureJson('cloud-credentials.json', { entries: {} }, '云端登录凭据存储损坏')
  if (!store.entries || typeof store.entries !== 'object' || Array.isArray(store.entries)) throw new Error('云端登录凭据存储损坏')
  return store
}

function normalizedServer(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '')
}

export async function readCloudCredential(serverUrl: string): Promise<CloudCredential | null> {
  const encoded = (await loadStore()).entries[normalizedServer(serverUrl)]
  if (!encoded) return null
  try {
    const parsed = typeof encoded === 'string'
      ? JSON.parse(decryptSecureText(encoded)) as Partial<CloudCredential>
      : encoded as Partial<CloudCredential>
    if (typeof parsed.token !== 'string' || typeof parsed.email !== 'string') return null
    if (typeof encoded !== 'string') await saveCloudCredential(serverUrl, parsed.token, parsed.email)
    return { token: parsed.token, email: parsed.email }
  } catch {
    // 兼容早期未加密的 JSON 字符串凭据，成功读取后立即重写为 safeStorage。
    try {
      const parsed = JSON.parse(String(encoded)) as Partial<CloudCredential>
      if (typeof parsed.token !== 'string' || typeof parsed.email !== 'string') return null
      await saveCloudCredential(serverUrl, parsed.token, parsed.email)
      return { token: parsed.token, email: parsed.email }
    } catch {
      return null
    }
  }
}

export async function saveCloudCredential(serverUrl: string, token: string, email: string): Promise<void> {
  await updateSecureJson('cloud-credentials.json', { entries: {} }, '云端登录凭据存储损坏', (store: CloudCredentialStore) => {
    const value = { token, email }
    try {
      store.entries[normalizedServer(serverUrl)] = encryptSecureText(JSON.stringify(value))
    } catch {
      // Tokens are credentials too: never silently persist a newly entered
      // token in plaintext when the platform keyring is unavailable.
      throw new Error('当前系统没有可用的安全凭据存储，未保存云端登录凭据')
    }
  })
}

export async function deleteCloudCredential(serverUrl: string): Promise<void> {
  await updateSecureJson('cloud-credentials.json', { entries: {} }, '云端登录凭据存储损坏', (store: CloudCredentialStore) => {
    delete store.entries[normalizedServer(serverUrl)]
  })
}
