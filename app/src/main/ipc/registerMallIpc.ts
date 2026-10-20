import { ipcMain as electronIpcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import type { MallContext } from '../../shared/ipcContract'
import { loginMall, logoutMallAccount, readMallSession, withMallToken } from '../mallAuth'
import {
  cancelMallTemplateShare,
  deleteMallTemplate,
  fetchMallPlans,
  fetchMallSharedTemplate,
  fetchMallSharedTemplates,
  fetchMallTemplate,
  fetchMallTemplates,
  saveMallTemplate,
  submitMallTemplateShare,
  validateMallContext
} from '../mallRepository'
import { openMallWindow } from '../mallService'
import { validateTemplateJson } from './validation'
import { assertKnownIpcChannel, secureIpcHandler } from './senderGuard'

function asContext(value: unknown): MallContext {
  if (!value || typeof value !== 'object') throw new Error('商城配置无效')
  const context = value as Partial<MallContext>
  validateMallContext({ baseUrl: String(context.baseUrl ?? ''), tenantId: Number(context.tenantId ?? 0) })
  return { baseUrl: String(context.baseUrl), tenantId: Number(context.tenantId) }
}

function asId(value: unknown): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new Error('模板编号无效')
  return id
}

function asName(value: unknown): string {
  const name = String(value ?? '').trim()
  if (!name || name.length > 255) throw new Error('模板名称无效')
  return name
}

function asOptionalText(value: unknown, max: number): string | undefined {
  if (value === undefined || value === null) return undefined
  const text = String(value).trim()
  if (text.length > max) throw new Error('字段长度超限')
  return text
}

function asOptionalNumber(value: unknown, max: number): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > max) throw new Error('尺寸字段无效')
  return number
}

/** 注册 MaxLabelMall 会员登录、云端模板、共享模板与商城窗口 IPC。 */
export function registerMallIpc(getWindow: () => BrowserWindow | null): void {
  const secureHandle = (channel: string, handler: Parameters<typeof electronIpcMain.handle>[1]) => {
    assertKnownIpcChannel(channel)
    return electronIpcMain.handle(channel, secureIpcHandler(getWindow, handler as never) as never)
  }
  const ipcMain = { handle: secureHandle }
  const fail = (error: unknown) => ({
    ok: false,
    error: String((error as { message?: string }).message ?? error),
    messageKey: 'error.mall'
  })

  ipcMain.handle('mall:login', async (_e, context: unknown) => {
    try { return { ok: true, member: await loginMall(asContext(context)) } } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:logout', async (_e, context: unknown) => {
    try { await logoutMallAccount(asContext(context)); return { ok: true } } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:session', async (_e, context: unknown) => {
    try {
      const member = await readMallSession(asContext(context))
      return member ? { ok: true, member } : { ok: true }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:open', async (_e, context: unknown, path?: string) => {
    try {
      const ctx = asContext(context)
      const target = typeof path === 'string' && path.startsWith('/') ? path.slice(0, 512) : '/'
      openMallWindow(ctx, target)
      return { ok: true, url: `${ctx.baseUrl}${target}` }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:plans', async (_e, context: unknown) => {
    try { return { ok: true, plans: await fetchMallPlans(asContext(context)) } } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:template-list', async (_e, context: unknown, keyword?: unknown) => {
    try {
      const ctx = asContext(context)
      const items = await withMallToken(ctx, (token) =>
        fetchMallTemplates(ctx, token, asOptionalText(keyword, 255)))
      return { ok: true, items }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:template-load', async (_e, context: unknown, id: unknown) => {
    try {
      const ctx = asContext(context)
      const item = await withMallToken(ctx, (token) => fetchMallTemplate(ctx, token, asId(id)))
      return { ok: true, item }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:template-save', async (_e, context: unknown, payload: unknown) => {
    try {
      const ctx = asContext(context)
      if (!payload || typeof payload !== 'object') throw new Error('模板载荷无效')
      const input = payload as Record<string, unknown>
      const name = asName(input.name)
      const content = validateTemplateJson(input.content)
      const widthMm = asOptionalNumber(input.widthMm, 10000)
      const heightMm = asOptionalNumber(input.heightMm, 10000)
      const category = asOptionalText(input.category, 64)
      const keywords = asOptionalText(input.keywords, 255)
      const id = input.id === undefined || input.id === null || input.id === '' ? undefined : asId(input.id)
      const savedId = await withMallToken(ctx, (token) => saveMallTemplate(ctx, token, {
        id, name, content, widthMm, heightMm, category, keywords
      }))
      return { ok: true, id: savedId }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:template-delete', async (_e, context: unknown, id: unknown) => {
    try {
      const ctx = asContext(context)
      await withMallToken(ctx, (token) => deleteMallTemplate(ctx, token, asId(id)))
      return { ok: true }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:template-share', async (_e, context: unknown, id: unknown, category?: unknown, keywords?: unknown) => {
    try {
      const ctx = asContext(context)
      const result = await withMallToken(ctx, (token) => submitMallTemplateShare(
        ctx, token, asId(id), asOptionalText(category, 64), asOptionalText(keywords, 255)))
      return { ok: true, ...result }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:template-unshare', async (_e, context: unknown, id: unknown) => {
    try {
      const ctx = asContext(context)
      await withMallToken(ctx, (token) => cancelMallTemplateShare(ctx, token, asId(id)))
      return { ok: true }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:shared-list', async (_e, context: unknown, keyword?: unknown, category?: unknown) => {
    try {
      const ctx = asContext(context)
      const items = await withMallToken(ctx, (token) => fetchMallSharedTemplates(
        ctx, token, asOptionalText(keyword, 255), asOptionalText(category, 64)))
      return { ok: true, items }
    } catch (error) { return fail(error) }
  })
  ipcMain.handle('mall:shared-load', async (_e, context: unknown, id: unknown) => {
    try {
      const ctx = asContext(context)
      const item = await withMallToken(ctx, (token) => fetchMallSharedTemplate(ctx, token, asId(id)))
      return { ok: true, item }
    } catch (error) { return fail(error) }
  })
}
