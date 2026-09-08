import { contextBridge, ipcRenderer } from 'electron'

const api = {
  printLabel: (payload: { dataUrl: string; widthMm: number; heightMm: number }) =>
    ipcRenderer.invoke('print-label', payload),
  previewOpen: (payload: { dataUrl?: string; pages?: string[]; widthMm: number; heightMm: number }) =>
    ipcRenderer.invoke('preview:open', payload),
  printCommand: (payload: {
    segments?: Array<{ type: 'text'; str: string } | { type: 'bin'; data: Uint8Array }>
    text?: string
    encoding: 'utf8' | 'gbk'
    port: unknown
  }) => ipcRenderer.invoke('print:command', payload),
  exportBarcodes: (payload: { items: Array<{ name: string; dataUrl: string }> }) =>
    ipcRenderer.invoke('export:barcodes', payload),
  copyBarcodeImage: (dataUrl: string) => ipcRenderer.invoke('barcode:copy', dataUrl),
  listPorts: () => ipcRenderer.invoke('ports:list'),
  listPrinters: () => ipcRenderer.invoke('printers:list'),
  openHelp: () => ipcRenderer.invoke('help:open'),
  cloud: {
    register: (email: string, password: string) => ipcRenderer.invoke('cloud:register', email, password),
    login: (email: string, password: string) => ipcRenderer.invoke('cloud:login', email, password),
    save: (token: string, name: string, json: string) => ipcRenderer.invoke('cloud:save', token, name, json),
    list: (token: string) => ipcRenderer.invoke('cloud:list', token),
    load: (token: string, id: string) => ipcRenderer.invoke('cloud:load', token, id),
    delete: (token: string, id: string) => ipcRenderer.invoke('cloud:delete', token, id)
  },
  cloudService: {
    open: (serverUrl?: string) => ipcRenderer.invoke('cloud:open', serverUrl)
  },
  license: {
    status: () => ipcRenderer.invoke('license:status'),
    activate: (key: string, serverUrl: string) => ipcRenderer.invoke('license:activate', key, serverUrl),
    check: (serverUrl: string) => ipcRenderer.invoke('license:check', serverUrl),
    sample: () => ipcRenderer.invoke('license:sample')
  },
  db: {
    test: (conn: unknown) => ipcRenderer.invoke('db:test', conn),
    query: (conn: unknown, sql: string) => ipcRenderer.invoke('db:query', conn, sql)
  },
  enterprise: {
    status: () => ipcRenderer.invoke('enterprise:status'),
    setRole: (role: string, user: string) => ipcRenderer.invoke('enterprise:setRole', role, user),
    list: () => ipcRenderer.invoke('enterprise:list'),
    publish: (name: string, json: string, author: string) => ipcRenderer.invoke('enterprise:publish', name, json, author),
    load: (id: string) => ipcRenderer.invoke('enterprise:load', id),
    delete: (id: string) => ipcRenderer.invoke('enterprise:delete', id),
    logSummary: () => ipcRenderer.invoke('enterprise:logSummary')
  },
  logPrint: (payload: { time: string; title: string; mode: string; count: number; copies: number; test: boolean; printer: string; dataSnapshot?: string[] }) =>
    ipcRenderer.invoke('log:print', payload),
  listPrintLogs: () => ipcRenderer.invoke('log:list'),
  readImage: (filePath: string) => ipcRenderer.invoke('image:read', filePath),
  pickFile: (opts?: { filters?: Array<{ name: string; extensions: string[] }> }) => ipcRenderer.invoke('dialog:pickFile', opts),
  pickDir: () => ipcRenderer.invoke('dialog:pickDir'),
  exportPrintLogs: () => ipcRenderer.invoke('log:export'),
  clearPrintLogs: () => ipcRenderer.invoke('log:clear'),
  openPrintLog: () => ipcRenderer.invoke('log:open'),
  deletePrintLog: (time: string) => ipcRenderer.invoke('log:delete', time),
  saveTemplate: (json: string, suggestedName: string) =>
    ipcRenderer.invoke('template:save', json, suggestedName),
  openTemplate: () => ipcRenderer.invoke('template:open'),
  openTemplatePath: (filePath: string) => ipcRenderer.invoke('template:openPath', filePath),
  saveTemplateTo: (filePath: string, json: string) => ipcRenderer.invoke('template:saveTo', filePath, json),
  listTemplates: () => ipcRenderer.invoke('template:list'),
  saveTemplateToLib: (name: string, json: string) => ipcRenderer.invoke('template:saveToLib', name, json),
  deleteTemplate: (filePath: string) => ipcRenderer.invoke('template:delete', filePath)
}

contextBridge.exposeInMainWorld('maxlabel', api)

export type MaxLabelAPI = typeof api
