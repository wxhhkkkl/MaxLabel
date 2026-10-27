import { test, expect } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

/** 015：「建议与反馈」从顶层菜单收进「帮助」，联系方式简化为电话 + 微信。 */
test('feedback sits in the Help menu with phone and WeChat only', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-menu-title="帮助(H)"]').click()
    await w.locator('[data-menu-item="建议与反馈"]').click()

    const modal = w.locator('[data-testid="feedback-dialog"]')
    await expect(modal).toBeVisible({ timeout: 10_000 })
    await expect(modal).toContainText('010-88613986')
    await expect(modal).toContainText('q345845052')
    await expect(modal).not.toContainText('Yanhs@360Code.com')
    await expect(modal).not.toContainText('4000-987-360')
  } finally {
    await launched.close()
  }
})

/** 015：关于里的网址换成商城站点，激活入口下线。 */
test('about points at the mall site and has no activation entry', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await w.locator('[data-menu-title="帮助(H)"]').click()
    await w.locator('[data-menu-item="关于(A)..."]').click()
    await w.locator('[data-testid="about-dialog"]').waitFor({ timeout: 10_000 })

    await expect(w.locator('[data-testid="about-homepage"]')).toHaveAttribute('href', 'https://new.yuwangchenfa.com/')
    await expect(w.locator('[data-testid="about-activate"]')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})
