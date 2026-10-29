import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { launchApp, writeFixtureTemplate } from './fixtures/electron-app'

test('save-as over an existing file really overwrites it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'maxlabel-saveas-'))
  const path = await writeFixtureTemplate(dir, 'existing.msdx')
  const before = await readFile(path, 'utf8')
  const launched = await launchApp({ MAXLABEL_OPEN_PATH: path })
  const w = launched.window
  try {
    // 打开现有文件（MAXLABEL_OPEN_PATH 直接返回该路径）
    await w.getByText('文件(F)', { exact: true }).first().click()
    await w.locator('[data-menu-item="打开(Q)..."]').click()
    await w.waitForTimeout(800)
    // 加一个对象，制造与现有文件不同的内容
    await w.locator('[data-tool="text"]').click()
    await w.locator('canvas').first().click({ position: { x: 260, y: 240 }, force: true })
    await w.waitForTimeout(400)

    // 把保存对话框固定成「已存在的同一个文件」
    await launched.app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as never
    }, path)

    await w.getByText('文件(F)', { exact: true }).first().click()
    await w.locator('[data-menu-item="另存为(A)..."]').click()
    await w.waitForTimeout(1500)

    const after = await readFile(path, 'utf8')
    await expect(w.locator('[data-testid="status-message"]')).toContainText('已保存')
    expect(after).not.toBe(before)
    expect(after.length).toBeGreaterThan(before.length)
  } finally {
    await launched.close()
  }
})
