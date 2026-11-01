import { useEffect, useState } from 'react'
import Modal, { FormField } from './Modal'
import { useI18n } from '../features/i18n/useI18n'
import { localizePropertyLabel } from '../../../shared/i18n/property.en-US'
import LText from '../features/i18n/LText'
import { localizeIpcMessage } from '../../../shared/i18n/translate'
import type { UpdateCheckResultDto, UpdateStateDto } from '../../../shared/ipcContract'
import { SCALE_PROTOCOLS as PROTOCOL_SPECS } from '../../../shared/scale/protocols'
import { SCALE_BAUD_RATES, SCALE_PROTOCOLS as SCALE_PROTOCOL_IDS, type ScaleProtocol, type ScaleTestResult } from '../../../shared/scale/types'
import type { ScalePortInfo } from '../../../shared/scale/settings'
import { readScaleSettings, writeScaleSettings } from '../features/scale/scalePreferences'

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

const fieldStyle: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff' }

function terminatorText(terminator: '\r\n' | '\r' | '\x03'): string {
  if (terminator === '\r\n') return '<CR><LF>'
  if (terminator === '\r') return '<CR>'
  return '<ETX>'
}

/**
 * 电子称（选项 → 电子称）。
 *
 * 020：协议 / 端口 / 速率是**设备属性**，全局一份存在本地偏好里；
 * 单位、小数位、是否换算仍属于标签语义（在数据源上配）。这里的「测试连接」
 * 复用主进程既有的 `scale:test`，不会与正常取重冲突（有忙锁）。
 */
export function WeighDialog({ onClose }: { onClose: () => void }) {
  const { t, language } = useI18n()
  const [tab, setTab] = useState<'options' | 'port'>('options')
  const [settings, setSettings] = useState(() => readScaleSettings())
  const [ports, setPorts] = useState<ScalePortInfo[]>([])
  const [portsError, setPortsError] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')

  const protocolSpec = PROTOCOL_SPECS[settings.protocol]

  const refreshPorts = async (): Promise<void> => {
    setPortsError('')
    try {
      const result = await window.maxlabel.scale.listPorts()
      setPorts(result?.ports ?? [])
      if (!result?.ok) setPortsError(localizeIpcMessage(language, { message: result?.message ?? '', messageKey: result?.messageKey ?? 'error.scalePort' }))
    } catch (error) {
      setPorts([])
      setPortsError(error instanceof Error ? error.message : String(error))
    }
  }

  useEffect(() => { void refreshPorts() }, [])

  const pickProtocol = (protocol: ScaleProtocol): void => {
    // 换协议时顺带套用该协议的默认速率（原版行为），用户仍可再改
    setSettings((prev) => ({ ...prev, protocol, baud: PROTOCOL_SPECS[protocol].defaultBaud }))
  }

  const testConnection = async (): Promise<void> => {
    setTesting(true)
    setTestResult('')
    try {
      const result = await window.maxlabel.scale.test({
        protocol: settings.protocol,
        port: settings.port,
        baud: settings.baud,
        unit: 'kg',
        decimals: 2,
        timeoutMs: 5000
      })
      if (result.ok && result.stable) {
        setTestResult(`${t('scale.portOpened')}：${formatTestReading(result)}`)
      } else {
        setTestResult(localizeIpcMessage(language, {
          message: result.message ?? '',
          messageKey: result.messageKey ?? 'error.scaleFrame'
        }) || t('scale.invalidReading'))
      }
    } catch (error) {
      setTestResult(error instanceof Error ? error.message : String(error))
    } finally {
      setTesting(false)
    }
  }

  const save = (): void => {
    writeScaleSettings(settings)
    onClose()
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', border: 'none', borderBottom: active ? '2px solid #2E6E93' : '2px solid transparent',
    background: 'none', color: active ? '#2E6E93' : '#6B7280', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit'
  })

  return (
    <Modal
      title={t('menu.weigh')}
      onClose={onClose}
      width={460}
      testId="scale-settings-dialog"
      footer={<>
        <button type="button" style={ghostStyle} onClick={onClose}><LText text="取消" /></button>
        <button type="button" data-testid="scale-save" style={btnStyle} onClick={save}><LText text="确定" /></button>
      </>}
    >
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #ECEBE6', marginBottom: 14 }}>
        <button type="button" data-testid="scale-tab-options" style={tabStyle(tab === 'options')} onClick={() => setTab('options')}><LText text="选项" /></button>
        <button type="button" data-testid="scale-tab-port" style={tabStyle(tab === 'port')} onClick={() => setTab('port')}><LText text="端口" /></button>
      </div>

      {tab === 'options' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="协议">
            <select data-testid="scale-protocol" style={fieldStyle} value={settings.protocol} onChange={(e) => pickProtocol(e.target.value as ScaleProtocol)}>
              {SCALE_PROTOCOL_IDS.map((id) => (
                <option key={id} value={id}>{PROTOCOL_SPECS[id].label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="数据格式">
            <div data-testid="scale-format" style={{ ...fieldStyle, background: '#FAFAF8', color: '#5B6C8F' }}>
              {protocolSpec.label}　<LText text="终止字符" /> {terminatorText(protocolSpec.terminator)}
            </div>
          </FormField>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              data-testid="scale-auto-connect"
              checked={settings.autoConnect}
              onChange={(e) => setSettings((prev) => ({ ...prev, autoConnect: e.target.checked }))}
            />
            <LText text="打开模板时，自动连接电子秤" />
          </label>
          <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.6 }}>
            <LText text="称重数据会填入标签里「键盘输入」且输入设备为「称重」的数据源；单位、小数位在数据源属性里设置。" />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="类型">
            <select style={{ ...fieldStyle, background: '#FAFAF8' }} disabled value="serial">
              <option value="serial"><LText text="串行端口(COM)" /></option>
            </select>
          </FormField>
          <FormField label="端口">
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                data-testid="scale-port"
                style={fieldStyle}
                list="scale-port-options"
                placeholder="COM3"
                value={settings.port}
                onChange={(e) => setSettings((prev) => ({ ...prev, port: e.target.value }))}
              />
              <datalist id="scale-port-options">
                {ports.map((p) => <option key={p.path} value={p.path}>{p.manufacturer ?? ''}</option>)}
              </datalist>
              <button type="button" data-testid="scale-refresh-ports" style={ghostStyle} onClick={() => void refreshPorts()}><LText text="刷新" /></button>
            </div>
          </FormField>
          {portsError ? <div style={{ fontSize: 11, color: '#B3261E' }}>{portsError}</div> : null}
          {ports.length ? (
            <div style={{ fontSize: 11, color: '#6B7280' }}>
              {ports.map((p) => p.path).join('、')}
            </div>
          ) : null}
          <FormField label="速率">
            <select data-testid="scale-baud" style={fieldStyle} value={settings.baud} onChange={(e) => setSettings((prev) => ({ ...prev, baud: e.target.value }))}>
              {SCALE_BAUD_RATES.map((rate) => <option key={rate} value={rate}>{rate}</option>)}
            </select>
          </FormField>
          <div style={{ display: 'flex', gap: 12 }}>
            <FormField label="数据位"><div style={{ ...fieldStyle, background: '#FAFAF8' }}>8</div></FormField>
            <FormField label="奇偶校验"><div style={{ ...fieldStyle, background: '#FAFAF8' }}><LText text="无" /></div></FormField>
            <FormField label="停止位"><div style={{ ...fieldStyle, background: '#FAFAF8' }}>1</div></FormField>
            <FormField label="流控制"><div style={{ ...fieldStyle, background: '#FAFAF8' }}><LText text="无" /></div></FormField>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" data-testid="scale-test" style={ghostStyle} disabled={testing} onClick={() => void testConnection()}>
              {testing ? t('scale.reading') : <LText text="测试连接" />}
            </button>
            {testResult ? <span data-testid="scale-test-result" style={{ fontSize: 12, color: '#1A1B1C' }}>{testResult}</span> : null}
          </div>
        </div>
      )}
    </Modal>
  )
}

function formatTestReading(result: ScaleTestResult): string {
  const value = result.value ?? 0
  const unit = result.unit ?? 'kg'
  return `${value.toFixed(2)} ${unit}`
}

/**
 * 查找更新版本 / 在线更新对话框（帮助 → 查找更新版本；帮助 install_upgrade.html）。
 *
 * 状态优先于检查结果：下载中/已下载/安装中/失败由主进程 `update:changed` 驱动；
 * 其余状态展示本次检查结果。下载/安装入口不在这里直接调用 Electron，只调用 App 传入的回调。
 */
export interface UpdateDialogProps {
  result: UpdateCheckResultDto | null
  state: UpdateStateDto | null
  onClose: () => void
  onRetry: () => void
  onDownload: () => void
  onCancel: () => void
  onInstall: () => void
}

export function UpdateDialog({ result, state, onClose, onRetry, onDownload, onCancel, onInstall }: UpdateDialogProps) {
  const { t, language } = useI18n()
  const phase = state?.state
  const downloading = phase === 'downloading'
  const ready = phase === 'ready'
  const installing = phase === 'installing'
  const failed = phase === 'error'
  const hasUpdate = result?.status === 'update' || phase === 'available'
  const percent = Math.max(0, Math.min(100, state?.progress?.percent ?? 0))
  const latest = state?.latest ?? result?.latest
  const notes = state?.notes ?? result?.notes
  const current = state?.current ?? result?.current ?? ''
  const errorText = localizeIpcMessage(language, {
    message: state?.error ?? result?.message ?? '',
    messageKey: state?.messageKey ?? result?.messageKey
  }) || t('status.updateUnavailable')

  const footer = downloading ? (
    <>
      <button type="button" data-testid="update-cancel" style={ghostStyle} onClick={onCancel}>{t('update.cancel')}</button>
      <button type="button" style={ghostStyle} onClick={onClose}>{t('common.close')}</button>
    </>
  ) : ready ? (
    <>
      <button type="button" data-testid="update-install" style={btnStyle} onClick={onInstall}>{t('update.restart')}</button>
      <button type="button" data-testid="update-later" style={ghostStyle} onClick={onClose}>{t('update.later')}</button>
    </>
  ) : installing ? null : failed || result?.status === 'unavailable' ? (
    <>
      <button type="button" data-testid="update-retry" style={btnStyle} onClick={onRetry}>{t('update.retry')}</button>
      <button type="button" style={ghostStyle} onClick={onClose}>{t('common.close')}</button>
    </>
  ) : hasUpdate ? (
    <>
      <button type="button" data-testid="update-download" style={btnStyle} onClick={onDownload}>{t('update.install')}</button>
      <button type="button" data-testid="update-later" style={ghostStyle} onClick={onClose}>{t('update.later')}</button>
    </>
  ) : (
    <button type="button" style={btnStyle} onClick={onClose}>{t('common.ok')}</button>
  )

  return (
    <Modal title={t('menu.updateCheck')} onClose={onClose} width={440} testId="update-dialog" footer={footer}>
      <div style={{ fontSize: 13, color: '#1A1B1C', lineHeight: 1.8 }}>
        {downloading ? (
          <>
            <div data-testid="update-progress">{t('update.progress', { percent: Math.round(percent) })}</div>
            <div style={{ height: 8, marginTop: 8, borderRadius: 4, background: '#EEF0F3', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${percent}%`, background: '#2E6E93', transition: 'width .2s' }} />
            </div>
            {latest ? <div style={{ marginTop: 8, color: '#6B7280' }}>{t('update.found')} {latest}</div> : null}
          </>
        ) : ready ? (
          <>
            <div style={{ fontWeight: 600 }}>{t('update.ready')}</div>
            {latest ? <div style={{ marginTop: 6, color: '#6B7280' }}>{t('update.found')} {latest}{t('update.closeParen')}</div> : null}
          </>
        ) : installing ? (
          <div data-testid="update-installing">{t('update.installing')}</div>
        ) : failed || result?.status === 'unavailable' ? (
          <>
            <div style={{ fontWeight: 600 }}>{t('update.error')}{t('update.closeParen')}</div>
            <div data-testid="update-error" style={{ marginTop: 6, color: '#B3261E' }}>{errorText}</div>
          </>
        ) : hasUpdate ? (
          <>
            {t('update.found')} <b>{latest}</b>{t('update.currentVersion')} {current}{t('update.closeParen')}
            {notes ? <><br /><span style={{ color: '#6B7280', whiteSpace: 'pre-wrap' }}>{notes}</span></> : null}
          </>
        ) : result?.status === 'latest' || phase === 'latest' ? (
          <>
            {t('update.latest')} <b>{current}</b>{t('update.closeParen')}
            <br />
            <span style={{ color: '#6B7280' }}>{t('update.latestHint')}</span>
          </>
        ) : (
          <span>{t('status.checkingUpdate')}</span>
        )}
      </div>
    </Modal>
  )
}
