import { useCallback, useState } from 'react'

export interface RecentTemplate {
  name: string
  path?: string
}

/** Renderer-local mirror of LabelShop's RecentFile table. */
export interface RecentFileRecord {
  title?: string
  name?: string
  path?: string
  updatetime?: string
  state?: number
}

const STORAGE_KEY = 'maxlabel.recent'

function readRecentTemplates(): RecentTemplate[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
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
      .slice(0, 10)
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
