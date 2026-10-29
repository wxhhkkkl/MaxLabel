import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LabelDoc } from '@shared/domain/document'
import type { SerialSource } from '@shared/domain/datasource'
import type { DocTab } from '@/features/workspace/useDocumentWorkspace'
import { printerConfig, sampleDoc } from '../../helpers/factories'

vi.mock('@/print/renderLabel', () => ({
  pageSizeMm: () => ({ widthMm: 60, heightMm: 40 }),
  renderLabelDataUrl: vi.fn(async () => 'data:image/png;base64,AA==')
}))

vi.mock('@/print/driverPage', () => ({
  renderDriverPage: vi.fn(async () => ({ kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>v</text></svg>' }))
}))

vi.mock('@/print/bitmapSource', () => ({
  prepareBitmapsForPrintJob: vi.fn(async (job: unknown) => job)
}))

vi.mock('@/features/printing/printJobJournal', () => ({
  printJobJournal: { begin: vi.fn(), progress: vi.fn(), finish: vi.fn(), serialCommitted: vi.fn() }
}))

import { executePrint, type PrintExecutionDeps } from '@/features/printing/printExecutor'

function docWithSerial(overrides: Partial<SerialSource>): LabelDoc {
  const base = sampleDoc()
  return {
    ...base,
    objects: base.objects.map((object) => (object.type === 'barcode'
      ? { ...object, source: { kind: 'serial', prefix: 'SN-', start: 1, step: 1, digits: 3, current: 1, serialType: 'boundary' as const, ...overrides } }
      : object))
  }
}

function tab(doc: LabelDoc, count: number): DocTab {
  return {
    key: 'tab-1', title: '测试', doc, selectedId: null, count, printCount: count, copies: 1,
    datasetName: '', zoom: 1, tool: 'select', recordIdx: 0, startLabel: 0,
    path: 'C:/labels/test.msdx', dirty: false, revision: 1
  }
}

function deps(doc: LabelDoc, count: number, overrides: Partial<PrintExecutionDeps> = {}): PrintExecutionDeps {
  return {
    sourceDoc: doc,
    printTab: tab(doc, count),
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

describe('序列号边界值', () => {
  it('打印数量会越过终点时整单中止，不打印也不推进序列号', async () => {
    const { printLabel } = installWindow()
    const d = deps(docWithSerial({ end: 3 }), 5)

    await executePrint(false, d, {})

    expect(printLabel).not.toHaveBeenCalled()
    expect(d.bumpSerial).not.toHaveBeenCalled()
    const status = String(vi.mocked(d.setStatus).mock.calls.at(-1)?.[0])
    expect(status).toContain('边界值 3')
    expect(status).toContain('5')
  })

  it('数量在边界内时正常打印', async () => {
    const { printLabel } = installWindow()
    const d = deps(docWithSerial({ end: 3 }), 3)

    await executePrint(false, d, {})

    expect(printLabel).toHaveBeenCalledTimes(1)
  })

  it('当前值已经越过终点时，测试打印也中止', async () => {
    const { printLabel } = installWindow()
    const d = deps(docWithSerial({ current: 9, end: 3 }), 1)

    await executePrint(true, d, {})

    expect(printLabel).not.toHaveBeenCalled()
    expect(String(vi.mocked(d.setStatus).mock.calls.at(-1)?.[0])).toContain('边界值 3')
  })
})
