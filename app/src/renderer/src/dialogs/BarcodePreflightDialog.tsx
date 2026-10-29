import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { barcodeCharsetName } from '../../../shared/domain/barcodeCharset'
import type { BarcodePreflightIssue } from '../features/printing/barcodePreflight'
import { useI18n } from '../features/i18n/useI18n'
import Modal from './Modal'

interface Props {
  issues: BarcodePreflightIssue[]
  onSkip: () => void
  onAbort: () => void
}

const thStyle: React.CSSProperties = { fontSize: 12, color: '#4B5563', textAlign: 'left', padding: '7px 10px', borderBottom: '1px solid #E4E3DD', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { fontSize: 12, color: '#1A1B1C', padding: '7px 10px', borderBottom: '1px solid #F0EFEA', verticalAlign: 'top' }
const btnBase: React.CSSProperties = { padding: '7px 16px', borderRadius: 7, border: '1px solid #D3D6DA', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }
const btnPrimary: React.CSSProperties = { ...btnBase, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff' }

/** 正式打印前的条码数据校验结果：列出不合法记录，让用户决定跳过还是中止。 */
export default function BarcodePreflightDialog({ issues, onSkip, onAbort }: Props) {
  const { t } = useI18n()
  const recordCount = new Set(issues.map((issue) => issue.recordIndex)).size
  return (
    <Modal
      title={t('preflight.title')}
      onClose={onAbort}
      width={720}
      testId="barcode-preflight"
      footer={
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onAbort} style={btnBase}>{t('preflight.abort')}</button>
          <button type="button" onClick={onSkip} style={btnPrimary} autoFocus>{t('preflight.skip')}</button>
        </div>
      }
    >
      <div style={{ fontSize: 13, color: '#1A1B1C', marginBottom: 10 }}>
        {t('preflight.summary', { count: recordCount })}
      </div>
      <table data-testid="barcode-preflight-rows" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>{t('preflight.col.record')}</th>
            <th style={thStyle}>{t('preflight.col.symbology')}</th>
            <th style={thStyle}>{t('preflight.col.message')}</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue, index) => (
            <tr key={`${issue.recordIndex}:${issue.symbology}:${index}`}>
              <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{t('preflight.record', { row: issue.recordIndex + 1 })}</td>
              <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{barcodeCharsetName(issue.symbology)}</td>
              <td style={tdStyle}>{issue.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  )
}

interface PendingRequest {
  issues: BarcodePreflightIssue[]
  finish: (ok: boolean) => void
}

/**
 * 给打印执行器用的「确认」入口：返回的 Promise 在用户点按钮或被取消时结算。
 * 关闭弹窗 / Esc / 打印被取消都按「中止」处理。
 */
export function useBarcodePreflightDialog(): {
  confirm: (issues: BarcodePreflightIssue[], signal?: AbortSignal) => Promise<boolean>
  dialog: ReactNode
} {
  const [request, setRequest] = useState<PendingRequest | null>(null)

  const confirm = useCallback((issues: BarcodePreflightIssue[], signal?: AbortSignal) => {
    return new Promise<boolean>((resolve) => {
      let settled = false
      const finish = (ok: boolean) => {
        if (settled) return
        settled = true
        signal?.removeEventListener('abort', onAbort)
        setRequest(null)
        resolve(ok)
      }
      const onAbort = () => finish(false)
      if (signal?.aborted) {
        resolve(false)
        return
      }
      signal?.addEventListener('abort', onAbort, { once: true })
      setRequest({ issues, finish })
    })
  }, [])

  const dialog = request
    ? <BarcodePreflightDialog issues={request.issues} onSkip={() => request.finish(true)} onAbort={() => request.finish(false)} />
    : null

  return { confirm, dialog }
}
