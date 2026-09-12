import { reactive } from 'vue'

// JWT is held by the server in an HttpOnly cookie.  Only non-secret display
// state is kept for the current browser session.
const savedEmail = sessionStorage.getItem('maxlabel_cloud_email') || ''
const savedRole = sessionStorage.getItem('maxlabel_cloud_role') || ''
const savedAuthenticated = sessionStorage.getItem('maxlabel_cloud_authenticated') === '1'

export const state = reactive({
  token: savedAuthenticated ? 'cookie' : '',
  email: savedEmail,
  role: savedRole
})

export const token = {
  get value() {
    return state.token
  },
  set value(v) {
    state.token = v ? 'cookie' : ''
    if (v) sessionStorage.setItem('maxlabel_cloud_authenticated', '1')
    else sessionStorage.removeItem('maxlabel_cloud_authenticated')
  }
}

export function setSession(tk, email, role) {
  state.token = tk || 'cookie'
  state.email = email
  state.role = role || 'user'
  sessionStorage.setItem('maxlabel_cloud_authenticated', '1')
  sessionStorage.setItem('maxlabel_cloud_email', email)
  sessionStorage.setItem('maxlabel_cloud_role', state.role)
}

export function setRole(role) {
  state.role = role || 'user'
  sessionStorage.setItem('maxlabel_cloud_role', state.role)
}

export function clearSession() {
  state.token = ''
  state.email = ''
  state.role = ''
  sessionStorage.removeItem('maxlabel_cloud_authenticated')
  sessionStorage.removeItem('maxlabel_cloud_email')
  sessionStorage.removeItem('maxlabel_cloud_role')
}
