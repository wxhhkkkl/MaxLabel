import { beforeEach, describe, expect, it } from 'vitest'
import {
  PRINT_ADVANCED_STORAGE_KEY,
  defaultPrintAdvanced,
  loadPrintAdvanced,
  savePrintAdvanced
} from '@/features/printing/printAdvancedPreferences'

function fakeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() { return map.size },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => { map.delete(key) },
    setItem: (key: string, value: string) => { map.set(key, value) }
  }
}

describe('高级打印选项持久化', () => {
  beforeEach(() => {
    ;(globalThis as { localStorage?: Storage }).localStorage = fakeStorage()
  })

  it('没有存储时返回默认值', () => {
    expect(loadPrintAdvanced()).toEqual(defaultPrintAdvanced())
  })

  it('保存后再读取保持选择（含数据库字段名）', () => {
    const value = { ...defaultPrintAdvanced(), copyField: true, copyFieldName: '数量', dupcheck: true }
    savePrintAdvanced(value)
    expect(loadPrintAdvanced()).toEqual(value)
  })

  it('损坏或字段类型不对时回退默认值/忽略非法项', () => {
    globalThis.localStorage.setItem(PRINT_ADVANCED_STORAGE_KEY, '{oops')
    expect(loadPrintAdvanced()).toEqual(defaultPrintAdvanced())
    globalThis.localStorage.setItem(PRINT_ADVANCED_STORAGE_KEY, JSON.stringify({ autoCount: 'yes', copyField: true, copyFieldName: 42 }))
    const loaded = loadPrintAdvanced()
    expect(loaded.autoCount).toBe(false)
    expect(loaded.copyField).toBe(true)
    expect(loaded.copyFieldName).toBe('')
  })
})
