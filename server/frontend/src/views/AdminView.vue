<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'
import { setRole } from '../store'

const tab = ref('licenses')
const stats = ref(null)
const licenses = ref([])
const users = ref([])
const templates = ref([])
const err = ref('')
const ok = ref('')

// 生成密钥表单
const gen = ref({ edition: 'pro', days: 365, permanent: false, holder: '' })
const genBusy = ref(false)

function fmtTime(s) {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d) ? s.slice(0, 10) : d.toLocaleString('zh-CN', { hour12: false }).slice(0, 16)
}
function expText(r) {
  if (!r.expires_at) return '永久'
  return fmtTime(r.expires_at)
}

async function loadAll() {
  err.value = ''
  ok.value = ''
  try {
    const [st, ls, us, ts] = await Promise.all([
      api.adminStats(), api.adminLicenses(), api.adminUsers(), api.adminTemplates()
    ])
    stats.value = st
    licenses.value = ls
    users.value = us
    templates.value = ts
  } catch (e) {
    err.value = e.message
  }
}

async function createLicense() {
  genBusy.value = true
  err.value = ''
  ok.value = ''
  try {
    await api.adminCreateLicense({
      edition: gen.value.edition,
      days: gen.value.permanent ? 36500 : Number(gen.value.days) || 365,
      permanent: gen.value.permanent,
      holder: gen.value.holder.trim()
    })
    gen.value.holder = ''
    await loadAll()
    ok.value = '密钥已生成，请复制发给客户'
  } catch (e) {
    err.value = e.message
  } finally {
    genBusy.value = false
  }
}

async function revoke(key) {
  if (!confirm('确定撤销密钥 ' + key + ' ？撤销后该客户将无法继续使用（激活状态立即失效）。')) return
  err.value = ''
  try {
    await api.adminRevokeLicense(key)
    await loadAll()
    ok.value = '已撤销 ' + key
  } catch (e) {
    err.value = e.message
  }
}

async function toggleRole(u) {
  const next = u.role === 'admin' ? 'user' : 'admin'
  if (u.role === 'admin' && !confirm('将 ' + u.email + ' 降为普通用户？')) return
  try {
    await api.adminSetRole(u.id, next)
    setRole(await (await api.me()).role)
    await loadAll()
  } catch (e) {
    err.value = e.message
  }
}

async function delTemplate(t) {
  if (!confirm('确定删除模板「' + t.name + '」？')) return
  try {
    await api.adminDeleteTemplate(t.id)
    await loadAll()
    ok.value = '已删除模板'
  } catch (e) {
    err.value = e.message
  }
}

function copyKey(k) {
  navigator.clipboard?.writeText(k).then(() => {
    ok.value = '已复制：' + k
  })
}

onMounted(loadAll)
</script>

<template>
  <div>
    <div class="head">
      <h2>管理后台</h2>
      <button class="btn" @click="loadAll">刷新</button>
    </div>
    <div class="err" v-if="err">{{ err }}</div>
    <div class="ok" v-if="ok">{{ ok }}</div>

    <div v-if="stats" class="cards">
      <div class="card stat"><div class="n">{{ stats.users }}</div><div class="l">注册用户</div></div>
      <div class="card stat"><div class="n">{{ stats.licenses }}</div><div class="l">授权密钥（共）</div></div>
      <div class="card stat"><div class="n">{{ stats.licenses_active }}</div><div class="l">有效密钥</div></div>
      <div class="card stat"><div class="n">{{ stats.templates }}</div><div class="l">云端模板</div></div>
      <div class="card stat"><div class="n">{{ stats.activations }}</div><div class="l">激活次数</div></div>
    </div>

    <div class="tabs">
      <button :class="['tab', tab === 'licenses' ? 'on' : '']" @click="tab = 'licenses'">授权密钥</button>
      <button :class="['tab', tab === 'users' ? 'on' : '']" @click="tab = 'users'">用户管理</button>
      <button :class="['tab', tab === 'templates' ? 'on' : '']" @click="tab = 'templates'">云模板</button>
    </div>

    <!-- 授权密钥 -->
    <div v-if="tab === 'licenses'">
      <div class="card gen">
        <h3>生成授权密钥</h3>
        <div class="gen-row">
          <label>版本
            <select class="input" v-model="gen.edition" style="width:130px">
              <option value="pro">专业版</option>
              <option value="enterprise">企业版</option>
            </select>
          </label>
          <label>时长
            <select class="input" v-model="gen.days" style="width:130px" :disabled="gen.permanent">
              <option :value="30">30 天</option>
              <option :value="90">90 天</option>
              <option :value="180">180 天</option>
              <option :value="365">1 年</option>
              <option :value="730">2 年</option>
              <option :value="3650">10 年</option>
            </select>
          </label>
          <label class="perm"><input type="checkbox" v-model="gen.permanent" /> 永久</label>
          <label class="holder">持有人/客户名
            <input class="input" v-model="gen.holder" placeholder="如：某某公司" style="width:180px" />
          </label>
          <button class="btn btn-primary" :disabled="genBusy" @click="createLicense">{{ genBusy ? '生成中…' : '生成密钥' }}</button>
        </div>
      </div>

      <div class="card">
        <table class="tbl">
          <thead>
            <tr><th>密钥</th><th>版本</th><th>状态</th><th>持有人</th><th>机器码</th><th>到期</th><th>激活时间</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in licenses" :key="r.id">
              <td class="mono"><span class="key">{{ r.key }}</span><button class="mini" @click="copyKey(r.key)">复制</button></td>
              <td>{{ r.edition === 'enterprise' ? '企业版' : '专业版' }}</td>
              <td><span :class="['badge', r.status === 'active' ? 'on' : 'off']">{{ r.status === 'active' ? '有效' : '已撤销' }}</span></td>
              <td>{{ r.holder || '—' }}</td>
              <td class="mono dim">{{ r.machine_id || '未激活' }}</td>
              <td>{{ expText(r) }}</td>
              <td class="dim">{{ r.activated_at ? fmtTime(r.activated_at) : '—' }}</td>
              <td>
                <button v-if="r.status === 'active'" class="btn btn-danger btn-sm" @click="revoke(r.key)">撤销</button>
              </td>
            </tr>
            <tr v-if="!licenses.length"><td colspan="8" class="empty">暂无密钥，先生成一个</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 用户管理 -->
    <div v-if="tab === 'users'">
      <div class="card">
        <table class="tbl">
          <thead>
            <tr><th>邮箱</th><th>角色</th><th>云端模板数</th><th>注册时间</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td>{{ u.email }}</td>
              <td><span :class="['badge', u.role === 'admin' ? 'adm' : '']">{{ u.role === 'admin' ? '管理员' : '普通用户' }}</span></td>
              <td>{{ u.template_count }}</td>
              <td class="dim">{{ fmtTime(u.created_at) }}</td>
              <td>
                <button class="btn btn-sm" @click="toggleRole(u)">{{ u.role === 'admin' ? '降为普通用户' : '设为管理员' }}</button>
              </td>
            </tr>
            <tr v-if="!users.length"><td colspan="5" class="empty">暂无用户</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 云模板 -->
    <div v-if="tab === 'templates'">
      <div class="card">
        <table class="tbl">
          <thead>
            <tr><th>模板名</th><th>所属用户</th><th>更新时间</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="t in templates" :key="t.id">
              <td>{{ t.name }}</td>
              <td>{{ t.user_email }}</td>
              <td class="dim">{{ fmtTime(t.updated_at) }}</td>
              <td><button class="btn btn-danger btn-sm" @click="delTemplate(t)">删除</button></td>
            </tr>
            <tr v-if="!templates.length"><td colspan="4" class="empty">暂无云模板</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.head h2 { margin: 0; font-size: 18px; }
.cards { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.stat { flex: 1 1 140px; padding: 14px 16px; text-align: center; }
.stat .n { font-size: 24px; font-weight: 700; color: var(--accent-dark); }
.stat .l { font-size: 12px; color: var(--muted); margin-top: 2px; }
.tabs { display: flex; gap: 4px; margin-bottom: 14px; border-bottom: 1px solid var(--line); }
.tab { padding: 9px 18px; border: none; background: none; cursor: pointer; font-size: 14px; color: var(--muted); font-family: inherit; border-bottom: 2px solid transparent; }
.tab.on { color: var(--accent-dark); font-weight: 600; border-bottom-color: var(--accent); }
.gen { padding: 14px 16px; margin-bottom: 14px; }
.gen h3 { margin: 0 0 12px; font-size: 14px; color: var(--text); }
.gen-row { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end; }
.gen-row label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
.perm { flex-direction: row !important; align-items: center; padding-bottom: 10px; }
.perm input { width: 16px; height: 16px; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th { text-align: left; padding: 10px 12px; color: var(--muted); font-weight: 500; border-bottom: 1px solid var(--line); white-space: nowrap; }
.tbl td { padding: 9px 12px; border-bottom: 1px solid #f0f3f6; }
.tbl tr:hover td { background: #fafcfe; }
.mono { font-family: Consolas, monospace; font-size: 12.5px; }
.dim { color: var(--muted); font-size: 12.5px; }
.key { margin-right: 8px; }
.mini { border: 1px solid var(--line); background: #fff; border-radius: 5px; font-size: 11px; padding: 2px 7px; cursor: pointer; color: var(--accent-dark); }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.badge { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 12px; }
.badge.on { background: #eefaf1; color: #1d8a43; }
.badge.off { background: #fdf3f3; color: #c0392b; }
.badge.adm { background: rgba(34, 189, 237, 0.14); color: var(--accent-dark); }
.empty { text-align: center; color: var(--muted); padding: 24px !important; }
</style>
