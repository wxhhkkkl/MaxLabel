import type { Language } from './types'

/** First-launch default: English for `en*`, Chinese for `zh*` and every other locale. */
export function detectLanguage(navigatorLanguage: string | undefined): Language {
  const value = (navigatorLanguage ?? '').trim().toLowerCase()
  return value.startsWith('en') ? 'en-US' : 'zh-CN'
}

export function detectBrowserLanguage(): Language {
  return detectLanguage(typeof navigator === 'undefined' ? undefined : navigator.language)
}
