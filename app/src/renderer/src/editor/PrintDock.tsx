import { useEffect, useState } from 'react'
import type { LabelDoc } from '../types'
import { MAX_PRINT_COPIES, MAX_PRINT_LOGICAL_LABELS } from '../../../shared/print/plan'
import ContextMenu from './ContextMenu'
import type { MenuItem } from './MenuBar'

interface Props {
  doc: LabelDoc
  title?: string
  busy: boolean
  count: number
  setCount: (n: number) => void
  copies: number
  setCopies: (n: number) => void
  datasetNames: string[]
  datasetName: string
  onDatasetChange: (name: string) => void
  onPrinterSettings: () => void
  onPrinterNameChange?: (name: string) => void
  onData: () => void
  onPrint: () => void
  onCancel?: () => void
  /** 打开打印历史记录 */
  onHistory?: () => void
  /** 隐藏面板（停靠菜单"隐藏"项） */
  onHide?: () => void
}

export default function PrintDock(props: Props) {
  const { doc, busy } = props
  const [tab, setTab] = useState<'params' | 'server' | 'help'>('params')
  const [dockMenu, setDockMenu] = useState<{ x: number; y: number } | null>(null)
  const [installedPrinters, setInstalledPrinters] = useState<Array<{ name: string; displayName: string }>>([])
  useEffect(() => {
    let alive = true
    window.maxlabel.listPrinters().then((result) => {
      if (alive) setInstalledPrinters((result.printers ?? []).map((item) => ({ name: item.name, displayName: item.displayName || item.name })))
    }).catch(() => {
      if (alive) setInstalledPrinters([])
    })
    return () => { alive = false }
  }, [])
  const portLabel = doc.printer?.port.type === 'lpt'
    ? `LPT（${doc.printer.port.lptPort ?? 'LPT1'}）`
    : doc.printer?.port.type === 'driver'
      ? `驱动${doc.printer.printerName ? `（${doc.printer.printerName}）` : ''}`
      : doc.printer?.port.type ?? ''
  const driverLabel = doc.printer ? `${doc.printer.driver.toUpperCase()} · ${doc.printer.dpi}dpi · ${portLabel}` : '未配置'

  const dockMenuItems: MenuItem[] = [
    { label: '浮动(F)', disabled: true },
    { label: '停靠(D)', checked: true, disabled: true },
    { label: '选项卡式文档(T)', disabled: true },
    { label: '自动隐藏(A)', disabled: true },
    { label: '隐藏(H)', action: () => props.onHide?.() }
  ]

  return (
    <div data-testid="print-dock" style={{ width: 300, background: '#FBFBF8', borderLeft: '1px solid #E4E3DD', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'auto' }}>
      <div
        onContextMenu={(e) => {
          e.preventDefault()
          setDockMenu({ x: e.clientX, y: e.clientY })
        }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 8px 8px 12px', fontSize: 12, color: '#6B7280', borderBottom: '1px solid #ECEBE6', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'default' }}
      >
        <span data-testid="print-dock-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>打印 - {props.title ?? doc.name}</span>
        <span style={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0, marginLeft: 8 }}>
          <span aria-hidden="true" title="自动隐藏打印窗体" style={{ color: '#9AA0A6', fontSize: 12 }}>📌</span>
          <span onClick={() => props.onHide?.()} title="关闭打印窗体" style={{ cursor: 'pointer', color: '#9AA0A6', padding: '0 2px', fontSize: 14, lineHeight: 1 }}>×</span>
        </span>
      </div>
      <div style={{ display: 'flex', borderBottom: '1px solid #ECEBE6', background: '#F6F5F2' }}>
        {(
          [
            ['params', '参数设置'],
            ['server', '打印服务器'],
            ['help', '帮助']
          ] as const
        ).map(([k, t]) => (
          <button
            key={k}
            type="button"
            data-testid={`print-tab-${k}`}
            disabled={k === 'help'}
            onClick={() => { if (k !== 'help') setTab(k) }}
            style={{
              flex: 1,
              padding: '7px 0',
              fontSize: 12.5,
              border: 'none',
              background: tab === k ? '#FFFFFF' : 'transparent',
              borderBottom: tab === k ? '2px solid #2E6E93' : '2px solid transparent',
              color: k === 'help' ? '#B0AFA9' : tab === k ? '#1A1B1C' : '#6B7280',
              cursor: k === 'help' ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit'
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'params' && (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div data-testid="print-input-data" style={{ border: '1px solid #E4E3DD', minHeight: 132, padding: '10px 10px 12px', boxSizing: 'border-box' }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>输入数据</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <select
                value={props.datasetName}
                onChange={(e) => props.onDatasetChange(e.target.value)}
                aria-label="输入数据"
                style={{ flex: 1, minWidth: 0, padding: '6px 8px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, background: '#fff', color: '#1A1B1C' }}
              >
                {props.datasetNames.length === 0 && <option value="">（无数据集）</option>}
                {props.datasetNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={props.onData}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                title="数据管理（CSV/Excel/数据库）"
              >
                管理
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>打印机</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                value={doc.printer?.printerName ?? ''}
                data-testid="print-printer"
                onChange={(e) => props.onPrinterNameChange?.(e.target.value)}
                disabled={doc.printer?.port.type !== 'driver'}
                style={{ flex: 1, minWidth: 0, padding: '6px 8px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, background: '#fff', color: '#1A1B1C' }}
                title={driverLabel}
              >
                <option value="">{doc.printer?.printerName?.trim() || '系统默认打印机'}</option>
                {doc.printer?.printerName && !installedPrinters.some((item) => item.name === doc.printer?.printerName) && <option value={doc.printer.printerName}>当前模板打印机：{doc.printer.printerName}</option>}
                {installedPrinters.map((item) => <option key={item.name} value={item.name}>{item.displayName}</option>)}
              </select>
              <button
                type="button"
                data-testid="print-printer-settings"
                onClick={props.onPrinterSettings}
                style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                title="打印机设置（指令集/端口/属性/兼容矩阵）"
              >
                设置
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ fontSize: 12.5, color: '#1A1B1C', flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              打印数量
              <input
                type="number"
                data-testid="print-count"
                min={1}
                max={99999}
                value={props.count}
                onChange={(e) => props.setCount(Math.min(MAX_PRINT_LOGICAL_LABELS, Math.max(1, parseInt(e.target.value || '1', 10))))}
                style={{ width: 56, padding: '6px 6px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13 }}
              />
            </label>
            <label style={{ fontSize: 12.5, color: '#1A1B1C', flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              单签拷贝
              <input
                type="number"
                data-testid="print-copies"
                min={1}
                max={99999}
                value={props.copies}
                onChange={(e) => props.setCopies(Math.min(MAX_PRINT_COPIES, Math.max(1, parseInt(e.target.value || '1', 10))))}
                style={{ width: 56, padding: '6px 6px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13 }}
              />
            </label>
          </div>
          <button
            type="button"
            data-testid="print-submit"
            onClick={busy ? props.onCancel : props.onPrint}
            disabled={busy && !props.onCancel}
            style={{ padding: '10px 0', borderRadius: 8, border: busy ? '1px solid #B34747' : '1px solid #2E6E93', background: busy ? '#FFF5F5' : '#2E6E93', color: busy ? '#B34747' : '#fff', cursor: busy && !props.onCancel ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}
          >
            {busy ? '取消当前操作' : '打印'}
          </button>
        </div>
      )}

      {tab === 'server' && (
        <div style={{ padding: 14, fontSize: 12.5, color: '#4B5563', lineHeight: 1.7 }}>
          <div style={{ fontWeight: 600, color: '#1A1B1C', marginBottom: 8 }}>打印服务</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: '#52C41A', display: 'inline-block' }} />
            <span style={{ color: '#1A1B1C' }}>本地打印服务</span>
            <span style={{ color: '#9CA3AF' }}>运行中</span>
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
            输出方式：{doc.printer ? `${doc.printer.driver.toUpperCase()}（${portLabel}）` : '未配置'} · 分辨率 {doc.printer?.dpi ?? 203} dpi
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: '#F5222D', display: 'inline-block' }} />
            <span style={{ color: '#1A1B1C' }}>打印服务连接</span>
            <span style={{ color: '#9CA3AF' }}>未连接（需云服务）</span>
          </div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>
            云端模板、打印日志与集中分发使用同一版本功能；连接服务器后即可使用。
          </div>
          <button
            type="button"
            onClick={props.onData}
            style={{ marginTop: 10, padding: '7px 14px', borderRadius: 6, border: '1px solid #2E6E93', background: '#fff', color: '#2E6E93', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}
          >
            打开数据设置
          </button>
          {props.onHistory && (
            <button
              type="button"
              onClick={props.onHistory}
              style={{ marginTop: 8, marginLeft: 8, padding: '7px 14px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}
            >
              打印历史记录
            </button>
          )}
        </div>
      )}

      {tab === 'help' && (
        <div style={{ padding: 14, fontSize: 12.5, color: '#4B5563', lineHeight: 1.75 }}>
          <div style={{ fontWeight: 600, color: '#1A1B1C', marginBottom: 6 }}>打印帮助</div>
          <div style={{ marginBottom: 6 }}>· <b>打印数量</b>：打印变化标签的数量。当变量为序列号/数据库时，按此数量逐张推进变量。</div>
          <div style={{ marginBottom: 6 }}>· <b>单签拷贝</b>：同一张标签重复输出的份数。实际输出 = 打印数量 × 单签拷贝。</div>
          <div style={{ marginBottom: 6 }}>· <b>测试打印</b>：打印 1 张，不写日志、不更新序列号变量。</div>
          <div style={{ marginBottom: 6 }}>· <b>指令直连</b>：TSPL/ZPL/CPCL 等指令集直发打印机，支持文件/TCP/COM/LPT/蓝牙（SPP 虚拟串口）；USB 请安装驱动或映射为 COM 端口。</div>
          <div style={{ marginBottom: 6 }}>· <b>驱动打印</b>：走 Windows 打印机驱动（图形打印），兼容激光/喷墨等页式打印机，弹系统打印对话框。</div>
          <div style={{ marginBottom: 6 }}>· <b>序列号回写</b>：可选择打印后自动递增并保存，便于批量连续标签；关闭后保留当前序列号。</div>
          <div style={{ marginBottom: 6 }}>· <b>数据库打印</b>：结合数据集逐记录打印；可选择打印数量、起始记录、仅当前记录、查重，以及打印后是否更新序列号。</div>
        </div>
      )}
      {dockMenu && (
        <ContextMenu
          x={dockMenu.x}
          y={dockMenu.y}
          items={dockMenuItems}
          onClose={() => setDockMenu(null)}
        />
      )}
    </div>
  )
}
