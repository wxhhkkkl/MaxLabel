<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'
import { state, clearSession } from '../store'
import { useRouter } from 'vue-router'

const router = useRouter()
const me = ref(null)
const oldPwd = ref('')
const newPwd = ref('')
const err = ref('')
const ok = ref('')
const busy = ref(false)

onMounted(async () => {
  try {
    me.value = await api.me()
  } catch (e) {
    err.value = e.message
  }
})

async function changePwd() {
  err.value = ''
  ok.value = ''
  if (!oldPwd.value || !newPwd.value) {
    err.value = '请输入原密码和新密码'
    return
  }
  busy.value = true
  try {
    await api.changePassword(oldPwd.value, newPwd.value)
    ok.value = '密码已修改，请重新登录'
    clearSession()
    router.push({ name: 'login' })
  } catch (e) {
    err.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <h2>账户中心</h2>
    <div class="card box">
      <div class="err" v-if="err">{{ err }}</div>
      <div class="ok" v-if="ok">{{ ok }}</div>
      <div class="row">
        <span class="k">登录邮箱</span>
        <span class="v">{{ state.email }}</span>
      </div>
      <div class="row">
        <span class="k">注册时间</span>
        <span class="v">{{ me?.created_at?.slice(0, 10) || '—' }}</span>
      </div>
      <hr class="sep" />
      <h3>修改密码</h3>
      <div class="field">
        <label>原密码</label>
        <input class="input" type="password" v-model="oldPwd" />
      </div>
      <div class="field">
        <label>新密码</label>
        <input class="input" type="password" v-model="newPwd" placeholder="至少 6 位" />
      </div>
      <button class="btn btn-primary" :disabled="busy" @click="changePwd">{{ busy ? '请稍候…' : '修改密码' }}</button>
    </div>
  </div>
</template>

<style scoped>
h2 { margin: 0 0 16px; font-size: 18px; }
h3 { margin: 0 0 12px; font-size: 15px; }
.box { padding: 24px; max-width: 460px; }
.row { display: flex; padding: 8px 0; }
.k { width: 110px; color: var(--muted); }
.sep { border: none; border-top: 1px solid var(--line); margin: 18px 0; }
</style>
