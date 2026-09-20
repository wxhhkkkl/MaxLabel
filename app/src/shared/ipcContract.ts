import type { PortConfig } from './domain/printer'

/** Single source of truth for privileged IPC channel names. Keep channel
 * naming out of feature code so preload and main cannot silently drift. */
export const IPC_CHANNELS = Object.freeze({
  printLabel: 'print-label', previewOpen: 'preview:open', printCommand: 'print:command', printCommandFile: 'command:send-file', printCancel: 'print:cancel',
  exportBarcodes: 'export:barcodes', barcodeCopy: 'barcode:copy', portsList: 'ports:list', printersList: 'printers:list', helpOpen: 'help:open',
  cloudRegister: 'cloud:register', cloudLogin: 'cloud:login', cloudLogout: 'cloud:logout', cloudSave: 'cloud:save', cloudList: 'cloud:list', cloudLoad: 'cloud:load', cloudDelete: 'cloud:delete', cloudOpen: 'cloud:open', cloudDatabases: 'cloud:databases', cloudDatabaseTables: 'cloud:database-tables', cloudDatabaseRows: 'cloud:database-rows',
  cloudCredentialLoad: 'cloud-credentials:load', cloudCredentialSave: 'cloud-credentials:save', cloudCredentialClear: 'cloud-credentials:clear',
  licenseStatus: 'license:status', licenseActivate: 'license:activate', licenseCheck: 'license:check',
  updateCheck: 'update:check',
  dbTest: 'db:test', dbQuery: 'db:query', dbCancel: 'db:cancel', dbSaveSecret: 'db:save-secret',
  sharedTemplatesList: 'sharedTemplates:list', sharedTemplatesPublish: 'sharedTemplates:publish', sharedTemplatesLoad: 'sharedTemplates:load', sharedTemplatesDelete: 'sharedTemplates:delete',
  logPrint: 'log:print', logList: 'log:list', imageRead: 'image:read', pickFile: 'dialog:pickFile', pickDir: 'dialog:pickDir', confirmClose: 'dialog:confirmClose',
  closeRequested: 'app:close-requested', closeWindow: 'app:close-window', appConfigLoad: 'app:config-load', appConfigSave: 'app:config-save', logExport: 'log:export', logClear: 'log:clear', logOpen: 'log:open', logDelete: 'log:delete',
  appVersion: 'app:version', appWindowTitle: 'app:window-title',
  templateSave: 'template:save', templateOpen: 'template:open', templateOpenPath: 'template:openPath', templateSaveTo: 'template:saveTo', templateList: 'template:list', templateSaveToLib: 'template:saveToLib', templateDelete: 'template:delete'
} as const)

/** LabelShop 云模板的保存/分享元数据。保持在共享契约中，避免 renderer 自行拼接远程载荷。 */
export interface CloudTemplateMetadata {
  keywords: string
  description: string
  category: string
  scope: 'user' | 'group'
  shared: boolean
}

export interface CloudDatabaseSummary {
  id: string
  name: string
  updatedAt?: string
}

export interface CloudDatabaseTable {
  name: string
  columns: string[]
  rowCount?: number
}

export interface LicenseStateDto {
  active: boolean
  machineId: string
  holder: string | null
  key?: string | null
  expiresAt?: string | null
  lastCheckAt?: string | null
}

/** 版本检查结果（帮助 install_upgrade.html：启动自动检查 + 帮助菜单手工检查共用）。 */
export interface UpdateCheckResultDto {
  /** update=有新版本；latest=已是最新；unavailable=取不到清单（启动路径静默忽略）。 */
  status: 'update' | 'latest' | 'unavailable'
  current: string
  latest?: string
  url?: string
  notes?: string
  message?: string
}

export type CommandPayload = {
  segments?: Array<{ type: 'text'; str: string } | { type: 'bin'; data: Uint8Array }>
  text?: string
  encoding: 'utf8' | 'gbk'
  port: PortConfig
}

export type PrintTransportStatus = 'accepted' | 'failed' | 'unknown' | 'canceled'

export interface PrintTransportResult {
  ok: boolean
  canceled?: boolean
  status?: PrintTransportStatus
  bytesWritten?: number
  message?: string
}

export interface DriverPrintPage {
  dataUrl: string
  copies?: number
}

/** Renderer 与 preload 共享的唯一 IPC 门面契约。 */
export interface MaxLabelAPI {
  printLabel(payload: { pages: DriverPrintPage[]; widthMm: number; heightMm: number; printerName?: string }, jobId?: string): Promise<PrintTransportResult>
  previewOpen(payload: { dataUrl?: string; pages?: string[]; widthMm: number; heightMm: number; truncated?: boolean }): Promise<{ ok: boolean; message?: string }>
  printCommand(payload: CommandPayload, jobId?: string): Promise<PrintTransportResult>
  /** 打印机「工具」页：把磁盘上的文件（指令/固件）原样发给打印机。 */
  printCommandFile(payload: { filePath: string; port: CommandPayload['port'] }, jobId?: string): Promise<PrintTransportResult>
  cancelPrint(jobId: string): Promise<{ ok: boolean; canceled?: boolean; message?: string }>
  exportBarcodes(payload: { items: Array<{ name: string; dataUrl: string }>; dir?: string }): Promise<{ canceled?: boolean; ok?: boolean; dir?: string; count?: number; message?: string }>
  copyBarcodeImage(dataUrl: string): Promise<{ ok: boolean; message?: string }>
  listPorts(): Promise<{ comPorts: string[]; usbPrinterPorts?: string[]; ok: boolean; message?: string }>
  listPrinters(): Promise<{ ok: boolean; printers?: Array<{ name: string; displayName: string; status: number }>; message?: string }>
  openHelp(): Promise<{ ok: boolean; message?: string }>
  cloud: {
    register(serverUrl: string, email: string, password: string): Promise<{ ok: boolean; error?: string; data?: { token: string; email: string } }>
    login(serverUrl: string, email: string, password: string): Promise<{ ok: boolean; error?: string; data?: { token: string; email: string } }>
    logout(serverUrl: string, token: string): Promise<{ ok: boolean; error?: string; data?: { ok: boolean } }>
    save(serverUrl: string, token: string, name: string, json: string, metadata?: CloudTemplateMetadata): Promise<{ ok: boolean; error?: string; data?: { id: string; name: string; metadata?: CloudTemplateMetadata } }>
    list(serverUrl: string, token: string): Promise<{ ok: boolean; error?: string; data?: Array<{ id: string; name: string; updatedAt: string; metadata?: CloudTemplateMetadata }> }>
    load(serverUrl: string, token: string, id: string): Promise<{ ok: boolean; error?: string; data?: { name: string; json: string; metadata?: CloudTemplateMetadata } }>
    delete(serverUrl: string, token: string, id: string): Promise<{ ok: boolean; error?: string; data?: { ok: boolean } }>
    databases(serverUrl: string, token: string): Promise<{ ok: boolean; error?: string; data?: CloudDatabaseSummary[] }>
    databaseTables(serverUrl: string, token: string, databaseId: string): Promise<{ ok: boolean; error?: string; data?: CloudDatabaseTable[] }>
    databaseRows(serverUrl: string, token: string, databaseId: string, table: string, fields: string[]): Promise<{ ok: boolean; error?: string; data?: Array<Record<string, string | number | boolean | null>> }>
  }
  cloudService: { open(serverUrl?: string): Promise<{ ok: boolean; url?: string; error?: string }> }
  cloudCredentials: {
    load(serverUrl: string): Promise<{ ok: boolean; token?: string; email?: string; error?: string }>
    save(serverUrl: string, token: string, email: string): Promise<{ ok: boolean; error?: string }>
    clear(serverUrl: string): Promise<{ ok: boolean; error?: string }>
  }
  license: {
    status(): Promise<{ ok: boolean; state: LicenseStateDto }>
    activate(key: string, serverUrl: string): Promise<{ ok: boolean; error?: string; state?: LicenseStateDto }>
    check(serverUrl: string): Promise<{ ok: boolean; error?: string }>
  }
  /** 启动自动检查更新 / 帮助菜单「查找更新版本」共用（帮助 install_upgrade.html）。 */
  checkForUpdate(serverUrl?: string): Promise<UpdateCheckResultDto>
  db: {
    test(conn: Record<string, unknown>, requestId?: string): Promise<{ ok: boolean; error?: string; message?: string }>
    query(conn: Record<string, unknown>, sql: string, requestId?: string): Promise<{ ok: boolean; rows: Array<Record<string, string | null>>; error?: string }>
    cancel(requestId: string): Promise<{ ok: boolean; canceled?: boolean }>
    saveSecret(id: string, password?: string): Promise<{ ok: boolean; error?: string }>
  }
  sharedTemplates: {
    list(): Promise<{ ok: boolean; templates: Array<{ id: string; name: string; json: string; updatedAt: string; author: string }>; error?: string }>
    publish(name: string, json: string, author: string): Promise<{ ok: boolean; error?: string; id?: string }>
    load(id: string): Promise<{ ok: boolean; error?: string; data?: { name: string; json: string } }>
    delete(id: string): Promise<{ ok: boolean; error?: string }>
  }
  logPrint(payload: { time: string; title: string; mode: string; count: number; copies: number; physicalCount?: number; status?: 'completed' | 'submitted' | 'partial' | 'failed' | 'canceled' | 'unknown'; sentCount?: number; test: boolean; printer: string; dataSnapshot?: string[] }): Promise<{ ok: boolean; path?: string }>
  listPrintLogs(): Promise<{ ok: boolean; logs?: Array<Record<string, unknown>>; message?: string }>
  readImage(filePath: string): Promise<{ ok: boolean; dataUrl?: string; path?: string; message?: string }>
  pickFile(opts?: { filters?: Array<{ name: string; extensions: string[] }> }): Promise<{ ok: boolean; path?: string; message?: string }>
  pickDir(): Promise<{ ok: boolean; path?: string; message?: string }>
  confirmClose(name: string): Promise<'save' | 'discard' | 'cancel'>
  onCloseRequested(callback: () => void): () => void
  closeWindow(): Promise<void>
  /** 程序标题栏所需的版本号（帮助 interface_interface.html 元素 1）。 */
  appVersion(): Promise<{ ok: boolean; version: string }>
  /** 更新主窗口标题栏；文案由 `src/shared/appTitle.ts` 的 `composeWindowTitle` 统一生成。 */
  setWindowTitle(title: string): Promise<{ ok: boolean }>
  appConfig: {
    load(): Promise<{ ok: boolean; skipNewWizard?: boolean; message?: string }>
    save(patch: { skipNewWizard?: boolean }): Promise<{ ok: boolean; skipNewWizard?: boolean; message?: string }>
  }
  exportPrintLogs(): Promise<{ ok: boolean; path?: string; message?: string }>
  clearPrintLogs(): Promise<{ ok: boolean; message?: string }>
  openPrintLog(): Promise<{ ok: boolean; path?: string; message?: string }>
  deletePrintLog(time: string): Promise<{ ok: boolean; message?: string }>
  saveTemplate(json: string, suggestedName: string): Promise<{ canceled: boolean; filePath?: string; message?: string }>
  openTemplate(): Promise<{ canceled: boolean; filePath?: string; content?: string; message?: string }>
  openTemplatePath(filePath: string): Promise<{ ok: boolean; filePath?: string; content?: string; message?: string }>
  saveTemplateTo(filePath: string, json: string): Promise<{ ok: boolean; filePath?: string; message?: string }>
  listTemplates(): Promise<{ ok: boolean; dir?: string; items?: Array<{ name: string; path: string; mtime: number; size: number; widthMm?: number; heightMm?: number; remark?: string; thumb?: string }>; message?: string }>
  saveTemplateToLib(name: string, json: string): Promise<{ ok: boolean; path?: string; message?: string }>
  deleteTemplate(filePath: string): Promise<{ ok: boolean; message?: string }>
}
