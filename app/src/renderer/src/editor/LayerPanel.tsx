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

function ToolBtn({ title, glyph, onClick, disabled }: { title: string; glyph: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
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
        fontSize: 13,
        lineHeight: 1,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {glyph}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 8px', borderBottom: '1px solid #ECEBE6', background: '#F4F3EE' }}>
        <ToolBtn title="新建图层" glyph="＋" disabled />
        <ToolBtn title="设置" glyph="⚙" disabled />
        <ToolBtn title="复制图层" glyph="▣" disabled />
        <ToolBtn title="删除图层" glyph="♜" disabled />
        <ToolBtn title="重命名图层" glyph="✎" disabled />
        <ToolBtn title="图层属性" glyph="▦" disabled />
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
        <span aria-hidden="true" style={{ width: 18, textAlign: 'center', color: '#5B8FF9' }}>◉</span>
        <span style={{ flex: 1 }}>默认</span>
        <span aria-hidden="true" title="图层未锁定" style={{ color: '#777A80', fontSize: 13 }}>🔓</span>
      </div>
      <div style={{ padding: '2px 0' }}>
        {layerRows(objects).map(({ object: o, depth }) => {
          const sel = o.id === selectedId
          return (
            <div
              key={o.id}
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
