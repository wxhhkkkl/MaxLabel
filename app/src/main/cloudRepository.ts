import { offlineCloudDatabaseRows, offlineCloudDatabases, offlineCloudDatabaseTables, offlineCloudDelete, offlineCloudList, offlineCloudLoad, offlineCloudLogin, offlineCloudLogout, offlineCloudRegister, offlineCloudSave, type CloudDatabaseSummary, type CloudDatabaseTable, type CloudTemplateMetadata } from './cloud'
import { httpRequestJson } from './net'
import { normalizeServerUrl } from './serverUrlPolicy'

export interface CloudTemplateSummary {
  id: string
  name: string
  updatedAt: string
  metadata?: CloudTemplateMetadata
}

export type { CloudDatabaseSummary, CloudDatabaseTable, CloudTemplateMetadata }

export interface CloudResult<T = unknown> {
  ok: boolean
  error?: string
  data?: T
}

export interface CloudRepository {
  register(email: string, password: string): Promise<CloudResult<{ token: string; email: string }>>
  login(email: string, password: string): Promise<CloudResult<{ token: string; email: string }>>
  logout(token: string): Promise<CloudResult<{ ok: boolean }>>
  save(token: string, name: string, json: string, metadata?: CloudTemplateMetadata): Promise<CloudResult<{ id: string; name: string; metadata?: CloudTemplateMetadata }>>
  list(token: string): Promise<CloudResult<CloudTemplateSummary[]>>
  load(token: string, id: string): Promise<CloudResult<{ name: string; json: string; metadata?: CloudTemplateMetadata }>>
  delete(token: string, id: string): Promise<CloudResult<{ ok: boolean }>>
  databases(token: string): Promise<CloudResult<CloudDatabaseSummary[]>>
  databaseTables(token: string, databaseId: string): Promise<CloudResult<CloudDatabaseTable[]>>
  databaseRows(token: string, databaseId: string, table: string, fields: string[]): Promise<CloudResult<Array<Record<string, string | number | boolean | null>>>>
}

function errorMessage(body: string, fallback: string): string {
  try {
    const parsed = JSON.parse(body) as { detail?: string; error?: string }
    return parsed.detail ?? parsed.error ?? fallback
  } catch {
    return fallback
  }
}

function remoteRepository(serverUrl: string): CloudRepository {
  const base = serverUrl
  const request = async <T>(method: 'GET' | 'POST' | 'DELETE', path: string, token?: string, payload?: unknown): Promise<CloudResult<T>> => {
    try {
      const response = await httpRequestJson(`${base}${path}`, method, payload, token ? { Authorization: `Bearer ${token}` } : undefined)
      if (response.status < 200 || response.status >= 300) return { ok: false, error: errorMessage(response.body, `云服务请求失败（HTTP ${response.status}）`) }
      return { ok: true, data: response.body ? JSON.parse(response.body) as T : undefined }
    } catch {
      return { ok: false, error: `无法连接云服务器（${base}）` }
    }
  }
  return {
    register: (email, password) => request('POST', '/api/auth/register', undefined, { email, password }),
    login: (email, password) => request('POST', '/api/auth/login', undefined, { email, password }),
    logout: (token) => request('POST', '/api/auth/logout', token),
    async save(token, name, json, metadata) {
      const r = await request<{ id: number; name: string }>('POST', '/api/cloud/templates', token, { name, data: json, ...(metadata ?? {}) })
      return r.ok && r.data ? { ok: true, data: { id: String(r.data.id), name: r.data.name, ...(metadata ? { metadata } : {}) } } : { ok: false, error: r.error }
    },
    async list(token) {
      const pageSize = 500
      const maxTemplates = 1000
      const all: Array<{ id: number; name: string; updated_at: string; keywords?: string; description?: string; category?: string; scope?: 'user' | 'group'; shared?: boolean }> = []
      for (let offset = 0; ; offset += pageSize) {
        const r = await request<Array<{ id: number; name: string; updated_at: string; keywords?: string; description?: string; category?: string; scope?: 'user' | 'group'; shared?: boolean }>>('GET', `/api/cloud/templates?offset=${offset}&limit=${pageSize}`, token)
        if (!r.ok || !r.data) return { ok: false, error: r.error }
        all.push(...r.data)
        if (all.length > maxTemplates) return { ok: false, error: `云模板数量超过 ${maxTemplates} 个限制` }
        if (r.data.length < pageSize) break
      }
      return { ok: true, data: all.map((t) => ({ id: String(t.id), name: t.name, updatedAt: t.updated_at, metadata: { keywords: t.keywords ?? '', description: t.description ?? '', category: t.category ?? '未分类', scope: t.scope === 'group' ? 'group' : 'user', shared: t.shared === true } })) }
    },
    async load(token, id) {
      const r = await request<{ id: number; name: string; data: string; keywords?: string; description?: string; category?: string; scope?: 'user' | 'group'; shared?: boolean }>('GET', `/api/cloud/templates/${encodeURIComponent(id)}`, token)
      return r.ok && r.data ? { ok: true, data: { name: r.data.name, json: r.data.data, metadata: { keywords: r.data.keywords ?? '', description: r.data.description ?? '', category: r.data.category ?? '未分类', scope: r.data.scope === 'group' ? 'group' : 'user', shared: r.data.shared === true } } } : { ok: false, error: r.error }
    },
    delete: (token, id) => request('DELETE', `/api/cloud/templates/${encodeURIComponent(id)}`, token),
    async databases(token) {
      const r = await request<Array<{ id: string | number; name: string; updated_at?: string }>>('GET', '/api/cloud/databases', token)
      return r.ok && r.data ? { ok: true, data: r.data.map((d) => ({ id: String(d.id), name: d.name, ...(d.updated_at ? { updatedAt: d.updated_at } : {}) })) } : { ok: false, error: r.error }
    },
    async databaseTables(token, databaseId) {
      const r = await request<Array<{ name: string; columns?: string[]; row_count?: number }>>('GET', `/api/cloud/databases/${encodeURIComponent(databaseId)}/tables`, token)
      return r.ok && r.data ? { ok: true, data: r.data.map((table) => ({ name: table.name, columns: table.columns ?? [], ...(table.row_count === undefined ? {} : { rowCount: table.row_count }) })) } : { ok: false, error: r.error }
    },
    async databaseRows(token, databaseId, table, fields) {
      const query = new URLSearchParams({ table, fields: fields.join(',') }).toString()
      const r = await request<Array<Record<string, string | number | boolean | null>>>('GET', `/api/cloud/databases/${encodeURIComponent(databaseId)}/rows?${query}`, token)
      return r.ok && r.data ? { ok: true, data: r.data } : { ok: false, error: r.error }
    }
  }
}

function invalidRepository(message: string): CloudRepository {
  const fail = async <T>(): Promise<CloudResult<T>> => ({ ok: false, error: message })
  return {
    register: fail,
    login: fail,
    logout: fail,
    save: fail,
    list: fail,
    load: fail,
    delete: fail,
    databases: fail,
    databaseTables: fail,
    databaseRows: fail
  }
}

export function createCloudRepository(serverUrl?: string): CloudRepository {
  const normalized = normalizeServerUrl(serverUrl)
  if (normalized === '') {
    return { register: offlineCloudRegister, login: offlineCloudLogin, logout: offlineCloudLogout, save: offlineCloudSave, list: offlineCloudList, load: offlineCloudLoad, delete: offlineCloudDelete, databases: offlineCloudDatabases, databaseTables: offlineCloudDatabaseTables, databaseRows: offlineCloudDatabaseRows }
  }
  if (!normalized) return invalidRepository('云服务器地址无效；远程服务器必须使用 HTTPS，本机地址可使用 HTTP')
  return remoteRepository(normalized)
}
