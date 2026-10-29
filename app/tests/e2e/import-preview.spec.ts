import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

async function openDataPanel(page: Page): Promise<void> {
  await page.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
  await page.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
  await page.locator('[data-testid="new-label-select"]').click()
  await expect(page.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })
  await page.locator('[data-menu-title="数据库(D)"]').click()
  await page.locator('[data-menu-item="设置数据库(D)..."]').click()
  await page.locator('[data-testid="database-import-types"]').waitFor({ timeout: 10_000 })
}

/** 015：导入文本数据时可以选择分隔符与字符集，并能先看表格数据预览。 */
test('text import offers delimiter, encoding and a data preview', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'maxlabel-import-'))
  const file = join(dir, 'test.csv')
  await writeFile(file, '字段 1,字段 2\n1,甲\n2,乙\n3,丙\n', 'utf8')
  const launched = await launchApp()
  const w = launched.window
  try {
    await openDataPanel(w)
    // 直接点大按钮「导入 CSV / Excel」，应当和点「文本文件」走同一条分步确认
    await w.locator('[data-testid="database-import-select"]').click()
    await w.locator('input[type="file"][accept*=".csv"]').setInputFiles(file)
    await w.locator('[data-testid="database-import-confirmation"]').waitFor({ timeout: 10_000 })

    await expect(w.locator('[data-testid="database-import-delimiter"]')).toBeVisible()
    await expect(w.locator('[data-testid="database-import-encoding"]')).toBeVisible()

    const preview = w.locator('[data-testid="database-import-preview"]')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText('字段 1')
    await expect(preview).toContainText('甲')
  } finally {
    await launched.close()
  }
})
