import { useState } from 'react'
import type { LabelObject } from '../types'
import ContextMenu from './ContextMenu'
import type { MenuItem } from './MenuBar'

function objName(o: LabelObject): string {
  switch (o.type) {
    case 'text':
      return '文字'
    case 'barcode':
      return `条码·${o.symbology}`
    case 'rfid':
      return `RFID·${o.bank}`
    case 'rect':
      return '矩形'
    case 'ellipse':
      return '椭圆'
    case 'line':
      return '直线'
    case 'table':
      return `表格 ${o.rows}×${o.cols}`
    case 'image':
      return '图片'
    case 'group':
      return `组合（${o.children.length}）`
  }
}

function layerRows(objects: LabelObject[], depth = 0): Array<{ object: LabelObject; depth: number }> {
  const rows: Array<{ object: LabelObject; depth: number }> = []
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index]
    rows.push({ object, depth })
    if (object.type === 'group') rows.push(...layerRows(object.children, depth + 1))
  }
  return rows
}

function hiddenCount(objects: LabelObject[]): number {
  return objects.reduce((count, object) => count + (object.visible === false ? 1 : 0) + (object.type === 'group' ? hiddenCount(object.children) : 0), 0)
}

interface Props {
  objects: LabelObject[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onDelete: (id: string) => void
  onToggleVisible: (id: string) => void
  onReorder: (id: string, dir: -1 | 1) => void
  onClose?: () => void
  /** 隐藏面板（停靠菜单"隐藏"项） */
  onHide?: () => void
  /** 图层对象行右键：选中该对象并弹出对象菜单 */
  onRowContextMenu?: (objId: string, screenX: number, screenY: number) => void
}

type LayerTool = 'new' | 'settings' | 'copy' | 'delete' | 'rename' | 'properties'

function LayerToolGlyph({ tool }: { tool: LayerTool }) {
  const common = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (tool === 'new') return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>
  if (tool === 'settings') return <svg {...common}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /><circle cx="12" cy="12" r="4" /></svg>
  if (tool === 'copy') return <svg {...common}><rect x="8" y="8" width="11" height="11" rx="1" /><path d="M5 16H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1" /></svg>
  if (tool === 'delete') return <svg {...common}><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></svg>
  if (tool === 'rename') return <svg {...common}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
  return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
}

function ToolBtn({ title, tool, onClick, disabled, testId }: { title: string; tool: LayerTool; onClick?: () => void; disabled?: boolean; testId: string }) {
  return (
    <button
      type="button"
      data-testid={testId}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 22,
        height: 20,
        border: 'none',
        background: 'transparent',
        borderRadius: 4,
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? '#C6C4BD' : '#4B5563',
        lineHeight: 1,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <LayerToolGlyph tool={tool} />
    </button>
  )
}

export default function LayerPanel({ objects, selectedId, onSelect, onDelete, onToggleVisible, onReorder, onClose, onHide, onRowContextMenu }: Props) {
  const hidden = hiddenCount(objects)
  const [dockMenu, setDockMenu] = useState<{ x: number; y: number } | null>(null)
  const dockMenuItems: MenuItem[] = [
    { label: '浮动(F)', disabled: true },
    { label: '停靠(D)', checked: true, disabled: true },
    { label: '选项卡式文档(T)', disabled: true },
    { label: '自动隐藏(A)', disabled: true },
    { label: '隐藏(H)', action: () => onHide?.() }
  ]
  return (
    <div style={{ width: 200, background: '#FBFBF8', borderRight: '1px solid #E4E3DD', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'auto' }}>
      <div
        onContextMenu={(e) => {
          e.preventDefault()
          setDockMenu({ x: e.clientX, y: e.clientY })
        }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 6px 12px', fontSize: 12, color: '#6B7280', borderBottom: '1px solid #ECEBE6', fontWeight: 600 }}
      >
        <span>图层</span>
        <span style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <span title="自动隐藏图层窗体" style={{ cursor: 'default', color: '#9AA0A6', padding: '0 3px', fontSize: 12 }}>
            📌
          </span>
          <span onClick={() => onClose?.()} title="关闭图层窗体" style={{ cursor: 'pointer', color: '#9AA0A6', padding: '0 3px', fontSize: 14, lineHeight: 1 }}>
            ×
          </span>
        </span>
      </div>
      {/* 顶部工具栏（LabelShop 图层工具栏） */}
      <div data-testid="layer-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 8px', borderBottom: '1px solid #ECEBE6', background: '#F4F3EE' }}>
        <ToolBtn title="新建图层" tool="new" testId="layer-tool-new" disabled />
        <ToolBtn title="设置" tool="settings" testId="layer-tool-settings" disabled />
        <ToolBtn title="复制图层" tool="copy" testId="layer-tool-copy" disabled />
        <ToolBtn title="删除图层" tool="delete" testId="layer-tool-delete" disabled />
        <ToolBtn title="重命名图层" tool="rename" testId="layer-tool-rename" disabled />
        <ToolBtn title="图层属性" tool="properties" testId="layer-tool-properties" disabled />
      </div>
      <div
        data-testid="layer-default"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          fontSize: 12.5,
          color: '#1A1B1C',
          borderBottom: '1px solid #ECEBE6',
          cursor: 'default'
        }}
      >
        <span data-testid="layer-column-visibility" aria-hidden="true" style={{ width: 18, textAlign: 'center', color: '#5B8FF9' }}>◉</span>
        <span data-testid="layer-column-name" style={{ flex: 1 }}>默认</span>
        <span data-testid="layer-column-lock" aria-hidden="true" title="图层未锁定" style={{ color: '#777A80', fontSize: 13 }}>🔓</span>
      </div>
      <div style={{ padding: '2px 0' }}>
        {layerRows(objects).map(({ object: o, depth }) => {
          const sel = o.id === selectedId
          return (
            <div
              key={o.id}
              data-testid="layer-object-row"
              data-selected={sel ? 'true' : 'false'}
              data-object-x={o.x}
              data-object-y={o.y}
              onClick={() => onSelect(sel ? null : o.id)}
              onContextMenu={(e) => {
                e.preventDefault()
                onRowContextMenu?.(o.id, e.clientX, e.clientY)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 8px 5px 6px',
                fontSize: 12.5,
                cursor: 'pointer',
                background: sel ? '#E4EFF7' : 'transparent',
                color: '#1A1B1C',
                paddingLeft: 6 + depth * 14
              }}
              title={objName(o)}
            >
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleVisible(o.id)
                }}
                style={{ width: 18, textAlign: 'center', color: o.visible === false ? '#C6C4BD' : '#5B8FF9', cursor: 'pointer' }}
                title={o.visible === false ? '显示' : '隐藏'}
              >
                {o.visible === false ? '○' : '●'}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: o.visible === false ? 0.45 : 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                {objName(o)}
                {o.locked === true && (
                  <span style={{ fontSize: 11, color: '#B0AFA9' }} title="位置已锁定">
                    🔒
                  </span>
                )}
              </span>
              <span style={{ display: 'flex', gap: 2, color: '#9AA0A6', fontSize: 12 }}>
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    onReorder(o.id, -1)
                  }}
                  title="上移一层"
                  style={{ cursor: 'pointer', padding: '0 2px' }}
                >
                  ↑
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    onReorder(o.id, 1)
                  }}
                  title="下移一层"
                  style={{ cursor: 'pointer', padding: '0 2px' }}
                >
                  ↓
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(o.id)
                  }}
                  title="删除"
                  style={{ cursor: 'pointer', padding: '0 2px' }}
                >
                  ×
                </span>
              </span>
            </div>
          )
        })}
        {hidden > 0 && (
          <div style={{ padding: '8px 14px', fontSize: 11.5, color: '#B0AFA9' }}>已隐藏 {hidden} 个对象</div>
        )}
      </div>
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
