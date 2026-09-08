// ---------- 企业版脚手架（对标原版企业版） ----------
// 模板集中管理（共享库）、权限（管理员/操作员/查看者）、打印日志聚合。
// 单机模拟"标签管理服务器"：共享库与权限落盘 userData/enterprise-store.json；
// 生产环境可将 store 换成真实服务端 API（模板分发 + 日志上报 + 权限中心）。
import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

export type EnterpriseRole = 'admin' | 'operator' | 'viewer'

export interface EnterpriseTemplate {
  id: string
  name: string
  json: string
  updatedAt: string
  author: string
}

interface EnterpriseStore {
  currentRole: EnterpriseRole
  currentUser: string
  users: Record<string, EnterpriseRole>
  templates: EnterpriseTemplate[]
}

function storePath(): string {
  return join(app.getPath('userData'), 'enterprise-store.json')
}

async function loadStore(): Promise<EnterpriseStore> {
  try {
    const raw = await readFile(storePath(), 'utf-8')
    const s = JSON.parse(raw) as EnterpriseStore
    if (!s.templates || !s.users || !s.currentRole) throw new Error('bad store')
    return s
  } catch {
    return {
      currentRole: 'admin',
      currentUser: '管理员',
      users: { '管理员': 'admin' },
      templates: []
    }
  }
}

async function saveStore(store: EnterpriseStore): Promise<void> {
  await writeFile(storePath(), JSON.stringify(store, null, 2), 'utf-8')
}

export async function enterpriseStatus(): Promise<{ ok: boolean; role: EnterpriseRole; user: string; users: Record<string, EnterpriseRole>; templateCount: number }> {
  const s = await loadStore()
  return { ok: true, role: s.currentRole, user: s.currentUser, users: s.users, templateCount: s.templates.length }
}

export async function enterpriseSetRole(role: EnterpriseRole, user: string): Promise<{ ok: boolean; error?: string }> {
  if (!['admin', 'operator', 'viewer'].includes(role)) return { ok: false, error: '无效角色' }
  const s = await loadStore()
  s.currentRole = role
  s.currentUser = user
  if (s.users[user] !== role) s.users[user] = role
  await saveStore(s)
  return { ok: true }
}

export async function enterpriseListTemplates(): Promise<{ ok: boolean; templates: EnterpriseTemplate[] }> {
  const s = await loadStore()
  return { ok: true, templates: s.templates }
}

export async function enterprisePublishTemplate(name: string, json: string, author: string): Promise<{ ok: boolean; error?: string; id?: string }> {
  const s = await loadStore()
  if (s.currentRole === 'viewer') return { ok: false, error: '查看者无权发布模板' }
  const clean = String(name || '未命名模板')
  const existing = s.templates.find((t) => t.name === clean)
  if (existing) {
    existing.json = json
    existing.updatedAt = new Date().toISOString()
    existing.author = author
    await saveStore(s)
    return { ok: true, id: existing.id }
  }
  const t: EnterpriseTemplate = { id: randomUUID(), name: clean, json, updatedAt: new Date().toISOString(), author }
  s.templates.push(t)
  await saveStore(s)
  return { ok: true, id: t.id }
}

export async function enterpriseLoadTemplate(id: string): Promise<{ ok: boolean; error?: string; data?: { name: string; json: string } }> {
  const s = await loadStore()
  const t = s.templates.find((x) => x.id === id)
  if (!t) return { ok: false, error: '模板不存在' }
  return { ok: true, data: { name: t.name, json: t.json } }
}

export async function enterpriseDeleteTemplate(id: string): Promise<{ ok: boolean; error?: string }> {
  const s = await loadStore()
  if (s.currentRole === 'viewer' || s.currentRole === 'operator') return { ok: false, error: '仅管理员可删除共享模板' }
  s.templates = s.templates.filter((t) => t.id !== id)
  await saveStore(s)
  return { ok: true }
}

/** 读取本地打印日志（JSONL）并按维度聚合，模拟"服务器日志聚合" */
export async function enterpriseLogSummary(): Promise<{
  ok: boolean
  total: number
  byDate: Array<{ date: string; count: number }>
  byMode: Array<{ mode: string; count: number }>
  last: unknown
}> {
  const logPath = join(app.getPath('userData'), 'print-log.jsonl')
  let lines: string[] = []
  try {
    const raw = await readFile(logPath, 'utf-8')
    lines = raw.split('\n').filter((l) => l.trim().length > 0)
  } catch {
    lines = []
  }
  const entries = lines.map((l) => {
    try {
      return JSON.parse(l) as Record<string, unknown>
    } catch {
      return null
    }
  }).filter((x): x is Record<string, unknown> => x !== null)

  const byDateMap = new Map<string, number>()
  const byModeMap = new Map<string, number>()
  for (const e of entries) {
    const ts = String(e.ts ?? '')
    const date = ts.slice(0, 10) || '未知'
    byDateMap.set(date, (byDateMap.get(date) ?? 0) + 1)
    const mode = String(e.mode ?? '未知')
    byModeMap.set(mode, (byModeMap.get(mode) ?? 0) + 1)
  }
  const byDate = [...byDateMap.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => (a.date < b.date ? 1 : -1))
  const byMode = [...byModeMap.entries()].map(([mode, count]) => ({ mode, count }))
  return { ok: true, total: entries.length, byDate, byMode, last: entries[entries.length - 1] ?? null }
}
