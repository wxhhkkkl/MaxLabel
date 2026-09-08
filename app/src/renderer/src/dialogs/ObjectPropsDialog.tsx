import { useState } from 'react'
import type { ColorChangeConfig } from '../types'
import type { LabelObject, TextObj, BarcodeObj, RfidObj, RectObj, EllipseObj, LineObj, TableObj, ImageObj, Substr, LengthLimit, BarcodeOptions } from '../types'
import Modal, { FormField, selStyle } from './Modal'
import { FONTS, PT_TO_MM, PT_SIZES } from '../editor/FormatBar'
import { BARCODE_TYPES } from '../editor/barcode'
import DataSourceEditor from './DataSourceEditor'

interface Props {
  obj: LabelObject
  datasets: Record<string, import('../types').Dataset>
  onPatch: (patch: Partial<LabelObject>) => void
  onClose: () => void
  /** 初始页签（数据工具点击对象时定位到"数据源"） */
  initialTab?: string
  /** 模板公共颜色索引表（变色设置-共享索引表） */
  colorIndexTable?: string[]
  /** 更新模板公共属性（如公共颜色索引表） */
  onPatchDoc?: (patch: Partial<import('../types').LabelDoc>) => void
  /** 标签宽/高（毫米），用于常规页“位置对齐”下拉 */
  labelWidthMm?: number
  labelHeightMm?: number
}

const numStyle: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #D5D4CD',
  borderRadius: 6,
  fontSize: 13,
  width: 72,
  fontFamily: 'inherit'
}
const fullStyle: React.CSSProperties = { ...numStyle, width: '100%', boxSizing: 'border-box' }

const TAB = (active: boolean) => ({
  padding: '8px 18px',
  fontSize: 13,
  fontWeight: active ? 600 : 400,
  color: active ? '#2E6E93' : '#4B5563',
  borderBottom: active ? '2px solid #2E6E93' : '2px solid transparent',
  background: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit'
})

const OBJ_LABEL: Record<string, string> = {
  text: '文字',
  barcode: '条码',
  rfid: 'RFID',
  rect: '矩形',
  line: '直线',
  ellipse: '圆形',
  table: '表格',
  image: '图片',
  group: '组合'
}

/** 对象属性对话框（双击对象 / 右键"属性" / Alt+Enter）：按对象类型细分页签 */
export default function ObjectPropsDialog({ obj, datasets, onPatch, onClose, initialTab, colorIndexTable, onPatchDoc, labelWidthMm, labelHeightMm }: Props) {
  const type = obj.type
  const hasSource = type === 'text' || type === 'barcode' || type === 'rfid' || type === 'image'
  const hasTextTab = type === 'text' || type === 'barcode'

  type TabKey = 'datasource' | 'appearance' | 'text' | 'rfid' | 'table' | 'general'
  const tabs: Array<{ key: TabKey; label: string }> = []
  if (hasSource) tabs.push({ key: 'datasource', label: '数据源' })
  if (type === 'text') tabs.push({ key: 'appearance', label: '外观' })
  if (type === 'table') tabs.push({ key: 'table', label: '表格' })
  if (type === 'rect' || type === 'ellipse' || type === 'line') tabs.push({ key: 'appearance', label: '外观' })
  if (type === 'image') tabs.push({ key: 'appearance', label: '图片' })
  if (type === 'barcode') tabs.push({ key: 'appearance', label: '条码' })
  if (type === 'rfid') tabs.push({ key: 'rfid', label: 'RFID' })
  if (hasTextTab) tabs.push({ key: 'text', label: type === 'barcode' ? '文本' : '文本' })
  tabs.push({ key: 'general', label: '常规' })

  const startKey = (initialTab && tabs.some((t) => t.key === initialTab) ? initialTab : tabs[0].key) as TabKey
  const [tab, setTab] = useState<TabKey>(startKey)
  const [x, setX] = useState(String(obj.x))
  const [y, setY] = useState(String(obj.y))
  const [w, setW] = useState(String(obj.w))
  const [h, setH] = useState(String(obj.h))
  const [rot, setRot] = useState(String(obj.rotation ?? 0))
  const [mergeR, setMergeR] = useState(0)
  const [mergeC, setMergeC] = useState(0)
  const [mergeR2, setMergeR2] = useState(0)
  const [mergeC2, setMergeC2] = useState(0)
  const [mergeMsg, setMergeMsg] = useState('')

  const textObj = type === 'text' ? (obj as TextObj) : null
  const barcodeObj = type === 'barcode' ? (obj as BarcodeObj) : null
  const rfidObj = type === 'rfid' ? (obj as RfidObj) : null
  const rectObj = type === 'rect' ? (obj as RectObj) : null
  const ellipseObj = type === 'ellipse' ? (obj as EllipseObj) : null
  const lineObj = type === 'line' ? (obj as LineObj) : null
  const tableObj = type === 'table' ? (obj as TableObj) : null
  const source = (obj as { source?: import('../types').DataSource }).source
  const cc = (obj as { colorChange?: ColorChangeConfig }).colorChange
  const patchCc = (p: Partial<ColorChangeConfig>) => {
    onPatch({ colorChange: { mode: 'fixed', tableSource: 'private', privateTable: [], changeMode: 'solid', blockRows: 1, blockCols: 1, variableName: '', ...cc, ...p } } as never)
  }
  const imageObj = type === 'image' ? (obj as ImageObj) : null

  const commitGeom = () => {
    const nx = parseFloat(x)
    const ny = parseFloat(y)
    const nw = parseFloat(w)
    const nh = parseFloat(h)
    const nr = parseFloat(rot)
    onPatch({
      x: isNaN(nx) ? obj.x : nx,
      y: isNaN(ny) ? obj.y : ny,
      w: isNaN(nw) ? obj.w : nw,
      h: isNaN(nh) ? obj.h : nh,
      rotation: isNaN(nr) ? obj.rotation ?? 0 : nr
    })
  }

  return (
    <Modal
      title={`对象属性 - ${OBJ_LABEL[type] ?? type}`}
      onClose={onClose}
      width={560}
      footer={
        <>
          <button type="button" onClick={onClose} style={{ padding: '7px 18px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              commitGeom()
              onClose()
            }}
            style={{ padding: '7px 20px', borderRadius: 6, border: 'none', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
          >
            确定
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #ECEBE6', marginBottom: 14, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button key={t.key} type="button" style={TAB(tab === t.key)} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'datasource' && (
        <div style={{ maxHeight: 360, overflow: 'auto' }}>
          {source ? (
            <DataSourceEditor
              source={source}
              datasets={datasets}
              onChange={(s) => onPatch({ source: s } as never)}
              subSources={(obj as { subSources?: import("../types").DataSource[] }).subSources}
              onSubSources={(list) => onPatch({ subSources: list } as never)}
            />
          ) : (
            <div style={{ fontSize: 12.5, color: '#6B7280', padding: '8px 0' }}>该对象类型没有文本数据源。</div>
          )}
        </div>
      )}

      {tab === 'appearance' && (
        <div style={{ maxHeight: 360, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {textObj && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="字体">
                  <select value={textObj.fontFamily} onChange={(e) => onPatch({ fontFamily: e.target.value })} style={selStyle}>
                    {FONTS.map((f: string) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="字号（磅）">
                  <select
                    value={String(Math.round((textObj.fontSize / PT_TO_MM) * 10) / 10)}
                    onChange={(e) => onPatch({ fontSize: parseFloat(e.target.value) * PT_TO_MM })}
                    style={selStyle}
                  >
                    {PT_SIZES.map((s: number) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
              <FormField label="打印机内建字体" hint="TSPL: Font0-Font8；ZPL: A-Z / 0。仅指令打印时生效，缺省 = 按字号缩放的内建字体">
                <select value={(textObj as { printerFont?: string }).printerFont ?? ''} onChange={(e) => onPatch({ printerFont: e.target.value || undefined } as never)} style={selStyle}>
                  <option value="">自动</option>
                  <option value="Font0">Font0</option>
                  <option value="Font1">Font1</option>
                  <option value="Font2">Font2</option>
                  <option value="Font3">Font3</option>
                  <option value="Font4">Font4</option>
                  <option value="Font5">Font5</option>
                  <option value="Font6">Font6</option>
                  <option value="Font7">Font7</option>
                  <option value="Font8">Font8</option>
                </select>
              </FormField>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => onPatch({ bold: !textObj.bold })} style={{ fontWeight: 700, padding: '6px 14px', borderRadius: 6, border: textObj.bold ? '1px solid #2E6E93' : '1px solid #D5D4CD', background: textObj.bold ? '#E8F1F6' : '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                  粗体
                </button>
                <button type="button" onClick={() => onPatch({ italic: !textObj.italic })} style={{ fontStyle: 'italic', padding: '6px 14px', borderRadius: 6, border: textObj.italic ? '1px solid #2E6E93' : '1px solid #D5D4CD', background: textObj.italic ? '#E8F1F6' : '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                  斜体
                </button>
                <button type="button" onClick={() => onPatch({ underline: !textObj.underline })} style={{ textDecoration: 'underline', padding: '6px 14px', borderRadius: 6, border: textObj.underline ? '1px solid #2E6E93' : '1px solid #D5D4CD', background: textObj.underline ? '#E8F1F6' : '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                  下划线
                </button>
                <button type="button" onClick={() => onPatch({ strikeout: !textObj.strikeout })} style={{ textDecoration: 'line-through', padding: '6px 14px', borderRadius: 6, border: textObj.strikeout ? '1px solid #2E6E93' : '1px solid #D5D4CD', background: textObj.strikeout ? '#E8F1F6' : '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                  删除线
                </button>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
                  颜色
                  <input type="color" value={textObj.color} onChange={(e) => onPatch({ color: e.target.value })} style={{ width: 34, height: 28, border: 'none', padding: 0, background: 'none' }} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
                  背景
                  <input type="color" value={(textObj as { backgroundColor?: string }).backgroundColor ?? '#ffffff'} onChange={(e) => onPatch({ backgroundColor: e.target.value } as never)} style={{ width: 34, height: 28, border: 'none', padding: 0, background: 'none' }} />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="对齐">
                  <select value={(textObj as { align?: string }).align ?? 'left'} onChange={(e) => onPatch({ align: e.target.value } as never)} style={selStyle}>
                    <option value="left">左对齐</option>
                    <option value="center">居中</option>
                    <option value="right">右对齐</option>
                  </select>
                </FormField>
                <FormField label="文字类型" hint="单行 / 多行 / 圆形（弧形）">
                  <select value={(textObj as { textType?: string }).textType ?? 'single'} onChange={(e) => onPatch({ textType: e.target.value as never, arc: e.target.value === 'circle' } as never)} style={selStyle}>
                    <option value="single">单行</option>
                    <option value="multi">多行</option>
                    <option value="circle">圆形（弧形）</option>
                  </select>
                </FormField>
                {(textObj as { textType?: string }).textType === 'multi' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <FormField label="垂直对齐">
                        <select value={(textObj as { verticalAlign?: string }).verticalAlign ?? 'top'} onChange={(e) => onPatch({ verticalAlign: e.target.value } as never)} style={selStyle}>
                          <option value="top">顶部</option>
                          <option value="middle">中间</option>
                          <option value="bottom">底部</option>
                        </select>
                      </FormField>
                      <FormField label="行距（倍率）">
                        <input type="number" min={0.5} step={0.1} value={(textObj as { lineSpacing?: number }).lineSpacing ?? 1.2} onChange={(e) => onPatch({ lineSpacing: parseFloat(e.target.value) || 1.2 } as never)} style={numStyle} />
                      </FormField>
                    </div>
                  </>
                )}
                {(textObj as { textType?: string }).textType === 'circle' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <FormField label="弧度范围（度）">
                        <input type="number" min={10} max={360} value={(textObj as { arcExtent?: number }).arcExtent ?? 180} onChange={(e) => onPatch({ arcExtent: parseInt(e.target.value, 10) || 180 } as never)} style={numStyle} />
                      </FormField>
                      <FormField label="起始角度（度）">
                        <input type="number" value={(textObj as { arcAngle?: number }).arcAngle ?? 0} onChange={(e) => onPatch({ arcAngle: parseInt(e.target.value, 10) || 0 } as never)} style={numStyle} />
                      </FormField>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <FormField label="半径（mm，0=自动）">
                        <input type="number" min={0} value={(textObj as { arcRadius?: number }).arcRadius ?? 0} onChange={(e) => onPatch({ arcRadius: parseFloat(e.target.value) || 0 } as never)} style={numStyle} />
                      </FormField>
                      <FormField label="回绕方向">
                        <select value={(textObj as { arcDir?: string }).arcDir ?? 'cw'} onChange={(e) => onPatch({ arcDir: e.target.value } as never)} style={selStyle}>
                          <option value="cw">顺时针</option>
                          <option value="ccw">逆时针</option>
                        </select>
                      </FormField>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <FormField label="文字方向">
                        <select value={(textObj as { arcTextDir?: string }).arcTextDir ?? 'out'} onChange={(e) => onPatch({ arcTextDir: e.target.value } as never)} style={selStyle}>
                          <option value="out">向外</option>
                          <option value="in">向内</option>
                        </select>
                      </FormField>
                      <div />
                    </div>
                  </>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
                  <input type="checkbox" checked={(textObj as { arc?: boolean }).arc === true} onChange={(e) => onPatch({ arc: e.target.checked, textType: e.target.checked ? 'circle' : 'single' } as never)} />
                  弧形文字
                </label>
              </div>
            </>
          )}
          {(rectObj || ellipseObj) && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="填充颜色">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <select
                      value={(rectObj ? rectObj.fill : (ellipseObj as EllipseObj).fill) === '' ? 'none' : 'solid'}
                      onChange={(e) => onPatch({ fill: e.target.value === 'none' ? '' : '#ffffff' } as never)}
                      style={{ ...selStyle, width: 54, flexShrink: 0 }}
                    >
                      <option value="solid">纯色</option>
                      <option value="none">无</option>
                    </select>
                    {(rectObj ? rectObj.fill : (ellipseObj as EllipseObj).fill) !== '' && (
                      <input type="color" value={rectObj ? rectObj.fill : (ellipseObj as EllipseObj).fill} onChange={(e) => onPatch({ fill: e.target.value } as never)} style={{ width: 44, height: 30, border: 'none', padding: 0, background: 'none' }} />
                    )}
                  </span>
                </FormField>
                <FormField label="描边颜色">
                  <input type="color" value={rectObj ? rectObj.stroke : (ellipseObj as EllipseObj).stroke} onChange={(e) => onPatch({ stroke: e.target.value } as never)} style={{ width: 44, height: 30, border: 'none', padding: 0, background: 'none' }} />
                </FormField>
              </div>
              <FormField label="线宽（mm）">
                <input type="number" step={0.1} min={0} value={rectObj ? rectObj.strokeWidth : (ellipseObj as EllipseObj).strokeWidth} onChange={(e) => onPatch({ strokeWidth: parseFloat(e.target.value) || 0 })} style={numStyle} />
              </FormField>
            </>
          )}
          {lineObj && (
            <>
              <FormField label="线颜色">
                <input type="color" value={lineObj.stroke} onChange={(e) => onPatch({ stroke: e.target.value } as never)} style={{ width: 44, height: 30, border: 'none', padding: 0, background: 'none' }} />
              </FormField>
              <FormField label="线宽（mm）">
                <input type="number" step={0.1} min={0} value={lineObj.strokeWidth} onChange={(e) => onPatch({ strokeWidth: parseFloat(e.target.value) || 0 })} style={numStyle} />
              </FormField>
            </>
          )}
          {barcodeObj && (
            <>
              <FormField label="码制">
                <select value={barcodeObj.symbology} onChange={(e) => onPatch({ symbology: e.target.value })} style={selStyle}>
                  {BARCODE_TYPES.map((b) => (
                    <option key={b.bcid} value={b.bcid}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="窄条宽度（mm）">
                  <input type="number" step={0.1} value={(barcodeObj as { moduleWidthMm?: number }).moduleWidthMm ?? 0.3} onChange={(e) => onPatch({ moduleWidthMm: parseFloat(e.target.value) || 0.3 } as never)} style={numStyle} />
                </FormField>
                <FormField label="宽条比例">
                  <select value={(barcodeObj as { wideRatio?: number }).wideRatio ?? 2} onChange={(e) => onPatch({ wideRatio: parseFloat(e.target.value) } as never)} style={selStyle}>
                    <option value={2}>2:1</option>
                    <option value={2.5}>2.5:1</option>
                    <option value={3}>3:1</option>
                  </select>
                </FormField>
              </div>
              {/* —— 各码制特殊选项（对标原版条码对象的属性"特殊选项"页） —— */}
              {(() => {
                const bo = (barcodeObj as { barcodeOptions?: BarcodeOptions }).barcodeOptions ?? {}
                const patchBo = (p: Partial<BarcodeOptions>) => onPatch({ barcodeOptions: { ...bo, ...p } } as never)
                const rows: React.ReactNode[] = []
                if (barcodeObj.symbology === 'code128' || barcodeObj.symbology === 'qrcode' || barcodeObj.symbology === 'datamatrix') {
                  rows.push(
                    <label key="gs1" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
                      <input type="checkbox" checked={!!bo.gs1} onChange={(e) => patchBo({ gs1: e.target.checked })} style={{ width: 14, height: 14 }} />
                      {barcodeObj.symbology === 'code128' ? 'GS1/EAN-128（自动插入 FNC1，支持 ^1 转义）' : 'GS1 模式'}
                    </label>
                  )
                }
                if (barcodeObj.symbology === 'code128') {
                  rows.push(
                    <FormField key="charset" label="字符集">
                      <select value={bo.charset ?? 'auto'} onChange={(e) => patchBo({ charset: e.target.value as BarcodeOptions['charset'] })} style={selStyle}>
                        <option value="auto">自动</option>
                        <option value="a">字符集 A</option>
                        <option value="b">字符集 B</option>
                        <option value="c">字符集 C（双密度数字）</option>
                        <option value="manual">手动（^A ^B ^C ^1 控制符）</option>
                      </select>
                    </FormField>
                  )
                }
                if (barcodeObj.symbology === 'qrcode') {
                  rows.push(
                    <div key="qr" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <FormField label="纠错级别">
                        <select value={bo.eclevel ?? 'M'} onChange={(e) => patchBo({ eclevel: e.target.value })} style={selStyle}>
                          <option value="L">L（约7%）</option>
                          <option value="M">M（约15%）</option>
                          <option value="Q">Q（约25%）</option>
                          <option value="H">H（约30%）</option>
                        </select>
                      </FormField>
                      <FormField label="字符编码">
                        <select value={bo.encoding ?? 'ansi'} onChange={(e) => patchBo({ encoding: e.target.value as BarcodeOptions['encoding'] })} style={selStyle}>
                          <option value="ansi">ANSI</option>
                          <option value="utf8">UTF-8</option>
                        </select>
                      </FormField>
                    </div>
                  )
                  rows.push(
                    <label key="qrIcon" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
                      <input type="checkbox" checked={!!bo.qrIconArea} onChange={(e) => patchBo({ qrIconArea: e.target.checked })} style={{ width: 14, height: 14 }} />
                      图标区域（中央留白，供插入 Logo 图标）
                    </label>
                  )
                }
                if (barcodeObj.symbology === 'pdf417') {
                  rows.push(
                    <label key="trunc" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
                      <input type="checkbox" checked={!!bo.truncated} onChange={(e) => patchBo({ truncated: e.target.checked })} style={{ width: 14, height: 14 }} />
                      截短型 PDF417（节省空间）
                    </label>
                  )
                  rows.push(
                    <FormField key="pdfEcl" label="纠错级别">
                      <select value={bo.eclevel ?? '2'} onChange={(e) => patchBo({ eclevel: e.target.value })} style={selStyle}>
                        <option value="0">0（最低）</option>
                        <option value="2">2（默认）</option>
                        <option value="4">4</option>
                        <option value="6">6</option>
                        <option value="8">8（最高）</option>
                      </select>
                    </FormField>
                  )
                }
                if (barcodeObj.symbology === 'datamatrix') {
                  rows.push(
                    <FormField key="dmEnc" label="字符编码">
                      <select value={bo.encoding ?? 'ansi'} onChange={(e) => patchBo({ encoding: e.target.value as BarcodeOptions['encoding'] })} style={selStyle}>
                        <option value="ansi">ANSI</option>
                        <option value="utf8">UTF-8</option>
                      </select>
                    </FormField>
                  )
                  rows.push(<div key="dmEcc" style={{ fontSize: 12, color: '#9CA3AF' }}>纠错：仅支持 ECC200（固定）。</div>)
                }
                if (barcodeObj.symbology === 'hanxin') {
                  rows.push(
                    <div key="hx" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <FormField label="纠错级别">
                        <select value={bo.eclevel ?? 'L2'} onChange={(e) => patchBo({ eclevel: e.target.value })} style={selStyle}>
                          <option value="L1">L1（最低）</option>
                          <option value="L2">L2</option>
                          <option value="L3">L3</option>
                          <option value="L4">L4（最高）</option>
                        </select>
                      </FormField>
                      <FormField label="版本">
                        <select value={bo.hanxinVersion ?? 'auto'} onChange={(e) => patchBo({ hanxinVersion: e.target.value })} style={selStyle}>
                          <option value="auto">自动</option>
                          <option value="v1">版本 1</option>
                          <option value="v2">版本 2</option>
                          <option value="v3">版本 3</option>
                          <option value="v4">版本 4</option>
                        </select>
                      </FormField>
                    </div>
                  )
                }
                if (barcodeObj.symbology === 'code39') {
                  rows.push(
                    <label key="39s" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
                      <input type="checkbox" checked={bo.code39Stars !== false} onChange={(e) => patchBo({ code39Stars: e.target.checked })} style={{ width: 14, height: 14 }} />
                      显示启始符/终止符（*）
                    </label>
                  )
                  rows.push(
                    <FormField key="39c" label="校验字符">
                      <select value={bo.code39Check ?? 'none'} onChange={(e) => patchBo({ code39Check: e.target.value as BarcodeOptions['code39Check'] })} style={selStyle}>
                        <option value="none">无</option>
                        <option value="mod10">模10校验</option>
                        <option value="mod43">模43校验</option>
                        <option value="library">图书馆用校验码</option>
                      </select>
                    </FormField>
                  )
                }
                if (barcodeObj.symbology === 'interleaved2of5') {
                  rows.push(
                    <label key="itf25" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
                      <input type="checkbox" checked={!!bo.itf25Check} onChange={(e) => patchBo({ itf25Check: e.target.checked })} style={{ width: 14, height: 14 }} />
                      校验字符（模10）
                    </label>
                  )
                }
                if (barcodeObj.symbology === 'codabar') {
                  rows.push(
                    <FormField key="cob" label="校验字符">
                      <select value={bo.codabarCheck ?? 'none'} onChange={(e) => patchBo({ codabarCheck: e.target.value as BarcodeOptions['codabarCheck'] })} style={selStyle}>
                        <option value="none">无</option>
                        <option value="mod10">模10校验</option>
                        <option value="library">图书馆用校验码</option>
                      </select>
                    </FormField>
                  )
                  rows.push(
                    <div key="cobs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <FormField label="起始符">
                        <select value={bo.codabarStart ?? 'a'} onChange={(e) => patchBo({ codabarStart: e.target.value as BarcodeOptions['codabarStart'] })} style={selStyle}>
                          <option value="a">A</option>
                          <option value="b">B</option>
                          <option value="c">C</option>
                          <option value="d">D</option>
                        </select>
                      </FormField>
                      <FormField label="终止符">
                        <select value={bo.codabarStop ?? 'b'} onChange={(e) => patchBo({ codabarStop: e.target.value as BarcodeOptions['codabarStop'] })} style={selStyle}>
                          <option value="a">A</option>
                          <option value="b">B</option>
                          <option value="c">C</option>
                          <option value="d">D</option>
                        </select>
                      </FormField>
                    </div>
                  )
                }
                if (barcodeObj.symbology === 'databaromni') {
                  rows.push(
                    <label key="rss1" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
                      <input type="checkbox" checked={bo.rssGs1 !== false} onChange={(e) => patchBo({ rssGs1: e.target.checked })} style={{ width: 14, height: 14 }} />
                      保持 GS1 规格（尺寸比例按标准）
                    </label>
                  )
                  rows.push(
                    <FormField key="rsst" label="类型">
                      <select value={bo.rssType ?? 'omni'} onChange={(e) => patchBo({ rssType: e.target.value as BarcodeOptions['rssType'] })} style={selStyle}>
                        <option value="omni">全向式</option>
                        <option value="truncated">截断式</option>
                        <option value="stacked">层排式</option>
                        <option value="stackedomni">全向层排式</option>
                        <option value="limited">限定式</option>
                      </select>
                    </FormField>
                  )
                  rows.push(
                    <FormField key="rsss" label="分隔符尺寸（与 X 尺寸比值）">
                      <input type="number" step={0.1} value={bo.rssSep ?? 10} onChange={(e) => patchBo({ rssSep: parseFloat(e.target.value) || 10 })} style={numStyle} />
                    </FormField>
                  )
                }
                if (['ean13', 'ean8', 'upca', 'upce'].includes(barcodeObj.symbology)) {
                  rows.push(
                    <FormField key="ean" label="附加条码">
                      <select value={bo.eanAddon ?? 'none'} onChange={(e) => patchBo({ eanAddon: e.target.value as BarcodeOptions['eanAddon'] })} style={selStyle}>
                        <option value="none">无</option>
                        <option value="2">2 位附加码</option>
                        <option value="5">5 位附加码</option>
                      </select>
                    </FormField>
                  )
                }
                if (barcodeObj.symbology === 'itf14') {
                  rows.push(
                    <div key="itf" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
                        <input type="checkbox" checked={bo.itf14Check !== false} onChange={(e) => patchBo({ itf14Check: e.target.checked })} style={{ width: 14, height: 14 }} />
                        检验字符（建议总是选中）
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
                        <input type="checkbox" checked={!!bo.itf14Bearer} onChange={(e) => patchBo({ itf14Bearer: e.target.checked })} style={{ width: 14, height: 14 }} />
                        保护框
                      </label>
                      {!!bo.itf14Bearer && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <FormField label="保护框粗细">
                            <input type="number" step={0.5} value={bo.itf14BearerRatio ?? 5} onChange={(e) => patchBo({ itf14BearerRatio: parseFloat(e.target.value) || 5 })} style={numStyle} />
                          </FormField>
                          <FormField label="保护框空白区">
                            <input type="number" step={0.5} value={bo.itf14QuietRatio ?? 10} onChange={(e) => patchBo({ itf14QuietRatio: parseFloat(e.target.value) || 10 })} style={numStyle} />
                          </FormField>
                        </div>
                      )}
                    </div>
                  )
                }
                if (rows.length === 0) rows.push(<div key="none" style={{ fontSize: 12, color: '#9CA3AF' }}>该码制无特殊选项。</div>)
                return (
                  <>
                    <div style={{ borderTop: '1px solid #E4E3DD', paddingTop: 10, fontWeight: 600, fontSize: 12.5, color: '#1A1B1C' }}>特殊选项</div>
                    {rows}
                  </>
                )
              })()}
            </>
          )}
          {imageObj && (
            <>
              <FormField label="类型" hint="嵌入=图片随模板保存；链接=引用外部图片文件；数据源图片=文件名来自数据源（用于证卡等可变图片）">
                <select value={imageObj.imgType ?? 'embed'} onChange={(e) => onPatch({ imgType: e.target.value } as never)} style={selStyle}>
                  <option value="embed">嵌入</option>
                  <option value="link">链接</option>
                  <option value="datasource">数据源图片</option>
                </select>
              </FormField>
              {imageObj.imgType === 'embed' && (
                <FormField label="更换图片" hint="重新选择图片文件替换当前图片">
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    id="img-file-input"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      const rd = new FileReader()
                      rd.onload = () => onPatch({ src: String(rd.result) } as never)
                      rd.readAsDataURL(f)
                    }}
                  />
                  <button type="button" onClick={() => (document.getElementById('img-file-input') as HTMLInputElement | null)?.click()} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
                    选择图片文件…
                  </button>
                </FormField>
              )}
              {imageObj.imgType === 'link' && (
                <FormField label="图片文件" hint="点击按钮选择本地图片文件（按路径引用，图片变化后打印自动更新）">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={fullStyle} value={imageObj.linkPath ?? ''} onChange={(e) => onPatch({ linkPath: e.target.value } as never)} placeholder="C:\images\logo.png" />
                    <button
                      type="button"
                      onClick={async () => {
                        const r = await window.maxlabel.pickFile()
                        if (r.ok && r.path) onPatch({ linkPath: r.path } as never)
                      }}
                      style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
                    >
                      选择…
                    </button>
                  </div>
                </FormField>
              )}
              {imageObj.imgType === 'datasource' && (
                <FormField label="图片目录" hint="图片文件所在目录；文件名由「数据源」页签的数据源解析（与标签文件同目录时可留空）">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={fullStyle} value={imageObj.linkPath ?? ''} onChange={(e) => onPatch({ linkPath: e.target.value } as never)} placeholder="C:\images" />
                    <button
                      type="button"
                      onClick={async () => {
                        const r = await window.maxlabel.pickDir()
                        if (r.ok && r.path) onPatch({ linkPath: r.path } as never)
                      }}
                      style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
                    >
                      选择目录…
                    </button>
                  </div>
                </FormField>
              )}
              <FormField label="图片来源">
                <div style={{ fontSize: 12, color: '#6B7280', wordBreak: 'break-all', lineHeight: 1.5 }}>
                  {imageObj.imgType === 'link' ? `链接：${imageObj.linkPath ?? '（未设置）'}` :
                   imageObj.imgType === 'datasource' ? `数据源图片（目录：${imageObj.linkPath || '同目录'}）` :
                   imageObj.src && imageObj.src.startsWith('data:') ? '内嵌图片（dataURL）' : (imageObj.src || '（无）')}
                </div>
              </FormField>
              <div style={{ fontSize: 12, color: '#9AA0A6' }}>
                {imageObj.imgType === 'datasource'
                  ? '数据源图片：在「数据源」页签设置图片文件名（数据库/序列号等），打印时按每张标签解析文件名并从目录读取图片。'
                  : '提示：图片的宽高（W×H，毫米）在「常规」页签调整。'}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'rfid' && rfidObj && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="读写器类型" hint="选择 RFID 读写器协议">
            <select value={rfidObj.readerType ?? 'auto'} onChange={(e) => onPatch({ readerType: e.target.value } as never)} style={selStyle}>
              <option value="auto">自动 / 打印机默认</option>
              <option value="iso18000-6c">ISO18000-6C（UHF）</option>
              <option value="iso14443">ISO14443（HF）</option>
              <option value="gbt29768">国标 GB/T 29768</option>
              <option value="gjb7377">军标 GJB 7377.1</option>
            </select>
          </FormField>
          <FormField label="数据段位置" hint="RFID 标签存储区：EPC（常用）/ USER / TID">
            <select value={rfidObj.bank} onChange={(e) => onPatch({ bank: e.target.value as 'EPC' | 'USER' | 'TID' })} style={selStyle}>
              <option value="EPC">EPC 区</option>
              <option value="USER">USER 区</option>
              <option value="TID">TID 区</option>
            </select>
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="起始块位置">
              <input type="number" min={0} value={rfidObj.startBlock ?? 0} onChange={(e) => onPatch({ startBlock: parseInt(e.target.value, 10) || 0 } as never)} style={numStyle} />
            </FormField>
            <FormField label="数据类型" hint="RFID 标记数据默认 16 进制类型">
              <select value={rfidObj.dataType ?? 'auto'} onChange={(e) => onPatch({ dataType: e.target.value } as never)} style={selStyle}>
                <option value="auto">自动（纯 16 进制原样，否则按 ASCII 转码）</option>
                <option value="hex">十六进制</option>
                <option value="ascii">ASCII</option>
              </select>
            </FormField>
          </div>
          {rfidObj.bank === 'EPC' && (
            <FormField label="EPC 区 PC 协议控制字" hint="ISO1800-6C 协议 PC 值（十六进制，如 3000）">
              <input style={fullStyle} value={rfidObj.pcWord ?? ''} onChange={(e) => onPatch({ pcWord: e.target.value } as never)} placeholder="3000" />
            </FormField>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="编码码头" hint="国标/军标协议编码码头">
              <input style={fullStyle} value={rfidObj.codeHead ?? ''} onChange={(e) => onPatch({ codeHead: e.target.value } as never)} />
            </FormField>
            <FormField label="编码长度">
              <input type="number" min={0} value={rfidObj.codeLen ?? 0} onChange={(e) => onPatch({ codeLen: parseInt(e.target.value, 10) || 0 } as never)} style={numStyle} />
            </FormField>
          </div>
          <FormField label="访问控制" hint="对 EPC / USER / 保护区执行锁定、解锁或永久锁定">
            <select value={rfidObj.lockOp ?? (rfidObj.lock ? 'lock' : 'none')} onChange={(e) => onPatch({ lockOp: e.target.value as never, lock: e.target.value !== 'none' } as never)} style={selStyle}>
              <option value="none">不操作</option>
              <option value="lock">锁定</option>
              <option value="unlock">解锁</option>
              <option value="permanent">永久锁定</option>
            </select>
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Access 口令（4 字节 Hex）">
              <input style={fullStyle} value={rfidObj.accessPwd ?? '00000000'} onChange={(e) => onPatch({ accessPwd: e.target.value })} />
            </FormField>
            <FormField label="Kill 口令（4 字节 Hex）">
              <input style={fullStyle} value={rfidObj.killPwd ?? '00000000'} onChange={(e) => onPatch({ killPwd: e.target.value })} />
            </FormField>
          </div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>
            RFID 标签编程：在打印时把数据源内容写入对应区域，需打印机带 RFID 打印头；标签上不打印可见内容。写入指令随固件而异，请真机验证。
          </div>
        </div>
      )}

      {tab === 'table' && tableObj && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="行数">
              <input type="number" min={1} max={50} value={tableObj.rows} onChange={(e) => onPatch({ rows: parseInt(e.target.value || '1', 10) })} style={numStyle} />
            </FormField>
            <FormField label="列数">
              <input type="number" min={1} max={50} value={tableObj.cols} onChange={(e) => onPatch({ cols: parseInt(e.target.value || '1', 10) })} style={numStyle} />
            </FormField>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
            <input type="checkbox" checked={!!tableObj.keepSize} onChange={(e) => onPatch({ keepSize: e.target.checked } as never)} style={{ width: 14, height: 14 }} />
            增删行列时保持表格尺寸（在表格外框内重排行高列宽）
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="边框颜色">
              <input type="color" value={tableObj.borderColor} onChange={(e) => onPatch({ borderColor: e.target.value } as never)} style={{ width: 44, height: 30, border: 'none', padding: 0, background: 'none' }} />
            </FormField>
            <FormField label="边框宽度（mm）">
              <input type="number" step={0.1} min={0} value={tableObj.borderWidth} onChange={(e) => onPatch({ borderWidth: parseFloat(e.target.value) || 0 })} style={numStyle} />
            </FormField>
          </div>
          <div style={{ borderTop: '1px solid #ECEBE6', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1B1C' }}>合并单元格</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <FormField label="起始行"><input type="number" min={0} value={mergeR} onChange={(e) => setMergeR(Math.max(0, parseInt(e.target.value || '0', 10)))} style={numStyle} /></FormField>
              <FormField label="起始列"><input type="number" min={0} value={mergeC} onChange={(e) => setMergeC(Math.max(0, parseInt(e.target.value || '0', 10)))} style={numStyle} /></FormField>
              <FormField label="结束行"><input type="number" min={0} value={mergeR2} onChange={(e) => setMergeR2(Math.max(0, parseInt(e.target.value || '0', 10)))} style={numStyle} /></FormField>
              <FormField label="结束列"><input type="number" min={0} value={mergeC2} onChange={(e) => setMergeC2(Math.max(0, parseInt(e.target.value || '0', 10)))} style={numStyle} /></FormField>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  const r1 = Math.min(mergeR, mergeR2); const r2 = Math.max(mergeR, mergeR2)
                  const c1 = Math.min(mergeC, mergeC2); const c2 = Math.max(mergeC, mergeC2)
                  if (r1 < 0 || r2 >= tableObj.rows || c1 < 0 || c2 >= tableObj.cols) return
                  const merges = [...(tableObj.merges ?? [])]
                  const overlap = merges.some((m) => !(r2 < m.r || r1 > m.r2 || c2 < m.c || c1 > m.c2))
                  if (overlap) { setMergeMsg('与已有合并区域重叠，无法合并'); return }
                  merges.push({ r: r1, c: c1, r2, c2 })
                  onPatch({ merges } as never)
                  setMergeMsg('')
                }}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #2E6E93', background: '#fff', color: '#2E6E93', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}
              >
                合并选中区域
              </button>
              {mergeMsg && <span style={{ fontSize: 12, color: '#EA6668', alignSelf: 'center' }}>{mergeMsg}</span>}
            </div>
            {tableObj.merges && tableObj.merges.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {tableObj.merges.map((m, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: '#F7F6F2', borderRadius: 6, fontSize: 12.5, color: '#1A1B1C' }}>
                    <span>合并区域：第 {m.r + 1}-{m.r2 + 1} 行 × 第 {m.c + 1}-{m.c2 + 1} 列</span>
                    <button
                      type="button"
                      onClick={() => {
                        const merges = (tableObj.merges ?? []).filter((_, i) => i !== idx)
                        onPatch({ merges } as never)
                      }}
                      style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
                    >
                      取消合并
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'text' && (
        <div style={{ maxHeight: 360, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {textObj && (
            <>
              <FormField label="大小写转换" hint="仅影响打印输出，不影响编辑">
                <select value={(textObj as { textFormat?: string }).textFormat ?? 'none'} onChange={(e) => onPatch({ textFormat: e.target.value } as never)} style={selStyle}>
                  <option value="none">无</option>
                  <option value="upper">全部大写</option>
                  <option value="lower">全部小写</option>
                  <option value="capitalize">首字母大写</option>
                </select>
              </FormField>
              <FormField label="字符模板" hint="一个 '?' 表示原有数据的一个字符，其它字符插入数据序列。如数据 0123456789，模板 (01)??… 输出 (01)0123456789">
                <input style={fullStyle} value={(textObj as { charTemplate?: string }).charTemplate ?? ''} onChange={(e) => onPatch({ charTemplate: e.target.value } as never)} placeholder="(01)??????????" />
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="子串起始（0 起）">
                  <input
                    type="number"
                    min={0}
                    value={(textObj as { substr?: { start: number } }).substr?.start ?? ''}
                    onChange={(e) => {
                      const cur = (textObj as { substr?: { start: number; length: number } }).substr
                      const start = parseInt(e.target.value || '0', 10)
                      onPatch({ substr: { start, length: cur?.length ?? 0 } } as never)
                    }}
                    style={numStyle}
                  />
                </FormField>
                <FormField label="子串长度（0=全部）">
                  <input
                    type="number"
                    min={0}
                    value={(textObj as { substr?: { length: number } }).substr?.length ?? 0}
                    onChange={(e) => {
                      const cur = (textObj as { substr?: { start: number; length: number } }).substr
                      const length = parseInt(e.target.value || '0', 10)
                      onPatch({ substr: { start: cur?.start ?? 0, length } } as never)
                    }}
                    style={numStyle}
                  />
                </FormField>
              </div>
              {/* 截短（对标原版"截短变量长度"） */}
              <FormField label="截短" hint="删除空格 / 丢弃 / 保留指定字符">
                <select
                  value={(textObj as { substr?: { cutType?: string } }).substr?.cutType ?? 'none'}
                  onChange={(e) => {
                    const cur = (textObj as { substr?: Substr }).substr
                    onPatch({ substr: { ...(cur ?? { start: 0, length: 0 }), cutType: e.target.value } } as never)
                  }}
                  style={selStyle}
                >
                  <option value="none">无</option>
                  <option value="trimLeft">删除左侧空格</option>
                  <option value="trimRight">删除右侧空格</option>
                  <option value="dropLeft">丢弃左侧字符</option>
                  <option value="dropRight">丢弃右侧字符</option>
                  <option value="keepLeft">保留左侧字符</option>
                  <option value="keepRight">保留右侧字符</option>
                </select>
              </FormField>
              {((textObj as { substr?: { cutType?: string } }).substr?.cutType === 'dropLeft' ||
                (textObj as { substr?: { cutType?: string } }).substr?.cutType === 'dropRight' ||
                (textObj as { substr?: { cutType?: string } }).substr?.cutType === 'keepLeft' ||
                (textObj as { substr?: { cutType?: string } }).substr?.cutType === 'keepRight') && (
                <FormField label="字符数">
                  <input
                    type="number" min={0}
                    value={(textObj as { substr?: { cutCount?: number } }).substr?.cutCount ?? 1}
                    onChange={(e) => {
                      const cur = (textObj as { substr?: Substr }).substr
                      onPatch({ substr: { ...(cur ?? { start: 0, length: 0, cutType: 'none' }), cutCount: parseInt(e.target.value || '0', 10) } } as never)
                    }}
                    style={numStyle}
                  />
                </FormField>
              )}
              {/* 字符数限制（对标原版"字符数限制"） */}
              <FormField label="字符数限制">
                <select
                  value={(textObj as { lengthLimit?: { mode?: string } }).lengthLimit?.mode ?? 'none'}
                  onChange={(e) => {
                    const cur = (textObj as { lengthLimit?: LengthLimit }).lengthLimit
                    onPatch({ lengthLimit: { ...(cur ?? {}), mode: e.target.value } } as never)
                  }}
                  style={selStyle}
                >
                  <option value="none">无</option>
                  <option value="min">仅限制最小字符数</option>
                  <option value="max">仅限制最大字符数</option>
                  <option value="both">同时限制最小/最大</option>
                </select>
              </FormField>
              {((textObj as { lengthLimit?: { mode?: string } }).lengthLimit?.mode === 'min' ||
                (textObj as { lengthLimit?: { mode?: string } }).lengthLimit?.mode === 'both') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <FormField label="最小字符数">
                    <input
                      type="number" min={0}
                      value={(textObj as { lengthLimit?: LengthLimit }).lengthLimit?.min ?? 0}
                      onChange={(e) => {
                        const cur = (textObj as { lengthLimit?: LengthLimit }).lengthLimit
                        onPatch({ lengthLimit: { ...(cur ?? {}), min: parseInt(e.target.value || '0', 10) } } as never)
                      }}
                      style={numStyle}
                    />
                  </FormField>
                  <FormField label="填充方向">
                    <select
                      value={(textObj as { lengthLimit?: LengthLimit }).lengthLimit?.padDir ?? 'left'}
                      onChange={(e) => {
                        const cur = (textObj as { lengthLimit?: LengthLimit }).lengthLimit
                        onPatch({ lengthLimit: { ...(cur ?? {}), padDir: e.target.value } } as never)
                      }}
                      style={selStyle}
                    >
                      <option value="left">左侧填充</option>
                      <option value="right">右侧填充</option>
                    </select>
                  </FormField>
                  <FormField label="填充字符">
                    <input
                      value={(textObj as { lengthLimit?: LengthLimit }).lengthLimit?.padChar ?? ' '}
                      maxLength={1}
                      onChange={(e) => {
                        const cur = (textObj as { lengthLimit?: LengthLimit }).lengthLimit
                        onPatch({ lengthLimit: { ...(cur ?? {}), padChar: e.target.value } } as never)
                      }}
                      style={numStyle}
                    />
                  </FormField>
                </div>
              )}
              {((textObj as { lengthLimit?: { mode?: string } }).lengthLimit?.mode === 'max' ||
                (textObj as { lengthLimit?: { mode?: string } }).lengthLimit?.mode === 'both') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FormField label="最大字符数">
                    <input
                      type="number" min={0}
                      value={(textObj as { lengthLimit?: LengthLimit }).lengthLimit?.max ?? 0}
                      onChange={(e) => {
                        const cur = (textObj as { lengthLimit?: LengthLimit }).lengthLimit
                        onPatch({ lengthLimit: { ...(cur ?? {}), max: parseInt(e.target.value || '0', 10) } } as never)
                      }}
                      style={numStyle}
                    />
                  </FormField>
                  <FormField label="截去方向">
                    <select
                      value={(textObj as { lengthLimit?: LengthLimit }).lengthLimit?.trimDir ?? 'right'}
                      onChange={(e) => {
                        const cur = (textObj as { lengthLimit?: LengthLimit }).lengthLimit
                        onPatch({ lengthLimit: { ...(cur ?? {}), trimDir: e.target.value } } as never)
                      }}
                      style={selStyle}
                    >
                      <option value="right">从右侧截去</option>
                      <option value="left">从左侧截去</option>
                    </select>
                  </FormField>
                </div>
              )}
              <div style={{ fontSize: 12, color: '#6B7280', borderTop: '1px solid #E4E3DD', paddingTop: 8 }}>
                控制字符：数据源文本中可输入 &lt;HT&gt;（Tab）、&lt;CR&gt;（回车）、&lt;LF&gt;（换行）等 ASCII 1-31 控制字符；输入 &lt;&lt;HT&gt; 表示字面文本 &lt;HT&gt;。
              </div>
            </>
          )}
          {barcodeObj && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
                  <input type="checkbox" checked={barcodeObj.showText} onChange={(e) => onPatch({ showText: e.target.checked })} />
                  显示人读文本
                </label>
                <FormField label="人读文本位置">
                  <select value={(barcodeObj as { textPosition?: string }).textPosition ?? 'below'} onChange={(e) => onPatch({ textPosition: e.target.value } as never)} style={selStyle}>
                    <option value="below">条码下方</option>
                    <option value="above">条码上方</option>
                    <option value="none">不显示</option>
                  </select>
                </FormField>
              </div>
              <FormField label="字符模板" hint="一个 '?' 表示原有数据的一个字符，其它字符插入数据序列。如数据 0123456789，模板 (01)??… 输出 (01)0123456789">
                <input style={fullStyle} value={(barcodeObj as { charTemplate?: string }).charTemplate ?? ''} onChange={(e) => onPatch({ charTemplate: e.target.value } as never)} placeholder="(01)??????????" />
              </FormField>
              <FormField label="校验位" hint="EAN/UPC 等码制自动计算校验位">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
                  <input type="checkbox" checked={(barcodeObj as { checksum?: boolean }).checksum !== false} onChange={(e) => onPatch({ checksum: e.target.checked } as never)} />
                  自动添加校验位
                </label>
              </FormField>
            </>
          )}
        </div>
      )}

      {tab === 'general' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="水平位置" hint="相对标签边对齐（保持当前尺寸）">
            <select
              defaultValue=""
              style={{ ...selStyle, width: '100%' }}
              onChange={(e) => {
                const v = e.target.value
                if (!v) return
                const lw = labelWidthMm ?? 0
                const ow = parseFloat(w) || 0
                let nx = 0
                if (v === 'center') nx = Math.max(0, (lw - ow) / 2)
                else if (v === 'right') nx = Math.max(0, lw - ow)
                const fx = Math.round(nx * 100) / 100
                onPatch({ x: fx } as never)
                setX(String(fx))
              }}
            >
              <option value="">（保持当前位置）</option>
              <option value="left">靠左</option>
              <option value="center">水平居中</option>
              <option value="right">靠右</option>
            </select>
          </FormField>
          <FormField label="垂直位置" hint="相对标签边对齐（保持当前尺寸）">
            <select
              defaultValue=""
              style={{ ...selStyle, width: '100%' }}
              onChange={(e) => {
                const v = e.target.value
                if (!v) return
                const lh = labelHeightMm ?? 0
                const oh = parseFloat(h) || 0
                let ny = 0
                if (v === 'center') ny = Math.max(0, (lh - oh) / 2)
                else if (v === 'bottom') ny = Math.max(0, lh - oh)
                const fy = Math.round(ny * 100) / 100
                onPatch({ y: fy } as never)
                setY(String(fy))
              }}
            >
              <option value="">（保持当前位置）</option>
              <option value="top">靠顶</option>
              <option value="center">垂直居中</option>
              <option value="bottom">靠底</option>
            </select>
          </FormField>
          <FormField label="X（毫米）">
            <input value={x} onChange={(e) => setX(e.target.value)} style={numStyle} />
          </FormField>
          <FormField label="Y（毫米）">
            <input value={y} onChange={(e) => setY(e.target.value)} style={numStyle} />
          </FormField>
          <FormField label="宽度（毫米）">
            <input value={w} onChange={(e) => setW(e.target.value)} style={numStyle} />
          </FormField>
          <FormField label="高度（毫米）">
            <input value={h} onChange={(e) => setH(e.target.value)} style={numStyle} />
          </FormField>
          <FormField label="旋转（度）">
            <select value={String(parseInt(rot, 10) || 0)} onChange={(e) => setRot(e.target.value)} style={{ ...selStyle, width: 90 }}>
              <option value="0">0</option>
              <option value="90">90</option>
              <option value="180">180</option>
              <option value="270">270</option>
            </select>
          </FormField>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
            <input type="checkbox" checked={obj.visible !== false} onChange={(e) => onPatch({ visible: e.target.checked })} />
            打印时可见
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
            <input type="checkbox" checked={(obj as { suppressPrint?: boolean }).suppressPrint === true} onChange={(e) => onPatch({ suppressPrint: e.target.checked } as never)} />
            不打印输出
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
            <input type="checkbox" checked={(obj as { locked?: boolean }).locked === true} onChange={(e) => onPatch({ locked: e.target.checked } as never)} />
            位置锁定
          </label>
          <FormField label="镜像">
            <select
              value={(obj as { flipX?: boolean; flipY?: boolean }).flipX === true ? 'h' : (obj as { flipY?: boolean }).flipY === true ? 'v' : 'none'}
              onChange={(e) => {
                const v = e.target.value
                onPatch({ flipX: v === 'h' || undefined, flipY: v === 'v' || undefined } as never)
              }}
              style={selStyle}
            >
              <option value="none">无</option>
              <option value="h">水平镜像</option>
              <option value="v">垂直镜像</option>
            </select>
          </FormField>
          {(type === 'line' || type === 'rect' || type === 'ellipse') && (
            <FormField label="线宽（mm）">
              <input
                type="number"
                step={0.1}
                min={0}
                value={(obj as { strokeWidth?: number }).strokeWidth ?? 0.2}
                onChange={(e) => onPatch({ strokeWidth: parseFloat(e.target.value) || 0 } as never)}
                style={numStyle}
              />
            </FormField>
          )}
          {(type === 'text' || type === 'rect' || type === 'ellipse') && (
            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #ECEBE6', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1B1C' }}>变色设置</div>
              <FormField label="颜色变化模式">
                <select value={cc?.mode ?? 'fixed'} onChange={(e) => patchCc({ mode: e.target.value as ColorChangeConfig['mode'] })} style={selStyle}>
                  <option value="fixed">固定颜色</option>
                  <option value="index">颜色索引表</option>
                  <option value="variable">颜色变量</option>
                </select>
              </FormField>
              {cc?.mode === 'index' && (
                <>
                  <FormField label="索引表来源">
                    <select value={cc.tableSource ?? 'private'} onChange={(e) => patchCc({ tableSource: e.target.value as ColorChangeConfig['tableSource'] })} style={selStyle}>
                      <option value="private">对象私有索引表</option>
                      <option value="shared">模板公共索引表</option>
                    </select>
                  </FormField>
                  {cc.tableSource === 'private' ? (
                    <FormField label="私有索引表" hint="逗号分隔颜色值，如 #FF0000,#00FF00,#0000FF；按记录序号循环取色">
                      <input value={(cc.privateTable ?? []).join(',')} onChange={(e) => patchCc({ privateTable: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} style={fullStyle} />
                    </FormField>
                  ) : (
                    <FormField label="模板公共索引表" hint="逗号分隔颜色值，保存到模板共享使用">
                      <input value={(colorIndexTable ?? []).join(',')} onChange={(e) => onPatchDoc?.({ colorIndexTable: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} style={fullStyle} />
                    </FormField>
                  )}
                  <FormField label="对象变色方式">
                    <select value={cc.changeMode ?? 'solid'} onChange={(e) => patchCc({ changeMode: e.target.value as ColorChangeConfig['changeMode'] })} style={selStyle}>
                      <option value="solid">整体变色</option>
                      <option value="block">按区块变色</option>
                      <option value="gradient">渐变变色</option>
                    </select>
                  </FormField>
                  {cc.changeMode === 'block' && (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <FormField label="区块行数"><input type="number" min={1} value={cc.blockRows ?? 1} onChange={(e) => patchCc({ blockRows: parseInt(e.target.value || '1', 10) })} style={numStyle} /></FormField>
                      <FormField label="区块列数"><input type="number" min={1} value={cc.blockCols ?? 1} onChange={(e) => patchCc({ blockCols: parseInt(e.target.value || '1', 10) })} style={numStyle} /></FormField>
                    </div>
                  )}
                </>
              )}
              {cc?.mode === 'variable' && (
                <FormField label="颜色变量" hint="数据库字段名或键盘输入提示标签，其值作为颜色（如 #FF0000 或颜色名）">
                  <input value={cc.variableName ?? ''} onChange={(e) => patchCc({ variableName: e.target.value })} style={fullStyle} />
                </FormField>
              )}
            </div>
          )}
          {type === 'group' && (
            <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#6B7280' }}>组合对象：按住 Alt 双击进入编辑子对象；移动/缩放作用于整体。</div>
          )}
        </div>
      )}
    </Modal>
  )
}
