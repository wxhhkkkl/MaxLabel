import { useEffect, useState } from 'react'
import { FONTS, mergeFontOptions } from './fontList'

let cached: string[] | null = null
let pending: Promise<string[]> | null = null

function loadFonts(): Promise<string[]> {
  if (cached) return Promise.resolve(cached)
  if (typeof window === 'undefined' || !window.maxlabel?.listFonts) return Promise.resolve([...FONTS])
  pending ??= window.maxlabel.listFonts()
    .then((result) => (result.ok ? mergeFontOptions(result.fonts ?? []) : [...FONTS]))
    .catch(() => [...FONTS])
  return pending.then((fonts) => {
    cached = fonts
    return fonts
  })
}

/** 字体下拉的候选：固定清单在前，其后是本机系统字族（整个进程只枚举一次）。 */
export function useSystemFonts(): string[] {
  const [fonts, setFonts] = useState<string[]>(() => cached ?? FONTS)
  useEffect(() => {
    let alive = true
    void loadFonts().then((next) => {
      if (alive) setFonts(next)
    })
    return () => {
      alive = false
    }
  }, [])
  return fonts
}
