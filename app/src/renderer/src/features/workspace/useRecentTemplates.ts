import { useCallback, useState } from 'react'

export interface RecentTemplate {
  name: string
  path?: string
}

const STORAGE_KEY = 'maxlabel.recent'

function readRecentTemplates(): RecentTemplate[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is RecentTemplate => Boolean(item && typeof item === 'object' && typeof item.name === 'string' && item.name.trim()))
      .map((item) => ({ name: item.name.trim().slice(0, 255), path: typeof item.path === 'string' && item.path.trim() ? item.path.trim().slice(0, 4096) : undefined }))
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
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* 配额不足时仍保留当前会话最近项。 */ }
      return next
    })
  }, [])
  return { recents, addRecent }
}
