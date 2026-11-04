import { describe, expect, it } from 'vitest'
import { printerSettingsEntry, windowsDriverPrinterName } from '@/features/printers/windowsDriverSettings'

describe('Windows 驱动打印设置入口', () => {
  it('只有驱动端口才返回打印机名', () => {
    expect(windowsDriverPrinterName({ printerName: 'A', port: { type: 'usb' } }, [])).toBeUndefined()
    expect(windowsDriverPrinterName({ printerName: 'A', port: { type: 'driver' } }, [])).toBe('A')
  })

  it('模板未指定打印机时退回系统默认打印机', () => {
    const installed = [{ name: 'B' }, { name: 'C', isDefault: true }]
    expect(windowsDriverPrinterName({ port: { type: 'driver' } }, installed)).toBe('C')
    expect(windowsDriverPrinterName({ port: { type: 'driver' } }, [{ name: 'B' }])).toBe('B')
    expect(windowsDriverPrinterName({ port: { type: 'driver' } }, [])).toBeUndefined()
  })
})

/**
 * 打印面板「设置」按钮：Windows 打印队列交给 Windows 自己的属性对话框，
 * MaxLabel 安装的内置驱动打印机 / TCP、COM 等直连端口仍用应用内设置页。
 */
describe('打印面板「设置」按钮的目标', () => {
  const queue = [{ name: 'Zenpert 4T530', isDefault: true }, { name: 'Microsoft Print to PDF' }]

  it('驱动端口且队列存在 → 系统打印机属性对话框', () => {
    expect(printerSettingsEntry({ printerName: 'Zenpert 4T530', port: { type: 'driver' } }, queue))
      .toEqual({ kind: 'windows', printerName: 'Zenpert 4T530' })
  })

  it('模板未指定打印机时用系统默认队列', () => {
    expect(printerSettingsEntry({ port: { type: 'driver' } }, queue))
      .toEqual({ kind: 'windows', printerName: 'Zenpert 4T530' })
  })

  it('内置驱动打印机（USB 端口）→ 应用内打印机设置页', () => {
    expect(printerSettingsEntry({ printerName: 'TSC TSPL-N (203 dpi)', port: { type: 'usb' } }, queue))
      .toEqual({ kind: 'app' })
  })

  it('直连端口（TCP/COM/文件）→ 应用内打印机设置页', () => {
    expect(printerSettingsEntry({ printerName: 'Zenpert 4T530', port: { type: 'tcp' } }, queue))
      .toEqual({ kind: 'app' })
  })

  it('打印机名不在本机队列 → 回到应用内设置页修正配置，不弹 Windows 错误框', () => {
    expect(printerSettingsEntry({ printerName: '客户电脑上的 TSC TX600', port: { type: 'driver' } }, queue))
      .toEqual({ kind: 'app' })
  })

  it('没有枚举到队列时不打开 Windows 设置', () => {
    expect(printerSettingsEntry({ port: { type: 'driver' } }, [])).toEqual({ kind: 'app' })
  })
})
