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

function tab(doc: LabelDoc): DocTab {
  return {
    key: 'tab-1',
    title: 'Test',
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
    revision: 1
  }
}

function deps(doc: LabelDoc, overrides: Partial<PrintExecutionDeps> = {}): PrintExecutionDeps {
  return {
    sourceDoc: doc,
    printTab: tab(doc),
    printer: printerConfig({ port: { type: 'driver', encoding: 'utf8' } }),
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
    language: 'en-US',
    ...overrides
  }
}

function installWindow(printLabel = vi.fn(async () => ({ ok: true, status: 'submitted' }))) {
  ;(globalThis as { window?: unknown }).window = {
    maxlabel: { printLabel, printCommand: vi.fn(), printCommandFile: vi.fn() },
    prompt: vi.fn()
  }
  return { printLabel }
}

function statusText(d: PrintExecutionDeps): string {
  return (d.setStatus as ReturnType<typeof vi.fn>).mock.calls.flat().join(' ')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('localized IPC errors at the UI boundary', () => {
  it('renders the translated message when messageKey resolves', async () => {
    installWindow(vi.fn(async () => ({ ok: false, status: 'failed', message: '原始错误', messageKey: 'error.printFailed' })))
    const d = deps(sampleDoc())
    await executePrint(false, d, {})

    expect(statusText(d)).toContain('Print failed')
    expect(statusText(d)).not.toContain('原始错误')
  })

  it('falls back to the raw message when messageKey is missing from the catalog', async () => {
    installWindow(vi.fn(async () => ({ ok: false, status: 'failed', message: 'raw failure', messageKey: 'missing.key' })))
    const d = deps(sampleDoc())
    await executePrint(false, d, {})

    expect(statusText(d)).toContain('raw failure')
  })

  it('falls back to the raw message when no messageKey is provided', async () => {
    installWindow(vi.fn(async () => ({ ok: false, status: 'failed', message: 'no printer' })))
    const d = deps(sampleDoc())
    await executePrint(false, d, {})

    expect(statusText(d)).toContain('no printer')
  })
})
