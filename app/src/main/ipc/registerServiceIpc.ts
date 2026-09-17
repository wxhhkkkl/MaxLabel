import { app, ipcMain as electronIpcMain } from 'electron'
import { createCloudRepository, type CloudResult } from '../cloudRepository'
import { checkForUpdate } from '../updater'
import { normalizeServerUrl } from '../serverUrlPolicy'
import { openCloudWindow } from '../cloudService'
import { activateLicense, checkLicenseOnline, readLicenseState } from '../license'
import { cancelDbQuery, dbQuery, dbTestConnection } from '../db'
import type { DbConnectionConfig } from '../../shared/domain/printer'
import { deleteSharedTemplate, listSharedTemplates, loadSharedTemplate, publishSharedTemplate } from '../sharedLibrary'
import { saveConnectionSecret } from '../connectionSecrets'
import { deleteCloudCredential, readCloudCredential, saveCloudCredential } from '../cloudCredentials'
import { redactTemplateJson, validateCloudEmail, validateCloudId, validateCloudName, validateCloudPassword, validateCloudServerUrl, validateCloudTemplateMetadata, validateCloudToken, validateDbConnection, validateRequestId, validateServerUrl, validateSql } from './validation'
import { assertKnownIpcChannel, secureIpcHandler } from './senderGuard'
import type { BrowserWindow } from 'electron'
import { readAppConfig, saveAppConfig } from '../appConfig'

/** 注册云服务、单一产品授权、数据库与共享模板相关 IPC。 */
export function registerServiceIpc(getWindow: () => BrowserWindow | null): void {
  const secureHandle = (channel: string, handler: Parameters<typeof electronIpcMain.handle>[1]) => { assertKnownIpcChannel(channel); return electronIpcMain.handle(channel, secureIpcHandler(getWindow, handler as never) as never) }
  const ipcMain = { handle: secureHandle }
  const cloudCall = async <T>(call: () => Promise<CloudResult<T>>): Promise<CloudResult<T>> => {
    try { return await call() }
    catch (error) { return { ok: false, error: String((error as { message?: string }).message ?? error) } }
  }
  ipcMain.handle('app:config-load', async () => {
    try { return { ok: true, ...(await readAppConfig()) } }
    catch (error) { return { ok: false, message: String((error as { message?: string }).message ?? error) } }
  })
  ipcMain.handle('app:config-save', async (_e, patch: unknown) => {
    try {
      if (!patch || typeof patch !== 'object' || typeof (patch as { skipNewWizard?: unknown }).skipNewWizard !== 'boolean') {
        return { ok: false, message: '向导配置无效' }
      }
      return { ok: true, ...(await saveAppConfig({ skipNewWizard: (patch as { skipNewWizard: boolean }).skipNewWizard })) }
    } catch (error) { return { ok: false, message: String((error as { message?: string }).message ?? error) } }
  })
  ipcMain.handle('cloud:register', async (_e, serverUrl: string, email: string, password: string) => cloudCall(() => createCloudRepository(validateCloudServerUrl(serverUrl)).register(validateCloudEmail(email), validateCloudPassword(password))))
  ipcMain.handle('cloud:login', async (_e, serverUrl: string, email: string, password: string) => cloudCall(() => createCloudRepository(validateCloudServerUrl(serverUrl)).login(validateCloudEmail(email), validateCloudPassword(password))))
  ipcMain.handle('cloud:logout', async (_e, serverUrl: string, token: string) => cloudCall(() => createCloudRepository(validateCloudServerUrl(serverUrl)).logout(validateCloudToken(token))))
  ipcMain.handle('cloud:save', async (_e, serverUrl: string, token: string, name: string, json: string, metadata?: unknown) => cloudCall(() => createCloudRepository(validateCloudServerUrl(serverUrl)).save(validateCloudToken(token), validateCloudName(name), redactTemplateJson(json), validateCloudTemplateMetadata(metadata))))
  ipcMain.handle('cloud:list', async (_e, serverUrl: string, token: string) => cloudCall(() => createCloudRepository(validateCloudServerUrl(serverUrl)).list(validateCloudToken(token))))
  ipcMain.handle('cloud:load', async (_e, serverUrl: string, token: string, id: string) => cloudCall(() => createCloudRepository(validateCloudServerUrl(serverUrl)).load(validateCloudToken(token), validateCloudId(id))))
  ipcMain.handle('cloud:delete', async (_e, serverUrl: string, token: string, id: string) => cloudCall(() => createCloudRepository(validateCloudServerUrl(serverUrl)).delete(validateCloudToken(token), validateCloudId(id))))
  ipcMain.handle('cloud:databases', async (_e, serverUrl: string, token: string) => cloudCall(() => createCloudRepository(validateCloudServerUrl(serverUrl)).databases(validateCloudToken(token))))
  ipcMain.handle('cloud:database-tables', async (_e, serverUrl: string, token: string, databaseId: string) => cloudCall(() => createCloudRepository(validateCloudServerUrl(serverUrl)).databaseTables(validateCloudToken(token), validateCloudId(databaseId))))
  ipcMain.handle('cloud:database-rows', async (_e, serverUrl: string, token: string, databaseId: string, table: string, fields: unknown) => {
    try {
      if (!Array.isArray(fields) || fields.some((field) => typeof field !== 'string') || fields.length > 1000) throw new Error('云数据库字段无效')
      return await cloudCall(() => createCloudRepository(validateCloudServerUrl(serverUrl)).databaseRows(validateCloudToken(token), validateCloudId(databaseId), String(table ?? '').trim().slice(0, 255), fields as string[]))
    } catch (error) { return { ok: false, error: String((error as { message?: string }).message ?? error) } }
  })
  ipcMain.handle('cloud:open', async (_e, serverUrl?: string) => {
    try { return await openCloudWindow(serverUrl ? validateServerUrl(serverUrl) : undefined) }
    catch (error) { return { ok: false, error: String((error as { message?: string }).message ?? error) } }
  })
  ipcMain.handle('cloud-credentials:load', async (_e, serverUrl: string) => {
    try {
      const credential = await readCloudCredential(validateCloudServerUrl(serverUrl))
      return credential ? { ok: true, token: credential.token, email: credential.email } : { ok: true }
    } catch (error) { return { ok: false, error: String((error as { message?: string }).message ?? error) } }
  })
  ipcMain.handle('cloud-credentials:save', async (_e, serverUrl: string, token: string, email: string) => {
    try {
      await saveCloudCredential(validateCloudServerUrl(serverUrl), validateCloudToken(token), validateCloudEmail(email))
      return { ok: true }
    } catch (error) { return { ok: false, error: String((error as { message?: string }).message ?? error) } }
  })
  ipcMain.handle('cloud-credentials:clear', async (_e, serverUrl: string) => {
    try { await deleteCloudCredential(validateCloudServerUrl(serverUrl)); return { ok: true } }
    catch (error) { return { ok: false, error: String((error as { message?: string }).message ?? error) } }
  })

  ipcMain.handle('license:status', async () => {
    try { return { ok: true, state: await readLicenseState() } }
    catch (error) { return { ok: false, error: String((error as { message?: string }).message ?? error) } }
  })
  ipcMain.handle('license:activate', async (_e, key: string, serverUrl: string) => {
    try { return await activateLicense(String(key ?? '').trim().slice(0, 64), validateServerUrl(serverUrl)) }
    catch (error) { return { ok: false, error: String((error as { message?: string }).message ?? error) } }
  })
  ipcMain.handle('license:check', async (_e, serverUrl: string) => {
    try { return await checkLicenseOnline(validateServerUrl(serverUrl)) }
    catch (error) { return { ok: false, error: String((error as { message?: string }).message ?? error) } }
  })

  // 启动自动检查更新与「帮助 → 查找更新版本」共用同一实现（帮助 install_upgrade.html）。
  // 未配置服务器地址时 serverUrl 省略，由 updater 收敛成 unavailable（不抛错、不打扰）。
  ipcMain.handle('update:check', async (_e, serverUrl?: unknown) => {
    try {
      const normalized = serverUrl === undefined || serverUrl === null || serverUrl === ''
        ? undefined
        : normalizeServerUrl(serverUrl) ?? undefined
      return await checkForUpdate({ currentVersion: app.getVersion(), serverUrl: normalized })
    } catch (error) {
      return { status: 'unavailable' as const, current: app.getVersion(), message: String((error as { message?: string }).message ?? error) }
    }
  })

  // 程序标题栏（帮助 interface_interface.html 元素 1）：版本号由主进程给出，
  // 标题文案由 renderer 用 composeWindowTitle 统一拼装后回传，主进程只做落地。
  ipcMain.handle('app:version', async () => ({ ok: true, version: app.getVersion() }))
  ipcMain.handle('app:window-title', async (_e, title: unknown) => {
    const text = String(title ?? '').slice(0, 300)
    getWindow()?.setTitle(text)
    return { ok: true }
  })

  ipcMain.handle('db:test', async (_e, conn: DbConnectionConfig, requestId?: unknown) => {
    try { return await dbTestConnection(validateDbConnection(conn), requestId === undefined ? undefined : validateRequestId(requestId)) }
    catch (error) { return { ok: false, error: String((error as { message?: string }).message ?? error) } }
  })
  ipcMain.handle('db:query', async (_e, conn: DbConnectionConfig, sql: string, requestId?: unknown) => {
    try { return await dbQuery(validateDbConnection(conn), validateSql(sql), requestId === undefined ? undefined : validateRequestId(requestId)) }
    catch (error) { return { ok: false, rows: [], error: String((error as { message?: string }).message ?? error) } }
  })
  ipcMain.handle('db:cancel', async (_e, requestId: unknown) => ({ ok: true, canceled: cancelDbQuery(validateRequestId(requestId)) }))
  ipcMain.handle('db:save-secret', async (_e, id: string, password?: string) => {
    try {
      const connectionId = validateDbConnection({ id, name: 'connection', driver: 'dsn' }).id
      if (password !== undefined && typeof password !== 'string') return { ok: false, error: '数据库密码无效' }
      if (password !== undefined && password.length > 4096) return { ok: false, error: '数据库密码过长' }
      await saveConnectionSecret(connectionId, password)
      return { ok: true }
    } catch (error) {
      return { ok: false, error: String((error as { message?: string }).message ?? error) }
    }
  })

  ipcMain.handle('sharedTemplates:list', async () => {
    try { return await listSharedTemplates() }
    catch (error) { return { ok: false, templates: [], error: String((error as { message?: string }).message ?? error) } }
  })
  ipcMain.handle('sharedTemplates:publish', async (_e, name: string, json: string, author: string) => {
    try { return await publishSharedTemplate(validateCloudName(name), redactTemplateJson(json), String(author ?? '').trim().slice(0, 255)) }
    catch (error) { return { ok: false, error: String((error as { message?: string }).message ?? error) } }
  })
  ipcMain.handle('sharedTemplates:load', async (_e, id: string) => {
    try { return await loadSharedTemplate(validateCloudId(id)) }
    catch (error) { return { ok: false, error: String((error as { message?: string }).message ?? error) } }
  })
  ipcMain.handle('sharedTemplates:delete', async (_e, id: string) => {
    try { return await deleteSharedTemplate(validateCloudId(id)) }
    catch (error) { return { ok: false, error: String((error as { message?: string }).message ?? error) } }
  })
}
