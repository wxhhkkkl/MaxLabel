import { useCallback, useEffect, useRef, useState } from 'react'
import type { LabelDoc } from '../types'
import { toMsdx } from '../io/msdx'
import Modal from './Modal'
import type { CloudTemplateMetadata } from '../../../shared/ipcContract'
import { useI18n } from '../features/i18n/useI18n'
import { localizePropertyLabel } from '../../../shared/i18n/property.en-US'
import LText from '../features/i18n/LText'
import { localizeIpcMessage } from '../../../shared/i18n/translate'
import { formatDateTime } from '../features/i18n/format'

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
  metadata?: CloudTemplateMetadata
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
  const { t, language } = useI18n()
  const L = (text: string) => localizePropertyLabel(text, language)
  const [msgOk, setMsgOk] = useState(false)
  const ipcError = (result: { error?: string; messageKey?: string; messageParams?: Record<string, string | number> }, fallback: string) =>
    localizeIpcMessage(language, { message: result.error ?? '', messageKey: result.messageKey, messageParams: result.messageParams }) || fallback
  const setMessage = (text: string, ok = false) => { setMsg(text); setMsgOk(ok) }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [account, setAccount] = useState<string | null>(null)
  const [list, setList] = useState<CloudTemplate[]>([])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [saveName, setSaveName] = useState(doc.name || '')
  const defaultName = L('未命名模板')
  const [keywords, setKeywords] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [scope, setScope] = useState<'user' | 'group'>('user')
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
        setMessage(ipcError(r, L('读取云端登录凭据失败')))
      }
    }).catch((error) => { if (live && epoch === requestEpoch.current) setMessage(L('读取云端登录凭据失败：') + (error instanceof Error ? error.message : String(error))) })
    return () => { live = false }
  }, [serverUrl])

  const refresh = useCallback(
    async (tk: string) => {
      const epoch = requestEpoch.current
      try {
        const r = await window.maxlabel.cloud.list(serverUrl, tk)
        if (epoch !== requestEpoch.current) return
        if (r.ok && r.data) setList(r.data)
        else setMessage(ipcError(r, L('加载云端列表失败')))
      } catch (error) {
        if (epoch === requestEpoch.current) setMessage(L('加载云端列表失败：') + (error instanceof Error ? error.message : String(error)))
      }
    },
    [serverUrl, language]
  )

  useEffect(() => {
    if (token) {
      refresh(token)
    }
  }, [token, refresh])

  const doAuth = async (mode: 'register' | 'login') => {
    setBusy(true)
    setMessage('')
    const epoch = requestEpoch.current
    try {
      const r = mode === 'register' ? await window.maxlabel.cloud.register(serverUrl, email, password) : await window.maxlabel.cloud.login(serverUrl, email, password)
      if (epoch !== requestEpoch.current) return
      if (r.ok && r.data) {
        setToken(r.data.token)
        setAccount(r.data.email)
        const stored = await window.maxlabel.cloudCredentials.save(serverUrl, r.data.token, r.data.email)
        if (epoch !== requestEpoch.current) return
        if (!stored.ok) setMessage(L('登录成功，但凭据保存失败：') + ipcError(stored, L('未知错误')))
        else setMessage(mode === 'register' ? L('注册成功，已登录') : L('登录成功'), true)
        await refresh(r.data.token)
      } else {
        setMessage(ipcError(r, mode === 'register' ? L('注册失败') : L('登录失败')))
      }
    } catch (error) {
      if (epoch === requestEpoch.current) setMessage((mode === 'register' ? L('注册失败：') : L('登录失败：')) + (error instanceof Error ? error.message : String(error)))
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
        if (!result.ok) setMessage(ipcError(result, L('云端退出失败')))
      }
    } catch (error) {
      setMessage(L('云端退出失败：') + (error instanceof Error ? error.message : String(error)))
    }
    setToken(null)
    setAccount(null)
    try {
      const result = await window.maxlabel.cloudCredentials.clear(serverUrl)
      if (!result.ok) setMessage(ipcError(result, L('退出登录后清理凭据失败')))
    } catch (error) {
      setMessage(L('退出登录后清理凭据失败：') + (error instanceof Error ? error.message : String(error)))
    }
    setList([])
  }

  const doSave = async (shared = false) => {
    if (!token) return
    if (shared && !category.trim()) {
      setMessage(L('分享模板必须选择分类'))
      return
    }
    setBusy(true)
    setMessage('')
    const epoch = requestEpoch.current
    try {
      const metadata: CloudTemplateMetadata = { keywords: keywords.trim(), description, category: category.trim() || '未分类', scope, shared }
      const r = await window.maxlabel.cloud.save(serverUrl, token, saveName || defaultName, toMsdx(doc), metadata)
      if (epoch !== requestEpoch.current) return
      if (r.ok) {
        setMessage(shared ? L('已分享至') + (scope === 'group' ? L('组模板库') : L('用户模板库')) : L('已保存到云端（') + (scope === 'group' ? L('组模板库') : L('用户库')) + L('）'), true)
        await refresh(token)
      } else {
        setMessage(ipcError(r, L('保存失败')))
      }
    } catch (error) {
      if (epoch === requestEpoch.current) setMessage(L('保存失败：') + (error instanceof Error ? error.message : String(error)))
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
        setMessage(L('已加载云端模板：') + r.data.name, true)
      } else {
        setMessage(ipcError(r, L('加载失败')))
      }
    } catch (error) {
      if (epoch === requestEpoch.current) setMessage(L('加载失败：') + (error instanceof Error ? error.message : String(error)))
    }
  }

  const doDelete = async (id: string) => {
    if (!token) return
    const epoch = requestEpoch.current
    try {
      const r = await window.maxlabel.cloud.delete(serverUrl, token, id)
      if (epoch !== requestEpoch.current) return
      if (!r.ok) {
        setMessage(ipcError(r, L('删除失败')))
        return
      }
      await refresh(token)
    } catch (error) {
      if (epoch === requestEpoch.current) setMessage(L('删除失败：') + (error instanceof Error ? error.message : String(error)))
    }
  }

  return (
    <Modal
      title={L('云端模板')}
      onClose={onClose}
      width={560}
      footer={
        <button
          type="button"
          onClick={onClose}
          style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}
        >
          {t('common.close')}
        </button>
      }
    >
      <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6, marginBottom: 12 }}>
        <LText text="云端模板：登录/注册后可保存到云端用户库，任意设备同步加载。服务地址留空时切换到本机 userData 离线库。"/>
      </div>

      {!token ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}><LText text="邮箱"/></div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="you@example.com" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}><LText text="密码（6-128 位）"/></div>
            <input type="password" value={password} maxLength={128} onChange={(e) => setPassword(e.target.value)} style={inputStyle} placeholder="••••••" />
          </div>
          <div style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}>
            <button type="button" onClick={() => doAuth('login')} disabled={busy} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
              <LText text="登录"/>
            </button>
            <button type="button" onClick={() => doAuth('register')} disabled={busy} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
              <LText text="注册"/>
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            <LText text="已登录："/><b>{account}</b>
            <button type="button" onClick={doLogout} style={{ marginLeft: 10, fontSize: 12, color: '#2E6E93', background: 'none', border: 'none', cursor: 'pointer' }}>
              <LText text="退出登录"/>
            </button>
          </div>
          <div data-testid="cloud-template-metadata" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#4B5563' }}><LText text="名称"/>
              <input data-testid="cloud-template-name" value={saveName} onChange={(e) => setSaveName(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} placeholder={L('模板名称')} />
            </label>
            <label style={{ fontSize: 12, color: '#4B5563' }}><LText text="分类（分享时必选）"/>
              <input data-testid="cloud-template-category" value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} placeholder={L('未分类')} />
            </label>
            <label style={{ fontSize: 12, color: '#4B5563' }}><LText text="关键字"/>
              <input data-testid="cloud-template-keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} placeholder={L('多个关键字用空格或逗号分隔')} />
            </label>
            <label style={{ fontSize: 12, color: '#4B5563' }}><LText text="保存到"/>
              <select data-testid="cloud-template-scope" value={scope} onChange={(e) => setScope(e.target.value as 'user' | 'group')} style={{ ...inputStyle, marginTop: 4 }}>
                <option value="user"><LText text="用户模板库"/></option>
                <option value="group"><LText text="组模板库"/></option>
              </select>
            </label>
            <label style={{ gridColumn: '1 / -1', fontSize: 12, color: '#4B5563' }}><LText text="描述"/>
              <textarea data-testid="cloud-template-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, marginTop: 4, resize: 'vertical' }} placeholder={L('模板描述信息')} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button type="button" data-testid="cloud-template-save" onClick={() => void doSave(false)} disabled={busy} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
              <LText text="保存"/>
            </button>
            <button type="button" data-testid="cloud-template-share" onClick={() => void doSave(true)} disabled={busy} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #2E6E93', background: '#fff', color: '#2E6E93', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
              <LText text="分享"/>
            </button>
          </div>
          <div style={{ borderTop: '1px solid #E4E3DD', paddingTop: 10 }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>{L('我的云端模板（')}{list.length}{L('）')}</div>
            {list.length === 0 && <div style={{ fontSize: 13, color: '#9AA0A6', padding: '8px 0' }}><LText text="暂无云端模板，点击上方“保存当前模板”上传。"/></div>}
            {list.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #F0EFEA' }}>
                <div style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.name}
                  {t.metadata && <span style={{ color: '#6B7280', fontSize: 11, marginLeft: 8 }}><LText text={t.metadata.category}/> · {t.metadata.scope === 'group' ? L('组模板库') : L('用户模板库')}{t.metadata.keywords ? ` · ${t.metadata.keywords}` : ''}</span>}
                  <span style={{ color: '#9AA0A6', fontSize: 11, marginLeft: 8 }}>{formatDateTime(t.updatedAt, language)}</span>
                </div>
                <button type="button" onClick={() => doLoad(t.id)} style={{ fontSize: 12, color: '#2E6E93', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>
                  <LText text="加载"/>
                </button>
                <button type="button" onClick={() => doDelete(t.id)} style={{ fontSize: 12, color: '#EA6668', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>
                  <LText text="删除"/>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {msg && <div style={{ marginTop: 10, fontSize: 12, color: msgOk ? '#2E7D32' : '#C62828' }}>{msg}</div>}
    </Modal>
  )
}
