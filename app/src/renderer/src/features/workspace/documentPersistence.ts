export function canonicalDocumentPath(path: string): string {
  const parts: string[] = []
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (part === '.') continue
    if (part === '..' && parts.length && parts[parts.length - 1] !== '..') parts.pop()
    else parts.push(part)
  }
  return parts.join('/').toLowerCase()
}

export class DocumentSaveQueue {
  private readonly pending = new Map<string, Promise<unknown>>()

  async run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this.pending.get(key) ?? Promise.resolve()
    const task = previous.catch(() => {}).then(work)
    this.pending.set(key, task)
    try {
      return await task
    } finally {
      if (this.pending.get(key) === task) this.pending.delete(key)
    }
  }
}

export function assertDocumentSavePathAvailable(tabs: ReadonlyArray<{ key: string; path?: string }>, owner: string, path: string): void {
  const target = canonicalDocumentPath(path)
  if (tabs.some((tab) => tab.key !== owner && tab.path && canonicalDocumentPath(tab.path) === target)) {
    throw new Error('该文件已在其他标签中打开，请切换到该标签保存或选择其他文件名')
  }
}

export function savedTemplatePath(result: { canceled?: boolean; ok?: boolean; message?: string; filePath?: string }): string | null {
  if (result.canceled) return null
  if (result.ok === false || result.message) throw new Error(result.message ?? '保存失败')
  if (!result.filePath) throw new Error('保存失败：未返回保存路径')
  return result.filePath
}

export async function confirmDocumentClosures<T extends { key: string; revision: number }>(keys: string[], read: () => T[], confirm: (tab: T) => Promise<boolean>): Promise<Set<string> | null> {
  const revisions = new Map<string, number>()
  for (const key of keys) {
    const tab = read().find((item) => item.key === key)
    if (!tab) continue
    if (!(await confirm(tab))) return null
    const latest = read().find((item) => item.key === key)
    if (latest) revisions.set(key, latest.revision)
  }
  // Earlier approved tabs may have changed while a later dialog was open.
  if (read().some((tab) => revisions.has(tab.key) && revisions.get(tab.key) !== tab.revision)) return null
  return new Set(revisions.keys())
}
