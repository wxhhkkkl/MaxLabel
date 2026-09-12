import { app } from 'electron'
import { randomUUID } from 'crypto'
import { mkdir, realpath, rename, rm, writeFile } from 'fs/promises'
import { basename, dirname, join, relative, resolve } from 'path'
import { readBoundedFile } from './validation'

type PathScope = 'read' | 'write'
interface PathAccessStore { files: Record<string, { read?: boolean; write?: boolean }>; roots: Record<string, { read?: boolean; write?: boolean }> }

let loaded: PathAccessStore | undefined
let pendingSave: Promise<void> = Promise.resolve()

function storePath(): string { return resolve(app.getPath('userData'), 'path-access.json') }
function emptyStore(): PathAccessStore { return { files: {}, roots: {} } }

async function load(): Promise<PathAccessStore> {
  if (loaded) return loaded
  try {
    const parsed = JSON.parse((await readBoundedFile(storePath(), 4 * 1024 * 1024)).toString('utf8')) as Partial<PathAccessStore>
    loaded = {
      files: parsed.files && typeof parsed.files === 'object' ? parsed.files : {},
      roots: parsed.roots && typeof parsed.roots === 'object' ? parsed.roots : {}
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') loaded = emptyStore()
    else throw new Error('文件访问授权记录损坏，请检查应用数据目录')
  }
  return loaded
}

async function persist(store: PathAccessStore): Promise<void> {
  const target = storePath()
  const temporary = `${target}.${randomUUID()}.tmp`
  try {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(temporary, JSON.stringify(store, null, 2), 'utf8')
    await rename(temporary, target)
  } finally {
    await rm(temporary, { force: true }).catch(() => {})
  }
}

function inside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate)
  return rel === '' || (!rel.startsWith('..') && !rel.includes(`..${process.platform === 'win32' ? '\\' : '/'}`))
}

async function canonicalPath(path: string, root: boolean): Promise<string> {
  const target = resolve(path)
  try { return await realpath(target) }
  catch {
    // Save dialogs may grant a not-yet-created file; canonicalize its parent.
    if (root) return target
    try { return join(await realpath(dirname(target)), basename(target)) }
    catch { return target }
  }
}

/** Record a path selected through a native dialog as a capability for later renderer requests. */
export async function grantPath(path: string, scopes: PathScope[], root = false): Promise<void> {
  const store = await load()
  const key = await canonicalPath(path, root)
  const target = root ? store.roots : store.files
  target[key] = { ...(target[key] ?? {}), ...Object.fromEntries(scopes.map((scope) => [scope, true])) }
  // Recover the queue after a transient disk error. A rejected promise must
  // not poison every future file-dialog grant until the app is restarted.
  pendingSave = pendingSave.catch(() => {}).then(() => persist(store))
  await pendingSave
}

export async function assertPathAccess(path: string, scope: PathScope): Promise<string> {
  const store = await load()
  const key = await canonicalPath(path, false)
  if (store.files[key]?.[scope]) return key
  for (const [root, access] of Object.entries(store.roots)) {
    if (access[scope] && inside(resolve(root), key)) return key
  }
  throw new Error(`未获得该路径的${scope === 'read' ? '读取' : '写入'}授权，请通过系统文件对话框重新选择`)
}

export async function grantTemplateDirectory(path: string): Promise<void> {
  await grantPath(dirname(resolve(path)), ['read'], true)
}
