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
    await expect(executePrint(false, d, {})).resolves.toBeUndefined()
    expect(printLabel).toHaveBeenCalledTimes(1)
    expect(d.bumpSerial).toHaveBeenCalled()
    const status = (d.setStatus as ReturnType<typeof vi.fn>).mock.calls.flat().join(' ')
    expect(status).toContain('已提交')
  })
})
