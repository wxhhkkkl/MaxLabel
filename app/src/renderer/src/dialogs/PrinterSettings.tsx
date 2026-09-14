import { useEffect, useState } from 'react'
import { COMMON_BAUD_RATES, portConfigError, type PortType, type PrinterConfig } from '../types'
import { defaultPrinterConfig } from '../types'
import { buildCompatChecklist, COMPAT_MATRIX, recommendEngine } from '../../../shared/print/compat'
import { writeDefaultPrinter } from '../features/shell/printerPreferences'
import Modal, { FormField, selStyle } from './Modal'

interface Props {
  printer: PrinterConfig
  onClose: () => void
  onSave: (p: PrinterConfig) => void
}

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

export default function PrinterSettings({ printer, onClose, onSave }: Props) {
  const [p, setP] = useState<PrinterConfig>(printer)
  const [tab, setTab] = useState<'prefs' | 'port' | 'cmd'>('prefs')
  const [comPorts, setComPorts] = useState<string[]>([])
  const [installedPrinters, setInstalledPrinters] = useState<Array<{ name: string; displayName: string }>>([])
  const [portsLoading, setPortsLoading] = useState(false)
  const [printersLoading, setPrintersLoading] = useState(false)
  const [showCompat, setShowCompat] = useState(false)
  const [checklist, setChecklist] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const set = (patch: Partial<PrinterConfig>) => setP((prev) => ({ ...prev, ...patch }))
  const setPort = (patch: Partial<PrinterConfig['port']>) => setP((prev) => ({ ...prev, port: { ...prev.port, ...patch } }))

  const refreshPorts = async () => {
    setPortsLoading(true)
    try {
      const r = await window.maxlabel.listPorts()
      const ports = r.comPorts ?? []
      setComPorts(ports)
      setP((prev) => prev.port.comPort || !ports.length
        ? prev
        : { ...prev, port: { ...prev.port, comPort: ports[0] } })
    } catch {
      setComPorts([])
    } finally {
      setPortsLoading(false)
    }
  }

  const refreshPrinters = async () => {
    setPrintersLoading(true)
    try {
      const r = await window.maxlabel.listPrinters()
      setInstalledPrinters((r.printers ?? []).map((item) => ({ name: item.name, displayName: item.displayName || item.name })))
    } catch {
      setInstalledPrinters([])
    } finally {
      setPrintersLoading(false)
    }
  }

  const changePortType = (type: PortType) => setP((prev) => {
    const port = { ...prev.port, type }
    if (type === 'tcp') {
      port.tcpPort = port.tcpPort ?? 9100
    } else if (type === 'com' || type === 'bluetooth') {
      port.baudRate = port.baudRate ?? 115200
    } else if (type === 'lpt') {
      port.lptPort = port.lptPort ?? 'LPT1'
    }
    return { ...prev, port }
  })

  const portError = portConfigError(p.port)

  useEffect(() => {
    if (p.port.type === 'com' || p.port.type === 'bluetooth') {
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

  return (
    <Modal
      title="打印机设置"
      testId="printer-settings-dialog"
      onClose={onClose}
      width={660}
      footer={
        <>
          <button type="button" data-testid="printer-settings-reset" onClick={() => setP(defaultPrinterConfig())} style={{ marginRight: 'auto', padding: '7px 14px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#2E6E93' }}>
            恢复默认
          </button>
          <button type="button" data-testid="printer-settings-cancel" onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            取消
          </button>
          <button type="button" data-testid="printer-settings-save" onClick={save} disabled={!!portError} title={portError ?? undefined} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #2E6E93', background: portError ? '#A8B8C1' : '#2E6E93', color: '#fff', cursor: portError ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}>
            保存（随模板一起保存）
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #ECEBE6', marginBottom: 14 }}>
        <button type="button" data-testid="printer-settings-prefs-tab" style={TAB_STYLE(tab === 'prefs')} onClick={() => setTab('prefs')}>首选项</button>
        <button type="button" data-testid="printer-settings-port-tab" style={TAB_STYLE(tab === 'port')} onClick={() => setTab('port')}>端口</button>
        <button type="button" style={TAB_STYLE(tab === 'cmd')} onClick={() => setTab('cmd')}>自定义命令</button>
      </div>

      {tab === 'prefs' && (
        <>
          <FormField label="Windows 目标打印机" hint="模板会记住该打印机；留空时使用系统默认打印机">
            <select data-testid="printer-pref-name" value={p.printerName ?? ''} onChange={(e) => set({ printerName: e.target.value || undefined })} style={fullStyle} disabled={printersLoading}>
              <option value="">系统默认打印机</option>
              {p.printerName && !installedPrinters.some((item) => item.name === p.printerName) && <option value={p.printerName}>当前模板打印机：{p.printerName}</option>}
              {installedPrinters.map((item) => <option key={item.name} value={item.name}>{item.displayName}</option>)}
            </select>
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <FormField label="打印速度（1-6）" hint="适当降低可提升打印效果">
              <input data-testid="printer-pref-speed" type="number" min={1} max={6} step={1} value={p.speed} onChange={(e) => set({ speed: boundedNumber(e.target.value, p.speed, 1, 6) })} style={numStyle} />
            </FormField>
            <FormField label="打印浓度（1-15）" hint="打印深度，数值以最终打印为准">
              <input data-testid="printer-pref-density" type="number" min={1} max={15} step={1} value={p.density} onChange={(e) => set({ density: boundedNumber(e.target.value, p.density, 1, 15) })} style={numStyle} />
            </FormField>
            <FormField label="打印方式">
              <select data-testid="printer-pref-print-mode" value={p.printMode} onChange={(e) => set({ printMode: e.target.value as PrinterConfig['printMode'] })} style={selStyle}>
                <option value="default">打印机默认</option>
                <option value="thermal">热敏</option>
                <option value="transfer">热转印</option>
              </select>
            </FormField>
            <FormField label="标签类型" hint="根据介质选择感测定位方式">
              <select data-testid="printer-pref-label-type" value={p.labelType} onChange={(e) => set({ labelType: e.target.value as PrinterConfig['labelType'] })} style={selStyle}>
                <option value="default">打印机默认</option>
                <option value="continuous">连续纸</option>
                <option value="gap">间隔定位的标签</option>
                <option value="mark">标记定位的标签</option>
              </select>
            </FormField>
            <FormField label="顶部偏移 (mm)" hint="标签顶部整体偏移，可正可负">
              <input data-testid="printer-pref-top-offset" type="number" min={-1000} max={1000} step={0.5} value={p.topOffsetMm} onChange={(e) => set({ topOffsetMm: boundedNumber(e.target.value, p.topOffsetMm, -1000, 1000) })} style={numStyle} />
            </FormField>
            <FormField label="介质处理">
              <select data-testid="printer-pref-media-handle" value={p.mediaHandle} onChange={(e) => set({ mediaHandle: e.target.value as PrinterConfig['mediaHandle'] })} style={selStyle}>
                <option value="tear">撕纸</option>
                <option value="peel">剥离</option>
                <option value="cut">切纸</option>
                <option value="none">无</option>
              </select>
            </FormField>
            <FormField label="出纸回退 (mm)" hint="打印完后额外送出的标签长度">
              <input data-testid="printer-pref-backfeed" type="number" min={0} max={1000} step={0.5} value={p.backfeedMm} onChange={(e) => set({ backfeedMm: boundedNumber(e.target.value, p.backfeedMm, 0, 1000) })} style={numStyle} />
            </FormField>
            <FormField label="分辨率 (DPI)">
              <select data-testid="printer-pref-dpi" value={p.dpi} onChange={(e) => set({ dpi: parseInt(e.target.value, 10) })} style={selStyle}>
                <option value={203}>203 dpi</option>
                <option value={300}>300 dpi</option>
                <option value={600}>600 dpi</option>
              </select>
            </FormField>
          </div>
          <label style={{ fontSize: 13, color: '#1A1B1C', display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <input data-testid="printer-pref-save-default" type="checkbox" checked={!!p.saveAsDefault} onChange={(e) => set({ saveAsDefault: e.target.checked })} />
            保存为默认值（后续使用此打印机的模板默认采用本配置，优先级高于打印机机身配置）
          </label>
          <div style={{ marginTop: 12, fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
            提示：打印速度 / 浓度 / 打印方式 / 标签类型 / 顶部偏移 / 介质处理 / 出纸回退 与原版"打印机首选项"一致；通常 LabelShop 打印机属性配置优先级高于打印机机身配置。
          </div>
        </>
      )}

      {tab === 'port' && (
        <div data-testid="printer-settings-port" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.6 }}>
            选择打印输出端口。USB、LPT、COM、TCP/IP、蓝牙和 Windows 打印机驱动端口均可按打印机连接方式配置。
          </div>
          <FormField label="端口">
            <select data-testid="printer-port-type" value={p.port.type} onChange={(e) => changePortType(e.target.value as PortType)} style={fullStyle}>
              <option value="usb">USB 打印机端口</option>
              <option value="lpt">打印机端口（LPT）</option>
              <option value="com">打印机端口（COM）</option>
              <option value="tcp">标准 TCP/IP 打印机端口</option>
              <option value="bluetooth">蓝牙（SPP）</option>
              <option value="driver">Windows 打印机驱动端口</option>
              <option value="file">打印到文件</option>
            </select>
          </FormField>
          <FormField label="端口参数">
            {p.port.type === 'tcp' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input data-testid="printer-port-host" aria-label="TCP 地址" value={p.port.tcpHost ?? ''} onChange={(e) => setPort({ tcpHost: e.target.value })} style={numStyle} placeholder="192.168.1.100" />
                <input data-testid="printer-port-number" aria-label="TCP 端口号" type="number" min={1} max={65535} value={p.port.tcpPort ?? 9100} onChange={(e) => setPort({ tcpPort: boundedNumber(e.target.value, 9100, 1, 65535) })} style={{ ...numStyle, width: 100 }} />
              </div>
            )}
            {(p.port.type === 'com' || p.port.type === 'bluetooth') && (
              <div style={{ display: 'flex', gap: 8 }}>
                <select data-testid="printer-port-com" value={p.port.comPort ?? ''} onChange={(e) => setPort({ comPort: e.target.value })} style={{ ...fullStyle, flex: 1 }} disabled={portsLoading}>
                {portsLoading && <option value="">正在检测…</option>}
                {!portsLoading && comPorts.length === 0 && <option value="">未检测到串口</option>}
                {p.port.comPort && !comPorts.includes(p.port.comPort) && <option value={p.port.comPort}>当前配置：{p.port.comPort}</option>}
                {comPorts.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button type="button" data-testid="printer-port-refresh" onClick={() => void refreshPorts()} disabled={portsLoading} style={{ ...selStyle, width: 86, cursor: portsLoading ? 'wait' : 'pointer' }}>刷新端口</button>
              </div>
            )}
            {p.port.type === 'lpt' && (
              <input data-testid="printer-port-lpt" value={p.port.lptPort ?? 'LPT1'} onChange={(e) => setPort({ lptPort: e.target.value.toUpperCase() })} style={fullStyle} placeholder="LPT1" />
            )}
            {(p.port.type === 'usb' || p.port.type === 'driver') && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select data-testid={`printer-port-${p.port.type}-printer`} value={p.printerName ?? ''} onChange={(e) => set({ printerName: e.target.value || undefined })} style={{ ...fullStyle, flex: 1 }} disabled={printersLoading}>
                  <option value="">系统默认打印机</option>
                  {p.printerName && !installedPrinters.some((item) => item.name === p.printerName) && <option value={p.printerName}>当前配置：{p.printerName}</option>}
                  {installedPrinters.map((item) => <option key={item.name} value={item.name}>{item.displayName}</option>)}
                </select>
                <button type="button" data-testid="printer-port-refresh-printers" onClick={() => void refreshPrinters()} disabled={printersLoading} style={{ ...selStyle, width: 86, cursor: printersLoading ? 'wait' : 'pointer' }}>刷新打印机</button>
              </div>
            )}
            {p.port.type === 'usb' && <div style={{ fontSize: 12, color: '#6B7280' }}>USB 端口自动识别打印机型号和端口号；多台 USB 打印机可按上方名称对应。</div>}
            {p.port.type === 'driver' && <div style={{ fontSize: 12, color: '#6B7280' }}>选择已安装的 Windows 打印机驱动型号及其端口。</div>}
            {p.port.type === 'com' && <div data-testid="printer-port-com-hint" style={{ fontSize: 12, color: '#6B7280' }}>COM 端口使用系统检测到的串口；请按打印机实际串口选择。</div>}
            {p.port.type === 'bluetooth' && <div data-testid="printer-port-bluetooth-hint" style={{ fontSize: 12, color: '#6B7280' }}>蓝牙打印机需先在 Windows 蓝牙设置中配对；LabelShop 通过系统分配的 SPP 虚拟 COM 端口连接。</div>}
            {p.port.type === 'file' && <div style={{ fontSize: 12, color: '#6B7280' }}>输出打印机指令文件。</div>}
          </FormField>
          {(p.port.type === 'com' || p.port.type === 'bluetooth') && (
            <FormField label="波特率">
              <select data-testid="printer-port-baud" value={p.port.baudRate ?? 115200} onChange={(e) => setPort({ baudRate: parseInt(e.target.value, 10) })} style={fullStyle}>
                {COMMON_BAUD_RATES.map((rate) => <option key={rate} value={rate}>{rate}</option>)}
              </select>
            </FormField>
          )}
          <FormField label="指令编码">
            <select value={p.port.encoding} onChange={(e) => setPort({ encoding: e.target.value as 'utf8' | 'gbk' })} style={fullStyle}>
              <option value="utf8">UTF-8</option>
              <option value="gbk">GBK / GB18030</option>
            </select>
          </FormField>
          {portError && <div data-testid="printer-port-error" role="alert" style={{ color: '#B42318', fontSize: 12, padding: '8px 10px', borderRadius: 6, background: '#FEF3F2' }}>{portError}</div>}
        </div>
      )}

      {tab === 'cmd' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <FormField label="指令集">
              <select value={p.driver} onChange={(e) => set({ driver: e.target.value as PrinterConfig['driver'] })} style={selStyle}>
                <option value="tspl">TSPL（国产标签机：佳博/得力/汉印/芯烨/启锐等）</option>
                <option value="zpl">ZPL（Zebra 及兼容机）</option>
                <option value="cpcl">CPCL（面单/便携机）</option>
              </select>
            </FormField>
            <FormField label="指令编码" hint="中文内容时建议 GBK；佳博等部分机型支持 UTF-8">
              <select value={p.port.encoding} onChange={(e) => setPort({ encoding: e.target.value as 'utf8' | 'gbk' })} style={selStyle}>
                <option value="utf8">UTF-8</option>
                <option value="gbk">GBK / GB18030</option>
              </select>
            </FormField>
            <FormField label="端口">
              <select value={p.port.type} onChange={(e) => changePortType(e.target.value as PortType)} style={selStyle}>
                <option value="driver">Windows 打印机驱动（图形打印）</option>
                <option value="file">打印到文件（生成指令文件）</option>
                <option value="tcp">TCP/IP 网络直连</option>
                <option value="com">串口 COM 直连</option>
                <option value="lpt">并口 LPT 直连</option>
                <option value="usb">USB（请使用驱动或映射为 COM）</option>
                <option value="bluetooth">蓝牙（SPP 虚拟串口）</option>
              </select>
            </FormField>
            <FormField label="端口参数">
              {p.port.type === 'tcp' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={p.port.tcpHost ?? ''} onChange={(e) => setPort({ tcpHost: e.target.value })} style={numStyle} placeholder="192.168.1.100" />
                  <input type="number" min={1} max={65535} value={p.port.tcpPort ?? 9100} onChange={(e) => setPort({ tcpPort: boundedNumber(e.target.value, 9100, 1, 65535) })} style={{ ...numStyle, width: 80 }} />
                </div>
              )}
              {(p.port.type === 'com' || p.port.type === 'bluetooth') && (
                <select value={p.port.comPort ?? ''} onChange={(e) => setPort({ comPort: e.target.value })} style={selStyle} disabled={portsLoading}>
                  {portsLoading && <option value="">正在检测…</option>}
                  {!portsLoading && comPorts.length === 0 && <option value="">未检测到串口</option>}
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
                <div style={{ fontSize: 12, color: '#9AA0A6', padding: '6px 2px' }}>{p.port.type === 'driver' ? '使用 Windows 驱动图形打印' : p.port.type === 'file' ? '输出到指令文件' : 'USB 原生直连尚未提供；请安装驱动或映射为 COM 端口'}</div>
              )}
            </FormField>
            {(p.port.type === 'com' || p.port.type === 'bluetooth') && (
              <FormField label="波特率">
                <select value={p.port.baudRate ?? 115200} onChange={(e) => setPort({ baudRate: parseInt(e.target.value, 10) })} style={selStyle}>
                  <option value={9600}>9600</option>
                  <option value={19200}>19200</option>
                  <option value={38400}>38400</option>
                  <option value={57600}>57600</option>
                  <option value={115200}>115200</option>
                </select>
              </FormField>
            )}
          </div>

          <div style={{ fontSize: 12, color: '#6B7280', margin: '10px 0 4px' }}>自定义命令（可自定义打印机参数命令、标签内容命令和打印后处理命令，参考对应打印机开发手册）：</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <FormField label="打印机参数命令（作业开始前发送）" hint="如初始化/复位参数">
              <textarea value={p.preCmd ?? ''} onChange={(e) => set({ preCmd: e.target.value })} style={txtStyle} placeholder={'例如 TSPL：\nSIZE 60 mm,40 mm\nGAP 2 mm,0 mm\nDENSITY 8\nSPEED 4'} />
            </FormField>
            <FormField label="标签内容命令（每张标签内容前发送）">
              <textarea value={p.contentCmd ?? ''} onChange={(e) => set({ contentCmd: e.target.value })} style={txtStyle} placeholder={'例如：\n// 每张标签前的固定命令'} />
            </FormField>
            <FormField label="打印后处理命令（作业结束后发送）" hint="如切纸/回退">
              <textarea value={p.postCmd ?? ''} onChange={(e) => set({ postCmd: e.target.value })} style={txtStyle} placeholder={'例如 TSPL：\nCUT ON'} />
            </FormField>
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} style={{ ...numStyle, width: 120 }} placeholder="品牌（可选）" />
            <input value={model} onChange={(e) => setModel(e.target.value)} style={{ ...numStyle, width: 140 }} placeholder="型号（可选）" />
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
              按品牌推荐并生成清单
            </button>
            <button type="button" onClick={() => setShowCompat((s) => !s)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
              {showCompat ? '收起兼容矩阵' : '查看兼容矩阵'}
            </button>
            <span style={{ fontSize: 12, color: '#6B7280' }}>
              推荐：<b>{recommendEngine(model, brand).engine.toUpperCase()}</b>（{recommendEngine(model, brand).reason}）
            </span>
          </div>

          {checklist.length > 0 && (
            <div style={{ marginTop: 10, border: '1px solid #E4E3DD', borderRadius: 10, padding: 10, background: '#FAF9F6' }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>真机验证清单（{checklist.length} 项）</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(checklist.map((c, i) => `${i + 1}. ${c}`).join('\n')).then(() => setCopied(true)).catch(() => undefined)
                  }}
                  style={{ fontSize: 12, color: '#2E6E93', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {copied ? '已复制 ✓' : '复制'}
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
                    <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #E4E3DD' }}>品牌 / 系列</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #E4E3DD' }}>常用指令集</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #E4E3DD' }}>DPI</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #E4E3DD' }}>说明</th>
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
              <div style={{ fontSize: 11, color: '#9AA0A6', padding: 6 }}>数据来源：厂商公开 SDK / 官方文档；矩阵为参考口径，正式发售前需按清单对代表机型实测。</div>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
