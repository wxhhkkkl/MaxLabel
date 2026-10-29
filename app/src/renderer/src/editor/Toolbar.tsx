import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import * as I from './icons'
import { TOOLBAR_GROUPS, type ToolbarGroupKey, type ToolbarGroupVisibility } from '../dialogs/OptionsDialog'
import { defaultToolbarLayout, matchToolbarKey, normalizeToolbarLayout, toolbarButtonGroup, visibleToolbarButtons, type ToolbarLayout } from './toolbarLayout'
import { useI18n } from '../features/i18n/useI18n'
import { localizeToolbarLabel } from '../../../shared/i18n/toolbar.en-US'
import type { EntitlementState } from '../../../shared/domain/entitlement'

/**
 * 主工具栏（图标化，对标 原版 主工具栏 6 组）：
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
  /** 有文档即可打开「设置数据库」（不要求已有数据集）。 */
  canOpenDatabaseConfig: boolean
  canPaste: boolean
  /** 会员版本 + 加密狗授权状态；只读/版本限制的唯一来源。 */
  entitlement: EntitlementState
  /** 点击版本锁定按钮时的升级入口。 */
  onUpgrade: () => void
  /** 点击只读锁定按钮时的登录/续费入口。 */
  onReadOnlyHelp: () => void
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
  /** 各按钮组当前是否显示（帮助 toolbar_mainbar.html「添加或删除按钮 → 标准」）。 */
  groups: ToolbarGroupVisibility
  onToggleGroup: (key: ToolbarGroupKey, visible: boolean) => void
  /** 逐按钮的自定义布局（顺序 / 显示 / 按键），由「自定义...」对话框写回。 */
  layout: ToolbarLayout
  /** 打开「自定义」对话框（「添加或删除按钮 → 自定义...」）。 */
  onCustomize: () => void
}

function TBtn({ title, onClick, disabled, active, dataTool, iconColor, locked, onLocked, children }: { title: string; onClick: () => void; disabled?: boolean; active?: boolean; dataTool?: string; iconColor?: string; locked?: 'readonly' | 'feature'; onLocked?: () => void; children: ReactNode }) {
  const { t, language } = useI18n()
  const lockText = locked ? t(locked === 'readonly' ? 'entitlement.readOnlyShort' : 'entitlement.upgrade') : ''
  // 锁定按钮仍可点击：点击打开登录/升级入口，而不是执行被锁命令。
  const lockClick = Boolean(locked && onLocked)
  const blocked = Boolean(disabled) && !lockClick
  return (
    <button
      type="button"
      data-tool={dataTool}
      aria-pressed={active === undefined ? undefined : active}
      onClick={lockClick ? onLocked : onClick}
      disabled={blocked}
      title={localizeToolbarLabel(title, language) + (lockText ? ` · ${lockText}` : '')}
      style={{
        width: 30,
        height: 30,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 5,
        border: active ? '1px solid #9DC3E0' : '1px solid transparent',
        background: active ? '#EAF3FB' : 'transparent',
        color: blocked ? '#9AA0A6' : (iconColor ?? 'var(--app-bar-text, #1A1B1C)'),
        cursor: blocked ? 'not-allowed' : 'pointer',
        opacity: blocked ? 0.45 : 1,
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

/**
 * 「添加或删除按钮」下拉：与原版真机一致的两级结构
 * （`parity/reference/labelshop/91-toolbar-customize-submenu.png`）——
 * 第一级只有一项 `添加或删除按钮(A) ▸`，其二级子菜单是 `标准 ▸`（按组勾选显示/隐藏）
 * 与独立的 `自定义...` 对话框入口。帮助 toolbar_mainbar.html：「用于添加或删除工具栏按钮，
 * 也可自定义按键及布局」。
 */
function CustomizeMenu({ groups, onToggle, onCustomize }: { groups: ToolbarGroupVisibility; onToggle: (key: ToolbarGroupKey, visible: boolean) => void; onCustomize: () => void }) {
  const { language } = useI18n()
  const [open, setOpen] = useState(false)
  const [subOpen, setSubOpen] = useState(false)
  const [stdOpen, setStdOpen] = useState(false)
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
  useEffect(() => { if (!open) { setSubOpen(false); setStdOpen(false) } }, [open])

  const itemStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '5px 12px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }
  const submenuStyle: CSSProperties = {
    position: 'absolute',
    left: '100%',
    top: -4,
    zIndex: 41,
    minWidth: 148,
    background: '#FFFFFF',
    border: '1px solid #B9B7AE',
    borderRadius: 4,
    boxShadow: '0 4px 12px rgba(0,0,0,.18)',
    padding: '4px 0',
    userSelect: 'none'
  }
  return (
    <div ref={boxRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        data-testid="toolbar-customize"
        aria-haspopup="menu"
        aria-expanded={open}
        title={localizeToolbarLabel('添加或删除按钮：用于添加或删除工具栏按钮，也可自定义按键及布局', language)}
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
          color: I.ICON_COLORS.help,
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
          aria-label={localizeToolbarLabel('添加或删除按钮', language)}
          style={{
            position: 'absolute',
            right: 0,
            top: 32,
            zIndex: 40,
            minWidth: 172,
            background: '#FFFFFF',
            border: '1px solid #B9B7AE',
            borderRadius: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,.18)',
            padding: '4px 0',
            userSelect: 'none'
          }}
        >
          {/* 第一级：与原版一致，本项自身带二级子菜单 */}
          <div
            data-testid="toolbar-customize-root"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={subOpen}
            style={{ ...itemStyle, background: subOpen ? '#EAF3FB' : 'transparent' }}
            onMouseEnter={() => setSubOpen(true)}
            onClick={(e) => { e.stopPropagation(); setSubOpen(true) }}
          >
            <span style={{ flex: 1 }}>{localizeToolbarLabel('添加或删除按钮(A)', language)}</span>
            <span style={{ fontSize: 10, color: '#6B7280' }}>▸</span>
          </div>
          {subOpen && (
            <div data-testid="toolbar-customize-submenu" role="menu" aria-label={localizeToolbarLabel('添加或删除按钮子菜单', language)} style={submenuStyle}>
              {/* 二级：标准（三级子菜单 = 按钮组勾选） */}
              <div style={{ position: 'relative' }}>
                <div
                  data-testid="toolbar-customize-standard"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={stdOpen}
                  style={{ ...itemStyle, background: stdOpen ? '#EAF3FB' : 'transparent' }}
                  onMouseEnter={() => setStdOpen(true)}
                  onClick={(e) => { e.stopPropagation(); setStdOpen(true) }}
                >
                  <span style={{ flex: 1 }}>{localizeToolbarLabel('标准', language)}</span>
                  <span style={{ fontSize: 10, color: '#6B7280' }}>▸</span>
                </div>
                {stdOpen && (
                  <div data-testid="toolbar-customize-groups" role="menu" aria-label={localizeToolbarLabel('标准', language)} style={{ ...submenuStyle, minWidth: 160 }}>
                    {TOOLBAR_GROUPS.map((grp) => (
                      <label key={grp.key} data-testid={'toolbar-group-' + grp.key} style={itemStyle}>
                        <input type="checkbox" checked={groups[grp.key]} onChange={(e) => onToggle(grp.key, e.target.checked)} />
                        {localizeToolbarLabel(grp.label, language)}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {/* 二级：独立的自定义对话框入口（对应帮助「也可自定义按键及布局」） */}
              <div
                data-testid="toolbar-customize-advanced"
                role="menuitem"
                style={itemStyle}
                onClick={(e) => { e.stopPropagation(); setOpen(false); onCustomize() }}
              >
                {localizeToolbarLabel('自定义...', language)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** 逐按钮登记：key 与 toolbarLayout.ts 的按钮表一一对应，回调仍由 Props 提供。 */
function buttonNode(key: string, p: Props): ReactNode {
  const readOnly = !p.entitlement.editable
  const features = p.entitlement.features
  const editLock = readOnly ? 'readonly' as const : undefined
  const featureLock = (allowed: boolean): 'feature' | undefined => allowed ? undefined : 'feature'
  switch (key) {
    case 'new': return <TBtn title="新建标签模版" onClick={p.onNew} disabled={readOnly} locked={editLock} onLocked={editLock ? p.onReadOnlyHelp : undefined} iconColor={I.ICON_COLORS.file}><I.INew /></TBtn>
    case 'open': return <TBtn title="打开标签模版" onClick={p.onOpen} iconColor={I.ICON_COLORS.file}><I.IOpen /></TBtn>
    case 'save': return <TBtn title="保存" onClick={p.onSave} disabled={readOnly} locked={editLock} onLocked={editLock ? p.onReadOnlyHelp : undefined} iconColor={I.ICON_COLORS.file}><I.ISave /></TBtn>
    case 'cut': return <TBtn title="剪切" onClick={p.onCut} disabled={!p.canCopy || readOnly} locked={editLock} onLocked={editLock ? p.onReadOnlyHelp : undefined} iconColor={I.ICON_COLORS.edit}><I.ICut /></TBtn>
    case 'copy': return <TBtn title="复制" onClick={p.onCopy} disabled={!p.canCopy} iconColor={I.ICON_COLORS.edit}><I.ICopy /></TBtn>
    case 'paste': return <TBtn title="粘贴" onClick={p.onPaste} disabled={!p.canPaste || readOnly} locked={editLock} onLocked={editLock ? p.onReadOnlyHelp : undefined} iconColor={I.ICON_COLORS.edit}><I.IPaste /></TBtn>
    case 'delete': return <TBtn title="删除" onClick={p.onDelete} disabled={!p.canDelete || readOnly} locked={editLock} onLocked={editLock ? p.onReadOnlyHelp : undefined} iconColor="#DC2626"><I.IDelete /></TBtn>
    case 'undo': return <TBtn title="撤销" onClick={p.onUndo} disabled={!p.canUndo || readOnly} locked={editLock} onLocked={editLock ? p.onReadOnlyHelp : undefined} iconColor={I.ICON_COLORS.history}><I.IUndo /></TBtn>
    case 'redo': return <TBtn title="恢复" onClick={p.onRedo} disabled={!p.canRedo || readOnly} locked={editLock} onLocked={editLock ? p.onReadOnlyHelp : undefined} iconColor={I.ICON_COLORS.history}><I.IRedo /></TBtn>
    case 'labelFormat': return <TBtn title="标签格式设置" onClick={p.onLabelFormat} disabled={readOnly} locked={editLock} onLocked={editLock ? p.onReadOnlyHelp : undefined} iconColor={I.ICON_COLORS.file}><I.ILabelFormat /></TBtn>
    case 'preview': return <TBtn title="打印预览" onClick={p.onPreview} disabled={p.busy} iconColor={I.ICON_COLORS.print}><I.IPreview /></TBtn>
    case 'print': return <TBtn title="打印" onClick={p.onPrint} disabled={p.busy} iconColor={I.ICON_COLORS.print}><I.IPrint /></TBtn>
    case 'dbConfig': return <TBtn title="设置数据库" onClick={p.onDbConfig} disabled={!p.canOpenDatabaseConfig || readOnly || !features.databaseSources} locked={editLock ?? featureLock(features.databaseSources)} onLocked={readOnly ? p.onReadOnlyHelp : (!features.databaseSources ? p.onUpgrade : undefined)} iconColor={I.ICON_COLORS.data}><I.IDbConfig /></TBtn>
    case 'dbLocate': return <TBtn title="定位记录" onClick={p.onDbLocate} disabled={!p.canDatabaseNavigate} iconColor={I.ICON_COLORS.data}><I.IRecord /></TBtn>
    case 'dbRefresh': return <TBtn title="更新数据库" onClick={p.onDbRefresh} disabled={!p.canDatabaseNavigate || readOnly || !features.databaseSources} locked={editLock ?? featureLock(features.databaseSources)} onLocked={readOnly ? p.onReadOnlyHelp : (!features.databaseSources ? p.onUpgrade : undefined)} iconColor={I.ICON_COLORS.data}><I.IRefresh /></TBtn>
    case 'dbFirst': return <TBtn title="第一条记录" onClick={p.onDbFirst} disabled={!p.canDatabaseNavigate} iconColor={I.ICON_COLORS.data}><I.IFirst /></TBtn>
    case 'dbPrev': return <TBtn title="上一条记录" onClick={p.onDbPrev} disabled={!p.canDatabaseNavigate} iconColor={I.ICON_COLORS.data}><I.IPrev /></TBtn>
    case 'dbNext': return <TBtn title="下一条记录" onClick={p.onDbNext} disabled={!p.canDatabaseNavigate} iconColor={I.ICON_COLORS.data}><I.INext /></TBtn>
    case 'dbLast': return <TBtn title="最后一条记录" onClick={p.onDbLast} disabled={!p.canDatabaseNavigate} iconColor={I.ICON_COLORS.data}><I.ILast /></TBtn>
    case 'zoomIn': return <TBtn title="放大" onClick={p.onZoomIn} iconColor={I.ICON_COLORS.view}><I.IZoomIn /></TBtn>
    case 'zoomOut': return <TBtn title="缩小" onClick={p.onZoomOut} iconColor={I.ICON_COLORS.view}><I.IZoomOut /></TBtn>
    case 'fitWidth': return <TBtn title="适应宽度" onClick={p.onFitWidth} iconColor={I.ICON_COLORS.view}><I.IFitWidth /></TBtn>
    case 'fitHeight': return <TBtn title="适应高度" onClick={p.onFitHeight} iconColor={I.ICON_COLORS.view}><I.IFitHeight /></TBtn>
    case 'fitWindow': return <TBtn title="撑满窗口" onClick={p.onFitWindow} iconColor={I.ICON_COLORS.view}><I.IFitWindow /></TBtn>
    case 'help': return <TBtn title="帮助主题" onClick={p.onHelp} iconColor={I.ICON_COLORS.help}><I.IHelp /></TBtn>
    default: {
      const t = OBJECT_TOOLS.find((x) => x.key === key)
      if (!t) return null
      const rfidLocked = t.key === 'rfid' && !features.rfidObjects
      const blocked = t.key !== 'select' && (readOnly || rfidLocked)
      const lockReason = blocked ? (readOnly ? 'readonly' as const : 'feature' as const) : undefined
      return (
        <TBtn
          title={'选择工具：' + t.label}
          onClick={() => p.onTool(t.key)}
          active={p.tool === t.key}
          dataTool={t.key}
          disabled={blocked}
          locked={lockReason}
          onLocked={lockReason ? (lockReason === 'feature' ? p.onUpgrade : p.onReadOnlyHelp) : undefined}
          iconColor={I.ICON_COLORS.object}
        >{t.icon}</TBtn>
      )
    }
  }
}

/** 按钮的回调登记（供自定义按键使用：按下指派的组合键等价于点该按钮）。 */
function buttonAction(key: string, p: Props): (() => void) | null {
  const map: Record<string, () => void> = {
    new: p.onNew,
    open: p.onOpen,
    save: p.onSave,
    cut: p.onCut,
    copy: p.onCopy,
    paste: p.onPaste,
    delete: p.onDelete,
    undo: p.onUndo,
    redo: p.onRedo,
    labelFormat: p.onLabelFormat,
    preview: p.onPreview,
    print: p.onPrint,
    dbConfig: p.onDbConfig,
    dbLocate: p.onDbLocate,
    dbRefresh: p.onDbRefresh,
    dbFirst: p.onDbFirst,
    dbPrev: p.onDbPrev,
    dbNext: p.onDbNext,
    dbLast: p.onDbLast,
    zoomIn: p.onZoomIn,
    zoomOut: p.onZoomOut,
    fitWidth: p.onFitWidth,
    fitHeight: p.onFitHeight,
    fitWindow: p.onFitWindow,
    help: p.onHelp
  }
  if (map[key]) return map[key]
  if (OBJECT_TOOLS.some((t) => t.key === key)) return () => p.onTool(key)
  return null
}

export default function Toolbar(props: Props) {
  const g = props.groups
  const layout = useMemo(() => normalizeToolbarLayout(props.layout ?? defaultToolbarLayout()), [props.layout])
  const shown = useMemo(() => visibleToolbarButtons(layout, g), [layout, g])

  // 自定义按键：按下指派给某按钮的组合键，等价于点该按钮（按钮被隐藏时不触发）。
  useEffect(() => {
    const entries = Object.entries(layout.keys)
    if (!entries.length) return
    const onKey = (e: KeyboardEvent) => {
      for (const [key, binding] of entries) {
        if (!shown.includes(key)) continue
        if (!matchToolbarKey(binding, e)) continue
        const run = buttonAction(key, props)
        if (!run) continue
        e.preventDefault()
        run()
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div data-testid="toolbar" style={{ background: 'var(--app-bar-bg, #FFFFFF)', color: 'var(--app-bar-text, #1A1B1C)', borderBottom: '1px solid #E4E3DD', padding: '4px 8px', display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', boxSizing: 'border-box', userSelect: 'none' }}>
      {shown.map((key, i) => {
        const group = toolbarButtonGroup(key)
        const prevGroup = i > 0 ? toolbarButtonGroup(shown[i - 1]) : undefined
        return (
          <span key={key} style={{ display: 'contents' }}>
            {group !== prevGroup && <Sep />}
            {buttonNode(key, props)}
          </span>
        )
      })}
      <Sep />
      {/* 添加或删除按钮 */}
      <CustomizeMenu groups={g} onToggle={props.onToggleGroup} onCustomize={props.onCustomize} />
    </div>
  )
}
