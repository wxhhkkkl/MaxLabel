import type { ReactNode } from 'react'
import * as I from './icons'

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

export default function Toolbar(props: Props) {
  return (
    <div data-testid="toolbar" style={{ background: 'var(--app-bar-bg, #FFFFFF)', color: 'var(--app-bar-text, #1A1B1C)', borderBottom: '1px solid #E4E3DD', padding: '4px 8px', display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', boxSizing: 'border-box', userSelect: 'none' }}>
      {/* 文件 */}
      <TBtn title="新建标签模版" onClick={props.onNew}><I.INew /></TBtn>
      <TBtn title="打开标签模版" onClick={props.onOpen}><I.IOpen /></TBtn>
      <TBtn title="保存" onClick={props.onSave}><I.ISave /></TBtn>
      <Sep />
      {/* 编辑 */}
      <TBtn title="剪切" onClick={props.onCut} disabled={!props.canCopy}><I.ICut /></TBtn>
      <TBtn title="复制" onClick={props.onCopy} disabled={!props.canCopy}><I.ICopy /></TBtn>
      <TBtn title="粘贴" onClick={props.onPaste} disabled={!props.canPaste}><I.IPaste /></TBtn>
      <TBtn title="删除" onClick={props.onDelete} disabled={!props.canDelete}><I.IDelete /></TBtn>
      <Sep />
      {/* 历史 */}
      <TBtn title="撤销" onClick={props.onUndo} disabled={!props.canUndo}><I.IUndo /></TBtn>
      <TBtn title="重做" onClick={props.onRedo} disabled={!props.canRedo}><I.IRedo /></TBtn>
      <Sep />
      {/* 打印 */}
      <TBtn title="标签格式设置" onClick={props.onLabelFormat}><I.ILabelFormat /></TBtn>
      <TBtn title="打印预览" onClick={props.onPreview} disabled={props.busy}><I.IPreview /></TBtn>
      <TBtn title="打印" onClick={props.onPrint} disabled={props.busy}><I.IPrint /></TBtn>
      <Sep />
      {/* 对象工具 */}
      {OBJECT_TOOLS.map((t) => (
        <TBtn key={t.key} title={'选择工具：' + t.label} onClick={() => props.onTool(t.key)} active={props.tool === t.key} dataTool={t.key}>
          {t.icon}
        </TBtn>
      ))}
      <Sep />
      {/* 数据库 */}
      <TBtn title="设置数据库" onClick={props.onDbConfig} disabled={!props.canDatabaseNavigate}><I.IDbConfig /></TBtn>
      <TBtn title="定位记录" onClick={props.onDbLocate} disabled={!props.canDatabaseNavigate}><I.IRecord /></TBtn>
      <TBtn title="更新数据库" onClick={props.onDbRefresh} disabled={!props.canDatabaseNavigate}><I.IRefresh /></TBtn>
      <TBtn title="第一条记录" onClick={props.onDbFirst} disabled={!props.canDatabaseNavigate}><I.IFirst /></TBtn>
      <TBtn title="上一条记录" onClick={props.onDbPrev} disabled={!props.canDatabaseNavigate}><I.IPrev /></TBtn>
      <TBtn title="下一条记录" onClick={props.onDbNext} disabled={!props.canDatabaseNavigate}><I.INext /></TBtn>
      <TBtn title="最后一条记录" onClick={props.onDbLast} disabled={!props.canDatabaseNavigate}><I.ILast /></TBtn>
      <Sep />
      {/* 显示 */}
      <TBtn title="放大" onClick={props.onZoomIn}><I.IZoomIn /></TBtn>
      <TBtn title="缩小" onClick={props.onZoomOut}><I.IZoomOut /></TBtn>
      <TBtn title="适应宽度" onClick={props.onFitWidth}><I.IFitWidth /></TBtn>
      <TBtn title="适应高度" onClick={props.onFitHeight}><I.IFitHeight /></TBtn>
      <TBtn title="撑满窗口" onClick={props.onFitWindow}><I.IFitWindow /></TBtn>
      <Sep />
      {/* 帮助 */}
      <TBtn title="帮助主题" onClick={props.onHelp}><I.IHelp /></TBtn>
    </div>
  )
}
