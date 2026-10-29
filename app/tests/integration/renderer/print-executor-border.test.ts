import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LabelDoc } from '@shared/domain/document'
import type { DocTab } from '@/features/workspace/useDocumentWorkspace'
import { printerConfig, sampleDoc } from '../../helpers/factories'

vi.mock('@/print/renderLabel', () => ({
  pageSizeMm: () => ({ widthMm: 60, heightMm: 40 }),
  renderLabelDataUrl: vi.fn(async () => 'data:image/png;base64,AA==')
}))

vi.mock('@/print/driverPage', () => ({
  renderDriverPage: vi.fn(async () => ({ kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }))
}))

vi.mock('@/print/bitmapSource', () => ({
  prepareBitmapsForPrintJob: vi.fn(async (job: unknown) => job)
}))

vi.mock('@/features/printing/printJobJournal', () => ({
  printJobJournal: { begin: vi.fn(), progress: vi.fn(), finish: vi.fn(), serialCommitted: vi.fn() }
}))

import { executePrint, type PrintExecutionDeps } from '@/features/printing/printExecutor'
import { renderDriverPage } from '@/print/driverPage'

function tab(doc: LabelDoc): DocTab {
  return {
    key: 'tab-1', title: '测试', doc, selectedId: null, count: 1, printCount: 1, copies: 1,
    datasetName: '', zoom: 1, tool: 'select', recordIdx: 0, startLabel: 0,
    path: 'C:/labels/test.msdx', dirty: false, revision: 1
  }
}

function deps(doc: LabelDoc, printer = printerConfig({ driver: 'tspl', port: { type: 'driver', encoding: 'utf8' } }), printBorder = false): PrintExecutionDeps {
  return {
    sourceDoc: doc,
    printTab: tab(doc),
    printer,
    options: {
      allowScript: false,
      printNonPrintable: false,
      autoRotateOutput: false,
      advanced: {
        autoCount: false, copyField: false, copyFieldName: '', firstCopyAsk: false,
        dupcheck: false, currentOnly: false, updateSerial: true, printBorder
      },
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
  const printLabel = vi.fn(async () => ({ ok: true, status: 'submitted' }))
  const printCommand = vi.fn(async () => ({ ok: true, status: 'submitted' }))
  ;(globalThis as { window?: unknown }).window = { maxlabel: { printLabel, printCommand }, prompt: vi.fn() }
  return { printLabel, printCommand }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('打印标签边框', () => {
  it('驱动打印：勾选后场景里多一圈跟随标签的边框', async () => {
    installWindow()
    await executePrint(false, deps(sampleDoc(), undefined, true), {})

    const page = vi.mocked(renderDriverPage).mock.calls[0]?.[1] as { scene?: { primitives: Array<{ object: { id?: string } }> } }
    expect(page.scene?.primitives.some((primitive) => primitive.object.id === '__print-border')).toBe(true)
  })

  it('驱动打印：未勾选时没有边框', async () => {
    installWindow()
    await executePrint(false, deps(sampleDoc(), undefined, false), {})

    const page = vi.mocked(renderDriverPage).mock.calls[0]?.[1] as { scene?: { primitives: Array<{ object: { id?: string } }> } }
    expect(page.scene?.primitives.some((primitive) => primitive.object.id === '__print-border')).toBe(false)
  })

  it('指令直连：边框输出成原生 BOX', async () => {
    const { printCommand } = installWindow()
    const printer = printerConfig({ driver: 'tspl', port: { type: 'tcp', tcpHost: '127.0.0.1', tcpPort: 9100 } })

    await executePrint(false, deps(sampleDoc(), printer, true), {})

    const payload = (printCommand.mock.calls[0] as unknown[])[0] as { segments: Array<{ type: string; str?: string }> }
    const text = payload.segments.map((segment) => segment.str ?? '').join('\n')
    expect(text).toContain('BOX')
  })
})
