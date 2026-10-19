import { describe, expect, it } from 'vitest'
import { getMissingTranslations, normalizeLanguage, resetMissingTranslations, translate, translateFrom } from '@shared/i18n/translate'

const catalogs = {
  'zh-CN': { greet: '你好，{name}', onlyZh: '仅中文', empty: '' },
  'en-US': { greet: 'Hello, {name}', onlyZh: '', empty: '' }
}

describe('i18n translate', () => {
  it('normalizes the two supported languages and falls back to Chinese', () => {
    expect(normalizeLanguage('en-US')).toBe('en-US')
    expect(normalizeLanguage('zh-CN')).toBe('zh-CN')
    expect(normalizeLanguage('fr-FR')).toBe('zh-CN')
    expect(normalizeLanguage(undefined)).toBe('zh-CN')
  })

  it('interpolates named parameters', () => {
    expect(translateFrom(catalogs, 'en-US', 'greet', { name: 'Max' })).toBe('Hello, Max')
    expect(translateFrom(catalogs, 'zh-CN', 'greet', { name: 'Max' })).toBe('你好，Max')
    expect(translateFrom(catalogs, 'en-US', 'greet')).toBe('Hello, {name}')
  })

  it('falls back to Chinese for empty or missing values and then to the key', () => {
    expect(translateFrom(catalogs, 'en-US', 'onlyZh')).toBe('仅中文')
    expect(translateFrom(catalogs, 'en-US', 'empty')).toBe('empty')
    expect(translateFrom(catalogs, 'en-US', 'missing.key')).toBe('missing.key')
  })

  it('uses the shipped catalogs', () => {
    expect(translate('en-US', 'common.ok')).toBe('OK')
    expect(translate('zh-CN', 'common.ok')).toBe('确定')
    expect(translate('en-US', 'common.pageOf', { page: 2, total: 5 })).toBe('Page 2 of 5')
  })

  it('records missing keys for the completeness report', () => {
    resetMissingTranslations()
    translate('en-US', 'missing.key')
    expect(getMissingTranslations()).toContain('en-US:missing.key')
  })
})
