import { useEffect, useState } from 'react'
import Modal from './Modal'
import { useI18n } from '../features/i18n/useI18n'
import { localizePropertyLabel } from '../../../shared/i18n/property.en-US'
import { localizeIpcMessage } from '../../../shared/i18n/translate'
import LText from '../features/i18n/LText'

interface Props {
  onClose: () => void
}

interface LicenseState {
  active: boolean
  machineId: string
  holder: string | null
  key?: string | null
  expiresAt?: string | null
  lastCheckAt?: string | null
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 9px',
  border: '1px solid #D5D4CD',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'Consolas, monospace',
  boxSizing: 'border-box'
}

const SERVER_KEY = 'maxlabel_server_url'

export default function LicenseDialog({ onClose }: Props) {
  const { t, language } = useI18n()
  const L = (text: string) => localizePropertyLabel(text, language)
  const [msgOk, setMsgOk] = useState(false)
  const [state, setState] = useState<LicenseState | null>(null)
  const [key, setKey] = useState('')
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem(SERVER_KEY) ?? 'http://127.0.0.1:8420')
  const [msg, setMsg] = useState('')
  const [checking, setChecking] = useState(false)

  const refresh = async () => {
    try {
      const r = await window.maxlabel.license.status()
      if (r.ok) setState(r.state)
    } catch (error) {
      setMsg(L('读取授权状态失败：') + (error instanceof Error ? error.message : String(error)))
      setMsgOk(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const doActivate = async () => {
    setMsg('')
    const url = serverUrl.trim().replace(/\/+$/, '')
    if (!url) {
      setMsg(L('请先填写云服务器地址（部署在您的服务器上，如 https://cloud.example.com）'))
      setMsgOk(false)
      return
    }
    localStorage.setItem(SERVER_KEY, url)
    try {
      const r = await window.maxlabel.license.activate(key.trim(), url)
      if (r.ok && r.state) {
        setState(r.state)
        setMsg(L('激活成功，授权已绑定本机！'))
        setMsgOk(true)
      } else {
        setMsg(localizeIpcMessage(language, { message: r.error ?? '', messageKey: r.messageKey }) || L('激活失败'))
        setMsgOk(false)
      }
    } catch (error) {
      setMsg(L('激活失败：') + (error instanceof Error ? error.message : String(error)))
      setMsgOk(false)
    }
  }

  const doCheck = async () => {
    setMsg('')
    setChecking(true)
    const url = serverUrl.trim().replace(/\/+$/, '')
    localStorage.setItem(SERVER_KEY, url)
    try {
      const r = await window.maxlabel.license.check(url)
      if (r.ok) {
        setMsg(L('在线复查通过，授权有效'))
        setMsgOk(true)
        void refresh()
      } else {
        setMsg(localizeIpcMessage(language, { message: r.error ?? '', messageKey: r.messageKey }) || L('复查失败'))
        setMsgOk(false)
        void refresh()
      }
    } catch (error) {
      setMsg(L('复查失败：') + (error instanceof Error ? error.message : String(error)))
      setMsgOk(false)
    } finally {
      setChecking(false)
    }
  }

  return (
    <Modal
      title={L('授权与激活')}
      onClose={onClose}
      width={600}
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={{ padding: 12, borderRadius: 10, background: '#F4F3EE', border: '1px solid #E4E3DD' }}>
          <div style={{ fontSize: 12, color: '#6B7280' }}><LText text="当前版本"/></div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1A1B1C', marginTop: 4 }}>
            <LText text="MaxLabel 完整版"/>
          </div>
          <div style={{ fontSize: 12, color: state?.active ? '#2E7D32' : '#6B7280', marginTop: 4 }}>{state?.active ? L('授权有效') : L('尚未激活（功能不分版本）')}</div>
          {state?.active && state?.holder && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{L('持有人：')}{state.holder}</div>}
          {state?.active && state?.expiresAt && (
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{L('授权至：')}{state.expiresAt.slice(0, 10)}</div>
          )}
        </div>
        <div style={{ padding: 12, borderRadius: 10, background: '#F4F3EE', border: '1px solid #E4E3DD' }}>
          <div style={{ fontSize: 12, color: '#6B7280' }}><LText text="设备标识（机器锁定）"/></div>
          <div style={{ fontSize: 13, color: '#1A1B1C', marginTop: 4, fontFamily: 'Consolas, monospace', wordBreak: 'break-all' }}>
            {state?.machineId ?? '…'}
          </div>
          <div style={{ fontSize: 11, color: '#9AA0A6', marginTop: 4 }}><LText text="激活密钥与设备绑定，更换设备需联系服务商解绑。"/></div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
        <LText text="云服务器地址（部署在您的服务器上，用于在线鉴权与云存储）"/>
      </div>
      <input
        data-testid="license-server"
        value={serverUrl}
        onChange={(e) => setServerUrl(e.target.value)}
        style={inputStyle}
        placeholder="https://cloud.example.com"
      />

      <div style={{ fontSize: 12, color: '#6B7280', margin: '10px 0 4px' }}><LText text="许可证密钥（XXXX-XXXX-XXXX-XXXX）"/></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input data-testid="license-key" value={key} onChange={(e) => setKey(e.target.value)} style={inputStyle} placeholder={L('输入授权密钥')} />
        <button type="button" data-testid="license-activate" onClick={doActivate} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
          {L('激活')}
        </button>
        <button type="button" data-testid="license-recheck" onClick={doCheck} disabled={checking} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
          {checking ? L('复查中…') : L('在线复查')}
        </button>
      </div>
      {msg && <div style={{ marginTop: 10, fontSize: 12, color: msgOk ? '#2E7D32' : '#C62828' }}>{msg}</div>}
      <div style={{ marginTop: 12, fontSize: 12, color: '#9AA0A6', lineHeight: 1.6 }}>
        <LText text="说明：本软件采用在线授权——输入密钥后连接您的云服务器验证，服务器校验密钥有效性并绑定本机；使用期间本地保留授权缓存，每次启动自动在线复查；断网时暂用本地授权。云服务窗口（账户 / 云端模板）同样连接该服务器。"/>
      </div>
    </Modal>
  )
}
