import { describe, expect, it } from 'vitest'
import { effectiveStartLabel } from '@/features/printing/startSlot'

describe('打印起始槽位', () => {
  it('只有 Windows 驱动打印才使用起始标签', () => {
    expect(effectiveStartLabel('driver', 3)).toBe(3)
  })

  it('命令直连忽略残留的起始标签，从第 1 枚开始', () => {
    for (const port of ['usb', 'tcp', 'com', 'bluetooth', 'file', 'lpt', 'cloudbox'] as const) {
      expect(effectiveStartLabel(port, 2)).toBe(1)
    }
  })
})
