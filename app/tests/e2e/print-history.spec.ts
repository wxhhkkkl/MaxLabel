import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

async function openHistory(page: Page): Promise<void> {
  await page.getByText('查看(V)', { exact: true }).first().click()
  await page.getByText('打印历史记录', { exact: true }).first().click()
  await page.getByRole('button', { name: '关闭', exact: true }).last().waitFor({ timeout: 10_000 })
}

async function writeLog(page: Page, overrides: Record<string, unknown> = {}): Promise<void> {
  await page.evaluate(async (payload) => {
    await (window as unknown as { maxlabel: { logPrint: (value: unknown) => Promise<unknown> } }).maxlabel.logPrint(payload)
  }, {
    time: '2026-10-20T10:00:00.000Z',
    title: 'E2E 模板',
    mode: 'driver',
    count: 3,
    copies: 2,
    physicalCount: 6,
    sentCount: 6,
    status: 'submitted',
    test: false,
    printer: 'E2E Printer',
    dataSnapshot: ['A | B'],
    ...overrides
  })
}

test('shows the empty state, a row with details, and deletes it', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await openHistory(w)
    await expect(w.getByText('暂无打印记录')).toBeVisible()
    await w.getByRole('button', { name: '关闭', exact: true }).last().click()

    await writeLog(w)
    await openHistory(w)
    await expect(w.getByText('E2E 模板')).toBeVisible()
    await expect(w.getByText('E2E Printer')).toBeVisible()
    await expect(w.getByText('已提交')).toBeVisible()

    await w.getByText('E2E 模板').click()
    await expect(w.getByText('A | B')).toBeVisible()
    await expect(w.getByText('#1')).toBeVisible()

    w.on('dialog', (dialog) => { void dialog.accept() })
    await w.locator('button[title="删除该条记录"]').click()
    await expect(w.getByText('暂无打印记录')).toBeVisible()
  } finally {
    await launched.close()
  }
})

test('clears all rows after confirmation', async () => {
  const launched = await launchApp()
  const w = launched.window
  try {
    await writeLog(w, { time: 't1', title: '一' })
    await writeLog(w, { time: 't2', title: '二' })
    await openHistory(w)
    await expect(w.getByRole('cell', { name: '一', exact: true })).toBeVisible()
    await expect(w.getByRole('cell', { name: '二', exact: true })).toBeVisible()

    w.on('dialog', (dialog) => { void dialog.accept() })
    await w.getByRole('button', { name: '清空' }).click()
    await expect(w.getByText('暂无打印记录')).toBeVisible()
  } finally {
    await launched.close()
  }
})
