import { enUS } from './messages.en-US'
import { zhCN } from './messages.zh-CN'
import type { Language, LocalizedIpcErrorLike, MessageCatalog, MessageParams } from './types'

export const CATALOGS: Record<Language, MessageCatalog> = {
  'zh-CN': zhCN,
  'en-US': enUS
}

const missingTranslations = new Set<string>()

export function normalizeLanguage(value: unknown): Language {
  return value === 'en-US' ? 'en-US' : 'zh-CN'
}

export function interpolate(value: string, params?: MessageParams): string {
  if (!params) return value
  return value.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  )
}

function pick(catalog: MessageCatalog | undefined, key: string): string | undefined {
  const value = catalog?.[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

/** Translate from an explicit catalog pair; used by tests and the completeness checker. */
export function translateFrom(
  catalogs: Record<Language, MessageCatalog>,
  language: Language,
  key: string,
  params?: MessageParams
): string {
  const value = pick(catalogs[language], key) ?? pick(catalogs['zh-CN'], key)
  if (!value) {
    missingTranslations.add(`${language}:${key}`)
    return key
  }
  return interpolate(value, params)
}

export function translate(language: Language | string, key: string, params?: MessageParams): string {
  return translateFrom(CATALOGS, normalizeLanguage(language), key, params)
}

/** Resolve an optional IPC message key, falling back to the raw message. */
export function localizeIpcMessage(language: Language | string, error: LocalizedIpcErrorLike): string {
  if (error.messageKey) {
    const translated = translateFrom(CATALOGS, normalizeLanguage(language), error.messageKey, error.messageParams)
    if (translated !== error.messageKey) return translated
  }
  return error.message
}

export function getMissingTranslations(): string[] {
  return [...missingTranslations]
}

export function resetMissingTranslations(): void {
  missingTranslations.clear()
}
