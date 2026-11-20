import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LabelDoc } from '@shared/domain/document'
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
  printJobJournal: { begin: vi.fn(), progress: vi.fn(), finish: vi.fn(), serialCommitted: vi.fn() }
}))

import { executePrint, type PrintExecutionDeps } from '@/features/printing/printExecutor'

function tab(doc: LabelDoc): DocTab {
  return { key: 'tab-1', title: '测试', doc, selectedId: null, count: 1, printCount: 1, copies: 1, datasetName: '', zoom: 1, tool: 'select', recordIdx: 0, startLabel: 0, path: 'C:/labels/test.msdx', dirty: false, revision: 1 }
}

function deps(doc: LabelDoc, logPrint = vi.fn(async () => undefined)): PrintExecutionDeps {
  return {
    sourceDoc: doc,
    printTab: tab(doc),
    printer: printerConfig({ driver: 'tspl', port: { type: 'driver', encoding: 'utf8' } }),
    options: {
      allowScript: false,
      printNonPrintable: false,
      autoRotateOutput: false,
      advanced: { autoCount: false, copyField: false, copyFieldName: '', firstCopyAsk: false, dupcheck: false, currentOnly: false, updateSerial: true },
      keyboardValues: {}
    },
    refreshAutoDb: async (source) => ({ doc: source, error: null, revision: 1 }),
    bumpSerial: vi.fn(async () => ({ ok: true })),
    logPrint,
    setBusy: vi.fn(),
    setStatus: vi.fn()
  }
}

function installWindow() {
  const printLabel = vi.fn(async () => ({ ok: true, status: 'submitted' }))
  ;(globalThis as { window?: unknown }).window = {
    maxlabel: {
      printLabel,
      printCommand: vi.fn(async () => ({ ok: true, status: 'submitted' })),
      printCommandFile: vi.fn(async () => ({ ok: true, status: 'submitted' }))
    },
    prompt: vi.fn()
  }
  return printLabel
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('print executor logging', () => {
  it('uses one weight sample per logical record across physical copies', async () => {
    installWindow()
    const doc = sampleDoc({ objects: [{
      id: 'weight', type: 'text', x: 2, y: 2, w: 30, h: 8, rotation: 0, fontSize: 3, fontFamily: 'Arial',
      source: { kind: 'keyboard', label: 'Weight', inputDevice: 'weigh' }
    } as LabelDoc['objects'][number]] })
    const log = vi.fn(async () => undefined)
    const d = deps(doc, log)
    d.printTab.count = 2
    d.printTab.copies = 2
    await expect(executePrint(false, d, {}, { Weight: ['10', '20'] })).resolves.toBe(true)
    expect(log).toHaveBeenCalledWith('driver', false, ['10', '10', '20', '20'], expect.anything(), expect.objectContaining({ sentCount: 4 }))
  })

  it('validates the same physical total and typed script state used for printed barcodes', async () => {
    const printLabel = installWindow()
    const doc = sampleDoc({
      objects: [{
        id: 'barcode', type: 'barcode', x: 2, y: 2, w: 25, h: 15, rotation: 0, symbology: 'ean8', showText: false,
        source: { kind: 'script', code: 'function OnGetData() { return Code; }' }
      } as LabelDoc['objects'][number]],
      datasets: { rows: { name: 'rows', columns: ['SKU'], rows: [['001']] } },
      globalScript: 'function OnBeginPrint(State) { Seed = 1234566; }\nfunction OnBeginLabel() { Code = V_TOTALLABELS === 2 ? Seed + 1 : "BAD"; }'
    })
    const confirm = vi.fn(async () => false)
    const d = deps(doc)
    d.options.allowScript = true
    d.printTab.copies = 2
    d.confirmBarcodePreflight = confirm
    await expect(executePrint(false, d, {})).resolves.toBe(true)
    expect(confirm).not.toHaveBeenCalled()
    expect(printLabel).toHaveBeenCalledOnce()
  })

  it('keeps the weight of the surviving record when preflight skips a bad barcode', async () => {
    installWindow()
    const doc = sampleDoc({
      objects: [
        {
          id: 'weight', type: 'text', x: 2, y: 2, w: 30, h: 8, rotation: 0, fontSize: 3, fontFamily: 'Arial',
          source: { kind: 'keyboard', label: 'Weight', inputDevice: 'weigh' }
        } as LabelDoc['objects'][number],
        {
          id: 'barcode', type: 'barcode', x: 2, y: 12, w: 25, h: 15, rotation: 0, symbology: 'ean8', showText: false,
          source: { kind: 'database', dataset: 'rows', field: 'code' }
        } as LabelDoc['objects'][number]
      ],
      datasets: { rows: { name: 'rows', columns: ['code'], rows: [['BAD'], ['1234567']] } }
    })
    const log = vi.fn(async () => undefined)
    const d = deps(doc, log)
    d.printTab.count = 2
    d.printTab.copies = 2
    const confirm = vi.fn(async () => true)
    d.confirmBarcodePreflight = confirm
    await expect(executePrint(false, d, {}, { Weight: ['10', '20'] })).resolves.toBe(true)
    expect(confirm).toHaveBeenCalledOnce()
    expect(log).toHaveBeenCalledWith('driver', false, ['20 | 1234567', '20 | 1234567'], expect.anything(), expect.objectContaining({ sentCount: 2 }))
  })

  it('does not log a test print', async () => {
    const printLabel = installWindow()
    const d = deps(sampleDoc())
    await executePrint(true, d, {})
    expect(printLabel).toHaveBeenCalledTimes(1)
    expect(d.logPrint).not.toHaveBeenCalled()
  })

  it('writes one log row for a successful non-test print', async () => {
    installWindow()
    const d = deps(sampleDoc())
    await executePrint(false, d, {})
    expect(d.logPrint).toHaveBeenCalledTimes(1)
    expect(d.logPrint).toHaveBeenCalledWith('driver', false, expect.any(Array), expect.anything(), expect.objectContaining({ status: 'submitted', sentCount: 1 }))
  })

  it('does not fail a successful print when logging rejects', async () => {
    const printLabel = installWindow()
    const logPrint = vi.fn(async () => { throw new Error('disk full') })
    const d = deps(sampleDoc(), logPrint)
    await expect(executePrint(false, d, {})).resolves.toBe(true)
    expect(printLabel).toHaveBeenCalledTimes(1)
    expect(d.bumpSerial).toHaveBeenCalled()
    const status = (d.setStatus as ReturnType<typeof vi.fn>).mock.calls.flat().join(' ')
    expect(status).toContain('已提交')
  })
})
