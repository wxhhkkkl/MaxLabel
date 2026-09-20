import { useMemo, useState } from 'react'
import { PRINTER_CATALOG, PRINTER_BRAND_FILTER, type PrinterCatalogEntry } from '../../../shared/domain/printerCatalog.generated'
import Modal from './Modal'

interface Props {
  /** 已安装的 LabelShop 打印机 id（顺序 = 安装顺序） */
  installedIds: readonly string[]
  onInstall: (id: string) => void
  onRemove: (id: string) => void
  onHelp: () => void
  onClose: () => void
}

const button = {
  padding: '7px 26px',
  border: '1px solid #BDBDBD',
  borderRadius: 2,
  background: '#fff',
  color: '#1A1B1C',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'inherit'
} as const

/**
 * 「安装 LabelShop 打印机」对话框 —— 逐项对照真机取证：
 *   parity/reference/labelshop/probe-07-install-printer.png（界面）
 *   parity/reference/labelshop/probe-08-install-list.txt（125 行可安装打印机）
 *   parity/reference/labelshop/probe-10-install-filter.txt（品牌过滤下拉 39 项）
 *
 * 真机结构：标题「安装 LabelShop 打印机」→「可安装的打印机：」→ 品牌过滤下拉（全部 + 38 品牌）
 * → 三列列表（打印机 / 状态 / 空列，行内型号形如 `Gprinter GPL-N (203 dpi)`，已装的在状态列写「已安装」）
 * → 底部说明 + 安装 / 移除 / 帮助 / 返回。
 *
 * 修复前的复刻版是自造的表单（品牌 + 指令集 + 分辨率 + 端口 + Windows 目标打印机 + 机型），
 * 与真机完全不同，且「移除（卸载）」只清文档里的 printer、不清全局偏好，表现为删不掉打印机。
 */
export default function PrintersInstallDialog({ installedIds, onInstall, onRemove, onHelp, onClose }: Props) {
  const [brandFilter, setBrandFilter] = useState(PRINTER_BRAND_FILTER[0])
  const [selectedId, setSelectedId] = useState<string>('')

  const installedSet = useMemo(() => new Set(installedIds), [installedIds])
  const rows: PrinterCatalogEntry[] = useMemo(
    () => (brandFilter === PRINTER_BRAND_FILTER[0] ? [...PRINTER_CATALOG] : PRINTER_CATALOG.filter((entry) => entry.brandLabel === brandFilter)),
    [brandFilter]
  )

  const selected = rows.find((entry) => entry.id === selectedId)
  const canInstall = Boolean(selected) && !installedSet.has(selectedId)
  const canRemove = Boolean(selected) && installedSet.has(selectedId)

  return (
    <Modal title="安装 LabelShop 打印机" testId="printer-install-dialog" onClose={onClose} width={720}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13 }}>可安装的打印机：</div>
        <select
          data-testid="printer-install-filter"
          value={brandFilter}
          onChange={(event) => {
            setBrandFilter(event.target.value)
            setSelectedId('')
          }}
          style={{ padding: '5px 8px', border: '1px solid #BDBDBD', borderRadius: 2, fontSize: 13, background: '#fff', color: '#1A1B1C' }}
        >
          {PRINTER_BRAND_FILTER.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>

        <div data-testid="printer-install-list" style={{ border: '1px solid #BDBDBD', background: '#fff', height: 300, overflow: 'auto' }}>
          <div style={{ display: 'flex', position: 'sticky', top: 0, background: '#F0F0F0', borderBottom: '1px solid #BDBDBD', fontSize: 12.5, color: '#333' }}>
            <div style={{ flex: '0 0 420px', padding: '3px 6px', borderRight: '1px solid #BDBDBD' }}>打印机</div>
            <div style={{ flex: '0 0 120px', padding: '3px 6px', borderRight: '1px solid #BDBDBD' }}>状态</div>
            <div style={{ flex: 1, padding: '3px 6px' }} />
          </div>
          {rows.map((entry) => {
            const isInstalled = installedSet.has(entry.id)
            const isSelected = entry.id === selectedId
            return (
              <div
                key={entry.id}
                data-testid="printer-install-row"
                data-printer-id={entry.id}
                data-printer-name={entry.name}
                data-status={isInstalled ? '已安装' : ''}
                data-selected={isSelected ? 'true' : 'false'}
                onClick={() => setSelectedId(entry.id)}
                onDoubleClick={() => {
                  setSelectedId(entry.id)
                  if (!isInstalled) onInstall(entry.id)
                }}
                style={{
                  display: 'flex',
                  fontSize: 12.5,
                  cursor: 'pointer',
                  background: isSelected ? '#3399FF' : 'transparent',
                  color: isSelected ? '#fff' : '#1A1B1C'
                }}
              >
                <div style={{ flex: '0 0 420px', padding: '2px 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.name}</div>
                <div data-testid="printer-install-row-status" style={{ flex: '0 0 120px', padding: '2px 6px' }}>{isInstalled ? '已安装' : ''}</div>
                <div style={{ flex: 1, padding: '2px 6px' }} />
              </div>
            )
          })}
        </div>

        <div data-testid="printer-install-guidance" style={{ fontSize: 12.5, color: '#333', lineHeight: 1.6 }}>
          安装 LabelShop 打印机，可以在LabelShop中实现一般的标签打印功能。如果想充分发挥打印机的性能，请安装官方提供的驱动程序。
        </div>
        <div style={{ fontSize: 12, color: '#6B7280' }} data-testid="printer-install-hint">
          已安装 {installedIds.length} 台：装好的打印机会出现在「选择标签格式」页的「打印机」下拉里，并把标签品牌/类型/名称切换到卷筒标签库。
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, paddingTop: 2 }}>
          <button type="button" data-testid="printer-install-submit" disabled={!canInstall} onClick={() => { if (canInstall) onInstall(selectedId) }} style={{ ...button, color: canInstall ? '#1A1B1C' : '#B0AFA9', cursor: canInstall ? 'pointer' : 'not-allowed' }}>
            安装
          </button>
          <button type="button" data-testid="printer-install-remove" disabled={!canRemove} onClick={() => { if (canRemove) onRemove(selectedId) }} style={{ ...button, color: canRemove ? '#1A1B1C' : '#B0AFA9', cursor: canRemove ? 'pointer' : 'not-allowed' }}>
            移除
          </button>
          <button type="button" data-testid="printer-install-help" onClick={onHelp} style={button}>
            帮助
          </button>
          <button type="button" data-testid="printer-install-back" onClick={onClose} style={button}>
            返回
          </button>
        </div>
      </div>
    </Modal>
  )
}
