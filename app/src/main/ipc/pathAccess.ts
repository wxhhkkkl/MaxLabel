import { realpath } from 'fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'path'
import { readSecureJson, updateSecureJson } from '../secureJsonStore'

type PathScope = 'read' | 'write'
type Grants = Record<string, { read?: boolean; write?: boolean }>
interface PathAccessStore { files: Grants; roots: Grants }

const FILE = 'path-access.json'
const CORRUPT = '文件访问授权记录损坏，请检查应用数据目录'
function emptyStore(): PathAccessStore { return { files: {}, roots: {} } }

function grants(value: Grants | undefined): Grants {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function inside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate)
  return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)
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
  const key = await canonicalPath(path, root)
  await updateSecureJson(FILE, emptyStore(), CORRUPT, (store) => {
    const kind = root ? 'roots' : 'files'
    const target = store[kind] = grants(store[kind])
    target[key] = { ...target[key], ...Object.fromEntries(scopes.map((scope) => [scope, true])) }
  })
}

export async function assertPathAccess(path: string, scope: PathScope): Promise<string> {
  const store = await readSecureJson(FILE, emptyStore(), CORRUPT)
  const key = await canonicalPath(path, false)
  if (grants(store.files)[key]?.[scope]) return key
  for (const [root, access] of Object.entries(grants(store.roots))) {
    if (access?.[scope] && inside(resolve(root), key)) return key
  }
  throw Object.assign(new Error(`未获得该路径的${scope === 'read' ? '读取' : '写入'}授权，请通过系统文件对话框重新选择`), { messageKey: 'error.fileAccess' })
}

export async function grantTemplateDirectory(path: string): Promise<void> {
  await grantPath(dirname(resolve(path)), ['read'], true)
}
