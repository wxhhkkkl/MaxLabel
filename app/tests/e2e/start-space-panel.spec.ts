import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appRoot, launchApp } from './fixtures/electron-app'

/** 1×1 PNG：让列表不再触发本地缩略图生成。 */
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const MSDX = JSON.stringify({
  format: 'maxlabel-msdx',
  version: 3,
  app: 'MaxLabel',
  doc: {
    version: 3,
    name: '云模板',
    widthMm: 60,
    heightMm: 40,
    objects: []
  }
})

interface StubOptions {
  lsdxContent: string
  enterprise?: boolean
  /** 「全部内容」返回的文件数（用于 >30 默认列表视图）。 */
  manyFiles?: number
  /** 「工作」文件夹的后端文件总数（可为内容分页之外的统计值）。 */
  folderContentCount?: number
  createdId?: number
  failFirstDelete?: boolean
}

/**
 * 起始页共享空间用例不连真实商城：替换主进程 IPC 处理器，
 * 覆盖个人文件夹、内容分页与内容详情。
 */
async function stubShareIpc(app: ElectronApplication, options: StubOptions): Promise<void> {
  const personalItems = options.manyFiles
    ? Array.from({ length: options.manyFiles }, (_, index) => ({
        id: 100 + index,
        scope: 1,
        folderId: null,
        contentType: 1,
        name: `批量模板${index + 1}.msdx`,
        sizeBytes: 1024,
        thumb: TINY_PNG,
        canDelete: true
      }))
    : [
        { id: 1, scope: 1, folderId: null, contentType: 1, name: '默认模板.msdx', sizeBytes: 2048, thumb: TINY_PNG, canDelete: true },
        { id: 2, scope: 1, folderId: null, contentType: 1, name: '默认模板.lsdx', sizeBytes: 1024, thumb: TINY_PNG, canDelete: true }
      ]
  const details: Record<number, { name: string; content: string }> = {
    1: { name: '默认模板.msdx', content: MSDX },
    2: { name: '默认模板.lsdx', content: options.lsdxContent },
    3: { name: '工作模板.msdx', content: MSDX },
    4: { name: '根目录模板.msdx', content: MSDX }
  }
  await app.evaluate(({ ipcMain }, payload) => {
    ipcMain.removeHandler('share:overview')
    ipcMain.handle('share:overview', async () => ({
      ok: true,
      overview: {
        personal: {
          edition: 'standard',
          quotaBytes: 10 * 1024 * 1024,
          usedBytes: 4096,
          remainingBytes: 10 * 1024 * 1024 - 4096,
          canUpload: true
        },
        enterprise: payload.enterprise
          ? {
              orgId: 5,
              orgName: '测试企业',
              edition: 'enterprise',
              seatActive: true,
              licenseActive: true,
              isAdmin: true,
              quotaBytes: 100 * 1024 * 1024,
              usedBytes: 4096,
              remainingBytes: 100 * 1024 * 1024 - 4096,
              canUpload: true,
              readOnly: false
            }
          : null
      }
    }))
    ipcMain.removeHandler('share:personal-folder-list')
    ipcMain.handle('share:personal-folder-list', async () => ({
      ok: true,
      items: [
        {
          id: 10,
          name: '工作',
          parentId: null,
          memberCount: 0,
          ...(payload.folderContentCount != null ? { contentCount: payload.folderContentCount } : {})
        },
        { id: 11, name: '归档', parentId: 10, memberCount: 0 }
      ]
    }))
    ipcMain.removeHandler('share:folder-list')
    ipcMain.handle('share:folder-list', async () => ({
      ok: true,
      items: [{ id: 20, name: '企业文件夹', memberCount: 0, canManage: true }]
    }))
    ipcMain.removeHandler('share:content-page')
    ipcMain.handle('share:content-page', async (_event, _context, input: { scope: number; folderId?: number; pageNo?: number; pageSize?: number; keyword?: string }) => {
      if (input.scope === 1 && input.folderId === 10) {
        return { ok: true, items: [payload.folderItems[0]], total: 1 }
      }
      if (input.scope === 1 && input.folderId === 0) {
        return { ok: true, items: [payload.folderItems[1]], total: 1 }
      }
      if (input.scope === 2) {
        return { ok: true, items: [payload.enterpriseItem], total: 1 }
      }
      const matched = payload.personalItems.filter((item) => !input.keyword || item.name.includes(input.keyword))
      const pageSize = input.pageSize ?? matched.length
      const offset = ((input.pageNo ?? 1) - 1) * pageSize
      return { ok: true, items: matched.slice(offset, offset + pageSize), total: matched.length }
    })
    ipcMain.removeHandler('share:content-get')
    ipcMain.handle('share:content-get', async (_event, _context, id: number) => {
      const detail = payload.details[id]
      if (!detail) return { ok: false, error: 'not found' }
      return {
        ok: true,
        item: {
          id,
          scope: 1,
          contentType: 1,
          name: detail.name,
          sizeBytes: detail.content.length,
          storageType: 1,
          content: detail.content
        }
      }
    })

    // 记录保存时的云端写入，用例据此断言覆盖/删除/新建的调用。
    const calls: Array<{ channel: string; input?: Record<string, unknown>; id?: number }> = []
    ;(globalThis as unknown as Record<string, unknown>).__maxlabelShareCalls = calls
    ipcMain.removeHandler('share:content-update')
    ipcMain.handle('share:content-update', async (_event, _context, input: Record<string, unknown>) => {
      calls.push({ channel: 'update', input })
      return { ok: true }
    })
    ipcMain.removeHandler('share:content-create')
    ipcMain.handle('share:content-create', async (_event, _context, input: Record<string, unknown>) => {
      calls.push({ channel: 'create', input })
      return { ok: true, id: payload.createdId }
    })
    ipcMain.removeHandler('share:content-delete')
    let failDelete = payload.failFirstDelete
    ipcMain.handle('share:content-delete', async (_event, _context, id: number) => {
      calls.push({ channel: 'delete', id })
      if (failDelete) {
        failDelete = false
        return { ok: false, error: 'temporary failure' }
      }
      return { ok: true }
    })
  }, {
    personalItems,
    details,
    createdId: options.createdId ?? 99,
    failFirstDelete: options.failFirstDelete === true,
    folderContentCount: options.folderContentCount,
    enterprise: options.enterprise === true,
    folderItems: [
      { id: 3, scope: 1, folderId: 10, contentType: 1, name: '工作模板.msdx', sizeBytes: 2048, thumb: TINY_PNG, canDelete: true },
      { id: 4, scope: 1, folderId: 0, contentType: 1, name: '根目录模板.msdx', sizeBytes: 2048, thumb: TINY_PNG, canDelete: true }
    ],
    enterpriseItem: { id: 5, scope: 2, folderId: 20, contentType: 1, name: '企业模板.msdx', sizeBytes: 2048, thumb: TINY_PNG, canDelete: true }
  })
}

const member = JSON.stringify({
  userId: 7,
  mobileMasked: '138****0000',
  edition: 'standard',
  subscriptionActive: true,
  subscriptionEndTime: '2099-01-01T00:00:00.000Z'
})

async function shareCalls(app: ElectronApplication): Promise<Array<{ channel: string; input?: Record<string, unknown>; id?: number }>> {
  return app.evaluate(() =>
    ((globalThis as unknown as Record<string, unknown>).__maxlabelShareCalls ?? []) as never)
}

async function openPersonalItem(w: Page, name: string): Promise<void> {
  await w.locator('[data-testid="start-nav-personal"]').click()
  await w.locator('[data-testid="start-space-item"]', { hasText: name }).click()
  await expect(w.locator('[data-testid="start-page"]')).toBeHidden({ timeout: 15_000 })
  await expect(w.locator('[data-testid="toolbar"]')).toBeVisible()
  // .lsdx 导入可能弹出兼容性提示，先关闭，避免遮住保存确认框。
  const dismiss = w.getByRole('button', { name: '知道了' })
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click()
}

test('personal space shows a folder tree and scopes content by folder', async () => {
  const lsdxContent = await readFile(join(appRoot, 'fixtures', 'lsdx', 'minimal.lsdx'), 'utf8')
  const launched = await launchApp({ MAXLABEL_TEST_MALL_MEMBER: member })
  const w = launched.window
  try {
    await stubShareIpc(launched.app, { lsdxContent })
    await w.locator('[data-testid="start-nav-personal"]').click()

    const tree = w.locator('[data-testid="start-space-personal-folders"]')
    await expect(tree).toBeVisible()
    const working = tree.locator('[data-testid="start-space-personal-folder"]', { hasText: '工作' })
    const archive = tree.locator('[data-testid="start-space-personal-folder"]', { hasText: '归档' })
    await expect(working).toBeVisible()
    await expect(archive).toBeVisible()
    // 子文件夹按层级缩进，形成树而不是平铺。
    await expect(archive).toHaveAttribute('data-depth', '1')

    // 默认「全部内容」：不分文件夹。
    await expect(w.locator('[data-testid="start-space-item"]', { hasText: '默认模板.msdx' })).toBeVisible()

    // 选中文件夹后只显示该文件夹的内容。
    await working.click()
    await expect(w.locator('[data-testid="start-space-item"]', { hasText: '工作模板.msdx' })).toBeVisible()
    await expect(w.locator('[data-testid="start-space-item"]', { hasText: '默认模板.msdx' })).toHaveCount(0)

    await w.locator('[data-testid="start-space-personal-root"]').click()
    await expect(w.locator('[data-testid="start-space-item"]', { hasText: '根目录模板.msdx' })).toBeVisible()
  } finally {
    await launched.close()
  }
})

test('a late personal folder response cannot replace the current list', async () => {
  const launched = await launchApp({ MAXLABEL_TEST_MALL_MEMBER: member })
  const w = launched.window
  try {
    await stubShareIpc(launched.app, { lsdxContent: '' })
    await launched.app.evaluate(({ ipcMain }, thumb) => {
      const state = globalThis as typeof globalThis & { releaseFolder?: () => void }
      ipcMain.removeHandler('share:content-page')
      ipcMain.handle('share:content-page', async (_event, _context, input: { folderId?: number }) => {
        const id = input.folderId ?? 1
        if (id === 10) await new Promise<void>((resolve) => { state.releaseFolder = resolve })
        return { ok: true, items: [{ id: id + 1, scope: 1, folderId: id, contentType: 1, name: `folder-${id}.msdx`, thumb }] }
      })
    }, TINY_PNG)
    await w.getByTestId('start-nav-personal').click()
    await expect(w.getByTestId('start-space-item')).toContainText('folder-1.msdx')
    await w.getByTestId('start-space-personal-folder').first().click()
    await expect.poll(() => launched.app.evaluate(() => 'releaseFolder' in globalThis)).toBe(true)
    await w.getByTestId('start-space-personal-root').click()
    await expect(w.getByTestId('start-space-item')).toContainText('folder-0.msdx')
    await launched.app.evaluate(async () => {
      const state = globalThis as typeof globalThis & { releaseFolder: () => void }
      state.releaseFolder()
      await new Promise<void>((resolve) => setImmediate(resolve))
    })
    await w.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(w.getByTestId('start-space-item')).toContainText('folder-0.msdx')
  } finally {
    await launched.close()
  }
})

test('personal space opens a .lsdx file in the editor', async () => {
  const lsdxContent = await readFile(join(appRoot, 'fixtures', 'lsdx', 'minimal.lsdx'), 'utf8')
  const launched = await launchApp({ MAXLABEL_TEST_MALL_MEMBER: member })
  const w = launched.window
  try {
    await stubShareIpc(launched.app, { lsdxContent })
    await w.locator('[data-testid="start-nav-personal"]').click()

    const lsdxCard = w.locator('[data-testid="start-space-item"]', { hasText: '默认模板.lsdx' })
    await expect(lsdxCard).toBeVisible()
    await lsdxCard.click()

    // 打不开时会停留在起始页并显示错误；导入成功则进入编辑器。
    await expect(w.locator('[data-testid="start-page"]')).toBeHidden({ timeout: 15_000 })
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 15_000 })
  } finally {
    await launched.close()
  }
})

test('personal and enterprise lists switch between icon and list views', async () => {
  const lsdxContent = await readFile(join(appRoot, 'fixtures', 'lsdx', 'minimal.lsdx'), 'utf8')
  const launched = await launchApp({ MAXLABEL_TEST_MALL_MEMBER: member })
  const w = launched.window
  try {
    await stubShareIpc(launched.app, { lsdxContent, enterprise: true })

    await w.locator('[data-testid="start-nav-personal"]').click()
    await expect(w.locator('[data-testid="start-space-item"]').first()).toBeVisible()
    await expect(w.locator('[data-testid="start-space-view-icon"]')).toHaveAttribute('data-active', 'true')
    await expect(w.locator('[data-testid="start-space-list"]')).toBeVisible()

    await w.locator('[data-testid="start-space-view-list"]').click()
    await expect(w.locator('[data-testid="start-space-rows"]')).toBeVisible()
    await expect(w.locator('[data-testid="start-space-row"]').first()).toBeVisible()
    await expect(w.locator('[data-testid="start-space-list"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="start-space-view-list"]')).toHaveAttribute('data-active', 'true')

    await w.locator('[data-testid="start-space-view-icon"]').click()
    await expect(w.locator('[data-testid="start-space-list"]')).toBeVisible()

    // 企业空间同样提供视图切换。
    await w.locator('[data-testid="start-nav-enterprise"]').click()
    await expect(w.locator('[data-testid="start-space-view-icon"]')).toBeVisible()
    await w.locator('[data-testid="start-space-view-list"]').click()
    await expect(w.locator('[data-testid="start-space-row"]').first()).toBeVisible()
  } finally {
    await launched.close()
  }
})

test('saving a cloud-opened template asks before overwriting the cloud copy', async () => {
  const lsdxContent = await readFile(join(appRoot, 'fixtures', 'lsdx', 'minimal.lsdx'), 'utf8')
  const launched = await launchApp({ MAXLABEL_TEST_MALL_MEMBER: member })
  const w = launched.window
  try {
    await stubShareIpc(launched.app, { lsdxContent })
    await openPersonalItem(w, '默认模板.msdx')

    await w.keyboard.press('Control+s')
    const dialog = w.locator('[data-testid="cloud-save-dialog"]')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('默认模板.msdx')

    await w.locator('[data-testid="cloud-save-overwrite"]').click()
    await expect(dialog).toHaveCount(0)
    await expect(w.locator('[data-testid="status-message"]')).toContainText('已覆盖云端模板')

    let calls = await shareCalls(launched.app)
    expect(calls).toHaveLength(1)
    expect(calls[0].channel).toBe('update')
    expect(calls[0].input?.id).toBe(1)
    expect(calls[0].input?.scope).toBe(1)
    expect(calls[0].input?.name).toBe('默认模板.msdx')
    expect(String(calls[0].input?.content)).toContain('maxlabel-msdx')

    // 每次保存都再次询问；取消不产生云端写入。
    await w.keyboard.press('Control+s')
    await expect(dialog).toBeVisible()
    await w.locator('[data-testid="cloud-save-cancel"]').click()
    await expect(dialog).toHaveCount(0)
    calls = await shareCalls(launched.app)
    expect(calls).toHaveLength(1)
  } finally {
    await launched.close()
  }
})

test('declining the cloud overwrite saves the template locally', async () => {
  const lsdxContent = await readFile(join(appRoot, 'fixtures', 'lsdx', 'minimal.lsdx'), 'utf8')
  const dir = await mkdtemp(join(tmpdir(), 'maxlabel-cloud-save-'))
  const localPath = join(dir, 'local.msdx')
  const launched = await launchApp({ MAXLABEL_TEST_MALL_MEMBER: member })
  const w = launched.window
  try {
    await stubShareIpc(launched.app, { lsdxContent })
    await launched.app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as never
    }, localPath)
    await openPersonalItem(w, '默认模板.msdx')

    await w.keyboard.press('Control+s')
    await expect(w.locator('[data-testid="cloud-save-dialog"]')).toBeVisible()
    await w.locator('[data-testid="cloud-save-local"]').click()

    await expect.poll(async () => {
      try { return (await readFile(localPath, 'utf8')).length } catch { return 0 }
    }, { timeout: 10_000 }).toBeGreaterThan(0)
    expect(await readFile(localPath, 'utf8')).toContain('maxlabel-msdx')
    expect(await shareCalls(launched.app)).toHaveLength(0)

    // 已保存到本地后，再次保存不再询问云端。
    await w.keyboard.press('Control+s')
    await expect(w.locator('[data-testid="cloud-save-dialog"]')).toHaveCount(0)
    await w.waitForTimeout(300)
    expect(await shareCalls(launched.app)).toHaveLength(0)
  } finally {
    await launched.close()
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
})

test('overwriting a cloud .lsdx replaces it with an .msdx item', async () => {
  const lsdxContent = await readFile(join(appRoot, 'fixtures', 'lsdx', 'minimal.lsdx'), 'utf8')
  const launched = await launchApp({ MAXLABEL_TEST_MALL_MEMBER: member })
  const w = launched.window
  try {
    await stubShareIpc(launched.app, { lsdxContent })
    await openPersonalItem(w, '默认模板.lsdx')

    await w.keyboard.press('Control+s')
    await expect(w.locator('[data-testid="cloud-save-dialog"]')).toBeVisible()
    await w.locator('[data-testid="cloud-save-overwrite"]').click()
    await expect(w.locator('[data-testid="status-message"]')).toContainText('已覆盖云端模板')

    let calls = await shareCalls(launched.app)
    expect(calls.map((call) => call.channel)).toEqual(['create', 'delete'])
    expect(calls[0].input?.name).toBe('默认模板.msdx')
    expect(String(calls[0].input?.content)).toContain('maxlabel-msdx')
    expect(calls[1].id).toBe(2)

    // 新 msdx 模板成为后续保存的目标。
    await w.keyboard.press('Control+s')
    await expect(w.locator('[data-testid="cloud-save-dialog"]')).toBeVisible()
    await w.locator('[data-testid="cloud-save-overwrite"]').click()
    calls = await shareCalls(launched.app)
    expect(calls.map((call) => call.channel)).toEqual(['create', 'delete', 'update'])
    expect(calls[2].input?.id).toBe(99)
    expect(calls[2].input?.name).toBe('默认模板.msdx')
  } finally {
    await launched.close()
  }
})

test('overwriting a cloud .lsdx keeps the original when the new ID is invalid', async () => {
  const lsdxContent = await readFile(join(appRoot, 'fixtures', 'lsdx', 'minimal.lsdx'), 'utf8')
  const launched = await launchApp({ MAXLABEL_TEST_MALL_MEMBER: member })
  const w = launched.window
  try {
    await stubShareIpc(launched.app, { lsdxContent, createdId: 0 })
    await openPersonalItem(w, '默认模板.lsdx')
    await w.keyboard.press('Control+s')
    await w.getByTestId('cloud-save-overwrite').click()
    await expect(w.getByTestId('status-message')).toContainText('原文件已保留')
    expect((await shareCalls(launched.app)).map((call) => call.channel)).toEqual(['create'])
  } finally {
    await launched.close()
  }
})

test('retrying cloud save reuses the replacement and finishes removing the original', async () => {
  const lsdxContent = await readFile(join(appRoot, 'fixtures', 'lsdx', 'minimal.lsdx'), 'utf8')
  const launched = await launchApp({ MAXLABEL_TEST_MALL_MEMBER: member })
  const w = launched.window
  try {
    await stubShareIpc(launched.app, { lsdxContent, failFirstDelete: true })
    await openPersonalItem(w, '默认模板.lsdx')

    const overwrite = async () => {
      await w.keyboard.press('Control+s')
      await w.getByTestId('cloud-save-overwrite').click()
    }
    const status = w.getByTestId('status-message')
    await overwrite()
    await expect(status).toContainText('旧文件清理失败')
    await overwrite()
    await expect(status).toContainText('已覆盖云端模板')

    expect((await shareCalls(launched.app)).map((call) => [call.channel, call.id ?? call.input?.id])).toEqual([
      ['create', undefined], ['delete', 2], ['update', 99], ['delete', 2]
    ])

    await overwrite()
    await expect.poll(async () => (await shareCalls(launched.app)).length).toBe(5)
    expect((await shareCalls(launched.app)).at(-1)).toMatchObject({ channel: 'update', input: { id: 99 } })
  } finally {
    await launched.close()
  }
})

test('folders with more than 30 files default to the list view', async () => {
  const lsdxContent = await readFile(join(appRoot, 'fixtures', 'lsdx', 'minimal.lsdx'), 'utf8')
  const launched = await launchApp({ MAXLABEL_TEST_MALL_MEMBER: member })
  const w = launched.window
  try {
    await stubShareIpc(launched.app, { lsdxContent, manyFiles: 31, folderContentCount: 40 })
    await w.locator('[data-testid="start-nav-personal"]').click()

    // 当前列表 31 个文件 → 默认列表视图。
    await expect(w.locator('[data-testid="start-space-row"]')).toHaveCount(31)
    await expect(w.locator('[data-testid="start-space-view-list"]')).toHaveAttribute('data-active', 'true')

    // 用户仍可手动切回图标视图。
    await w.locator('[data-testid="start-space-view-icon"]').click()
    await expect(w.locator('[data-testid="start-space-list"]')).toBeVisible()

    // 文件夹统计 40 个文件（即使当前分类只返回 1 个）→ 进入该文件夹恢复默认列表。
    await w.locator('[data-testid="start-space-personal-folder"]', { hasText: '工作' }).click()
    await expect(w.locator('[data-testid="start-space-row"]')).toHaveCount(1)
    await expect(w.locator('[data-testid="start-space-view-list"]')).toHaveAttribute('data-active', 'true')

    // 切到根目录（1 个文件）→ 恢复默认图标视图。
    await w.locator('[data-testid="start-space-personal-root"]').click()
    await expect(w.locator('[data-testid="start-space-list"]')).toBeVisible()
    await expect(w.locator('[data-testid="start-space-view-icon"]')).toHaveAttribute('data-active', 'true')
  } finally {
    await launched.close()
  }
})

test('personal space reaches files beyond the first page and searches across pages', async () => {
  const lsdxContent = await readFile(join(appRoot, 'fixtures', 'lsdx', 'minimal.lsdx'), 'utf8')
  const launched = await launchApp({ MAXLABEL_TEST_MALL_MEMBER: member })
  const w = launched.window
  try {
    await stubShareIpc(launched.app, { lsdxContent, manyFiles: 201 })
    await w.getByTestId('start-nav-personal').click()
    await expect(w.getByTestId('start-space-row')).toHaveCount(200)
    await expect(w.getByText('批量模板201.msdx', { exact: true })).toHaveCount(0)
    await w.getByTestId('space-page-next').click()
    await expect(w.getByText('批量模板201.msdx', { exact: true })).toBeVisible()
    await expect(w.getByTestId('space-page-next')).toBeDisabled()
    await w.getByTestId('space-page-prev').click()
    await expect(w.getByTestId('start-space-row')).toHaveCount(200)
    await w.getByRole('searchbox').fill('批量模板201')
    await expect(w.getByText('批量模板201.msdx', { exact: true })).toBeVisible()
    await expect(w.getByTestId('space-page-prev')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('enterprise uploads and platform templates can continue to a later page', async () => {
  const lsdxContent = await readFile(join(appRoot, 'fixtures', 'lsdx', 'minimal.lsdx'), 'utf8')
  const launched = await launchApp({ MAXLABEL_TEST_MALL_MEMBER: member })
  const w = launched.window
  try {
    await stubShareIpc(launched.app, { lsdxContent, enterprise: true })
    await launched.app.evaluate(({ ipcMain }, thumb) => {
      ipcMain.removeHandler('share:content-mine')
      ipcMain.handle('share:content-mine', async (_event, _context, page: number, size: number) => {
        const items = page === 1
          ? Array.from({ length: size }, (_, id) => ({ id: 1 + id, contentType: 5, name: `图片${id}.png` }))
          : [{ id: 210, contentType: 1, name: '后页企业模板.msdx' }]
        return { ok: true, items: items.map((item) => ({ ...item, scope: 2, folderId: 20, sizeBytes: 1024, thumb })), total: size + 1 }
      })
      ipcMain.removeHandler('share:platform-page')
      ipcMain.handle('share:platform-page', async (_event, _context, input: { pageNo: number; pageSize: number; category?: string }) => {
        const finalItem = { id: 900, category: '后页分类', name: '后页平台模板.msdx' }
        const items = input.pageNo > 1 || input.category
          ? [finalItem]
          : Array.from({ length: input.pageSize }, (_, id) => ({ id: 1 + id, category: '首页分类', name: `平台模板${id}.msdx` }))
        return { ok: true, items: items.map((item) => ({ ...item, contentType: 1, sizeBytes: 1024, thumb })), total: input.category ? 1 : input.pageSize + 1 }
      })
    }, TINY_PNG)

    await w.getByTestId('start-nav-enterprise').click()
    await w.getByTestId('start-space-folder-mine').click()
    await expect(w.getByText('后页企业模板.msdx', { exact: true })).toHaveCount(0)
    await w.getByTestId('space-page-next').click()
    await expect(w.getByText('后页企业模板.msdx', { exact: true })).toBeVisible()

    await w.getByTestId('start-nav-platform').click()
    await w.getByTestId('space-page-next').click()
    await expect(w.getByText('后页平台模板.msdx', { exact: true })).toBeVisible()
    await w.getByRole('button', { name: '后页分类', exact: true }).click()
    await expect(w.getByText('后页平台模板.msdx', { exact: true })).toBeVisible()
    await expect(w.getByTestId('space-page-prev')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})
