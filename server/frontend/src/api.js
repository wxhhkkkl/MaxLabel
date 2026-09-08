const BASE = '/api'

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const tk = localStorage.getItem('maxlabel_cloud_token')
  if (tk) headers['Authorization'] = 'Bearer ' + tk
  const res = await fetch(BASE + path, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
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
  adminLicenses: () => request('/admin/licenses'),
  adminCreateLicense: (payload) => request('/admin/licenses', { method: 'POST', body: JSON.stringify(payload) }),
  adminRevokeLicense: (key) => request('/admin/licenses/' + encodeURIComponent(key) + '/revoke', { method: 'POST' }),
  adminUsers: () => request('/admin/users'),
  adminSetRole: (uid, role) => request('/admin/users/' + uid + '/role', { method: 'POST', body: JSON.stringify({ role }) }),
  adminTemplates: () => request('/admin/templates'),
  adminDeleteTemplate: (id) => request('/admin/templates/' + id, { method: 'DELETE' })
}
