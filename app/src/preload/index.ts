import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC_CHANNELS, type CommandPayload, type DriverPrintPayload, type MallLoginPayload, type MaxLabelAPI, type PrinterQueryPayload } from '../shared/ipcContract'

const api: MaxLabelAPI = {
  printLabel: (payload: DriverPrintPayload, jobId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.printLabel, payload, jobId),
  previewOpen: (payload: { dataUrl?: string; pages?: string[]; widthMm: number; heightMm: number; truncated?: boolean; language?: 'zh-CN' | 'en-US' }) =>
    ipcRenderer.invoke(IPC_CHANNELS.previewOpen, payload),
  printCommand: (payload: CommandPayload, jobId?: string) => ipcRenderer.invoke(IPC_CHANNELS.printCommand, payload, jobId),
  queryPrinter: (payload: PrinterQueryPayload) => ipcRenderer.invoke(IPC_CHANNELS.printerQuery, payload),
  openPrinterDriverSettings: (payload: { printerName: string; mode?: 'preferences' | 'properties' }) => ipcRenderer.invoke(IPC_CHANNELS.printerDriverSettings, payload),
  printCommandFile: (payload: { filePath: string; port: CommandPayload['port'] }, jobId?: string) => ipcRenderer.invoke(IPC_CHANNELS.printCommandFile, payload, jobId),
  cancelPrint: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.printCancel, jobId),
  exportBarcodes: (payload: { items: Array<{ name: string; dataUrl: string }>; dir?: string; language?: 'zh-CN' | 'en-US' }) =>
    ipcRenderer.invoke(IPC_CHANNELS.exportBarcodes, payload),
  copyBarcodeImage: (dataUrl: string) => ipcRenderer.invoke(IPC_CHANNELS.barcodeCopy, dataUrl),
  listPorts: () => ipcRenderer.invoke(IPC_CHANNELS.portsList),
  listPrinters: () => ipcRenderer.invoke(IPC_CHANNELS.printersList),
  listFonts: () => ipcRenderer.invoke(IPC_CHANNELS.fontsList),
  openHelp: () => ipcRenderer.invoke(IPC_CHANNELS.helpOpen),
  cloud: {
    register: (serverUrl: string, email: string, password: string) => ipcRenderer.invoke(IPC_CHANNELS.cloudRegister, serverUrl, email, password),
    login: (serverUrl: string, email: string, password: string) => ipcRenderer.invoke(IPC_CHANNELS.cloudLogin, serverUrl, email, password),
    logout: (serverUrl: string, token: string) => ipcRenderer.invoke(IPC_CHANNELS.cloudLogout, serverUrl, token),
    save: (serverUrl: string, token: string, name: string, json: string, metadata) => ipcRenderer.invoke(IPC_CHANNELS.cloudSave, serverUrl, token, name, json, metadata),
    list: (serverUrl: string, token: string) => ipcRenderer.invoke(IPC_CHANNELS.cloudList, serverUrl, token),
    load: (serverUrl: string, token: string, id: string) => ipcRenderer.invoke(IPC_CHANNELS.cloudLoad, serverUrl, token, id),
    delete: (serverUrl: string, token: string, id: string) => ipcRenderer.invoke(IPC_CHANNELS.cloudDelete, serverUrl, token, id),
    databases: (serverUrl: string, token: string) => ipcRenderer.invoke(IPC_CHANNELS.cloudDatabases, serverUrl, token),
    databaseTables: (serverUrl: string, token: string, databaseId: string) => ipcRenderer.invoke(IPC_CHANNELS.cloudDatabaseTables, serverUrl, token, databaseId),
    databaseRows: (serverUrl: string, token: string, databaseId: string, table: string, fields: string[]) => ipcRenderer.invoke(IPC_CHANNELS.cloudDatabaseRows, serverUrl, token, databaseId, table, fields)
  },
  cloudService: {
    open: (serverUrl?: string, language?: 'zh-CN' | 'en-US') => ipcRenderer.invoke(IPC_CHANNELS.cloudOpen, serverUrl, language)
  },
  cloudCredentials: {
    load: (serverUrl: string) => ipcRenderer.invoke(IPC_CHANNELS.cloudCredentialLoad, serverUrl),
    save: (serverUrl: string, token: string, email: string) => ipcRenderer.invoke(IPC_CHANNELS.cloudCredentialSave, serverUrl, token, email),
    clear: (serverUrl: string) => ipcRenderer.invoke(IPC_CHANNELS.cloudCredentialClear, serverUrl)
  },
  license: {
    status: () => ipcRenderer.invoke(IPC_CHANNELS.licenseStatus),
    activate: (key: string, serverUrl: string) => ipcRenderer.invoke(IPC_CHANNELS.licenseActivate, key, serverUrl),
    check: (serverUrl: string) => ipcRenderer.invoke(IPC_CHANNELS.licenseCheck, serverUrl)
  },
  entitlement: {
    status: () => ipcRenderer.invoke(IPC_CHANNELS.entitlementStatus),
    onChanged: (callback) => {
      const listener = (_event: unknown, state: Parameters<typeof callback>[0]) => callback(state)
      ipcRenderer.on(IPC_CHANNELS.entitlementChanged, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.entitlementChanged, listener)
    }
  },
  update: {
    check: () => ipcRenderer.invoke(IPC_CHANNELS.updateCheck),
    download: () => ipcRenderer.invoke(IPC_CHANNELS.updateDownload),
    cancel: () => ipcRenderer.invoke(IPC_CHANNELS.updateCancel),
    install: () => ipcRenderer.invoke(IPC_CHANNELS.updateInstall),
    state: () => ipcRenderer.invoke(IPC_CHANNELS.updateState),
    onChanged: (callback) => {
      const listener = (_event: unknown, state: Parameters<typeof callback>[0]) => callback(state)
      ipcRenderer.on(IPC_CHANNELS.updateChanged, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.updateChanged, listener)
    }
  },
  scale: {
    read: (payload) => ipcRenderer.invoke(IPC_CHANNELS.scaleRead, payload),
    test: (payload) => ipcRenderer.invoke(IPC_CHANNELS.scaleTest, payload),
    cancel: (requestId: string) => ipcRenderer.invoke(IPC_CHANNELS.scaleCancel, requestId),
    listPorts: () => ipcRenderer.invoke(IPC_CHANNELS.scaleListPorts)
  },
  db: {
    test: (conn: unknown, requestId?: string) => ipcRenderer.invoke(IPC_CHANNELS.dbTest, conn, requestId),
    query: (conn: unknown, sql: string, requestId?: string) => ipcRenderer.invoke(IPC_CHANNELS.dbQuery, conn, sql, requestId),
    cancel: (requestId: string) => ipcRenderer.invoke(IPC_CHANNELS.dbCancel, requestId),
    saveSecret: (id: string, password?: string) => ipcRenderer.invoke(IPC_CHANNELS.dbSaveSecret, id, password)
  },
  sharedTemplates: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.sharedTemplatesList),
    publish: (name: string, json: string, author: string) => ipcRenderer.invoke(IPC_CHANNELS.sharedTemplatesPublish, name, json, author),
    load: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.sharedTemplatesLoad, id),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.sharedTemplatesDelete, id)
  },
  logPrint: (payload: { time: string; title: string; mode: string; count: number; copies: number; physicalCount?: number; status?: 'completed' | 'submitted' | 'partial' | 'failed' | 'canceled' | 'unknown'; sentCount?: number; test: boolean; printer: string; labelHeightMm?: number; dataSnapshot?: string[]; mall?: { baseUrl: string; tenantId: number; enabled: boolean } }) =>
    ipcRenderer.invoke(IPC_CHANNELS.logPrint, payload),
  listPrintLogs: () => ipcRenderer.invoke(IPC_CHANNELS.logList),
  readImage: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.imageRead, filePath),
  pickFile: (opts?: { filters?: Array<{ name: string; extensions: string[] }> }) => ipcRenderer.invoke(IPC_CHANNELS.pickFile, opts),
  openDatasetSource: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.datasetOpenSource, filePath),
  // Electron 44 起 File.path 被移除；导入数据时用这个拿到真实路径（无路径的虚拟文件返回空串）。
  getPathForFile: (file: File) => { try { return webUtils.getPathForFile(file) } catch { return '' } },
  pickDir: () => ipcRenderer.invoke(IPC_CHANNELS.pickDir),
  confirmClose: (name: string, language?: 'zh-CN' | 'en-US') => ipcRenderer.invoke(IPC_CHANNELS.confirmClose, name, language),
  onCloseRequested: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on(IPC_CHANNELS.closeRequested, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.closeRequested, listener)
  },
  closeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.closeWindow),
  appVersion: () => ipcRenderer.invoke(IPC_CHANNELS.appVersion),
  setWindowTitle: (title: string) => ipcRenderer.invoke(IPC_CHANNELS.appWindowTitle, title),
  appConfig: {
    load: () => ipcRenderer.invoke(IPC_CHANNELS.appConfigLoad),
    save: (patch: { skipNewWizard?: boolean }) => ipcRenderer.invoke(IPC_CHANNELS.appConfigSave, patch)
  },
  mall: {
    login: (context: { baseUrl: string; tenantId: number }, payload: MallLoginPayload) =>
      ipcRenderer.invoke(IPC_CHANNELS.mallLogin, context, payload),
    logout: (context: { baseUrl: string; tenantId: number }) => ipcRenderer.invoke(IPC_CHANNELS.mallLogout, context),
    session: (context: { baseUrl: string; tenantId: number }) => ipcRenderer.invoke(IPC_CHANNELS.mallSession, context),
    open: (context: { baseUrl: string; tenantId: number }, path?: string) => ipcRenderer.invoke(IPC_CHANNELS.mallOpen, context, path),
    plans: (context: { baseUrl: string; tenantId: number }) => ipcRenderer.invoke(IPC_CHANNELS.mallPlans, context),
    enterpriseRole: (context: { baseUrl: string; tenantId: number }) => ipcRenderer.invoke(IPC_CHANNELS.mallEnterpriseRole, context),
    sms: {
      send: (context: { baseUrl: string; tenantId: number }, mobile: string, captchaVerification?: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.mallSmsSend, context, mobile, captchaVerification)
    },
    captcha: {
      enabled: (context: { baseUrl: string; tenantId: number }) => ipcRenderer.invoke(IPC_CHANNELS.mallCaptchaEnabled, context),
      get: (context: { baseUrl: string; tenantId: number }) => ipcRenderer.invoke(IPC_CHANNELS.mallCaptchaGet, context),
      check: (context: { baseUrl: string; tenantId: number }, token: string, x: number) =>
        ipcRenderer.invoke(IPC_CHANNELS.mallCaptchaCheck, context, token, x)
    },
    wechat: {
      create: (context: { baseUrl: string; tenantId: number }) => ipcRenderer.invoke(IPC_CHANNELS.mallWechatCreate, context),
      query: (context: { baseUrl: string; tenantId: number }, ticket: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.mallWechatQuery, context, ticket),
      complete: (context: { baseUrl: string; tenantId: number }, payload: { ticket: string; mobile: string; code: string; company?: string }) =>
        ipcRenderer.invoke(IPC_CHANNELS.mallWechatComplete, context, payload),
      abandon: (context: { baseUrl: string; tenantId: number }, ticket: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.mallWechatAbandon, context, ticket)
    },
    templates: {
      list: (context: { baseUrl: string; tenantId: number }, keyword?: string) => ipcRenderer.invoke(IPC_CHANNELS.mallTemplateList, context, keyword),
      load: (context: { baseUrl: string; tenantId: number }, id: number) => ipcRenderer.invoke(IPC_CHANNELS.mallTemplateLoad, context, id),
      save: (context: { baseUrl: string; tenantId: number }, payload: { id?: number; name: string; content: string; widthMm?: number; heightMm?: number; category?: string; keywords?: string }) =>
        ipcRenderer.invoke(IPC_CHANNELS.mallTemplateSave, context, payload),
      delete: (context: { baseUrl: string; tenantId: number }, id: number) => ipcRenderer.invoke(IPC_CHANNELS.mallTemplateDelete, context, id)
    },
    shared: {
      list: (context: { baseUrl: string; tenantId: number }, keyword?: string, category?: string) => ipcRenderer.invoke(IPC_CHANNELS.mallSharedList, context, keyword, category),
      load: (context: { baseUrl: string; tenantId: number }, id: number) => ipcRenderer.invoke(IPC_CHANNELS.mallSharedLoad, context, id)
    }
  },
  share: {
    overview: (context: { baseUrl: string; tenantId: number }) => ipcRenderer.invoke(IPC_CHANNELS.shareOverview, context),
    content: {
      page: (context: { baseUrl: string; tenantId: number }, query: unknown) => ipcRenderer.invoke(IPC_CHANNELS.shareContentPage, context, query),
      get: (context: { baseUrl: string; tenantId: number }, id: number) => ipcRenderer.invoke(IPC_CHANNELS.shareContentGet, context, id),
      create: (context: { baseUrl: string; tenantId: number }, payload: unknown) => ipcRenderer.invoke(IPC_CHANNELS.shareContentCreate, context, payload),
      upload: (context: { baseUrl: string; tenantId: number }, payload: unknown, filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.shareContentUpload, context, payload, filePath),
      update: (context: { baseUrl: string; tenantId: number }, payload: unknown) => ipcRenderer.invoke(IPC_CHANNELS.shareContentUpdate, context, payload),
      delete: (context: { baseUrl: string; tenantId: number }, id: number) => ipcRenderer.invoke(IPC_CHANNELS.shareContentDelete, context, id),
      mine: (context: { baseUrl: string; tenantId: number }, pageNo?: number, pageSize?: number) => ipcRenderer.invoke(IPC_CHANNELS.shareContentMine, context, pageNo, pageSize)
    },
    folders: {
      list: (context: { baseUrl: string; tenantId: number }) => ipcRenderer.invoke(IPC_CHANNELS.shareFolderList, context),
      create: (context: { baseUrl: string; tenantId: number }, name: string) => ipcRenderer.invoke(IPC_CHANNELS.shareFolderCreate, context, name),
      update: (context: { baseUrl: string; tenantId: number }, id: number, name: string) => ipcRenderer.invoke(IPC_CHANNELS.shareFolderUpdate, context, id, name),
      delete: (context: { baseUrl: string; tenantId: number }, id: number) => ipcRenderer.invoke(IPC_CHANNELS.shareFolderDelete, context, id),
      members: (context: { baseUrl: string; tenantId: number }, folderId: number) => ipcRenderer.invoke(IPC_CHANNELS.shareFolderMembers, context, folderId),
      updateMembers: (context: { baseUrl: string; tenantId: number }, id: number, memberIds: number[]) => ipcRenderer.invoke(IPC_CHANNELS.shareFolderUpdateMembers, context, id, memberIds)
    },
    platform: {
      page: (context: { baseUrl: string; tenantId: number }, query: unknown) => ipcRenderer.invoke(IPC_CHANNELS.sharePlatformPage, context, query),
      get: (context: { baseUrl: string; tenantId: number }, id: number) => ipcRenderer.invoke(IPC_CHANNELS.sharePlatformGet, context, id)
    }
  },
  exportPrintLogs: (language?: 'zh-CN' | 'en-US') => ipcRenderer.invoke(IPC_CHANNELS.logExport, language),
  clearPrintLogs: () => ipcRenderer.invoke(IPC_CHANNELS.logClear),
  openPrintLog: () => ipcRenderer.invoke(IPC_CHANNELS.logOpen),
  deletePrintLog: (time: string) => ipcRenderer.invoke(IPC_CHANNELS.logDelete, time),
  saveTemplate: (json: string, suggestedName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.templateSave, json, suggestedName),
  openTemplate: (language?: 'zh-CN' | 'en-US') => ipcRenderer.invoke(IPC_CHANNELS.templateOpen, language),
  openTemplatePath: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.templateOpenPath, filePath),
  selectTemplateSavePath: (suggestedName: string, language?: 'zh-CN' | 'en-US') => ipcRenderer.invoke(IPC_CHANNELS.templateSave, '', suggestedName, true, language),
  saveTemplateTo: (filePath: string, json: string) => ipcRenderer.invoke(IPC_CHANNELS.templateSaveTo, filePath, json),
  listTemplates: () => ipcRenderer.invoke(IPC_CHANNELS.templateList),
  saveTemplateToLib: (name: string, json: string) => ipcRenderer.invoke(IPC_CHANNELS.templateSaveToLib, name, json),
  deleteTemplate: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.templateDelete, filePath)
}

contextBridge.exposeInMainWorld('maxlabel', api)

export type { MaxLabelAPI } from '../shared/ipcContract'
