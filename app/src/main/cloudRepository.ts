import { offlineCloudDelete, offlineCloudList, offlineCloudLoad, offlineCloudLogin, offlineCloudLogout, offlineCloudRegister, offlineCloudSave } from './cloud'
import { httpRequestJson } from './net'
import { normalizeServerUrl } from './serverUrlPolicy'

export interface CloudTemplateSummary {
  id: string
  name: string
  updatedAt: string
}

export interface CloudResult<T = unknown> {
  ok: boolean
  error?: string
  data?: T
}

export interface CloudRepository {
  register(email: string, password: string): Promise<CloudResult<{ token: string; email: string }>>
  login(email: string, password: string): Promise<CloudResult<{ token: string; email: string }>>
  logout(token: string): Promise<CloudResult<{ ok: boolean }>>
  save(token: string, name: string, json: string): Promise<CloudResult<{ id: string; name: string }>>
  list(token: string): Promise<CloudResult<CloudTemplateSummary[]>>
  load(token: string, id: string): Promise<CloudResult<{ name: string; json: string }>>
  delete(token: string, id: string): Promise<CloudResult<{ ok: boolean }>>
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
    async save(token, name, json) {
      const r = await request<{ id: number; name: string }>('POST', '/api/cloud/templates', token, { name, data: json })
      return r.ok && r.data ? { ok: true, data: { id: String(r.data.id), name: r.data.name } } : { ok: false, error: r.error }
    },
    async list(token) {
      const pageSize = 500
      const maxTemplates = 1000
      const all: Array<{ id: number; name: string; updated_at: string }> = []
      for (let offset = 0; ; offset += pageSize) {
        const r = await request<Array<{ id: number; name: string; updated_at: string }>>('GET', `/api/cloud/templates?offset=${offset}&limit=${pageSize}`, token)
        if (!r.ok || !r.data) return { ok: false, error: r.error }
        all.push(...r.data)
        if (all.length > maxTemplates) return { ok: false, error: `云模板数量超过 ${maxTemplates} 个限制` }
        if (r.data.length < pageSize) break
      }
      return { ok: true, data: all.map((t) => ({ id: String(t.id), name: t.name, updatedAt: t.updated_at })) }
    },
    async load(token, id) {
      const r = await request<{ id: number; name: string; data: string }>('GET', `/api/cloud/templates/${encodeURIComponent(id)}`, token)
      return r.ok && r.data ? { ok: true, data: { name: r.data.name, json: r.data.data } } : { ok: false, error: r.error }
    },
    delete: (token, id) => request('DELETE', `/api/cloud/templates/${encodeURIComponent(id)}`, token)
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
    delete: fail
  }
}

export function createCloudRepository(serverUrl?: string): CloudRepository {
  const normalized = normalizeServerUrl(serverUrl)
  if (normalized === '') {
    return { register: offlineCloudRegister, login: offlineCloudLogin, logout: offlineCloudLogout, save: offlineCloudSave, list: offlineCloudList, load: offlineCloudLoad, delete: offlineCloudDelete }
  }
  if (!normalized) return invalidRepository('云服务器地址无效；远程服务器必须使用 HTTPS，本机地址可使用 HTTP')
  return remoteRepository(normalized)
}
