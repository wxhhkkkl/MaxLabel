import { describe, expect, it } from 'vitest'
import { HELP_SECTIONS, type HelpSection } from '@shared/i18n/help'
import { zhCN } from '@shared/i18n/messages.zh-CN'
import { enUS } from '@shared/i18n/messages.en-US'
import { catalogIssues, placeholderNames } from '@shared/i18n/completeness'
import type { Language, MessageCatalog } from '@shared/i18n/types'

const help = (): Record<Language, HelpSection[]> => ({
  'zh-CN': HELP_SECTIONS['zh-CN'].map((section) => ({ ...section, items: section.items.map((item) => ({ ...item })) })),
  'en-US': HELP_SECTIONS['en-US'].map((section) => ({ ...section, items: section.items.map((item) => ({ ...item })) }))
})

describe('catalog completeness', () => {
  it('accepts the shipped catalogs and help sections', () => {
    expect(catalogIssues(zhCN, enUS, HELP_SECTIONS)).toEqual([])
  })

  it('reports missing, empty and placeholder-mismatched values', () => {
    const zh: MessageCatalog = { a: '甲', b: '乙 {name}', c: '丙' }
    const en: MessageCatalog = { a: '', b: 'B {value}', d: 'D' }
    const issues = catalogIssues(zh, en, help())
    expect(issues.some((issue) => issue.includes('a'))).toBe(true)
    expect(issues.some((issue) => issue.includes('b'))).toBe(true)
    expect(issues.some((issue) => issue.includes('c'))).toBe(true)
    expect(issues.some((issue) => issue.includes('d'))).toBe(true)
  })

  it('reports help section topology differences', () => {
    const sections = help()
    sections['en-US'][0].items.pop()
    sections['en-US'][1].title = ' '
    const issues = catalogIssues(zhCN, enUS, sections)
    expect(issues.some((issue) => issue.includes('help:'))).toBe(true)
  })

  it('extracts sorted unique placeholder names', () => {
    expect(placeholderNames('{b} {a} {b}')).toEqual(['a', 'b'])
  })
})
