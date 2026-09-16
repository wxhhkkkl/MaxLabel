import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as I from './icons'
import { TOOLBAR_GROUPS, type ToolbarGroupKey, type ToolbarGroupVisibility } from '../dialogs/OptionsDialog'

/**
 * 主工具栏（图标化，对标 LabelShop 主工具栏 6 组）：
 * 文件 / 编辑 / 历史 / 打印 / 对象工具 / 数据库 / 显示 / 帮助
 */

interface Props {
  busy: boolean
  canDelete: boolean
  canUndo: boolean
  canRedo: boolean
  canCopy: boolean
  canGroup: boolean
  canUngroup: boolean
  canDatabaseNavigate: boolean
  canPaste: boolean
  tool: string
  onTool: (t: string) => void
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onCut: () => void
  onCopy: () => void
  onPaste: () => void
  onDelete: () => void
  onUndo: () => void
  onRedo: () => void
  onLabelFormat: () => void
  onPreview: () => void
  onPrint: () => void
  onAddImage: () => void
  onData: () => void
  onDbConfig: () => void
  /** 定位记录：打开定位对话框跳转到指定记录（原版"定位记录"=定位到新的记录，与"第一条记录"不同） */
  onDbLocate: () => void
  onDbRefresh: () => void
  onDbFirst: () => void
  onDbPrev: () => void
  onDbNext: () => void
  onDbLast: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onFitWidth: () => void
  onFitHeight: () => void
  onFitWindow: () => void
  onHelp: () => void
  /** 各按钮组当前是否显示（帮助 toolbar_mainbar.html「添加或删除按钮」）。 */
  groups: ToolbarGroupVisibility
  onToggleGroup: (key: ToolbarGroupKey, visible: boolean) => void
}

function TBtn({ title, onClick, disabled, active, dataTool, children }: { title: string; onClick: () => void; disabled?: boolean; active?: boolean; dataTool?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      data-tool={dataTool}
      aria-pressed={active === undefined ? undefined : active}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 30,
        height: 30,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 5,
        border: active ? '1px solid #9DC3E0' : '1px solid transparent',
        background: active ? '#EAF3FB' : 'transparent',
        color: disabled ? '#9AA0A6' : 'var(--app-bar-text, #1A1B1C)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        padding: 0
      }}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div style={{ width: 1, height: 22, background: '#E4E3DD', margin: '0 5px', flexShrink: 0 }} />
}

const OBJECT_TOOLS: Array<{ key: string; label: string; icon: ReactNode }> = [
  { key: 'select', label: '选取', icon: <I.ISelect /> },
  { key: 'barcode', label: '条码', icon: <I.IBarcode /> },
  { key: 'text', label: '文字', icon: <I.IText /> },
  { key: 'line', label: '线条', icon: <I.ILine /> },
  { key: 'diagonal', label: '斜线', icon: <I.IDiagonal /> },
  { key: 'rect', label: '矩形', icon: <I.IRect /> },
  { key: 'image', label: '图片', icon: <I.IImage /> },
  { key: 'table', label: '表格', icon: <I.ITable /> },
  { key: 'rfid', label: 'RFID', icon: <I.IRfid /> },
  { key: 'data', label: '数据', icon: <I.IData /> }
]

/** 「添加或删除按钮」下拉：按帮助 toolbar_mainbar.html 的分组逐个勾选显示/隐藏。 */
function CustomizeMenu({ groups, onToggle }: { groups: ToolbarGroupVisibility; onToggle: (key: ToolbarGroupKey, visible: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div ref={boxRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        data-testid="toolbar-customize"
        aria-haspopup="menu"
        aria-expanded={open}
        title="添加或删除按钮：用于添加或删除工具栏按钮，也可自定义按键及布局"
        onClick={() => setOpen((v) => !v)}
        style={{
          height: 30,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          padding: '0 4px',
          borderRadius: 5,
          border: open ? '1px solid #9DC3E0' : '1px solid transparent',
          background: open ? '#EAF3FB' : 'transparent',
          color: 'var(--app-bar-text, #1A1B1C)',
          cursor: 'pointer'
        }}
      >
        <I.ICustomize />
        <span style={{ fontSize: 8, lineHeight: 1 }}>▼</span>
      </button>
      {open && (
        <div
          data-testid="toolbar-customize-menu"
          role="menu"
          aria-label="添加或删除按钮"
          style={{
            position: 'absolute',
            right: 0,
            top: 32,
            zIndex: 40,
            minWidth: 168,
            background: '#FFFFFF',
            border: '1px solid #B9B7AE',
            borderRadius: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,.18)',
            padding: '4px 0',
            userSelect: 'none'
          }}
        >
          <div style={{ padding: '4px 12px 6px', fontSize: 12, color: '#6B7280', borderBottom: '1px solid #EDECE7', marginBottom: 4 }}>添加或删除按钮</div>
          {TOOLBAR_GROUPS.map((g) => (
            <label
              key={g.key}
              data-testid={'toolbar-group-' + g.key}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', fontSize: 13, cursor: 'pointer' }}
            >
              <input type="checkbox" checked={groups[g.key]} onChange={(e) => onToggle(g.key, e.target.checked)} />
              {g.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Toolbar(props: Props) {
  const g = props.groups
  return (
    <div data-testid="toolbar" style={{ background: 'var(--app-bar-bg, #FFFFFF)', color: 'var(--app-bar-text, #1A1B1C)', borderBottom: '1px solid #E4E3DD', padding: '4px 8px', display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', boxSizing: 'border-box', userSelect: 'none' }}>
      {/* 文件 */}
      {g.file && (<>
      <TBtn title="新建标签模版" onClick={props.onNew}><I.INew /></TBtn>
      <TBtn title="打开标签模版" onClick={props.onOpen}><I.IOpen /></TBtn>
      <TBtn title="保存" onClick={props.onSave}><I.ISave /></TBtn>
      </>)}
      {/* 编辑 */}
      {g.edit && (<>
      <Sep />
      <TBtn title="剪切" onClick={props.onCut} disabled={!props.canCopy}><I.ICut /></TBtn>
      <TBtn title="复制" onClick={props.onCopy} disabled={!props.canCopy}><I.ICopy /></TBtn>
      <TBtn title="粘贴" onClick={props.onPaste} disabled={!props.canPaste}><I.IPaste /></TBtn>
      <TBtn title="删除" onClick={props.onDelete} disabled={!props.canDelete}><I.IDelete /></TBtn>
      </>)}
      {/* 历史 */}
      {g.history && (<>
      <Sep />
      <TBtn title="撤销" onClick={props.onUndo} disabled={!props.canUndo}><I.IUndo /></TBtn>
      <TBtn title="重做" onClick={props.onRedo} disabled={!props.canRedo}><I.IRedo /></TBtn>
      </>)}
      {/* 打印 */}
      {g.print && (<>
      <Sep />
      <TBtn title="标签格式设置" onClick={props.onLabelFormat}><I.ILabelFormat /></TBtn>
      <TBtn title="打印预览" onClick={props.onPreview} disabled={props.busy}><I.IPreview /></TBtn>
      <TBtn title="打印" onClick={props.onPrint} disabled={props.busy}><I.IPrint /></TBtn>
      </>)}
      {/* 对象工具 */}
      {g.object && (<>
      <Sep />
      {OBJECT_TOOLS.map((t) => (
        <TBtn key={t.key} title={'选择工具：' + t.label} onClick={() => props.onTool(t.key)} active={props.tool === t.key} dataTool={t.key}>
          {t.icon}
        </TBtn>
      ))}
      </>)}
      {/* 数据库 */}
      {g.database && (<>
      <Sep />
      <TBtn title="设置数据库" onClick={props.onDbConfig} disabled={!props.canDatabaseNavigate}><I.IDbConfig /></TBtn>
      <TBtn title="定位记录" onClick={props.onDbLocate} disabled={!props.canDatabaseNavigate}><I.IRecord /></TBtn>
      <TBtn title="更新数据库" onClick={props.onDbRefresh} disabled={!props.canDatabaseNavigate}><I.IRefresh /></TBtn>
      <TBtn title="第一条记录" onClick={props.onDbFirst} disabled={!props.canDatabaseNavigate}><I.IFirst /></TBtn>
      <TBtn title="上一条记录" onClick={props.onDbPrev} disabled={!props.canDatabaseNavigate}><I.IPrev /></TBtn>
      <TBtn title="下一条记录" onClick={props.onDbNext} disabled={!props.canDatabaseNavigate}><I.INext /></TBtn>
      <TBtn title="最后一条记录" onClick={props.onDbLast} disabled={!props.canDatabaseNavigate}><I.ILast /></TBtn>
      </>)}
      {/* 显示 */}
      {g.view && (<>
      <Sep />
      <TBtn title="放大" onClick={props.onZoomIn}><I.IZoomIn /></TBtn>
      <TBtn title="缩小" onClick={props.onZoomOut}><I.IZoomOut /></TBtn>
      <TBtn title="适应宽度" onClick={props.onFitWidth}><I.IFitWidth /></TBtn>
      <TBtn title="适应高度" onClick={props.onFitHeight}><I.IFitHeight /></TBtn>
      <TBtn title="撑满窗口" onClick={props.onFitWindow}><I.IFitWindow /></TBtn>
      </>)}
      {/* 帮助 */}
      {g.help && (<>
      <Sep />
      <TBtn title="帮助主题" onClick={props.onHelp}><I.IHelp /></TBtn>
      </>)}
      <Sep />
      {/* 添加或删除按钮 */}
      <CustomizeMenu groups={g} onToggle={props.onToggleGroup} />
    </div>
  )
}
