import type { PortConfig } from './domain/printer'
import type { Edition, EntitlementState } from './domain/entitlement'
import type { IpcErrorFields } from './i18n/types'
import type { ScaleReadRequest, ScaleReadResult, ScaleTestRequest, ScaleTestResult } from './scale/types'

export type { DongleState, Edition, EntitlementState, FeatureKey, FeatureSet } from './domain/entitlement'

/** Single source of truth for privileged IPC channel names. Keep channel
 * naming out of feature code so preload and main cannot silently drift. */
export const IPC_CHANNELS = Object.freeze({
  printLabel: 'print-label', previewOpen: 'preview:open', printCommand: 'print:command', printCommandFile: 'command:send-file', printCancel: 'print:cancel',
  exportBarcodes: 'export:barcodes', barcodeCopy: 'barcode:copy', portsList: 'ports:list', printersList: 'printers:list', helpOpen: 'help:open',
  cloudRegister: 'cloud:register', cloudLogin: 'cloud:login', cloudLogout: 'cloud:logout', cloudSave: 'cloud:save', cloudList: 'cloud:list', cloudLoad: 'cloud:load', cloudDelete: 'cloud:delete', cloudOpen: 'cloud:open', cloudDatabases: 'cloud:databases', cloudDatabaseTables: 'cloud:database-tables', cloudDatabaseRows: 'cloud:database-rows',
  cloudCredentialLoad: 'cloud-credentials:load', cloudCredentialSave: 'cloud-credentials:save', cloudCredentialClear: 'cloud-credentials:clear',
  licenseStatus: 'license:status', licenseActivate: 'license:activate', licenseCheck: 'license:check',
  entitlementStatus: 'entitlement:status', entitlementChanged: 'entitlement:changed',
  updateCheck: 'update:check', updateDownload: 'update:download', updateCancel: 'update:cancel', updateInstall: 'update:install', updateState: 'update:state', updateChanged: 'update:changed',
  dbTest: 'db:test', dbQuery: 'db:query', dbCancel: 'db:cancel', dbSaveSecret: 'db:save-secret',
  scaleRead: 'scale:read', scaleTest: 'scale:test', scaleCancel: 'scale:cancel',
  sharedTemplatesList: 'sharedTemplates:list', sharedTemplatesPublish: 'sharedTemplates:publish', sharedTemplatesLoad: 'sharedTemplates:load', sharedTemplatesDelete: 'sharedTemplates:delete',
  logPrint: 'log:print', logList: 'log:list', imageRead: 'image:read', pickFile: 'dialog:pickFile', pickDir: 'dialog:pickDir', confirmClose: 'dialog:confirmClose',
  closeRequested: 'app:close-requested', closeWindow: 'app:close-window', appConfigLoad: 'app:config-load', appConfigSave: 'app:config-save', logExport: 'log:export', logClear: 'log:clear', logOpen: 'log:open', logDelete: 'log:delete',
  appVersion: 'app:version', appWindowTitle: 'app:window-title',
  templateSave: 'template:save', templateOpen: 'template:open', templateOpenPath: 'template:openPath', templateSaveTo: 'template:saveTo', templateList: 'template:list', templateSaveToLib: 'template:saveToLib', templateDelete: 'template:delete',
  mallLogin: 'mall:login', mallLogout: 'mall:logout', mallSession: 'mall:session', mallOpen: 'mall:open', mallPlans: 'mall:plans',
  mallTemplateList: 'mall:template-list', mallTemplateLoad: 'mall:template-load', mallTemplateSave: 'mall:template-save', mallTemplateDelete: 'mall:template-delete', mallTemplateShare: 'mall:template-share', mallTemplateUnshare: 'mall:template-unshare',
  mallSharedList: 'mall:shared-list', mallSharedLoad: 'mall:shared-load'
} as const)

/** 商城调用上下文：地址与租户由渲染层从系统设置传入，主进程逐次校验。 */
export interface MallContext {
  baseUrl: string
  tenantId: number
}

/** MaxLabelMall 会员快照（桌面端只保存脱敏身份与订阅状态）。 */
export interface MallMember {
  userId: number
  mobileMasked: string
  nickname?: string
  /** 会员资料中的公司名称；缺失时界面显示“未填写”。 */
  companyName?: string
  /** 会员头像地址（仅 http/https）。 */
  avatarUrl?: string
  /** 当前有效版本中的最高档；未订阅时为 none。 */
  edition?: Edition
  /** 账号当前持有的有效版本（用于取最高档）。 */
  activeEditions?: Edition[]
  subscriptionActive: boolean
  /** 权益来源：个人订阅 / 企业席位 */
  subscriptionSource?: 'personal' | 'enterprise'
  /** 企业来源时的企业名称 */
  orgName?: string
  subscriptionEndDate?: string | null
  subscriptionEndTime?: string | null
  remainingDays?: number
  periodMonths?: number | null
  sourceOrderNo?: string | null
}

/** 私有云端模板元数据。 */
export interface MallTemplateMetadata {
  id: number
  name: string
  sizeBytes: number
  widthMm?: number
  heightMm?: number
  category?: string
  keywords?: string
  shareStatus?: number | null
  createTime?: string
  updateTime?: string
  /** 示意图（SVG data URL，由商城后端从正文生成）。 */
  thumb?: string
}

export interface MallTemplateContent extends MallTemplateMetadata {
  content: string
}

/** 平台共享模板元数据（发布者只展示脱敏昵称）。 */
export interface MallSharedTemplate {
  id: number
  name: string
  widthMm?: number
  heightMm?: number
  category?: string
  keywords?: string
  publisherNickname?: string
  publishedTime?: string
  /** 示意图（SVG data URL，由商城后端从正文生成）。 */
  thumb?: string
}

export interface MallSharedTemplateContent extends MallSharedTemplate {
  content: string
}

/** 会员授权周期（商城返回，桌面端只展示）。 */
export interface MallPlan {
  spuId: number
  skuId: number
  name: string
  /** 套餐所属会员版本；后端未返回时不可作为版本套餐购买。 */
  edition?: Edition
  periodMonths: number
  price: number
  picUrl?: string
  stock?: number
  sort?: number
}

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
  notes?: string
  releaseDate?: string
  message?: string
  messageKey?: string
  messageParams?: Record<string, string | number>
}

export interface UpdateProgressDto {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export type UpdateStateName =
  | 'idle' | 'checking' | 'available' | 'latest' | 'downloading' | 'ready' | 'installing' | 'error'

export interface UpdateStateDto {
  state: UpdateStateName
  current: string
  latest?: string
  notes?: string
  releaseDate?: string
  progress?: UpdateProgressDto
  error?: string
  messageKey?: string
  messageParams?: Record<string, string | number>
}

export interface UpdateActionResult {
  ok: boolean
  error?: string
  messageKey?: string
  messageParams?: Record<string, string | number>
}

export type CommandPayload = {
  /** UI language for the save dialog when printing commands to a file. */
  language?: 'zh-CN' | 'en-US'
  segments?: Array<{ type: 'text'; str: string } | { type: 'bin'; data: Uint8Array }>
  text?: string
  encoding: 'utf8' | 'gbk'
  port: PortConfig
}

export type PrintTransportStatus = 'accepted' | 'failed' | 'unknown' | 'canceled'

export interface PrintTransportResult extends IpcErrorFields {
  ok: boolean
  canceled?: boolean
  status?: PrintTransportStatus
  bytesWritten?: number
  message?: string
}

export type DriverPrintPage =
  | { dataUrl: string; svg?: never; copies?: number }
  | { svg: string; dataUrl?: never; copies?: number }

export interface DriverPrintPayload {
  pages: DriverPrintPage[]
  widthMm: number
  heightMm: number
  printerName?: string
}

/** Renderer 与 preload 共享的唯一 IPC 门面契约。 */
export interface MaxLabelAPI {
  printLabel(payload: DriverPrintPayload, jobId?: string): Promise<PrintTransportResult>
  previewOpen(payload: { dataUrl?: string; pages?: string[]; widthMm: number; heightMm: number; truncated?: boolean; language?: 'zh-CN' | 'en-US' }): Promise<{ ok: boolean; message?: string }>
  printCommand(payload: CommandPayload, jobId?: string): Promise<PrintTransportResult>
  /** 打印机「工具」页：把磁盘上的文件（指令/固件）原样发给打印机。 */
  printCommandFile(payload: { filePath: string; port: CommandPayload['port'] }, jobId?: string): Promise<PrintTransportResult>
  cancelPrint(jobId: string): Promise<{ ok: boolean; canceled?: boolean; message?: string }>
  exportBarcodes(payload: { items: Array<{ name: string; dataUrl: string }>; dir?: string; language?: 'zh-CN' | 'en-US' }): Promise<{ canceled?: boolean; ok?: boolean; dir?: string; count?: number; message?: string } & IpcErrorFields>
  copyBarcodeImage(dataUrl: string): Promise<{ ok: boolean; message?: string }>
  listPorts(): Promise<{ comPorts: string[]; usbPrinterPorts?: string[]; ok: boolean; message?: string }>
  /** `port` = Windows 打印队列的端口名（真机「打印」对话框的「位置」列）；`isDefault` = Windows 默认打印机。 */
  listPrinters(): Promise<{ ok: boolean; printers?: Array<{ name: string; displayName: string; status: number; port?: string; isDefault?: boolean }>; message?: string }>
  openHelp(): Promise<{ ok: boolean; message?: string }>
  cloud: {
    register(serverUrl: string, email: string, password: string): Promise<{ ok: boolean; error?: string; data?: { token: string; email: string } } & IpcErrorFields>
    login(serverUrl: string, email: string, password: string): Promise<{ ok: boolean; error?: string; data?: { token: string; email: string } } & IpcErrorFields>
    logout(serverUrl: string, token: string): Promise<{ ok: boolean; error?: string; data?: { ok: boolean } } & IpcErrorFields>
    save(serverUrl: string, token: string, name: string, json: string, metadata?: CloudTemplateMetadata): Promise<{ ok: boolean; error?: string; data?: { id: string; name: string; metadata?: CloudTemplateMetadata } } & IpcErrorFields>
    list(serverUrl: string, token: string): Promise<{ ok: boolean; error?: string; data?: Array<{ id: string; name: string; updatedAt: string; metadata?: CloudTemplateMetadata }> } & IpcErrorFields>
    load(serverUrl: string, token: string, id: string): Promise<{ ok: boolean; error?: string; data?: { name: string; json: string; metadata?: CloudTemplateMetadata } } & IpcErrorFields>
    delete(serverUrl: string, token: string, id: string): Promise<{ ok: boolean; error?: string; data?: { ok: boolean } } & IpcErrorFields>
    databases(serverUrl: string, token: string): Promise<{ ok: boolean; error?: string; data?: CloudDatabaseSummary[] } & IpcErrorFields>
    databaseTables(serverUrl: string, token: string, databaseId: string): Promise<{ ok: boolean; error?: string; data?: CloudDatabaseTable[] } & IpcErrorFields>
    databaseRows(serverUrl: string, token: string, databaseId: string, table: string, fields: string[]): Promise<{ ok: boolean; error?: string; data?: Array<Record<string, string | number | boolean | null>> } & IpcErrorFields>
  }
  cloudService: { open(serverUrl?: string, language?: 'zh-CN' | 'en-US'): Promise<{ ok: boolean; url?: string; error?: string } & IpcErrorFields> }
  cloudCredentials: {
    load(serverUrl: string): Promise<{ ok: boolean; token?: string; email?: string; error?: string } & IpcErrorFields>
    save(serverUrl: string, token: string, email: string): Promise<{ ok: boolean; error?: string } & IpcErrorFields>
    clear(serverUrl: string): Promise<{ ok: boolean; error?: string } & IpcErrorFields>
  }
  license: {
    status(): Promise<{ ok: boolean; state: LicenseStateDto; error?: string } & IpcErrorFields>
    activate(key: string, serverUrl: string): Promise<{ ok: boolean; error?: string; state?: LicenseStateDto } & IpcErrorFields>
    check(serverUrl: string): Promise<{ ok: boolean; error?: string } & IpcErrorFields>
  }
  /** 会员版本 + 加密狗的授权状态；主进程计算，渲染层只读消费。 */
  entitlement: {
    status(): Promise<{ ok: boolean; state?: EntitlementState; error?: string } & IpcErrorFields>
    onChanged(callback: (state: EntitlementState) => void): () => void
  }
  /** 启动自动检查更新 / 帮助菜单「查找更新版本」共用（帮助 install_upgrade.html）。 */
  update: {
    check(): Promise<UpdateCheckResultDto>
    download(): Promise<UpdateActionResult>
    cancel(): Promise<{ ok: boolean; canceled: boolean }>
    install(): Promise<UpdateActionResult>
    state(): Promise<UpdateStateDto>
    onChanged(callback: (state: UpdateStateDto) => void): () => void
  }
  scale: {
    read(payload: ScaleReadRequest): Promise<ScaleReadResult>
    test(payload: ScaleTestRequest): Promise<ScaleTestResult>
    cancel(requestId: string): Promise<{ ok: boolean; canceled: boolean }>
  }
  db: {
    test(conn: Record<string, unknown>, requestId?: string): Promise<{ ok: boolean; error?: string; message?: string } & IpcErrorFields>
    query(conn: Record<string, unknown>, sql: string, requestId?: string): Promise<{ ok: boolean; rows: Array<Record<string, string | null>>; error?: string } & IpcErrorFields>
    cancel(requestId: string): Promise<{ ok: boolean; canceled?: boolean }>
    saveSecret(id: string, password?: string): Promise<{ ok: boolean; error?: string } & IpcErrorFields>
  }
  sharedTemplates: {
    list(): Promise<{ ok: boolean; templates: Array<{ id: string; name: string; json: string; updatedAt: string; author: string }>; error?: string }>
    publish(name: string, json: string, author: string): Promise<{ ok: boolean; error?: string; id?: string }>
    load(id: string): Promise<{ ok: boolean; error?: string; data?: { name: string; json: string } }>
    delete(id: string): Promise<{ ok: boolean; error?: string }>
  }
  logPrint(payload: { time: string; title: string; mode: string; count: number; copies: number; physicalCount?: number; status?: 'completed' | 'submitted' | 'partial' | 'failed' | 'canceled' | 'unknown'; sentCount?: number; test: boolean; printer: string; dataSnapshot?: string[]; mall?: { baseUrl: string; tenantId: number; enabled: boolean } }): Promise<{ ok: boolean; path?: string }>
  listPrintLogs(): Promise<{ ok: boolean; logs?: Array<Record<string, unknown>>; message?: string }>
  readImage(filePath: string): Promise<{ ok: boolean; dataUrl?: string; path?: string; message?: string } & IpcErrorFields>
  pickFile(opts?: { filters?: Array<{ name: string; extensions: string[] }> }): Promise<{ ok: boolean; path?: string; message?: string } & IpcErrorFields>
  pickDir(): Promise<{ ok: boolean; path?: string; message?: string } & IpcErrorFields>
  confirmClose(name: string, language?: 'zh-CN' | 'en-US'): Promise<'save' | 'discard' | 'cancel'>
  onCloseRequested(callback: () => void): () => void
  closeWindow(): Promise<void>
  /** 程序标题栏所需的版本号（帮助 interface_interface.html 元素 1）。 */
  appVersion(): Promise<{ ok: boolean; version: string }>
  /** 更新主窗口标题栏；文案由 `src/shared/appTitle.ts` 的 `composeWindowTitle` 统一生成。 */
  setWindowTitle(title: string): Promise<{ ok: boolean }>
  appConfig: {
    load(): Promise<{ ok: boolean; skipNewWizard?: boolean; message?: string } & IpcErrorFields>
    save(patch: { skipNewWizard?: boolean }): Promise<{ ok: boolean; skipNewWizard?: boolean; message?: string } & IpcErrorFields>
  }
  mall: {
    login(context: MallContext): Promise<{ ok: boolean; member?: MallMember; error?: string } & IpcErrorFields>
    logout(context: MallContext): Promise<{ ok: boolean; error?: string } & IpcErrorFields>
    session(context: MallContext): Promise<{ ok: boolean; member?: MallMember; error?: string } & IpcErrorFields>
    open(context: MallContext, path?: string): Promise<{ ok: boolean; url?: string; error?: string } & IpcErrorFields>
    plans(context: MallContext): Promise<{ ok: boolean; plans?: MallPlan[]; error?: string } & IpcErrorFields>
    templates: {
      list(context: MallContext, keyword?: string): Promise<{ ok: boolean; items?: MallTemplateMetadata[]; error?: string } & IpcErrorFields>
      load(context: MallContext, id: number): Promise<{ ok: boolean; item?: MallTemplateContent; error?: string } & IpcErrorFields>
      save(context: MallContext, payload: { id?: number; name: string; content: string; widthMm?: number; heightMm?: number; category?: string; keywords?: string }): Promise<{ ok: boolean; id?: number; error?: string } & IpcErrorFields>
      delete(context: MallContext, id: number): Promise<{ ok: boolean; error?: string } & IpcErrorFields>
      submitShare(context: MallContext, id: number, category?: string, keywords?: string): Promise<{ ok: boolean; sharedTemplateId?: number; auditStatus?: number; error?: string } & IpcErrorFields>
      cancelShare(context: MallContext, id: number): Promise<{ ok: boolean; error?: string } & IpcErrorFields>
    }
    shared: {
      list(context: MallContext, keyword?: string, category?: string): Promise<{ ok: boolean; items?: MallSharedTemplate[]; error?: string } & IpcErrorFields>
      load(context: MallContext, id: number): Promise<{ ok: boolean; item?: MallSharedTemplateContent; error?: string } & IpcErrorFields>
    }
  }
  exportPrintLogs(language?: 'zh-CN' | 'en-US'): Promise<{ ok: boolean; path?: string; message?: string }>
  clearPrintLogs(): Promise<{ ok: boolean; message?: string }>
  openPrintLog(): Promise<{ ok: boolean; path?: string; message?: string }>
  deletePrintLog(time: string): Promise<{ ok: boolean; message?: string }>
  saveTemplate(json: string, suggestedName: string): Promise<{ canceled: boolean; filePath?: string; message?: string } & IpcErrorFields>
  selectTemplateSavePath(suggestedName: string, language?: 'zh-CN' | 'en-US'): Promise<{ canceled: boolean; filePath?: string; message?: string }>
  openTemplate(language?: 'zh-CN' | 'en-US'): Promise<{ canceled: boolean; filePath?: string; content?: string; message?: string } & IpcErrorFields>
  openTemplatePath(filePath: string): Promise<{ ok: boolean; filePath?: string; content?: string; message?: string } & IpcErrorFields>
  saveTemplateTo(filePath: string, json: string): Promise<{ ok: boolean; filePath?: string; message?: string } & IpcErrorFields>
  listTemplates(): Promise<{ ok: boolean; dir?: string; items?: Array<{ name: string; path: string; mtime: number; size: number; widthMm?: number; heightMm?: number; remark?: string; thumb?: string }>; message?: string }>
  saveTemplateToLib(name: string, json: string): Promise<{ ok: boolean; path?: string; message?: string } & IpcErrorFields>
  deleteTemplate(filePath: string): Promise<{ ok: boolean; message?: string } & IpcErrorFields>
}
