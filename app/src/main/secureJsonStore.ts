import { app, safeStorage } from 'electron'
import { mkdir, rename, rm, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { randomUUID } from 'crypto'
import { readBoundedFile } from './ipc/validation'

const loaded = new Map<string, object>()
const loading = new Map<string, Promise<object>>()
const pending = new Map<string, Promise<void>>()

function pathOf(fileName: string): string {
  return join(app.getPath('userData'), fileName)
}

export async function readSecureJson<T extends object>(fileName: string, fallback: T, corruptMessage: string): Promise<T> {
  const cached = loaded.get(fileName)
  if (cached) return cached as T
  const activeLoad = loading.get(fileName)
  if (activeLoad) return activeLoad as Promise<T>
  const nextLoad = (async () => {
    try {
      const parsed: unknown = JSON.parse((await readBoundedFile(pathOf(fileName), 4 * 1024 * 1024)).toString('utf8'))
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid store')
      loaded.set(fileName, parsed)
      return parsed
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        loaded.set(fileName, fallback)
        return fallback
      }
      throw new Error(corruptMessage)
    } finally {
      loading.delete(fileName)
    }
  })()
  loading.set(fileName, nextLoad)
  return nextLoad as Promise<T>
}

export async function updateSecureJson<T extends object>(fileName: string, fallback: T, corruptMessage: string, update: (store: T) => void): Promise<void> {
  const previous = pending.get(fileName) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(async () => {
    // Never mutate the cached object before persistence succeeds.  Otherwise a
    // failed disk write would leave memory ahead of disk until the next restart.
    const current = await readSecureJson(fileName, fallback, corruptMessage)
    const store = JSON.parse(JSON.stringify(current)) as T
    update(store)
    const target = pathOf(fileName)
    const temporary = `${target}.${randomUUID()}.tmp`
    try {
      await mkdir(dirname(target), { recursive: true })
      await writeFile(temporary, JSON.stringify(store, null, 2), 'utf8')
      await rename(temporary, target)
      loaded.set(fileName, store)
    } finally {
      await rm(temporary, { force: true }).catch(() => {})
    }
  })
  pending.set(fileName, next)
  await next
}

function requireEncryption(): void {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('当前系统没有可用的安全凭据存储')
}

export function encryptSecureText(value: string): string {
  requireEncryption()
  return safeStorage.encryptString(value).toString('base64')
}

export function decryptSecureText(encoded: string): string {
  requireEncryption()
  return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
}
