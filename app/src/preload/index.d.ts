import type { PortConfig } from '../shared/model'

export interface MaxLabelAPI {
  printLabel(payload: { dataUrl: string; widthMm: number; heightMm: number }): Promise<{ ok: boolean }>
  previewOpen(payload: { dataUrl?: string; pages?: string[]; widthMm: number; heightMm: number }): Promise<{ ok: boolean }>
  printCommand(payload: {
    segments?: Array<{ type: 'text'; str: string } | { type: 'bin'; data: Uint8Array }>
    text?: string
    encoding: 'utf8' | 'gbk'
    port: PortConfig
  }): Promise<{ ok: boolean; canceled?: boolean; message?: string }>
  exportBarcodes(payload: { items: Array<{ name: string; dataUrl: string }> }): Promise<{ canceled?: boolean; ok?: boolean; dir?: string; count?: number }>
  listPorts(): Promise<{ comPorts: string[]; ok: boolean }>
  listPrinters(): Promise<{ ok: boolean; printers?: Array<{ name: string; displayName: string; status: number }>; message?: string }>
  openHelp(): Promise<{ ok: boolean; message?: string }>
  cloud: {
    register(email: string, password: string): Promise<{ ok: boolean; error?: string; data?: { token: string; email: string } }>
    login(email: string, password: string): Promise<{ ok: boolean; error?: string; data?: { token: string; email: string } }>
    save(token: string, name: string, json: string): Promise<{ ok: boolean; error?: string; data?: { id: string; name: string } }>
    list(token: string): Promise<{ ok: boolean; error?: string; data?: Array<{ id: string; name: string; updatedAt: string }> }>
    load(token: string, id: string): Promise<{ ok: boolean; error?: string; data?: { name: string; json: string } }>
    delete(token: string, id: string): Promise<{ ok: boolean; error?: string; data?: { ok: boolean } }>
  }
  cloudService: {
    open(serverUrl?: string): Promise<{ ok: boolean; url?: string; error?: string }>
  }
  license: {
    status(): Promise<{ ok: boolean; state: { active: boolean; edition: 'trial' | 'pro' | 'enterprise'; machineId: string; trialExpiresAt: string | null; holder: string | null; key?: string | null; expiresAt?: string | null; lastCheckAt?: string | null } }>
    activate(key: string, serverUrl: string): Promise<{ ok: boolean; error?: string; state?: { active: boolean; edition: 'trial' | 'pro' | 'enterprise'; machineId: string; trialExpiresAt: string | null; holder: string | null; key?: string | null; expiresAt?: string | null; lastCheckAt?: string | null } }>
    check(serverUrl: string): Promise<{ ok: boolean; error?: string }>
    sample(): Promise<{ ok: boolean; key: string; machineId: string }>
  }
  db: {
    test(conn: Record<string, unknown>): Promise<{ ok: boolean; error?: string; message?: string }>
    query(conn: Record<string, unknown>, sql: string): Promise<{ ok: boolean; rows: Array<Record<string, string | null>>; error?: string }>
  }
  enterprise: {
    status(): Promise<{ ok: boolean; role: 'admin' | 'operator' | 'viewer'; user: string; users: Record<string, string>; templateCount: number }>
    setRole(role: 'admin' | 'operator' | 'viewer', user: string): Promise<{ ok: boolean; error?: string }>
    list(): Promise<{ ok: boolean; templates: Array<{ id: string; name: string; json: string; updatedAt: string; author: string }> }>
    publish(name: string, json: string, author: string): Promise<{ ok: boolean; error?: string; id?: string }>
    load(id: string): Promise<{ ok: boolean; error?: string; data?: { name: string; json: string } }>
    delete(id: string): Promise<{ ok: boolean; error?: string }>
    logSummary(): Promise<{ ok: boolean; total: number; byDate: Array<{ date: string; count: number }>; byMode: Array<{ mode: string; count: number }>; last: unknown }>
  }
  logPrint(payload: { time: string; title: string; mode: string; count: number; copies: number; test: boolean; printer: string; dataSnapshot?: string[] }): Promise<{ ok: boolean; path?: string }>
  readImage(filePath: string): Promise<{ ok: boolean; dataUrl?: string; path?: string; message?: string }>
  pickFile(opts?: { filters?: Array<{ name: string; extensions: string[] }> }): Promise<{ ok: boolean; path?: string }>
  pickDir(): Promise<{ ok: boolean; path?: string }>
  listPrintLogs(): Promise<{ ok: boolean; logs?: Array<Record<string, unknown>>; message?: string }>
  exportPrintLogs(): Promise<{ ok: boolean; path?: string; message?: string }>
  clearPrintLogs(): Promise<{ ok: boolean; message?: string }>
  openPrintLog(): Promise<{ ok: boolean; path?: string; message?: string }>
  deletePrintLog(time: string): Promise<{ ok: boolean; message?: string }>
  saveTemplate(json: string, suggestedName: string): Promise<{ canceled: boolean; filePath?: string }>
  openTemplate(): Promise<{ canceled: boolean; filePath?: string; content?: string }>
  openTemplatePath(filePath: string): Promise<{ ok: boolean; filePath?: string; content?: string; message?: string }>
  saveTemplateTo(filePath: string, json: string): Promise<{ ok: boolean; filePath?: string; message?: string }>
  listTemplates(): Promise<{
    ok: boolean
    dir?: string
    items?: Array<{ name: string; path: string; mtime: number; size: number; widthMm?: number; heightMm?: number; remark?: string; thumb?: string }>
    message?: string
  }>
  saveTemplateToLib(name: string, json: string): Promise<{ ok: boolean; path?: string; message?: string }>
  deleteTemplate(filePath: string): Promise<{ ok: boolean; message?: string }>
  copyBarcodeImage(dataUrl: string): Promise<{ ok: boolean; message?: string }>
}

declare global {
  interface Window {
    maxlabel: MaxLabelAPI
  }
}

export {}
