import { clearSession } from './store'

const BASE = '/api'

function csrfToken() {
  const entry = document.cookie.split('; ').find((item) => item.startsWith('maxlabel_csrf='))
  if (!entry) return ''
  try { return decodeURIComponent(entry.slice('maxlabel_csrf='.length)) } catch { return '' }
}

async function request(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase()
  const csrf = method === 'GET' || method === 'HEAD' || method === 'OPTIONS' ? '' : csrfToken()
  const headers = { 'Content-Type': 'application/json', 'X-MaxLabel-Client': 'web', ...(csrf ? { 'X-MaxLabel-CSRF': csrf } : {}), ...(options.headers || {}) }
  // Include the HttpOnly session cookie for both same-origin hosting and an
  // explicitly configured external frontend origin.
  const res = await fetch(BASE + path, { ...options, headers, credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401) clearSession()
    const err = new Error(data.detail || '请求失败')
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  register: (email, password) => request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),
  changePassword: (old_password, new_password) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify({ old_password, new_password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),

  listTemplates: () => request('/cloud/templates'),
  saveTemplate: (name, data) => request('/cloud/templates', { method: 'POST', body: JSON.stringify({ name, data }) }),
  loadTemplate: (id) => request('/cloud/templates/' + id),
  deleteTemplate: (id) => request('/cloud/templates/' + id, { method: 'DELETE' }),

  // 管理后台
  adminStats: () => request('/admin/stats'),
  adminLicenses: (offset = 0, limit = 500) => request(`/admin/licenses?offset=${offset}&limit=${limit}`),
  adminCreateLicense: (payload) => request('/admin/licenses', { method: 'POST', body: JSON.stringify(payload) }),
  adminRevokeLicense: (key) => request('/admin/licenses/' + encodeURIComponent(key) + '/revoke', { method: 'POST' }),
  adminUsers: (offset = 0, limit = 500) => request(`/admin/users?offset=${offset}&limit=${limit}`),
  adminSetRole: (uid, role) => request('/admin/users/' + uid + '/role', { method: 'POST', body: JSON.stringify({ role }) }),
  adminTemplates: (offset = 0, limit = 500) => request(`/admin/templates?offset=${offset}&limit=${limit}`),
  adminDeleteTemplate: (id) => request('/admin/templates/' + id, { method: 'DELETE' })
}
