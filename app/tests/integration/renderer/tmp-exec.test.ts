// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { describe, it, vi } from 'vitest'
import type { LabelDoc } from '@shared/domain/document'
import type { DocTab } from '@/features/workspace/useDocumentWorkspace'
import { printerConfig } from '../../helpers/factories'
import { importLsdx } from '@/io/lsdxImport'
import { normalizeDocument } from '@shared/domain'

vi.mock('@/print/renderLabel', () => ({ pageSizeMm: () => ({ widthMm: 80, heightMm: 30 }), renderLabelDataUrl: vi.fn(async () => 'data:image/png;base64,AA==') }))
vi.mock('@/print/driverPage', () => ({ renderDriverPage: vi.fn(async () => ({ kind: 'svg', svg: '<svg xmlns="http://www.w3.org/2000/svg"/>' })) }))
vi.mock('@/print/bitmapSource', () => ({ prepareBitmapsForPrintJob: vi.fn(async (job: unknown) => job) }))
vi.mock('@/features/printing/printJobJournal', () => ({ printJobJournal: { begin: vi.fn(), progress: vi.fn(), finish: vi.fn(), serialCommitted: vi.fn() } }))

import { executePrint } from '@/features/printing/printExecutor'

function tab(doc: LabelDoc): DocTab {
  return { key: 't', title: 't', doc, selectedId: null, count: 1, printCount: 1, copies: 2, datasetName: '', zoom: 1, tool: 'select', recordIdx: 0, startLabel: 2, path: '', dirty: false, revision: 1 }
}

describe('exec', () => {
  it('captures commands', async () => {
    const imported = await importLsdx(readFileSync('D:/商品导出.lsdx', 'utf8'), 'x.lsdx')
    const doc = normalizeDocument(imported.doc)
    const printer = printerConfig({ driver: 'tspl', dpi: 600, port: { type: 'tcp', tcpHost: '127.0.0.1', tcpPort: 9100, encoding: 'utf8' } })
    let captured = ''
    ;(globalThis as { window?: unknown }).window = {
      maxlabel: { printLabel: vi.fn(), printCommandFile: vi.fn(), printCommand: vi.fn(async (payload: { segments?: Array<{ type: string; str?: string }> }) => { captured = (payload.segments ?? []).map((s) => s.type === 'text' ? (s.str ?? '') : '[BIN]').join(''); return { ok: true, status: 'submitted' } }) },
      prompt: vi.fn()
    }
    const deps = {
      sourceDoc: doc, printTab: tab(doc), printer,
      options: { allowScript: false, printNonPrintable: false, autoRotateOutput: false, advanced: { autoCount: false, copyField: false, copyFieldName: '', firstCopyAsk: false, dupcheck: false, currentOnly: false, updateSerial: false }, keyboardValues: {} },
      refreshAutoDb: async (s: LabelDoc) => ({ doc: s, error: null, revision: 1 }),
      bumpSerial: vi.fn(async () => ({ ok: true })),
      logPrint: vi.fn(async () => undefined), setBusy: vi.fn(), setStatus: vi.fn()
    }
    await executePrint(false, deps as never, {})
    const lines = captured.split('\n').filter((l) => /TEXT |QRCODE|BITMAP|PRINT |SIZE /.test(l))
    console.log('OUT', lines.length)
    for (const line of lines) console.log('L', line.slice(0, 100))
  })
})
