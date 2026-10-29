import { describe, expect, it } from 'vitest'
import type { LabelDoc } from '@shared/domain/document'
import { eanCheckDigit } from '@shared/domain/barcodeCharset'
import { buildExecutablePrintPlan } from '@shared/print/plan'
import { createPrintContext } from '@/features/printing/printJob'
import { findInvalidBarcodeRecords, recordIndicesSkippingInvalid } from '@/features/printing/barcodePreflight'
import { printerConfig, sampleDoc } from '../../helpers/factories'

const VALID_EAN = '690123456789' + eanCheckDigit('690123456789')

function docWithRows(rows: string[][], symbology = 'ean13'): LabelDoc {
  return sampleDoc({
    objects: [
      {
        id: '2',
        type: 'barcode',
        x: 4,
        y: 4,
        w: 40,
        h: 14,
        rotation: 0,
        symbology,
        showText: false,
        source: { kind: 'database', dataset: 'ds', field: 'code' }
      }
    ],
    datasets: { ds: { name: 'ds', columns: ['code'], rows } }
  })
}

function planFor(doc: LabelDoc) {
  const rows = doc.datasets!.ds.rows
  return buildExecutablePrintPlan({
    test: false,
    requestedCount: rows.length,
    recordStart: 0,
    dataset: doc.datasets!.ds,
    cellsPerPage: 1,
    defaultCopies: 1
  })
}

function ctxFor(doc: LabelDoc) {
  return createPrintContext({
    doc,
    printer: printerConfig(),
    copies: 1,
    count: doc.datasets!.ds.rows.length,
    datasetName: 'ds'
  })
}

describe('条码数据预检', () => {
  it('用校验表拦下 EAN-13 的非法内容，并给出记录序号', async () => {
    const doc = docWithRows([[VALID_EAN], ['ABC'], [VALID_EAN]])
    const issues = await findInvalidBarcodeRecords({ doc, plan: planFor(doc), ctx: ctxFor(doc) })

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ recordIndex: 1, labelIndex: 2, symbology: 'ean13' })
    expect(issues[0].message).toContain('EAN-13')
    expect(issues[0].message).toContain('数字')
  })

  it('校验表覆盖不到的码制用真编码兜底（25 码只能是数字）', async () => {
    const doc = docWithRows([['1234'], ['12A4']], 'interleaved2of5')
    const issues = await findInvalidBarcodeRecords({ doc, plan: planFor(doc), ctx: ctxFor(doc) })

    expect(issues).toHaveLength(1)
    expect(issues[0].recordIndex).toBe(1)
    expect(issues[0].message.length).toBeGreaterThan(0)
  })

  it('全部记录合法时不产生问题项', async () => {
    const doc = docWithRows([[VALID_EAN], [VALID_EAN]])
    await expect(findInvalidBarcodeRecords({ doc, plan: planFor(doc), ctx: ctxFor(doc) })).resolves.toEqual([])
  })

  it('跳过不合法记录时保持原打印顺序', () => {
    const doc = docWithRows([['1'], ['2'], ['3']], 'code128')
    const plan = planFor(doc)
    expect(recordIndicesSkippingInvalid(plan, new Set([1]))).toEqual([0, 2])
    expect(recordIndicesSkippingInvalid(plan, new Set([0, 1, 2]))).toEqual([])
  })
})
