import { reactive } from 'vue'

// 会话状态（localStorage 持久化，与后端 JWT 对应）
const savedToken = localStorage.getItem('maxlabel_cloud_token') || ''
const savedEmail = localStorage.getItem('maxlabel_cloud_email') || ''
const savedRole = localStorage.getItem('maxlabel_cloud_role') || ''

export const state = reactive({
  token: savedToken,
  email: savedEmail,
  role: savedRole
})

export const token = {
  get value() {
    return state.token
  },
  set value(v) {
    state.token = v
    if (v) localStorage.setItem('maxlabel_cloud_token', v)
    else localStorage.removeItem('maxlabel_cloud_token')
  }
}

export function setSession(tk, email, role) {
  state.token = tk
  state.email = email
  state.role = role || 'user'
  localStorage.setItem('maxlabel_cloud_token', tk)
  localStorage.setItem('maxlabel_cloud_email', email)
  localStorage.setItem('maxlabel_cloud_role', state.role)
}

export function setRole(role) {
  state.role = role || 'user'
  localStorage.setItem('maxlabel_cloud_role', state.role)
}

export function clearSession() {
  state.token = ''
  state.email = ''
  state.role = ''
  localStorage.removeItem('maxlabel_cloud_token')
  localStorage.removeItem('maxlabel_cloud_email')
  localStorage.removeItem('maxlabel_cloud_role')
}
