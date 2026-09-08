<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'

const list = ref([])
const err = ref('')
const ok = ref('')
const busy = ref(false)
const name = ref('')
const jsonText = ref('')
const detail = ref(null)

async function refresh() {
  try {
    list.value = await api.listTemplates()
  } catch (e) {
    err.value = e.message
  }
}

onMounted(refresh)

async function save() {
  err.value = ''
  ok.value = ''
  if (!name.value.trim()) {
    err.value = '请输入模板名称'
    return
  }
  busy.value = true
  try {
    await api.saveTemplate(name.value.trim(), jsonText.value)
    ok.value = '已保存到云端'
    name.value = ''
    jsonText.value = ''
    await refresh()
  } catch (e) {
    err.value = e.message
  } finally {
    busy.value = false
  }
}

async function load(t) {
  err.value = ''
  try {
    detail.value = await api.loadTemplate(t.id)
  } catch (e) {
    err.value = e.message
  }
}

async function remove(t) {
  err.value = ''
  if (!window.confirm('确定删除模板「' + t.name + '」？')) return
  try {
    await api.deleteTemplate(t.id)
    ok.value = '已删除'
    if (detail.value && detail.value.id === t.id) detail.value = null
    await refresh()
  } catch (e) {
    err.value = e.message
  }
}

function fmt(iso) {
  return iso ? iso.replace('T', ' ').slice(0, 16) : ''
}
</script>

<template>
  <div>
    <h2>云标签模板库</h2>
    <div class="err" v-if="err">{{ err }}</div>
    <div class="ok" v-if="ok">{{ ok }}</div>

    <div class="card box">
      <h3>上传 / 保存模板</h3>
      <div class="field">
        <label>模板名称</label>
        <input class="input" v-model="name" placeholder="例如：快递面单 100x150" />
      </div>
      <div class="field">
        <label>模板内容（JSON）</label>
        <textarea class="input ta" v-model="jsonText" rows="4" placeholder='粘贴标签 JSON 内容，或留空仅保存名称'></textarea>
      </div>
      <button class="btn btn-primary" :disabled="busy" @click="save">{{ busy ? '保存中…' : '保存到云端' }}</button>
    </div>

    <div class="card box" style="margin-top: 18px">
      <h3>我的云端模板（{{ list.length }}）</h3>
      <div v-if="!list.length" class="empty">暂无云端模板，先保存一个吧</div>
      <table v-else class="tbl">
        <thead>
          <tr><th>名称</th><th>更新时间</th><th style="width: 180px">操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="t in list" :key="t.id">
            <td>{{ t.name }}</td>
            <td class="muted">{{ fmt(t.updated_at) }}</td>
            <td>
              <button class="btn sm" @click="load(t)">查看</button>
              <button class="btn sm danger" @click="remove(t)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card box" style="margin-top: 18px" v-if="detail">
      <h3>模板内容：{{ detail.name }}</h3>
      <pre class="pre">{{ detail.data }}</pre>
    </div>
  </div>
</template>

<style scoped>
h2 { margin: 0 0 16px; font-size: 18px; }
h3 { margin: 0 0 12px; font-size: 15px; }
.box { padding: 24px; }
.ta { resize: vertical; font-family: Consolas, monospace; font-size: 13px; }
.empty { color: var(--muted); padding: 18px 0; text-align: center; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th, .tbl td { text-align: left; padding: 9px 8px; border-bottom: 1px solid var(--line); font-size: 13px; }
.tbl th { color: var(--muted); font-weight: 500; }
.muted { color: var(--muted); }
.sm { padding: 4px 12px; font-size: 13px; margin-right: 6px; }
.pre {
  background: #f7f9fb; border: 1px solid var(--line); border-radius: 8px;
  padding: 12px; max-height: 320px; overflow: auto; font-size: 12px;
  font-family: Consolas, monospace; white-space: pre-wrap; word-break: break-all;
}
</style>
