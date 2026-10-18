import { statSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { launchApp, makeFixtureTemplate, openFixture } from './fixtures/electron-app'

test('edits and saves locally without a reachable license server', async () => {
  const fixture = await makeFixtureTemplate()
  const launched = await launchApp({ MAXLABEL_SERVER_URL: 'http://127.0.0.1:1', MAXLABEL_OPEN_PATH: fixture.path })
  try {
    const path = fixture.path
    await openFixture(launched.window)
    await expect(launched.window.locator('[data-testid="toolbar"]')).toBeVisible()

    const before = statSync(path).mtimeMs
    await launched.window.keyboard.press('Control+s')
    await expect.poll(() => statSync(path).mtimeMs, { timeout: 10_000 }).toBeGreaterThan(before)

    // No blocking license dialog or error surface is present.
    await expect(launched.window.locator('[data-testid="license-dialog"]')).toHaveCount(0)
  } finally {
    await launched.close()
    await rm(fixture.dir, { recursive: true, force: true }).catch(() => undefined)
  }
})
