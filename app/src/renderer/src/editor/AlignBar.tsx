import * as I from './icons'

/**
 * 对齐栏（对标 LabelShop 对齐栏 7 组）：
 * 对齐（左/顶/右/底/垂直中/水平中）· 旋转（左旋90/180/右旋90）· 尺寸（水平同宽/垂直同高/同尺寸）
 * 居中（相对标签）· 间距（水平/垂直均布）· 顺序（最前/前移/后移/最后）· 位置（贴标签顶部/左侧/右侧/底部）
 */

export type AlignMode = 'left' | 'top' | 'right' | 'bottom' | 'midV' | 'midH'
export type RotateMode = 90 | 180 | 270
export type SameMode = 'w' | 'h' | 'wh'
export type CenterMode = 'h' | 'v'
export type DistMode = 'h' | 'v'
export type OrderMode = 'front' | 'forward' | 'backward' | 'back'
export type SnapEdge = 'top' | 'left' | 'right' | 'bottom'

interface Props {
  disabled: boolean
  onAlign: (m: AlignMode) => void
  onRotate: (deg: RotateMode) => void
  onSame: (m: SameMode) => void
  onCenter: (m: CenterMode) => void
  onDist: (m: DistMode) => void
  onOrder: (m: OrderMode) => void
  onSnap: (e: SnapEdge) => void
}

function Btn({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 28,
        height: 28,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 5,
        border: '1px solid transparent',
        background: 'transparent',
        color: disabled ? '#B9BCC2' : 'var(--app-bar-text, #1A1B1C)',
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
  return <div style={{ width: 1, height: 20, background: '#E4E3DD', margin: '0 5px', flexShrink: 0 }} />
}

export default function AlignBar(props: Props) {
  const d = props.disabled
  return (
    <div style={{ background: 'var(--app-bar-bg, #FFFFFF)', color: 'var(--app-bar-text, #1A1B1C)', borderBottom: '1px solid #E4E3DD', padding: '3px 8px', display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', boxSizing: 'border-box', userSelect: 'none' }}>
      <span style={{ fontSize: 12, color: '#6B7280', marginRight: 2, whiteSpace: 'nowrap' }}>对齐</span>
      {/* 对齐 */}
      <Btn title="左对齐" disabled={d} onClick={() => props.onAlign('left')}><I.IAlignL /></Btn>
      <Btn title="顶对齐" disabled={d} onClick={() => props.onAlign('top')}><I.IAlignT /></Btn>
      <Btn title="右对齐" disabled={d} onClick={() => props.onAlign('right')}><I.IAlignR /></Btn>
      <Btn title="底对齐" disabled={d} onClick={() => props.onAlign('bottom')}><I.IAlignB /></Btn>
      <Btn title="垂直居中" disabled={d} onClick={() => props.onAlign('midV')}><I.IAlignMidV /></Btn>
      <Btn title="水平居中" disabled={d} onClick={() => props.onAlign('midH')}><I.IAlignMidH /></Btn>
      <Sep />
      {/* 旋转 */}
      <Btn title="左旋 90°" disabled={d} onClick={() => props.onRotate(90)}><I.IRotateLeft /></Btn>
      <Btn title="旋转 180°" disabled={d} onClick={() => props.onRotate(180)}><I.IRotate180 /></Btn>
      <Btn title="右旋 90°" disabled={d} onClick={() => props.onRotate(270)}><I.IRotateRight /></Btn>
      <Sep />
      {/* 尺寸 */}
      <Btn title="水平同宽" disabled={d} onClick={() => props.onSame('w')}><I.ISameW /></Btn>
      <Btn title="垂直同高" disabled={d} onClick={() => props.onSame('h')}><I.ISameH /></Btn>
      <Btn title="水平垂直相同" disabled={d} onClick={() => props.onSame('wh')}><I.ISameWH /></Btn>
      <Sep />
      {/* 居中（相对标签） */}
      <Btn title="水平居中（相对标签）" disabled={d} onClick={() => props.onCenter('h')}><I.ICenterH /></Btn>
      <Btn title="垂直居中（相对标签）" disabled={d} onClick={() => props.onCenter('v')}><I.ICenterV /></Btn>
      <Sep />
      {/* 间距 */}
      <Btn title="水平间距相同" disabled={d} onClick={() => props.onDist('h')}><I.IDistH /></Btn>
      <Btn title="垂直间距相同" disabled={d} onClick={() => props.onDist('v')}><I.IDistV /></Btn>
      <Sep />
      {/* 顺序 */}
      <Btn title="移到最前" disabled={d} onClick={() => props.onOrder('front')}><I.IToFront /></Btn>
      <Btn title="前移一层" disabled={d} onClick={() => props.onOrder('forward')}><I.IForward /></Btn>
      <Btn title="后移一层" disabled={d} onClick={() => props.onOrder('backward')}><I.IBackward /></Btn>
      <Btn title="移到最后" disabled={d} onClick={() => props.onOrder('back')}><I.IToBack /></Btn>
      <Sep />
      {/* 位置（贴标签边） */}
      <Btn title="移到标签顶部" disabled={d} onClick={() => props.onSnap('top')}><I.ISnapTop /></Btn>
      <Btn title="移到标签左侧" disabled={d} onClick={() => props.onSnap('left')}><I.ISnapLeft /></Btn>
      <Btn title="移到标签右侧" disabled={d} onClick={() => props.onSnap('right')}><I.ISnapRight /></Btn>
      <Btn title="移到标签底部" disabled={d} onClick={() => props.onSnap('bottom')}><I.ISnapBottom /></Btn>
    </div>
  )
}
