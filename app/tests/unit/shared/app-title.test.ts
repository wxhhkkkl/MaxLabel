import { describe, expect, it } from 'vitest'
import { composeWindowTitle } from '@shared/appTitle'

const base = { productName: 'MaxLabel', version: '1.0.22', language: 'zh-CN' as const }

describe('window title composition', () => {
  it('shows activation, login, version and the current document', () => {
    expect(composeWindowTitle({ ...base, activated: true, loginEmail: 'user@example.com', documentTitle: '标签A' }))
      .toBe('MaxLabel [已激活] V1.0.22 (user@example.com) - 标签A')
  })

  it('falls back to the signed-out hint and the start page', () => {
    expect(composeWindowTitle({ ...base, activated: false, loginEmail: null, documentTitle: null }))
      .toBe('MaxLabel [未激活] V1.0.22 (请登录 LabelShop) - 起始页')
  })

  it('localises the segments for English', () => {
    expect(composeWindowTitle({ ...base, language: 'en-US', activated: true, loginEmail: 'user@example.com', documentTitle: 'Label A' }))
      .toBe('MaxLabel [Activated] V1.0.22 (user@example.com) - Label A')
  })

  it('omits the version segment when the version is empty and defaults the product name', () => {
    expect(composeWindowTitle({ ...base, productName: ' ', version: '', activated: false, loginEmail: null, documentTitle: null }))
      .toBe('MaxLabel [未激活] (请登录 LabelShop) - 起始页')
  })
})
