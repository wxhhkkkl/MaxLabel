import { test, expect } from '@playwright/test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appRoot, launchApp, makeFixtureTemplate, openFixture } from './fixtures/electron-app'

const fixturePath = join(appRoot, 'fixtures', 'lsdx', 'minimal.lsdx')

test('read-only start page blocks editing but still opens templates', async () => {
  const launched = await launchApp({
    MAXLABEL_TEST_ENTITLEMENT: 'readonly',
    MAXLABEL_OPEN_PATH: fixturePath
  })
  const w = launched.window
  try {
    await expect(w.locator('[data-testid="start-profile"]')).toBeVisible()
    await expect(w.locator('[data-testid="start-banner"]')).toBeVisible()
    await expect(w.locator('[data-testid="start-recent"]')).toBeVisible()
    await expect(w.locator('[data-testid="start-cloud"]')).toBeVisible()
    await expect(w.locator('[data-testid="start-mobile"]')).toHaveText('未登录')
    await expect(w.locator('[data-testid="read-only-notice"]')).toBeVisible()

    // SC-007：渲染进程从加载到起始页首次渲染应小于 2 秒；云端失败不影响 banner/最近模板。
    const rendererElapsedMs = Number(await w.locator('[data-testid="start-page"]').getAttribute('data-render-ms'))
    expect(rendererElapsedMs).toBeGreaterThan(0)
    // SC-007：渲染进程从加载到起始页首次渲染应小于 2 秒。
    console.log(`[start-page] first render: ${rendererElapsedMs} ms`)
    expect(rendererElapsedMs).toBeLessThan(2000)

    // 新建被锁定；锁按钮可点击去登录，而不是执行新建
    const newButton = w.locator('[data-testid="toolbar"] button[title^="新建标签模版"]')
    await expect(newButton).not.toBeDisabled()
    await expect(newButton).toHaveAttribute('title', /只读/)

    // 打开模板仍允许；打开后对象工具仍锁定（可点击去登录）
    await openFixture(w)
    await expect(w.locator('[data-testid="read-only-notice"]')).toBeVisible()
    const textTool = w.locator('[data-testid="toolbar"] button[title^="选择工具：文字"]')
    await expect(textTool).not.toBeDisabled()
    await expect(textTool).toHaveAttribute('title', /只读/)
    await expect(w.locator('[data-testid="toolbar"] button[title="打印"]')).not.toBeDisabled()

    // 绕过 UI 直接调用保存 IPC 也必须被主进程拒绝。
    const saveResult = await w.evaluate(async (path) => {
      const api = (window as unknown as {
        maxlabel: { saveTemplateTo: (target: string, json: string) => Promise<{ ok: boolean; messageKey?: string }> }
      }).maxlabel
      return api.saveTemplateTo(path, '{}')
    }, fixturePath)
    expect(saveResult.ok).toBe(false)
    expect(saveResult.messageKey).toBe('error.entitlementReadOnly')
  } finally {
    await launched.close()
  }
})

test('a signed-in member without an active subscription keeps standard editing', async () => {
  const launched = await launchApp({
    // 空值覆盖 fixture 默认的 enterprise，让授权由会员状态推导
    MAXLABEL_TEST_ENTITLEMENT: '',
    MAXLABEL_TEST_MALL_MEMBER: JSON.stringify({
      userId: 9,
      mobileMasked: '186****6563',
      subscriptionActive: false
    })
  })
  const w = launched.window
  try {
    await expect(w.locator('[data-testid="start-mobile"]')).toHaveText('186****6563')
    // 2026-10-26 口径：已登录（未付费）就是标准版，不再进入只读。
    await expect(w.locator('[data-testid="start-edition"]')).toHaveText('标准版')
    await expect(w.locator('[data-testid="read-only-notice"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="start-expiry"]')).toContainText('未订阅')
  } finally {
    await launched.close()
  }
})

test('standard edition keeps basic editing and locks database features', async () => {
  const launched = await launchApp({ MAXLABEL_TEST_ENTITLEMENT: 'standard' })
  const w = launched.window
  try {
    await expect(w.locator('[data-testid="read-only-notice"]')).toHaveCount(0)
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="wizard-next"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="wizard-next"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })

    await w.locator('[data-menu-title="数据库(D)"]').click()
    const settings = w.locator('[data-menu-item="设置数据库(D)..."]')
    await expect(settings).toHaveAttribute('data-menu-disabled', 'true')
    await expect(settings).toContainText('🔒')
  } finally {
    await launched.close()
  }
})

test('auth loss while editing keeps the document tab and switches to read-only', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'maxlabel-authloss-'))
  const stateFile = join(dir, 'state.json')
  await writeFile(stateFile, JSON.stringify({ mode: 'enterprise' }), 'utf8')
  const launched = await launchApp({ MAXLABEL_TEST_ENTITLEMENT_FILE: stateFile })
  const w = launched.window
  try {
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="wizard-next"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="wizard-next"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-select"]').click()
    const documentTabs = w.locator('[data-testid="document-tab"]')
    await expect(documentTabs.first()).toBeVisible({ timeout: 10_000 })
    const tabsBefore = await documentTabs.count()

    // 产生未保存编辑
    await w.locator('[data-testid="toolbar"] button[title^="选择工具：文字"]').click()
    await w.locator('canvas').first().click({ position: { x: 300, y: 300 }, force: true })

    await writeFile(stateFile, JSON.stringify({ mode: 'readonly' }), 'utf8')
    await expect(w.locator('[data-testid="read-only-notice"]')).toBeVisible({ timeout: 5_000 })
    expect(await documentTabs.count()).toBe(tabsBefore)
    const saveButton = w.locator('[data-testid="toolbar"] button[title^="保存"]')
    await expect(saveButton).not.toBeDisabled()
    await expect(saveButton).toHaveAttribute('title', /只读/)
  } finally {
    await launched.close()
  }
})

test('logging in from a dynamic member file updates the profile and opens the store', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'maxlabel-member-'))
  const memberFile = join(dir, 'member.json')
  await writeFile(memberFile, JSON.stringify({ loggedOut: true }), 'utf8')
  const launched = await launchApp({ MAXLABEL_TEST_MALL_MEMBER_FILE: memberFile })
  const w = launched.window
  try {
    await expect(w.locator('[data-testid="start-mobile"]')).toHaveText('未登录')

    const windowsBefore = launched.app.windows().length
    await writeFile(memberFile, JSON.stringify({
      userId: 8,
      mobileMasked: '139****1111',
      companyName: '动态公司',
      edition: 'professional',
      subscriptionSource: 'personal',
      subscriptionActive: true,
      subscriptionEndTime: '2099-01-01T00:00:00.000Z'
    }), 'utf8')
    await w.locator('[data-testid="start-login"]').click()

    await expect(w.locator('[data-testid="start-mobile"]')).toHaveText('139****1111', { timeout: 5_000 })
    // 2026-10-27：自填公司名不再显示在手机号下方。
    await expect(w.locator('[data-testid="start-company"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="start-cloud"]')).toHaveAttribute('data-scope', 'mine')

    // 已登录用户一次点击即可打开商城购买入口。
    await w.locator('[data-testid="start-buy"]').click()
    await expect.poll(() => launched.app.windows().length, { timeout: 15_000 }).toBeGreaterThan(windowsBefore)
  } finally {
    await launched.close()
  }
})

test('refreshing the subscription updates the profile without restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'maxlabel-subscription-'))
  const memberFile = join(dir, 'member.json')
  await writeFile(memberFile, JSON.stringify({
    userId: 9,
    mobileMasked: '137****2222',
    edition: 'standard',
    subscriptionActive: true,
    subscriptionEndTime: '2027-01-01T00:00:00.000Z'
  }), 'utf8')
  // 空值覆盖 fixture 默认的 enterprise，让版本与到期时间由会员状态推导。
  const launched = await launchApp({ MAXLABEL_TEST_ENTITLEMENT: '', MAXLABEL_TEST_MALL_MEMBER_FILE: memberFile })
  const w = launched.window
  try {
    await expect(w.locator('[data-testid="start-mobile"]')).toHaveText('137****2222')
    await expect(w.locator('[data-testid="start-edition"]')).toContainText('标准版')
    await expect(w.locator('[data-testid="start-expiry"]')).toContainText('2027-01-01')

    await writeFile(memberFile, JSON.stringify({
      userId: 9,
      mobileMasked: '137****2222',
      edition: 'professional',
      subscriptionActive: true,
      subscriptionEndTime: '2030-06-30T00:00:00.000Z'
    }), 'utf8')
    await w.locator('[data-testid="start-refresh-subscription"]').click()

    await expect(w.locator('[data-testid="start-edition"]')).toContainText('专业版', { timeout: 5_000 })
    await expect(w.locator('[data-testid="start-expiry"]')).toContainText('2030-06-30')
  } finally {
    await launched.close()
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
})

test('a fake non-packaged member drives the profile and my-cloud section', async () => {
  const member = JSON.stringify({
    userId: 7,
    mobileMasked: '138****0000',
    companyName: '测试公司',
    edition: 'enterprise',
    subscriptionActive: true,
    subscriptionEndTime: '2099-01-01T00:00:00.000Z'
  })
  const launched = await launchApp({
    MAXLABEL_TEST_ENTITLEMENT: 'enterprise',
    MAXLABEL_TEST_MALL_MEMBER: member
  })
  const w = launched.window
  try {
    await expect(w.locator('[data-testid="start-mobile"]')).toHaveText('138****0000')
    await expect(w.locator('[data-testid="start-company"]')).toHaveCount(0)
    await expect(w.locator('[data-testid="start-edition"]')).toContainText('企业版')
    await expect(w.locator('[data-testid="start-cloud"]')).toHaveAttribute('data-scope', 'mine')
  } finally {
    await launched.close()
  }
})

test('enterprise renewal points members to their administrator', async () => {
  const member = JSON.stringify({
    userId: 7,
    mobileMasked: '138****0000',
    edition: 'enterprise',
    subscriptionSource: 'enterprise',
    orgName: '北京杏林康云',
    subscriptionActive: true,
    subscriptionEndTime: '2099-01-01T00:00:00.000Z'
  })
  const launched = await launchApp({ MAXLABEL_TEST_MALL_MEMBER: member })
  const w = launched.window
  try {
    await expect(w.locator('[data-testid="start-mobile"]')).toHaveText('138****0000')
    const windowsBefore = launched.app.windows().length
    await w.locator('[data-testid="start-buy"]').click()
    await expect(w.locator('[data-testid="enterprise-renew-notice"]')).toBeVisible()
    await expect(w.locator('[data-testid="enterprise-renew-notice"]')).toContainText('联系')
    await w.waitForTimeout(800)
    expect(launched.app.windows().length).toBe(windowsBefore)
    await w.locator('[data-testid="enterprise-renew-ok"]').click()
    await expect(w.locator('[data-testid="enterprise-renew-notice"]')).toHaveCount(0)
  } finally {
    await launched.close()
  }
})

test('recent file cards reopen a previously opened document', async () => {
  // 用 .msdx 样例而不是 .lsdx，避免导入提示弹窗遮住起始页。
  const fixture = await makeFixtureTemplate()
  const launched = await launchApp({ MAXLABEL_OPEN_PATH: fixture.path })
  const w = launched.window
  try {
    await openFixture(w)
    // 关闭当前文档回到起始页，再从「最近」卡片重新打开。
    await w.keyboard.press('Control+w')
    await expect(w.locator('[data-testid="start-page"]')).toBeVisible()

    const recent = w.locator('[data-testid="start-recent-item"]').first()
    await expect(recent).toBeVisible()
    await expect(recent).toHaveAttribute('data-has-path', 'true')
    await recent.click()
    await expect(w.locator('[data-testid="start-page"]')).toBeHidden({ timeout: 10_000 })
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible()
  } finally {
    await launched.close()
    await rm(fixture.dir, { recursive: true, force: true }).catch(() => undefined)
  }
})

test('a valid dongle unlocks every feature', async () => {
  const launched = await launchApp({ MAXLABEL_TEST_ENTITLEMENT: 'dongle' })
  const w = launched.window
  try {
    await expect(w.locator('[data-testid="read-only-notice"]')).toHaveCount(0)
    await w.locator('[data-testid="toolbar"] button[title="新建标签模版"]').click()
    await w.locator('[data-testid="wizard-next"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="wizard-next"]').click()
    await w.locator('[data-testid="new-label-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="new-label-select"]').click()
    await expect(w.locator('[data-testid="toolbar"]')).toBeVisible({ timeout: 10_000 })

    await w.locator('[data-menu-title="数据库(D)"]').click()
    await expect(w.locator('[data-menu-item="设置数据库(D)..."]')).toHaveAttribute('data-menu-disabled', 'false')
  } finally {
    await launched.close()
  }
})
