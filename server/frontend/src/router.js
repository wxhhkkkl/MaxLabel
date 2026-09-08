import { createRouter, createWebHistory } from 'vue-router'
import { state, token } from './store'

const routes = [
  { path: '/', name: 'login', component: () => import('./views/LoginView.vue') },
  { path: '/account', name: 'account', component: () => import('./views/AccountView.vue'), meta: { auth: true } },
  { path: '/cloud', name: 'cloud', component: () => import('./views/CloudView.vue'), meta: { auth: true } },
  { path: '/admin', name: 'admin', component: () => import('./views/AdminView.vue'), meta: { auth: true, admin: true } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to) => {
  if (to.meta.auth && !token.value) return { name: 'login' }
  if (to.meta.admin && state.role !== 'admin') return { name: 'cloud' }
  if (to.name === 'login' && token.value) return { name: 'cloud' }
  return true
})

export default router
