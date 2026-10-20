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
  printJobJournal: {
    begin: vi.fn(),
    progress: vi.fn(),
    finish: vi.fn(),
    serialCommitted: vi.fn()
  }
}))

import { executePrint, type PrintExecutionDeps } from '@/features/printing/printExecutor'

function weighDoc(): LabelDoc {
  const base = sampleDoc()
  return {
    ...base,
    objects: base.objects.map((object) =>
      object.id === '2'
        ? {
            ...object,
            source: {
              kind: 'keyboard',
              label: '重量',
              inputDevice: 'weigh',
              weighProtocol: 'standard',
              weighPort: 'COM3',
              weighBaud: '9600',
              weighUnit: 'kg',
              weighDecimals: 2,
              weighUnitConv: false
            }
          }
        : object
    )
  } as LabelDoc
}

function tab(doc: LabelDoc, overrides: Partial<DocTab> = {}): DocTab {
  return {
    key: 'tab-1',
    title: '测试',
    doc,
    selectedId: null,
    count: 1,
    printCount: 1,
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

function installWindow(scaleRead: ReturnType<typeof vi.fn>) {
  const printLabel = vi.fn(async () => ({ ok: true, status: 'submitted' }))
  const prompt = vi.fn()
  ;(globalThis as { window?: unknown }).window = {
    maxlabel: {
      printLabel,
      printCommand: vi.fn(async () => ({ ok: true, status: 'submitted' })),
      printCommandFile: vi.fn(async () => ({ ok: true, status: 'submitted' })),
      scale: { read: scaleRead, cancel: vi.fn(async () => ({ ok: true, canceled: true })), test: vi.fn() }
    },
    prompt
  }
  return { printLabel, prompt }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('scale values in the print pipeline', () => {
  it('reads one stable value per logical label and prints each value', async () => {
    let value = 0
    const read = vi.fn(async () => ({ ok: true, reading: { value: (value += 1), unit: 'kg', stable: true, raw: '', timestamp: 0 } }))
    const { printLabel } = installWindow(read)
    const doc = weighDoc()
    const d = deps(doc, { printTab: tab(doc, { count: 3, printCount: 3 }) })

    await executePrint(false, d, {})

    expect(read).toHaveBeenCalledTimes(3)
    expect((read.mock.calls[0] as unknown[])[0]).toMatchObject({ protocol: 'standard', port: 'COM3', baud: '9600', unit: 'kg', decimals: 2 })
    expect(printLabel).toHaveBeenCalledTimes(1)
    const snapshot = (d.logPrint as ReturnType<typeof vi.fn>).mock.calls[0][2] as string[]
    expect(snapshot.some((line) => line.includes('1.00'))).toBe(true)
    expect(snapshot.some((line) => line.includes('2.00'))).toBe(true)
    expect(snapshot.some((line) => line.includes('3.00'))).toBe(true)
  })

  it('does not reuse a reading across print jobs', async () => {
    const read = vi.fn(async () => ({ ok: true, reading: { value: 1.234, unit: 'kg', stable: true, raw: '', timestamp: 0 } }))
    installWindow(read)
    const doc = weighDoc()

    await executePrint(false, deps(doc), {})
    await executePrint(false, deps(doc), {})

    expect(read).toHaveBeenCalledTimes(2)
  })

  it('prints nothing and leaves serials/logs untouched on timeout', async () => {
    const read = vi.fn(async () => ({ ok: false, messageKey: 'error.scaleTimeout', message: 'no stable weight' }))
    const { printLabel } = installWindow(read)
    const d = deps(weighDoc(), { language: 'en-US' })

    await executePrint(false, d, {})

    expect(printLabel).not.toHaveBeenCalled()
    expect(d.bumpSerial).not.toHaveBeenCalled()
    expect(d.logPrint).not.toHaveBeenCalled()
    expect((d.setStatus as ReturnType<typeof vi.fn>).mock.calls.flat().join(' ')).toContain('No stable weight')
  })

  it('auto-print forces one logical label and never prompts, even with auto-count', async () => {
    const read = vi.fn()
    const { printLabel, prompt } = installWindow(read)
    const doc = {
      ...weighDoc(),
      datasets: { main: { name: 'main', columns: ['sku'], rows: [['a'], ['b'], ['c']] } }
    }
    const d = deps(doc, {
      printTab: tab(doc, { count: 1, datasetName: 'main' }),
      options: {
        allowScript: false,
        printNonPrintable: false,
        autoRotateOutput: false,
        keyboardValues: {},
        singleLogicalLabel: true,
        advanced: {
          autoCount: true,
          copyField: false,
          copyFieldName: '',
          firstCopyAsk: true,
          dupcheck: false,
          currentOnly: false,
          updateSerial: true
        }
      }
    })

    await executePrint(false, d, {}, { 重量: ['1.50'] })

    expect(read).not.toHaveBeenCalled()
    expect(prompt).not.toHaveBeenCalled()
    expect(printLabel).toHaveBeenCalledTimes(1)
    expect(((printLabel.mock.calls[0] as unknown[])[0] as { pages: unknown[] }).pages).toHaveLength(1)
    expect(d.logPrint).toHaveBeenCalledWith('driver', false, expect.anything(), expect.anything(), expect.objectContaining({ status: 'submitted', sentCount: 1 }))
    expect(((d.logPrint as ReturnType<typeof vi.fn>).mock.calls[0][4] as { logicalCount: number }).logicalCount).toBe(1)
  })

  it('reports cancellation without printing, logging or advancing serials', async () => {
    const read = vi.fn(async () => ({ ok: false, canceled: true, message: 'canceled' }))
    const { printLabel } = installWindow(read)
    const d = deps(weighDoc())

    await executePrint(false, d, {})

    expect(printLabel).not.toHaveBeenCalled()
    expect(d.bumpSerial).not.toHaveBeenCalled()
    expect(d.logPrint).not.toHaveBeenCalled()
    expect((d.setStatus as ReturnType<typeof vi.fn>).mock.calls.flat().join(' ')).toContain('取消')
  })
})
