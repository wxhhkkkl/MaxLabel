/** 随模板保存的高级打印选项（原版 print_dlg_dbs 一组）。 */
export interface PrintAdvancedSettings {
  autoCount: boolean
  copyField: boolean
  copyFieldName: string
  firstCopyAsk: boolean
  dupcheck: boolean
  currentOnly: boolean
  updateSerial: boolean
  rotate180: boolean
  printBorder: boolean
  trackStartLabel: boolean
  headerFooter: boolean
  headerFooterTemplate: string
  headerFooterOffsetMm: number
  cropMarks: boolean
  cropMarkOffsetMm: number
}

export const DEFAULT_PRINT_ADVANCED: Readonly<PrintAdvancedSettings> = Object.freeze({
  autoCount: false,
  copyField: false,
  copyFieldName: '',
  firstCopyAsk: false,
  dupcheck: false,
  currentOnly: false,
  updateSerial: false,
  rotate180: false,
  printBorder: false,
  trackStartLabel: false,
  headerFooter: false,
  headerFooterTemplate: '&D &T &F - &P',
  headerFooterOffsetMm: 0,
  cropMarks: true,
  cropMarkOffsetMm: -5
})

const BOOLEAN_KEYS = [
  'autoCount', 'copyField', 'firstCopyAsk', 'dupcheck', 'currentOnly',
  'updateSerial', 'rotate180', 'printBorder', 'trackStartLabel',
  'headerFooter', 'cropMarks'
] as const

/** 文档里的高级打印选项归一化；不存在或不是对象时返回 undefined。 */
export function normalizePrintAdvanced(value: unknown): PrintAdvancedSettings | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const next: PrintAdvancedSettings = { ...DEFAULT_PRINT_ADVANCED }
  for (const key of BOOLEAN_KEYS) {
    if (typeof raw[key] === 'boolean') (next as unknown as Record<string, unknown>)[key] = raw[key]
  }
  if (typeof raw.copyFieldName === 'string') next.copyFieldName = raw.copyFieldName.trim().slice(0, 255)
  if (typeof raw.headerFooterTemplate === 'string') next.headerFooterTemplate = raw.headerFooterTemplate.slice(0, 1024)
  if (typeof raw.headerFooterOffsetMm === 'number' && Number.isFinite(raw.headerFooterOffsetMm)) {
    next.headerFooterOffsetMm = Math.max(-1000, Math.min(1000, raw.headerFooterOffsetMm))
  }
  if (typeof raw.cropMarkOffsetMm === 'number' && Number.isFinite(raw.cropMarkOffsetMm)) {
    next.cropMarkOffsetMm = Math.max(-1000, Math.min(1000, raw.cropMarkOffsetMm))
  }
  return next
}
