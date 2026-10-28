import { useCallback, useState } from 'react'

export interface RecentTemplate {
  name: string
  path?: string
}

/** Renderer-local mirror of the original app's RecentFile table. */
export interface RecentFileRecord {
  title?: string
  name?: string
  path?: string
  updatetime?: string
  state?: number
}

const STORAGE_KEY = 'maxlabel.recent'

/**
 * 解析「最近的文件」记录。
 *
 * 只保留带路径的条目：当前版本写入时一定带路径（见 `addRecent` 的调用方），
 * 没有路径的记录都是旧版本留下的，点击只会弹「打开」对话框，不构成可打开的最近项。
 */
export function parseRecentRecords(raw: unknown): RecentTemplate[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is RecentFileRecord => Boolean(
      item &&
      typeof item === 'object' &&
      typeof (item.title ?? item.name) === 'string' &&
      String(item.title ?? item.name).trim()
    ))
    .filter((item) => item.state !== 1)
    .map((item) => ({
      name: String(item.title ?? item.name).trim().slice(0, 255),
      path: typeof item.path === 'string' && item.path.trim() ? item.path.trim().slice(0, 4096) : undefined
    }))
    .filter((item): item is RecentTemplate & { path: string } => Boolean(item.path))
    .slice(0, 10)
}

function readRecentTemplates(): RecentTemplate[] {
  try {
    return parseRecentRecords(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'))
  } catch {
    return []
  }
}

function recentKey(item: RecentTemplate): string {
  return item.path?.trim().toLowerCase() || `name:${item.name.trim().toLowerCase()}`
}

export function useRecentTemplates() {
  const [recents, setRecents] = useState<RecentTemplate[]>(readRecentTemplates)
  const addRecent = useCallback((name: string, path?: string) => {
    setRecents((current) => {
      const nextItem = { name, path }
      const next = [nextItem, ...current.filter((item) => recentKey(item) !== recentKey(nextItem))].slice(0, 10)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next.map((item) => ({
          title: item.name,
          path: item.path,
          updatetime: new Date().toISOString(),
          state: 0
        }))))
      } catch { /* 配额不足时仍保留当前会话最近项。 */ }
      return next
    })
  }, [])
  return { recents, addRecent }
}
