import type { DataCtx } from '../domain/datasource'
import type { LabelDoc } from '../domain/document'
import type { PaperGeometry, PaperShape } from '../domain/paper'
import type { BarcodeObj, EllipseObj, ImageObj, LineObj, RectObj, RfidObj, TableObj, TextObj } from '../domain/objects'
import type { MonoBitmap } from '../domain/units'
import { flattenObjects } from '../domain/objects'
import { resolveObjectText, runGlobalScriptHook } from '../domain/datasource'
import { cellContext, normalizePageOrientation, orientedLabelSize, pageCells, pageSizeMm, type PageLayout } from './layout'
import type { PrintPlanPage } from './plan'
import type { PrintPlan } from './plan'

type Primitive =
  | { kind: 'text'; object: TextObj; value: string; bitmap?: MonoBitmap }
  | { kind: 'barcode'; object: BarcodeObj; value: string; bitmap?: MonoBitmap }
  | { kind: 'rfid'; object: RfidObj; value: string }
  | { kind: 'rect'; object: RectObj }
  | { kind: 'line'; object: LineObj }
  | { kind: 'ellipse'; object: EllipseObj }
  | { kind: 'table'; object: TableObj }
  | { kind: 'image'; object: ImageObj; sourceValue?: string; bitmap?: MonoBitmap }

export type ResolvedPrintPrimitive = Primitive & { labelIndex: number; context: DataCtx }

/**
 * 与 UI、Fabric、打印机语言无关的打印场景。
 * 数据源、组合展开、可见性和 suppressPrint 只在生成场景时计算一次。
 */
export interface ResolvedPrintScene {
  readonly widthMm: number
  readonly heightMm: number
  readonly labelIndex: number
  readonly copy: number
  readonly primitives: ReadonlyArray<ResolvedPrintPrimitive>
  readonly labelShape?: PaperShape
  readonly paperGeometry?: Readonly<PaperGeometry>
  readonly labelCells?: ReadonlyArray<{ x: number; y: number; widthMm: number; heightMm: number }>
  readonly colorIndexTable?: ReadonlyArray<string>
  /** Optional complete-page bitmap used when native commands cannot preserve the scene faithfully. */
  readonly pageBitmap?: MonoBitmap
}

/** 一个物理页的不可变解析结果。位图和协议适配器都应消费它。 */
export interface ResolvedPrintJobPage {
  readonly page: PrintPlanPage
  readonly scene: ResolvedPrintScene
}

/** 打印应用服务使用的解析作业。解析后的数据不再回到 LabelDoc 重新求值。 */
export interface ResolvedPrintJob {
  readonly plan: PrintPlan
  readonly pages: ReadonlyArray<ResolvedPrintJobPage>
  readonly totalPhysicalLabelCount: number
}

function snapshotContext(ctx: DataCtx): DataCtx {
  // Resolved primitives must not retain the full source datasets.  A print job
  // may contain thousands of cells; copying every row into every cell's
  // immutable snapshot turns a normal batch into O(cells × dataset rows)
  // memory use.  Adapters only need the current row and the active dataset's
  // column names for variable-driven color changes. Resource bitmaps are
  // already attached to each primitive; retaining the complete image map in
  // every context would recreate a cells×resources memory cost.
  const activeName = ctx.activeDataset
  const activeDataset = activeName ? ctx.datasets[activeName] : undefined
  const datasets = activeName && activeDataset
    ? {
        [activeName]: Object.freeze({
          name: activeDataset.name,
          columns: Object.freeze([...activeDataset.columns]),
          rows: Object.freeze([] as string[][])
        })
      }
    : {}
  return Object.freeze({
    ...ctx,
    datasets: Object.freeze(datasets),
    sharedVars: Object.freeze({ ...ctx.sharedVars }),
    keyboardValues: Object.freeze({ ...ctx.keyboardValues }),
    recordRow: ctx.recordRow ? Object.freeze([...ctx.recordRow]) : undefined
  }) as unknown as DataCtx
}

function immutableScene(widthMm: number, heightMm: number, labelIndex: number, copy: number, primitives: ResolvedPrintPrimitive[], pageBitmap?: MonoBitmap, labelShape?: PaperShape, labelCells?: ReadonlyArray<{ x: number; y: number; widthMm: number; heightMm: number }>, colorIndexTable?: ReadonlyArray<string>, paperGeometry?: PaperGeometry): ResolvedPrintScene {
  const contextSnapshots = new Map<DataCtx, DataCtx>()
  const contextOf = (context: DataCtx): DataCtx => {
    const previous = contextSnapshots.get(context)
    if (previous) return previous
    const snapshot = snapshotContext(context)
    contextSnapshots.set(context, snapshot)
    return snapshot
  }
  const safePrimitives = primitives.map((primitive) => Object.freeze({
    ...primitive,
    object: Object.freeze({ ...primitive.object }),
    context: contextOf(primitive.context)
  })) as ResolvedPrintPrimitive[]
  return Object.freeze({ ...(paperGeometry ? { paperGeometry: Object.freeze({ ...paperGeometry }) } : {}), widthMm, heightMm, labelIndex, copy, primitives: Object.freeze(safePrimitives), ...(labelShape ? { labelShape } : {}), ...(labelCells ? { labelCells: Object.freeze(labelCells.map((cell) => Object.freeze({ ...cell }))) } : {}), ...(colorIndexTable ? { colorIndexTable: Object.freeze([...colorIndexTable]) } : {}), ...(pageBitmap ? { pageBitmap: Object.freeze(pageBitmap) } : {}) })
}

function orientObject(object: Exclude<import('../domain/objects').LabelObject, import('../domain/objects').GroupObj>, doc: LabelDoc) {
  const orientation = normalizePageOrientation(doc.orientation)
  if (orientation === 0) return object
  const { widthMm, heightMm } = doc
  const x = object.x
  const y = object.y
  const w = object.w
  const h = object.h
  if (orientation === 90) {
    return { ...object, x: heightMm - (y + h), y: x, w: h, h: w, rotation: (object.rotation + orientation) % 360 }
  }
  if (orientation === 180) {
    return { ...object, x: widthMm - (x + w), y: heightMm - (y + h), rotation: (object.rotation + orientation) % 360 }
  }
  return { ...object, x: y, y: widthMm - (x + w), w: h, h: w, rotation: (object.rotation + orientation) % 360 }
}

type PrintableObject = Exclude<import('../domain/objects').LabelObject, import('../domain/objects').GroupObj>

/** Compile document geometry once. Data values remain unresolved until a
 * record context is available, so one compiled template can serve every cell
 * and copy in a print plan. */
export function compilePrintTemplate(doc: LabelDoc, options: { includeSuppressed?: boolean } = {}): PrintableObject[] {
  return flattenObjects(doc.objects, options)
    .filter((object): object is PrintableObject => object.type !== 'group')
    .map((object) => orientObject(object, doc))
    .filter((object) => object.visible !== false && !(object.suppressPrint && !options.includeSuppressed))
}

function resolveCompiledPrimitives(objects: PrintableObject[], ctx: DataCtx): ResolvedPrintPrimitive[] {
  const primitives: ResolvedPrintPrimitive[] = []
  for (const object of objects) {
    if (object.type === 'text') {
      primitives.push({ kind: 'text', object, value: resolveObjectText(object, ctx), bitmap: ctx.images?.[object.id], labelIndex: ctx.labelIndex, context: ctx })
    } else if (object.type === 'barcode') {
      primitives.push({ kind: 'barcode', object, value: resolveObjectText(object, ctx), bitmap: ctx.images?.[object.id], labelIndex: ctx.labelIndex, context: ctx })
    } else if (object.type === 'rfid') {
      primitives.push({ kind: 'rfid', object, value: resolveObjectText(object, ctx), labelIndex: ctx.labelIndex, context: ctx })
    } else if (object.type === 'image') {
      const sourceValue = object.source ? resolveObjectText({ ...object, source: object.source }, ctx) : undefined
      primitives.push({ kind: 'image', object, sourceValue, bitmap: ctx.images?.[object.id], labelIndex: ctx.labelIndex, context: ctx })
    } else {
      primitives.push({ kind: object.type, object, labelIndex: ctx.labelIndex, context: ctx } as ResolvedPrintPrimitive)
    }
  }
  return primitives
}

export function resolvePrintScene(doc: LabelDoc, ctx: DataCtx, options: { includeSuppressed?: boolean } = {}): ResolvedPrintScene {
  const begin = runGlobalScriptHook(doc.globalScript, ctx, 'OnBeginLabel')
  const primitives = resolveCompiledPrimitives(compilePrintTemplate(doc, options), begin)
  const end = runGlobalScriptHook(doc.globalScript, begin, 'OnEndLabel')
  for (const primitive of primitives) primitive.context = end
  const size = orientedLabelSize(doc)
  return immutableScene(size.widthMm, size.heightMm, ctx.labelIndex, Math.max(1, ctx.copy), primitives, undefined, doc.layout?.shape, [{ x: 0, y: 0, widthMm: size.widthMm, heightMm: size.heightMm }], doc.colorIndexTable, { shape: doc.layout?.shape, cornerRadiusMm: doc.layout?.cornerRadiusMm, innerDiameterMm: doc.layout?.innerDiameterMm })
}

/** 解析包含多枚标签的物理页面，所有输出后端共用相同偏移。 */
export function resolvePrintPageScene(
  doc: LabelDoc,
  ctx: DataCtx,
  layout?: PageLayout,
  imagesForLabel?: (labelIndex: number) => Record<string, MonoBitmap> | undefined,
  options: { includeSuppressed?: boolean } = {}
): ResolvedPrintScene {
  const size = pageSizeMm(doc, layout)
  const primitives: ResolvedPrintPrimitive[] = []
  const compiled = compilePrintTemplate(doc, options)
  for (const cell of pageCells(doc, layout)) {
    let current = cellContext(ctx, cell.index)!
    current = runGlobalScriptHook(doc.globalScript, current, 'OnBeginLabel')
    if (imagesForLabel) current.images = imagesForLabel(current.labelIndex)
    for (const primitive of resolveCompiledPrimitives(compiled, current)) {
      primitives.push({
        ...primitive,
        object: { ...primitive.object, x: primitive.object.x + cell.x, y: primitive.object.y + cell.y }
      } as ResolvedPrintPrimitive)
    }
    current = runGlobalScriptHook(doc.globalScript, current, 'OnEndLabel')
  }
  const label = orientedLabelSize(doc)
  return immutableScene(size.widthMm, size.heightMm, ctx.labelIndex, Math.max(1, ctx.copy), primitives, undefined, doc.layout?.shape, pageCells(doc, layout).map((cell) => ({ ...cell, widthMm: label.widthMm, heightMm: label.heightMm })), doc.colorIndexTable, { shape: doc.layout?.shape, cornerRadiusMm: doc.layout?.cornerRadiusMm, innerDiameterMm: doc.layout?.innerDiameterMm })
}

/** Resolve a page using an explicit print plan (including per-page copies). */
export function resolvePrintPlanPageScene(
  doc: LabelDoc,
  ctx: DataCtx,
  layout: PageLayout | undefined,
  page: PrintPlanPage,
  imagesForLabel?: (labelIndex: number) => Record<string, MonoBitmap> | undefined,
  options: { includeSuppressed?: boolean } = {}
): ResolvedPrintScene {
  const size = pageSizeMm(doc, layout)
  const positions = pageCells(doc, layout)
  const primitives: ResolvedPrintPrimitive[] = []
  const compiled = compilePrintTemplate(doc, options)
  for (let index = 0; index < page.cells.length; index += 1) {
    const cell = page.cells[index]
    const position = positions[cell.slotIndex]
    if (!position) break
    const dataset = ctx.activeDataset ? ctx.datasets[ctx.activeDataset] : undefined
    let current: DataCtx = {
      ...ctx,
      labelIndex: cell.labelIndex,
      recordIndex: cell.recordIndex,
      copy: cell.copies,
      recordRow: dataset?.rows[cell.recordIndex],
      sharedVars: { ...ctx.sharedVars },
      images: imagesForLabel?.(cell.labelIndex)
    }
    current = runGlobalScriptHook(doc.globalScript, current, 'OnBeginLabel')
    for (const primitive of resolveCompiledPrimitives(compiled, current)) {
      primitives.push({
        ...primitive,
        object: { ...primitive.object, x: primitive.object.x + position.x, y: primitive.object.y + position.y }
      } as ResolvedPrintPrimitive)
    }
    current = runGlobalScriptHook(doc.globalScript, current, 'OnEndLabel')
  }
  const label = orientedLabelSize(doc)
  return immutableScene(size.widthMm, size.heightMm, page.cells[0]?.labelIndex ?? ctx.labelIndex, Math.max(1, page.copies), primitives, undefined, doc.layout?.shape, positions.map((cell) => ({ ...cell, widthMm: label.widthMm, heightMm: label.heightMm })), doc.colorIndexTable, { shape: doc.layout?.shape, cornerRadiusMm: doc.layout?.cornerRadiusMm, innerDiameterMm: doc.layout?.innerDiameterMm })
}

/**
 * Resolve one print batch into immutable page scenes.
 * Callers may pass a slice of a larger plan; logicalLabelCount remains the
 * original job count so serial/date/script expressions keep the same context.
 */
export function resolvePrintJob(
  doc: LabelDoc,
  ctx: DataCtx,
  layout: PageLayout | undefined,
  plan: PrintPlan,
  options: { includeSuppressed?: boolean } = {}
): ResolvedPrintJob {
  const safePlan = Object.freeze({
    ...plan,
    pages: Object.freeze(plan.pages.map((page) => Object.freeze({
      ...page,
      cells: Object.freeze(page.cells.map((cell) => Object.freeze({ ...cell })))
    }))),
    warnings: Object.freeze([...plan.warnings])
  }) as unknown as PrintPlan
  const pages = safePlan.pages.map((page) => Object.freeze({
    page,
    scene: resolvePrintPlanPageScene(doc, ctx, layout, page, undefined, options)
  }))
  return Object.freeze({ plan: safePlan, pages: Object.freeze(pages), totalPhysicalLabelCount: safePlan.physicalLabelCount })
}

/** Attach pre-rendered bitmaps without changing the resolved values or geometry. */
export function attachSceneBitmaps(scene: ResolvedPrintScene, bitmaps: Map<string, MonoBitmap>): ResolvedPrintScene {
  return immutableScene(scene.widthMm, scene.heightMm, scene.labelIndex, scene.copy, scene.primitives.map((primitive) => ({
    ...primitive,
    bitmap: ('bitmap' in primitive ? bitmaps.get(`${primitive.labelIndex}:${primitive.object.id}`) ?? primitive.bitmap : undefined)
  })) as ResolvedPrintPrimitive[], scene.pageBitmap, scene.labelShape, scene.labelCells, scene.colorIndexTable, scene.paperGeometry)
}

export function attachScenePageBitmap(scene: ResolvedPrintScene, pageBitmap: MonoBitmap): ResolvedPrintScene {
  return immutableScene(scene.widthMm, scene.heightMm, scene.labelIndex, scene.copy, [...scene.primitives], pageBitmap, scene.labelShape, scene.labelCells, scene.colorIndexTable, scene.paperGeometry)
}

/** 将场景图元转换成只含常量数据的对象，供 Fabric 等表现层适配器使用。 */
export function materializeScenePrimitive(primitive: ResolvedPrintPrimitive): Exclude<import('../domain/objects').LabelObject, import('../domain/objects').GroupObj> {
  if (primitive.kind === 'text' || primitive.kind === 'barcode' || primitive.kind === 'rfid') {
    return {
      ...primitive.object,
      source: { kind: 'constant', value: primitive.value },
      subSources: undefined,
      format: undefined,
      substr: undefined,
      lengthLimit: undefined,
      charTemplate: undefined
    }
  }
  if (primitive.kind === 'image' && primitive.sourceValue !== undefined) {
    return { ...primitive.object, source: { kind: 'constant', value: primitive.sourceValue } }
  }
  return primitive.object
}
