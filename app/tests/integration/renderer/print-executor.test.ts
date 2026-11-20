import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LabelDoc } from '@shared/domain/document'
import { normalizeDocument } from '@shared/domain'
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
import { renderDriverPage } from '@/print/driverPage'
import { prepareBitmapsForPrintJob } from '@/print/bitmapSource'
import { printJobJournal } from '@/features/printing/printJobJournal'

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
    maxlabel: { printLabel, printCommand, stagePrintCommand: vi.fn(async () => {}), printCommandFile: vi.fn(async () => ({ ok: true, status: 'submitted' })) },
    prompt: vi.fn()
  }
  return { printLabel, printCommand }
}

beforeEach(() => {
  vi.clearAllMocks()
})

const tcpPrinter = printerConfig({ driver: 'tspl', port: { type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: 9100 } })

describe('print pipeline safety', () => {
  it('keeps canceled port enumeration from reaching preparation or submission', async () => {
    const { printCommand } = installWindow()
    const controller = new AbortController()
    const printer = printerConfig({ port: { type: 'usb', encoding: 'utf8' } })
    const d = deps(sampleDoc(), printer, {
      signal: controller.signal,
      resolvePrinter: async () => {
        controller.abort()
        return { ...printer, port: { ...printer.port, usbPort: 'USB001' } }
      }
    })
    await expect(executePrint(false, d, {})).resolves.toBe(false)
    expect(printCommand).not.toHaveBeenCalled()
    expect(d.bumpSerial).not.toHaveBeenCalled()
    expect(d.setBusy).toHaveBeenLastCalledWith(false)
  })
  it('sends nothing if bitmap preparation fails in the second batch', async () => {
    const { printCommand } = installWindow()
    const doc = sampleDoc({ objects: [] })
    const d = deps(doc, tcpPrinter, { printTab: tab(doc, { count: 25 }) })
    vi.mocked(prepareBitmapsForPrintJob).mockImplementationOnce(async (job) => job)
      .mockRejectedValueOnce(new Error('second batch bitmap failed'))
    await expect(executePrint(false, d, {})).resolves.toBe(false)
    expect(printCommand).not.toHaveBeenCalled()
    expect(d.bumpSerial).not.toHaveBeenCalled()
  })
  it.each([
    'function OnBeginLabel() { X = 1 / (25 - V_LABELNO); }',
    'function OnEndPrint() { X = 1 / 0; }'
  ])('checks the full script lifecycle before sending any batch', async (globalScript) => {
    const { printCommand } = installWindow()
    const doc = sampleDoc({ objects: [sampleDoc().objects[0]], globalScript })
    const d = deps(doc, tcpPrinter, { printTab: tab(doc, { count: 25 }) })
    d.options.allowScript = true
    await expect(executePrint(false, d, {})).resolves.toBe(false)
    expect(printCommand).not.toHaveBeenCalled()
    expect(d.bumpSerial).not.toHaveBeenCalled()
    expect(d.setStatus).toHaveBeenLastCalledWith(expect.stringContaining('脚本'))
  })

  it('preserves script state and resolved values across the verified and transmitted batches', async () => {
    const { printCommand } = installWindow()
    const barcode = sampleDoc().objects[2]
    if (barcode.type !== 'barcode') throw new Error('expected test fixture barcode')
    const doc = sampleDoc({
      objects: [{ ...barcode, showText: false, source: { kind: 'script', code: 'function OnGetData() { return X; }' } }],
      globalScript: 'function OnBeginPrint() { X = 0; }\nfunction OnBeginLabel() { X = X + 1; }'
    })
    const d = deps(doc, tcpPrinter, { printTab: tab(doc, { count: 25 }) })
    d.options.allowScript = true
    const ok = await executePrint(false, d, {})
    expect(ok, vi.mocked(d.setStatus).mock.lastCall?.[0]).toBe(true)
    expect(printCommand).toHaveBeenCalledTimes(2)
    expect(d.logPrint).toHaveBeenCalledWith('command', false, Array.from({ length: 25 }, (_, index) => String(index + 1)), expect.anything(), expect.objectContaining({ sentCount: 25 }))
  })

  it('asks the operator to check the printer after an uncertain send', async () => {
    const { printCommand } = installWindow()
    printCommand.mockResolvedValueOnce({ ok: false, status: 'unknown' })
    const d = deps(sampleDoc({ objects: [] }), tcpPrinter)
    await expect(executePrint(false, d, {})).resolves.toBe(false)
    expect(d.logPrint).toHaveBeenCalledWith('command', false, undefined, expect.anything(), expect.objectContaining({ status: 'unknown', sentCount: 0 }))
    expect(d.setStatus).toHaveBeenLastCalledWith(expect.stringContaining('请先核对'))
    expect(d.bumpSerial).not.toHaveBeenCalled()
  })

  it('records a successful serial writeback after a partially sent job', async () => {
    const { printCommand } = installWindow()
    printCommand.mockResolvedValueOnce({ ok: true, status: 'accepted' }).mockResolvedValueOnce({ ok: false, status: 'failed' })
    const doc = sampleDoc({ objects: [] })
    const d = deps(doc, tcpPrinter, { printTab: tab(doc, { count: 25 }) })
    await expect(executePrint(false, d, {})).resolves.toBe(false)
    expect(printJobJournal.serialCommitted).toHaveBeenCalledOnce()
    expect(printJobJournal.finish).toHaveBeenCalledWith(expect.any(String), 'partial', undefined)
  })

  it('blocks RFID in driver jobs before sending or advancing serials', async () => {
    const { printLabel } = installWindow()
    const doc = sampleDoc({ objects: [{
      id: 'rfid', type: 'rfid', x: 0, y: 0, w: 20, h: 5, rotation: 0, bank: 'EPC', lock: false,
      source: { kind: 'constant', value: 'E200000001' }
    }] })
    const d = deps(doc, printerConfig({ port: { type: 'driver', encoding: 'utf8' } }))
    await expect(executePrint(false, d, {})).resolves.toBe(false)
    expect(printLabel).not.toHaveBeenCalled()
    expect(renderDriverPage).not.toHaveBeenCalled()
    expect(d.bumpSerial).not.toHaveBeenCalled()
    expect(d.setStatus).toHaveBeenLastCalledWith(expect.stringContaining('RFID'))
  })

  it.each([{ count: 10001, copies: 1 }, { count: 1, copies: 10001 }])('rejects an oversized driver plan before rendering ($count × $copies)', async (overrides) => {
    const { printLabel } = installWindow(vi.fn(async () => ({ ok: false, status: 'failed' })))
    const doc = sampleDoc({ objects: [] })
    const d = deps(doc, printerConfig({ port: { type: 'driver', encoding: 'utf8' } }), { printTab: tab(doc, overrides) })
    await expect(executePrint(false, d, {})).resolves.toBe(false)
    expect(printLabel).not.toHaveBeenCalled()
    expect(renderDriverPage).not.toHaveBeenCalled()
    expect(d.setStatus).toHaveBeenLastCalledWith(expect.stringContaining('10000'))
  })
})

describe('driver printing', () => {
  it('keeps the submitted system dialog job for review without advancing serials', async () => {
    installWindow(vi.fn(async () => ({ ok: false, status: 'unknown', messageKey: 'print.status.driverDialogUnverified' })))
    const refreshRecovery = vi.fn(async () => undefined)
    const d = deps(sampleDoc(), printerConfig({ port: { type: 'driver', encoding: 'utf8' } }), { refreshRecovery })
    await expect(executePrint(false, d, {})).resolves.toBe(false)
    expect(d.bumpSerial).not.toHaveBeenCalled()
    expect(d.logPrint).toHaveBeenCalledWith('driver', false, expect.anything(), expect.anything(), expect.objectContaining({ status: 'unknown', sentCount: 0 }))
    expect(d.setStatus).toHaveBeenLastCalledWith(expect.stringContaining('实际打印范围和份数待核对'))
    expect(refreshRecovery).toHaveBeenCalledOnce()
  })

  it('submits one driver page, logs and advances serials', async () => {
    const { printLabel } = installWindow()
    const doc = sampleDoc()
    const d = deps(doc, printerConfig({ driver: 'tspl', port: { type: 'driver', encoding: 'utf8' } }))
    await executePrint(false, d, {})

    expect(printLabel).toHaveBeenCalledTimes(1)
    expect((printLabel.mock.calls[0] as unknown[])[0]).toMatchObject({
      widthMm: 60,
      heightMm: 40,
      pages: [{ svg: expect.stringContaining('<svg'), copies: 1 }]
    })
    expect(d.logPrint).toHaveBeenCalledWith('driver', false, expect.anything(), expect.anything(), expect.objectContaining({ status: 'submitted', sentCount: 1 }))
    expect(d.bumpSerial).toHaveBeenCalledWith('tab-1', { labels: 1, records: 1 }, 1, 'C:/labels/test.msdx')
    expect(d.setBusy).toHaveBeenNthCalledWith(1, true)
    expect(d.setBusy).toHaveBeenLastCalledWith(false)
  })

  it('reports page-preparation progress and clears it when the job finishes', async () => {
    installWindow()
    const progress: Array<{ done: number; total: number } | null> = []
    const d = deps(sampleDoc(), printerConfig({ driver: 'tspl', port: { type: 'driver', encoding: 'utf8' } }), {
      setPrintProgress: (value) => progress.push(value)
    })
    await executePrint(false, d, {})

    expect(progress[0]).toEqual({ done: 0, total: 0 })
    expect(progress).toContainEqual({ done: 1, total: 1 })
    expect(progress.at(-1)).toBeNull()
  })

  it('submits a raster fallback page when vector output is unavailable', async () => {
    vi.mocked(renderDriverPage).mockResolvedValueOnce({ kind: 'raster', dataUrl: 'data:image/png;base64,AA==' })
    const { printLabel } = installWindow()
    const d = deps(sampleDoc(), printerConfig({ driver: 'tspl', port: { type: 'driver', encoding: 'utf8' } }))
    await executePrint(false, d, {})

    expect((printLabel.mock.calls[0] as unknown[])[0]).toMatchObject({
      pages: [{ dataUrl: 'data:image/png;base64,AA==', copies: 1 }]
    })
  })

  it('keeps mixed vector/raster page order and copies', async () => {
    vi.mocked(renderDriverPage)
      .mockResolvedValueOnce({ kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>a</text></svg>' })
      .mockResolvedValueOnce({ kind: 'raster', dataUrl: 'data:image/png;base64,AA==' })
    const { printLabel } = installWindow()
    const doc = sampleDoc()
    const d = deps(doc, printerConfig({ driver: 'tspl', port: { type: 'driver', encoding: 'utf8' }, printerName: 'Zenpert 4T530' }), {
      printTab: tab(doc, { count: 2, printCount: 2 })
    })
    await executePrint(false, d, {})

    const payload = (printLabel.mock.calls[0] as unknown[])[0] as { pages: Array<{ svg?: string; dataUrl?: string; copies: number }>; printerName?: string }
    expect(payload.pages).toHaveLength(2)
    expect(payload.pages[0].svg).toContain('<svg')
    expect(payload.pages[1].dataUrl).toBe('data:image/png;base64,AA==')
    expect(payload.pages.every((page) => page.copies === 1)).toBe(true)
    expect(payload.printerName).toBe('Zenpert 4T530')
  })

  it('多联版式里放到标签格之外的文字会在状态里提示已跳过', async () => {
    installWindow()
    const doc = normalizeDocument({
      version: 3,
      name: 'stray',
      widthMm: 40,
      heightMm: 30,
      layout: { rows: 1, cols: 2, rowGapMm: 2, colGapMm: 2, shape: 'rect', pageWidthMm: 82, pageHeightMm: 30 },
      objects: [{
        id: 'stray', type: 'text', x: 41, y: 4, w: 10, h: 8, rotation: 0,
        fontFamily: '微软雅黑', fontSize: 4, bold: false, align: 'left', color: '#000000',
        source: { kind: 'constant', value: '试用装' }
      }]
    })
    const d = deps(doc, printerConfig({ driver: 'tspl', port: { type: 'driver', encoding: 'utf8' } }))
    await executePrint(false, d, {})

    const status = (d.setStatus as ReturnType<typeof vi.fn>).mock.calls.flat().join(' ')
    expect(status).toContain('跳过')
    expect(status).toContain('试用装')
  })

  it('localizes a main-process error for the active UI language', async () => {
    installWindow(vi.fn(async () => ({ ok: false, status: 'failed', message: '原始错误', messageKey: 'error.printFailed' })))
    const d = deps(sampleDoc(), printerConfig({ port: { type: 'driver', encoding: 'utf8' } }), { language: 'en-US' })
    await executePrint(false, d, {})

    const status = (d.setStatus as ReturnType<typeof vi.fn>).mock.calls.flat().join(' ')
    expect(status).toContain('Driver print incomplete')
    expect(status).toContain('Print failed')
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
    expect(d.bumpSerial).toHaveBeenCalledWith('tab-1', { labels: 1, records: 1 }, 1, 'C:/labels/test.msdx')
  })

  it('reports sent-label progress and clears it when the job finishes', async () => {
    installWindow()
    const progress: Array<{ done: number; total: number } | null> = []
    const printer = printerConfig({ driver: 'tspl', port: { type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: 9100 } })
    const d = deps(sampleDoc(), printer, { setPrintProgress: (value) => progress.push(value) })
    await executePrint(false, d, {})

    expect(progress[0]).toEqual({ done: 0, total: 0 })
    expect(progress).toContainEqual({ done: 1, total: 1 })
    expect(progress.at(-1)).toBeNull()
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
    expect(d.bumpSerial).toHaveBeenCalledWith('tab-1', { labels: 24, records: 24 }, 1, 'C:/labels/test.msdx')
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
    expect(d.bumpSerial).toHaveBeenCalledWith('tab-1', { labels: 24, records: 24 }, 1, 'C:/labels/test.msdx')
  })

  it('blocks native output when a required page bitmap is unavailable', async () => {
    const { printCommand } = installWindow()
    // 弧形文字无法逐对象裁图，仍然依赖整页位图；缺少位图时必须阻止输出。
    const doc: LabelDoc = {
      ...sampleDoc(),
      objects: [
        {
          ...sampleDoc().objects[1],
          arc: true
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
