import { describe, expect, it } from 'vitest'
import { normalizeAppOptions } from '@/dialogs/OptionsDialog'
import { detectLanguage } from '@shared/i18n/detect'

describe('language options', () => {
  it('accepts en-US and normalizes unknown values to zh-CN', () => {
    expect(normalizeAppOptions({ language: 'en-US' }).language).toBe('en-US')
    expect(normalizeAppOptions({ language: 'zh-CN' }).language).toBe('zh-CN')
    expect(normalizeAppOptions({ language: 'fr-FR' as never }).language).toBe('zh-CN')
    expect(normalizeAppOptions({}).language).toBe('zh-CN')
  })

  it('detects English and Chinese OS locales and defaults to Chinese', () => {
    expect(detectLanguage('en-US')).toBe('en-US')
    expect(detectLanguage('en-GB')).toBe('en-US')
    expect(detectLanguage('zh-CN')).toBe('zh-CN')
    expect(detectLanguage('zh-Hans')).toBe('zh-CN')
    expect(detectLanguage('fr-FR')).toBe('zh-CN')
    expect(detectLanguage(undefined)).toBe('zh-CN')
  })
})
