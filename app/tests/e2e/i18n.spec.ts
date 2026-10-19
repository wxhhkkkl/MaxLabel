import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { launchApp, makeFixtureTemplate } from './fixtures/electron-app'

test('switches to English, localizes the shell/help and persists after reload', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    // Keep the first launch deterministic regardless of the CI OS locale.
    await w.evaluate(() => localStorage.setItem('maxlabel.options', JSON.stringify({ language: 'zh-CN' })))
    await w.reload()
    await w.locator('[data-testid="start-page"]').waitFor({ timeout: 15_000 })

    await w.getByText('选项(O)', { exact: true }).click()
    await w.getByText('系统选项(C)...', { exact: true }).click()
    await w.locator('[data-testid="options-language"]').selectOption('en-US')
    await w.locator('[data-testid="options-save"]').click()

    await expect(w.getByText('Options(O)', { exact: true })).toBeVisible()
    await expect.poll(() => w.title(), { timeout: 10_000 }).toContain('Start Page')
    await w.getByText('Help(H)', { exact: true }).click()
    await w.getByText('Help Topics(H)', { exact: true }).click()
    await expect(w.locator('[data-testid="help-dialog"]')).toBeVisible()
    await expect(w.locator('[data-help-key="start"]')).toContainText('Quick Start')
    await w.keyboard.press('Escape')

    await w.reload()
    await w.locator('[data-testid="start-page"]').waitFor({ timeout: 15_000 })
    await expect(w.getByText('Options(O)', { exact: true })).toBeVisible()
  } finally {
    await launched.close()
  }
})

test('fits the English options and help dialogs at the supported minimum size', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.evaluate(() => localStorage.setItem('maxlabel.options', JSON.stringify({ language: 'en-US' })))
    await w.reload()
    await w.locator('[data-testid="start-page"]').waitFor({ timeout: 15_000 })
    await w.setViewportSize({ width: 1024, height: 700 })

    await w.getByText('Options(O)', { exact: true }).click()
    await w.getByText('System Options(C)...', { exact: true }).click()
    await expect(w.locator('[data-testid="options-dialog"]')).toBeVisible()
    for (const tab of ['print', 'edit', 'system']) {
      await w.locator(`[data-testid="options-tab-${tab}"]`).click()
      expect((await w.locator('[data-testid="options-dialog"]').textContent()) ?? '').not.toMatch(/[一-鿿]/)
    }
    const optionsFit = await w.locator('[data-testid="options-dialog"]').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
    expect(optionsFit).toBe(true)
    await expect(w.locator('[data-testid="options-save"]')).toBeVisible()
    await w.locator('[data-testid="options-save"]').click()

    await w.getByText('Help(H)', { exact: true }).click()
    await w.getByText('Help Topics(H)', { exact: true }).click()
    await expect(w.locator('[data-testid="help-dialog"]')).toBeVisible()
    await expect(w.locator('[data-testid="help-section"]')).toHaveCount(8)
    const helpFit = await w.locator('[data-testid="help-dialog"]').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
    expect(helpFit).toBe(true)
  } finally {
    await launched.close()
  }
})

test('keeps the document and print settings while switching language', async () => {
  const fixture = await makeFixtureTemplate()
  const before = await readFile(fixture.path, 'utf8')
  const launched = await launchApp({ MAXLABEL_OPEN_PATH: fixture.path })
  const w = launched.window
  try {
    await w.evaluate(() => localStorage.setItem('maxlabel.options', JSON.stringify({ language: 'zh-CN' })))
    await w.reload()
    await w.locator('[data-testid="start-page"]').waitFor({ timeout: 15_000 })

    await w.getByText('选项(O)', { exact: true }).click()
    await w.getByText('系统选项(C)...', { exact: true }).click()
    await w.locator('[data-testid="options-language"]').selectOption('en-US')
    await w.locator('[data-testid="options-save"]').click()

    await w.locator('[data-testid="toolbar"] [title="Open Label Template"]').click()
    await w.locator('[data-testid="print-dock"]').waitFor({ timeout: 15_000 })
    await w.locator('[title="Print"]').click()
    await expect(w.locator('[data-testid="print-dialog"]')).toBeVisible()
    await expect(w.locator('[data-testid="print-dialog"]')).toContainText('Print Count')
    await expect(w.locator('[data-testid="print-dialog-test-print"]')).toContainText('Test Print')

    // No Chinese-only label may remain in the primary print dialog.
    const printText = (await w.locator('[data-testid="print-dialog"]').textContent()) ?? ''
    expect(printText).not.toMatch(/[一-鿿]/)

    // The printer position and count are independent of the UI language.
    // The label itself is the localized fallback because this fixture has no bound printer.
    await expect(w.locator('[data-testid="print-dialog-printer"]')).toHaveText('Printer')
    await expect(w.locator('[data-testid="print-dialog-printer-position"]')).toHaveText('Windows printer driver port')
    const count = await w.locator('[data-testid="print-dialog-count"]').inputValue()

    await w.locator('[data-testid="print-dialog"] button[aria-label="Close print dialog"]').click()
    await expect(w.locator('[data-testid="print-dialog"]')).toHaveCount(0)

    // Switching back keeps the same document, settings and template untouched.
    await w.getByText('Options(O)', { exact: true }).click()
    await w.getByText('System Options(C)...', { exact: true }).click()
    await w.locator('[data-testid="options-language"]').selectOption('zh-CN')
    await w.locator('[data-testid="options-save"]').click()
    await expect(w.locator('[data-testid="print-dock"]')).toBeVisible()

    await w.locator('[data-testid="toolbar"] [title="打印"]').click()
    await expect(w.locator('[data-testid="print-dialog"]')).toBeVisible()
    await expect(w.locator('[data-testid="print-dialog-printer"]')).toHaveText('打印机')
    await expect(w.locator('[data-testid="print-dialog-printer-position"]')).toHaveText('Windows 打印机驱动端口')
    expect(await w.locator('[data-testid="print-dialog-count"]').inputValue()).toBe(count)
    expect(await readFile(fixture.path, 'utf8')).toBe(before)
  } finally {
    await launched.close()
  }
})

test('follows the OS language on first launch and otherwise falls back to Chinese', async () => {
  const english = await launchApp()
  try {
    await english.window.addInitScript(() => {
      localStorage.removeItem('maxlabel.options')
      Object.defineProperty(navigator, 'language', { configurable: true, get: () => 'en-US' })
    })
    await english.window.reload()
    await english.window.locator('[data-testid="start-page"]').waitFor({ timeout: 15_000 })
    await expect(english.window.getByText('Options(O)', { exact: true })).toBeVisible()
  } finally {
    await english.close()
  }

  const other = await launchApp()
  try {
    await other.window.addInitScript(() => {
      localStorage.removeItem('maxlabel.options')
      Object.defineProperty(navigator, 'language', { configurable: true, get: () => 'fr-FR' })
    })
    await other.window.reload()
    await other.window.locator('[data-testid="start-page"]').waitFor({ timeout: 15_000 })
    await expect(other.window.getByText('选项(O)', { exact: true })).toBeVisible()
  } finally {
    await other.close()
  }
})

test('fits the English print, printer-settings and object-properties dialogs at the minimum size', async () => {
  const fixture = await makeFixtureTemplate()
  const launched = await launchApp({ MAXLABEL_OPEN_PATH: fixture.path })
  const w = launched.window
  try {
    await w.evaluate(() => localStorage.setItem('maxlabel.options', JSON.stringify({ language: 'en-US' })))
    await w.reload()
    await w.locator('[data-testid="start-page"]').waitFor({ timeout: 15_000 })
    await w.locator('[data-testid="toolbar"] [title="Open Label Template"]').click()
    await w.locator('[data-testid="print-dock"]').waitFor({ timeout: 15_000 })
    await w.setViewportSize({ width: 1024, height: 700 })

    await w.locator('[data-testid="toolbar"] [title="Print"]').click()
    const printDialog = w.locator('[data-testid="print-dialog"]')
    await expect(printDialog).toBeVisible()
    expect(await printDialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await expect(w.locator('[data-testid="print-dialog-submit"]')).toBeVisible()
    expect((await printDialog.textContent()) ?? '').not.toMatch(/[一-鿿]/)
    await w.locator('[data-testid="print-dialog"] button[aria-label="Close print dialog"]').click()
    await expect(printDialog).toHaveCount(0)

    await w.locator('[data-testid="print-printer-settings"]').click()
    const printerDialog = w.locator('[data-testid="printer-settings-dialog"]')
    await expect(printerDialog).toBeVisible()
    expect(await printerDialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    expect((await printerDialog.textContent()) ?? '').not.toMatch(/[一-鿿]/)
    await w.keyboard.press('Escape')
    await expect(printerDialog).toHaveCount(0)

    await w.locator('[data-testid="template-edit-area"]').click({ position: { x: 60, y: 40 } })
    await w.keyboard.press('Control+A')
    await expect(w.locator('[data-testid="property-panel"]')).toBeVisible()
    expect((await w.locator('[data-testid="property-panel"]').textContent()) ?? '').not.toMatch(/[一-鿿]/)
    await w.locator('[data-testid="print-tab-server"]').click()
    const dockText = (await w.locator('[data-testid="print-dock"]').textContent()) ?? ''
    const dockTitle = (await w.locator('[data-testid="print-dock-title"]').textContent()) ?? ''
    // The dock title contains user-authored template content and must remain untranslated.
    expect(dockText.replace(dockTitle, '')).not.toMatch(/[一-鿿]/)
    await w.locator('[data-testid="format-props"]').click()
    const propsDialog = w.locator('[data-testid="object-props-dialog"]')
    await expect(propsDialog).toBeVisible()
    expect(await propsDialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    expect((await propsDialog.textContent()) ?? '').not.toMatch(/[一-鿿]/)
  } finally {
    await launched.close()
  }
})

test('opens the print preview window in English', async () => {
  const fixture = await makeFixtureTemplate()
  const launched = await launchApp({ MAXLABEL_OPEN_PATH: fixture.path })
  const w = launched.window
  try {
    await w.evaluate(() => localStorage.setItem('maxlabel.options', JSON.stringify({ language: 'en-US' })))
    await w.reload()
    await w.locator('[data-testid="start-page"]').waitFor({ timeout: 15_000 })
    await w.locator('[data-testid="toolbar"] [title="Open Label Template"]').click()
    await w.locator('[data-testid="print-dock"]').waitFor({ timeout: 15_000 })

    const previewPromise = launched.app.waitForEvent('window', { timeout: 15_000 })
    await w.locator('[title="Print Preview"]').click()
    const preview = await previewPromise
    await preview.waitForLoadState('domcontentloaded')
    await expect(preview).toHaveTitle('Print Preview')
    await expect(preview.locator('#ppage')).toHaveText('1/1', { timeout: 15_000 })
    await expect(preview.locator('#zfit')).toHaveText('Fit')
    await expect(preview.locator('#pclose')).toHaveText('Close')

    const closed = preview.waitForEvent('close', { timeout: 10_000 })
    await preview.locator('#pclose').click()
    await closed
  } finally {
    await launched.close()
  }
})
