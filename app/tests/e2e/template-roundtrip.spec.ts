import { readFileSync, statSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { launchApp, makeFixtureTemplate, openFixture } from './fixtures/electron-app'

test('opens a template, saves it and preserves the document', async () => {
  const fixture = await makeFixtureTemplate()
  const launched = await launchApp({ MAXLABEL_OPEN_PATH: fixture.path })
  try {
    const path = fixture.path
    await openFixture(launched.window)
    const before = statSync(path).mtimeMs

    await launched.window.keyboard.press('Control+s')
    await expect.poll(() => statSync(path).mtimeMs, { timeout: 10_000 }).toBeGreaterThan(before)

    const saved = JSON.parse(readFileSync(path, 'utf8'))
    expect(saved.format).toBe('maxlabel-msdx')
    expect(saved.doc.name).toBe('E2E 测试')
    expect(saved.doc.widthMm).toBe(60)
    expect(saved.doc.heightMm).toBe(40)
    expect(saved.doc.objects).toHaveLength(1)
  } finally {
    await launched.close()
    await rm(fixture.dir, { recursive: true, force: true }).catch(() => undefined)
  }
})
