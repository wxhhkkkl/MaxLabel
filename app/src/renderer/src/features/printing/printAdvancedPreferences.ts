import {
  DEFAULT_PRINT_ADVANCED,
  normalizePrintAdvanced,
  type PrintAdvancedSettings
} from '../../../../shared/domain/printSettings'

export const PRINT_ADVANCED_STORAGE_KEY = 'maxlabel.print-advanced.v1'

/** 高级打印选项的默认值（与打印对话框一致）——也是没有随模板保存该字段时的兜底。 */
export function defaultPrintAdvanced(): PrintAdvancedSettings {
  return { ...DEFAULT_PRINT_ADVANCED }
}

export function loadPrintAdvanced(): PrintAdvancedSettings {
  try {
    const raw = globalThis.localStorage?.getItem(PRINT_ADVANCED_STORAGE_KEY)
    return (raw ? normalizePrintAdvanced(JSON.parse(raw)) : undefined) ?? defaultPrintAdvanced()
  } catch {
    return defaultPrintAdvanced()
  }
}

export function savePrintAdvanced(value: PrintAdvancedSettings): void {
  try {
    globalThis.localStorage?.setItem(PRINT_ADVANCED_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // 设置持久化失败不能影响打印。
  }
}
