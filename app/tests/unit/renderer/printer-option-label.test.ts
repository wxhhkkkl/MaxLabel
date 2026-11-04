import { describe, expect, it } from 'vitest'
import { translate } from '@shared/i18n/translate'
import { systemDefaultOptionLabel } from '@/features/printing/printerOptionLabel'

/**
 * 打印机下拉的空取值项表示「跟随系统默认打印」。
 * 它的文案必须点明「系统默认」，否则会与真实的 Windows 队列条目同名 ——
 * 现场表现为新建标签后下拉里出现两条一模一样的「Zenpert 4T530」。
 */
describe('打印面板的「系统默认」选项文案', () => {
  const zh = (key: string, params?: Record<string, string | number>) => translate('zh-CN', key, params)

  it('已知系统默认打印机时带上名字', () => {
    const printers = [
      { name: 'Microsoft Print to PDF', displayName: 'Microsoft Print to PDF' },
      { name: 'Zenpert 4T530', displayName: 'Zenpert 4T530', isDefault: true }
    ]
    expect(systemDefaultOptionLabel(printers, zh)).toBe('系统默认打印机（Zenpert 4T530）')
  })

  it('没有默认标记时退回通用文案', () => {
    expect(systemDefaultOptionLabel([{ name: 'A', displayName: 'A' }], zh)).toBe('系统默认打印机')
    expect(systemDefaultOptionLabel([], zh)).toBe('系统默认打印机')
  })
})
