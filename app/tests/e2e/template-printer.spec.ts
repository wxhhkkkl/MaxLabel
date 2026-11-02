import { test, expect } from '@playwright/test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launchApp, openFixture } from './fixtures/electron-app'

/** 原模板绑定的打印机不在本机时，不能把它的名称/驱动/端口带进文档。 */
test('打开模板时丢弃本机不存在的打印机配置，回退当前默认打印机', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'maxlabel-printer-'))
  const path = join(dir, 'missing-printer.msdx')
  const missing = '客户电脑上的 TSC TX600'
  const envelope = {
    format: 'maxlabel-msdx',
    version: 3,
    app: 'MaxLabel',
    doc: {
      version: 2,
      name: '打印机回退',
      widthMm: 60,
      heightMm: 40,
      printer: {
        driver: 'tspl',
        dpi: 600,
        speed: 4,
        density: 8,
        printMode: 'thermal',
        labelType: 'gap',
        topOffsetMm: 0,
        mediaHandle: 'tear',
        backfeedMm: 0,
        port: { type: 'driver', encoding: 'utf8' },
        printerName: missing
      },
      objects: [{
        id: 't1', type: 'text', x: 4, y: 4, w: 52, h: 8, rotation: 0,
        fontFamily: 'Arial', fontSize: 6, bold: false, align: 'left', color: '#000000',
        source: { kind: 'constant', value: 'TEST' }
      }]
    }
  }
  await writeFile(path, JSON.stringify(envelope, null, 2), 'utf8')
  const launched = await launchApp({ MAXLABEL_OPEN_PATH: path })
  const w = launched.window
  try {
    await openFixture(w)
    await w.locator('[data-testid="print-dock"]').waitFor({ timeout: 15_000 })
    const select = w.locator('[data-testid="print-printer"]')
    // 不再出现「当前模板打印机」这一项；驱动/DPI/端口也回退到本机默认（默认 203dpi）。
    await expect(w.locator(`[data-testid="print-printer"] option[value="${missing}"]`)).toHaveCount(0)
    await expect(select).toHaveValue('')
    await expect(select).toHaveAttribute('title', /203dpi/)
    await expect(select).not.toHaveAttribute('title', /600dpi/)
  } finally {
    await launched.close()
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
})
