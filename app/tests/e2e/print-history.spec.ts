import { once } from 'node:events'
import { createServer, type AddressInfo } from 'node:net'
import { test, expect, type Page } from '@playwright/test'
import { launchApp } from './fixtures/electron-app'

test('shows a receipt after reloading the editor while the main process stays alive', async () => {
  const server = createServer((socket) => { socket.resume() })
  const launched = await launchApp()
  try {
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const port = (server.address() as AddressInfo).port
    const submitted = await launched.window.evaluate(async (tcpPort) => {
      return window.maxlabel.printCommand({
        text: 'fixture label', encoding: 'utf8',
        port: { type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort }
      }, 'e2e-reload-receipt', { title: '重载前提交的标签', total: 1, index: 1, first: 1, last: 1 })
    }, port)
    expect(submitted.status).toBe('accepted')
    await expect(launched.window.getByTestId('print-recovery')).not.toBeVisible()
    await launched.window.reload()
    await expect(launched.window.getByTestId('print-recovery')).toContainText('重载前提交的标签')
  } finally {
    await launched.close()
    server.close()
  }
})

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

    await writeLog(w, { dataSnapshot: ['A | B', 'x'.repeat(1024 * 1024 + 1)] })
    await openHistory(w)
    await expect(w.getByText('E2E 模板')).toBeVisible()
    await expect(w.getByText('E2E Printer')).toBeVisible()
    await expect(w.getByText('已提交')).toBeVisible()

    await w.getByText('E2E 模板').click()
    await expect(w.getByText('数据快照超过保存上限，仅保留开头的内容。')).toBeVisible()
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

test('shows unresolved jobs after restart and keeps them until the operator acknowledges them', async () => {
  const { window, close } = await launchApp()
  try {
    await window.evaluate(() => localStorage.setItem('maxlabel.print-job-journal.v1', JSON.stringify([{
      jobId: 'pending-1', title: '序列号待回写的模板', mode: 'command', logicalCount: 2, physicalCount: 2,
      sentLogicalCount: 2, sentPhysicalCount: 2, batchIndex: 1, batchCount: 1,
      status: 'submitted', serialCommitted: false, requiresSerialCommit: true, updatedAt: new Date().toISOString()
    }])))
    await window.reload()
    const recovery = window.getByTestId('print-recovery')
    await expect(recovery.getByText('序列号待回写的模板')).toBeVisible()
    await recovery.getByRole('button', { name: '已核对' }).click()
    await expect(recovery).toHaveCount(0)
    await window.reload()
    await expect(window.getByTestId('start-page')).toBeVisible()
    await expect(recovery).toHaveCount(0)
  } finally {
    await close()
  }
})
