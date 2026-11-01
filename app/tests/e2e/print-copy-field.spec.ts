import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function datasetTemplate(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'maxlabel-copy-field-'))
  const path = join(dir, 'copy-field.msdx')
  const envelope = {
    format: 'maxlabel-msdx',
    version: 2,
    app: 'MaxLabel',
    doc: {
      version: 2,
      name: '拷贝数量字段',
      widthMm: 60,
      heightMm: 40,
      objects: [
        { id: 'text-1', type: 'text', x: 4, y: 4, w: 40, h: 6, rotation: 0, fontFamily: 'Arial', fontSize: 5, bold: false, align: 'left', color: '#000000', source: { kind: 'constant', value: 'E2E' } }
      ],
      datasets: {
        data: { name: 'data', columns: ['qty', 'price'], rows: [['1', '2']] }
      }
    }
  }
  await writeFile(path, JSON.stringify(envelope, null, 2), 'utf8')
  return path
}

/** 「拷贝数量从数据库字段引入」必须是数据集字段下拉，而不是自由输入。 */
test('copy-count field is selected from dataset columns', async () => {
  const path = await datasetTemplate()
  const launched = await launchApp({ MAXLABEL_OPEN_PATH: path })
  const w = launched.window
  try {
    await w.locator('[data-testid="start-page"]').waitFor({ timeout: 15_000 })
    await w.locator('[data-testid="toolbar"] [title="打开标签模版"]').click()
    await w.locator('[data-testid="print-dock"]').waitFor({ timeout: 15_000 })
    await w.locator('[data-testid="toolbar"] [title="打印"]').click()
    await w.locator('[data-testid="print-dialog-advanced"]').click()
    await w.locator('[data-testid="print-advanced-tab-database"]').click()
    await w.locator('[data-testid="print-option-copy-field"]').check()

    const field = w.locator('[data-testid="print-option-copy-field-name"]')
    await expect(field).toBeEnabled()
    await field.selectOption('qty')
    await w.locator('[data-testid="print-advanced-submit"]').click()

    // 重新打开高级选项，选择值应保留。
    await w.locator('[data-testid="print-dialog-advanced"]').click()
    await w.locator('[data-testid="print-advanced-tab-database"]').click()
    await expect(w.locator('[data-testid="print-option-copy-field-name"]')).toHaveValue('qty')
    await w.locator('[data-testid="print-advanced-dialog"]').getByRole('button', { name: '取消' }).click()

    // 关闭整个打印对话框再重新打开，高级选项设置仍应保留。
    await w.locator('[data-testid="print-dialog"] button[aria-label="关闭打印对话框"]').click()
    await expect(w.locator('[data-testid="print-dialog"]')).toHaveCount(0)
    await w.locator('[data-testid="toolbar"] [title="打印"]').click()
    await w.locator('[data-testid="print-dialog-advanced"]').click()
    await w.locator('[data-testid="print-advanced-tab-database"]').click()
    await expect(w.locator('[data-testid="print-option-copy-field"]')).toBeChecked()
    await expect(w.locator('[data-testid="print-option-copy-field-name"]')).toHaveValue('qty')
    await w.locator('[data-testid="print-advanced-dialog"]').getByRole('button', { name: '取消' }).click()

    // 模拟重启（页面重载）后仍保留：高级打印选项已写入 localStorage。
    await w.reload()
    await w.locator('[data-testid="start-page"]').waitFor({ timeout: 15_000 })
    await w.locator('[data-testid="toolbar"] [title="打开标签模版"]').click()
    await w.locator('[data-testid="print-dock"]').waitFor({ timeout: 15_000 })
    await w.locator('[data-testid="toolbar"] [title="打印"]').click()
    await w.locator('[data-testid="print-dialog-advanced"]').click()
    await w.locator('[data-testid="print-advanced-tab-database"]').click()
    await expect(w.locator('[data-testid="print-option-copy-field"]')).toBeChecked()
    await expect(w.locator('[data-testid="print-option-copy-field-name"]')).toHaveValue('qty')
  } finally {
    await launched.close()
  }
})
