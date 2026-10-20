import { rm, writeFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { launchApp, openFixture } from './fixtures/electron-app'

interface WeighFixtureOptions {
  autoPrint?: boolean
  unitConv?: boolean
}

/** Minimal template whose only text object is fed by an electronic scale. */
async function makeWeighFixture(options: WeighFixtureOptions = {}): Promise<{ dir: string; path: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'maxlabel-scale-'))
  const path = join(dir, `scale-${Date.now()}.msdx`)
  const envelope = {
    format: 'maxlabel-msdx',
    version: 2,
    app: 'MaxLabel',
    doc: {
      version: 2,
      name: 'E2E 称重',
      widthMm: 60,
      heightMm: 40,
      objects: [
        {
          id: 'weight-1',
          type: 'text',
          x: 4,
          y: 4,
          w: 52,
          h: 8,
          rotation: 0,
          fontFamily: 'Arial',
          fontSize: 6,
          bold: false,
          align: 'left',
          color: '#000000',
          source: {
            kind: 'keyboard',
            label: '重量',
            inputDevice: 'weigh',
            weighProtocol: 'standard',
            weighPort: 'COM3',
            weighBaud: '9600',
            weighUnit: options.unitConv ? 'g' : 'kg',
            weighDecimals: options.unitConv ? 0 : 2,
            weighUnitConv: options.unitConv === true,
            weighAutoPrint: options.autoPrint === true
          }
        }
      ]
    }
  }
  await writeFile(path, JSON.stringify(envelope, null, 2), 'utf8')
  return { dir, path }
}

test('weighs a stable value with unit conversion and renders the preview', async () => {
  const fixture = await makeWeighFixture({ unitConv: true })
  const launched = await launchApp({ MAXLABEL_OPEN_PATH: fixture.path, MAXLABEL_SCALE_SIM: 'stable', MAXLABEL_SCALE_VALUE: '1.234' })
  const w = launched.window
  try {
    await openFixture(w)
    const previewPromise = launched.app.waitForEvent('window', { timeout: 15_000 })
    await w.locator('[title="打印预览"]').click()
    const preview = await previewPromise
    await preview.waitForLoadState('domcontentloaded')
    await expect(preview.locator('#ppage')).toHaveText('1/1', { timeout: 15_000 })
    await preview.close()
  } finally {
    await launched.close()
    await rm(fixture.dir, { recursive: true, force: true }).catch(() => undefined)
  }
})

test('reports a disconnected scale and opens no preview', async () => {
  const fixture = await makeWeighFixture()
  const launched = await launchApp({ MAXLABEL_OPEN_PATH: fixture.path, MAXLABEL_SCALE_SIM: 'disconnected' })
  const w = launched.window
  try {
    await openFixture(w)
    await w.locator('[title="打印预览"]').click()
    await expect(w.locator('[data-testid="status-bar"]')).toHaveAttribute('title', /端口无法打开|port could not be opened/, { timeout: 15_000 })
    expect(launched.app.windows().length).toBe(1)
  } finally {
    await launched.close()
    await rm(fixture.dir, { recursive: true, force: true }).catch(() => undefined)
  }
})

test('shows the auto-print control only for a weigh source that enables it', async () => {
  const fixture = await makeWeighFixture({ autoPrint: true })
  const launched = await launchApp({ MAXLABEL_OPEN_PATH: fixture.path, MAXLABEL_SCALE_SIM: 'stable' })
  const w = launched.window
  try {
    await openFixture(w)
    await w.locator('[data-testid="print-dock"]').waitFor({ timeout: 15_000 })
    await expect(w.locator('[data-testid="scale-auto-print"]')).toBeVisible()
  } finally {
    await launched.close()
    await rm(fixture.dir, { recursive: true, force: true }).catch(() => undefined)
  }
})
