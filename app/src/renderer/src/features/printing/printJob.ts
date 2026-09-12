import type { DataCtx, DataSource, LabelDoc, LabelObject, PrinterConfig } from '../../types'
import { advanceSerial, resolveObjectText } from '../../types'
import { printerNameOf } from '../../../../shared/print/engine'
import type { ResolvedPrintScene } from '../../../../shared/print/scene'

export interface DatasetView {
  name?: string
  columns: string[]
  rows: string[][]
}

export function activeDatasetView(doc: LabelDoc, preferredName?: string): DatasetView {
  const name = preferredName && doc.datasets?.[preferredName] ? preferredName : Object.keys(doc.datasets ?? {})[0]
  const dataset = name ? doc.datasets?.[name] : undefined
  return { name, columns: dataset?.columns ?? [], rows: dataset?.rows ?? [] }
}

export function createPrintContext(input: {
  doc: LabelDoc
  printer: PrinterConfig
  count: number
  copies: number
  recordIndex?: number
  labelIndex?: number
  keyboardValues?: Record<string, string>
  datasetName?: string
  allowScript?: boolean
  now?: number
}): DataCtx {
  const dataset = activeDatasetView(input.doc, input.datasetName)
  const recordIndex = input.recordIndex ?? 0
  return {
    labelIndex: input.labelIndex ?? 1,
    recordIndex,
    copy: input.copies,
    count: input.count,
    totalLabels: input.count * input.copies,
    title: input.doc.name,
    printerName: printerNameOf(input.printer),
    datasets: input.doc.datasets ?? {},
    sharedVars: {},
    keyboardValues: input.keyboardValues ?? {},
    allowScript: input.allowScript === true,
    now: Number.isFinite(input.now) ? Number(input.now) : Date.now(),
    recordRow: dataset.rows[recordIndex],
    activeDataset: dataset.name
  }
}

export function snapshotPrintData(doc: LabelDoc, base: DataCtx, count: number, recordIndices?: number[]): string[] {
  return Array.from({ length: count }, (_, index) => {
    const context: DataCtx = { ...base, labelIndex: index + 1, recordIndex: recordIndices?.[index] ?? (base.recordIndex ?? 0) + index, sharedVars: {} }
    return doc.objects.map((object) => {
      if (object.type === 'text' || object.type === 'barcode' || object.type === 'rfid') return resolveObjectText(object, context)
      return ''
    }).join(' | ')
  })
}

/** Snapshot values already resolved for the actual print batch. */
export function snapshotResolvedScene(scene: ResolvedPrintScene): string[] {
  const values = new Map<number, string[]>()
  for (const primitive of scene.primitives) {
    if (primitive.kind !== 'text' && primitive.kind !== 'barcode' && primitive.kind !== 'rfid') continue
    const row = values.get(primitive.labelIndex) ?? []
    row.push(primitive.value)
    values.set(primitive.labelIndex, row)
  }
  return [...values.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, row]) => row.join(' | '))
}

function advanceObject(object: LabelObject, count: number): LabelObject {
  if (object.type === 'group') return { ...object, children: object.children.map((child) => advanceObject(child, count)) }
  if (object.type === 'text' || object.type === 'barcode' || object.type === 'rfid') {
    return {
      ...object,
      source: advanceSerial(object.source, count),
      ...(object.subSources ? { subSources: object.subSources.map((source: DataSource) => advanceSerial(source, count)) } : {})
    }
  }
  if (object.type === 'image' && object.source) return { ...object, source: advanceSerial(object.source, count) }
  return object
}

export function advanceDocumentSerials(doc: LabelDoc, count: number): LabelDoc {
  return { ...doc, objects: doc.objects.map((object) => advanceObject(object, count)) }
}
