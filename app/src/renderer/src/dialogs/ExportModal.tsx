import { useState } from 'react'
import type { BarcodeObj, DataCtx, LabelDoc } from '../types'
import { barcodeToDataURLEx } from '../editor/barcode'
import { BARCODE_TYPES } from '../editor/barcodeTypes'
import Modal, { FormField, selStyle } from './Modal'
import { flattenObjects } from '../../../shared/domain/objects'
import { resolvePrintScene, type ResolvedPrintScene } from '../../../shared/print/scene'

interface Props {
  doc: LabelDoc
  onClose: () => void
}

const numStyle = { ...selStyle, width: '100%' }

function resolvedBarcodeText(scene: ResolvedPrintScene, obj: BarcodeObj): string {
  const primitive = scene.primitives.find((item) => item.kind === 'barcode' && item.object.id === obj.id)
  return primitive && 'value' in primitive ? primitive.value : ''
}

function exportContext(doc: LabelDoc, count: number, index: number): DataCtx {
  return {
    labelIndex: index + 1,
    recordIndex: index,
    copy: 1,
    count,
    totalLabels: count,
    title: doc.name,
    printerName: '',
    datasets: doc.datasets ?? {},
    sharedVars: {},
    keyboardValues: {}
  }
}

export default function ExportModal({ doc, onClose }: Props) {
  const barcodeObjs = flattenObjects(doc.objects).filter((o): o is BarcodeObj => o.type === 'barcode')
  const [count, setCount] = useState(1)
  const [dpi, setDpi] = useState(300)
  const [zoom, setZoom] = useState(2)
  const [margin, setMargin] = useState(2)
  const [marginTb, setMarginTb] = useState(2)
  const [reduction, setReduction] = useState(0)
  const [useFor, setUseFor] = useState<'print' | 'screen'>('print')
  const [prefix, setPrefix] = useState(doc.name || 'barcode')
  const [naming, setNaming] = useState<'content_serial' | 'content' | 'serial'>('content_serial')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')

  const doExport = async () => {
    if (!barcodeObjs.length) {
      setResult('模板中没有条码对象')
      return
    }
    setBusy(true)
    setResult('')
    try {
      const items: Array<{ name: string; dataUrl: string }> = []
      const padLen = String(count).length
      // 每个序号只解析一次数据源。这样脚本、时间和序列号在多个条码对象之间保持同一快照，
      // 同时避免“条码对象数 × 数量”的重复解析开销。
      const scenes = Array.from({ length: count }, (_, i) => resolvePrintScene(doc, exportContext(doc, count, i)))
      for (const obj of barcodeObjs) {
        for (let i = 0; i < count; i++) {
          const text = resolvedBarcodeText(scenes[i], obj)
          if (!text) continue
          const effDpi = useFor === 'screen' ? 96 : dpi
          const dataUrl = await barcodeToDataURLEx(obj.symbology, text, obj.h, { dpi: effDpi, zoom, marginMm: margin, marginTopBottomMm: marginTb, showText: obj.showText, barcodeOptions: (obj as { barcodeOptions?: import('../types').BarcodeOptions }).barcodeOptions, reductionMm: reduction, moduleWidthMm: (obj as { moduleWidthMm?: number }).moduleWidthMm, wideRatio: (obj as { wideRatio?: number }).wideRatio })
          const safe = text.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40)
          const serial = String(i + 1).padStart(padLen, '0')
          let name: string
          if (naming === 'content_serial') name = count > 1 ? `${prefix}_${safe}_${serial}.png` : `${prefix}_${safe}.png`
          else if (naming === 'content') name = `${prefix}_${safe}.png`
          else name = `${prefix}_${serial}.png`
          items.push({ name, dataUrl })
        }
      }
      const r = await window.maxlabel.exportBarcodes({ items })
      if (r.canceled) setResult('已取消')
      else if (!r.ok) setResult('导出失败：' + (r.message ?? '未知错误'))
      else setResult(`已导出 ${r.count} 张到：${r.dir}`)
    } catch (err) {
      setResult('导出失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }

  const symLabel = (bcid: string) => BARCODE_TYPES.find((b) => b.bcid === bcid)?.label ?? bcid

  const copyFirst = async () => {
    if (!barcodeObjs.length) {
      setResult('模板中没有条码对象')
      return
    }
    setBusy(true)
    setResult('')
    try {
      const obj = barcodeObjs[0]
      const scene = resolvePrintScene(doc, exportContext(doc, 1, 0))
      const text = resolvedBarcodeText(scene, obj)
      if (!text) {
        setResult('条码内容为空')
        return
      }
      const dataUrl = await barcodeToDataURLEx(obj.symbology, text, obj.h, { dpi: useFor === 'screen' ? 96 : dpi, zoom, marginMm: margin, marginTopBottomMm: marginTb, showText: obj.showText, barcodeOptions: (obj as { barcodeOptions?: import('../types').BarcodeOptions }).barcodeOptions, reductionMm: reduction, moduleWidthMm: (obj as { moduleWidthMm?: number }).moduleWidthMm, wideRatio: (obj as { wideRatio?: number }).wideRatio })
      const r = await window.maxlabel.copyBarcodeImage(dataUrl)
      setResult(r.ok ? '已复制到剪贴板' : (r.message ?? '复制失败'))
    } catch (err) {
      setResult('复制失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="批量导出条码图片"
      onClose={onClose}
      width={520}
      footer={
        <>
          <button type="button" onClick={copyFirst} disabled={busy} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: busy ? 'not-allowed' : 'pointer', fontSize: 13 }} title="复制第一个条码到剪贴板">
            复制到剪贴板
          </button>
          <button type="button" onClick={onClose} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            取消
          </button>
          <button
            type="button"
            onClick={doExport}
            disabled={busy}
            style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: busy ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            选择目录并导出
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <FormField label="数量" hint="按打印数量逐张取序列号/数据库记录">
          <input type="number" min={1} max={99999} value={count} onChange={(e) => setCount(Math.max(1, parseInt(e.target.value || '1', 10)))} style={numStyle} />
        </FormField>
        <FormField label="分辨率 (DPI)">
          <select value={dpi} onChange={(e) => setDpi(parseInt(e.target.value, 10))} style={selStyle}>
            <option value={203}>203 dpi</option>
            <option value={300}>300 dpi</option>
            <option value={600}>600 dpi</option>
          </select>
        </FormField>
        <FormField label="放大倍数">
          <select value={zoom} onChange={(e) => setZoom(parseInt(e.target.value, 10))} style={selStyle}>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={3}>3×</option>
            <option value={4}>4×</option>
          </select>
        </FormField>
        <FormField label="图片用于">
          <select value={useFor} onChange={(e) => setUseFor(e.target.value as 'print' | 'screen')} style={selStyle}>
            <option value="print">打印输出（按分辨率）</option>
            <option value="screen">屏幕显示（96 dpi）</option>
          </select>
        </FormField>
        <FormField label="条码缩减 (mm)" hint="输出补偿值，减小条码高度以适应专用设备">
          <input type="number" min={0} step={0.1} value={reduction} onChange={(e) => setReduction(Math.max(0, parseFloat(e.target.value) || 0))} style={numStyle} />
        </FormField>
        <FormField label="左右边空 (mm)">
          <input type="number" min={0} step={0.5} value={margin} onChange={(e) => setMargin(Math.max(0, parseFloat(e.target.value) || 0))} style={numStyle} />
        </FormField>
        <FormField label="上下边空 (mm)">
          <input type="number" min={0} step={0.5} value={marginTb} onChange={(e) => setMarginTb(Math.max(0, parseFloat(e.target.value) || 0))} style={numStyle} />
        </FormField>
        <FormField label="文件名前缀">
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} style={numStyle} />
        </FormField>
        <FormField label="命名方式">
          <select value={naming} onChange={(e) => setNaming(e.target.value as 'content_serial' | 'content' | 'serial')} style={selStyle}>
            <option value="content_serial">内容 + 流水号</option>
            <option value="content">仅内容</option>
            <option value="serial">仅流水号</option>
          </select>
        </FormField>
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: '#6B7280' }}>
        将导出以下条码（文件名：前缀_内容[+流水号].png；条码缩减与图片用途按上方设置）：
      </div>
      <div style={{ marginTop: 6, fontSize: 13 }}>
        {barcodeObjs.length === 0 ? (
          <span style={{ color: '#9CA3AF' }}>模板中没有条码对象</span>
        ) : (
          barcodeObjs.map((o) => (
            <div key={o.id} style={{ padding: '4px 0' }}>
              {symLabel(o.symbology)}
            </div>
          ))
        )}
      </div>
      {result && <div style={{ marginTop: 10, fontSize: 12, color: '#2E6E93' }}>{result}</div>}
    </Modal>
  )
}
