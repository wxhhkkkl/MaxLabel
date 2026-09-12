import { app } from 'electron'
import { randomUUID } from 'crypto'
import { createHash } from 'crypto'
import { mkdir, rename, rm, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { readBoundedFile } from './ipc/validation'

export interface SharedTemplate {
  id: string
  name: string
  json: string
  updatedAt: string
  author: string
}

interface StoredSharedTemplate extends Omit<SharedTemplate, 'json'> { json?: string }
interface SharedLibraryStore { templates: StoredSharedTemplate[] }

const MAX_SHARED_TEMPLATES = 1000
const MAX_SHARED_TEMPLATE_BYTES = 256 * 1024 * 1024

function storePath(): string {
  return join(app.getPath('userData'), 'shared-templates.json')
}

function blobPath(id: string): string {
  const key = createHash('sha256').update(id).digest('hex')
  return join(app.getPath('userData'), 'shared-template-blobs', `${key}.json`)
}

async function writeBlob(id: string, json: string): Promise<void> {
  const target = blobPath(id)
  const temporary = `${target}.${randomUUID()}.tmp`
  try {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(temporary, json, 'utf-8')
    await rename(temporary, target)
  } finally {
    await rm(temporary, { force: true }).catch(() => {})
  }
}

async function readBlob(id: string): Promise<string> {
  return (await readBoundedFile(blobPath(id), 16 * 1024 * 1024)).toString('utf-8')
}

async function bodyOf(template: StoredSharedTemplate): Promise<string> {
  return template.json ?? readBlob(template.id)
}

async function loadStore(): Promise<SharedLibraryStore> {
  // Read the former filename once for backward compatibility; all new writes
  // use shared-templates.json and the product exposes only one edition.
  for (const path of [storePath(), join(app.getPath('userData'), 'enterprise-store.json')]) {
    try {
      const parsed = JSON.parse((await readBoundedFile(path, 256 * 1024 * 1024)).toString('utf-8')) as Partial<SharedLibraryStore>
      if (!Array.isArray(parsed.templates)) throw new Error('bad shared library')
      const templates = parsed.templates.map((template) => {
        if (!template || typeof template !== 'object' || typeof template.id !== 'string' || typeof template.name !== 'string' || typeof template.updatedAt !== 'string' || typeof template.author !== 'string') throw new Error('bad shared template')
        if (template.json !== undefined && typeof template.json !== 'string') throw new Error('bad shared template')
        return { id: template.id, name: template.name, updatedAt: template.updatedAt, author: template.author, ...(template.json === undefined ? {} : { json: template.json }) }
      })
      if (templates.length > MAX_SHARED_TEMPLATES || templates.reduce((sum, item) => sum + Buffer.byteLength(item.json ?? '', 'utf8'), 0) > MAX_SHARED_TEMPLATE_BYTES) throw new Error('共享模板数量或总容量超过限制')
      const store = { templates }
      let migrated = false
      for (const template of store.templates) {
        if (template.json === undefined) continue
        await writeBlob(template.id, template.json)
        delete template.json
        migrated = true
      }
      if (migrated) await saveStore(store)
      return store
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      const quarantine = `${path}.corrupt-${Date.now()}`
      try { await rename(path, quarantine) } catch { /* preserve original failure */ }
      throw new Error('共享模板库损坏，已隔离原文件：' + quarantine)
    }
  }
  return { templates: [] }
}

async function saveStore(store: SharedLibraryStore): Promise<void> {
  const path = storePath()
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(temporary, JSON.stringify(store, null, 2), 'utf-8')
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true }).catch(() => {})
  }
}

let storeMutationQueue: Promise<void> = Promise.resolve()

async function currentStore(): Promise<SharedLibraryStore> {
  await storeMutationQueue.catch(() => {})
  return loadStore()
}

async function withStoreMutation<T>(update: (store: SharedLibraryStore) => Promise<T> | T): Promise<T> {
  const run = storeMutationQueue.catch(() => {}).then(async () => {
    const store = await loadStore()
    const result = await update(store)
    await saveStore(store)
    return result
  })
  storeMutationQueue = run.then(() => undefined, () => undefined)
  return run
}

export async function listSharedTemplates(): Promise<{ ok: boolean; templates: SharedTemplate[]; error?: string }> {
  const store = await currentStore()
  try {
    return { ok: true, templates: await Promise.all(store.templates.map(async (template) => ({ ...template, json: await bodyOf(template) }))) }
  } catch {
    return { ok: false, templates: [], error: '共享模板内容损坏或丢失' }
  }
}

export async function publishSharedTemplate(name: string, json: string, author: string): Promise<{ ok: boolean; error?: string; id?: string }> {
  return withStoreMutation(async (store) => {
    const cleanName = String(name || '未命名模板').trim() || '未命名模板'
    const existing = store.templates.find((template) => template.name === cleanName)
    const currentBytes = (await Promise.all(store.templates.map(async (item) => Buffer.byteLength(await bodyOf(item), 'utf8')))).reduce((sum, value) => sum + value, 0)
    const existingBytes = existing ? Buffer.byteLength(await bodyOf(existing), 'utf8') : 0
    const nextBytes = currentBytes - existingBytes + Buffer.byteLength(json, 'utf8')
    if (!existing && store.templates.length >= MAX_SHARED_TEMPLATES) return { ok: false, error: `共享模板最多 ${MAX_SHARED_TEMPLATES} 个` }
    if (nextBytes > MAX_SHARED_TEMPLATE_BYTES) return { ok: false, error: '共享模板总容量超过 256 MB' }
    const id = existing?.id ?? randomUUID()
    await writeBlob(id, json)
    if (existing) {
      Object.assign(existing, { author, updatedAt: new Date().toISOString() })
      return { ok: true, id: existing.id }
    }
    const template: StoredSharedTemplate = { id, name: cleanName, author, updatedAt: new Date().toISOString() }
    store.templates.push(template)
    return { ok: true, id: template.id }
  })
}

export async function loadSharedTemplate(id: string): Promise<{ ok: boolean; error?: string; data?: { name: string; json: string } }> {
  const template = (await currentStore()).templates.find((item) => item.id === id)
  if (!template) return { ok: false, error: '模板不存在' }
  try { return { ok: true, data: { name: template.name, json: await bodyOf(template) } } }
  catch { return { ok: false, error: '共享模板内容损坏或丢失' } }
}

export async function deleteSharedTemplate(id: string): Promise<{ ok: boolean; error?: string }> {
  return withStoreMutation((store) => {
    const next = store.templates.filter((item) => item.id !== id)
    if (next.length === store.templates.length) return { ok: false, error: '模板不存在' }
    store.templates = next
    return { ok: true }
  })
}
