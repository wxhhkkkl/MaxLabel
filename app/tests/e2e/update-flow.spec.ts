import { expect, test, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function closeFirstRun(window: Page): Promise<void> {
  const dialog = window.locator('[data-testid="get-started-dialog"]')
  try {
    await dialog.waitFor({ state: 'visible', timeout: 1_500 })
    await dialog.locator('button[aria-label="关闭"]').click()
    await dialog.waitFor({ state: 'hidden', timeout: 3_000 })
  } catch {
    // No first-run dialog in this profile.
  }
}

async function openManualCheck(window: Page): Promise<void> {
  await window.locator('[data-menu-title="帮助(H)"]').click()
  await window.locator('[data-menu-item="查找更新版本"]').click()
}

async function expectUpdateDialog(window: Page): Promise<void> {
  await expect(window.locator('[data-testid="update-dialog"]')).toBeVisible({ timeout: 10_000 })
}

test('startup check prompts for an available update and manual check works', async () => {
  const launched = await launchApp({ MAXLABEL_TEST_UPDATE: 'available' }, { dismissFirstRun: false })
  const window = launched.window
  try {
    await closeFirstRun(window)
    await expectUpdateDialog(window)
    await expect(window.locator('[data-testid="update-dialog"]')).toContainText('1.0.99')
    await expect(window.locator('[data-testid="update-dialog"]')).toContainText('1.0.22')

    await window.locator('[data-testid="update-later"]').click()
    await expect(window.locator('[data-testid="update-dialog"]')).toHaveCount(0)

    await openManualCheck(window)
    await expectUpdateDialog(window)
    await expect(window.locator('[data-testid="update-download"]')).toBeVisible()
  } finally {
    await launched.close()
  }
})

test('latest version stays silent at startup but is reported by manual check', async () => {
  const launched = await launchApp({ MAXLABEL_TEST_UPDATE: 'latest' }, { dismissFirstRun: false })
  const window = launched.window
  try {
    await closeFirstRun(window)
    await window.waitForTimeout(800)
    await expect(window.locator('[data-testid="update-dialog"]')).toHaveCount(0)

    await openManualCheck(window)
    await expectUpdateDialog(window)
    await expect(window.locator('[data-testid="update-dialog"]')).toContainText('当前已是最新版本')
    await expect(window.locator('[data-testid="update-download"]')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('check failures are silent at startup and visible on manual check', async () => {
  const launched = await launchApp({ MAXLABEL_TEST_UPDATE: 'error' }, { dismissFirstRun: false })
  const window = launched.window
  try {
    await closeFirstRun(window)
    await window.waitForTimeout(800)
    await expect(window.locator('[data-testid="update-dialog"]')).toHaveCount(0)

    await openManualCheck(window)
    await expectUpdateDialog(window)
    await expect(window.locator('[data-testid="update-error"]')).toBeVisible()
    await expect(window.locator('[data-testid="update-retry"]')).toBeVisible()
  } finally {
    await launched.close()
  }
})

test('download can be cancelled, then resumed to ready/install', async () => {
  const launched = await launchApp({ MAXLABEL_TEST_UPDATE: 'progress' }, { dismissFirstRun: false })
  const window = launched.window
  try {
    await closeFirstRun(window)
    await expectUpdateDialog(window)
    await window.locator('[data-testid="update-download"]').click()
    await expect(window.locator('[data-testid="update-cancel"]')).toBeVisible({ timeout: 3_000 })
    await window.locator('[data-testid="update-cancel"]').click()
    await expect(window.locator('[data-testid="update-download"]')).toBeVisible({ timeout: 3_000 })

    await window.locator('[data-testid="update-download"]').click()
    // 测试适配器发出 ready 后，App 会在没有未保存标签页时自动请求安装。
    await expect(
      window.locator('[data-testid="update-installing"], [data-testid="update-install"]')
    ).toBeVisible({ timeout: 10_000 })
  } finally {
    await launched.close()
  }
})

test('checksum failure is reported without offering install', async () => {
  const launched = await launchApp({ MAXLABEL_TEST_UPDATE: 'bad-checksum' }, { dismissFirstRun: false })
  const window = launched.window
  try {
    await closeFirstRun(window)
    await expectUpdateDialog(window)
    await window.locator('[data-testid="update-download"]').click()
    await expect(window.locator('[data-testid="update-error"]')).toBeVisible({ timeout: 5_000 })
    await expect(window.locator('[data-testid="update-install"]')).toHaveCount(0)
    await expect(window.locator('[data-testid="update-retry"]')).toBeVisible()
  } finally {
    await launched.close()
  }
})

test('disabling startup checks skips them but keeps manual check', async () => {
  const launched = await launchApp({ MAXLABEL_TEST_UPDATE: 'available' }, { dismissFirstRun: false })
  const window = launched.window
  try {
    await closeFirstRun(window)
    await expectUpdateDialog(window)
    await window.locator('[data-testid="update-later"]').click()

    await window.locator('[data-menu-title="选项(O)"]').click()
    await window.locator('[data-menu-item="系统选项(C)..."]').click()
    await window.locator('[data-testid="update-check-on-startup"]').check()
    await window.locator('[data-testid="options-save"]').click()

    await window.reload()
    await window.locator('[data-testid="start-page"]').waitFor({ timeout: 15_000 })
    await window.waitForTimeout(1_000)
    await expect(window.locator('[data-testid="update-dialog"]')).toHaveCount(0)

    await openManualCheck(window)
    await expectUpdateDialog(window)
    await expect(window.locator('[data-testid="update-download"]')).toBeVisible()
  } finally {
    await launched.close()
  }
})
