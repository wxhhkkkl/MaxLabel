import { useEffect, useMemo, useState } from 'react'
import { paperPath, type PaperGeometry } from '../../../shared/domain/paper'
import { LABEL_FORMATS, type LabelFormatRecord } from '../../../shared/domain/labelFormats.generated'
import CustomLabelFormatDialog, { type CustomLabelDraft } from './CustomLabelFormatDialog'
import { readDefaultPrinter, writeDefaultPrinter } from '../features/shell/printerPreferences'
import {
  configFromCatalogEntry,
  installedLabelShopPrinters,
  labelShopPrinterById,
  labelShopPrinterValue,
  parseLabelShopPrinterValue
} from '../features/shell/installedPrinters'
import type { PrinterConfig } from '../types'

export type LabelPreset = LabelFormatRecord

export interface LabelFormatSelection {
  rows: number
  cols: number
  rowGapMm?: number
  colGapMm?: number
  pagesPerBox?: number
  formatKind: 'preset' | 'custom'
  formatCode?: string
  pageWidthMm?: number
  pageHeightMm?: number
}

interface Props {
  onSelect: (w: number, h: number, paper?: PaperGeometry, printerName?: string, format?: LabelFormatSelection) => void
  onClose: () => void
  onInstallPrinter?: (printerName?: string) => void
  onPrinterSettings?: () => void
  onHelp?: () => void
  defaultW?: number
  defaultH?: number
  defaultShape?: PaperGeometry['shape']
}

const INITIAL = LABEL_FORMATS.find((format) => format.code === '608053') ?? LABEL_FORMATS[0]
const brandNames: Record<number, string> = {
  1: '京成云马标签（平张标签）',
  2: '普林泰科标签（平张标签）'
}

/** 光盘类标签在格式库里标 corner=2，名称形如「…117mm/40mm…」，斜杠后即中心孔直径。
 *  形状只有三档，因此这里落成「圆形 + 圆洞」，而不是另立一档光盘形状。
 *  **用词口径**：真机 UI 第一档写作「方角矩形」，帮助 label_page_label.html 写作「直角矩形」
 *  —— 帮助与真机用词不一致，按「真机 UI 为准」取「方角矩形」（见 parity/diffs.md DIFF-67）。 */
function centerHoleMm(format: LabelFormatRecord): number {
  const matched = /(\d+(?:\.\d+)?)\s*mm\s*\/\s*(\d+(?:\.\d+)?)\s*mm/.exec(format.name)
  const hole = matched ? Number(matched[2]) : NaN
  return Number.isFinite(hole) && hole > 0 ? hole : 15
}

function paperFor(format: LabelFormatRecord | undefined, fallback: PaperGeometry['shape']): PaperGeometry {
  if (!format) return { shape: fallback }
  if (format.corner === 2) return { shape: 'ellipse', innerDiameterMm: centerHoleMm(format) }
  if (format.corner === 1) return { shape: 'roundRect' }
  return { shape: 'rect' }
}

function distinctBy<T>(items: readonly T[], key: (item: T) => string | number): T[] {
  const seen = new Set<string | number>()
  return items.filter((item) => {
    const value = key(item)
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}

function fixedMm(value: number): string {
  return value.toFixed(2)
}

const CONFIGURED_PRINTER_VALUE = '__maxlabel_configured_printer__'
const ROLL_PRINTER_PATTERN = /(佳博|gprinter|gp[-\s]*\d|zebra|斑马|xprinter|芯烨|hprt|汉印|tsc|argox|立象|label)/i

/**
 * 介质类型判定 —— 真机依据 `parity/reference/labelshop/probe-09-roll-after-select.txt`：
 * 「选择标签格式」页的打印机下拉里，**签赋LabelShop 打印机**（安装打印机装出来的那些，如
 * `Gprinter GPL-N (203 dpi)`）一律是卷筒式标签打印机；Windows 打印机（激光/喷墨/PDF）是平张页式。
 * 选中卷筒打印机时品牌/类型/名称切到卷筒目录，品牌名带「 (卷筒标签)」；平张则带「 (平张标签)」。
 */
function mediaTypeOfSelection(printer: PrinterConfig, selectedPrinter: string): 0 | 1 {
  // LabelShop 打印机 = 卷筒式标签打印机
  if (parseLabelShopPrinterValue(selectedPrinter)) return 0
  if (selectedPrinter && selectedPrinter !== CONFIGURED_PRINTER_VALUE) {
    // Windows 打印机：标签机驱动仍然按名字识别（装的是佳博/斑马这类驱动时按卷筒处理）
    return ROLL_PRINTER_PATTERN.test(selectedPrinter) ? 0 : 1
  }
  // 没选具体打印机时看已保存配置：指令/端口型（非驱动）按介质类型档案，驱动型按名字识别
  if (printer.port.type !== 'driver') return 0
  const identity = `${printer.printerName ?? ''} ${printer.model ?? ''} ${printer.profile ?? ''}`
  return ROLL_PRINTER_PATTERN.test(identity) ? 0 : 1
}

function mediaLabel(type: 0 | 1): string {
  return type === 0 ? '卷筒标签' : '平张标签'
}

export default function NewLabelDialog({ onSelect, onClose, onInstallPrinter, onPrinterSettings, onHelp, defaultShape = 'rect' }: Props) {
  const savedPrinter = readDefaultPrinter()
  const [printerConfig] = useState<PrinterConfig>(() => savedPrinter)
  const [labelShopPrinters, setLabelShopPrinters] = useState(() => installedLabelShopPrinters())
  const configuredPrinterLabel = printerConfig.model || printerConfig.profile
    ? `${printerConfig.model ?? printerConfig.profile} · ${printerConfig.driver.toUpperCase()} · ${printerConfig.dpi}dpi`
    : ''
  const initialMediaType: 0 | 1 = printerConfig.port.type === 'driver' ? 1 : 0
  const initialForMedia = initialMediaType === 1 ? INITIAL : (LABEL_FORMATS.find((format) => format.type === initialMediaType) ?? INITIAL)
  const [printer, setPrinter] = useState(() => (labelShopPrinters[0] ? labelShopPrinterValue(labelShopPrinters[0].id) : (savedPrinter.printerName ?? '')))
  const [printers, setPrinters] = useState<Array<{ name: string; displayName: string }>>([])
  const [brandId, setBrandId] = useState(initialForMedia.brandId)
  const [categoryId, setCategoryId] = useState(initialForMedia.categoryId)
  const [formatCode, setFormatCode] = useState(initialForMedia.code)
  const [customDialog, setCustomDialog] = useState(false)
  const mediaType = mediaTypeOfSelection(printerConfig, printer)

  useEffect(() => {
    window.maxlabel
      .listPrinters()
      .then((result) => {
        const items = (result.printers ?? []).map((p) => ({ name: p.name, displayName: p.displayName || p.name }))
        setPrinters(items)
        const installed = installedLabelShopPrinters()
        setLabelShopPrinters(installed)
        const savedPrinterConfig = readDefaultPrinter()
        const savedPrinter = savedPrinterConfig.printerName ?? ''
        // 真机顺序：已安装的 LabelShop 打印机排在最前，其后是系统打印机；
        // 有明确偏好时仍按偏好（真机保留上次选中的打印机）。
        const savedCatalogId = installed.find((entry) => entry.name === savedPrinter)
        if (savedCatalogId) setPrinter(labelShopPrinterValue(savedCatalogId.id))
        else if (installed.length > 0 && !savedPrinter) setPrinter(labelShopPrinterValue(installed[0].id))
        else if (savedPrinter) setPrinter(savedPrinter)
        else if (items.length > 0) setPrinter(items[0].name)
      })
      .catch(() => {})
  }, [])

  // 平张打印机用平张目录（6080xx：2 品牌 / 每品牌各自的类型 / 京成云马 42 项），卷筒打印机用卷筒目录
  // （6020xx：1 品牌 / 7 类型 / 每类型 8~55 项）—— 与真机 probe-09 实测的数量一致。
  // 注意必须按 type 过滤：真机选中平张打印机时，京成云马标签的「标签类型」只有 1 项
  // （云马优质打印纸标签），若混入卷筒目录会多出 7 项。
  const availableFormats = useMemo(() => LABEL_FORMATS.filter((format) => format.type === mediaType), [mediaType])
  /**
   * 打印机下拉的候选：**签赋LabelShop 打印机 + 系统打印机合成一个列表，按名称升序**。
   * 真机取证 `parity/reference/labelshop/probe-21-two-printers.txt`（装了两台 LabelShop 打印机后）：
   * Gprinter GPL-N (203 dpi) / HP7E6C81 (HP LaserJet Pro M329) / Microsoft Print to PDF /
   * OneNote (Desktop) / TSC TSPL-N (203 dpi) —— 即按名称排序，而不是「已安装的排前面」。
   */
  const mergedPrinterOptions = useMemo(() => {
    const merged = [
      ...labelShopPrinters.map((entry) => ({ value: labelShopPrinterValue(entry.id), label: entry.name })),
      ...printers.map((item) => ({ value: item.name, label: item.displayName || item.name }))
    ]
    return merged.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase(), 'en'))
  }, [labelShopPrinters, printers])
  const brands = useMemo(() => distinctBy(availableFormats, (format) => format.brandId).map((format) => ({ id: format.brandId, name: format.brandName })), [availableFormats])
  const brandFormats = useMemo(() => availableFormats.filter((format) => format.brandId === brandId), [availableFormats, brandId])
  const categories = useMemo(() => distinctBy(brandFormats, (format) => format.categoryId), [brandFormats])
  const categoryFormats = useMemo(() => brandFormats.filter((format) => format.categoryId === categoryId), [brandFormats, categoryId])
  const selected: LabelFormatRecord = availableFormats.find((format) => format.code === formatCode) ?? categoryFormats[0] ?? initialForMedia

  // 由条码打印机切换到页式打印机（或反过来）时，必须重置旧的品牌/类型/格式，
  // 否则旧筛选值会落到新目录之外，表现为“只能看到卷筒纸”。
  useEffect(() => {
    const next = mediaType === 1 ? INITIAL : (availableFormats.find((format) => format.type === 0) ?? INITIAL)
    setBrandId(next.brandId)
    setCategoryId(next.categoryId)
    setFormatCode(next.code)
  }, [mediaType])

  const previewW = Math.max(1, selected.labelWidthMm)
  const previewH = Math.max(1, selected.labelHeightMm)
  const cols = selected.cols
  const rows = selected.rows
  const colGap = selected.colGapMm
  const rowGap = selected.rowGapMm
  // 卷筒式预览（真机 probe-11）：纸是一条竖带（宽 = 纸宽），主标签居中，上下各露一小截相邻标签。
  const isRoll = mediaType === 0
  const ROLL_SLICES = 2
  const rollSliceH = Math.max(3, Math.round(previewH * 0.12))
  const rollStripExtra = isRoll ? ROLL_SLICES * (rowGap + rollSliceH) : 0
  const pageW = Math.max(selected.pageWidthMm, selected.labelWidthMm)
  const pageH = Math.max(selected.pageHeightMm, selected.labelHeightMm) + rollStripExtra
  const totalGridW = cols * previewW + Math.max(0, cols - 1) * colGap
  const totalGridH = rows * previewH + Math.max(0, rows - 1) * rowGap
  const originX = selected.pageLeftMm || Math.max(0, (pageW - totalGridW) / 2)
  const originY = selected.pageTopMm || Math.max(0, (pageH - totalGridH) / 2)
  const viewW = pageW + 28
  const viewH = pageH + 28
  const previewPaper = paperFor(selected, defaultShape)
  /** 真机第二行文字：平张 = 「纸张： W 毫米 X  H 毫米」（高度右对齐 4 位），卷筒 = 「纸宽： W 毫米」。 */  const sheetInfoText = mediaType === 0
      ? `纸宽：  ${Math.round(selected.pageWidthMm)} 毫米`
      : `纸张：  ${Math.round(selected.pageWidthMm)} 毫米 X ${String(Math.round(selected.pageHeightMm)).padStart(4)} 毫米`

  const chooseBrand = (nextBrandId: number) => {
    const first = availableFormats.find((format) => format.brandId === nextBrandId)
    if (!first) return
    setBrandId(nextBrandId)
    setCategoryId(first.categoryId)
    setFormatCode(first.code)
  }

  const chooseType = (nextCategoryId: number) => {
    const first = brandFormats.find((format) => format.categoryId === nextCategoryId)
    if (!first) return
    setCategoryId(nextCategoryId)
    setFormatCode(first.code)
  }

  const chooseFormat = (nextCode: string) => {
    const next = availableFormats.find((format) => format.code === nextCode)
    if (!next) return
    setBrandId(next.brandId)
    setCategoryId(next.categoryId)
    setFormatCode(next.code)
  }

  const confirm = () => {
    const w = selected.labelWidthMm
    const h = selected.labelHeightMm
    const format: LabelFormatSelection = {
      rows: selected.rows,
      cols: selected.cols,
      formatKind: 'preset',
      formatCode: selected.code,
      pageWidthMm: selected.pageWidthMm,
      pageHeightMm: selected.pageHeightMm,
      ...(selected.type === 1 ? { pagesPerBox: selected.totalLabels } : {})
    }
    // 选中的是签赋LabelShop 打印机时，把它的指令集/分辨率/型号写进偏好，模板随它保存（真机语义）。
    const catalogId = parseLabelShopPrinterValue(printer)
    const entry = catalogId ? labelShopPrinterById(catalogId) : undefined
    if (entry) writeDefaultPrinter(configFromCatalogEntry(entry))
    const printerNameArg = entry ? entry.name : (printer && printer !== CONFIGURED_PRINTER_VALUE ? printer : undefined)
    onSelect(w, h, previewPaper, printerNameArg, format)
  }

  const customInitial: CustomLabelDraft = {
    width: String(selected.labelWidthMm),
    height: String(selected.labelHeightMm),
    rowGap: String(selected.rowGapMm),
    colGap: String(selected.colGapMm),
    rows: String(selected.rows),
    cols: String(selected.cols),
    shape: paperFor(selected, defaultShape).shape ?? 'rect',
    hole: paperFor(selected, defaultShape).innerDiameterMm ? 'circle' : 'none',
    // 真机「孔洞」尺寸框在选「无」时是禁用的空框，切到「圆洞」/「矩形」后显示 0.00
    // （probe-round107-hole-rect-values.txt）。因此无孔格式的兜底值是 0 而不是 15。
    holeSize: String(paperFor(selected, defaultShape).innerDiameterMm ?? 0),
    labelColor: '#ffffff',
    pageWidth: String(selected.pageWidthMm),
    pageHeight: String(selected.pageHeightMm)
  }

  const confirmCustom = (draft: CustomLabelDraft, paper: PaperGeometry, pageWidthMm: number, pageHeightMm: number) => {
    const w = Number(draft.width), h = Number(draft.height)
    const format: LabelFormatSelection = {
      rows: Math.max(1, parseInt(draft.rows, 10) || 1),
      cols: Math.max(1, parseInt(draft.cols, 10) || 1),
      rowGapMm: Math.max(0, Number(draft.rowGap) || 0),
      colGapMm: Math.max(0, Number(draft.colGap) || 0),
      formatKind: 'custom',
      pageWidthMm,
      pageHeightMm
    }
    setCustomDialog(false)
    const catalogId = parseLabelShopPrinterValue(printer)
    const entry = catalogId ? labelShopPrinterById(catalogId) : undefined
    if (entry) writeDefaultPrinter(configFromCatalogEntry(entry))
    onSelect(w, h, paper, entry ? entry.name : (printer && printer !== CONFIGURED_PRINTER_VALUE ? printer : undefined), format)
  }

  const field = { padding: '6px 8px', border: '1px solid #BDBDBD', borderRadius: 2, fontSize: 13, background: '#fff', color: '#1A1B1C', width: '100%', boxSizing: 'border-box' as const }
  const button = { padding: '7px 20px', border: '1px solid #BDBDBD', borderRadius: 2, background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }
  const primaryButton = { ...button, borderColor: '#2E6E93', outline: '1px dotted #111', outlineOffset: -4 }

  return (
    <div data-testid="new-label-dialog-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div data-testid="new-label-dialog" role="dialog" aria-modal="true" aria-label="选择标签格式" style={{ background: '#F5F5F5', width: 760, maxWidth: '96vw', maxHeight: '96vh', overflow: 'auto', boxShadow: '0 12px 48px rgba(0,0,0,0.35)', color: '#111' }}>
        <div style={{ height: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderBottom: '1px solid #D7D7D7', background: '#F4F4F4', fontSize: 16 }}>
          <span>选择标签格式</span>
          <button type="button" aria-label="关闭" onClick={onClose} style={{ border: 0, background: 'transparent', fontSize: 24, lineHeight: 1, cursor: 'pointer', color: '#333' }}>×</button>
        </div>

        <div style={{ padding: '14px 18px 8px' }}>
          <div data-testid="new-label-preview" style={{ position: 'relative', margin: '0 auto', width: 430, maxWidth: '100%', height: 345, background: '#EFEFEF' }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${viewW} ${viewH}`} preserveAspectRatio="xMidYMid meet" aria-label="标签预览">
              {isRoll ? (
                /* 卷筒式：真机把「纸」画成一条竖带（宽度 = 纸宽），主标签居中，
                   上下各露一点相邻标签的边（probe-11-select-format-roll.png）。 */
                <g data-testid="new-label-roll-strip" data-roll-slices={ROLL_SLICES}>
                  <rect x={12} y={12} width={pageW} height={pageH} fill="#fff" stroke="#111" strokeWidth={0.45} />
                  <path
                    data-testid="new-label-roll-label"
                    d={paperPath(previewW, previewH, previewPaper)}
                    transform={`translate(${12 + originX} ${12 + originY})`}
                    fill="#fff"
                    stroke="#111"
                    strokeWidth={0.45}
                  />
                  {Array.from({ length: ROLL_SLICES }, (_, index) => {
                    const above = index === 0
                    const y = above
                      ? 12 + originY - rowGap - rollSliceH
                      : 12 + originY + previewH + rowGap
                    return (
                      <path
                        key={`slice-${index}`}
                        data-testid="new-label-roll-slice"
                        d={paperPath(previewW, rollSliceH, previewPaper)}
                        transform={`translate(${12 + originX} ${y})`}
                        fill="#fff"
                        stroke="#111"
                        strokeWidth={0.45}
                      />
                    )
                  })}
                </g>
              ) : (
                <>
                  <rect x={12} y={12} width={pageW} height={pageH} fill="#fff" stroke="#111" strokeWidth={0.45} />
                  {Array.from({ length: cols * rows }, (_, index) => {
                    const x = 12 + originX + (index % cols) * (previewW + colGap)
                    const y = 12 + originY + Math.floor(index / cols) * (previewH + rowGap)
                    return <path key={index} d={paperPath(previewW, previewH, previewPaper)} transform={`translate(${x} ${y})`} fill="#fff" stroke="#111" strokeWidth={0.45} />
                  })}
                </>
              )}
              <line x1={12 + originX} y1={7} x2={12 + originX + previewW} y2={7} stroke="#F00" strokeWidth={0.35} />
              <path d={`M ${12 + originX} 7 l 2 -1.1 M ${12 + originX} 7 l 2 1.1 M ${12 + originX + previewW} 7 l -2 -1.1 M ${12 + originX + previewW} 7 l -2 1.1`} stroke="#F00" strokeWidth={0.35} fill="none" />
              <text x={12 + originX + previewW / 2} y={5} textAnchor="middle" fontSize="4.2" fill="#E00">{`${Math.round(previewW)}mm`}</text>
              <line x1={viewW - 9} y1={12 + originY} x2={viewW - 9} y2={12 + originY + previewH} stroke="#F00" strokeWidth={0.35} />
              <path d={`M ${viewW - 9} ${12 + originY} l -1.1 2 M ${viewW - 9} ${12 + originY} l 1.1 2 M ${viewW - 9} ${12 + originY + previewH} l -1.1 -2 M ${viewW - 9} ${12 + originY + previewH} l 1.1 -2`} stroke="#F00" strokeWidth={0.35} fill="none" />
              <text x={viewW - 5} y={12 + originY + previewH / 2} textAnchor="middle" fontSize="4.2" fill="#E00" transform={`rotate(90 ${viewW - 5} ${12 + originY + previewH / 2})`}>{`${Math.round(previewH)}mm`}</text>
              {Array.from({ length: cols * rows }, (_, index) => {
                const x = 12 + originX + (index % cols) * (previewW + colGap) + previewW / 2
                const y = 12 + originY + Math.floor(index / cols) * (previewH + rowGap) + previewH / 2 + 1.5
                return <text key={`n-${index}`} x={x} y={y} textAnchor="middle" fontSize="4.5" fill="#111">{index + 1}</text>
              })}
            </svg>
          </div>
          <div data-testid="new-label-sheet-info" style={{ textAlign: 'center', fontSize: 14, lineHeight: 1.8, marginTop: 2 }}>
            {sheetInfoText}
          </div>
          <div data-testid="new-label-label-info" style={{ textAlign: 'center', fontSize: 14, lineHeight: 1.8 }}>
            标签：  {fixedMm(previewW)} 毫米 X {fixedMm(previewH)} 毫米
          </div>
        </div>

        <fieldset data-testid="new-label-choose-group" style={{ margin: '4px 18px 12px', padding: '10px 12px 12px', border: '1px solid #D5D5D5', background: '#F8F8F8' }}>
          <legend style={{ padding: '0 5px', fontSize: 14 }}>选择标签</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '7px 12px' }}>
            <label style={{ fontSize: 13 }}>打印机(P):
              <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                <select data-testid="new-label-printer" value={printer} onChange={(event) => setPrinter(event.target.value)} style={{ ...field, flex: 1 }}>
                  {labelShopPrinters.length === 0 && printers.length === 0 && !configuredPrinterLabel && <option value="">（未检测到打印机）</option>}
                  {/* 真机 probe-21（装两台后）：签赋LabelShop 打印机与系统打印机**合成一个列表按名称升序**排列，
                      不是「已安装的排在前面」。 */}
                  {mergedPrinterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  {printer && !parseLabelShopPrinterValue(printer) && printer !== CONFIGURED_PRINTER_VALUE && !printers.some((item) => item.name === printer) && <option value={printer}>已保存打印机：{printer}</option>}
                </select>
                <button type="button" data-testid="new-label-install" onClick={() => onInstallPrinter?.(printer || undefined)} style={{ ...button, whiteSpace: 'nowrap' }}><span>安装</span><span>(I)</span></button>
              </div>
              <div data-testid="new-label-printer-impact" style={{ marginTop: 4, color: '#666', fontSize: 12 }}>打印机选择会影响条码密度与标签尺寸，请先选择与标签匹配的打印机。</div>
            </label>
            <label style={{ fontSize: 13 }}>标签品牌(B):
              <select data-testid="new-label-brand" value={brandId} onChange={(event) => chooseBrand(Number(event.target.value))} style={{ ...field, marginTop: 3 }}>
                {brands.map((brand) => <option key={brand.id} value={brand.id}>{(brandNames[brand.id] ?? brand.name).replace(/[（(](平张标签|卷筒标签)[)）]\s*$/, '')} ({mediaLabel(mediaType)})</option>)}
              </select>
            </label>
            <label style={{ fontSize: 13 }}>标签类型(G):
              <select data-testid="new-label-type" value={categoryId} onChange={(event) => chooseType(Number(event.target.value))} style={{ ...field, marginTop: 3 }}>
                {categories.map((category) => <option key={category.categoryId} value={category.categoryId}>{category.categoryName}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 13 }}>标签名称(L):
              <select data-testid="new-label-format" value={formatCode} onChange={(event) => chooseFormat(event.target.value)} style={{ ...field, marginTop: 3 }}>
                {categoryFormats.map((format) => <option key={format.code} value={format.code}>{`[${format.code}] ${format.name}`}</option>)}
              </select>
            </label>
          </div>
          <div data-testid="new-label-hint" style={{ marginTop: 8, fontSize: 12.5 }}>提示：如果上列表中没有尺寸适合的标签格式，请点击“自定义”，自行设置标签的尺寸。</div>
        </fieldset>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, padding: '2px 18px 18px' }}>
          <button type="button" data-testid="new-label-select" accessKey="o" data-access-suffix="(O)" className="legacy-access-key" autoFocus onClick={confirm} style={primaryButton}>选择</button>
          <button type="button" data-testid="new-label-custom" accessKey="n" data-access-suffix="(N)" className="legacy-access-key" onClick={() => setCustomDialog(true)} style={button}>自定义</button>
          <button type="button" data-testid="new-label-cancel" accessKey="c" data-access-suffix="(C)" className="legacy-access-key" onClick={onClose} style={button}>取消</button>
          <button type="button" data-testid="new-label-help" accessKey="h" data-access-suffix="(H)" className="legacy-access-key" onClick={onHelp} style={button}>帮助</button>
        </div>
      </div>
      {customDialog && <CustomLabelFormatDialog initial={customInitial} onClose={() => setCustomDialog(false)} onConfirm={confirmCustom} onPrinterSettings={onPrinterSettings} onInstallPrinter={() => onInstallPrinter?.(printer || undefined)} onHelp={onHelp} />}
    </div>
  )
}
