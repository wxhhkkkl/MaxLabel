import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LabelDoc } from '@shared/domain/document'
import type { DocTab } from '@/features/workspace/useDocumentWorkspace'
import { printerConfig, sampleDoc } from '../../helpers/factories'

vi.mock('@/print/renderLabel', () => ({
  pageSizeMm: () => ({ widthMm: 60, heightMm: 40 }),
  renderLabelDataUrl: vi.fn(async () => 'data:image/png;base64,AA==')
}))

vi.mock('@/print/bitmapSource', () => ({
  prepareBitmapsForPrintJob: vi.fn(async (job: unknown) => job)
}))

vi.mock('@/features/printing/printJobJournal', () => ({
  printJobJournal: { begin: vi.fn(), progress: vi.fn(), finish: vi.fn(), serialCommitted: vi.fn() }
}))

import { executePrint, type PrintExecutionDeps } from '@/features/printing/printExecutor'

function tab(doc: LabelDoc): DocTab {
  return {
    key: 'tab-escpos',
    title: 'ESC/POS',
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
    path: 'C:/labels/escpos.msdx',
    dirty: false,
    revision: 1
  }
}

function deps(doc: LabelDoc): PrintExecutionDeps {
  return {
    sourceDoc: doc,
    printTab: tab(doc),
    printer: printerConfig({
      driver: 'escpos',
      escposProfile: 'epson-tm-t88',
      port: { type: 'tcp', encoding: 'gbk', tcpHost: '127.0.0.1', tcpPort: 9100 }
    }),
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
    setStatus: vi.fn()
  }
}

function installWindow() {
  const printCommand = vi.fn(async () => ({ ok: true, status: 'submitted' }))
  ;(globalThis as { window?: unknown }).window = { maxlabel: { printCommand } }
  return printCommand
}

function asciiDoc(): LabelDoc {
  const doc = sampleDoc()
  doc.objects = [{ ...sampleDoc().objects[1], source: { kind: 'constant', value: 'ABC' } } as LabelDoc['objects'][number]]
  return doc
}

beforeEach(() => vi.clearAllMocks())

describe('ESC/POS executor integration', () => {
  it('sends an ESC/POS payload with shared plan/log/serial semantics', async () => {
    const printCommand = installWindow()
    const d = deps(asciiDoc())
    await executePrint(false, d, {})

    expect(printCommand).toHaveBeenCalledTimes(1)
    const payload = (printCommand.mock.calls[0] as unknown[])[0] as { encoding: string; segments: Array<{ type: string }> }
    expect(payload.encoding).toBe('gbk')
    expect(payload.segments.length).toBeGreaterThan(0)
    expect(d.logPrint).toHaveBeenCalledWith('command', false, expect.anything(), expect.anything(), expect.objectContaining({ status: 'submitted' }))
    expect(d.bumpSerial).toHaveBeenCalledWith('tab-escpos', 1, 1, 'C:/labels/escpos.msdx')
  })

  it('keeps test print free of log and serial advancement', async () => {
    const printCommand = installWindow()
    const d = deps(asciiDoc())
    await executePrint(true, d, {})
    expect(printCommand).toHaveBeenCalledTimes(1)
    expect(d.logPrint).not.toHaveBeenCalled()
    expect(d.bumpSerial).not.toHaveBeenCalled()
  })
})
