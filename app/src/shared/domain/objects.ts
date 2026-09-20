import type { DataCtx, DataSource, LengthLimit, Substr, TextFormat } from './datasource'
import { round2 } from './units'
import { applyAffine, identityAffine, multiplyAffine, rotationAround } from './transform'

export type ObjType = 'text' | 'barcode' | 'rfid' | 'rect' | 'line' | 'ellipse' | 'table' | 'image' | 'group'

/** 帮助 color_main.html：对象的颜色变化模式有以下几种。 */
export type ColorChangeMode = 'fixed' | 'random' | 'indexByContent' | 'indexVar' | 'valueVar' | 'index' | 'rgb'

/** 帮助 color_main.html：直线/矩形/图片整体变色；文字整体或逐字符；条码整体/按行列（区块）/渐变。 */
export type ColorChangeGranularity = 'solid' | 'char' | 'block' | 'gradient'

export interface ColorChangeConfig {
  mode: ColorChangeMode
  tableSource: 'shared' | 'private'
  privateTable: string[]
  changeMode: ColorChangeGranularity
  blockRows: number
  blockCols: number
  variableName: string
  /** 「颜色索引」「RGB颜色值」模式下直接输入的内容（`示例：1,2,3` / `#FF0000 | #00FF00`）。 */
  inputValue?: string
}

/**
 * 帮助 color_main.html：颜色索引表包括十个预先定义的颜色，分别对应索引 0 到 9。
 * 新建对象与空索引表都以此表起手（DIFF-27 ②）。
 */
export const DEFAULT_COLOR_INDEX_TABLE: string[] = [
  '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
  '#FF00FF', '#00FFFF', '#808080', '#FF8000', '#8000FF'
]

export const COLOR_CHANGE_MODES: { value: ColorChangeMode; label: string }[] = [
  { value: 'fixed', label: '固定颜色' },
  { value: 'random', label: '随机颜色' },
  { value: 'indexByContent', label: '以数据源内容为索引' },
  { value: 'indexVar', label: '颜色索引变量' },
  { value: 'valueVar', label: '颜色值变量' },
  { value: 'index', label: '颜色索引' },
  { value: 'rgb', label: 'RGB颜色值' }
]

export const COLOR_GRANULARITY_LABELS: Record<ColorChangeGranularity, string> = {
  solid: '整体变色',
  char: '逐字符变色',
  block: '按区块变色',
  gradient: '渐变变色'
}

const GRANULARITY_BY_TYPE: Partial<Record<ObjType, ColorChangeGranularity[]>> = {
  text: ['solid', 'char'],
  barcode: ['solid', 'block', 'gradient'],
  line: ['solid'],
  rect: ['solid'],
  ellipse: ['solid'],
  image: ['solid']
}

/** 该对象类型允许的变色粒度（帮助 color_main.html）。不支持可变颜色的类型返回空数组。 */
export function colorGranularityOptions(type: ObjType): ColorChangeGranularity[] {
  return GRANULARITY_BY_TYPE[type] ?? []
}

export function supportsColorChange(type: ObjType): boolean {
  return colorGranularityOptions(type).length > 0
}

/**
 * 帮助 color_main.html：图片只有单色的黑白图片支持可变颜色。
 * 数据源图片在 LabelShop 中是单色位图；嵌入/链接的彩色图片不支持。
 */
export function imageSupportsVariableColor(obj: { imgType?: string; src?: string }, ctx?: DataCtx): boolean {
  if (obj.imgType === 'datasource') return true
  const src = obj.src ?? ''
  if (ctx?.images && src && ctx.images[src]) return true
  return false
}

/**
 * 帮助 color_main.html：多个颜色数值需要使用“,”或者“|”分隔开。
 * 索引值同样支持这两种写法（DIFF-27 ③）。
 */
export function parseColorValues(text: string | undefined | null): string[] {
  return (text ?? '').split(/[,|]/).map((part) => part.trim()).filter((part) => part.length > 0)
}

/**
 * 帮助 color_main.html 的颜色索引值计算方法：
 * 数字 0~9 以数字本身；字母 A~Z / a~z 以（内码 - A) Mod 10；其它字符以内码 Mod 10。
 */
export function colorIndexForChar(ch: string): number {
  const code = ch.charCodeAt(0)
  if (!Number.isFinite(code)) return 0
  if (code >= 48 && code <= 57) return code - 48
  if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) return Math.abs(code - 65) % 10
  return code % 10
}

interface BaseObj {
  id: string
  type: ObjType
  x: number
  y: number
  w: number
  h: number
  rotation: number
  visible?: boolean
  locked?: boolean
  suppressPrint?: boolean
  flipX?: boolean
  flipY?: boolean
  note?: string
  backgroundTransparent?: boolean
}

export interface TextObj extends BaseObj {
  type: 'text'
  colorChange?: ColorChangeConfig
  fontFamily: string
  fontSize: number
  bold: boolean
  italic?: boolean
  underline?: boolean
  strikeout?: boolean
  reverse?: boolean
  align: 'left' | 'center' | 'right' | 'justify'
  color: string
  backgroundColor?: string
  source: DataSource
  format?: TextFormat
  substr?: Substr
  lengthLimit?: LengthLimit
  charTemplate?: string
  printerFont?: string
  fontWidthScale?: number
  charSpacing?: number
  textDock?: 'both' | 'left' | 'right' | 'center'
  arc?: boolean
  textType?: 'single' | 'multi' | 'circle'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  /** 文本行宽度（毫米）；多行文字使用它作为换行边界。 */
  lineWidth?: number
  /** 行间距（毫米），缺省按字号的 20% 计算。 */
  lineSpacingMm?: number
  lineSpacing?: number
  arcAngle?: number
  arcExtent?: number
  arcRadius?: number
  arcDir?: 'cw' | 'ccw'
  arcTextDir?: 'out' | 'in'
  subSources?: DataSource[]
}

export interface BarcodeOptions {
  gs1?: boolean
  /** LabelShop exposes X size in mil; xSizeMm is retained as the print-unit mirror. */
  xSizeMil?: number
  xSizeMm?: number
  w2n?: number
  charset?: 'auto' | 'a' | 'b' | 'c' | 'manual'
  eclevel?: string
  encoding?: 'ansi' | 'utf8'
  qrIconArea?: boolean
  truncated?: boolean
  code39Stars?: boolean
  code39Check?: 'none' | 'mod10' | 'mod43' | 'library'
  eanAddon?: 'none' | '2' | '5'
  itf14Check?: boolean
  itf14Bearer?: boolean
  /** 真机 ITF 14 的「保护框(&R)」是 3 项下拉（无/方框/保护条）；保留 itf14Bearer 兼容旧文档 */
  itf14BearerMode?: 'none' | 'box' | 'bar'
  itf14BearerRatio?: number
  itf14QuietRatio?: number
  hanxinVersion?: string
  /** 二维码/矩阵码的「符号版本」：真机 QR 41 项、Data Matrix 31 项、Micro QR 5 项（都含「自动」） */
  qrVersion?: string
  dmVersion?: string
  microQrVersion?: string
  itf25Check?: boolean
  codabarCheck?: 'none' | 'mod10' | 'library'
  codabarStart?: 'a' | 'b' | 'c' | 'd'
  codabarStop?: 'a' | 'b' | 'c' | 'd'
  rssGs1?: boolean
  rssType?: 'omni' | 'truncated' | 'stacked' | 'stackedomni' | 'limited'
  rssSep?: number
  humanPosition?: 'default' | 'below' | 'above' | 'none'
  humanAlign?: 'left' | 'center' | 'right' | 'justify'
  humanOffsetMm?: number
  datamatrixEcc?: 'ECC200'
  pdf417LayerHeightX?: number
  pdf417Columns?: number
}

export interface BarcodeObj extends BaseObj {
  type: 'barcode'
  symbology: string
  showText: boolean
  color?: string
  colorChange?: ColorChangeConfig
  source: DataSource
  format?: TextFormat
  substr?: Substr
  lengthLimit?: LengthLimit
  charTemplate?: string
  subSources?: DataSource[]
  barcodeOptions?: BarcodeOptions
  /**
   * 可变长度数据的对齐（帮助 label_object_barcode.html）：条码数据长度不一致时
   * 控制条码在对象框内的摆位，居中对齐时长度变化后仍保持中间对齐。
   */
  barcodeAlign?: 'left' | 'center' | 'right'
}

export interface RfidObj extends BaseObj {
  type: 'rfid'
  bank: 'EPC' | 'USER' | 'TID'
  source: DataSource
  subSources?: DataSource[]
  lock: boolean
  accessPwd?: string
  killPwd?: string
  readerType?: string
  startBlock?: number
  dataType?: 'hex' | 'ascii' | 'auto'
  pcWord?: string
  codeHead?: string
  codeLen?: number
  lockOp?: 'lock' | 'unlock' | 'permanent'
  /** 五个 RFID 存储/口令区各自的访问控制；none/lock/unlock 与 LabelShop 对齐。 */
  accessControl?: {
    epc: 'none' | 'lock' | 'unlock'
    user: 'none' | 'lock' | 'unlock'
    tid: 'none' | 'lock' | 'unlock'
    accessPassword: 'none' | 'lock' | 'unlock'
    killPassword: 'none' | 'lock' | 'unlock'
  }
  format?: TextFormat
  substr?: Substr
  lengthLimit?: LengthLimit
  charTemplate?: string
}

export interface RectObj extends BaseObj {
  type: 'rect'
  colorChange?: ColorChangeConfig
  fill: string
  stroke: string
  strokeWidth: number
  /** 图形对象统一模型：矩形、圆角矩形或椭圆。 */
  shape?: 'rect' | 'roundRect' | 'ellipse'
  cornerRadius?: number
  fillEnabled?: boolean
}

export interface LineObj extends BaseObj {
  type: 'line'
  colorChange?: ColorChangeConfig
  stroke: string
  strokeWidth: number
}

export interface EllipseObj extends BaseObj {
  type: 'ellipse'
  colorChange?: ColorChangeConfig
  fill: string
  stroke: string
  strokeWidth: number
  /** 旧版 ellipse 类型保留用于导入兼容，新对象统一使用 RectObj.shape。 */
  shape?: 'ellipse'
  cornerRadius?: number
  fillEnabled?: boolean
}

export interface TableObj extends BaseObj {
  type: 'table'
  rows: number
  cols: number
  borderWidth: number
  borderColor: string
  colWidths?: number[]
  rowHeights?: number[]
  keepSize?: boolean
  merges?: Array<{ r: number; c: number; r2: number; c2: number }>
}

export interface ImageObj extends BaseObj {
  type: 'image'
  colorChange?: ColorChangeConfig
  src: string
  imgType?: 'embed' | 'link' | 'datasource'
  linkPath?: string
  /** 帮助 label_object_page_picture.html：打印时未找到图片该如何处理。
   *  error=按原样中止输出（默认，保持「缺图必须报错」的既有语义）；
   *  skip=忽略该对象不输出；placeholder=画占位框。 */
  missingImage?: 'error' | 'skip' | 'placeholder'
  source?: DataSource
  imageFit?: 'original' | 'scale' | 'fit' | 'fitBox'
  keepAspect?: boolean
  imageAlign?: 'center' | 'topLeft' | 'topCenter' | 'topRight' | 'middleRight' | 'bottomRight' | 'bottomCenter' | 'bottomLeft' | 'middleLeft'
  widthPercent?: number
  heightPercent?: number
}

export interface GroupObj extends BaseObj { type: 'group'; children: LabelObject[] }

export type LabelObject = TextObj | BarcodeObj | RfidObj | RectObj | LineObj | EllipseObj | TableObj | ImageObj | GroupObj

export function findObjectById(objects: LabelObject[], id: string | null | undefined): LabelObject | undefined {
  if (!id) return undefined
  for (const object of objects) {
    if (object.id === id) return object
    if (object.type === 'group') {
      const nested = findObjectById(object.children, id)
      if (nested) return nested
    }
  }
  return undefined
}

function translateObject(object: LabelObject, dx: number, dy: number): LabelObject {
  if (object.type !== 'group') return { ...object, x: round2(object.x + dx), y: round2(object.y + dy) }
  return { ...object, x: round2(object.x + dx), y: round2(object.y + dy), children: object.children.map((child) => translateObject(child, dx, dy)) }
}

/** Update a nested object without flattening the group model. */
export function updateObjectById(objects: LabelObject[], id: string, patch: Partial<LabelObject>): LabelObject[] {
  return objects.map((object) => {
    if (object.id === id) {
      let merged = { ...object, ...patch } as LabelObject
      if (object.type === 'group') {
        const dx = typeof patch.x === 'number' ? patch.x - object.x : 0
        const dy = typeof patch.y === 'number' ? patch.y - object.y : 0
        if (dx || dy) merged = { ...merged, children: object.children.map((child) => translateObject(child, dx, dy)) } as LabelObject
      }
      return merged
    }
    return object.type === 'group' ? { ...object, children: updateObjectById(object.children, id, patch) } : object
  })
}

export function removeObjectById(objects: LabelObject[], id: string): LabelObject[] {
  return objects.filter((object) => object.id !== id).map((object) => object.type === 'group' ? { ...object, children: removeObjectById(object.children, id) } : object)
}

/**
 * Remove the dataset binding from every object in a document, including
 * objects nested in groups and secondary data sources. Keeping this operation
 * in the domain layer prevents UI code from accidentally updating only the
 * top-level object array.
 */
export function replaceDatasetReferences(objects: LabelObject[], datasetName: string): LabelObject[] {
  let changed = false
  const replaceSource = (source: unknown): unknown => {
    if (!source || typeof source !== 'object') return source
    const value = source as { kind?: string; dataset?: string }
    if (value.kind !== 'database' || value.dataset !== datasetName) return source
    changed = true
    return { kind: 'constant', value: '' }
  }
  const walk = (items: LabelObject[]): LabelObject[] => items.map((object) => {
    let next = object as LabelObject
    if ('source' in object && object.source) {
      const source = replaceSource(object.source)
      if (source !== object.source) next = { ...next, source } as LabelObject
    }
    if ('subSources' in object && object.subSources) {
      const subSources = object.subSources.map((source) => replaceSource(source) as typeof source)
      if (subSources.some((source, index) => source !== object.subSources?.[index])) next = { ...next, subSources } as LabelObject
    }
    if (object.type === 'group') {
      const children = walk(object.children)
      if (children !== object.children) next = { ...object, children } as LabelObject
    }
    return next
  })
  const result = walk(objects)
  return changed ? result : objects
}

/** Rename a database field binding recursively, including group descendants
 * and secondary sources. */
export function renameDatasetFieldReferences(objects: LabelObject[], datasetName: string, field: string, nextField: string): LabelObject[] {
  let changed = false
  const renameSource = (source: unknown): unknown => {
    if (!source || typeof source !== 'object') return source
    const value = source as { kind?: string; dataset?: string; field?: string }
    if (value.kind !== 'database' || value.dataset !== datasetName || value.field !== field) return source
    changed = true
    return { ...value, field: nextField }
  }
  const walk = (items: LabelObject[]): LabelObject[] => items.map((object) => {
    let next = object as LabelObject
    if ('source' in object && object.source) {
      const source = renameSource(object.source)
      if (source !== object.source) next = { ...next, source } as LabelObject
    }
    if ('subSources' in object && object.subSources) {
      const subSources = object.subSources.map((source) => renameSource(source) as typeof source)
      if (subSources.some((source, index) => source !== object.subSources?.[index])) next = { ...next, subSources } as LabelObject
    }
    if (object.type === 'group') {
      const children = walk(object.children)
      if (children !== object.children) next = { ...object, children } as LabelObject
    }
    return next
  })
  const result = walk(objects)
  return changed ? result : objects
}

/** Reorder an object in the array that owns it, including nested groups. */
export function reorderObjectById(objects: LabelObject[], id: string, direction: -1 | 1): LabelObject[] {
  const index = objects.findIndex((object) => object.id === id)
  if (index >= 0) {
    const target = index + direction
    if (target < 0 || target >= objects.length) return objects
    const next = [...objects]
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  }
  let changed = false
  const next = objects.map((object) => {
    if (object.type !== 'group') return object
    const children = reorderObjectById(object.children, id, direction)
    if (children === object.children) return object
    changed = true
    return { ...object, children }
  })
  return changed ? next : objects
}

/** 展平分组对象：子对象保持绝对毫米坐标，组旋转围绕组中心。 */
export function flattenObjects(objects: LabelObject[], options: { includeSuppressed?: boolean } = {}): LabelObject[] {
  const out: LabelObject[] = []
  const walk = (arr: LabelObject[], parentTransform = identityAffine, parentRotation = 0) => {
    for (const o of arr) {
      if (o.visible === false || (o.suppressPrint && !options.includeSuppressed)) continue
      const point = applyAffine(parentTransform, { x: o.x, y: o.y })
      const rotation = round2((o.rotation || 0) + parentRotation)
      if (o.type !== 'group') {
        out.push({ ...o, x: round2(point.x), y: round2(point.y), rotation } as LabelObject)
        continue
      }
      // Group coordinates are the center, while child coordinates remain
      // absolute in the document. Compose the ancestor transform before
      // applying this group's rotation around its own center.
      const localTransform = rotationAround(o.x, o.y, o.rotation || 0)
      walk(o.children, multiplyAffine(parentTransform, localTransform), rotation)
    }
  }
  walk(objects)
  return out
}

export interface ColorChangePlan {
  /** solid：单一颜色；chars：逐字符颜色；block/gradient：按区块循环的颜色。 */
  kind: 'solid' | 'chars' | 'block' | 'gradient'
  colors: string[]
  rows: number
  cols: number
}

/** 命名变量取值：键盘输入优先，其次数据库当前记录行（帮助 color_main.html）。 */
export function resolveNamedVariable(name: string, ctx: DataCtx | undefined): string | undefined {
  if (!name || !ctx) return undefined
  const kv = ctx.keyboardValues?.[name]
  if (kv) return kv
  const ds = ctx.activeDataset ? ctx.datasets?.[ctx.activeDataset] : undefined
  if (ds) {
    const col = ds.columns.indexOf(name)
    if (col >= 0 && ctx.recordRow && ctx.recordRow[col] != null) return ctx.recordRow[col] || undefined
  }
  return undefined
}

function colorTableFor(cc: ColorChangeConfig, sharedTable: string[] | undefined): string[] {
  const table = cc.tableSource === 'shared' ? (sharedTable ?? []) : (cc.privateTable ?? [])
  return table.length ? table : DEFAULT_COLOR_INDEX_TABLE
}

function pickColor(table: string[], index: number, fallback: string): string {
  if (!table.length) return fallback
  const i = ((index % table.length) + table.length) % table.length
  return table[i] || fallback
}

/** 随机颜色模式：按标签序号与位置派生，保证预览与指令输出得到同一结果。 */
function pseudoRandomIndex(seed: number, position: number, tableSize: number): number {
  if (tableSize <= 0) return 0
  const mixed = Math.abs(Math.imul(seed * 2654435761 + position * 40503 + 1013904223, 2246822519)) >>> 0
  return mixed % tableSize
}

function labelSeed(ctx: DataCtx | undefined): number {
  return ctx ? ctx.labelIndex * 7919 + ctx.copy * 104729 + (ctx.recordIndex >= 0 ? ctx.recordIndex : 0) : 0
}

function interpolateColor(from: string, to: string, t: number): string {
  const parse = (value: string): [number, number, number] | null => {
    const m = /^#([0-9a-f]{6})$/i.exec(value.trim())
    if (!m) return null
    const n = parseInt(m[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const a = parse(from)
  const b = parse(to)
  if (!a || !b) return t < 0.5 ? from : to
  const mix = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return '#' + mix.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
}

/**
 * 统一解析对象可变颜色，产出渲染/指令输出共用的取色方案。
 * 预览、位图输出与指令输出都走这里，保证三处颜色一致（架构红线）。
 */
export function resolveColorChangePlan(
  obj: { type: ObjType; colorChange?: ColorChangeConfig },
  ctx: DataCtx | undefined,
  fallback: string,
  sharedTable?: string[],
  content?: string
): ColorChangePlan {
  const solid: ColorChangePlan = { kind: 'solid', colors: [fallback], rows: 1, cols: 1 }
  const cc = obj.colorChange
  if (!cc || cc.mode === 'fixed') return solid
  const allowed = colorGranularityOptions(obj.type)
  if (!allowed.length) return solid
  // 粒度按对象类型收敛（帮助：直线/矩形/图片仅整体变色）
  const changeMode: ColorChangeGranularity = allowed.includes(cc.changeMode) ? cc.changeMode : 'solid'
  const table = colorTableFor(cc, sharedTable)

  let chars: string
  let values: string[]
  switch (cc.mode) {
    case 'indexByContent':
      chars = obj.type === 'text' || obj.type === 'barcode' ? (content ?? '') : ''
      if (!chars) return { kind: 'solid', colors: [pickColor(table, 0, fallback)], rows: 1, cols: 1 }
      values = []
      break
    case 'indexVar':
      values = []
      chars = resolveNamedVariable(cc.variableName, ctx) ?? ''
      if (!chars) return solid
      break
    case 'index':
      values = []
      chars = cc.inputValue ?? ''
      if (!chars) return solid
      break
    case 'valueVar': {
      chars = ''
      const raw = resolveNamedVariable(cc.variableName, ctx)
      values = parseColorValues(raw)
      if (!values.length) return solid
      break
    }
    case 'rgb':
      chars = ''
      values = parseColorValues(cc.inputValue)
      if (!values.length) return solid
      break
    case 'random':
    default:
      // 随机颜色按逐字符/区块位置各取一色，位置个数沿用对象内容长度
      chars = content ?? ''
      values = []
      break
  }

  const hasValues = values.length > 0
  const unit = hasValues ? values.length : table.length
  /** 取第 position 个基本颜色（字符索引 / 颜色值 / 随机）。 */
  const unitColor = (position: number): string => {
    if (cc.mode === 'random') return pickColor(table, pseudoRandomIndex(labelSeed(ctx), position, table.length), fallback)
    if (hasValues) return values[position % values.length] || fallback
    const ch = chars[position % Math.max(1, chars.length)] ?? ''
    return pickColor(table, colorIndexForChar(ch), fallback)
  }

  if (changeMode === 'solid') {
    // 整体变色：内容索引模式取第一个字符；颜色值模式取第一个颜色值
    const first = hasValues ? unitColor(0) : (chars ? unitColor(0) : (cc.mode === 'random' ? unitColor(0) : fallback))
    return { kind: 'solid', colors: [first], rows: 1, cols: 1 }
  }
  if (changeMode === 'char') {
    const count = hasValues ? values.length : Math.max(1, Array.from(chars).length)
    return { kind: 'chars', colors: Array.from({ length: count }, (_, i) => unitColor(i)), rows: 1, cols: count }
  }
  const rows = Math.max(1, cc.blockRows || 1)
  const cols = Math.max(1, cc.blockCols || 1)
  const count = rows * cols
  if (changeMode === 'gradient') {
    const first = unitColor(0)
    const last = unitColor(Math.max(1, unit - 1))
    const colors = Array.from({ length: count }, (_, i) => (count <= 1 ? first : interpolateColor(first, last, i / (count - 1))))
    return { kind: 'gradient', colors, rows, cols }
  }
  return { kind: 'block', colors: Array.from({ length: count }, (_, i) => unitColor(i)), rows, cols }
}

/** 兼容入口：返回对象可变颜色的代表色（整体/首字符）。 */
export function resolveObjectColor(obj: { type?: ObjType; colorChange?: ColorChangeConfig }, ctx: DataCtx | undefined, fallback: string, sharedTable?: string[], content?: string): string {
  const plan = resolveColorChangePlan({ type: obj.type ?? 'text', colorChange: obj.colorChange }, ctx, fallback, sharedTable, content)
  return plan.colors[0] ?? fallback
}
