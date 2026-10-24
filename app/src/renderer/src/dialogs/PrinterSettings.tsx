import { useEffect, useState } from 'react'
import { useI18n } from '../features/i18n/useI18n'
import { localizePropertyLabel } from '../../../shared/i18n/property.en-US'
import { localizeIpcMessage } from '../../../shared/i18n/translate'
import {
  PORT_TYPE_OPTIONS,
  SERIAL_BAUD_RATES,
  SERIAL_DATA_BITS,
  SERIAL_DEFAULT_BAUD_RATE,
  SERIAL_FLOW_OPTIONS,
  SERIAL_PARITY_OPTIONS,
  SERIAL_STOP_BITS_OPTIONS,
  portConfigError,
  type PortConfig,
  type PortType,
  type PrinterConfig
} from '../types'
import { defaultPrinterConfig } from '../types'
import { buildCompatChecklist, COMPAT_MATRIX, recommendEngine } from '../../../shared/print/compat'
import { recommendEscPosProfile } from '../../../shared/print/escposProfiles'
import { writeDefaultPrinter } from '../features/shell/printerPreferences'
import Modal, { FormField, selStyle, TabPanel, TabPanels } from './Modal'

interface Props {
  printer: PrinterConfig
  onClose: () => void
  onSave: (p: PrinterConfig) => void
  onHelp?: () => void
}

/**
 * 真机底排按钮原文（round-121 取证）。
 *
 * `Gprinter GPL-N (203 dpi) 属性` 是 Windows 属性表，实拍底排 = `确定 / 取消 / 帮助`
 * （`parity/reference/labelshop/probe-15-cloudbox-port.png`）。MaxLabel 自有的两张属性表
 * 也是同一形态：`标签格式设置` 的递归控件树 = `确定`(1364) / `取消`(1513) / `隐藏的 应用(&A)`(1661) / `帮助`(1662)
 * （`parity/reference/labelshop/r121-lfs-printer-page.txt`）；`系统设置` 同（DIFF-71 / round-116）。
 * 故本对话框底排按真机三按钮对齐，原有的 `恢复默认` 属**复刻版扩展**，移入「首选项」页的扩展区（不静默删功能）。
 */
export const PRINTER_SETTINGS_FOOTER_LABELS = ['确定', '取消', '帮助'] as const

const numStyle = { ...selStyle, width: '100%' }
const fullStyle: React.CSSProperties = { ...numStyle, width: '100%', boxSizing: 'border-box' }

function boundedNumber(value: string, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

const TAB_STYLE = (active: boolean) => ({
  padding: '8px 18px',
  fontSize: 13,
  fontWeight: active ? 600 : 400,
  color: active ? '#2E6E93' : '#4B5563',
  borderBottom: active ? '2px solid #2E6E93' : '2px solid transparent',
  background: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit'
})

export default function PrinterSettings({ printer, onClose, onSave, onHelp }: Props) {
  const { t, language } = useI18n()
  const L = (text: string) => localizePropertyLabel(text, language)
  const isWindows = typeof navigator === 'undefined' || /Windows/i.test(navigator.userAgent)
  const [p, setP] = useState<PrinterConfig>(printer)
  const [tab, setTab] = useState<'prefs' | 'port' | 'cmd' | 'tools'>('prefs')
  const [toolAction, setToolAction] = useState<'send-command' | 'send-file'>('send-command')
  const [toolCommand, setToolCommand] = useState('')
  const [toolFilePath, setToolFilePath] = useState('')
  const [toolOutput, setToolOutput] = useState<string[]>([])
  const [toolRunning, setToolRunning] = useState(false)
  const [cloudBoxSetup, setCloudBoxSetup] = useState(false)
  /** 真机 TCP/IP 端口用四段 IP 输入；既有配置若是主机名则默认走主机名分支（可用按钮切回 IP）。 */
  const [hostnameMode, setHostnameMode] = useState(() => {
    const host = printer.port.tcpHost ?? ''
    return host !== '' && !/^\d{1,3}(\.\d{1,3}){3}$/.test(host)
  })
  const [comPorts, setComPorts] = useState<string[]>([])
  const [usbPrinterPorts, setUsbPrinterPorts] = useState<string[]>([])
  const [installedPrinters, setInstalledPrinters] = useState<Array<{ name: string; displayName: string; isDefault?: boolean }>>([])
  const [portsLoading, setPortsLoading] = useState(false)
  const [printersLoading, setPrintersLoading] = useState(false)
  const [showCompat, setShowCompat] = useState(false)
  const [checklist, setChecklist] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const set = (patch: Partial<PrinterConfig>) => setP((prev) => ({ ...prev, ...patch }))
  const setPort = (patch: Partial<PrinterConfig['port']>) => setP((prev) => ({ ...prev, port: { ...prev.port, ...patch } }))
  /** 真机 TCP/IP 端口用四段 IP 输入（SysIPAddress32）；非 IPv4 的既有配置仍按主机名编辑。 */
  const tcpHostValue = p.port.tcpHost ?? ''
  const tcpHostIsIpv4 = !hostnameMode
  const tcpIpSegments = (() => {
    const parts = tcpHostValue.split('.')
    return [0, 1, 2, 3].map((index) => {
      const value = (parts[index] ?? '').replace(/[^\d]/g, '')
      return value === '' ? '' : String(Math.min(255, Number(value)))
    })
  })()
  const setTcpIpSegment = (index: number, raw: string) => {
    const digits = raw.replace(/[^\d]/g, '').slice(0, 3)
    const next = [...tcpIpSegments]
    next[index] = digits
    const filled = next.every((part) => part !== '')
    setPort({ tcpHost: filled ? next.join('.') : next.slice(0, index + 1).filter((part) => part !== '').join('.') })
  }

  const refreshPorts = async () => {
    setPortsLoading(true)
    try {
      const r = await window.maxlabel.listPorts()
      const ports = r.comPorts ?? []
      const usbPorts = r.usbPrinterPorts ?? []
      setComPorts(ports)
      setUsbPrinterPorts(usbPorts)
      setP((prev) => {
        const nextPort = { ...prev.port }
        if (!nextPort.comPort && ports.length) nextPort.comPort = ports[0]
        if (!nextPort.usbPort && usbPorts.length) nextPort.usbPort = usbPorts[0]
        return { ...prev, port: nextPort }
      })
    } catch {
      setComPorts([])
      setUsbPrinterPorts([])
    } finally {
      setPortsLoading(false)
    }
  }

  const refreshPrinters = async () => {
    setPrintersLoading(true)
    try {
      const r = await window.maxlabel.listPrinters()
      setInstalledPrinters((r.printers ?? []).map((item) => ({ name: item.name, displayName: item.displayName || item.name, isDefault: item.isDefault })))
    } catch {
      setInstalledPrinters([])
    } finally {
      setPrintersLoading(false)
    }
  }

  const changePortType = (type: PortType) => setP((prev) => {
    const port = { ...prev.port, type }
    if (type === 'tcp' || type === 'cloudbox') {
      port.tcpPort = port.tcpPort ?? 9100
    } else if (type === 'com' || type === 'bluetooth') {
      // 真机「端口」页切到串行端口(COM)时的默认值：速率 9600 / 数据位 8 / 奇偶检验 无 / 停止位 1 / 流控制 无
      port.baudRate = port.baudRate ?? SERIAL_DEFAULT_BAUD_RATE
      port.dataBits = port.dataBits ?? 8
      port.parity = port.parity ?? 'none'
      port.stopBits = port.stopBits ?? 'one'
      port.flowControl = port.flowControl ?? 'none'
    } else if (type === 'lpt') {
      port.lptPort = port.lptPort ?? 'LPT1'
    }
    return { ...prev, port }
  })

  const portError = portConfigError(p.port)

  useEffect(() => {
    // 切到 COM/蓝牙/USB 时重新枚举端口候选；真机属性对话框在「类型 = USB 打印机端口」时
    // 「端口(O)」下拉已经列出设备（`USB001 (Gprinter GP-1324D)`），不需要手动点刷新。
    if (p.port.type === 'com' || p.port.type === 'bluetooth' || p.port.type === 'usb') {
      void refreshPorts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.port.type])

  useEffect(() => {
    void refreshPrinters()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = () => {
    if (portError) {
      setTab('port')
      return
    }
    if (p.saveAsDefault) {
      writeDefaultPrinter(p)
    }
    onSave(p)
    onClose()
  }

  const txtStyle = { width: '100%', minHeight: 64, boxSizing: 'border-box' as const, ...selStyle, fontFamily: 'Consolas, monospace' as const, resize: 'vertical' as const, fontSize: 12 }

  /**
   * 打印机「工具」页（真机第 4 个页签）：
   *   - 发送打印机命令：把输入的命令原样发给打印机（`print:command`）
   *   - 发送文件到打印机：把磁盘上的文件原样发给打印机（`command:send-file`；真机是点「执行」后弹「打开」对话框选文件）
   * 两条路都把结果追加到下方输出区。
   */
  const runTool = async () => {
    if (toolRunning) return
    setToolRunning(true)
    const stamp = new Date().toLocaleTimeString(language, { hour12: false })
    const detail = (result: { ok: boolean; message?: string; messageKey?: string; messageParams?: Record<string, string | number> }) =>
      (result.ok ? t('printer.tool.ok') : t('printer.tool.fail')) + (result.message ? t('printer.tool.messageSeparator') + localizeIpcMessage(language, { message: result.message, messageKey: result.messageKey, messageParams: result.messageParams }) : '')
    try {
      if (toolAction === 'send-file') {
        const path = toolFilePath.trim()
        if (!path) {
          setToolOutput((prev) => [...prev, `${stamp}  ${t('printer.tool.pickFile')}`])
          return
        }
        const result = await window.maxlabel.printCommandFile({ filePath: path, port: p.port })
        setToolOutput((prev) => [...prev, `${stamp}  ${t('printer.tool.sentFile', { path, result: detail(result) })}`])
      } else {
        const text = toolCommand
        if (!text.trim()) {
          setToolOutput((prev) => [...prev, `${stamp}  ${t('printer.tool.enterCommand')}`])
          return
        }
        const result = await window.maxlabel.printCommand({ text, encoding: p.port.encoding, port: p.port, language })
        setToolOutput((prev) => [...prev, `${stamp}  ${t('printer.tool.sentCommand', { bytes: new TextEncoder().encode(text).length, result: detail(result) })}`])
      }
    } catch (error) {
      setToolOutput((prev) => [...prev, `${stamp}  ${t('printer.tool.failed', { message: error instanceof Error ? error.message : String(error) })}`])
    } finally {
      setToolRunning(false)
    }
  }

  const pickToolFile = async () => {
    const picked = await window.maxlabel.pickFile({ filters: [{ name: L('打印指令 / 固件文件'), extensions: ['prn', 'txt', 'bin', 'zpl', 'tspl', 'cpcl'] }, { name: L('所有文件'), extensions: ['*'] }] })
    if (picked?.ok && picked.path) setToolFilePath(picked.path)
  }

  return (
    <Modal
      // 真机标题 = **设备名 + `属性`**（`parity/reference/labelshop/probe-15-cloudbox-port.png`：
      // `Gprinter GPL-N (203 dpi) 属性`）。没有显式选打印机时回退到系统默认打印机名，不写死自造标题。
      title={t('printer.title', { name: printer.printerName?.trim() || installedPrinters.find((item) => item.isDefault)?.displayName || installedPrinters[0]?.displayName || t('printer.default') })}
      testId="printer-settings-dialog"
      onClose={onClose}
      width={660}
      footer={
        <>
          <button type="button" data-testid="printer-settings-save" onClick={save} disabled={!!portError} title={portError ?? undefined} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #2E6E93', background: portError ? '#A8B8C1' : '#2E6E93', color: '#fff', cursor: portError ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}>
            {t('common.ok')}
          </button>
          <button type="button" data-testid="printer-settings-cancel" onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            {t('common.cancel')}
          </button>
          <button type="button" data-testid="printer-settings-help" onClick={onHelp} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            {t('options.help')}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #ECEBE6', marginBottom: 14 }}>
        <button type="button" data-testid="printer-settings-prefs-tab" style={TAB_STYLE(tab === 'prefs')} onClick={() => setTab('prefs')}>{t('printer.tab.prefs')}</button>
        <button type="button" data-testid="printer-settings-port-tab" style={TAB_STYLE(tab === 'port')} onClick={() => setTab('port')}>{t('printer.tab.port')}</button>
        <button type="button" data-testid="printer-settings-command-tab" style={TAB_STYLE(tab === 'cmd')} onClick={() => setTab('cmd')}>{t('printer.tab.cmd')}</button>
        {/* 真机 `Gprinter GPL-N (203 dpi) 属性` 的第 4 个页签（PROBE-round106.md §6） */}
        <button type="button" data-testid="printer-settings-tools-tab" style={TAB_STYLE(tab === 'tools')} onClick={() => setTab('tools')}>{t('printer.tab.tools')}</button>
      </div>

      <TabPanels>
      <TabPanel active={tab === 'prefs'}>
        <>
          <FormField label={t('printer.pref.windowsPrinter')} hint={L('模板会记住该打印机；留空时使用系统默认打印机')}>
            <select data-testid="printer-pref-name" value={p.printerName ?? ''} onChange={(e) => set({ printerName: e.target.value || undefined })} style={fullStyle} disabled={printersLoading}>
              <option value="">{t('printer.pref.systemDefault')}</option>
              {p.printerName && !installedPrinters.some((item) => item.name === p.printerName) && <option value={p.printerName}>{t('printer.pref.currentTemplate', { name: p.printerName })}</option>}
              {installedPrinters.map((item) => <option key={item.name} value={item.name}>{item.displayName}</option>)}
            </select>
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <FormField label={t('printer.pref.speed')} hint={L('适当降低可提升打印效果')}>
              <input data-testid="printer-pref-speed" type="number" min={1} max={6} step={1} value={p.speed} onChange={(e) => set({ speed: boundedNumber(e.target.value, p.speed, 1, 6) })} style={numStyle} />
            </FormField>
            <FormField label={t('printer.pref.density')} hint={L('打印深度，数值以最终打印为准')}>
              <input data-testid="printer-pref-density" type="number" min={1} max={15} step={1} value={p.density} onChange={(e) => set({ density: boundedNumber(e.target.value, p.density, 1, 15) })} style={numStyle} />
            </FormField>
            <FormField label={t('printer.pref.mode')}>
              <select data-testid="printer-pref-print-mode" value={p.printMode} onChange={(e) => set({ printMode: e.target.value as PrinterConfig['printMode'] })} style={selStyle}>
                <option value="default">{L('打印机默认')}</option>
                <option value="thermal">{L('热敏')}</option>
                <option value="transfer">{L('热转印')}</option>
              </select>
            </FormField>
            <FormField label={t('printer.pref.labelType')} hint={L('根据介质选择感测定位方式')}>
              <select data-testid="printer-pref-label-type" value={p.labelType} onChange={(e) => set({ labelType: e.target.value as PrinterConfig['labelType'] })} style={selStyle}>
                <option value="default">{L('打印机默认')}</option>
                <option value="continuous">{L('连续纸')}</option>
                <option value="gap">{L('间隔定位的标签')}</option>
                <option value="mark">{L('标记定位的标签')}</option>
              </select>
            </FormField>
            <FormField label={t('printer.pref.offset')} hint={L('标签顶部整体偏移，可正可负')}>
              <input data-testid="printer-pref-top-offset" type="number" min={-1000} max={1000} step={0.5} value={p.topOffsetMm} onChange={(e) => set({ topOffsetMm: boundedNumber(e.target.value, p.topOffsetMm, -1000, 1000) })} style={numStyle} />
            </FormField>
            <FormField label={L('介质处理')}>
              <select data-testid="printer-pref-media-handle" value={p.mediaHandle} onChange={(e) => set({ mediaHandle: e.target.value as PrinterConfig['mediaHandle'] })} style={selStyle}>
                <option value="tear">{L('撕纸')}</option>
                <option value="peel">{L('剥离')}</option>
                <option value="cut">{L('切纸')}</option>
                <option value="none">{L('无')}</option>
              </select>
            </FormField>
            <FormField label={t('printer.pref.backfeed')} hint={L('打印完后额外送出的标签长度')}>
              <input data-testid="printer-pref-backfeed" type="number" min={0} max={1000} step={0.5} value={p.backfeedMm} onChange={(e) => set({ backfeedMm: boundedNumber(e.target.value, p.backfeedMm, 0, 1000) })} style={numStyle} />
            </FormField>
            <FormField label={L('分辨率 (DPI)')}>
              <select data-testid="printer-pref-dpi" value={p.dpi} onChange={(e) => set({ dpi: parseInt(e.target.value, 10) })} style={selStyle}>
                <option value={203}>203 dpi</option>
                <option value={300}>300 dpi</option>
                <option value={600}>600 dpi</option>
              </select>
            </FormField>
          </div>
          <label style={{ fontSize: 13, color: '#1A1B1C', display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <input data-testid="printer-pref-save-default" type="checkbox" checked={!!p.saveAsDefault} onChange={(e) => set({ saveAsDefault: e.target.checked })} />
            {L('保存为默认值（后续使用此打印机的模板默认采用本配置，优先级高于打印机机身配置）')}
          </label>
          <div style={{ marginTop: 12, fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
            <div data-testid="printer-pref-fidelity-note">{L('特别说明：若调整打印速度和打印浓度后，仍无法打印出理想效果，可升级更高精度的打印机以满足要求。')}</div>
            <div data-testid="printer-pref-priority-note" style={{ marginTop: 4 }}>{L('特别说明：通常情况下，MaxLabel打印机属性配置项，打印时优先级高于打印机机身配置。')}</div>
          </div>
          {/* 复刻版扩展：真机属性表底排只有 `确定 / 取消 / 帮助`，没有「恢复默认」；本按钮按扩展区口径保留（不静默删功能） */}
          <div data-testid="printer-extensions" style={{ marginTop: 14, border: '1px dashed #C8C6BF', borderRadius: 8, padding: '10px 12px', background: '#FAFAF8' }}>
            <div style={{ fontSize: 11, color: '#8A8880', marginBottom: 8 }}>{L('复刻版扩展（原版打印机属性中无此项）')}</div>
            <button type="button" data-testid="printer-settings-reset" onClick={() => setP(defaultPrinterConfig())} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#2E6E93' }}>
              {L('恢复默认')}
            </button>
          </div>
        </>
      </TabPanel>

      <TabPanel active={tab === 'port'}>
        <div data-testid="printer-settings-port" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.6 }}>
            {L('输出端口：类型(I): 与端口(O) 两项，逐项照抄真机「<打印机名> 属性 → 端口」对话框。\nLPT、串行端口(COM)、标准 TCP/IP、USB、蓝牙、蜂打打云盒与 Windows 打印机驱动端口均可按打印机连接方式配置。')}
          </div>
          {/* 加速键取真机原文 `类型(I):`（同态并排图 parity/review/cmp-printerportbox-r119.png：
              两侧「类型」都 = 蜂打打云盒）；复刻版曾写成 `类型(T)`。 */}
          <FormField label={L('类型(I):')}>
            <select data-testid="printer-port-type" value={p.port.type} onChange={(e) => changePortType(e.target.value as PortType)} style={fullStyle}>
              {PORT_TYPE_OPTIONS.filter((option) => isWindows || option.value !== 'lpt').map((option) => <option key={option.value} value={option.value}>{L(option.label)}</option>)}
              <option value="file">{L('打印到文件')}</option>
            </select>
          </FormField>
          <FormField label={t('printer.port.params')}>
            {(p.port.type === 'tcp' || p.port.type === 'cloudbox') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {p.port.type === 'cloudbox' ? (
                  /* 真机「类型 = 蜂打打云盒」时参数区是「云盒：下拉 + 设置」按钮（probe-15-cloudbox-port.png）；
                     复刻版没有云盒发现协议，下拉里恒为「未检测到云盒」，点「设置」可手工填地址。 */
                  <>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select data-testid="printer-port-cloudbox" value={p.port.tcpHost ?? ''} onChange={(e) => setPort({ tcpHost: e.target.value || undefined })} style={{ ...fullStyle, flex: 1 }}>
                        <option value="">{L('未检测到云盒')}</option>
                        {p.port.tcpHost && <option value={p.port.tcpHost}>{L('当前配置：')}{p.port.tcpHost}</option>}
                      </select>
                      <button type="button" data-testid="printer-port-cloudbox-setup" onClick={() => setCloudBoxSetup((prev) => !prev)} style={{ ...selStyle, width: 86, cursor: 'pointer' }}>{L('设置')}</button>
                    </div>
                    {cloudBoxSetup && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input data-testid="printer-port-host" aria-label={L('云盒地址')} value={p.port.tcpHost ?? ''} onChange={(e) => setPort({ tcpHost: e.target.value })} style={numStyle} placeholder={L('云盒 IP / 主机名')} />
                        <input data-testid="printer-port-number" aria-label={L('云盒端口')} type="number" min={1} max={65535} value={p.port.tcpPort ?? 9100} onChange={(e) => setPort({ tcpPort: boundedNumber(e.target.value, 9100, 1, 65535) })} style={{ ...numStyle, width: 100 }} />
                      </div>
                    )}
                    <div data-testid="printer-port-cloudbox-hint" style={{ fontSize: 12, color: '#6B7280' }}>{L('蜂打打云盒：从下拉选择云盒后按端口输出指令（默认 9100）；未检测到云盒时可点「设置」手工填写地址。')}</div>
                  </>
                ) : (
                  /* 真机「类型 = 标准 TCP/IP 打印机端口」的参数区是 `SysIPAddress32` 四段 IP + 端口号 + 设置（probe-14）；
                     复刻版照做四段输入，另外保留「主机名」写法（真机控件只收 IP，我们允许主机名，属超集）。 */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {tcpHostIsIpv4 ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} data-testid="printer-port-ip">
                        {[0, 1, 2, 3].map((index) => (
                          <span key={index} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {index > 0 && <span style={{ color: '#6B7280' }}>.</span>}
                            <input
                              data-testid={`printer-port-ip-${index + 1}`}
                              aria-label={`${L('IP 段')} ${index + 1}`}
                              inputMode="numeric"
                              value={tcpIpSegments[index]}
                              onChange={(e) => setTcpIpSegment(index, e.target.value)}
                              style={{ ...numStyle, width: 62, textAlign: 'center' }}
                            />
                          </span>
                        ))}
                        <input data-testid="printer-port-number" aria-label={L('TCP 端口号')} type="number" min={1} max={65535} value={p.port.tcpPort ?? 9100} onChange={(e) => setPort({ tcpPort: boundedNumber(e.target.value, 9100, 1, 65535) })} style={{ ...numStyle, width: 90 }} />
                        <button type="button" data-testid="printer-port-hostname-toggle" onClick={() => setHostnameMode(true)} style={{ ...selStyle, width: 104, cursor: 'pointer' }}>{L('按主机名填写')}</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input data-testid="printer-port-host" aria-label={L('TCP 地址')} value={p.port.tcpHost ?? ''} onChange={(e) => setPort({ tcpHost: e.target.value })} style={numStyle} placeholder="printer.local" />
                        <input data-testid="printer-port-number" aria-label={L('TCP 端口号')} type="number" min={1} max={65535} value={p.port.tcpPort ?? 9100} onChange={(e) => setPort({ tcpPort: boundedNumber(e.target.value, 9100, 1, 65535) })} style={{ ...numStyle, width: 90 }} />
                        <button type="button" data-testid="printer-port-hostname-toggle" onClick={() => setHostnameMode(false)} style={{ ...selStyle, width: 88, cursor: 'pointer' }}>{L('按 IP 填写')}</button>
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{tcpHostIsIpv4 ? L('真机该端口用四段 IP 输入（SysIPAddress32）。') : L('当前配置不是 IPv4 地址（主机名写法）；真机控件只收 IP，这里保留主机名兼容。')}</div>
                  </div>
                )}
              </div>
            )}
            {(p.port.type === 'com' || p.port.type === 'bluetooth') && (
              <div style={{ display: 'flex', gap: 8 }}>
                <select data-testid="printer-port-com" value={p.port.comPort ?? ''} onChange={(e) => setPort({ comPort: e.target.value })} style={{ ...fullStyle, flex: 1 }} disabled={portsLoading}>
                {portsLoading && <option value="">{L('正在检测…')}</option>}
                {!portsLoading && comPorts.length === 0 && <option value="">{L('未检测到串口')}</option>}
                {p.port.comPort && !comPorts.includes(p.port.comPort) && <option value={p.port.comPort}>{L('当前配置：')}{p.port.comPort}</option>}
                {comPorts.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button type="button" data-testid="printer-port-refresh" onClick={() => void refreshPorts()} disabled={portsLoading} style={{ ...selStyle, width: 86, cursor: portsLoading ? 'wait' : 'pointer' }}>{t('printer.port.refresh')}</button>
              </div>
            )}
            {p.port.type === 'lpt' && (
              <input data-testid="printer-port-lpt" value={p.port.lptPort ?? 'LPT1'} onChange={(e) => setPort({ lptPort: e.target.value.toUpperCase() })} style={fullStyle} placeholder="LPT1" />
            )}
            {p.port.type === 'usb' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select data-testid="printer-port-usb" value={p.port.usbPort ?? ''} onChange={(e) => setPort({ usbPort: e.target.value || undefined })} style={{ ...fullStyle, flex: 1 }} disabled={portsLoading}>
                    {portsLoading && <option value="">{L('正在检测…')}</option>}
                    {!portsLoading && usbPrinterPorts.length === 0 && <option value="">{L('未检测到 USB 打印机端口')}</option>}
                    {p.port.usbPort && !usbPrinterPorts.includes(p.port.usbPort) && <option value={p.port.usbPort}>{L('当前配置：')}{p.port.usbPort}</option>}
                    {usbPrinterPorts.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <button type="button" data-testid="printer-port-refresh-usb" onClick={() => void refreshPorts()} disabled={portsLoading} style={{ ...selStyle, width: 106, cursor: portsLoading ? 'wait' : 'pointer' }}>{t('printer.port.refreshUsb')}</button>
                </div>
                <div data-testid="printer-port-usb-hint" style={{ fontSize: 12, color: '#6B7280' }}>{L('请连接USB打印机，并打开打印机电源。')}</div>
              </div>
            )}
            {p.port.type === 'driver' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select data-testid="printer-port-driver-printer" value={p.printerName ?? ''} onChange={(e) => set({ printerName: e.target.value || undefined })} style={{ ...fullStyle, flex: 1 }} disabled={printersLoading}>
                  <option value="">{t('printer.pref.systemDefault')}</option>
                  {p.printerName && !installedPrinters.some((item) => item.name === p.printerName) && <option value={p.printerName}>{L('当前配置：')}{p.printerName}</option>}
                  {installedPrinters.map((item) => <option key={item.name} value={item.name}>{item.displayName}</option>)}
                </select>
                <button type="button" data-testid="printer-port-refresh-printers" onClick={() => void refreshPrinters()} disabled={printersLoading} style={{ ...selStyle, width: 86, cursor: printersLoading ? 'wait' : 'pointer' }}>{L('刷新打印机')}</button>
              </div>
            )}
            {p.port.type === 'driver' && <div style={{ fontSize: 12, color: '#6B7280' }}>{L('选择已安装的 Windows 打印机驱动型号及其端口。')}</div>}
            {p.port.type === 'com' && <div data-testid="printer-port-com-hint" style={{ fontSize: 12, color: '#6B7280' }}>{L('COM 端口使用系统检测到的串口；请按打印机实际串口选择。')}</div>}
            {p.port.type === 'bluetooth' && <div data-testid="printer-port-bluetooth-hint" style={{ fontSize: 12, color: '#6B7280' }}>{L('蓝牙打印机需先在 Windows 蓝牙设置中配对；MaxLabel 通过系统分配的 SPP 虚拟 COM 端口连接。')}</div>}
            {p.port.type === 'cloudbox' && <div data-testid="printer-port-cloudbox-hint" style={{ fontSize: 12, color: '#6B7280' }}>{L('蜂打打云盒按网络端口输出指令：填写云盒的 IP 与端口（默认 9100）。')}</div>}
            {p.port.type === 'file' && <div style={{ fontSize: 12, color: '#6B7280' }}>{L('输出打印机指令文件。')}</div>}
          </FormField>
          {(p.port.type === 'com' || p.port.type === 'bluetooth') && (
            <>
              {/* 真机「端口」页串行端口的 5 项参数：速率(B) / 数据位(D) / 奇偶检验(P) / 停止位(S) / 流控制(F) */}
              <FormField label={L('速率(B)')}>
                <select data-testid="printer-port-baud" value={p.port.baudRate ?? SERIAL_DEFAULT_BAUD_RATE} onChange={(e) => setPort({ baudRate: parseInt(e.target.value, 10) })} style={fullStyle}>
                  {SERIAL_BAUD_RATES.map((rate) => <option key={rate} value={rate}>{rate}</option>)}
                </select>
              </FormField>
              <FormField label={L('数据位(D)')}>
                <select data-testid="printer-port-databits" value={p.port.dataBits ?? 8} onChange={(e) => setPort({ dataBits: Number(e.target.value) === 7 ? 7 : 8 })} style={fullStyle}>
                  {SERIAL_DATA_BITS.map((bits) => <option key={bits} value={bits}>{bits}</option>)}
                </select>
              </FormField>
              <FormField label={L('奇偶检验(P)')}>
                <select data-testid="printer-port-parity" value={p.port.parity ?? 'none'} onChange={(e) => setPort({ parity: e.target.value as PortConfig['parity'] })} style={fullStyle}>
                  {SERIAL_PARITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{L(option.label)}</option>)}
                </select>
              </FormField>
              <FormField label={L('停止位(S)')}>
                <select data-testid="printer-port-stopbits" value={p.port.stopBits ?? 'one'} onChange={(e) => setPort({ stopBits: e.target.value as PortConfig['stopBits'] })} style={fullStyle}>
                  {SERIAL_STOP_BITS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{L(option.label)}</option>)}
                </select>
              </FormField>
              <FormField label={L('流控制(F)')}>
                <select data-testid="printer-port-flow" value={p.port.flowControl ?? 'none'} onChange={(e) => setPort({ flowControl: e.target.value as PortConfig['flowControl'] })} style={fullStyle}>
                  {SERIAL_FLOW_OPTIONS.map((option) => <option key={option.value} value={option.value}>{L(option.label)}</option>)}
                </select>
              </FormField>
            </>
          )}
          {/* 复刻版扩展：真机该页（及 MaxLabel「标签格式设置」四页）都没有「指令编码」——round-121 取证
              （r121-lfs-printer-page.txt 全页无「编码」；probe-15-cloudbox-port.png 端口页也无） */}
          <FormField label={L('指令编码')} hint={L('复刻版扩展（原版该对话框无此项）')}>
            <select data-testid="printer-port-encoding" value={p.port.encoding} onChange={(e) => setPort({ encoding: e.target.value as 'utf8' | 'gbk' })} style={fullStyle}>
              <option value="utf8">UTF-8</option>
              <option value="gbk">GBK / GB18030</option>
            </select>
          </FormField>
          {portError && <div data-testid="printer-port-error" role="alert" style={{ color: '#B42318', fontSize: 12, padding: '8px 10px', borderRadius: 6, background: '#FEF3F2' }}>{portError}</div>}
        </div>
      </TabPanel>

      <TabPanel active={tab === 'cmd'}>
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <FormField label={L('指令集')}>
              <select
                value={p.driver}
                onChange={(e) => {
                  const driver = e.target.value as PrinterConfig['driver']
                  set(driver === 'escpos' && !p.escposProfile
                    ? { driver, escposProfile: recommendEscPosProfile(p.model ?? p.printerName ?? '') }
                    : { driver })
                }}
                style={selStyle}
              >
                <option value="tspl">{L('TSPL（国产标签机：佳博/得力/汉印/芯烨/启锐等）')}</option>
                <option value="zpl">{L('ZPL（Zebra 及兼容机）')}</option>
                <option value="cpcl">{L('CPCL（面单/便携机）')}</option>
                <option value="escpos">{L('ESC/POS（热敏票据/标签机）')}</option>
              </select>
            </FormField>
            {p.driver === 'escpos' && (
              <>
                <FormField label={L('ESC/POS 档案')}>
                  <select data-testid="escpos-profile" value={p.escposProfile ?? 'generic'} onChange={(e) => set({ escposProfile: e.target.value })} style={selStyle}>
                    <option value="generic">{L('通用（保守）')}</option>
                    <option value="epson-tm-t88">Epson TM-T88</option>
                    <option value="epson-tm-t82">Epson TM-T82</option>
                    <option value="xprinter-xp-58">Xprinter XP-58</option>
                  </select>
                </FormField>
                <FormField label={L('纸张宽度')}>
                  <select data-testid="escpos-paper-width" value={p.escposPaperWidthMm ?? 80} onChange={(e) => set({ escposPaperWidthMm: Number(e.target.value) as 58 | 80 })} style={selStyle}>
                    <option value={58}>58 mm</option>
                    <option value={80}>80 mm</option>
                  </select>
                </FormField>
                <FormField label={L('代码页')}>
                  <select data-testid="escpos-code-page" value={p.escposCodePage ?? 'CP437'} onChange={(e) => set({ escposCodePage: e.target.value })} style={selStyle}>
                    <option value="CP437">CP437</option>
                    <option value="CP850">CP850</option>
                    <option value="CP1252">CP1252</option>
                    <option value="CP936">{L('CP936（中文）')}</option>
                  </select>
                </FormField>
                <FormField label={L('切纸')}>
                  <select data-testid="escpos-cut" value={p.escposCut ?? 'none'} onChange={(e) => set({ escposCut: e.target.value as PrinterConfig['escposCut'] })} style={selStyle}>
                    <option value="none">{L('不切纸')}</option>
                    <option value="full">{L('全切')}</option>
                    <option value="partial">{L('半切')}</option>
                  </select>
                </FormField>
                <FormField label={L('钱箱')}>
                  <select data-testid="escpos-drawer" value={p.escposDrawer ?? 'none'} onChange={(e) => set({ escposDrawer: e.target.value as PrinterConfig['escposDrawer'] })} style={selStyle}>
                    <option value="none">{L('不触发')}</option>
                    <option value="pin2">{L('引脚 2')}</option>
                    <option value="pin5">{L('引脚 5')}</option>
                  </select>
                </FormField>
                <FormField label={L('走纸行数')}>
                  <input data-testid="escpos-feed-lines" type="number" min={0} max={10} value={p.escposFeedLines ?? 0} onChange={(e) => set({ escposFeedLines: Math.max(0, Math.min(10, parseInt(e.target.value || '0', 10))) })} style={numStyle} />
                </FormField>
              </>
            )}
            <FormField label={L('指令编码')} hint={L('中文内容时建议 GBK；佳博等部分机型支持 UTF-8')}>
              <select value={p.port.encoding} onChange={(e) => setPort({ encoding: e.target.value as 'utf8' | 'gbk' })} style={selStyle}>
                <option value="utf8">UTF-8</option>
                <option value="gbk">GBK / GB18030</option>
              </select>
            </FormField>
            <FormField label={L('端口')}>
              <select value={p.port.type} onChange={(e) => changePortType(e.target.value as PortType)} style={selStyle}>
                <option value="driver">{L('Windows 打印机驱动（图形打印）')}</option>
                <option value="file">{L('打印到文件（生成指令文件）')}</option>
                <option value="tcp">{L('TCP/IP 网络直连')}</option>
                <option value="com">{L('串口 COM 直连')}</option>
                <option value="lpt">{L('并口 LPT 直连')}</option>
                <option value="usb">{L('USB（请使用驱动或映射为 COM）')}</option>
                <option value="bluetooth">{L('蓝牙（SPP 虚拟串口）')}</option>
              </select>
            </FormField>
            <FormField label={t('printer.port.params')}>
              {p.port.type === 'tcp' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={p.port.tcpHost ?? ''} onChange={(e) => setPort({ tcpHost: e.target.value })} style={numStyle} placeholder="192.168.1.100" />
                  <input type="number" min={1} max={65535} value={p.port.tcpPort ?? 9100} onChange={(e) => setPort({ tcpPort: boundedNumber(e.target.value, 9100, 1, 65535) })} style={{ ...numStyle, width: 80 }} />
                </div>
              )}
              {(p.port.type === 'com' || p.port.type === 'bluetooth') && (
                <select value={p.port.comPort ?? ''} onChange={(e) => setPort({ comPort: e.target.value })} style={selStyle} disabled={portsLoading}>
                  {portsLoading && <option value="">{L('正在检测…')}</option>}
                  {!portsLoading && comPorts.length === 0 && <option value="">{L('未检测到串口')}</option>}
                  {comPorts.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
              {p.port.type === 'lpt' && (
                <input value={p.port.lptPort ?? 'LPT1'} onChange={(e) => setPort({ lptPort: e.target.value.toUpperCase() })} style={numStyle} placeholder="LPT1" />
              )}
              {p.port.type !== 'tcp' && p.port.type !== 'com' && p.port.type !== 'bluetooth' && p.port.type !== 'lpt' && (
                <div style={{ fontSize: 12, color: '#9AA0A6', padding: '6px 2px' }}>{p.port.type === 'driver' ? L('使用 Windows 驱动图形打印') : p.port.type === 'file' ? L('输出到指令文件') : L('USB 原生直连尚未提供；请安装驱动或映射为 COM 端口')}</div>
              )}
            </FormField>
            {(p.port.type === 'com' || p.port.type === 'bluetooth') && (
              <FormField label={L('波特率')}>
                <select value={p.port.baudRate ?? SERIAL_DEFAULT_BAUD_RATE} onChange={(e) => setPort({ baudRate: parseInt(e.target.value, 10) })} style={selStyle}>
                  {SERIAL_BAUD_RATES.map((rate) => <option key={rate} value={rate}>{rate}</option>)}
                </select>
              </FormField>
            )}
          </div>

          <div data-testid="printer-custom-command-section">
            <div data-testid="printer-custom-command-reference" style={{ fontSize: 12, color: '#6B7280', margin: '10px 0 4px' }}>{L('自定义命令（可自定义打印机参数命令、标签内容命令和打印后处理命令，参考对应打印机开发手册）：')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <FormField label={L('打印机参数命令（作业开始前发送）')} hint={L('如初始化/复位参数')}>
              <textarea value={p.preCmd ?? ''} onChange={(e) => set({ preCmd: e.target.value })} style={txtStyle} placeholder={L('例如 TSPL：\nSIZE 60 mm,40 mm\nGAP 2 mm,0 mm\nDENSITY 8\nSPEED 4')} />
            </FormField>
            <FormField label={L('标签内容命令（每张标签内容前发送）')}>
              <textarea value={p.contentCmd ?? ''} onChange={(e) => set({ contentCmd: e.target.value })} style={txtStyle} placeholder={L('例如：\n// 每张标签前的固定命令')} />
            </FormField>
            <FormField label={L('打印后处理命令（作业结束后发送）')} hint={L('如切纸/回退')}>
              <textarea value={p.postCmd ?? ''} onChange={(e) => set({ postCmd: e.target.value })} style={txtStyle} placeholder={L('例如 TSPL：\nCUT ON')} />
            </FormField>
          </div>
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} style={{ ...numStyle, width: 120 }} placeholder={L('品牌（可选）')} />
            <input value={model} onChange={(e) => setModel(e.target.value)} style={{ ...numStyle, width: 140 }} placeholder={L('型号（可选）')} />
            <button
              type="button"
              onClick={() => {
                const rec = recommendEngine(model, brand)
                setChecklist(buildCompatChecklist(p))
                setCopied(false)
                setP((prev) => ({ ...prev, driver: rec.engine }))
              }}
              style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              {L('按品牌推荐并生成清单')}
            </button>
            <button type="button" onClick={() => setShowCompat((s) => !s)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
              {showCompat ? L('收起兼容矩阵') : L('查看兼容矩阵')}
            </button>
            <span style={{ fontSize: 12, color: '#6B7280' }}>
              {L('推荐：')}<b>{recommendEngine(model, brand).engine.toUpperCase()}</b> ({L(recommendEngine(model, brand).reason)})
            </span>
          </div>

          {checklist.length > 0 && (
            <div style={{ marginTop: 10, border: '1px solid #E4E3DD', borderRadius: 10, padding: 10, background: '#FAF9F6' }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>{L('真机验证清单（{count} 项）').replace('{count}', String(checklist.length))}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(checklist.map((c, i) => `${i + 1}. ${c}`).join('\n')).then(() => setCopied(true)).catch(() => undefined)
                  }}
                  style={{ fontSize: 12, color: '#2E6E93', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {copied ? L('已复制 ✓') : L('复制')}
                </button>
              </div>
              {checklist.map((c, i) => (
                <div key={i} style={{ fontSize: 12, color: '#1A1B1C', padding: '2px 0' }}>
                  {i + 1}. {c}
                </div>
              ))}
            </div>
          )}

          {showCompat && (
            <div style={{ marginTop: 10, border: '1px solid #E4E3DD', borderRadius: 10, overflow: 'auto', maxHeight: 260 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#F4F3EE' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #E4E3DD' }}>{L('品牌 / 系列')}</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #E4E3DD' }}>{L('常用指令集')}</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #E4E3DD' }}>DPI</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #E4E3DD' }}>{L('说明')}</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPAT_MATRIX.map((e, i) => (
                    <tr key={i}>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid #F0EFEA', whiteSpace: 'nowrap' }}>{e.brand} {e.model}</td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid #F0EFEA', whiteSpace: 'nowrap' }}>{e.engines.join(' / ')}</td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid #F0EFEA', whiteSpace: 'nowrap' }}>{e.dpi.join('/')}</td>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid #F0EFEA' }}>{e.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: '#9AA0A6', padding: 6 }}>{L('数据来源：厂商公开 SDK / 官方文档；矩阵为参考口径，正式发售前需按清单对代表机型实测。')}</div>
            </div>
          )}
        </>
      </TabPanel>

      <TabPanel active={tab === 'tools'}>
        <div data-testid="printer-settings-tools" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1B1C' }}>{L('常用')}</div>
          <FormField label={L('操作')}>
            <select data-testid="printer-tools-action" value={toolAction} onChange={(e) => setToolAction(e.target.value as 'send-command' | 'send-file')} style={fullStyle}>
              <option value="send-command">{L('发送打印机命令')}</option>
              <option value="send-file">{L('发送文件到打印机')}</option>
            </select>
          </FormField>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              data-testid="printer-tools-run"
              onClick={() => void runTool()}
              disabled={toolRunning}
              style={{ padding: '9px 30px', borderRadius: 8, border: '1px solid #2E6E93', background: toolRunning ? '#A8B8C1' : '#2E6E93', color: '#fff', cursor: toolRunning ? 'wait' : 'pointer', fontSize: 13, fontFamily: 'inherit' }}
            >
              {L('执行')}
            </button>
          </div>
          {toolAction === 'send-command' ? (
            <FormField label={L('打印机命令')} hint={L('按当前端口直接发送；例如 TSPL：SIZE 100 mm,150 mm / ZPL：^XA…^XZ')}>
              <textarea data-testid="printer-tools-command" value={toolCommand} onChange={(e) => setToolCommand(e.target.value)} style={txtStyle} placeholder="SIZE 100 mm,150 mm" />
            </FormField>
          ) : (
            <FormField label={L('文件')} hint={L('真机点「执行」后弹「打开」对话框选文件；此处可直接填路径或点右侧按钮选择')}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input data-testid="printer-tools-file" value={toolFilePath} onChange={(e) => setToolFilePath(e.target.value)} style={{ ...selStyle, flex: 1 }} placeholder="D:\\print\\label.prn" />
                <button type="button" data-testid="printer-tools-browse" onClick={() => void pickToolFile()} style={{ ...selStyle, width: 96, cursor: 'pointer' }}>{L('选择文件…')}</button>
              </div>
            </FormField>
          )}
          <div style={{ fontSize: 12, color: '#6B7280' }}>{L('输出端口：')}{p.port.type}{L('（如需改端口请到「端口」页）')}</div>
          <div data-testid="printer-tools-output" style={{ minHeight: 160, maxHeight: 220, overflow: 'auto', border: '1px solid #D5D4CD', background: '#fff', padding: 8, fontFamily: 'Consolas, monospace', fontSize: 12, whiteSpace: 'pre-wrap', color: '#1A1B1C' }}>
            {toolOutput.length ? toolOutput.join('\n') : ''}
          </div>
        </div>
      </TabPanel>
      </TabPanels>
    </Modal>
  )
}
