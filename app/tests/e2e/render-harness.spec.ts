import { resolve } from 'node:path'
import { buildSync } from 'esbuild'
import { expect, test } from '@playwright/test'
import { launchApp, openHarnessWindow } from './fixtures/electron-app'

test('renders pixels, paper shapes and bitmap-cache invalidation', async () => {
  test.setTimeout(120_000)
  const code = buildSync({
    entryPoints: [resolve(__dirname, 'harness/render.ts')],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: 'renderHarness',
    write: false,
    loader: { '.lsdx': 'text' },
    target: 'es2022'
  }).outputFiles[0].text

  const launched = await launchApp()
  try {
    const page = await openHarnessWindow(launched.app)
    const results = await page.evaluate<string[]>(`${code}\nrenderHarness.run()`)
    expect(results.length).toBeGreaterThan(50)
    expect(results.some((line) => line.includes('bitmap cache'))).toBe(true)
    expect(results.some((line) => line.includes('pixel'))).toBe(true)
  } finally {
    await launched.close()
  }
})
