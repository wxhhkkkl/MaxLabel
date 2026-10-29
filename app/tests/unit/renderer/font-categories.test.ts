import { describe, expect, it } from 'vitest'
import { initialFontCategory, printerFontNotice, printerFontOptions } from '@/features/object-properties/fontCategories'

describe('字体类别 → 字体清单', () => {
  it('TSPL 驱动列出 Font0–Font8', () => {
    expect(printerFontOptions('tspl')).toEqual([
      'Font0', 'Font1', 'Font2', 'Font3', 'Font4', 'Font5', 'Font6', 'Font7', 'Font8'
    ])
  })

  it('ZPL 驱动列出 A–Z 与 0', () => {
    const options = printerFontOptions('zpl')
    expect(options).toHaveLength(27)
    expect(options[0]).toBe('A')
    expect(options[25]).toBe('Z')
    expect(options[26]).toBe('0')
    expect(options).not.toContain('Font0')
  })

  it('CPCL / ESC-POS / 未指定驱动时没有内建字库', () => {
    expect(printerFontOptions('cpcl')).toEqual([])
    expect(printerFontOptions('escpos')).toEqual([])
    expect(printerFontOptions(undefined)).toEqual([])
  })

  it('已绑定打印机字体的文本初始类别为「打印机自建」，否则为「系统」', () => {
    expect(initialFontCategory('Font3')).toBe('printer')
    expect(initialFontCategory('A')).toBe('printer')
    expect(initialFontCategory(undefined)).toBe('system')
    expect(initialFontCategory('')).toBe('system')
  })

  it('Windows 驱动端口下打印机内建字体不生效，提示换直连端口', () => {
    expect(printerFontNotice('driver', 'tspl')).toBe('driver-port')
    expect(printerFontNotice('driver', 'zpl')).toBe('driver-port')
  })

  it('指令直连端口（TCP / USB / COM / 蓝牙 / 云盒 / 文件）按驱动给字库', () => {
    expect(printerFontNotice('tcp', 'tspl')).toBe('ready')
    expect(printerFontNotice('usb', 'zpl')).toBe('ready')
    expect(printerFontNotice('com', 'tspl')).toBe('ready')
    expect(printerFontNotice('file', 'tspl')).toBe('ready')
  })

  it('直连端口但驱动没有内建字库（CPCL / ESC-POS）时单独提示', () => {
    expect(printerFontNotice('tcp', 'cpcl')).toBe('no-builtin-fonts')
    expect(printerFontNotice('tcp', 'escpos')).toBe('no-builtin-fonts')
    expect(printerFontNotice('tcp', undefined)).toBe('no-builtin-fonts')
  })
})
