import type { PortConfig } from './domain/printer'

/** Single source of truth for privileged IPC channel names. Keep channel
 * naming out of feature code so preload and main cannot silently drift. */
export const IPC_CHANNELS = Object.freeze({
  printLabel: 'print-label', previewOpen: 'preview:open', printCommand: 'print:command', printCancel: 'print:cancel',
  exportBarcodes: 'export:barcodes', barcodeCopy: 'barcode:copy', portsList: 'ports:list', printersList: 'printers:list', helpOpen: 'help:open',
  cloudRegister: 'cloud:register', cloudLogin: 'cloud:login', cloudLogout: 'cloud:logout', cloudSave: 'cloud:save', cloudList: 'cloud:list', cloudLoad: 'cloud:load', cloudDelete: 'cloud:delete', cloudOpen: 'cloud:open',
  cloudCredentialLoad: 'cloud-credentials:load', cloudCredentialSave: 'cloud-credentials:save', cloudCredentialClear: 'cloud-credentials:clear',
  licenseStatus: 'license:status', licenseActivate: 'license:activate', licenseCheck: 'license:check',
  dbTest: 'db:test', dbQuery: 'db:query', dbCancel: 'db:cancel', dbSaveSecret: 'db:save-secret',
  sharedTemplatesList: 'sharedTemplates:list', sharedTemplatesPublish: 'sharedTemplates:publish', sharedTemplatesLoad: 'sharedTemplates:load', sharedTemplatesDelete: 'sharedTemplates:delete',
  logPrint: 'log:print', logList: 'log:list', imageRead: 'image:read', pickFile: 'dialog:pickFile', pickDir: 'dialog:pickDir', confirmClose: 'dialog:confirmClose',
  closeRequested: 'app:close-requested', closeWindow: 'app:close-window', appConfigLoad: 'app:config-load', appConfigSave: 'app:config-save', logExport: 'log:export', logClear: 'log:clear', logOpen: 'log:open', logDelete: 'log:delete',
  templateSave: 'template:save', templateOpen: 'template:open', templateOpenPath: 'template:openPath', templateSaveTo: 'template:saveTo', templateList: 'template:list', templateSaveToLib: 'template:saveToLib', templateDelete: 'template:delete'
} as const)

export interface LicenseStateDto {
  active: boolean
  machineId: string
  holder: string | null
  key?: string | null
  expiresAt?: string | null
  lastCheckAt?: string | null
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
  cancelPrint(jobId: string): Promise<{ ok: boolean; canceled?: boolean; message?: string }>
  exportBarcodes(payload: { items: Array<{ name: string; dataUrl: string }> }): Promise<{ canceled?: boolean; ok?: boolean; dir?: string; count?: number; message?: string }>
  copyBarcodeImage(dataUrl: string): Promise<{ ok: boolean; message?: string }>
  listPorts(): Promise<{ comPorts: string[]; ok: boolean }>
  listPrinters(): Promise<{ ok: boolean; printers?: Array<{ name: string; displayName: string; status: number }>; message?: string }>
  openHelp(): Promise<{ ok: boolean; message?: string }>
  cloud: {
    register(serverUrl: string, email: string, password: string): Promise<{ ok: boolean; error?: string; data?: { token: string; email: string } }>
    login(serverUrl: string, email: string, password: string): Promise<{ ok: boolean; error?: string; data?: { token: string; email: string } }>
    logout(serverUrl: string, token: string): Promise<{ ok: boolean; error?: string; data?: { ok: boolean } }>
    save(serverUrl: string, token: string, name: string, json: string): Promise<{ ok: boolean; error?: string; data?: { id: string; name: string } }>
    list(serverUrl: string, token: string): Promise<{ ok: boolean; error?: string; data?: Array<{ id: string; name: string; updatedAt: string }> }>
    load(serverUrl: string, token: string, id: string): Promise<{ ok: boolean; error?: string; data?: { name: string; json: string } }>
    delete(serverUrl: string, token: string, id: string): Promise<{ ok: boolean; error?: string; data?: { ok: boolean } }>
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
