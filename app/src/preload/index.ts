import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type CommandPayload, type DriverPrintPage, type MaxLabelAPI } from '../shared/ipcContract'

const api: MaxLabelAPI = {
  printLabel: (payload: { pages: DriverPrintPage[]; widthMm: number; heightMm: number }, jobId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.printLabel, payload, jobId),
  previewOpen: (payload: { dataUrl?: string; pages?: string[]; widthMm: number; heightMm: number; truncated?: boolean }) =>
    ipcRenderer.invoke(IPC_CHANNELS.previewOpen, payload),
  printCommand: (payload: CommandPayload, jobId?: string) => ipcRenderer.invoke(IPC_CHANNELS.printCommand, payload, jobId),
  cancelPrint: (jobId: string) => ipcRenderer.invoke(IPC_CHANNELS.printCancel, jobId),
  exportBarcodes: (payload: { items: Array<{ name: string; dataUrl: string }> }) =>
    ipcRenderer.invoke(IPC_CHANNELS.exportBarcodes, payload),
  copyBarcodeImage: (dataUrl: string) => ipcRenderer.invoke(IPC_CHANNELS.barcodeCopy, dataUrl),
  listPorts: () => ipcRenderer.invoke(IPC_CHANNELS.portsList),
  listPrinters: () => ipcRenderer.invoke(IPC_CHANNELS.printersList),
  openHelp: () => ipcRenderer.invoke(IPC_CHANNELS.helpOpen),
  cloud: {
    register: (serverUrl: string, email: string, password: string) => ipcRenderer.invoke(IPC_CHANNELS.cloudRegister, serverUrl, email, password),
    login: (serverUrl: string, email: string, password: string) => ipcRenderer.invoke(IPC_CHANNELS.cloudLogin, serverUrl, email, password),
    logout: (serverUrl: string, token: string) => ipcRenderer.invoke(IPC_CHANNELS.cloudLogout, serverUrl, token),
    save: (serverUrl: string, token: string, name: string, json: string) => ipcRenderer.invoke(IPC_CHANNELS.cloudSave, serverUrl, token, name, json),
    list: (serverUrl: string, token: string) => ipcRenderer.invoke(IPC_CHANNELS.cloudList, serverUrl, token),
    load: (serverUrl: string, token: string, id: string) => ipcRenderer.invoke(IPC_CHANNELS.cloudLoad, serverUrl, token, id),
    delete: (serverUrl: string, token: string, id: string) => ipcRenderer.invoke(IPC_CHANNELS.cloudDelete, serverUrl, token, id)
  },
  cloudService: {
    open: (serverUrl?: string) => ipcRenderer.invoke(IPC_CHANNELS.cloudOpen, serverUrl)
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
  logPrint: (payload: { time: string; title: string; mode: string; count: number; copies: number; physicalCount?: number; status?: 'completed' | 'submitted' | 'partial' | 'failed' | 'canceled' | 'unknown'; sentCount?: number; test: boolean; printer: string; dataSnapshot?: string[] }) =>
    ipcRenderer.invoke(IPC_CHANNELS.logPrint, payload),
  listPrintLogs: () => ipcRenderer.invoke(IPC_CHANNELS.logList),
  readImage: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.imageRead, filePath),
  pickFile: (opts?: { filters?: Array<{ name: string; extensions: string[] }> }) => ipcRenderer.invoke(IPC_CHANNELS.pickFile, opts),
  pickDir: () => ipcRenderer.invoke(IPC_CHANNELS.pickDir),
  confirmClose: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.confirmClose, name),
  onCloseRequested: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on(IPC_CHANNELS.closeRequested, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.closeRequested, listener)
  },
  closeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.closeWindow),
  appConfig: {
    load: () => ipcRenderer.invoke(IPC_CHANNELS.appConfigLoad),
    save: (patch: { skipNewWizard?: boolean }) => ipcRenderer.invoke(IPC_CHANNELS.appConfigSave, patch)
  },
  exportPrintLogs: () => ipcRenderer.invoke(IPC_CHANNELS.logExport),
  clearPrintLogs: () => ipcRenderer.invoke(IPC_CHANNELS.logClear),
  openPrintLog: () => ipcRenderer.invoke(IPC_CHANNELS.logOpen),
  deletePrintLog: (time: string) => ipcRenderer.invoke(IPC_CHANNELS.logDelete, time),
  saveTemplate: (json: string, suggestedName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.templateSave, json, suggestedName),
  openTemplate: () => ipcRenderer.invoke(IPC_CHANNELS.templateOpen),
  openTemplatePath: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.templateOpenPath, filePath),
  saveTemplateTo: (filePath: string, json: string) => ipcRenderer.invoke(IPC_CHANNELS.templateSaveTo, filePath, json),
  listTemplates: () => ipcRenderer.invoke(IPC_CHANNELS.templateList),
  saveTemplateToLib: (name: string, json: string) => ipcRenderer.invoke(IPC_CHANNELS.templateSaveToLib, name, json),
  deleteTemplate: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.templateDelete, filePath)
}

contextBridge.exposeInMainWorld('maxlabel', api)

export type { MaxLabelAPI } from '../shared/ipcContract'
