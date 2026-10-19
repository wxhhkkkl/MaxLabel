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
  printJobJournal: {
    begin: vi.fn(),
    progress: vi.fn(),
    finish: vi.fn(),
    serialCommitted: vi.fn()
  }
}))

import { executePrint, type PrintExecutionDeps } from '@/features/printing/printExecutor'

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

function deps(doc: LabelDoc, printer = printerConfig(), overrides: Partial<PrintExecutionDeps> = {}): PrintExecutionDeps {
  return {
    sourceDoc: doc,
    printTab: tab(doc),
    printer,
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

function installWindow(printLabel = vi.fn(async () => ({ ok: true, status: 'submitted' })), printCommand = vi.fn(async () => ({ ok: true, status: 'submitted' }))) {
  ;(globalThis as { window?: unknown }).window = {
    maxlabel: { printLabel, printCommand, printCommandFile: vi.fn(async () => ({ ok: true, status: 'submitted' })) },
    prompt: vi.fn()
  }
  return { printLabel, printCommand }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('driver printing', () => {
  it('submits one driver page, logs and advances serials', async () => {
    const { printLabel } = installWindow()
    const doc = sampleDoc()
    const d = deps(doc, printerConfig({ driver: 'tspl', port: { type: 'driver', encoding: 'utf8' } }))
    await executePrint(false, d, {})

    expect(printLabel).toHaveBeenCalledTimes(1)
    expect((printLabel.mock.calls[0] as unknown[])[0]).toMatchObject({ widthMm: 60, heightMm: 40 })
    expect(d.logPrint).toHaveBeenCalledWith('driver', false, expect.anything(), expect.anything(), expect.objectContaining({ status: 'submitted', sentCount: 1 }))
    expect(d.bumpSerial).toHaveBeenCalledWith('tab-1', 1, 1, 'C:/labels/test.msdx')
    expect(d.setBusy).toHaveBeenNthCalledWith(1, true)
    expect(d.setBusy).toHaveBeenLastCalledWith(false)
  })

  it('logs a failed driver submission without advancing serials', async () => {
    installWindow(vi.fn(async () => ({ ok: false, status: 'failed', message: 'no printer' })))
    const d = deps(sampleDoc(), printerConfig({ port: { type: 'driver', encoding: 'utf8' } }))
    await executePrint(false, d, {})

    expect(d.logPrint).toHaveBeenCalledWith('driver', false, expect.anything(), expect.anything(), expect.objectContaining({ status: 'failed', sentCount: 0 }))
    expect(d.bumpSerial).not.toHaveBeenCalled()
    expect((d.setStatus as ReturnType<typeof vi.fn>).mock.calls.flat().join(' ')).toMatch(/未完成/)
  })
})

describe('native command printing', () => {
  it('submits command batches and logs success', async () => {
    const { printCommand } = installWindow()
    const printer = printerConfig({ driver: 'tspl', port: { type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: 9100 } })
    const d = deps(sampleDoc(), printer)
    await executePrint(false, d, {})

    expect(printCommand).toHaveBeenCalledTimes(1)
    expect((printCommand.mock.calls[0] as unknown[])[0]).toMatchObject({ encoding: 'utf8', port: printer.port })
    expect(d.logPrint).toHaveBeenCalledWith('command', false, expect.anything(), expect.anything(), expect.objectContaining({ status: 'submitted', sentCount: 1 }))
    expect(d.bumpSerial).toHaveBeenCalledWith('tab-1', 1, 1, 'C:/labels/test.msdx')
  })

  it('logs an unknown transport result without advancing serials', async () => {
    const { printCommand } = installWindow(vi.fn(async () => ({ ok: true, status: 'submitted' })), vi.fn(async () => ({ ok: false, status: 'unknown', message: 'no ack' })))
    const printer = printerConfig({ driver: 'tspl', port: { type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: 9100 } })
    const d = deps(sampleDoc(), printer)
    await executePrint(false, d, {})

    expect(printCommand).toHaveBeenCalledTimes(1)
    expect(d.logPrint).toHaveBeenCalledWith('command', false, undefined, expect.anything(), expect.objectContaining({ status: 'unknown', sentCount: 0 }))
    expect(d.bumpSerial).not.toHaveBeenCalled()
  })

  it('blocks submission when a lifecycle script fails', async () => {
    const { printCommand } = installWindow()
    const doc: LabelDoc = {
      ...sampleDoc(),
      globalScript: 'Function OnBeginPrint(State)\nUNKNOWN_CALL(1)\nEnd Function'
    }
    const printer = printerConfig({ driver: 'tspl', port: { type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: 9100 } })
    const d = deps(doc, printer)
    d.options.allowScript = true
    await executePrint(false, d, {})

    expect(printCommand).not.toHaveBeenCalled()
    expect(d.bumpSerial).not.toHaveBeenCalled()
    expect((d.setStatus as ReturnType<typeof vi.fn>).mock.calls.flat().join(' ')).toMatch(/打印失败/)
  })

  it('logs a partial batch and advances only the confirmed labels', async () => {
    const printCommand = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 'submitted' })
      .mockResolvedValueOnce({ ok: false, status: 'failed', message: 'second batch failed' })
    installWindow(vi.fn(async () => ({ ok: true, status: 'submitted' })), printCommand)
    const printer = printerConfig({ driver: 'tspl', port: { type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: 9100 } })
    const doc = sampleDoc()
    const d = deps(doc, printer)
    d.printTab = tab(doc, { count: 25 })
    await executePrint(false, d, {})

    expect(printCommand).toHaveBeenCalledTimes(2)
    expect(d.logPrint).toHaveBeenCalledWith('command', false, expect.anything(), expect.anything(), expect.objectContaining({ status: 'partial', sentCount: 24 }))
    expect(d.bumpSerial).toHaveBeenCalledWith('tab-1', 24, 1, 'C:/labels/test.msdx')
  })

  it('passes the selected encoding to the transport', async () => {
    const { printCommand } = installWindow()
    const printer = printerConfig({ driver: 'tspl', port: { type: 'tcp', encoding: 'gbk', tcpHost: '127.0.0.1', tcpPort: 9100 } })
    const d = deps(sampleDoc(), printer)
    await executePrint(false, d, {})
    expect((printCommand.mock.calls[0] as unknown[])[0]).toMatchObject({ encoding: 'gbk' })
  })

  it('merges all batches into one file-port payload', async () => {
    const { printCommand } = installWindow()
    const printer = printerConfig({ driver: 'tspl', port: { type: 'file', encoding: 'utf8' } })
    const doc = sampleDoc()
    const d = deps(doc, printer)
    d.printTab = tab(doc, { count: 25 })
    await executePrint(false, d, {})

    expect(printCommand).toHaveBeenCalledTimes(1)
    const payload = (printCommand.mock.calls[0] as unknown[])[0] as { port: { type: string }; segments: unknown[] }
    expect(payload.port.type).toBe('file')
    expect(payload.segments.length).toBeGreaterThan(0)
    expect(d.logPrint).toHaveBeenCalledWith('command', false, expect.anything(), expect.anything(), expect.objectContaining({ status: 'submitted', sentCount: 25 }))
  })

  it('cancels before the next batch and records only confirmed labels', async () => {
    const controller = new AbortController()
    const printCommand = vi.fn(async () => {
      controller.abort()
      return { ok: true, status: 'submitted' }
    })
    installWindow(vi.fn(async () => ({ ok: true, status: 'submitted' })), printCommand)
    const printer = printerConfig({ driver: 'tspl', port: { type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: 9100 } })
    const doc = sampleDoc()
    const d = deps(doc, printer)
    d.printTab = tab(doc, { count: 25 })
    d.signal = controller.signal
    await executePrint(false, d, {})

    expect(printCommand).toHaveBeenCalledTimes(1)
    expect(d.logPrint).toHaveBeenCalledWith('command', false, expect.anything(), expect.anything(), expect.objectContaining({ status: 'canceled', sentCount: 24 }))
    expect(d.bumpSerial).toHaveBeenCalledWith('tab-1', 24, 1, 'C:/labels/test.msdx')
  })

  it('blocks native output when a required page bitmap is unavailable', async () => {
    const { printCommand } = installWindow()
    const doc: LabelDoc = {
      ...sampleDoc(),
      objects: [
        {
          ...sampleDoc().objects[0],
          colorChange: { mode: 'index', tableSource: 'shared', privateTable: [], changeMode: 'solid', blockRows: 1, blockCols: 1, variableName: '' }
        } as LabelDoc['objects'][number]
      ]
    }
    const printer = printerConfig({ driver: 'tspl', port: { type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: 9100 } })
    const d = deps(doc, printer)
    await executePrint(false, d, {})

    expect(printCommand).not.toHaveBeenCalled()
    expect((d.setStatus as ReturnType<typeof vi.fn>).mock.calls.flat().join(' ')).toMatch(/打印已阻止|无法完整输出/)
  })

  it('does not log or advance serials for a test print', async () => {
    const { printCommand } = installWindow()
    const printer = printerConfig({ driver: 'tspl', port: { type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: 9100 } })
    const d = deps(sampleDoc(), printer)
    await executePrint(true, d, {})

    expect(printCommand).toHaveBeenCalledTimes(1)
    expect(d.logPrint).not.toHaveBeenCalled()
    expect(d.bumpSerial).not.toHaveBeenCalled()
    expect((d.setStatus as ReturnType<typeof vi.fn>).mock.calls.flat().join(' ')).toMatch(/测试打印不计日志/)
  })

  it('blocks an empty database instead of falling back to constants', async () => {
    installWindow()
    const doc: LabelDoc = { ...sampleDoc(), datasets: { empty: { name: 'empty', columns: ['value'], rows: [] } } }
    const d = deps(doc)
    d.printTab = tab(doc, { datasetName: 'empty', count: 1 })
    await executePrint(false, d, {})

    expect(d.logPrint).not.toHaveBeenCalled()
    expect(d.bumpSerial).not.toHaveBeenCalled()
    expect((d.setStatus as ReturnType<typeof vi.fn>).mock.calls.flat().join(' ')).toMatch(/没有可打印的数据库记录/)
  })
})
