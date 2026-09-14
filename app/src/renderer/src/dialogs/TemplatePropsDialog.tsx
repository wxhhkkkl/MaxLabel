import { useState } from 'react'
import { defaultPrinterConfig, type LabelDoc, type PageOrientation } from '../types'
import { orientedLabelSize } from '../../../shared/print/layout'
import Modal, { FormField } from './Modal'
import PaperFields from './PaperFields'
import type { PaperGeometry } from '../../../shared/domain/paper'

interface Props {
  doc: LabelDoc
  onPatch: (patch: Partial<LabelDoc>) => void
  onClose: () => void
  onPrinterSettings?: () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 9px',
  border: '1px solid #D5D4CD',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'inherit',
  boxSizing: 'border-box'
}
const numStyle: React.CSSProperties = { ...inputStyle, width: 90 }

const TAB_STYLE = (active: boolean) => ({
  padding: '8px 18px',
  fontSize: 13,
  fontWeight: active ? 600 : 400,
  color: active ? '#2E6E93' : '#4B5563',
  borderBottom: active ? '2px solid #2E6E93' : '2px solid transparent',
  background: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit'
})

/** 模板属性设置（文件 → 模板属性设置；右键标签 → 模板属性设置）：打印机/页面/标签/其它 四页签 */
export default function TemplatePropsDialog({ doc, onPatch, onClose, onPrinterSettings }: Props) {
  const [tab, setTab] = useState<'printer' | 'page' | 'label' | 'other'>('printer')
  const [name, setName] = useState(doc.name)
  const [w, setW] = useState(String(doc.widthMm))
  const [h, setH] = useState(String(doc.heightMm))
  const [orientation, setOrientation] = useState<PageOrientation>(doc.orientation ?? 0)
  const [rows, setRows] = useState(String(doc.layout?.rows ?? 1))
  const [cols, setCols] = useState(String(doc.layout?.cols ?? 1))
  const [rowGap, setRowGap] = useState(String(doc.layout?.rowGapMm ?? 2))
  const [colGap, setColGap] = useState(String(doc.layout?.colGapMm ?? 2))
  const [paper, setPaper] = useState<PaperGeometry>({ shape: doc.layout?.shape ?? 'rect', cornerRadiusMm: doc.layout?.cornerRadiusMm, innerDiameterMm: doc.layout?.innerDiameterMm })
  const shape = paper.shape ?? 'rect'
  const [printOrder, setPrintOrder] = useState<'row' | 'col'>(doc.layout?.printOrder ?? 'row')
  const [startPos, setStartPos] = useState<'tl' | 'tr' | 'bl' | 'br'>(doc.layout?.startPos ?? 'tl')
  const [offsetX, setOffsetX] = useState(String(doc.layout?.offsetXMm ?? 0))
  const [offsetY, setOffsetY] = useState(String(doc.layout?.offsetYMm ?? 0))
  const [savedMsg, setSavedMsg] = useState('')
  const [remark, setRemark] = useState(doc.remark ?? '')
  const [globalScript, setGlobalScript] = useState(doc.globalScript ?? '')
  const [outputMode, setOutputMode] = useState<'driver' | 'command'>(doc.printer?.port.type === 'driver' ? 'driver' : 'command')
  const labelSize = orientedLabelSize({ ...doc, widthMm: parseFloat(w) || doc.widthMm, heightMm: parseFloat(h) || doc.heightMm, orientation })
  const pageW = String(Math.round((labelSize.widthMm * (Math.max(1, parseInt(cols, 10) || 1)) + (parseFloat(colGap) || 0) * (Math.max(1, parseInt(cols, 10) || 1) - 1)) * 100) / 100)
  const pageH = String(Math.round((labelSize.heightMm * (Math.max(1, parseInt(rows, 10) || 1)) + (parseFloat(rowGap) || 0) * (Math.max(1, parseInt(rows, 10) || 1) - 1)) * 100) / 100)
  const printer = doc.printer ?? defaultPrinterConfig()
  const nextPrinter = {
    ...printer,
    port: outputMode === 'driver'
      ? { ...printer.port, type: 'driver' as const }
      : printer.port.type === 'driver'
        ? { ...printer.port, type: 'file' as const }
        : printer.port
  }

  const save = () => {
    const width = parseFloat(w)
    const height = parseFloat(h)
    if (!(width > 0) || !(height > 0)) {
      return
    }
    const r = Math.max(1, parseInt(rows, 10) || 1)
    const c = Math.max(1, parseInt(cols, 10) || 1)
    const patch: Partial<LabelDoc> = {
      name: name.trim() || doc.name,
      widthMm: Math.round(width * 100) / 100,
      heightMm: Math.round(height * 100) / 100,
      remark,
      globalScript: globalScript.trim() || undefined,
      orientation,
      printer: nextPrinter,
      layout: {
        rows: r,
        cols: c,
        ...(doc.layout?.pagesPerBox ? { pagesPerBox: doc.layout.pagesPerBox } : {}),
        rowGapMm: parseFloat(rowGap) || 0,
        colGapMm: parseFloat(colGap) || 0,
        ...paper, shape,
        printOrder,
        startPos,
        offsetXMm: parseFloat(offsetX) || 0,
        offsetYMm: parseFloat(offsetY) || 0
      }
    }
    onPatch(patch)
    onClose()
  }

  return (
    <Modal
      title="模板属性设置"
      onClose={onClose}
      width={560}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={save}
            style={{ padding: '7px 22px', borderRadius: 7, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
          >
            确定
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #ECEBE6', marginBottom: 14 }}>
        <button type="button" style={TAB_STYLE(tab === 'printer')} onClick={() => setTab('printer')}>打印机</button>
        <button type="button" style={TAB_STYLE(tab === 'page')} onClick={() => setTab('page')}>页面</button>
        <button type="button" style={TAB_STYLE(tab === 'label')} onClick={() => setTab('label')}>标签</button>
        <button type="button" style={TAB_STYLE(tab === 'other')} onClick={() => setTab('other')}>其它</button>
      </div>

      {tab === 'printer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="模板名称">
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="目标打印机" hint="标签格式中保存对应打印机，下次打印仍用该打印机输出">
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                style={inputStyle}
                readOnly
                value={doc.printer ? `${doc.printer.driver.toUpperCase()} · ${doc.printer.dpi}dpi · ${doc.printer.port.type === 'driver' ? `驱动${doc.printer.printerName ? `（${doc.printer.printerName}）` : ''}` : doc.printer.port.type}` : '未配置'}
              />
              <button
                type="button"
                onClick={() => onPrinterSettings?.()}
                style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #2E6E93', background: '#fff', color: '#2E6E93', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >
                设置
              </button>
            </div>
          </FormField>
          <FormField label="输出方式" hint="页式打印机仅支持 Windows 驱动方式；标签打印机默认打印机指令方式">
            <select value={outputMode} onChange={(e) => setOutputMode(e.target.value as 'driver' | 'command')} style={inputStyle}>
              <option value="driver">Windows 驱动方式输出</option>
              <option value="command">打印机指令方式输出</option>
            </select>
          </FormField>
          <div style={{ fontSize: 11.5, color: '#9CA3AF', lineHeight: 1.6 }}>
            指令方式直接使用打印机控制指令驱动打印机，可充分发挥专用打印机性能；相关打印参数随模板一起保存。
          </div>
        </div>
      )}

      {tab === 'page' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <FormField label="页面宽度（mm）">
              <input style={inputStyle} type="number" min={1} value={pageW} readOnly />
            </FormField>
            <FormField label="页面高度（mm）">
              <input style={inputStyle} type="number" min={1} value={pageH} readOnly />
            </FormField>
          </div>
          <FormField label="方向" hint="打印内容是否跟随页面方向旋转">
            <select value={orientation} onChange={(e) => setOrientation(parseInt(e.target.value, 10) as PageOrientation)} style={inputStyle}>
              <option value={0}>纵向（0°）</option>
              <option value={90}>横向（90°）</option>
              <option value={180}>倒置（180°）</option>
              <option value={270}>横向（270°）</option>
            </select>
          </FormField>
          <div style={{ fontSize: 11.5, color: '#9CA3AF', lineHeight: 1.6 }}>
            页面尺寸用于页式打印机；标签打印机使用连续纸时页面宽度等于标签宽度，高度随标签数自动走纸。
          </div>
        </div>
      )}

      {tab === 'label' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <FormField label="标签宽度（mm）">
              <input style={inputStyle} type="number" min={1} value={w} onChange={(e) => setW(e.target.value)} />
            </FormField>
            <FormField label="标签高度（mm）">
              <input style={inputStyle} type="number" min={1} value={h} onChange={(e) => setH(e.target.value)} />
            </FormField>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <FormField label="行数">
              <input style={numStyle} type="number" min={1} max={20} value={rows} onChange={(e) => setRows(e.target.value)} />
            </FormField>
            <FormField label="列数">
              <input style={numStyle} type="number" min={1} max={20} value={cols} onChange={(e) => setCols(e.target.value)} />
            </FormField>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <FormField label="行间隔（mm）">
              <input style={numStyle} type="number" min={0} step={0.5} value={rowGap} onChange={(e) => setRowGap(e.target.value)} />
            </FormField>
            <FormField label="列间隔（mm）">
              <input style={numStyle} type="number" min={0} step={0.5} value={colGap} onChange={(e) => setColGap(e.target.value)} />
            </FormField>
          </div>
          <PaperFields value={paper} width={Number(w)} height={Number(h)} onChange={setPaper} />
        </div>
      )}

      {tab === 'other' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <FormField label="打印顺序" hint="页面上多标签的打印顺序">
              <select value={printOrder} onChange={(e) => setPrintOrder(e.target.value as 'row' | 'col')} style={inputStyle}>
                <option value="row">先行后列（水平方向）</option>
                <option value="col">先列后行（垂直方向）</option>
              </select>
            </FormField>
            <FormField label="起始位置" hint="从整页的什么位置开始输出">
              <select value={startPos} onChange={(e) => setStartPos(e.target.value as 'tl' | 'tr' | 'bl' | 'br')} style={inputStyle}>
                <option value="tl">左上角</option>
                <option value="tr">右上角</option>
                <option value="bl">左下角</option>
                <option value="br">右下角</option>
              </select>
            </FormField>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <FormField label="位置微调：左侧（mm）" hint="页的水平打印偏移">
              <input style={numStyle} type="number" step={0.1} value={offsetX} onChange={(e) => setOffsetX(e.target.value)} />
            </FormField>
            <FormField label="位置微调：顶部（mm）" hint="页的垂直打印偏移">
              <input style={numStyle} type="number" step={0.1} value={offsetY} onChange={(e) => setOffsetY(e.target.value)} />
            </FormField>
          </div>
          <FormField label="保存标签格式" hint="保存用户自定义标签设置，可随时从“用户定义标签格式”中调入">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                onClick={async () => {
                  const newDoc: LabelDoc = {
                    ...doc,
                    name: (name.trim() || doc.name) + '（格式）',
                    widthMm: parseFloat(w) || doc.widthMm,
                    heightMm: parseFloat(h) || doc.heightMm,
                    orientation,
                    printer: nextPrinter,
                    remark,
                    layout: {
                      rows: Math.max(1, parseInt(rows, 10) || 1),
                      cols: Math.max(1, parseInt(cols, 10) || 1),
                      ...(doc.layout?.pagesPerBox ? { pagesPerBox: doc.layout.pagesPerBox } : {}),
                      rowGapMm: parseFloat(rowGap) || 0,
                      colGapMm: parseFloat(colGap) || 0,
                      ...paper, shape,
                      printOrder,
                      startPos,
                      offsetXMm: parseFloat(offsetX) || 0,
                      offsetYMm: parseFloat(offsetY) || 0
                    }
                  }
                  try {
                    const r = await window.maxlabel.saveTemplateToLib(newDoc.name, JSON.stringify(newDoc))
                    setSavedMsg(r.ok ? `已保存：${r.path ?? ''}` : (r.message ?? '保存失败'))
                  } catch (error) {
                    setSavedMsg('保存失败：' + (error instanceof Error ? error.message : String(error)))
                  }
                }}
                style={{ padding: '7px 18px', borderRadius: 6, border: '1px solid #2E6E93', background: '#fff', color: '#2E6E93', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >
                保存自定义标签格式…
              </button>
              {savedMsg && <span style={{ fontSize: 12, color: '#2E6E93' }}>{savedMsg}</span>}
            </div>
          </FormField>
          <FormField label="备注">
            <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={remark} onChange={(e) => setRemark(e.target.value)} />
          </FormField>
          <FormField label="模板脚本" hint="可选 VBScript/JavaScript 生命周期脚本；启用“允许执行脚本”后在打印/预览时运行">
            <textarea data-testid="global-script" style={{ ...inputStyle, minHeight: 110, resize: 'vertical', fontFamily: 'Consolas, monospace' }} value={globalScript} onChange={(e) => setGlobalScript(e.target.value)} placeholder="Function OnBeginPrint(State)\n  V_TOTALLABELS = 1\nEnd Function" />
          </FormField>
          <div style={{ fontSize: 11.5, color: '#9CA3AF', lineHeight: 1.6 }}>
            修改标签尺寸后画布按新尺寸重排，已有对象位置保持不变；多标签排列（行列/间隔/形状）应用于页式打印机的页面拼版。
          </div>
        </div>
      )}
    </Modal>
  )
}
