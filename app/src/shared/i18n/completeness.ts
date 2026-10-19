import { HELP_KEYS, HELP_SECTIONS, type HelpSection } from './help'
import type { Language, MessageCatalog } from './types'

export function placeholderNames(value: string): string[] {
  return [...new Set([...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((match) => match[1]))].sort()
}

/** Static parity check used by tests/CI before release. */
export function catalogIssues(
  zh: MessageCatalog,
  en: MessageCatalog,
  helpSections: Record<Language, HelpSection[]> = HELP_SECTIONS
): string[] {
  const issues: string[] = []
  const keys = new Set([...Object.keys(zh), ...Object.keys(en)])
  for (const key of keys) {
    const zhValue = zh[key]
    const enValue = en[key]
    if (zhValue === undefined) issues.push(`missing zh-CN key: ${key}`)
    if (enValue === undefined) issues.push(`missing en-US key: ${key}`)
    if (zhValue !== undefined && !zhValue.trim()) issues.push(`empty zh-CN value: ${key}`)
    if (enValue !== undefined && !enValue.trim()) issues.push(`empty en-US value: ${key}`)
    if (zhValue?.trim() && enValue?.trim()) {
      const zhParams = placeholderNames(zhValue).join(',')
      const enParams = placeholderNames(enValue).join(',')
      if (zhParams !== enParams) issues.push(`placeholder mismatch: ${key} (${zhParams} vs ${enParams})`)
    }
  }

  for (const language of ['zh-CN', 'en-US'] as const) {
    const sections = helpSections[language]
    if (!Array.isArray(sections)) {
      issues.push(`help:${language}: missing sections`)
      continue
    }
    const byKey = new Map(sections.map((section) => [section.key, section]))
    for (const key of HELP_KEYS) {
      const section = byKey.get(key)
      if (!section) {
        issues.push(`help:${language}: missing ${key}`)
        continue
      }
      if (!section.title.trim()) issues.push(`help:${language}:${key}: empty title`)
      if (!section.intro.trim()) issues.push(`help:${language}:${key}: empty intro`)
      if (!section.items.length) issues.push(`help:${language}:${key}: no items`)
      section.items.forEach((item, index) => {
        if (!item.t.trim()) issues.push(`help:${language}:${key}:${index}: empty item title`)
        if (!item.d.trim()) issues.push(`help:${language}:${key}:${index}: empty item body`)
      })
    }
    for (const section of sections) {
      if (!HELP_KEYS.includes(section.key)) issues.push(`help:${language}: unexpected section ${section.key}`)
    }
  }

  for (const key of HELP_KEYS) {
    const zhSection = helpSections['zh-CN']?.find((section) => section.key === key)
    const enSection = helpSections['en-US']?.find((section) => section.key === key)
    if (zhSection && enSection && zhSection.items.length !== enSection.items.length) {
      issues.push(`help:${key}: item count ${zhSection.items.length} vs ${enSection.items.length}`)
    }
  }
  return issues
}
