import { ipcMain as electronIpcMain } from 'electron'
import { createCloudRepository, type CloudResult } from '../cloudRepository'
import { openCloudWindow } from '../cloudService'
import { activateLicense, checkLicenseOnline, readLicenseState } from '../license'
import { cancelDbQuery, dbQuery, dbTestConnection } from '../db'
import type { DbConnectionConfig } from '../../shared/domain/printer'
import { deleteSharedTemplate, listSharedTemplates, loadSharedTemplate, publishSharedTemplate } from '../sharedLibrary'
import { saveConnectionSecret } from '../connectionSecrets'
import { deleteCloudCredential, readCloudCredential, saveCloudCredential } from '../cloudCredentials'
import { redactTemplateJson, validateCloudEmail, validateCloudId, validateCloudName, validateCloudPassword, validateCloudServerUrl, validateCloudToken, validateDbConnection, validateRequestId, validateServerUrl, validateSql } from './validation'
import { assertKnownIpcChannel, secureIpcHandler } from './senderGuard'
import type { BrowserWindow } from 'electron'

/** 注册云服务、单一产品授权、数据库与共享模板相关 IPC。 */
export function registerServiceIpc(getWindow: () => BrowserWindow | null): void {
  const secureHandle = (channel: string, handler: Parameters<typeof electronIpcMain.handle>[1]) => { assertKnownIpcChannel(channel); return electronIpcMain.handle(channel, secureIpcHandler(getWindow, handler as never) as never) }
  const ipcMain = { handle: secureHandle }
  const cloudCall = async <T>(call: () => Promise<CloudResult<T>>): Promise<CloudResult<T>> => {
    try { return await call() }
    catch (error) { return { ok: false, error: String((error as { message?: string }).message ?? error) } }
  }
  ipcMain.handle('cloud:register', async (_e, serverUrl: string, email: string, password: string) => cloudCall(() => createCloudRepository(validateCloudServerUrl(serverUrl)).register(validateCloudEmail(email), validateCloudPassword(password))))
  ipcMain.handle('cloud:login', async (_e, serverUrl: string, email: string, password: string) => cloudCall(() => createCloudRepository(validateCloudServerUrl(serverUrl)).login(validateCloudEmail(email), validateCloudPassword(password))))
  ipcMain.handle('cloud:logout', async (_e, serverUrl: string, token: string) => cloudCall(() => createCloudRepository(validateCloudServerUrl(serverUrl)).logout(validateCloudToken(token))))
  ipcMain.handle('cloud:save', async (_e, serverUrl: string, token: string, name: string, json: string) => cloudCall(() => createCloudRepository(validateCloudServerUrl(serverUrl)).save(validateCloudToken(token), validateCloudName(name), redactTemplateJson(json))))
  ipcMain.handle('cloud:list', async (_e, serverUrl: string, token: string) => cloudCall(() => createCloudRepository(validateCloudServerUrl(serverUrl)).list(validateCloudToken(token))))
  ipcMain.handle('cloud:load', async (_e, serverUrl: string, token: string, id: string) => cloudCall(() => createCloudRepository(validateCloudServerUrl(serverUrl)).load(validateCloudToken(token), validateCloudId(id))))
  ipcMain.handle('cloud:delete', async (_e, serverUrl: string, token: string, id: string) => cloudCall(() => createCloudRepository(validateCloudServerUrl(serverUrl)).delete(validateCloudToken(token), validateCloudId(id))))
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
