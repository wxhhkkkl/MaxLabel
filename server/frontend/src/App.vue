<script setup>
import { onMounted } from 'vue'
import { state, clearSession, setRole } from './store'
import { api } from './api'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

onMounted(async () => {
  if (!state.token) return
  try {
    const me = await api.me()
    state.email = me.email
    setRole(me.role)
  } catch (error) {
    if (error?.status === 401) {
      clearSession()
      if (route.meta.auth) router.replace({ name: 'login' })
    }
  }
})

async function logout() {
  try { await api.logout() } catch { /* 即使服务暂时不可达，也要清理本地会话状态。 */ }
  clearSession()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand">☁ MaxLabel 云服务</div>
      <nav v-if="state.token" class="nav">
        <RouterLink to="/cloud" :class="{ active: route.name === 'cloud' }">云服务</RouterLink>
        <RouterLink to="/account" :class="{ active: route.name === 'account' }">账户</RouterLink>
        <RouterLink v-if="state.role === 'admin'" to="/admin" :class="{ active: route.name === 'admin' }">管理后台</RouterLink>
        <span class="who">{{ state.email }}{{ state.role === 'admin' ? '（管理员）' : '' }}</span>
        <button class="btn btn-ghost" @click="logout">退出登录</button>
      </nav>
    </header>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.shell { min-height: 100vh; display: flex; flex-direction: column; }
.topbar {
  display: flex; align-items: center; gap: 24px;
  background: #fff; border-bottom: 1px solid var(--line);
  padding: 0 24px; height: 52px;
}
.brand { font-weight: 600; font-size: 15px; color: var(--accent-dark); }
.nav { display: flex; align-items: center; gap: 6px; flex: 1; }
.nav a {
  padding: 6px 14px; border-radius: 8px; color: var(--text);
  text-decoration: none; font-size: 14px;
}
.nav a:hover { background: #f2f6fa; }
.nav a.active { background: rgba(34, 189, 237, 0.14); color: var(--accent-dark); font-weight: 600; }
.who { margin-left: auto; color: var(--muted); font-size: 13px; }
.btn-ghost { border: none; background: none; color: var(--muted); padding: 6px 10px; }
.btn-ghost:hover { background: #f2f6fa; }
.content { flex: 1; padding: 24px; max-width: 960px; width: 100%; margin: 0 auto; }
</style>
