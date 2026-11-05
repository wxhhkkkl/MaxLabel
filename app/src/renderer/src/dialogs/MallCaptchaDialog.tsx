import { useCallback, useEffect, useRef, useState } from 'react'
import type { MallCaptchaChallenge, MallContext } from '../../../shared/ipcContract'
import { localizePropertyLabel } from '../../../shared/i18n/property.en-US'
import { useI18n } from '../features/i18n/useI18n'
import Modal from './Modal'

interface Props {
  context: MallContext
  onCancel: () => void
  onSolved: (captchaVerification: string) => void
}

const STAGE_WIDTH = 310
const HANDLE_WIDTH = 42
const MAX_OFFSET = STAGE_WIDTH - HANDLE_WIDTH

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

/** 与店面同款的拼图滑块；secretKey 留在主进程，渲染层只提交拖动后的 x。 */
export default function MallCaptchaDialog({ context, onCancel, onSolved }: Props) {
  const { language } = useI18n()
  const L = (text: string) => localizePropertyLabel(text, language)
  const [captcha, setCaptcha] = useState<MallCaptchaChallenge | null>(null)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const offsetRef = useRef(0)
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const startOffsetRef = useRef(0)
  const aliveRef = useRef(true)

  useEffect(() => {
    // StrictMode 在开发模式会执行 setup → cleanup → setup；这里必须重新置回 true。
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    setOffset(0)
    offsetRef.current = 0
    try {
      const result = await window.maxlabel.mall.captcha.get(context)
      if (result.ok && result.captcha) {
        setCaptcha(result.captcha)
      } else {
        setCaptcha(null)
        setMessage(result.error || L('验证码加载失败，请重试'))
      }
    } catch (error) {
      setCaptcha(null)
      setMessage(String((error as { message?: string }).message ?? error))
    } finally {
      setLoading(false)
    }
  }, [context.baseUrl, context.tenantId])

  useEffect(() => { void load() }, [load])

  const verify = useCallback(async () => {
    if (!captcha || busy) return
    setBusy(true)
    setMessage('')
    try {
      const result = await window.maxlabel.mall.captcha.check(context, captcha.token, Math.round(offsetRef.current))
      if (result.ok && result.captchaVerification) {
        if (aliveRef.current) onSolved(result.captchaVerification)
        return
      }
      setMessage(result.error || L('验证不通过，请重试'))
      await load()
    } catch (error) {
      setMessage(String((error as { message?: string }).message ?? error))
      await load()
    } finally {
      setBusy(false)
    }
  }, [busy, captcha, context.baseUrl, context.tenantId, load, onSolved])

  const onPointerMove = useCallback((event: PointerEvent) => {
    if (!draggingRef.current) return
    const next = startOffsetRef.current + (event.clientX - startXRef.current)
    const clamped = Math.min(Math.max(next, 0), MAX_OFFSET)
    offsetRef.current = clamped
    setOffset(clamped)
  }, [])

  const onPointerUp = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    void verify()
  }, [onPointerMove, verify])

  useEffect(() => () => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }, [onPointerMove, onPointerUp])

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (busy || loading || !captcha) return
    event.preventDefault()
    draggingRef.current = true
    startXRef.current = event.clientX
    startOffsetRef.current = offsetRef.current
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  return (
    <Modal title={L('安全验证')} onClose={onCancel} width={380} testId="mall-captcha-dialog">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, fontSize: 13, userSelect: 'none' }}>
        <div
          data-testid="mall-captcha-stage"
          style={{ position: 'relative', width: STAGE_WIDTH, height: 155, background: '#F3F4F6', borderRadius: 6, overflow: 'hidden' }}
        >
          {captcha && (
            <>
              <img
                src={`data:image/png;base64,${captcha.originalImageBase64}`}
                width={STAGE_WIDTH}
                height={155}
                alt=""
                draggable={false}
                style={{ display: 'block', userSelect: 'none' }}
              />
              <img
                src={`data:image/png;base64,${captcha.jigsawImageBase64}`}
                width={47}
                height={155}
                alt=""
                draggable={false}
                style={{ position: 'absolute', top: 0, left: offset, userSelect: 'none', pointerEvents: 'none' }}
              />
            </>
          )}
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' }}>
              {L('加载中…')}
            </div>
          )}
        </div>
        <div style={{ position: 'relative', width: STAGE_WIDTH, height: 40, background: '#F3F4F6', borderRadius: 20 }}>
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 12 }}>
            {busy ? L('验证中…') : L('拖动滑块完成拼图')}
          </span>
          <button
            type="button"
            aria-label={L('拖动滑块')}
            onPointerDown={startDrag}
            disabled={busy || loading || !captcha}
            style={{
              position: 'absolute',
              top: 0,
              left: offset,
              width: HANDLE_WIDTH,
              height: 40,
              borderRadius: 20,
              border: '1px solid #D5D4CD',
              background: '#fff',
              cursor: busy ? 'default' : 'grab',
              fontSize: 16,
              touchAction: 'none'
            }}
          >
            →
          </button>
        </div>
        {message && <div data-testid="mall-captcha-message" style={{ color: '#B3261E', fontSize: 12 }}>{message}</div>}
        <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
          <button type="button" style={button()} disabled={busy} onClick={() => void load()}>{L('换一张')}</button>
          <button type="button" style={button()} disabled={busy} onClick={onCancel}>{L('取消')}</button>
        </div>
      </div>
    </Modal>
  )
}
