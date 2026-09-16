import { useEffect, useState } from 'react'
import type { BarcodeObj, DataCtx, LabelDoc, LabelObject } from '../types'
import { barcodeToDataURLEx } from '../editor/barcode'
import { BARCODE_TYPES } from '../editor/barcodeTypes'
import Modal, { FormField, selStyle } from './Modal'
import { flattenObjects } from '../../../shared/domain/objects'
import { resolvePrintScene, type ResolvedPrintScene } from '../../../shared/print/scene'

interface Props {
  doc: LabelDoc
  selectedObj?: LabelObject | null
  onClose: () => void
}

const numStyle = { ...selStyle, width: '100%' }
const groupStyle = { border: '1px solid #D8D6CF', padding: '12px 14px', margin: 0, minWidth: 0 }
const buttonStyle = { padding: '6px 14px', border: '1px solid #BDBBB4', background: '#F7F7F5', borderRadius: 3, cursor: 'pointer', fontSize: 13 }

function toBmpDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      try {
        const width = image.naturalWidth || image.width
        const height = image.naturalHeight || image.height
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx || width < 1 || height < 1) throw new Error('图片尺寸无效')
        ctx.drawImage(image, 0, 0)
        const pixels = ctx.getImageData(0, 0, width, height).data
        const rowBytes = Math.ceil((width * 3) / 4) * 4
        const bytes = new Uint8Array(54 + rowBytes * height)
        const view = new DataView(bytes.buffer)
        view.setUint16(0, 0x4D42, true)
        view.setUint32(2, bytes.length, true)
        view.setUint32(10, 54, true)
        view.setUint32(14, 40, true)
        view.setInt32(18, width, true)
        view.setInt32(22, height, true)
        view.setUint16(26, 1, true)
        view.setUint16(28, 24, true)
        view.setUint32(34, rowBytes * height, true)
        for (let y = 0; y < height; y++) {
          const sourceRow = height - 1 - y
          const target = 54 + y * rowBytes
          for (let x = 0; x < width; x++) {
            const source = (sourceRow * width + x) * 4
            const offset = target + x * 3
            bytes[offset] = pixels[source + 2]
            bytes[offset + 1] = pixels[source + 1]
            bytes[offset + 2] = pixels[source]
          }
        }
        let binary = ''
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + 0x8000)))
        resolve(`data:image/bmp;base64,${btoa(binary)}`)
      } catch (error) {
        reject(error)
      }
    }
    image.onerror = () => reject(new Error('条码预览无法解码'))
    image.src = dataUrl
  })
}

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

export default function ExportModal({ doc, selectedObj, onClose }: Props) {
  const allBarcodeObjs = flattenObjects(doc.objects).filter((o): o is BarcodeObj => o.type === 'barcode')
  const barcodeObjs = selectedObj?.type === 'barcode'
    ? allBarcodeObjs.filter((obj) => obj.id === selectedObj.id)
    : allBarcodeObjs
  const [directory, setDirectory] = useState('')
  const [count, setCount] = useState(10)
  const [dpi, setDpi] = useState(300)
  const [zoom, setZoom] = useState(3)
  const [margin, setMargin] = useState(0)
  const [marginTb, setMarginTb] = useState(0)
  const [reduction, setReduction] = useState(0)
  const [useFor, setUseFor] = useState<'print' | 'screen'>('screen')
  const [prefix, setPrefix] = useState('')
  const [naming, setNaming] = useState<'content_serial' | 'content' | 'serial'>('serial')
  const [format, setFormat] = useState<'bmp' | 'png'>('bmp')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 })

  const chooseDirectory = async () => {
    const picked = await window.maxlabel.pickDir()
    if (picked.ok && picked.path) {
      setDirectory(picked.path)
      setResult('')
    } else if (picked.message) setResult(picked.message)
  }

  const makeBarcodeImage = async (obj: BarcodeObj, index: number, targetFormat = format): Promise<{ dataUrl: string; text: string }> => {
    const scene = resolvePrintScene(doc, exportContext(doc, count, index))
    const text = resolvedBarcodeText(scene, obj)
    const effDpi = useFor === 'screen' ? 96 : dpi
    const marginMm = margin * 25.4 / effDpi
    const marginTopBottomMm = marginTb * 25.4 / effDpi
    const png = await barcodeToDataURLEx(obj.symbology, text, obj.h, { dpi: effDpi, zoom, marginMm, marginTopBottomMm, showText: obj.showText, barcodeOptions: (obj as { barcodeOptions?: import('../types').BarcodeOptions }).barcodeOptions, reductionMm: reduction, moduleWidthMm: (obj as { moduleWidthMm?: number }).moduleWidthMm, wideRatio: (obj as { wideRatio?: number }).wideRatio })
    return { dataUrl: targetFormat === 'bmp' ? await toBmpDataUrl(png) : png, text }
  }

  useEffect(() => {
    let alive = true
    const refresh = async () => {
      const obj = barcodeObjs[0]
      if (!obj) {
        if (alive) { setPreview(null); setPreviewSize({ width: 0, height: 0 }) }
        return
      }
      try {
        const image = await makeBarcodeImage(obj, 0)
        if (!alive) return
        setPreview(image.dataUrl)
        const probe = new Image()
        probe.onload = () => alive && setPreviewSize({ width: probe.naturalWidth, height: probe.naturalHeight })
        probe.src = image.dataUrl
      } catch {
        if (alive) setPreview(null)
      }
    }
    void refresh()
    return () => { alive = false }
  }, [doc, selectedObj?.id, count, dpi, zoom, margin, marginTb, reduction, useFor, format])

  const doExport = async () => {
    if (!barcodeObjs.length) {
      setResult('模板中没有条码对象')
      return
    }
    setBusy(true)
    setResult('')
    try {
      const items: Array<{ name: string; dataUrl: string }> = []
      let targetDirectory = directory.trim()
      if (!targetDirectory) {
        const picked = await window.maxlabel.pickDir()
        if (!picked.ok || !picked.path) {
          setResult('已取消')
          return
        }
        targetDirectory = picked.path
        setDirectory(targetDirectory)
      }
      const padLen = Math.max(4, String(count).length)
      const extension = format
      // 每个序号只解析一次数据源。这样脚本、时间和序列号在多个条码对象之间保持同一快照，
      // 同时避免“条码对象数 × 数量”的重复解析开销。
      const scenes = Array.from({ length: count }, (_, i) => resolvePrintScene(doc, exportContext(doc, count, i)))
      for (const obj of barcodeObjs) {
        for (let i = 0; i < count; i++) {
          const text = resolvedBarcodeText(scenes[i], obj)
          if (!text) continue
          const safe = text.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40)
          const serial = String(i + 1).padStart(padLen, '0')
          const stem = naming === 'serial' ? serial : naming === 'content' ? (count > 1 ? `${safe}_${serial}` : safe) : `${safe}_${serial}`
          const fileStem = prefix.trim() ? `${prefix.trim()}_${stem}` : stem
          const png = await barcodeToDataURLEx(obj.symbology, text, obj.h, { dpi: useFor === 'screen' ? 96 : dpi, zoom, marginMm: margin * 25.4 / (useFor === 'screen' ? 96 : dpi), marginTopBottomMm: marginTb * 25.4 / (useFor === 'screen' ? 96 : dpi), showText: obj.showText, barcodeOptions: (obj as { barcodeOptions?: import('../types').BarcodeOptions }).barcodeOptions, reductionMm: reduction, moduleWidthMm: (obj as { moduleWidthMm?: number }).moduleWidthMm, wideRatio: (obj as { wideRatio?: number }).wideRatio })
          const dataUrl = format === 'bmp' ? await toBmpDataUrl(png) : png
          const name = `${fileStem}.${extension}`
          items.push({ name, dataUrl })
        }
      }
      const r = await window.maxlabel.exportBarcodes({ items, dir: targetDirectory })
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

  return (
    <Modal
      title="导出条码图片文件"
      onClose={onClose}
      width={860}
      testId="barcode-export-dialog"
      footer={
        <>
          <button type="button" onClick={onClose} style={buttonStyle} data-testid="barcode-export-back">
            返回
          </button>
          <button type="button" onClick={() => void window.maxlabel.openHelp()} style={buttonStyle} data-testid="barcode-export-help">
            帮助(H)
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 0.9fr) minmax(360px, 1.1fr)', gap: 14 }}>
        <div>
          <fieldset style={groupStyle} data-testid="barcode-export-target">
            <legend>导出到</legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <textarea data-testid="barcode-export-directory" value={directory} readOnly placeholder="请选择输出目录" rows={2} style={{ ...numStyle, resize: 'none', minHeight: 46 }} />
              <button type="button" onClick={() => void chooseDirectory()} style={buttonStyle} data-testid="barcode-export-pick-directory">目录...</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <label>图片文件名:</label>
              <select data-testid="barcode-export-name-mode" value={naming} onChange={(e) => setNaming(e.target.value as 'content_serial' | 'content' | 'serial')} style={selStyle}>
                <option value="serial">流水号</option>
                <option value="content">条码内容</option>
                <option value="content_serial">内容+流水号</option>
              </select>
              <span />
              <input data-testid="barcode-export-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="前缀" style={numStyle} />
              <input data-testid="barcode-export-file-sample" value={`${prefix ? prefix + '_' : ''}${naming === 'serial' ? '0001' : naming === 'content' ? '内容' : '内容_0001'}.${format}`} readOnly style={numStyle} />
              <select data-testid="barcode-export-format" value={format} onChange={(e) => setFormat(e.target.value as 'bmp' | 'png')} style={selStyle}>
                <option value="bmp">BMP 文件</option>
                <option value="png">PNG 文件</option>
              </select>
            </div>
          </fieldset>

          <fieldset style={{ ...groupStyle, marginTop: 12 }} data-testid="barcode-export-options">
            <legend>导出参数</legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FormField label="图片用途">
                <select data-testid="barcode-export-use" value={useFor} onChange={(e) => setUseFor(e.target.value as 'print' | 'screen')} style={selStyle}>
                  <option value="screen">屏幕显示</option>
                  <option value="print">打印输出</option>
                </select>
              </FormField>
              <FormField label="放大倍数">
                <select data-testid="barcode-export-zoom" value={zoom} onChange={(e) => setZoom(parseInt(e.target.value, 10))} style={selStyle}>
                  {[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </FormField>
              <FormField label="条码缩减">
                <input data-testid="barcode-export-reduction" type="number" min={0} step={0.1} value={reduction} onChange={(e) => setReduction(Math.max(0, parseFloat(e.target.value) || 0))} style={numStyle} />
              </FormField>
              {useFor === 'print' && <FormField label="目标设备分辨率"><select data-testid="barcode-export-dpi" value={dpi} onChange={(e) => setDpi(parseInt(e.target.value, 10))} style={selStyle}><option value={203}>203 DPI</option><option value={300}>300 DPI</option><option value={600}>600 DPI</option></select></FormField>}
              <FormField label="左右边空"><input data-testid="barcode-export-margin-x" type="number" min={0} step={1} value={margin} onChange={(e) => setMargin(Math.max(0, parseFloat(e.target.value) || 0))} style={numStyle} /></FormField>
              <FormField label="上下边空"><input data-testid="barcode-export-margin-y" type="number" min={0} step={1} value={marginTb} onChange={(e) => setMarginTb(Math.max(0, parseFloat(e.target.value) || 0))} style={numStyle} /></FormField>
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 12, color: '#4B5563' }}>
              <span>图片宽度: <b data-testid="barcode-export-width">{previewSize.width || '—'}</b> 像素</span>
              <span>图片高度: <b data-testid="barcode-export-height">{previewSize.height || '—'}</b> 像素</span>
            </div>
            <button type="button" onClick={() => { setResult(''); if (barcodeObjs[0]) void makeBarcodeImage(barcodeObjs[0], 0).then((image) => setPreview(image.dataUrl)).catch(() => setResult('预览失败')) }} style={{ ...buttonStyle, display: 'block', margin: '12px auto 0' }} data-testid="barcode-export-refresh">刷新预览图</button>
          </fieldset>

          <fieldset style={{ ...groupStyle, marginTop: 12 }} data-testid="barcode-export-count">
            <legend>导出图片</legend>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label htmlFor="barcode-export-quantity">数量:</label>
              <input id="barcode-export-quantity" data-testid="barcode-export-quantity" type="number" min={1} max={99999} value={count} onChange={(e) => setCount(Math.max(1, Math.min(99999, parseInt(e.target.value || '1', 10) || 1)))} style={{ ...numStyle, width: 90 }} />
              <button type="button" onClick={() => void doExport()} disabled={busy || barcodeObjs.length === 0} style={{ ...buttonStyle, flex: 1 }} data-testid="barcode-export-submit">导出</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12, color: '#4B5563' }}>
              <span>条码: {barcodeObjs.length ? symLabel(barcodeObjs[0].symbology) : '无条码对象'}</span>
              <span>共 {count} 张</span>
            </div>
          </fieldset>
        </div>
        <fieldset style={{ ...groupStyle, minHeight: 470 }} data-testid="barcode-export-preview">
          <legend>条码预览</legend>
          <div style={{ minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAF8' }}>
            {preview ? <img src={preview} alt="条码预览" style={{ maxWidth: '100%', maxHeight: 420, imageRendering: 'pixelated' }} /> : <span style={{ color: '#9CA3AF' }}>{barcodeObjs.length ? '正在生成预览…' : '模板中没有条码对象'}</span>}
          </div>
        </fieldset>
      </div>
      {result && <div style={{ marginTop: 10, fontSize: 12, color: '#2E6E93' }}>{result}</div>}
    </Modal>
  )
}
