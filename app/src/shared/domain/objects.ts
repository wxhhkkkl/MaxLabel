import type { DataCtx, DataSource, LengthLimit, Substr, TextFormat } from './datasource'
import { round2 } from './units'
import { applyAffine, identityAffine, multiplyAffine, rotationAround } from './transform'

export type ObjType = 'text' | 'barcode' | 'rfid' | 'rect' | 'line' | 'ellipse' | 'table' | 'image' | 'group'

export interface ColorChangeConfig {
  mode: 'fixed' | 'index' | 'variable'
  tableSource: 'shared' | 'private'
  privateTable: string[]
  changeMode: 'solid' | 'block' | 'gradient'
  blockRows: number
  blockCols: number
  variableName: string
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
  itf14BearerRatio?: number
  itf14QuietRatio?: number
  hanxinVersion?: string
  itf25Check?: boolean
  codabarCheck?: 'none' | 'mod10' | 'library'
  codabarStart?: 'a' | 'b' | 'c' | 'd'
  codabarStop?: 'a' | 'b' | 'c' | 'd'
  rssGs1?: boolean
  rssType?: 'omni' | 'truncated' | 'stacked' | 'stackedomni' | 'limited'
  rssSep?: number
  humanPosition?: 'below' | 'above' | 'none'
  humanAlign?: 'left' | 'center' | 'right'
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
  source: DataSource
  format?: TextFormat
  substr?: Substr
  lengthLimit?: LengthLimit
  charTemplate?: string
  subSources?: DataSource[]
  barcodeOptions?: BarcodeOptions
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
  dataType?: 'hex' | 'ascii'
  pcWord?: string
  codeHead?: string
  codeLen?: number
  lockOp?: 'lock' | 'unlock' | 'permanent'
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
}

export interface LineObj extends BaseObj { type: 'line'; stroke: string; strokeWidth: number }

export interface EllipseObj extends BaseObj {
  type: 'ellipse'
  colorChange?: ColorChangeConfig
  fill: string
  stroke: string
  strokeWidth: number
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
  src: string
  imgType?: 'embed' | 'link' | 'datasource'
  linkPath?: string
  source?: DataSource
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

export function resolveObjectColor(obj: { colorChange?: ColorChangeConfig }, ctx: DataCtx | undefined, fallback: string, sharedTable?: string[]): string {
  const cc = obj.colorChange
  if (!cc || cc.mode === 'fixed') return fallback
  if (cc.mode === 'index') {
    const table = cc.tableSource === 'shared' ? (sharedTable ?? []) : (cc.privateTable ?? [])
    if (!table.length) return fallback
    const recIdx = ctx ? (ctx.recordIndex >= 0 ? ctx.recordIndex : ctx.labelIndex - 1) : 0
    const idx = ((recIdx % table.length) + table.length) % table.length
    return table[idx] || fallback
  }
  if (cc.mode === 'variable') {
    const name = cc.variableName
    if (!name) return fallback
    const kv = ctx?.keyboardValues?.[name]
    if (kv) return kv
    const ds = ctx?.activeDataset ? ctx.datasets?.[ctx.activeDataset] : undefined
    if (ds && ctx) {
      const col = ds.columns.indexOf(name)
      if (col >= 0 && ctx.recordRow && ctx.recordRow[col] != null) return ctx.recordRow[col] || fallback
    }
  }
  return fallback
}
