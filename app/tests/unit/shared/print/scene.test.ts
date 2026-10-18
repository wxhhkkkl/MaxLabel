import { describe, expect, it } from 'vitest'
import type { Dataset } from '@shared/domain/datasource'
import type { LabelDoc } from '@shared/domain/document'
import { sceneNeedsRasterization } from '@shared/print/capabilities'
import {
  autoRotateDocumentForPrint,
  prepareDocumentForPrint,
  rotateDocumentForPrint
} from '@shared/print/layout'
import { buildPrintPlan } from '@shared/print/plan'
import { filterNativeOutputScene, resolvePrintPlanPageScene, resolvePrintScene } from '@shared/print/scene'
import { dataCtx, printerConfig, sampleDoc } from '../../../helpers/factories'

function docWithHiddenAndSuppressed(): LabelDoc {
  const doc = sampleDoc()
  doc.objects.push({
    id: 'hidden',
    type: 'text',
    x: 0,
    y: 0,
    w: 10,
    h: 5,
    rotation: 0,
    visible: false,
    fontFamily: 'Arial',
    fontSize: 3,
    bold: false,
    align: 'left',
    color: '#000',
    source: { kind: 'constant', value: 'HIDDEN' }
  })
  doc.objects.push({
    id: 'suppressed',
    type: 'barcode',
    x: 0,
    y: 0,
    w: 10,
    h: 5,
    rotation: 0,
    suppressPrint: true,
    symbology: 'code128',
    showText: false,
    source: { kind: 'constant', value: 'SUPPRESSED' }
  })
  return doc
}

describe('ResolvedPrintScene', () => {
  it('resolves data and filters hidden/suppressPrint objects by default', () => {
    const scene = resolvePrintScene(
      docWithHiddenAndSuppressed(),
      dataCtx({ labelIndex: 2, recordIndex: 1, copy: 3, count: 2, totalLabels: 2 })
    )

    expect(scene.labelIndex).toBe(2)
    expect(scene.copy).toBe(3)
    expect(scene.primitives.some((p) => p.kind === 'barcode' && p.value === 'SN-1002')).toBe(true)
    expect(scene.primitives.some((p) => p.object.id === 'hidden')).toBe(false)
    expect(scene.primitives.some((p) => p.object.id === 'suppressed')).toBe(false)
  })

  it('can include suppressPrint objects explicitly', () => {
    const scene = resolvePrintScene(docWithHiddenAndSuppressed(), dataCtx(), { includeSuppressed: true })
    expect(scene.primitives.some((p) => p.object.id === 'suppressed')).toBe(true)
    expect(scene.primitives.some((p) => p.object.id === 'hidden')).toBe(false)
  })

  it('keeps preview objects but lets native output keep only fully-inside objects', () => {
    const boundary: LabelDoc = {
      ...sampleDoc(),
      objects: [
        { id: 'inside', type: 'text', x: 2, y: 2, w: 10, h: 5, rotation: 0, fontFamily: 'Arial', fontSize: 4, bold: false, align: 'left', color: '#000', source: { kind: 'constant', value: 'INSIDE' } },
        { id: 'outside', type: 'text', x: 61, y: 2, w: 10, h: 5, rotation: 0, fontFamily: 'Arial', fontSize: 4, bold: false, align: 'left', color: '#000', source: { kind: 'constant', value: 'OUTSIDE' } },
        { id: 'partial', type: 'text', x: 58, y: 2, w: 5, h: 5, rotation: 0, fontFamily: 'Arial', fontSize: 4, bold: false, align: 'left', color: '#000', source: { kind: 'constant', value: 'PARTIAL' } }
      ]
    }

    const scene = resolvePrintScene(boundary, dataCtx())
    const native = filterNativeOutputScene(scene)

    expect(scene.primitives).toHaveLength(3)
    expect(native.primitives.map((p) => p.object.id)).toEqual(['inside'])
  })

  it('keeps only the current row and dataset metadata in the scene snapshot', () => {
    const dataset: Dataset = {
      name: 'rows',
      columns: ['value'],
      rows: Array.from({ length: 1000 }, (_, index) => [String(index)])
    }
    const doc: LabelDoc = {
      ...sampleDoc(),
      objects: [
        {
          ...sampleDoc().objects[1],
          source: { kind: 'database', dataset: 'rows', field: 'value' }
        } as LabelDoc['objects'][number]
      ]
    }

    const scene = resolvePrintScene(
      doc,
      dataCtx({
        labelIndex: 2,
        recordIndex: 1,
        count: 2,
        totalLabels: 2,
        activeDataset: 'rows',
        recordRow: ['row-1'],
        datasets: { rows: dataset }
      })
    )
    const context = scene.primitives[0].context

    expect(context.recordRow).toEqual(['row-1'])
    expect(context.datasets.rows.rows).toHaveLength(0)
    expect(context.datasets.rows.columns).toEqual(['value'])
  })

  it('flags dynamic colour and advanced barcode options for rasterization', () => {
    const dynamic: LabelDoc = {
      ...sampleDoc(),
      objects: [
        {
          ...sampleDoc().objects[0],
          colorChange: { mode: 'index', tableSource: 'shared', privateTable: [], changeMode: 'solid', blockRows: 1, blockCols: 1, variableName: '' }
        } as LabelDoc['objects'][number]
      ]
    }
    expect(sceneNeedsRasterization(resolvePrintScene(dynamic, dataCtx()), printerConfig())).toBe(true)

    const advanced: LabelDoc = {
      ...sampleDoc(),
      objects: [
        {
          ...sampleDoc().objects[2],
          barcodeOptions: { xSizeMm: 0.25, eanAddon: '5' }
        } as LabelDoc['objects'][number]
      ]
    }
    expect(sceneNeedsRasterization(resolvePrintScene(advanced, dataCtx()), printerConfig())).toBe(true)
  })
})

describe('auto rotation', () => {
  it('rotates a print copy without mutating the source document', () => {
    const source: LabelDoc = { ...sampleDoc(), orientation: 90 }
    expect(rotateDocumentForPrint(source, true).orientation).toBe(270)
    expect(source.orientation).toBe(90)
  })

  it('changes the scene content rotation while keeping the physical sheet', () => {
    const source: LabelDoc = {
      version: 1,
      name: '方向测试',
      widthMm: 40,
      heightMm: 60,
      objects: [
        {
          id: 'marker',
          type: 'text',
          x: 2,
          y: 3,
          w: 5,
          h: 6,
          rotation: 0,
          fontFamily: 'Arial',
          fontSize: 4,
          bold: false,
          align: 'left',
          color: '#000',
          printerFont: 'Font1',
          source: { kind: 'constant', value: 'A' }
        }
      ],
      layout: { rows: 1, cols: 1, rowGapMm: 0, colGapMm: 0, shape: 'rect', pageWidthMm: 60, pageHeightMm: 40 }
    }

    const output = autoRotateDocumentForPrint(source, true)
    expect(source.orientation ?? 0).toBe(0)
    expect(output.orientation).toBe(90)

    const before = resolvePrintScene(source, dataCtx())
    const after = resolvePrintScene(output, dataCtx())
    expect(before.widthMm).not.toBe(after.widthMm)
    expect(before.primitives[0].object.rotation).toBe(0)
    expect(after.primitives[0].object.rotation).toBe(90)
  })

  it('shares the rotated scene with the print plan while preserving 60×40 paper', () => {
    const source: LabelDoc = {
      version: 1,
      name: '方向测试',
      widthMm: 40,
      heightMm: 60,
      objects: [
        {
          id: 'marker',
          type: 'text',
          x: 2,
          y: 3,
          w: 5,
          h: 6,
          rotation: 0,
          fontFamily: 'Arial',
          fontSize: 4,
          bold: false,
          align: 'left',
          color: '#000',
          printerFont: 'Font1',
          source: { kind: 'constant', value: 'A' }
        }
      ],
      layout: { rows: 1, cols: 1, rowGapMm: 0, colGapMm: 0, shape: 'rect', pageWidthMm: 60, pageHeightMm: 40 }
    }
    const plan = buildPrintPlan({ test: false, requestedCount: 1, recordStart: 0, cellsPerPage: 1, defaultCopies: 1 })
    const context = dataCtx({ title: source.name, printerName: 'test' })
    const offDoc = prepareDocumentForPrint(source, { autoRotateOutput: false })
    const onDoc = prepareDocumentForPrint(source, { autoRotateOutput: true })
    const offScene = resolvePrintPlanPageScene(offDoc, context, offDoc.layout, plan.pages[0])
    const onScene = resolvePrintPlanPageScene(onDoc, context, onDoc.layout, plan.pages[0])

    expect({ widthMm: offScene.widthMm, heightMm: offScene.heightMm }).toEqual({ widthMm: 60, heightMm: 40 })
    expect({ widthMm: onScene.widthMm, heightMm: onScene.heightMm }).toEqual({ widthMm: 60, heightMm: 40 })
    expect(offScene.primitives[0].object.rotation).toBe(0)
    expect(onScene.primitives[0].object.rotation).toBe(90)
    expect({
      x: onScene.primitives[0].object.x,
      y: onScene.primitives[0].object.y,
      w: onScene.primitives[0].object.w,
      h: onScene.primitives[0].object.h
    }).toEqual({ x: 51, y: 2, w: 6, h: 5 })
  })
})
