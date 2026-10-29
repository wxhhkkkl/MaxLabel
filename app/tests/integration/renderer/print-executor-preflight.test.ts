import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LabelDoc } from '@shared/domain/document'
import { eanCheckDigit } from '@shared/domain/barcodeCharset'
import type { DocTab } from '@/features/workspace/useDocumentWorkspace'
import { printerConfig, sampleDoc } from '../../helpers/factories'

vi.mock('@/print/renderLabel', () => ({
  pageSizeMm: () => ({ widthMm: 60, heightMm: 40 }),
  renderLabelDataUrl: vi.fn(async () => 'data:image/png;base64,AA==')
}))

vi.mock('@/print/driverPage', () => ({
  renderDriverPage: vi.fn(async () => ({ kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>vector</text></svg>' }))
}))

vi.mock('@/print/bitmapSource', () => ({
  prepareBitmapsForPrintJob: vi.fn(async (job: unknown) => job)
}))

vi.mock('@/features/printing/printJobJournal', () => ({
  printJobJournal: {
    begin: vi.fn(),
    progress: vi.fn(),
    finish: vi.fn(),
    serialCommitted: vi.fn()
  }
}))

import { executePrint, type PrintExecutionDeps } from '@/features/printing/printExecutor'

const VALID_EAN = '690123456789' + eanCheckDigit('690123456789')

function docWithRows(rows: string[][]): LabelDoc {
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
        symbology: 'ean13',
        showText: false,
        source: { kind: 'database', dataset: 'ds', field: 'code' }
      }
    ],
    datasets: { ds: { name: 'ds', columns: ['code'], rows } }
  })
}

function tab(doc: LabelDoc, overrides: Partial<DocTab> = {}): DocTab {
  return {
    key: 'tab-1',
    title: '测试',
    doc,
    selectedId: null,
    count: 3,
    printCount: 3,
    copies: 1,
    datasetName: '',
    zoom: 1,
    tool: 'select',
    recordIdx: 0,
    startLabel: 0,
    path: 'C:/labels/test.msdx',
    dirty: false,
    revision: 1,
    ...overrides
  }
}

function deps(doc: LabelDoc, overrides: Partial<PrintExecutionDeps> = {}): PrintExecutionDeps {
  return {
    sourceDoc: doc,
    printTab: tab(doc),
    printer: printerConfig({ driver: 'tspl', port: { type: 'driver', encoding: 'utf8' } }),
    options: {
      allowScript: false,
      printNonPrintable: false,
      autoRotateOutput: false,
      advanced: {
        autoCount: false,
        copyField: false,
        copyFieldName: '',
        firstCopyAsk: false,
        dupcheck: false,
        currentOnly: false,
        updateSerial: true
      },
      keyboardValues: {}
    },
    refreshAutoDb: async (source) => ({ doc: source, error: null, revision: 1 }),
    bumpSerial: vi.fn(async () => ({ ok: true })),
    logPrint: vi.fn(async () => undefined),
    setBusy: vi.fn(),
    setStatus: vi.fn(),
    ...overrides
  }
}

function installWindow() {
  const printLabel = vi.fn(async () => ({ ok: true, status: 'submitted' }))
  ;(globalThis as { window?: unknown }).window = {
    maxlabel: { printLabel, printCommand: vi.fn(async () => ({ ok: true, status: 'submitted' })) },
    prompt: vi.fn()
  }
  return { printLabel }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('正式打印前的条码数据校验', () => {
  it('用户中止时一页都不打，并在状态栏说明原因', async () => {
    const { printLabel } = installWindow()
    const confirm = vi.fn(async () => false)
    const d = deps(docWithRows([[VALID_EAN], ['ABC'], [VALID_EAN]]), { confirmBarcodePreflight: confirm })

    await executePrint(false, d, {})

    expect(confirm).toHaveBeenCalledTimes(1)
    expect(vi.mocked(confirm).mock.calls[0][0]).toHaveLength(1)
    expect(printLabel).not.toHaveBeenCalled()
    expect(d.logPrint).not.toHaveBeenCalled()
    expect(String(vi.mocked(d.setStatus).mock.calls.at(-1)?.[0])).toContain('中止')
  })

  it('用户选择跳过时只打合法记录', async () => {
    const { printLabel } = installWindow()
    const d = deps(docWithRows([[VALID_EAN], ['ABC'], [VALID_EAN]]), { confirmBarcodePreflight: vi.fn(async () => true) })

    await executePrint(false, d, {})

    expect(printLabel).toHaveBeenCalledTimes(1)
    const payload = (printLabel.mock.calls[0] as unknown[])[0] as { pages: unknown[] }
    expect(payload.pages).toHaveLength(2)
    expect(d.bumpSerial).toHaveBeenCalledWith('tab-1', 2, 1, 'C:/labels/test.msdx')
  })

  it('数据全部合法时不打扰用户', async () => {
    const { printLabel } = installWindow()
    const confirm = vi.fn(async () => false)
    const d = deps(docWithRows([[VALID_EAN], [VALID_EAN], [VALID_EAN]]), { confirmBarcodePreflight: confirm })

    await executePrint(false, d, {})

    expect(confirm).not.toHaveBeenCalled()
    expect(printLabel).toHaveBeenCalledTimes(1)
  })
})
