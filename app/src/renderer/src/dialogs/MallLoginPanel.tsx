import { useCallback, useEffect, useRef, useState } from 'react'
import type { MallMember, MallWechatScan } from '../../../shared/ipcContract'
import { localizePropertyLabel } from '../../../shared/i18n/property.en-US'
import { barcodeToDataURLEx } from '../editor/barcode'
import { useI18n } from '../features/i18n/useI18n'
import type { AppOptions } from './OptionsDialog'
import MallCaptchaDialog from './MallCaptchaDialog'

type Method = 'sms' | 'password' | 'wechat'
type CaptchaPurpose = 'sms' | 'profile'

interface WechatState {
  scan: MallWechatScan
  qr: string
  status: 'pending' | 'need-profile' | 'expired'
  nickname?: string
}

interface Props {
  options: AppOptions
  onMember: (member: MallMember) => void
}

const MOBILE_RE = /^1[3-9]\d{9}$/

const button = (primary = false): React.CSSProperties => ({
  padding: '7px 14px',
  borderRadius: 6,
  border: primary ? '1px solid #2E6E93' : '1px solid #D5D4CD',
  background: primary ? '#2E6E93' : '#fff',
  color: primary ? '#fff' : '#1A1B1C',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'inherit'
})

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid #D5D4CD',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none'
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12.5, color: '#4B5563' }}>{label}</span>
      {children}
    </div>
  )
}

/** 软件内登录：短信验证码 / 密码 / 微信扫码，对齐商城店面登录弹窗。 */
export default function MallLoginPanel({ options, onMember }: Props) {
  const { language } = useI18n()
  const L = (text: string) => localizePropertyLabel(text, language)
  const context = { baseUrl: options.mallBaseUrl, tenantId: options.mallTenantId }
  const [method, setMethod] = useState<Method>('sms')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [company, setCompany] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [captchaPurpose, setCaptchaPurpose] = useState<CaptchaPurpose | null>(null)
  const [wechat, setWechat] = useState<WechatState | null>(null)
  const ticketRef = useRef<string | null>(null)
  const completedRef = useRef(false)
  const methodRef = useRef<Method>('sms')
  const aliveRef = useRef(true)
  const onMemberRef = useRef(onMember)
  onMemberRef.current = onMember
  const mobileValid = MOBILE_RE.test(mobile)

  useEffect(() => { ticketRef.current = wechat?.scan.ticket ?? null }, [wechat])
  useEffect(() => {
    // StrictMode 在开发模式会执行 setup → cleanup → setup；这里必须重新置回 true。
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((value) => Math.max(0, value - 1)), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const abandonWechat = useCallback(() => {
    const ticket = ticketRef.current
    ticketRef.current = null
    // 登录已经完成时票据属于服务端的成功状态，不能再当作“放弃扫码”作废。
    if (!ticket || completedRef.current) return
    void window.maxlabel.mall.wechat.abandon(context, ticket).catch(() => undefined)
  }, [context.baseUrl, context.tenantId])

  useEffect(() => () => abandonWechat(), [abandonWechat])

  const startWechat = useCallback(async () => {
    setMessage('')
    setWechat(null)
    try {
      const result = await window.maxlabel.mall.wechat.create(context)
      if (!result.ok || !result.scan) {
        setMessage(result.error || L('二维码获取失败，请稍后重试'))
        return
      }
      // 用户可能已切回其它登录方式或关闭弹窗；丢弃刚拿到的票据，避免服务端残留。
      if (!aliveRef.current || methodRef.current !== 'wechat') {
        void window.maxlabel.mall.wechat.abandon(context, result.scan.ticket).catch(() => undefined)
        return
      }
      let qr = ''
      try {
        qr = await barcodeToDataURLEx('qrcode', result.scan.qrContent, 60, { dpi: 96, marginMm: 1, showText: false })
      } catch {
        setMessage(L('二维码生成失败，请稍后重试'))
        return
      }
      setWechat({ scan: result.scan, qr, status: 'pending' })
    } catch (error) {
      setMessage(String((error as { message?: string }).message ?? error))
    }
  }, [context.baseUrl, context.tenantId])

  const selectMethod = (next: Method) => {
    if (next === method) return
    if (method === 'wechat') {
      abandonWechat()
      setWechat(null)
    }
    methodRef.current = next
    setMethod(next)
    setMessage('')
    if (next === 'wechat') void startWechat()
  }

  const ticket = wechat?.scan.ticket
  const wechatStatus = wechat?.status
  useEffect(() => {
    if (method !== 'wechat' || !ticket || wechatStatus !== 'pending') return
    let live = true
    const tick = async () => {
      try {
        const result = await window.maxlabel.mall.wechat.query(context, ticket)
        if (!live) return
        if (!result.ok || !result.state) {
          if (result.error) setMessage(result.error)
          return
        }
        const state = result.state
        if (state.status === 'completed') {
          completedRef.current = true
          onMemberRef.current(state.member)
          return
        }
        if (state.status === 'need-profile') {
          setWechat((current) => current && current.scan.ticket === ticket
            ? { ...current, status: 'need-profile', nickname: state.nickname }
            : current)
          return
        }
        if (state.status === 'expired') {
          setWechat((current) => current && current.scan.ticket === ticket
            ? { ...current, status: 'expired' }
            : current)
        }
      } catch {
        // 网络抖动时保持轮询，下一轮继续。
      }
    }
    void tick()
    const timer = setInterval(() => void tick(), 3000)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [method, ticket, wechatStatus, context.baseUrl, context.tenantId])

  const requestCode = async (purpose: CaptchaPurpose) => {
    if (!mobileValid) {
      setMessage(L('请输入 11 位手机号'))
      return
    }
    setMessage('')
    setBusy(true)
    try {
      const state = await window.maxlabel.mall.captcha.enabled(context)
      if (!state.ok) {
        setMessage(state.error || L('验证码加载失败，请重试'))
        return
      }
      // 服务端关闭滑块时与店面一致：直接发送短信，不弹验证码窗。
      if (state.enabled === false) {
        const result = await window.maxlabel.mall.sms.send(context, mobile)
        if (!result.ok) {
          setMessage(result.error || L('验证码发送失败，请稍后重试'))
          return
        }
        setCountdown(60)
        setMessage(L('验证码已发送'))
        return
      }
      setCaptchaPurpose(purpose)
    } catch (error) {
      setMessage(String((error as { message?: string }).message ?? error))
    } finally {
      setBusy(false)
    }
  }

  const solveCaptcha = async (verification: string) => {
    const purpose = captchaPurpose
    setCaptchaPurpose(null)
    if (!purpose) return
    setBusy(true)
    setMessage('')
    try {
      const result = await window.maxlabel.mall.sms.send(context, mobile, verification)
      if (!result.ok) {
        setMessage(result.error || L('验证码发送失败，请稍后重试'))
        return
      }
      setCountdown(60)
      setMessage(L('验证码已发送'))
    } catch (error) {
      setMessage(String((error as { message?: string }).message ?? error))
    } finally {
      setBusy(false)
    }
  }

  const finishLogin = (result: { ok: boolean; member?: MallMember; error?: string }, fallback: string) => {
    if (result.ok && result.member) onMemberRef.current(result.member)
    else setMessage(result.error || fallback)
  }

  const submitPassword = async () => {
    if (!mobileValid || !password) {
      setMessage(L('请输入手机号和密码'))
      return
    }
    setBusy(true)
    setMessage('')
    try {
      finishLogin(await window.maxlabel.mall.login(context, { method: 'password', mobile, password }), L('手机号或密码不正确'))
    } catch (error) {
      setMessage(String((error as { message?: string }).message ?? error))
    } finally {
      setBusy(false)
    }
  }

  const submitSms = async () => {
    if (!mobileValid || code.length < 4) {
      setMessage(L('请输入手机号和短信验证码'))
      return
    }
    setBusy(true)
    setMessage('')
    try {
      finishLogin(await window.maxlabel.mall.login(context, { method: 'sms', mobile, code }), L('验证码校验失败，请重新获取'))
    } catch (error) {
      setMessage(String((error as { message?: string }).message ?? error))
    } finally {
      setBusy(false)
    }
  }

  const submitWechatProfile = async () => {
    if (!wechat || wechat.status !== 'need-profile') return
    if (!mobileValid || code.length < 4) {
      setMessage(L('请输入手机号和短信验证码'))
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const result = await window.maxlabel.mall.wechat.complete(context, {
        ticket: wechat.scan.ticket,
        mobile,
        code,
        ...(company.trim() ? { company: company.trim() } : {})
      })
      if (result.ok && result.member) {
        completedRef.current = true
        onMemberRef.current(result.member)
      } else if (result.ok && result.pending) {
        setWechat((current) => current ? { ...current, status: 'pending' } : current)
      } else {
        setMessage(result.error || L('补全失败，请稍后重试'))
      }
    } catch (error) {
      setMessage(String((error as { message?: string }).message ?? error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-testid="mall-login-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E4E3DD', paddingBottom: 8 }}>
        {([
          ['sms', L('验证码登录')],
          ['password', L('密码登录')],
          ['wechat', L('微信登录')]
        ] as Array<[Method, string]>).map(([value, label]) => (
          <button
            key={value}
            type="button"
            data-testid={`mall-login-tab-${value}`}
            onClick={() => selectMethod(value)}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderBottom: method === value ? '2px solid #2E6E93' : '2px solid transparent',
              background: 'none',
              color: method === value ? '#2E6E93' : '#4B5563',
              fontWeight: method === value ? 600 : 400,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {method !== 'wechat' && (
        <>
          <Field label={L('手机号')}>
            <input
              data-testid="mall-login-mobile"
              type="tel"
              inputMode="numeric"
              maxLength={11}
              placeholder={L('请输入 11 位手机号')}
              value={mobile}
              onChange={(event) => setMobile(event.target.value.trim())}
              style={inputStyle}
            />
          </Field>
          {method === 'sms' ? (
            <Field label={L('短信验证码')}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  data-testid="mall-login-code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder={L('请输入验证码')}
                  value={code}
                  onChange={(event) => setCode(event.target.value.trim())}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  data-testid="mall-login-send-code"
                  disabled={busy || countdown > 0 || !mobileValid}
                  onClick={() => void requestCode('sms')}
                  style={button()}
                >
                  {countdown > 0 ? `${countdown} ${L('秒后重发')}` : L('获取验证码')}
                </button>
              </div>
            </Field>
          ) : (
            <Field label={L('密码')}>
              <input
                data-testid="mall-login-password"
                type="password"
                autoComplete="current-password"
                placeholder={L('请输入密码')}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={inputStyle}
              />
            </Field>
          )}
          <button
            type="button"
            data-testid="mall-login-submit"
            disabled={busy}
            onClick={() => void (method === 'sms' ? submitSms() : submitPassword())}
            style={{ ...button(true), marginTop: 2 }}
          >
            {busy ? L('登录中…') : L('登录')}
          </button>
          {method === 'sms' && (
            <div style={{ color: '#6B7280', fontSize: 11.5 }}>{L('未注册的手机号验证后将自动创建账号')}</div>
          )}
        </>
      )}

      {method === 'wechat' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          {wechat?.status === 'expired' ? (
            <>
              <div style={{ color: '#6B7280' }}>{L('二维码已失效')}</div>
              <button type="button" data-testid="mall-wechat-refresh" style={button(true)} onClick={() => void startWechat()}>
                {L('重新获取')}
              </button>
            </>
          ) : wechat?.status === 'need-profile' ? (
            <div data-testid="mall-wechat-profile" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ color: '#4B5563', fontSize: 12.5 }}>
                {wechat.nickname ? `${L('微信昵称')}：${wechat.nickname}。` : ''}
                {L('首次微信登录需要补全手机号，之后就不用再填了。')}
              </div>
              <Field label={L('手机号')}>
                <input
                  data-testid="mall-wechat-mobile"
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  placeholder={L('请输入 11 位手机号')}
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value.trim())}
                  style={inputStyle}
                />
              </Field>
              <Field label={L('短信验证码')}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    data-testid="mall-wechat-code"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={L('请输入验证码')}
                    value={code}
                    onChange={(event) => setCode(event.target.value.trim())}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    data-testid="mall-wechat-send-code"
                    disabled={busy || countdown > 0 || !mobileValid}
                    onClick={() => void requestCode('profile')}
                    style={button()}
                  >
                    {countdown > 0 ? `${countdown} ${L('秒后重发')}` : L('获取验证码')}
                  </button>
                </div>
              </Field>
              <Field label={L('公司名称（选填）')}>
                <input
                  data-testid="mall-wechat-company"
                  maxLength={64}
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  style={inputStyle}
                />
              </Field>
              <button type="button" data-testid="mall-wechat-submit" disabled={busy} onClick={() => void submitWechatProfile()} style={button(true)}>
                {busy ? L('提交中…') : L('完成')}
              </button>
            </div>
          ) : (
            <>
              <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F8FA', borderRadius: 8 }}>
                {wechat?.qr
                  ? <img data-testid="mall-wechat-qr" src={wechat.qr} width={220} height={220} alt={L('微信登录二维码')} />
                  : <span style={{ color: '#6B7280' }}>{L('二维码准备中…')}</span>}
              </div>
              <div style={{ color: '#6B7280', fontSize: 12 }}>{L('请用微信「扫一扫」，并在手机上点确认')}</div>
            </>
          )}
        </div>
      )}

      {message && <div data-testid="mall-login-message" style={{ color: '#B3261E', fontSize: 12.5 }}>{message}</div>}

      {captchaPurpose && (
        <MallCaptchaDialog
          context={context}
          onCancel={() => setCaptchaPurpose(null)}
          onSolved={(verification) => void solveCaptcha(verification)}
        />
      )}
    </div>
  )
}
