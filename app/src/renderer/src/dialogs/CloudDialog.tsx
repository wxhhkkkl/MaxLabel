import { useCallback, useEffect, useRef, useState } from 'react'
import type { LabelDoc } from '../types'
import { toMsdx } from '../io/msdx'
import Modal from './Modal'

interface Props {
  doc: LabelDoc
  serverUrl?: string
  onClose: () => void
  onLoad: (json: string) => void
}

interface CloudTemplate {
  id: string
  name: string
  updatedAt: string
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 9px',
  border: '1px solid #D5D4CD',
  borderRadius: 6,
  fontSize: 13,
  boxSizing: 'border-box',
  fontFamily: 'inherit'
}

export default function CloudDialog({ doc, serverUrl = '', onClose, onLoad }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [account, setAccount] = useState<string | null>(null)
  const [list, setList] = useState<CloudTemplate[]>([])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [saveName, setSaveName] = useState(doc.name || '未命名模板')
  const requestEpoch = useRef(0)

  useEffect(() => {
    let live = true
    const epoch = ++requestEpoch.current
    setToken(null)
    setAccount(null)
    setList([])
    void window.maxlabel.cloudCredentials.load(serverUrl).then((r) => {
      if (live && epoch === requestEpoch.current && r.ok && r.token && r.email) {
        setToken(r.token)
        setAccount(r.email)
      } else if (live && epoch === requestEpoch.current && !r.ok) {
        setMsg(r.error ?? '读取云端登录凭据失败')
      }
    }).catch((error) => { if (live && epoch === requestEpoch.current) setMsg('读取云端登录凭据失败：' + (error instanceof Error ? error.message : String(error))) })
    return () => { live = false }
  }, [serverUrl])

  const refresh = useCallback(
    async (tk: string) => {
      const epoch = requestEpoch.current
      try {
        const r = await window.maxlabel.cloud.list(serverUrl, tk)
        if (epoch !== requestEpoch.current) return
        if (r.ok && r.data) setList(r.data)
        else setMsg(r.error ?? '加载云端列表失败')
      } catch (error) {
        if (epoch === requestEpoch.current) setMsg('加载云端列表失败：' + (error instanceof Error ? error.message : String(error)))
      }
    },
    [serverUrl]
  )

  useEffect(() => {
    if (token) {
      refresh(token)
    }
  }, [token, refresh])

  const doAuth = async (mode: 'register' | 'login') => {
    setBusy(true)
    setMsg('')
    const epoch = requestEpoch.current
    try {
      const r = mode === 'register' ? await window.maxlabel.cloud.register(serverUrl, email, password) : await window.maxlabel.cloud.login(serverUrl, email, password)
      if (epoch !== requestEpoch.current) return
      if (r.ok && r.data) {
        setToken(r.data.token)
        setAccount(r.data.email)
        const stored = await window.maxlabel.cloudCredentials.save(serverUrl, r.data.token, r.data.email)
        if (epoch !== requestEpoch.current) return
        if (!stored.ok) setMsg('登录成功，但凭据保存失败：' + (stored.error ?? '未知错误'))
        else setMsg(mode === 'register' ? '注册成功，已登录' : '登录成功')
        await refresh(r.data.token)
      } else {
        setMsg(r.error ?? (mode === 'register' ? '注册失败' : '登录失败'))
      }
    } catch (error) {
      if (epoch === requestEpoch.current) setMsg((mode === 'register' ? '注册失败：' : '登录失败：') + (error instanceof Error ? error.message : String(error)))
    } finally {
      if (epoch === requestEpoch.current) setBusy(false)
    }
  }

  const doLogout = async () => {
    ++requestEpoch.current
    const currentToken = token
    try {
      if (currentToken) {
        const result = await window.maxlabel.cloud.logout(serverUrl, currentToken)
        if (!result.ok) setMsg(result.error ?? '云端退出失败')
      }
    } catch (error) {
      setMsg('云端退出失败：' + (error instanceof Error ? error.message : String(error)))
    }
    setToken(null)
    setAccount(null)
    try {
      const result = await window.maxlabel.cloudCredentials.clear(serverUrl)
      if (!result.ok) setMsg(result.error ?? '退出登录后清理凭据失败')
    } catch (error) {
      setMsg('退出登录后清理凭据失败：' + (error instanceof Error ? error.message : String(error)))
    }
    setList([])
  }

  const doSave = async () => {
    if (!token) return
    setBusy(true)
    setMsg('')
    const epoch = requestEpoch.current
    try {
      const r = await window.maxlabel.cloud.save(serverUrl, token, saveName, toMsdx(doc))
      if (epoch !== requestEpoch.current) return
      if (r.ok) {
        setMsg('已保存到云端（用户库）')
        await refresh(token)
      } else {
        setMsg(r.error ?? '保存失败')
      }
    } catch (error) {
      if (epoch === requestEpoch.current) setMsg('保存失败：' + (error instanceof Error ? error.message : String(error)))
    } finally {
      if (epoch === requestEpoch.current) setBusy(false)
    }
  }

  const doLoad = async (id: string) => {
    if (!token) return
    const epoch = requestEpoch.current
    try {
      const r = await window.maxlabel.cloud.load(serverUrl, token, id)
      if (epoch !== requestEpoch.current) return
      if (r.ok && r.data) {
        onLoad(r.data.json)
        setMsg(`已加载云端模板：${r.data.name}`)
      } else {
        setMsg(r.error ?? '加载失败')
      }
    } catch (error) {
      if (epoch === requestEpoch.current) setMsg('加载失败：' + (error instanceof Error ? error.message : String(error)))
    }
  }

  const doDelete = async (id: string) => {
    if (!token) return
    const epoch = requestEpoch.current
    try {
      const r = await window.maxlabel.cloud.delete(serverUrl, token, id)
      if (epoch !== requestEpoch.current) return
      if (!r.ok) {
        setMsg(r.error ?? '删除失败')
        return
      }
      await refresh(token)
    } catch (error) {
      if (epoch === requestEpoch.current) setMsg('删除失败：' + (error instanceof Error ? error.message : String(error)))
    }
  }

  return (
    <Modal
      title="云端模板"
      onClose={onClose}
      width={560}
      footer={
        <button
          type="button"
          onClick={onClose}
          style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}
        >
          关闭
        </button>
      }
    >
      <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, marginBottom: 12 }}>
        云端模板：登录/注册后可保存到云端用户库，任意设备同步加载。服务地址留空时切换到本机 userData 离线库。
      </div>

      {!token ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>邮箱</div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="you@example.com" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>密码（6-128 位）</div>
            <input type="password" value={password} maxLength={128} onChange={(e) => setPassword(e.target.value)} style={inputStyle} placeholder="••••••" />
          </div>
          <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}>
            <button type="button" onClick={() => doAuth('login')} disabled={busy} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
              登录
            </button>
            <button type="button" onClick={() => doAuth('register')} disabled={busy} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
              注册
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            已登录：<b>{account}</b>
            <button type="button" onClick={doLogout} style={{ marginLeft: 10, fontSize: 12, color: '#2E6E93', background: 'none', border: 'none', cursor: 'pointer' }}>
              退出登录
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={saveName} onChange={(e) => setSaveName(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="模板名称" />
            <button type="button" onClick={doSave} disabled={busy} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
              保存当前模板
            </button>
          </div>
          <div style={{ borderTop: '1px solid #E4E3DD', paddingTop: 10 }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>我的云端模板（{list.length}）</div>
            {list.length === 0 && <div style={{ fontSize: 13, color: '#9AA0A6', padding: '8px 0' }}>暂无云端模板，点击上方"保存当前模板"上传。</div>}
            {list.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #F0EFEA' }}>
                <div style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.name}
                  <span style={{ color: '#9AA0A6', fontSize: 11, marginLeft: 8 }}>{new Date(t.updatedAt).toLocaleString()}</span>
                </div>
                <button type="button" onClick={() => doLoad(t.id)} style={{ fontSize: 12, color: '#2E6E93', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>
                  加载
                </button>
                <button type="button" onClick={() => doDelete(t.id)} style={{ fontSize: 12, color: '#EA6668', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>
                  删除
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {msg && <div style={{ marginTop: 10, fontSize: 12, color: msg.includes('成功') ? '#2E7D32' : '#C62828' }}>{msg}</div>}
    </Modal>
  )
}
