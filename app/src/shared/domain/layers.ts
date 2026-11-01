import type { LabelDoc } from './document'
import type { LabelObject } from './objects'

/**
 * 真图层的共享规则（019）。
 *
 * ⚠️ 这里只放**纯函数**：图层的归一化、有效可见/锁定、渲染顺序与计数。
 * 面板、画布、打印都消费这里的结论，避免「图层可见但画布仍画」这类分裂。
 */

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
}

/** 默认图层：始终存在、位于最底层、不可删除 */
export const DEFAULT_LAYER_ID = 'default'
export const MAX_DOCUMENT_LAYERS = 100
export const MAX_LAYER_NAME_LENGTH = 128

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function createDefaultLayer(): Layer {
  return { id: DEFAULT_LAYER_ID, name: '默认', visible: true, locked: false }
}

/**
 * 归一化图层列表：
 * - 缺失/空 → 只有默认图层；
 * - 默认图层**永远排在最底层**（数组首位）；
 * - id 去空白、去重；名称为空回退 id；名称裁剪到 128 字符；
 * - 最多保留 MAX_DOCUMENT_LAYERS 个。
 */
export function normalizeLayers(value: unknown): Layer[] {
  const entries = Array.isArray(value) ? value : []
  const byId = new Map<string, Layer>()
  let defaultLayer = createDefaultLayer()
  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.id !== 'string') continue
    const id = entry.id.trim().slice(0, 128)
    if (!id) continue
    const nameRaw = typeof entry.name === 'string' ? entry.name.trim() : ''
    const fallback = id === DEFAULT_LAYER_ID ? '默认' : id
    const layer: Layer = {
      id,
      name: (nameRaw || fallback).slice(0, MAX_LAYER_NAME_LENGTH),
      visible: entry.visible !== false,
      locked: entry.locked === true
    }
    if (id === DEFAULT_LAYER_ID) {
      defaultLayer = layer
      continue
    }
    if (!byId.has(id)) byId.set(id, layer)
  }
  return [defaultLayer, ...byId.values()].slice(0, MAX_DOCUMENT_LAYERS)
}

export function layerById(layers: Layer[] | undefined, id: string | null | undefined): Layer | undefined {
  if (!id) return undefined
  return layers?.find((layer) => layer.id === id)
}

/** 对象所属的有效图层 id：未知/缺失一律视为默认图层 */
export function effectiveLayerId(layers: Layer[], object: Pick<LabelObject, 'layerId'>): string {
  const id = typeof object.layerId === 'string' ? object.layerId : ''
  return layers.some((layer) => layer.id === id) ? id : DEFAULT_LAYER_ID
}

/** 对象是否可见：对象自身可见 **且** 所属图层可见 */
export function isObjectVisible(
  doc: Pick<LabelDoc, 'layers'>,
  object: Pick<LabelObject, 'layerId' | 'visible'>
): boolean {
  const layers = normalizeLayers(doc.layers)
  const layer = layerById(layers, effectiveLayerId(layers, object))
  return object.visible !== false && layer?.visible !== false
}

/** 对象是否锁定：对象自身锁定 **或** 所属图层锁定 */
export function isObjectLocked(
  doc: Pick<LabelDoc, 'layers'>,
  object: Pick<LabelObject, 'layerId' | 'locked'>
): boolean {
  const layers = normalizeLayers(doc.layers)
  const layer = layerById(layers, effectiveLayerId(layers, object))
  return object.locked === true || layer?.locked === true
}

/**
 * 按「图层从底到顶、层内保持原顺序」排出的对象列表。
 * `doc.objects` 仍是唯一 z-order 来源；图层只决定分段顺序。
 */
export function orderedObjects(doc: Pick<LabelDoc, 'layers' | 'objects'>): LabelObject[] {
  const layers = normalizeLayers(doc.layers)
  const buckets = new Map<string, LabelObject[]>()
  layers.forEach((layer) => buckets.set(layer.id, []))
  for (const object of doc.objects ?? []) {
    const layerId = effectiveLayerId(layers, object)
    const bucket = buckets.get(layerId) ?? buckets.get(DEFAULT_LAYER_ID)
    bucket?.push(object)
  }
  return layers.flatMap((layer) => buckets.get(layer.id) ?? [])
}

/** 在 orderedObjects 基础上过滤掉对象自身或图层不可见的对象 */
export function orderedVisibleObjects(doc: Pick<LabelDoc, 'layers' | 'objects'>): LabelObject[] {
  return orderedObjects(doc).filter((object) => isObjectVisible(doc, object))
}

/** 某图层的对象数（分组算 1 个） */
export function objectCountOfLayer(doc: Pick<LabelDoc, 'layers' | 'objects'>, layerId: string): number {
  const layers = normalizeLayers(doc.layers)
  return (doc.objects ?? []).filter((object) => effectiveLayerId(layers, object) === layerId).length
}

/**
 * 把对象（含分组子项）归到指定图层；分组内所有子对象跟随父组，不允许跨层。
 */
export function assignLayerDeep(object: LabelObject, layerId: string): LabelObject {
  if (object.type === 'group') {
    return {
      ...object,
      layerId,
      children: object.children.map((child) => assignLayerDeep(child, layerId))
    } as LabelObject
  }
  return { ...object, layerId } as LabelObject
}

// ══════════════════════════════════════════════════════════════════════════
// 文档级图层操作（纯函数）
//
// ⚠️ 所有函数都返回**新文档**、不修改入参；调用方（useDocumentCommands）把它们
// 放进 applyDocument，从而自动获得撤销/重做历史。
// ══════════════════════════════════════════════════════════════════════════

/** 复制图层时给对象换新 id（分组递归） */
function cloneObjectsWithNewIds(objects: LabelObject[], uid: () => string): LabelObject[] {
  return objects.map((object) => {
    if (object.type === 'group') {
      return { ...object, id: uid(), children: cloneObjectsWithNewIds(object.children, uid) }
    }
    return { ...object, id: uid() }
  })
}

/** 在图层顺序里找到某层的下标；未知返回 -1 */
function layerIndex(layers: Layer[], id: string): number {
  return layers.findIndex((layer) => layer.id === id)
}

/** 用新的图层顺序重建 doc.objects 的段顺序（保持层内相对顺序） */
function reorderObjectsByLayers(doc: LabelDoc, layers: Layer[]): LabelObject[] {
  return orderedObjects({ ...doc, layers })
}

export function addLayer(doc: LabelDoc, layer: Layer): LabelDoc {
  const layers = normalizeLayers([...(doc.layers ?? []), layer])
  return { ...doc, layers, objects: doc.objects }
}

/**
 * 是否有**其他**图层用了这个名字（FR-022：允许同名，但保存时要提示）。
 * 改回自己原来的名字不算重名。
 */
export function hasDuplicateLayerName(layers: Layer[] | undefined, id: string, name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  return normalizeLayers(layers).some((layer) => layer.id !== id && layer.name === trimmed)
}

export function renameLayer(doc: LabelDoc, id: string, name: string): LabelDoc {
  const trimmed = name.trim()
  if (!trimmed) return doc
  const layers = normalizeLayers(doc.layers).map((layer) =>
    layer.id === id ? { ...layer, name: trimmed.slice(0, MAX_LAYER_NAME_LENGTH) } : layer)
  return { ...doc, layers }
}

/** 删除图层：默认图层拒绝；其余连同其下对象一起删除（Q1） */
export function deleteLayer(doc: LabelDoc, id: string): LabelDoc {
  if (id === DEFAULT_LAYER_ID) return doc
  const layers = normalizeLayers(doc.layers).filter((layer) => layer.id !== id)
  // 按对象**原始** layerId 删除，不能让缺失/未知归属因回退默认而逃过删除
  const objects = doc.objects.filter((object) => object.layerId !== id)
  return { ...doc, layers, objects }
}

/** 复制图层：连同对象、新 id，副本插在原层上方；返回新图层 id（Q2/Q6） */
export function duplicateLayer(doc: LabelDoc, id: string, uid: () => string, suffix = '副本'): { doc: LabelDoc; layerId: string } {
  const layers = normalizeLayers(doc.layers)
  const index = layerIndex(layers, id)
  if (index < 0) return { doc, layerId: id }
  const source = layers[index]
  const layerId = uid()
  const copy: Layer = {
    ...source,
    id: layerId,
    name: `${source.name} ${suffix}`.slice(0, MAX_LAYER_NAME_LENGTH)
  }
  const nextLayers = [...layers.slice(0, index + 1), copy, ...layers.slice(index + 1)]
  const sourceObjects = doc.objects.filter((object) => effectiveLayerId(layers, object) === id)
  const copies = cloneObjectsWithNewIds(sourceObjects, uid).map((object) => assignLayerDeep(object, layerId))
  // 副本对象的 z-order 紧跟在原层对象之后
  const objects: LabelObject[] = []
  for (const object of doc.objects) {
    objects.push(object)
    if (object === sourceObjects[sourceObjects.length - 1]) objects.push(...copies)
  }
  return { doc: { ...doc, layers: nextLayers, objects }, layerId }
}

export function setLayerVisible(doc: LabelDoc, id: string, visible: boolean): LabelDoc {
  const layers = normalizeLayers(doc.layers).map((layer) =>
    layer.id === id ? { ...layer, visible } : layer)
  return { ...doc, layers }
}

export function setLayerLocked(doc: LabelDoc, id: string, locked: boolean): LabelDoc {
  const layers = normalizeLayers(doc.layers).map((layer) =>
    layer.id === id ? { ...layer, locked } : layer)
  return { ...doc, layers }
}

/** 图层上移/下移：同时把该层对象在 doc.objects 中整段移动（R2）。默认图层不动。 */
export function moveLayer(doc: LabelDoc, id: string, dir: -1 | 1): LabelDoc {
  const layers = normalizeLayers(doc.layers)
  const index = layerIndex(layers, id)
  const target = index + dir
  // 默认图层永远在首位，不允许被换下去
  if (index <= 0 || target < 1 || target >= layers.length) return doc
  const nextLayers = [...layers]
  ;[nextLayers[index], nextLayers[target]] = [nextLayers[target], nextLayers[index]]
  return { ...doc, layers: nextLayers, objects: reorderObjectsByLayers(doc, nextLayers) }
}

/** 把对象（含整组）移到指定图层；未知图层归默认 */
export function moveObjectsToLayer(doc: LabelDoc, ids: ReadonlySet<string>, layerId: string): LabelDoc {
  const layers = normalizeLayers(doc.layers)
  const target = layerById(layers, layerId)?.id ?? DEFAULT_LAYER_ID
  if (!ids.size) return doc
  const objects = doc.objects.map((object) => ids.has(object.id) ? assignLayerDeep(object, target) : object)
  return { ...doc, objects }
}

/** 删除图层后新的活动图层：先取上方相邻、再取下方相邻、最后回默认（Q5） */
export function activeLayerAfterDelete(layers: Layer[] | undefined, removedId: string, activeId: string | null): string {
  const list = normalizeLayers(layers)
  const index = list.findIndex((layer) => layer.id === removedId || layer.id === activeId)
  const candidates = [list[index + 1], list[index - 1], list[0]]
  return candidates.find((layer) => layer && layer.id !== removedId)?.id ?? DEFAULT_LAYER_ID
}

/** 新对象归属：活动图层存在且可见/未锁定时返回其 id，否则返回 null（Q4=B） */
export function creatableLayerId(doc: LabelDoc, activeLayerId: string | null): string | null {
  const layers = normalizeLayers(doc.layers)
  const active = layerById(layers, activeLayerId) ?? layerById(layers, DEFAULT_LAYER_ID)
  if (!active || active.visible === false || active.locked === true) return null
  return active.id
}
