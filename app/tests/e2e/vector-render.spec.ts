import { resolve } from 'node:path'
import { buildSync } from 'esbuild'
import { expect, test } from '@playwright/test'
import { launchApp, openHarnessWindow } from './fixtures/electron-app'

test('renders vector driver pages and barcode SVG fragments', async () => {
  test.setTimeout(120_000)
  const code = buildSync({
    entryPoints: [resolve(__dirname, 'harness/vector-render.ts')],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: 'vectorRenderHarness',
    write: false,
    loader: { '.lsdx': 'text' },
    target: 'es2022'
  }).outputFiles[0].text

  const launched = await launchApp()
  try {
    const page = await openHarnessWindow(launched.app)
    const out = await page.evaluate<{ results: string[]; svg: string; validationError: string; richSvg: string; richValidationError: string }>(`${code}\nvectorRenderHarness.run()`)
    console.log(out.results.join('\n'))
    if (out.validationError) {
      console.log('VALIDATION ERROR:', out.validationError)
      console.log('SVG SAMPLE:', out.svg.slice(0, 6000))
    }
    if (out.richValidationError) {
      console.log('RICH VALIDATION ERROR:', out.richValidationError)
      console.log('RICH SVG SAMPLE:', out.richSvg.slice(0, 6000))
    }
    expect(out.validationError).toBe('')
    expect(out.richValidationError).toBe('')
    expect(out.results.length).toBeGreaterThan(5)
    expect(out.results.some((line) => line.includes('validator'))).toBe(true)
    expect(out.results.some((line) => line.includes('vector'))).toBe(true)
  } finally {
    await launched.close()
  }
})
