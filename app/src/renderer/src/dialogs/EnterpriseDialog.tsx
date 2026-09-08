import { useEffect, useState } from 'react'
import Modal from './Modal'

interface Props {
  docName: string
  docJson: string
  onClose: () => void
  onLoad: (json: string) => void
}

interface SharedTemplate {
  id: string
  name: string
  updatedAt: string
  author: string
}

type Role = 'admin' | 'operator' | 'viewer'

const ROLE_LABEL: Record<Role, string> = { admin: '管理员', operator: '操作员', viewer: '查看者' }

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 9px',
  border: '1px solid #D5D4CD',
  borderRadius: 6,
  fontSize: 13,
  boxSizing: 'border-box',
  fontFamily: 'inherit'
}

export default function EnterpriseDialog({ docName, docJson, onClose, onLoad }: Props) {
  const [role, setRole] = useState<Role>('admin')
  const [user, setUser] = useState('管理员')
  const [users, setUsers] = useState<Record<string, string>>({})
  const [list, setList] = useState<SharedTemplate[]>([])
  const [msg, setMsg] = useState('')
  const [log, setLog] = useState<{ total: number; byDate: Array<{ date: string; count: number }>; byMode: Array<{ mode: string; count: number }>; last: unknown } | null>(null)
  const [tab, setTab] = useState<'tpl' | 'role' | 'log'>('tpl')

  const refresh = async () => {
    const s = await window.maxlabel.enterprise.status()
    if (s.ok) {
      setRole(s.role)
      setUser(s.user)
      setUsers(s.users)
    }
    const l = await window.maxlabel.enterprise.list()
    if (l.ok) setList(l.templates)
    const lg = await window.maxlabel.enterprise.logSummary()
    if (lg.ok) setLog(lg)
  }

  useEffect(() => {
    refresh()
  }, [])

  const doPublish = async () => {
    const r = await window.maxlabel.enterprise.publish(docName || '未命名模板', docJson, user)
    setMsg(r.ok ? '已发布到共享模板库' : (r.error ?? '发布失败'))
    refresh()
  }

  const doLoad = async (id: string) => {
    const r = await window.maxlabel.enterprise.load(id)
    if (r.ok && r.data) {
      onLoad(r.data.json)
      setMsg(`已加载共享模板：${r.data.name}`)
    } else setMsg(r.error ?? '加载失败')
  }

  const doDelete = async (id: string) => {
    const r = await window.maxlabel.enterprise.delete(id)
    setMsg(r.ok ? '已删除（管理员操作）' : (r.error ?? '删除失败'))
    refresh()
  }

  const doSetRole = async () => {
    const r = await window.maxlabel.enterprise.setRole(role, user)
    setMsg(r.ok ? `已切换角色：${ROLE_LABEL[role]}` : (r.error ?? '设置失败'))
    refresh()
  }

  const canEdit = role !== 'viewer'
  const canAdmin = role === 'admin'

  return (
    <Modal
      title="企业版（模板管理 / 权限 / 日志）"
      onClose={onClose}
      width={680}
      footer={
        <button type="button" onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
          关闭
        </button>
      }
    >
      <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, marginBottom: 12 }}>
        企业版对标原版"标签管理服务器 + 权限 + 模板分发"。当前为单机模拟：共享库与角色落盘本机（生产环境替换为真实服务端：模板分发 + 日志上报 + 权限中心）。当前角色：<b>{ROLE_LABEL[role]}</b>
        {!canEdit && '（查看者：仅可查看/打印，不能发布/编辑/删除）'}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(['tpl', 'role', 'log'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              border: '1px solid #D5D4CD',
              background: tab === t ? '#2E6E93' : '#fff',
              color: tab === t ? '#fff' : '#1A1B1C',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600
            }}
          >
            {t === 'tpl' ? '共享模板库' : t === 'role' ? '权限与用户' : '日志聚合'}
          </button>
        ))}
      </div>

      {tab === 'tpl' && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <button type="button" onClick={doPublish} disabled={!canEdit} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #2E6E93', background: canEdit ? '#2E6E93' : '#9AA0A6', color: '#fff', cursor: canEdit ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}>
              发布当前模板到共享库
            </button>
            <span style={{ fontSize: 12, color: '#6B7280' }}>共享模板随版本分发，团队成员可加载使用。</span>
          </div>
          {list.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9CA3AF', padding: '20px 0', textAlign: 'center' }}>共享模板库为空</div>
          ) : (
            list.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #F0EFEA' }}>
                <div style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.name}
                  <span style={{ color: '#9AA0A6', fontSize: 11, marginLeft: 8 }}>作者：{t.author} · {new Date(t.updatedAt).toLocaleString()}</span>
                </div>
                <button type="button" onClick={() => doLoad(t.id)} style={{ fontSize: 12, color: '#2E6E93', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>
                  加载
                </button>
                {canAdmin && (
                  <button type="button" onClick={() => doDelete(t.id)} style={{ fontSize: 12, color: '#EA6668', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>
                    删除
                  </button>
                )}
              </div>
            ))
          )}
        </>
      )}

      {tab === 'role' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>当前用户</div>
              <input value={user} onChange={(e) => setUser(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>角色</div>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} style={inputStyle}>
                <option value="admin">管理员（全部权限）</option>
                <option value="operator">操作员（可发布/打印，不可管理）</option>
                <option value="viewer">查看者（只读）</option>
              </select>
            </div>
          </div>
          <button type="button" onClick={doSetRole} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            保存角色
          </button>
          <div style={{ marginTop: 12, fontSize: 12, color: '#6B7280' }}>
            已登记用户：
            {Object.entries(users).map(([u, r]) => (
              <span key={u} style={{ marginLeft: 8 }}>{u}（{ROLE_LABEL[r as Role] ?? r}）</span>
            ))}
            <div style={{ marginTop: 6, color: '#9AA0A6' }}>
              说明：切换为"查看者"后，发布/编辑/删除操作将被禁用（编辑器内的保存由角色门控，生产环境由服务端校验）。
            </div>
          </div>
        </>
      )}

      {tab === 'log' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 120px', padding: 10, borderRadius: 10, background: '#F4F3EE', border: '1px solid #E4E3DD' }}>
              <div style={{ fontSize: 12, color: '#6B7280' }}>累计打印（本地日志）</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: '#1A1B1C' }}>{log?.total ?? 0}</div>
            </div>
            <div style={{ flex: '1 1 160px', padding: 10, borderRadius: 10, background: '#F4F3EE', border: '1px solid #E4E3DD' }}>
              <div style={{ fontSize: 12, color: '#6B7280' }}>按方式</div>
              <div style={{ fontSize: 13, color: '#1A1B1C', marginTop: 4 }}>
                {(log?.byMode ?? []).map((m) => `${m.mode}=${m.count}`).join('、') || '—'}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>按日期</div>
          {(log?.byDate ?? []).length === 0 ? (
            <div style={{ fontSize: 13, color: '#9CA3AF', padding: '12px 0' }}>暂无打印记录（正式打印后产生）</div>
          ) : (
            <div>
              {(log?.byDate ?? []).map((d) => (
                <div key={d.date} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 13 }}>
                  <span style={{ width: 90 }}>{d.date}</span>
                  <span style={{ fontWeight: 600 }}>{d.count} 次</span>
                  <div style={{ flex: 1, height: 8, background: '#EEEDE8', borderRadius: 4, alignSelf: 'center' }}>
                    <div style={{ height: 8, width: `${Math.min(100, (d.count / Math.max(1, log!.total)) * 100)}%`, background: '#8BC8EA', borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {msg && <div style={{ marginTop: 10, fontSize: 12, color: msg.includes('成功') || msg.startsWith('已') ? '#2E7D32' : '#C0392B' }}>{msg}</div>}
    </Modal>
  )
}
