import { defaultPrinterConfig, type DbConnectionConfig, type PrinterConfig } from './printer'
import { COLOR_CHANGE_MODES } from './objects'
import type { BarcodeOptions, ColorChangeConfig, LabelObject } from './objects'
import type { DataSource, Dataset, KeyboardSource, WeighProtocol, WeighUnit } from './datasource'
import type { PaperHoleShape, PaperShape } from './paper'

/** 当前文档模型版本。方向、拼版和打印边界字段已经进入稳定模型 v2。 */
export const DOCUMENT_MODEL_VERSION = 2

export type PageOrientation = 0 | 90 | 180 | 270

export interface LabelDoc {
  version: number
  name: string
  /** System preset formats keep page settings read-only; custom formats may edit them. */
  formatKind?: 'preset' | 'custom'
  widthMm: number
  heightMm: number
  objects: LabelObject[]
  printer?: PrinterConfig
  datasets?: Record<string, Dataset>
  connections?: Record<string, DbConnectionConfig>
  remark?: string
  /** LabelShop-compatible template-level lifecycle script. */
  globalScript?: string
  keyboardOrder?: string[]
  layout?: {
    rows: number
    cols: number
    rowGapMm: number
    colGapMm: number
    shape: PaperShape
    pageWidthMm?: number
    pageHeightMm?: number
    pagesPerBox?: number
    cornerRadiusMm?: number
  /** 帮助 label_page_page.html：标签纸颜色，只在编辑标签时显示，不输出底色。 */
  labelColor?: string
    innerDiameterMm?: number
    /** 孔洞形状：真机「孔洞」三项 无/圆洞/矩形 的后两项。缺省 = 圆洞（历史模板语义）。 */
    innerShape?: PaperHoleShape
    printOrder?: 'row' | 'col'
    labelPrintDirection?: 'ltr' | 'rtl'
    startPos?: 'tl' | 'tr' | 'bl' | 'br'
    offsetXMm?: number
    offsetYMm?: number
    /** 垃圾/页面左边距：标签阵列在页面里的起点（真机「标签格式设置 → 页面」的左空/上空）。 */
    pageLeftMm?: number
    pageTopMm?: number
  }
  orientation?: PageOrientation
  thumb?: string
  colorIndexTable?: string[]
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeOrientation(value: unknown): PageOrientation {
  const angle = typeof value === 'number' && Number.isFinite(value) ? value : 0
  const normalized = ((Math.round(angle / 90) * 90) % 360 + 360) % 360
  return normalized as PageOrientation
}

export const MAX_DATASET_COLUMNS = 1000
export const MAX_DATASET_ROWS = 100000
export const MAX_DATASET_CELL_LENGTH = 1024 * 1024
export const MAX_DOCUMENT_OBJECTS = 10000
export const MAX_DOCUMENT_GROUP_DEPTH = 32
export const MAX_DOCUMENT_DATASETS = 1000

export function normalizeDataset(value: unknown, name: string): Dataset {
  if (!isRecord(value)) throw new Error(`数据集“${name}”格式无效`)
  const rawColumns = Array.isArray(value.columns) ? value.columns.map(String) : []
  const usedColumns = new Map<string, number>()
  const columns = rawColumns.map((raw, index) => {
    const base = raw.trim() || `列${index + 1}`
    const count = (usedColumns.get(base) ?? 0) + 1
    usedColumns.set(base, count)
    return count === 1 ? base : `${base}_${count}`
  })
  if (columns.length > MAX_DATASET_COLUMNS || columns.some((column) => column.length > 4096) || !Array.isArray(value.rows) || value.rows.length > MAX_DATASET_ROWS) throw new Error(`数据集“${name}”规模无效`)
  const rows = value.rows.map((row) => {
    if (!Array.isArray(row)) throw new Error(`数据集“${name}”记录格式无效`)
    if (row.length > MAX_DATASET_COLUMNS) throw new Error(`数据集“${name}”字段数量无效`)
    return columns.map((_, index) => {
      const cell = String(row[index] ?? '')
      if (cell.length > MAX_DATASET_CELL_LENGTH) throw new Error(`数据集“${name}”单元格过大`)
      return cell
    })
  })
  const datasetName = boundedString(value.name, name, 255, `数据集“${name}”.name`)
  return { name: datasetName || name, columns, rows }
}

/** Remove connection secrets before a document is persisted or uploaded. */
export function redactDocumentSecrets(doc: LabelDoc): LabelDoc {
  if (!doc.connections) return doc
  const connections = Object.fromEntries(Object.entries(doc.connections).map(([id, connection]) => {
    const { password: _password, ...safe } = connection
    return [id, safe]
  }))
  return { ...doc, connections }
}

function boundedString(value: unknown, fallback: string, maxLength: number, path: string): string {
  if (value === undefined || value === null) return fallback
  if (typeof value !== 'string' || value.length > maxLength) throw new Error(`${path}格式无效`)
  return value
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number, path: string): number {
  const n = value === undefined ? fallback : finite(value, fallback)
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${path}超出范围`)
  return n
}

function optionalString(value: unknown, maxLength: number, path: string, trim = false): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || value.length > maxLength) throw new Error(`${path}格式无效`)
  const result = trim ? value.trim() : value
  return result || undefined
}

function normalizeDataSource(value: unknown, path: string): DataSource {
  if (!isRecord(value) || typeof value.kind !== 'string') return { kind: 'constant', value: '' }
  const sharedName = value.sharedName === undefined
    ? {}
    : { sharedName: boundedString(value.sharedName, '', 255, `${path}.sharedName`).trim() || undefined }
  switch (value.kind) {
    case 'constant': return { kind: 'constant', value: boundedString(value.value, '', 1024 * 1024, `${path}.value`), ...sharedName }
    case 'serial': return {
      kind: 'serial', prefix: boundedString(value.prefix, '', 1024, `${path}.prefix`),
      start: boundedNumber(value.start, 1, -1e12, 1e12, `${path}.start`),
      step: boundedNumber(value.step, 1, -1e9, 1e9, `${path}.step`),
      digits: Math.floor(boundedNumber(value.digits, 1, 1, 64, `${path}.digits`)),
      current: boundedNumber(value.current, 1, -1e12, 1e12, `${path}.current`),
      ...sharedName,
      ...(value.charset === undefined ? {} : { charset: boundedString(value.charset, '', 256, `${path}.charset`) }),
      repeat: Math.floor(boundedNumber(value.repeat, 1, 1, 1000000, `${path}.repeat`)),
      repeatBasis: value.repeatBasis === 'label' ? 'label' as const : 'record' as const,
      ...(value.resetEachRecord === true ? { resetEachRecord: true } : {}),
      initialValueSource: value.initialValueSource === 'keyboard' || value.initialValueSource === 'database' ? value.initialValueSource : 'default',
      ...(value.initialValueField === undefined ? {} : { initialValueField: boundedString(value.initialValueField, '', 255, `${path}.initialValueField`) })
    }
    case 'date': return { kind: 'date', format: boundedString(value.format, 'yyyy-MM-dd', 128, `${path}.format`), ...sharedName, ...(value.offset === undefined ? {} : { offset: boundedNumber(value.offset, 0, -1e6, 1e6, `${path}.offset`) }) }
    case 'time': return { kind: 'time', format: boundedString(value.format, 'HH:mm:ss', 128, `${path}.format`), ...sharedName, ...(value.offset === undefined ? {} : { offset: boundedNumber(value.offset, 0, -1e6, 1e6, `${path}.offset`) }), region: boundedString(value.region, 'default', 128, `${path}.region`) }
    case 'database': return {
      kind: 'database',
      dataset: boundedString(value.dataset, '', 255, `${path}.dataset`),
      field: boundedString(value.field, '', 255, `${path}.field`),
      ...sharedName,
      ...(value.connectionId === undefined ? {} : { connectionId: boundedString(value.connectionId, '', 128, `${path}.connectionId`).trim() || undefined }),
      ...(value.recordOffset === undefined ? {} : { recordOffset: Math.floor(boundedNumber(value.recordOffset, 0, 0, 100000, `${path}.recordOffset`)) })
    }
    case 'script': return { kind: 'script', code: boundedString(value.code, '', 256 * 1024, `${path}.code`), ...sharedName }
    case 'keyboard': {
      const protocols: WeighProtocol[] = ['kasda', 'tonde', 'ad', 'mettler', 'ohaus', 'sartorius', 'standard', 'custom']
      const units: WeighUnit[] = ['g', 'kg', 'lb', 'oz', 'jin']
      const inputDevice = value.inputDevice === 'weigh' ? 'weigh' : 'keyboard'
      const weighProtocol = protocols.includes(value.weighProtocol as WeighProtocol) ? value.weighProtocol as WeighProtocol : 'kasda'
      const weighUnit = units.includes(value.weighUnit as WeighUnit) ? value.weighUnit as WeighUnit : 'kg'
      return {
        kind: 'keyboard',
        label: boundedString(value.label, '', 255, `${path}.label`),
        ...sharedName,
        inputDevice,
        weighProtocol,
        weighPort: boundedString(value.weighPort, 'COM1', 32, `${path}.weighPort`),
        weighBaud: boundedString(value.weighBaud, '9600', 16, `${path}.weighBaud`),
        weighUnit,
        weighDecimals: Math.floor(boundedNumber(value.weighDecimals, 2, 0, 4, `${path}.weighDecimals`)),
        weighAutoPrint: value.weighAutoPrint === true,
        weighUnitConv: value.weighUnitConv === true
      } as KeyboardSource
    }
    default: throw new Error(`${path}.kind 不支持`)
  }
}

function normalizeSubSources(value: unknown, path: string): DataSource[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > 100) throw new Error(`${path}格式无效`)
  return value.map((source, index) => normalizeDataSource(source, `${path}[${index}]`))
}

function normalizeColor(value: unknown, fallback: string, path: string): string {
  const color = boundedString(value, fallback, 64, path)
  if (!/^(transparent|#[0-9a-f]{3,8}|rgba?\([^)]*\)|[a-z]+)$/i.test(color)) throw new Error(`${path}颜色格式无效`)
  return color
}

function normalizeColorChange(value: unknown, path: string): ColorChangeConfig | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) throw new Error(`${path}格式无效`)
  // 帮助 color_main.html：随机 / 以数据源内容为索引 / 颜色索引变量 / 颜色值变量 / 颜色索引 / RGB颜色值。
  // 旧模型只有 index / variable 两种取值，按语义迁移到新枚举。
  const migrate = (raw: unknown): ColorChangeConfig['mode'] => {
    if (raw === 'variable') return 'valueVar'
    if (raw === 'index') return 'index'
    return COLOR_CHANGE_MODES.some((item) => item.value === raw) ? (raw as ColorChangeConfig['mode']) : 'fixed'
  }
  const mode = migrate(value.mode)
  const tableSource = value.tableSource === 'shared' ? 'shared' : 'private'
  const changeMode = value.changeMode === 'char' || value.changeMode === 'block' || value.changeMode === 'gradient' ? value.changeMode : 'solid'
  if (value.privateTable !== undefined && (!Array.isArray(value.privateTable) || value.privateTable.length > 256)) throw new Error(`${path}.privateTable格式无效`)
  const privateTable = Array.isArray(value.privateTable)
    ? value.privateTable.map((item, index) => boundedString(item, '', 64, `${path}.privateTable[${index}]`))
    : []
  return {
    mode,
    tableSource,
    // 帮助：颜色索引表包括十个预先定义的颜色（索引 0–9）。
    // 空表表示沿用预定义表（见 resolveColorChangePlan），此处保留用户实际填写的行。
    privateTable,
    changeMode,
    blockRows: Math.floor(boundedNumber(value.blockRows, 1, 1, 100, `${path}.blockRows`)),
    blockCols: Math.floor(boundedNumber(value.blockCols, 1, 1, 100, `${path}.blockCols`)),
    variableName: boundedString(value.variableName, '', 255, `${path}.variableName`),
    inputValue: boundedString(value.inputValue, '', 255, `${path}.inputValue`)
  }
}

function normalizeSubstrValue(value: unknown, path: string): { start: number; length: number; cutType?: import('./datasource').CutType; cutCount?: number } | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) throw new Error(`${path}格式无效`)
  const cutTypes = ['none', 'trimLeft', 'trimRight', 'dropLeft', 'dropRight', 'keepLeft', 'keepRight'] as const
  const cutType = cutTypes.includes(value.cutType as typeof cutTypes[number]) ? value.cutType as typeof cutTypes[number] : undefined
  return {
    start: Math.floor(boundedNumber(value.start, 0, -1000000, 1000000, `${path}.start`)),
    length: Math.floor(boundedNumber(value.length, 0, 0, 1000000, `${path}.length`)),
    ...(cutType ? { cutType } : {}),
    ...(value.cutCount === undefined ? {} : { cutCount: Math.floor(boundedNumber(value.cutCount, 0, 0, 1000000, `${path}.cutCount`)) })
  }
}

function normalizeLengthLimitValue(value: unknown, path: string): import('./datasource').LengthLimit | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) throw new Error(`${path}格式无效`)
  const modes = ['none', 'min', 'max', 'both'] as const
  const padDirs = ['left', 'right'] as const
  const trimDirs = ['left', 'right'] as const
  const mode = modes.includes(value.mode as typeof modes[number]) ? value.mode as typeof modes[number] : undefined
  const padDir = padDirs.includes(value.padDir as typeof padDirs[number]) ? value.padDir as typeof padDirs[number] : undefined
  const trimDir = trimDirs.includes(value.trimDir as typeof trimDirs[number]) ? value.trimDir as typeof trimDirs[number] : undefined
  return {
    ...(mode ? { mode } : {}),
    ...(value.min === undefined ? {} : { min: Math.floor(boundedNumber(value.min, 0, 0, 1000000, `${path}.min`)) }),
    ...(value.max === undefined ? {} : { max: Math.floor(boundedNumber(value.max, 0, 0, 1000000, `${path}.max`)) }),
    ...(padDir ? { padDir } : {}),
    ...(value.padChar === undefined ? {} : { padChar: boundedString(value.padChar, ' ', 8, `${path}.padChar`) }),
    ...(trimDir ? { trimDir } : {})
  }
}

function normalizeBarcodeOptions(value: unknown, path: string): BarcodeOptions | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) throw new Error(`${path}格式无效`)
  const result: BarcodeOptions = {}
  const output = result as unknown as Record<string, unknown>
  const booleans = ['gs1', 'qrIconArea', 'truncated', 'code39Stars', 'itf14Check', 'itf14Bearer', 'itf25Check', 'rssGs1']
  for (const key of booleans) if (value[key] !== undefined) output[key] = value[key] === true
  const numbers: Array<[string, number, number]> = [
    ['xSizeMm', 0.01, 100], ['xSizeMil', 1, 1000], ['w2n', 1, 10], ['rssSep', 0, 100],
    ['itf14BearerRatio', 0, 100], ['itf14QuietRatio', 0, 100], ['humanOffsetMm', 0, 100], ['pdf417LayerHeightX', 1, 10], ['pdf417Columns', 1, 30]
  ]
  for (const [key, min, max] of numbers) if (value[key] !== undefined) output[key] = boundedNumber(value[key], min, min, max, `${path}.${key}`)
  if (output.xSizeMil === undefined && typeof output.xSizeMm === 'number') output.xSizeMil = Math.round(output.xSizeMm / 0.0254 * 100) / 100
  if (output.xSizeMm === undefined && typeof output.xSizeMil === 'number') output.xSizeMm = output.xSizeMil * 0.0254
  const strings: Array<[string, number]> = [['eclevel', 32], ['hanxinVersion', 32]]
  for (const [key, max] of strings) if (value[key] !== undefined) output[key] = boundedString(value[key], '', max, `${path}.${key}`)
  const charset = ['auto', 'a', 'b', 'c', 'manual'] as const
  const encoding = ['ansi', 'utf8'] as const
  const code39Check = ['none', 'mod10', 'mod43', 'library'] as const
  const eanAddon = ['none', '2', '5'] as const
  const codabarCheck = ['none', 'mod10', 'library'] as const
  const codabarStart = ['a', 'b', 'c', 'd'] as const
  const codabarStop = ['a', 'b', 'c', 'd'] as const
  const rssType = ['omni', 'truncated', 'stacked', 'stackedomni', 'limited'] as const
  const humanPosition = ['default', 'below', 'above', 'none'] as const
  const humanAlign = ['left', 'center', 'right', 'justify'] as const
  const itf14BearerMode = ['none', 'box', 'bar'] as const
  const enumFields: Array<[string, readonly string[]]> = [
    ['charset', charset], ['encoding', encoding], ['code39Check', code39Check], ['eanAddon', eanAddon],
    ['codabarCheck', codabarCheck], ['codabarStart', codabarStart], ['codabarStop', codabarStop], ['rssType', rssType],
    ['humanPosition', humanPosition], ['humanAlign', humanAlign], ['itf14BearerMode', itf14BearerMode]
  ]
  for (const [key, allowed] of enumFields) if (allowed.includes(value[key] as string)) output[key] = value[key]
  if (value.datamatrixEcc === 'ECC200') output.datamatrixEcc = 'ECC200'
  return result
}

function normalizeNumberArray(value: unknown, path: string, expectedLength: number, maxLength: number, min: number, max: number): number[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length > maxLength || value.length !== expectedLength) throw new Error(`${path}数量必须等于 ${expectedLength}`)
  return value.map((item, index) => boundedNumber(item, 0, min, max, `${path}[${index}]`))
}

function normalizeObject(value: unknown, path: string, ids: Set<string>, nextId: { value: number }, depth = 0): LabelObject {
  if (!isRecord(value) || typeof value.type !== 'string') throw new Error(`${path}对象格式无效`)
  const allowed = new Set(['text', 'barcode', 'rfid', 'rect', 'line', 'ellipse', 'table', 'image', 'group'])
  if (!allowed.has(value.type)) throw new Error(`${path}包含不支持的对象类型：${value.type}`)
  if (depth > MAX_DOCUMENT_GROUP_DEPTH) throw new Error(`${path}分组嵌套超过 ${MAX_DOCUMENT_GROUP_DEPTH} 层限制`)
  const idValue = value.id === undefined ? '' : boundedString(value.id, '', 128, `${path}.id`).trim()
  const id = idValue || `${value.type}-${++nextId.value}`
  if (ids.has(id)) throw new Error(`对象 ID 重复：${id}`)
  ids.add(id)
  if (ids.size > MAX_DOCUMENT_OBJECTS) throw new Error(`模板对象数量超过 ${MAX_DOCUMENT_OBJECTS} 个限制`)
  const minDimension = value.type === 'line' ? 0 : 0.01
  const base = {
    id,
    type: value.type as LabelObject['type'],
    x: boundedNumber(value.x, 0, -100000, 100000, `${path}.x`),
    y: boundedNumber(value.y, 0, -100000, 100000, `${path}.y`),
    w: boundedNumber(value.w, 1, minDimension, 100000, `${path}.w`),
    h: boundedNumber(value.h, 1, minDimension, 100000, `${path}.h`),
    rotation: boundedNumber(value.rotation, 0, -1000000, 1000000, `${path}.rotation`),
    ...(value.visible === false ? { visible: false } : {}),
    ...(value.locked === true ? { locked: true } : {}),
    ...(value.suppressPrint === true ? { suppressPrint: true } : {}),
    ...(value.flipX === true ? { flipX: true } : {}),
    ...(value.flipY === true ? { flipY: true } : {}),
    ...(value.note === undefined ? {} : { note: boundedString(value.note, '', 1024, `${path}.note`) }),
    ...(value.backgroundTransparent === true ? { backgroundTransparent: true } : {})
  }
  if (value.type === 'group') {
    if (!Array.isArray(value.children) || value.children.length > MAX_DOCUMENT_OBJECTS) throw new Error(`${path}分组子对象无效`)
    return { ...base, children: value.children.map((child, index) => normalizeObject(child, `${path}.children[${index}]`, ids, nextId, depth + 1)) } as LabelObject
  }
  const source = normalizeDataSource(value.source, `${path}.source`)
  const subSources = normalizeSubSources(value.subSources, `${path}.subSources`)
  if (value.type === 'text') {
    const align = ['left', 'center', 'right', 'justify'].includes(String(value.align)) ? value.align as 'left' | 'center' | 'right' | 'justify' : 'left'
    return {
      ...base, fontFamily: boundedString(value.fontFamily, 'Arial', 255, `${path}.fontFamily`),
      fontSize: boundedNumber(value.fontSize, 3, 0.1, 1000, `${path}.fontSize`),
      bold: value.bold === true, italic: value.italic === true, underline: value.underline === true,
      strikeout: value.strikeout === true, reverse: value.reverse === true, align,
      color: normalizeColor(value.color, '#000000', `${path}.color`),
      ...(value.backgroundColor === undefined ? {} : { backgroundColor: normalizeColor(value.backgroundColor, '#ffffff', `${path}.backgroundColor`) }),
      source, ...(subSources ? { subSources } : {}),
      ...(normalizeColorChange(value.colorChange, `${path}.colorChange`) ? { colorChange: normalizeColorChange(value.colorChange, `${path}.colorChange`) } : {}),
      ...(typeof value.format === 'string' && ['none', 'upper', 'lower', 'capitalize'].includes(value.format) ? { format: value.format as 'none' | 'upper' | 'lower' | 'capitalize' } : {}),
      ...(value.charTemplate === undefined ? {} : { charTemplate: boundedString(value.charTemplate, '', 1024, `${path}.charTemplate`) }),
      ...(value.printerFont === undefined ? {} : { printerFont: boundedString(value.printerFont, '', 255, `${path}.printerFont`) }),
      ...(value.fontWidthScale === undefined ? {} : { fontWidthScale: boundedNumber(value.fontWidthScale, 1, 0.1, 10, `${path}.fontWidthScale`) }),
      ...(value.charSpacing === undefined ? {} : { charSpacing: boundedNumber(value.charSpacing, 0, 0, 100, `${path}.charSpacing`) }),
      ...(value.textDock === 'left' || value.textDock === 'right' || value.textDock === 'center' || value.textDock === 'both' ? { textDock: value.textDock } : {}),
      ...(value.textType === 'single' || value.textType === 'multi' || value.textType === 'circle' ? { textType: value.textType } : {}),
      ...(value.verticalAlign === 'middle' || value.verticalAlign === 'bottom' || value.verticalAlign === 'top' ? { verticalAlign: value.verticalAlign } : {}),
      ...(value.lineWidth === undefined ? {} : { lineWidth: boundedNumber(value.lineWidth, 1, 0.1, 100000, `${path}.lineWidth`) }),
      ...(value.lineSpacingMm === undefined ? {} : { lineSpacingMm: boundedNumber(value.lineSpacingMm, 0, 0, 100000, `${path}.lineSpacingMm`) }),
      ...(value.arc === true ? { arc: true } : {}),
      ...(value.lineSpacing === undefined ? {} : { lineSpacing: boundedNumber(value.lineSpacing, 1.2, 0.1, 100, `${path}.lineSpacing`) }),
      ...(value.arcAngle === undefined ? {} : { arcAngle: boundedNumber(value.arcAngle, 0, -360, 360, `${path}.arcAngle`) }),
      ...(value.arcExtent === undefined ? {} : { arcExtent: boundedNumber(value.arcExtent, 180, 0, 360, `${path}.arcExtent`) }),
      ...(value.arcRadius === undefined ? {} : { arcRadius: boundedNumber(value.arcRadius, 0, 0, 10000, `${path}.arcRadius`) }),
      ...(value.arcDir === 'ccw' ? { arcDir: 'ccw' as const } : {}),
      ...(value.arcTextDir === 'in' ? { arcTextDir: 'in' as const } : {}),
      ...(normalizeSubstrValue(value.substr, `${path}.substr`) ? { substr: normalizeSubstrValue(value.substr, `${path}.substr`) } : {}),
      ...(normalizeLengthLimitValue(value.lengthLimit, `${path}.lengthLimit`) ? { lengthLimit: normalizeLengthLimitValue(value.lengthLimit, `${path}.lengthLimit`) } : {})
    } as LabelObject
  }
  if (value.type === 'barcode') {
    const barcodeOptions = normalizeBarcodeOptions(value.barcodeOptions, `${path}.barcodeOptions`)
    return {
      ...base, symbology: boundedString(value.symbology, 'code128', 64, `${path}.symbology`), showText: value.showText !== false,
      ...(value.color === undefined ? {} : { color: normalizeColor(value.color, '#000000', `${path}.color`) }),
      // 缩减量（EAN/UPC）：0–100 毫米
      ...(typeof value.reductionMm === 'number' && Number.isFinite(value.reductionMm)
        ? { reductionMm: Math.max(0, Math.min(100, Math.round(value.reductionMm * 100) / 100)) }
        : {}),
      source, ...(subSources ? { subSources } : {}), ...(barcodeOptions ? { barcodeOptions } : {}),
      ...(typeof value.format === 'string' && ['none', 'upper', 'lower', 'capitalize'].includes(value.format) ? { format: value.format as 'none' | 'upper' | 'lower' | 'capitalize' } : {}),
      ...(value.charTemplate === undefined ? {} : { charTemplate: boundedString(value.charTemplate, '', 1024, `${path}.charTemplate`) }),
      ...(value.barcodeAlign === 'left' || value.barcodeAlign === 'center' || value.barcodeAlign === 'right' ? { barcodeAlign: value.barcodeAlign } : {}),
      ...(normalizeSubstrValue(value.substr, `${path}.substr`) ? { substr: normalizeSubstrValue(value.substr, `${path}.substr`) } : {}),
      ...(normalizeLengthLimitValue(value.lengthLimit, `${path}.lengthLimit`) ? { lengthLimit: normalizeLengthLimitValue(value.lengthLimit, `${path}.lengthLimit`) } : {})
    } as LabelObject
  }
  if (value.type === 'rfid') {
    const bank = value.bank === 'USER' || value.bank === 'TID' ? value.bank : 'EPC'
    const rawAccess = isRecord(value.accessControl) ? value.accessControl : undefined
    const accessControl = rawAccess ? {
      epc: rawAccess.epc === 'lock' || rawAccess.epc === 'unlock' ? rawAccess.epc : 'none',
      user: rawAccess.user === 'lock' || rawAccess.user === 'unlock' ? rawAccess.user : 'none',
      tid: rawAccess.tid === 'lock' || rawAccess.tid === 'unlock' ? rawAccess.tid : 'none',
      accessPassword: rawAccess.accessPassword === 'lock' || rawAccess.accessPassword === 'unlock' ? rawAccess.accessPassword : 'none',
      killPassword: rawAccess.killPassword === 'lock' || rawAccess.killPassword === 'unlock' ? rawAccess.killPassword : 'none'
    } as const : undefined
    return {
      ...base, bank, source, lock: value.lock === true, ...(subSources ? { subSources } : {}),
      ...(accessControl ? { accessControl } : {}),
      ...(value.startBlock === undefined ? {} : { startBlock: Math.floor(boundedNumber(value.startBlock, 0, 0, 100000, `${path}.startBlock`)) }),
      ...(value.codeLen === undefined ? {} : { codeLen: Math.floor(boundedNumber(value.codeLen, 0, 0, 100000, `${path}.codeLen`)) }),
      ...(value.accessPwd === undefined ? {} : { accessPwd: boundedString(value.accessPwd, '', 128, `${path}.accessPwd`) }),
      ...(value.killPwd === undefined ? {} : { killPwd: boundedString(value.killPwd, '', 128, `${path}.killPwd`) }),
      ...(value.readerType === undefined ? {} : { readerType: boundedString(value.readerType, '', 64, `${path}.readerType`) }),
      ...(value.dataType === 'hex' ? { dataType: 'hex' as const } : {}),
      ...(value.pcWord === undefined ? {} : { pcWord: boundedString(value.pcWord, '', 32, `${path}.pcWord`) }),
      ...(value.codeHead === undefined ? {} : { codeHead: boundedString(value.codeHead, '', 128, `${path}.codeHead`) }),
      ...(value.lockOp === 'lock' || value.lockOp === 'unlock' || value.lockOp === 'permanent' ? { lockOp: value.lockOp } : {}),
      ...(typeof value.format === 'string' && ['none', 'upper', 'lower', 'capitalize'].includes(value.format) ? { format: value.format as 'none' | 'upper' | 'lower' | 'capitalize' } : {}),
      ...(normalizeSubstrValue(value.substr, `${path}.substr`) ? { substr: normalizeSubstrValue(value.substr, `${path}.substr`) } : {}),
      ...(normalizeLengthLimitValue(value.lengthLimit, `${path}.lengthLimit`) ? { lengthLimit: normalizeLengthLimitValue(value.lengthLimit, `${path}.lengthLimit`) } : {}),
      ...(value.charTemplate === undefined ? {} : { charTemplate: boundedString(value.charTemplate, '', 1024, `${path}.charTemplate`) })
    } as LabelObject
  }
  if (value.type === 'rect' || value.type === 'ellipse') {
    const colorChange = normalizeColorChange(value.colorChange, `${path}.colorChange`)
    const shape = value.type === 'ellipse' ? 'ellipse' : value.shape === 'roundRect' || value.shape === 'ellipse' ? value.shape : 'rect'
    return { ...base, fill: normalizeColor(value.fill, 'transparent', `${path}.fill`), stroke: normalizeColor(value.stroke, '#000000', `${path}.stroke`), strokeWidth: boundedNumber(value.strokeWidth, 0.2, 0, 100, `${path}.strokeWidth`), shape, ...(value.cornerRadius === undefined ? {} : { cornerRadius: boundedNumber(value.cornerRadius, 0, 0, 100000, `${path}.cornerRadius`) }), ...(value.fillEnabled === undefined ? {} : { fillEnabled: value.fillEnabled === true }), ...(colorChange ? { colorChange } : {}) } as LabelObject
  }
  if (value.type === 'line') {
    return { ...base, stroke: normalizeColor(value.stroke, '#000000', `${path}.stroke`), strokeWidth: boundedNumber(value.strokeWidth, 0.2, 0, 100, `${path}.strokeWidth`) } as LabelObject
  }
  if (value.type === 'table') {
    const rows = Math.floor(boundedNumber(value.rows, 1, 1, 100, `${path}.rows`))
    const cols = Math.floor(boundedNumber(value.cols, 1, 1, 100, `${path}.cols`))
    const colWidths = normalizeNumberArray(value.colWidths, `${path}.colWidths`, cols, 100, 0.01, 10000)
    const rowHeights = normalizeNumberArray(value.rowHeights, `${path}.rowHeights`, rows, 100, 0.01, 10000)
    if (Array.isArray(value.merges) && value.merges.length > 1000) throw new Error(`${path}.merges数量过多`)
    const merges = Array.isArray(value.merges) ? value.merges.map((merge, index) => {
      if (!isRecord(merge)) throw new Error(`${path}.merges[${index}]格式无效`)
      const r = Math.floor(boundedNumber(merge.r, 0, 0, rows - 1, `${path}.merges[${index}].r`))
      const c = Math.floor(boundedNumber(merge.c, 0, 0, cols - 1, `${path}.merges[${index}].c`))
      const r2 = Math.floor(boundedNumber(merge.r2, 0, 0, rows - 1, `${path}.merges[${index}].r2`))
      const c2 = Math.floor(boundedNumber(merge.c2, 0, 0, cols - 1, `${path}.merges[${index}].c2`))
      return {
        r: Math.min(r, r2), c: Math.min(c, c2), r2: Math.max(r, r2), c2: Math.max(c, c2)
      }
    }).filter((merge, index, all) => all.findIndex((item) => item.r === merge.r && item.c === merge.c && item.r2 === merge.r2 && item.c2 === merge.c2) === index) : undefined
    if (value.merges !== undefined && !Array.isArray(value.merges)) throw new Error(`${path}.merges格式无效`)
    return { ...base, rows, cols, borderWidth: boundedNumber(value.borderWidth, 0.2, 0, 100, `${path}.borderWidth`), borderColor: normalizeColor(value.borderColor, '#000000', `${path}.borderColor`), ...(colWidths ? { colWidths } : {}), ...(rowHeights ? { rowHeights } : {}), ...(value.keepSize === true ? { keepSize: true } : {}), ...(merges ? { merges } : {}) } as LabelObject
  }
  if (value.type === 'image') {
    const imgType = value.imgType === 'link' || value.imgType === 'datasource' ? value.imgType : 'embed'
    const imageFit = value.imageFit === 'original' || value.imageFit === 'scale' || value.imageFit === 'fitBox' ? value.imageFit : 'fit'
    const imageAlign = ['center', 'topLeft', 'topCenter', 'topRight', 'middleRight', 'bottomRight', 'bottomCenter', 'bottomLeft', 'middleLeft'].includes(String(value.imageAlign)) ? value.imageAlign : 'center'
    return { ...base, src: boundedString(value.src, '', 64 * 1024 * 1024, `${path}.src`), imgType, imageFit, ...(value.keepAspect === undefined ? {} : { keepAspect: value.keepAspect === true }), ...(imageAlign ? { imageAlign } : {}), ...(value.widthPercent === undefined ? {} : { widthPercent: boundedNumber(value.widthPercent, 100, 1, 1000, `${path}.widthPercent`) }), ...(value.heightPercent === undefined ? {} : { heightPercent: boundedNumber(value.heightPercent, 100, 1, 1000, `${path}.heightPercent`) }), ...(value.linkPath === undefined ? {} : { linkPath: boundedString(value.linkPath, '', 4096, `${path}.linkPath`) }), ...(value.source === undefined ? {} : { source }) } as LabelObject
  }
  return base as LabelObject
}

function normalizePrinter(value: unknown): PrinterConfig {
  const base = defaultPrinterConfig()
  if (!isRecord(value)) return base
  const driver = value.driver === 'zpl' || value.driver === 'cpcl' ? value.driver : 'tspl'
  const portValue = isRecord(value.port) ? value.port : {}
  const portType = ['driver', 'file', 'tcp', 'com', 'lpt', 'usb', 'bluetooth'].includes(String(portValue.type)) ? String(portValue.type) as PrinterConfig['port']['type'] : base.port.type
  const port: PrinterConfig['port'] = {
    type: portType,
    encoding: portValue.encoding === 'gbk' ? 'gbk' : 'utf8'
  }
  const tcpHost = optionalString(portValue.tcpHost, 255, 'printer.port.tcpHost', true)
  const comPort = optionalString(portValue.comPort, 32, 'printer.port.comPort', true)
  const lptPort = optionalString(portValue.lptPort, 32, 'printer.port.lptPort', true)
  const baudRate = portValue.baudRate === undefined ? undefined : Math.floor(boundedNumber(portValue.baudRate, 115200, 300, 4000000, 'printer.port.baudRate'))
  if (tcpHost) port.tcpHost = tcpHost
  if (portValue.tcpPort !== undefined) port.tcpPort = Math.floor(boundedNumber(portValue.tcpPort, 9100, 1, 65535, 'printer.port.tcpPort'))
  if (comPort) port.comPort = comPort
  if (lptPort) port.lptPort = lptPort
  if (baudRate !== undefined) port.baudRate = baudRate
  const printMode = value.printMode === 'default' || value.printMode === 'thermal' || value.printMode === 'transfer' ? value.printMode : base.printMode
  const labelType = value.labelType === 'default' || value.labelType === 'gap' || value.labelType === 'continuous' || value.labelType === 'mark' ? value.labelType : base.labelType
  const mediaHandle = value.mediaHandle === 'tear' || value.mediaHandle === 'peel' || value.mediaHandle === 'cut' || value.mediaHandle === 'none' ? value.mediaHandle : base.mediaHandle
  const result: PrinterConfig = {
    driver,
    ...(typeof value.profile === 'string' && value.profile.trim() ? { profile: value.profile.trim().slice(0, 128) } : {}),
    ...(typeof value.model === 'string' && value.model.trim() ? { model: value.model.trim().slice(0, 255) } : {}),
    ...(typeof value.firmware === 'string' && value.firmware.trim() ? { firmware: value.firmware.trim().slice(0, 128) } : {}),
    dpi: Math.max(1, Math.min(1200, finite(value.dpi, base.dpi))),
    speed: Math.max(1, Math.min(30, finite(value.speed, base.speed))),
    density: Math.max(1, Math.min(30, finite(value.density, base.density))),
    printMode,
    labelType,
    topOffsetMm: Math.max(-1000, Math.min(1000, finite(value.topOffsetMm, base.topOffsetMm))),
    mediaHandle,
    backfeedMm: Math.max(0, Math.min(1000, finite(value.backfeedMm, base.backfeedMm))),
    port
  }
  const printerName = optionalString(value.printerName, 255, 'printer.printerName', true)
  if (printerName) result.printerName = printerName
  for (const key of ['preCmd', 'contentCmd', 'postCmd'] as const) {
    const command = optionalString(value[key], 4 * 1024 * 1024, `printer.${key}`)
    if (command !== undefined) result[key] = command
  }
  if (value.saveAsDefault !== undefined) {
    if (typeof value.saveAsDefault !== 'boolean') throw new Error('printer.saveAsDefault格式无效')
    result.saveAsDefault = value.saveAsDefault
  }
  return result
}

function normalizeConnection(value: unknown, id: string): DbConnectionConfig {
  if (!isRecord(value)) throw new Error(`数据库连接“${id}”格式无效`)
  const drivers: DbConnectionConfig['driver'][] = ['sqlserver', 'mysql', 'sqlite', 'dsn']
  const driver = drivers.includes(value.driver as DbConnectionConfig['driver']) ? value.driver as DbConnectionConfig['driver'] : undefined
  if (!driver) throw new Error(`数据库连接“${id}”驱动无效`)
  const connectionId = optionalString(value.id, 128, `connections.${id}.id`, true) ?? id
  const name = optionalString(value.name, 255, `connections.${id}.name`, true) ?? '数据库连接'
  const result: DbConnectionConfig = { id: connectionId, name, driver }
  if (value.authMode !== undefined && value.authMode !== 'windows' && value.authMode !== 'sql') throw new Error(`connections.${id}.authMode无效`)
  if (value.authMode !== undefined) result.authMode = value.authMode
  for (const key of ['dsn', 'server', 'database', 'user', 'password', 'filePath', 'datasetName', 'tableName'] as const) {
    const field = optionalString(value[key], 4096, `connections.${id}.${key}`)
    if (field !== undefined) result[key] = field
  }
  if (value.timeoutSec !== undefined) result.timeoutSec = Math.floor(boundedNumber(value.timeoutSec, 15, 1, 3600, `connections.${id}.timeoutSec`))
  if (value.autoRefresh !== undefined) {
    if (typeof value.autoRefresh !== 'boolean') throw new Error(`connections.${id}.autoRefresh格式无效`)
    result.autoRefresh = value.autoRefresh
  }
  if (value.sql !== undefined) result.sql = boundedString(value.sql, '', 4 * 1024 * 1024, `connections.${id}.sql`)
  return result
}

function migrateObject(value: UnknownRecord, depth = 0): UnknownRecord {
  if (depth > MAX_DOCUMENT_GROUP_DEPTH) throw new Error(`模板分组嵌套超过 ${MAX_DOCUMENT_GROUP_DEPTH} 层限制`)
  const next: UnknownRecord = { ...value }
  // 早期版本把文本格式和条码尺寸写在对象根上；统一迁移到正式字段。
  if (next.type === 'text' && next.format === undefined && typeof next.textFormat === 'string') {
    next.format = next.textFormat
  }
  delete next.textFormat
  if (next.type === 'barcode') {
    const options = isRecord(next.barcodeOptions) ? { ...next.barcodeOptions } : {}
    if (options.xSizeMm === undefined && typeof next.moduleWidthMm === 'number') options.xSizeMm = next.moduleWidthMm
    if (options.w2n === undefined && typeof next.wideRatio === 'number') options.w2n = next.wideRatio
    if (Object.keys(options).length) next.barcodeOptions = options
    delete next.moduleWidthMm
    delete next.wideRatio
    // 早期 UI 暴露过跨协议无法一致实现的根级字段；不再让它们伪装成有效配置。
    delete next.textPosition
    delete next.checksum
  }
  if (next.type === 'group' && Array.isArray(next.children)) {
    next.children = next.children.map((child) => isRecord(child) ? migrateObject(child, depth + 1) : child)
  }
  return next
}

/**
 * 迁移历史裸文档。迁移是显式、单向且可审计的；未来版本禁止静默降级。
 * 这样打开旧 LabelShop/MaxLabel 文件时不会把字段漂移继续带入运行时。
 */
export function migrateDocument(value: unknown): unknown {
  if (!isRecord(value)) return value
  const version = typeof value.version === 'number' && Number.isFinite(value.version) ? Math.floor(value.version) : 0
  if (version > DOCUMENT_MODEL_VERSION) throw new Error(`模板版本过高（${version}），当前程序最高支持 v${DOCUMENT_MODEL_VERSION}`)
  return {
    ...value,
    version: DOCUMENT_MODEL_VERSION,
    objects: Array.isArray(value.objects) ? value.objects.map((object) => isRecord(object) ? migrateObject(object) : object) : value.objects
  }
}

/** Normalize and validate every document boundary before it enters the workspace. */
export function normalizeDocument(value: unknown): LabelDoc {
  const migrated = migrateDocument(value)
  if (!isRecord(migrated)) throw new Error('模板格式不正确')
  const widthMm = finite(migrated.widthMm, 0)
  const heightMm = finite(migrated.heightMm, 0)
  if (widthMm <= 0 || heightMm <= 0 || widthMm > 10000 || heightMm > 10000) throw new Error('模板尺寸无效')
  if (!Array.isArray(migrated.objects) || migrated.objects.length > MAX_DOCUMENT_OBJECTS) throw new Error('模板对象列表无效或数量过多')
  const ids = new Set<string>()
  const nextId = { value: 0 }
  const datasets: Record<string, Dataset> = {}
  if (isRecord(migrated.datasets)) {
    const entries = Object.entries(migrated.datasets)
    if (entries.length > MAX_DOCUMENT_DATASETS) throw new Error('数据集数量过多')
    for (const [name, dataset] of entries) {
      const safeName = boundedString(name, '', 255, `datasets.${name}`).trim()
      if (!safeName) throw new Error('数据集名称无效')
      if (datasets[safeName]) throw new Error(`数据集名称重复：${safeName}`)
      datasets[safeName] = normalizeDataset(dataset, safeName)
    }
  }
  const connections: Record<string, DbConnectionConfig> = {}
  if (isRecord(migrated.connections)) {
    const entries = Object.entries(migrated.connections)
    if (entries.length > 1000) throw new Error('数据库连接数量过多')
    for (const [id, connection] of entries) {
      const safeId = boundedString(id, '', 128, `connections.${id}`).trim()
      if (!safeId) throw new Error('数据库连接 ID 无效')
      if (connections[safeId]) throw new Error(`数据库连接 ID 重复：${safeId}`)
      connections[safeId] = normalizeConnection(connection, safeId)
    }
  }
  let layout: LabelDoc['layout']
  if (migrated.layout !== undefined) {
    if (!isRecord(migrated.layout)) throw new Error('拼版配置无效')
    const rows = Math.floor(finite(migrated.layout.rows, 1))
    const cols = Math.floor(finite(migrated.layout.cols, 1))
    if (rows < 1 || cols < 1 || rows > 100 || cols > 100) throw new Error('拼版行列无效')
    const shape = migrated.layout.shape === 'roundRect' || migrated.layout.shape === 'ellipse' || migrated.layout.shape === 'disc' ? migrated.layout.shape : 'rect'
    const pagesPerBox = finite(migrated.layout.pagesPerBox, 0)
    layout = {
      rows, cols, shape,
      ...(typeof migrated.layout.pageWidthMm === 'number' && Number.isFinite(migrated.layout.pageWidthMm)
        ? { pageWidthMm: Math.max(0.1, Math.min(10000, migrated.layout.pageWidthMm)) }
        : {}),
      ...(typeof migrated.layout.pageHeightMm === 'number' && Number.isFinite(migrated.layout.pageHeightMm)
        ? { pageHeightMm: Math.max(0.1, Math.min(10000, migrated.layout.pageHeightMm)) }
        : {}),
      ...(pagesPerBox >= 1 ? { pagesPerBox: Math.floor(Math.min(100000, pagesPerBox)) } : {}),
      ...(migrated.layout.cornerRadiusMm !== undefined ? { cornerRadiusMm: Math.max(0, Math.min(Math.min(widthMm, heightMm) / 2, finite(migrated.layout.cornerRadiusMm, 0))) } : {}),
      // 帮助 label_page_page.html「设置标签纸的颜色。颜色只在编辑标签时显示，并不会实际输出底色」：
      // 只保留合法的 #RRGGBB，避免把脏数据写进文档并把编辑画布刷成异常颜色。
      ...(typeof migrated.layout.labelColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(migrated.layout.labelColor)
        ? { labelColor: migrated.layout.labelColor.toLowerCase() }
        : {}),
      ...(migrated.layout.innerDiameterMm !== undefined ? { innerDiameterMm: Math.max(0, Math.min(Math.min(widthMm, heightMm) - 0.02, finite(migrated.layout.innerDiameterMm, 15))) } : {}),
      // 孔洞形状必须一起归一化：旧实现只留 innerDiameterMm 把 innerShape 丢掉，
      // 于是「矩形孔」存盘/打开后退化成圆孔（编辑器画的与打印裁的对不上）。
      ...(migrated.layout.innerShape === 'rectangle' || migrated.layout.innerShape === 'circle'
        ? { innerShape: migrated.layout.innerShape as PaperHoleShape }
        : {}),
      rowGapMm: Math.max(0, Math.min(1000, finite(migrated.layout.rowGapMm, 0))),
      colGapMm: Math.max(0, Math.min(1000, finite(migrated.layout.colGapMm, 0))),
      ...(migrated.layout.printOrder === 'col' ? { printOrder: 'col' as const } : {}),
      ...(migrated.layout.labelPrintDirection === 'rtl' ? { labelPrintDirection: 'rtl' as const } : {}),
      ...(typeof migrated.layout.startPos === 'string' && ['tl', 'tr', 'bl', 'br'].includes(migrated.layout.startPos) ? { startPos: migrated.layout.startPos as 'tl' | 'tr' | 'bl' | 'br' } : {}),
      ...(typeof migrated.layout.offsetXMm === 'number' && Number.isFinite(migrated.layout.offsetXMm) ? { offsetXMm: Math.max(-1000, Math.min(1000, migrated.layout.offsetXMm)) } : {}),
      ...(typeof migrated.layout.offsetYMm === 'number' && Number.isFinite(migrated.layout.offsetYMm) ? { offsetYMm: Math.max(-1000, Math.min(1000, migrated.layout.offsetYMm)) } : {}),
      // 真机「标签格式设置 → 页面」的左空(L)/上空(T)
      ...(typeof migrated.layout.pageLeftMm === 'number' && Number.isFinite(migrated.layout.pageLeftMm) ? { pageLeftMm: Math.max(-1000, Math.min(1000, migrated.layout.pageLeftMm)) } : {}),
      ...(typeof migrated.layout.pageTopMm === 'number' && Number.isFinite(migrated.layout.pageTopMm) ? { pageTopMm: Math.max(-1000, Math.min(1000, migrated.layout.pageTopMm)) } : {})
    }
  }
  const remark = optionalString(migrated.remark, 4096, 'remark')
  const globalScript = optionalString(migrated.globalScript, 256 * 1024, 'globalScript')
  const thumb = optionalString(migrated.thumb, 4 * 1024 * 1024, 'thumb')
  const keyboardOrder = migrated.keyboardOrder === undefined
    ? undefined
    : Array.isArray(migrated.keyboardOrder)
      ? migrated.keyboardOrder.length > 10000
        ? (() => { throw new Error('keyboardOrder数量过多') })()
        : migrated.keyboardOrder.map((item, index) => boundedString(item, '', 128, `keyboardOrder[${index}]`))
      : (() => { throw new Error('keyboardOrder格式无效') })()
  const colorIndexTable = migrated.colorIndexTable === undefined
    ? undefined
    : Array.isArray(migrated.colorIndexTable)
      ? migrated.colorIndexTable.length > 256
        ? (() => { throw new Error('colorIndexTable数量过多') })()
        : migrated.colorIndexTable.map((item, index) => normalizeColor(item, '#000000', `colorIndexTable[${index}]`))
      : (() => { throw new Error('colorIndexTable格式无效') })()
  return {
    version: DOCUMENT_MODEL_VERSION,
    name: boundedString(migrated.name, '未命名标签', 255, 'name').trim() || '未命名标签',
    formatKind: migrated.formatKind === 'preset' ? 'preset' : 'custom',
    widthMm,
    heightMm,
    objects: migrated.objects.map((object, index) => normalizeObject(object, `objects[${index}]`, ids, nextId)),
    printer: normalizePrinter(migrated.printer),
    datasets,
    connections,
    orientation: normalizeOrientation(migrated.orientation),
    ...(remark ? { remark } : {}),
    ...(globalScript ? { globalScript } : {}),
    ...(thumb ? { thumb } : {}),
    ...(keyboardOrder ? { keyboardOrder } : {}),
    ...(colorIndexTable ? { colorIndexTable } : {}),
    ...(layout ? { layout } : {})
  } as LabelDoc
}
