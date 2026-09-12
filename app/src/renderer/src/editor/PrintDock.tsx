import { useState } from 'react'
import type { LabelDoc } from '../types'
import { MAX_PRINT_COPIES, MAX_PRINT_LOGICAL_LABELS } from '../../../shared/print/plan'
import ContextMenu from './ContextMenu'
import type { MenuItem } from './MenuBar'

interface Props {
  doc: LabelDoc
  busy: boolean
  count: number
  setCount: (n: number) => void
  copies: number
  setCopies: (n: number) => void
  /** 起始标签（页式机从第 N 张开始，默认 1） */
  startLabel: number
  setStartLabel: (n: number) => void
  datasetNames: string[]
  datasetName: string
  onDatasetChange: (name: string) => void
  onPrinterSettings: () => void
  onData: () => void
  onPreview: () => void
  onTestPrint: () => void
  onPrint: () => void
  onCancel?: () => void
  /** 打开打印历史记录 */
  onHistory?: () => void
  /** 打印对话框-数据库高级选项（自动记录数 / 字段拷贝 / 首张拷贝输入） */
  dbAdv?: { autoCount: boolean; copyField: boolean; copyFieldName: string; firstCopyAsk: boolean; dupcheck: boolean }
  setDbAdv?: (patch: Partial<{ autoCount: boolean; copyField: boolean; copyFieldName: string; firstCopyAsk: boolean; dupcheck: boolean }>) => void
  /** 隐藏面板（停靠菜单"隐藏"项） */
  onHide?: () => void
}

export default function PrintDock(props: Props) {
  const { doc, busy } = props
  const [tab, setTab] = useState<'params' | 'server' | 'help'>('params')
  const [dockMenu, setDockMenu] = useState<{ x: number; y: number } | null>(null)
  const driverLabel = doc.printer ? `${doc.printer.driver.toUpperCase()} · ${doc.printer.dpi}dpi · ${doc.printer.port.type}` : '未配置'

  const dockMenuItems: MenuItem[] = [
    { label: '浮动(F)', action: () => {} },
    { label: '停靠(D)', checked: true, action: () => {} },
    { label: '选项卡式文档(T)', action: () => {} },
    { label: '自动隐藏(A)', action: () => {} },
    { label: '隐藏(H)', action: () => props.onHide?.() }
  ]

  return (
    <div style={{ width: 300, background: '#FBFBF8', borderLeft: '1px solid #E4E3DD', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'auto' }}>
      <div
        onContextMenu={(e) => {
          e.preventDefault()
          setDockMenu({ x: e.clientX, y: e.clientY })
        }}
        style={{ padding: '8px 12px', fontSize: 12, color: '#6B7280', borderBottom: '1px solid #ECEBE6', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'default' }}
      >
        打印 - {doc.name}
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
            onClick={() => setTab(k)}
            style={{
              flex: 1,
              padding: '7px 0',
              fontSize: 12.5,
              border: 'none',
              background: tab === k ? '#FFFFFF' : 'transparent',
              borderBottom: tab === k ? '2px solid #2E6E93' : '2px solid transparent',
              color: tab === k ? '#1A1B1C' : '#6B7280',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'params' && (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>输入数据</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                value={props.datasetName}
                onChange={(e) => props.onDatasetChange(e.target.value)}
                style={{ flex: 1, padding: '6px 8px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, background: '#fff', color: '#1A1B1C' }}
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
                value={driverLabel}
                style={{ flex: 1, padding: '6px 8px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, background: '#fff', color: '#1A1B1C' }}
                title={driverLabel}
              >
                <option value={driverLabel}>{driverLabel}</option>
              </select>
              <button
                type="button"
                onClick={props.onPrinterSettings}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}
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
                min={1}
                max={99999}
                value={props.copies}
                onChange={(e) => props.setCopies(Math.min(MAX_PRINT_COPIES, Math.max(1, parseInt(e.target.value || '1', 10))))}
                style={{ width: 56, padding: '6px 6px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13 }}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 12.5, color: '#1A1B1C', flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              起始标签
              <input
                type="number"
                min={1}
                max={99999}
                value={props.startLabel}
                onChange={(e) => props.setStartLabel(parseInt(e.target.value || '1', 10))}
                title="页式机从第 N 张标签开始打印"
                style={{ width: 56, padding: '6px 6px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13 }}
              />
            </label>
          </div>

          <div style={{ borderTop: '1px solid #E4E3DD', paddingTop: 10, marginTop: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <input type="checkbox" checked={props.dbAdv?.autoCount ?? false} onChange={(e) => props.setDbAdv?.({ autoCount: e.target.checked })} style={{ width: 14, height: 14 }} />
              <span style={{ fontSize: 12.5, color: '#1A1B1C' }}>打印时自动设置数据库记录数量</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <input type="checkbox" checked={props.dbAdv?.copyField ?? false} onChange={(e) => props.setDbAdv?.({ copyField: e.target.checked })} style={{ width: 14, height: 14 }} />
              <span style={{ fontSize: 12.5, color: '#1A1B1C', flex: 1 }}>拷贝数量从数据库字段引入</span>
            </div>
            {(props.dbAdv?.copyField ?? false) && (
              <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#6B7280', width: 58 }}>字段名称</span>
                <input value={props.dbAdv?.copyFieldName ?? ''} onChange={(e) => props.setDbAdv?.({ copyFieldName: e.target.value })} placeholder="如 qty" style={{ flex: 1, padding: '5px 8px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 12.5, fontFamily: 'inherit' }} />
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={props.dbAdv?.firstCopyAsk ?? false} onChange={(e) => props.setDbAdv?.({ firstCopyAsk: e.target.checked })} style={{ width: 14, height: 14 }} />
              <span style={{ fontSize: 12.5, color: '#1A1B1C' }}>打印时输入第一个标签的拷贝数量</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, borderTop: '1px solid #F0EFE9', paddingTop: 8 }}>
              <input type="checkbox" checked={props.dbAdv?.dupcheck ?? false} onChange={(e) => props.setDbAdv?.({ dupcheck: e.target.checked })} style={{ width: 14, height: 14 }} />
              <span style={{ fontSize: 12.5, color: '#1A1B1C' }}>打印时数据查重（重复记录跳过）</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={props.onPreview}
              disabled={busy}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
            >
              打印预览
            </button>
            <button
              type="button"
              onClick={props.onTestPrint}
              disabled={busy}
              title="测试打印：1 张，不计日志、不推进序列号"
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
            >
              测试打印
            </button>
          </div>
          <button
            type="button"
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
            输出方式：{doc.printer ? `${doc.printer.driver.toUpperCase()}（${doc.printer.port.type}）` : '未配置'} · 分辨率 {doc.printer?.dpi ?? 203} dpi
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
          <div style={{ marginBottom: 6 }}>· <b>指令直连</b>：TSPL/ZPL/CPCL 等指令集直发打印机，支持文件/TCP/COM/蓝牙（SPP 虚拟串口）；USB 请安装驱动或映射为 COM 端口。</div>
          <div style={{ marginBottom: 6 }}>· <b>驱动打印</b>：走 Windows 打印机驱动（图形打印），兼容激光/喷墨等页式打印机，弹系统打印对话框。</div>
          <div style={{ marginBottom: 6 }}>· <b>序列号回写</b>：打印后序列号变量自动递增并保存，便于批量连续标签。</div>
          <div style={{ marginBottom: 6 }}>· <b>数据库打印</b>：结合数据集逐记录打印；打印数量指定输出记录数，可设置启始记录。</div>
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
