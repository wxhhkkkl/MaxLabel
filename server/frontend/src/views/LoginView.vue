<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { setSession } from '../store'

const router = useRouter()
const mode = ref('login')
const email = ref('')
const password = ref('')
const confirm = ref('')
const err = ref('')
const busy = ref(false)

async function submit() {
  err.value = ''
  if (!email.value || !password.value) {
    err.value = '请输入邮箱和密码'
    return
  }
  if (mode.value === 'register' && password.value !== confirm.value) {
    err.value = '两次输入的密码不一致'
    return
  }
  busy.value = true
  try {
    const r = mode.value === 'login'
      ? await api.login(email.value.trim(), password.value)
      : await api.register(email.value.trim(), password.value)
    setSession(r.token, r.email, '')
    // 登录后拉取资料，获取角色（管理员可进入管理后台）
    try {
      const me = await api.me()
      setSession(r.token, me.email, me.role)
    } catch {
      /* 角色拉取失败不阻塞登录 */
    }
    router.push({ name: 'cloud' })
  } catch (e) {
    err.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="login-wrap">
    <div class="card login-card">
      <div class="logo">☁</div>
      <h1>MaxLabel 云服务</h1>
      <p class="sub">登录后可云端保存标签模板、同步账户资料</p>
      <div class="tabs">
        <button :class="['tab', mode === 'login' ? 'on' : '']" @click="mode = 'login'">登录</button>
        <button :class="['tab', mode === 'register' ? 'on' : '']" @click="mode = 'register'">注册</button>
      </div>
      <div class="err" v-if="err">{{ err }}</div>
      <div class="field">
        <label>邮箱</label>
        <input class="input" type="email" v-model="email" placeholder="you@example.com" />
      </div>
      <div class="field">
        <label>密码</label>
        <input class="input" type="password" v-model="password" maxlength="128" placeholder="6-128 位" @keyup.enter="submit" />
      </div>
      <div class="field" v-if="mode === 'register'">
        <label>确认密码</label>
        <input class="input" type="password" v-model="confirm" placeholder="再次输入密码" @keyup.enter="submit" />
      </div>
      <button class="btn btn-primary btn-block" :disabled="busy" @click="submit">
        {{ busy ? '请稍候…' : mode === 'login' ? '登 录' : '注 册' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.login-wrap {
  min-height: calc(100vh - 52px);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.login-card { width: 380px; padding: 32px 28px; }
.logo { font-size: 40px; text-align: center; }
h1 { text-align: center; font-size: 20px; margin: 8px 0 4px; }
.sub { text-align: center; color: var(--muted); font-size: 13px; margin: 0 0 18px; }
.tabs { display: flex; margin-bottom: 16px; background: #eef2f6; border-radius: 8px; padding: 3px; }
.tab {
  flex: 1; padding: 7px 0; border: none; background: none; border-radius: 6px;
  cursor: pointer; font-size: 14px; color: var(--muted); font-family: inherit;
}
.tab.on { background: #fff; color: var(--text); font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
.btn-block { width: 100%; margin-top: 6px; }
</style>
