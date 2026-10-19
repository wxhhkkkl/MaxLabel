import { useState } from 'react'
import Modal, { FormField } from './Modal'
import { useI18n } from '../features/i18n/useI18n'
import { localizePropertyLabel } from '../../../shared/i18n/property.en-US'
import LText from '../features/i18n/LText'
import { localizeIpcMessage } from '../../../shared/i18n/translate'
import type { UpdateCheckResultDto } from '../../../shared/ipcContract'

const btnStyle: React.CSSProperties = { padding: '7px 22px', borderRadius: 7, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }
const ghostStyle: React.CSSProperties = { padding: '7px 18px', borderRadius: 7, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }

/** 定位记录（数据库 → 定位记录，Ctrl+F）：按记录号定位 + 按字段内容查找 */
export function LocateRecordDialog({
  total,
  dsCols = [],
  dsRows = [],
  currentIndex = 0,
  onLocate,
  onClose
}: {
  total: number
  dsCols?: string[]
  dsRows?: string[][]
  currentIndex?: number
  onLocate: (idx: number) => void
  onClose: () => void
}) {
  const { language } = useI18n()
  const L = (text: string) => localizePropertyLabel(text, language)
  const [n, setN] = useState('1')
  const [mode, setMode] = useState<'num' | 'field'>('num')
  const [direction, setDirection] = useState<'forward' | 'backward' | 'forward-cycle' | 'backward-cycle'>('forward')
  const [field, setField] = useState(dsCols[0] ?? '')
  const [content, setContent] = useState('')
  const [fuzzy, setFuzzy] = useState(true)
  const [found, setFound] = useState<null | string>(null)

  const go = () => {
    if (mode === 'num') {
      const v = parseInt(n, 10)
      if (isNaN(v) || v < 1) { setFound(L('请输入有效的记录号')); return }
      onLocate(Math.min(v - 1, Math.max(0, total - 1)))
      onClose()
      return
    }
    // 按字段内容查找
    const colIdx = dsCols.indexOf(field)
    if (colIdx < 0 || !content) { setFound(L('请选择索引字段并输入查找内容')); return }
    const step = direction.startsWith('forward') ? 1 : -1
    const cycle = direction.endsWith('-cycle')
    const origin = Math.max(0, Math.min(Math.max(0, total - 1), currentIndex))
    const matches = (i: number) => {
      const cell = dsRows[i]?.[colIdx] ?? ''
      return fuzzy ? cell.toLowerCase().includes(content.toLowerCase()) : cell === content
    }
    const candidates: number[] = []
    for (let i = origin + step; i >= 0 && i < total; i += step) candidates.push(i)
    if (cycle && total > 0) {
      for (let i = step > 0 ? 0 : total - 1; i !== origin; i += step) {
        if (i >= 0 && i < total) candidates.push(i)
      }
    }
    const foundIndex = candidates.find((i) => matches(i))
    if (foundIndex !== undefined) {
      onLocate(foundIndex)
      onClose()
      return
    }
    setFound(L('未找到匹配的记录'))
  }

  const select: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff' }
  return (
    <Modal title={L('定位记录')} onClose={onClose} width={400} footer={<>
      <button type="button" style={ghostStyle} onClick={onClose}><LText text="取消"/></button>
      <button type="button" data-testid="locate-submit" style={btnStyle} onClick={go}><LText text="定位"/></button>
    </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#1A1B1C' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <input data-testid="locate-mode-record" type="radio" checked={mode === 'num'} onChange={() => setMode('num')} style={{ width: 14, height: 14 }} /> <LText text="指定记录号"/>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <input data-testid="locate-mode-field" type="radio" checked={mode === 'field'} onChange={() => setMode('field')} style={{ width: 14, height: 14 }} /> <LText text="按字段内容查找"/>
          </label>
        </div>
        {mode === 'num' ? (
          <FormField label={L('记录号（1 - ') + Math.max(1, total) + L('）')}>
            <input
              style={{ width: '100%', padding: '7px 9px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
              type="number"
              data-testid="locate-record-number"
              min={1}
              max={Math.max(1, total)}
              value={n}
              onChange={(e) => setN(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') go() }}
            />
          </FormField>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FormField label="查找方向">
                <select data-testid="locate-direction" style={select} value={direction} onChange={(e) => setDirection(e.target.value as 'forward' | 'backward' | 'forward-cycle' | 'backward-cycle')}>
                  <option value="forward"><LText text="仅向前查找"/></option>
                  <option value="backward"><LText text="仅向后查找"/></option>
                  <option value="forward-cycle"><LText text="向前循环查找"/></option>
                  <option value="backward-cycle"><LText text="向后循环查找"/></option>
                </select>
              </FormField>
              <FormField label="索引字段">
                <select style={select} value={field} onChange={(e) => setField(e.target.value)}>
                  {dsCols.length === 0 && <option value=""><LText text="（无字段）"/></option>}
                  {dsCols.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField label="字段内容">
              <input
                data-testid="locate-field-content"
                style={{ width: '100%', padding: '7px 9px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') go() }}
                placeholder={L('输入要查找的内容')}
              />
            </FormField>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12.5, color: '#1A1B1C' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <input data-testid="locate-fuzzy" type="checkbox" checked={fuzzy} onChange={(e) => setFuzzy(e.target.checked)} style={{ width: 14, height: 14 }} /> <LText text="模糊查找（包含）"/>
              </label>
            </div>
          </>
        )}
        {found && <div style={{ fontSize: 12, color: '#C0392B' }}>{found}</div>}
        <div style={{ fontSize: 11, color: '#9CA3AF' }}>{L('共 ')}{Math.max(0, total)}{L(' 条记录')}</div>
      </div>
    </Modal>
  )
}

/** 电子称（选项 → 电子称，硬件连接配置） */
export function WeighDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const [port, setPort] = useState('COM1')
  const [baud, setBaud] = useState('9600')
  return (
    <Modal title={t('menu.weigh')} onClose={onClose} width={420} footer={<>
      <button type="button" style={ghostStyle} onClick={onClose}><LText text="取消"/></button>
      <button type="button" style={btnStyle} onClick={() => { onClose() }}><LText text="保存"/></button>
    </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <FormField label="串口">
            <input style={{ width: '100%', padding: '7px 9px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} value={port} onChange={(e) => setPort(e.target.value)} />
          </FormField>
          <FormField label="波特率">
            <input style={{ width: '100%', padding: '7px 9px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} value={baud} onChange={(e) => setBaud(e.target.value)} />
          </FormField>
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.6 }}>
          <LText text="电子称对接功能：连接电子称后可将称重数值作为「键盘输入」数据源填充到标签。请先完成串口参数配置，再连接真实设备。"/>
        </div>
      </div>
    </Modal>
  )
}

/**
 * 查找更新版本（帮助 → 查找更新版本；帮助 install_upgrade.html）。
 * 启动时自动检查与手工检查共用同一实现，对话框如实显示检查结果：
 * 有新版本 → 版本号 + 更新说明 + 「立即更新」；已最新 → 当前版本；取不到清单 → 失败原因。
 */
export function UpdateDialog({ result, onClose }: { result: UpdateCheckResultDto | null; onClose: () => void }) {
  const { t, language } = useI18n()
  const hasUpdate = result?.status === 'update'
  const openDownload = () => {
    if (result?.url) window.open(result.url)
  }
  return (
    <Modal
      title={t('menu.updateCheck')}
      onClose={onClose}
      width={420}
      testId="update-dialog"
      footer={
        <>
          {hasUpdate && result?.url ? <button type="button" data-testid="update-download" style={btnStyle} onClick={openDownload}>{t('update.install')}</button> : null}
          <button type="button" style={btnStyle} onClick={onClose}>{t('common.ok')}</button>
        </>
      }
    >
      <div style={{ fontSize: 13, color: '#1A1B1C', lineHeight: 1.8 }}>
        {!result ? (
          <span>{t('status.checkingUpdate')}</span>
        ) : result.status === 'update' ? (
          <>
            {t('update.found')} <b>{result.latest}</b>{t('update.currentVersion')} {result.current}{t('update.closeParen')}
            {result.notes ? <><br /><span style={{ color: '#6B7280' }}>{result.notes}</span></> : null}
            <br />
            <span style={{ color: '#6B7280' }}>{result.url ? t('update.downloadHint') : t('update.downloadManual')}</span>
          </>
        ) : result.status === 'latest' ? (
          <>
            {t('update.latest')} <b>{result.current}</b>{t('update.closeParen')}
            <br />
            <span style={{ color: '#6B7280' }}>{t('update.latestHint')}</span>
          </>
        ) : (
          <>
            {t('status.updateFailed')}{t('update.closeParen')}
            <br />
            <span style={{ color: '#6B7280' }}>{localizeIpcMessage(language, { message: result.message ?? '', messageKey: result.messageKey }) || t('status.updateUnavailable')}{t('update.manualSuffix')}</span>
          </>
        )}
      </div>
    </Modal>
  )
}
