import { useEffect, useMemo, useState } from 'react'
import { paperPath, type PaperGeometry } from '../../../shared/domain/paper'
import type { LabelFormatRecord } from '../../../shared/domain/labelFormats.generated'
import CustomLabelFormatDialog, { type CustomLabelDraft } from './CustomLabelFormatDialog'
import { annotationFontSize, previewScale } from './previewAnnotation'

/** 预览 svg 的像素尺寸（字号按它换算，见 previewAnnotation.ts）。 */
const PREVIEW_BOX_W = 430
const PREVIEW_BOX_H = 345
import { readDefaultPrinter, writeDefaultPrinter } from '../features/shell/printerPreferences'
import { CONFIGURED_PRINTER_VALUE, mediaSupportOfSelection, mediaTypeOfSelection } from '../features/label-formats/mediaType'
import { distinctBrands, distinctCategories, formatsByMedia, nextFormatForMedia } from '../features/label-formats/catalog'
import { BANNER_FORMATS } from '../../../shared/domain/labelFormats.banner'
import { computePreviewGeometry, labelCellPositions } from '../features/label-formats/previewGeometry'
import { clampCustomGrid } from '../features/label-formats/customFormat'
import {
  configFromCatalogEntry,
  installedBuiltInPrinters,
  builtInPrinterById,
  builtInPrinterValue,
  parseBuiltInPrinterValue,
  pickInitialPrinterValue
} from '../features/shell/installedPrinters'
import { localizePropertyLabel } from '../../../shared/i18n/property.en-US'
import { useI18n } from '../features/i18n/useI18n'
import LText from '../features/i18n/LText'
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

function fixedMm(value: number): string {
  return value.toFixed(2)
}

/** 规格参数草稿：选类型时带出默认值，用户可改。 */
interface LabelFormatDraft {
  widthMm: number
  heightMm: number
  cols: number
  rows: number
  colGapMm: number
  rowGapMm: number
  /** 平张才有：每盒页数 */
  pagesPerBox?: number
  pageWidthMm: number
  pageHeightMm: number
}

/** 卷筒的默认规格：高级热敏纸标签（6060xx）里的 40×30，默认按双列 */
const ROLL_DEFAULT_CODE = '606015'

/** 选中项 → 参数草稿；卷筒默认那条会套用 40×30 双列（目录里没有这个组合） */
function draftForSelection(format: LabelFormatRecord, mediaType: 0 | 1 | 2): LabelFormatDraft {
  const base = draftFromFormat(format, mediaType)
  if (mediaType === 0 && format.code === ROLL_DEFAULT_CODE) {
    return { ...base, widthMm: 40, heightMm: 30, cols: 2, rows: 1, colGapMm: 2, rowGapMm: 2, pageWidthMm: 82, pageHeightMm: 30 }
  }
  return base
}

function draftFromFormat(format: LabelFormatRecord, mediaType: 0 | 1 | 2): LabelFormatDraft {
  const cols = Math.max(1, format.cols)
  const rows = Math.max(1, format.rows)
  return {
    widthMm: format.labelWidthMm,
    heightMm: format.labelHeightMm,
    cols,
    rows,
    colGapMm: format.colGapMm,
    rowGapMm: format.rowGapMm,
    ...(format.type === 1 ? { pagesPerBox: format.totalLabels } : {}),
    // 卷筒：纸面紧贴网格；平张：纸张尺寸沿用格式（A4 等）
    pageWidthMm: mediaType === 0 || mediaType === 2 ? cols * format.labelWidthMm + (cols - 1) * format.colGapMm : format.pageWidthMm,
    pageHeightMm: mediaType === 0 || mediaType === 2 ? rows * format.labelHeightMm + (rows - 1) * format.rowGapMm : format.pageHeightMm
  }
}

/**
 * 「查询常见品牌规格」清单：按当前介质列出目录里的规格，可按品牌 / 类型 / 规格名筛选，
 * 选中一条就把介质、类型、参数一起带出来。
 */
function FormatPickerDialog({ formats, onPick, onClose }: {
  formats: readonly LabelFormatRecord[]
  onPick: (format: LabelFormatRecord) => void
  onClose: () => void
}) {
  const { language } = useI18n()
  const L = (text: string) => localizePropertyLabel(text, language)
  const [keyword, setKeyword] = useState('')
  const [brandId, setBrandId] = useState<number | 'all'>('all')
  const [categoryId, setCategoryId] = useState<number | 'all'>('all')
  const brands = useMemo(() => distinctBrands(formats), [formats])
  // 类型随品牌联动：选了品牌就只列该品牌下的类型
  const categories = useMemo(
    () => distinctCategories(brandId === 'all' ? formats : formats.filter((format) => format.brandId === brandId)),
    [formats, brandId]
  )
  const rows = useMemo(() => {
    const needle = keyword.trim().toLowerCase()
    return formats
      .filter((format) => brandId === 'all' || format.brandId === brandId)
      .filter((format) => categoryId === 'all' || format.categoryId === categoryId)
      .filter((format) => !needle || `${format.brandName}${format.categoryName}${format.name}${format.code}`.toLowerCase().includes(needle))
      .slice(0, 300)
  }, [formats, keyword, brandId, categoryId])
  return (
    <div data-testid="format-picker-dialog" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 320 }}>
      <div role="dialog" aria-modal="true" aria-label={L('查询常见品牌规格')} style={{ background: '#F5F5F5', width: 660, maxWidth: '94vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #D7D7D7' }}>
          <span style={{ fontSize: 15 }}><LText text="查询常见品牌规格"/></span>
          <button type="button" aria-label={L('关闭')} onClick={onClose} style={{ border: 0, background: 'transparent', fontSize: 22, lineHeight: 1, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px 6px' }}>
          <select
            data-testid="format-picker-brand"
            value={brandId}
            onChange={(event) => { const next = event.target.value; setBrandId(next === 'all' ? 'all' : Number(next)); setCategoryId('all') }}
            style={{ padding: '6px 8px', border: '1px solid #BDBDBD', borderRadius: 2, fontSize: 13, minWidth: 150 }}
          >
            <option value="all">{L('全部品牌')}</option>
            {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </select>
          <select
            data-testid="format-picker-category"
            value={categoryId}
            onChange={(event) => { const next = event.target.value; setCategoryId(next === 'all' ? 'all' : Number(next)) }}
            style={{ padding: '6px 8px', border: '1px solid #BDBDBD', borderRadius: 2, fontSize: 13, minWidth: 150 }}
          >
            <option value="all">{L('全部类型')}</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <input
            data-testid="format-picker-search"
            autoFocus
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={L('输入品牌 / 类型 / 规格名筛选')}
            style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '6px 8px', border: '1px solid #BDBDBD', borderRadius: 2, fontSize: 13 }}
          />
        </div>
        <div style={{ overflow: 'auto', flex: 1, padding: '0 14px 12px' }}>
          {rows.length === 0 && <div data-testid="format-picker-empty" style={{ padding: 12, color: '#666', fontSize: 13 }}><LText text="没有匹配的规格"/></div>}
          {rows.map((format) => (
            <button
              key={format.code}
              type="button"
              data-testid={`format-picker-row-${format.code}`}
              onClick={() => onPick(format)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', border: '1px solid #E0E0E0', background: '#fff', marginBottom: 4, cursor: 'pointer', fontSize: 12.5 }}
            >
              <b>{format.brandName}</b>{` · ${format.categoryName} · ${format.name}`}
              <span style={{ marginLeft: 8, color: '#888' }}>{`${format.labelWidthMm}×${format.labelHeightMm}mm ${format.cols}列×${format.rows}行`}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 14px', borderTop: '1px solid #D7D7D7' }}>
          <button type="button" onClick={onClose} style={{ padding: '6px 18px', border: '1px solid #BDBDBD', background: '#fff', cursor: 'pointer', fontSize: 13 }}><LText text="取消"/></button>
        </div>
      </div>
    </div>
  )
}

export default function NewLabelDialog({ onSelect, onClose, onInstallPrinter, onPrinterSettings, onHelp, defaultShape = 'rect' }: Props) {
  const { language } = useI18n()
  const L = (text: string) => localizePropertyLabel(text, language)
  const savedPrinter = readDefaultPrinter()
  const [printerConfig] = useState<PrinterConfig>(() => savedPrinter)
  const [builtInPrinters, setBuiltInPrinters] = useState(() => installedBuiltInPrinters())
  const configuredPrinterLabel = printerConfig.model || printerConfig.profile
    ? `${printerConfig.model ?? printerConfig.profile} · ${printerConfig.driver.toUpperCase()} · ${printerConfig.dpi}dpi`
    : ''
  const initialMediaType: 0 | 1 = printerConfig.port.type === 'driver' ? 1 : 0
  const initialForMedia = initialMediaType === 0
    ? (formatsByMedia(0).find((format) => format.code === ROLL_DEFAULT_CODE) ?? nextFormatForMedia(0))
    : nextFormatForMedia(initialMediaType)
  const [printer, setPrinter] = useState(() => (builtInPrinters[0] ? builtInPrinterValue(builtInPrinters[0].id) : (savedPrinter.printerName ?? '')))
  const [printers, setPrinters] = useState<Array<{ name: string; displayName: string }>>([])
  /** USB 打印机端口（内置驱动打印机默认用它，同真机「端口(O) 默认 USB001」）。 */
  const [usbPorts, setUsbPorts] = useState<string[]>([])
  const [categoryId, setCategoryId] = useState(initialForMedia.categoryId)
  const [formatCode, setFormatCode] = useState(initialForMedia.code)
  /** 可编辑的规格参数（宽/高/列/行/间距/页盒）；选类型或从清单挑一条时带出默认值 */
  const [draft, setDraft] = useState(() => draftForSelection(initialForMedia, initialMediaType))
  const [pickerOpen, setPickerOpen] = useState(false)
  const [customDialog, setCustomDialog] = useState(false)
  // 介质：默认按打印机推断（内置标签机=卷筒、普通 Windows 驱动=平张），用户可手动改
  const derivedMediaType = mediaTypeOfSelection(printerConfig, printer)
  // 当前打印机能打哪些介质：打不了的那一项置灰（020 现场）
  const mediaSupport = mediaSupportOfSelection(printerConfig, printer)
  /** 介质：0 卷筒 / 1 平张 / 2 条幅·飘带（第三种介质，类型只有默认一种，排列单独设） */
  const [mediaType, setMediaType] = useState<0 | 1 | 2>(derivedMediaType)
  useEffect(() => { setMediaType(derivedMediaType) }, [derivedMediaType])
  /** 条幅的排列方向：水平 = 多条并排（列），垂直 = 多条堆叠（行） */
  const [bannerAxis, setBannerAxis] = useState<'horizontal' | 'vertical'>('horizontal')

  useEffect(() => {
    window.maxlabel
      .listPrinters()
      .then((result) => {
        const items = (result.printers ?? []).map((p) => ({ name: p.name, displayName: p.displayName || p.name }))
        setPrinters(items)
        const installed = installedBuiltInPrinters()
        setBuiltInPrinters(installed)
        const savedPrinterConfig = readDefaultPrinter()
        const savedPrinter = savedPrinterConfig.printerName ?? ''
        // 真机顺序：已安装的 内置驱动打印机排在最前，其后是系统打印机；
        // 有明确偏好时仍按偏好（真机保留上次选中的打印机）。
        // 偏好只在本机仍然装有这台打印机时才算数——卸载后留着的旧名字不该再出现
        // （015 现场反馈：卸掉的打印机仍以「已保存打印机」占着一行）。
        setPrinter(pickInitialPrinterValue(installed, items.map((item) => item.name), savedPrinter))
      })
      .catch(() => {})
    window.maxlabel
      .listPorts()
      .then((result) => setUsbPorts(result.usbPrinterPorts ?? []))
      .catch(() => setUsbPorts([]))
  }, [])

  // 平张打印机用平张目录（6080xx：2 品牌 / 每品牌各自的类型 / 京成宸发 42 项），卷筒打印机用卷筒目录
  // （6020xx：1 品牌 / 7 类型 / 每类型 8~55 项）—— 与真机 probe-09 实测的数量一致。
  // 注意必须按 type 过滤：真机选中平张打印机时，宸发标签的「标签类型」只有 1 项
  // （宸发优质打印纸标签），若混入卷筒目录会多出 7 项。
  // 品牌下拉已去掉：类型列表直接取当前介质下的全部分类（品牌只作为清单里的一列展示）
  const availableFormats = useMemo(
    () => (mediaType === 2 ? BANNER_FORMATS : formatsByMedia(mediaType)),
    [mediaType]
  )
  const categories = useMemo(() => distinctCategories(availableFormats), [availableFormats])
  const categoryFormats = useMemo(
    () => availableFormats.filter((format) => format.categoryId === categoryId),
    [availableFormats, categoryId]
  )
  const selected = categoryFormats.find((format) => format.code === formatCode)
    ?? categoryFormats[0]
    ?? availableFormats[0]
    ?? (mediaType === 2 ? BANNER_FORMATS[0] : nextFormatForMedia(mediaType))
  /**
   * 打印机下拉的候选：**内置驱动打印机 + 系统打印机合成一个列表，按名称升序**。
   * 真机取证 `parity/reference/labelshop/probe-21-two-printers.txt`（装了两台 内置驱动打印机后）：
   * Gprinter GPL-N (203 dpi) / HP7E6C81 (HP LaserJet Pro M329) / Microsoft Print to PDF /
   * OneNote (Desktop) / TSC TSPL-N (203 dpi) —— 即按名称排序，而不是「已安装的排前面」。
   */
  const mergedPrinterOptions = useMemo(() => {
    const merged = [
      ...builtInPrinters.map((entry) => ({ value: builtInPrinterValue(entry.id), label: entry.name })),
      ...printers.map((item) => ({ value: item.name, label: item.displayName || item.name }))
    ]
    return merged.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase(), 'en'))
  }, [builtInPrinters, printers])
  // 由条码打印机切换到页式打印机（或反过来）时，必须重置旧的品牌/类型/格式，
  // 否则旧筛选值会落到新目录之外，表现为“只能看到卷筒纸”。
  useEffect(() => {
    const next = mediaType === 2
      ? BANNER_FORMATS[0]
      : mediaType === 0
        ? (formatsByMedia(0).find((format) => format.code === ROLL_DEFAULT_CODE) ?? nextFormatForMedia(0))
        : nextFormatForMedia(1)
    setCategoryId(next.categoryId)
    setFormatCode(next.code)
    if (mediaType === 2) setBannerAxis('horizontal')
  }, [mediaType])

  // 选中项变了（换类型 / 换介质 / 从清单挑了一条）→ 参数区带出该规格的默认值
  useEffect(() => {
    setDraft(draftForSelection(selected, mediaType))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.code, mediaType])

  const patchDraft = (patch: Partial<LabelFormatDraft>) => setDraft((prev) => {
    const next = { ...prev, ...patch }
    // 卷筒：纸面紧贴排版网格；平张：纸张尺寸沿用格式里的（A4 等），不随标签变化
    if (mediaType !== 1) {
      next.pageWidthMm = next.cols * next.widthMm + Math.max(0, next.cols - 1) * next.colGapMm
      next.pageHeightMm = next.rows * next.heightMm + Math.max(0, next.rows - 1) * next.rowGapMm
    }
    return next
  })

  // 预览按**可编辑参数**画，而不是目录里的原始规格
  const previewRecord = {
    ...selected,
    labelWidthMm: draft.widthMm,
    labelHeightMm: draft.heightMm,
    cols: draft.cols,
    rows: draft.rows,
    colGapMm: draft.colGapMm,
    rowGapMm: draft.rowGapMm,
    pageWidthMm: draft.pageWidthMm,
    pageHeightMm: draft.pageHeightMm
  }
  const previewGeometry = computePreviewGeometry(previewRecord, mediaType === 1 ? 1 : 0)
  const {
    previewW, previewH, cols, rows, colGap, rowGap, isRoll, rollSlices, rollSliceH,
    pageW, pageH, originX, originY, totalGridH, viewW, viewH
  } = previewGeometry
  // 整版要画的标签格子：卷筒与平张共用（卷筒双列以前只画一格）
  const labelCells = labelCellPositions(previewGeometry)
  // 序号与尺寸标注的字号：**按渲染像素算再换算回 viewBox 单位**（见 previewAnnotation.ts）。
  // 原来写死 4.5 / 4.2 个 viewBox 单位 ⇒ 实际只有约 4.8px，屏幕上几乎看不见。
  const previewScaleFactor = previewScale(viewW, viewH, PREVIEW_BOX_W, PREVIEW_BOX_H)
  const annotationFont = annotationFontSize(previewH, previewScaleFactor)
  // 上方尺寸标注的排版：页面矩形从 y=12 起，而字号最大约 8.5 个 viewBox 单位
  // ⇒ 文字基线取 `0.85 × 字号 + 0.4`（字形顶端刚好落在 viewBox 内），尺寸线再往下 0.18 × 字号。
  const dimTextY = annotationFont * 0.85 + 0.4
  const dimLineY = dimTextY + annotationFont * 0.18
  const previewPaper = paperFor(selected, defaultShape)
  /** 真机第二行文字：平张 = 「纸张： W 毫米 X  H 毫米」（高度右对齐 4 位），卷筒 = 「纸宽： W 毫米」。
   *  ⚠️ 用**参数草稿**算出来的纸面（pageW/pageH），不是目录记录的原始值 —— 参数可改。 */
  const sheetInfoText = mediaType !== 1
      ? L('纸宽：') + '  ' + Math.round(pageW) + ' ' + L('毫米')
      : L('纸张：') + '  ' + Math.round(pageW) + ' ' + L('毫米') + ' X  ' + String(Math.round(pageH)).padStart(4) + ' ' + L('毫米')

  const chooseType = (nextCategoryId: number) => {
    const first = availableFormats.find((format) => format.categoryId === nextCategoryId)
    if (!first) return
    setCategoryId(nextCategoryId)
    setFormatCode(first.code)
  }

  /** 清单里挑中一条：介质、类型、具体规格一起切过去，参数随后由 effect 带出 */
  const chooseFormat = (next: LabelFormatRecord) => {
    // 条幅目录里的记录 type 也是 0（连续走纸），按分类判定它属于「条幅/飘带」介质
    const targetMedia: 0 | 1 | 2 = next.categoryId === BANNER_FORMATS[0].categoryId
      ? 2
      : (next.type as 0 | 1)
    if (targetMedia !== mediaType) setMediaType(targetMedia)
    setCategoryId(next.categoryId)
    setFormatCode(next.code)
    setDraft(draftForSelection(next, targetMedia))
    setBannerAxis(next.rows > 1 ? 'vertical' : 'horizontal')
    setPickerOpen(false)
  }

  const confirm = () => {
    const w = draft.widthMm
    const h = draft.heightMm
    const format: LabelFormatSelection = {
      rows: draft.rows,
      cols: draft.cols,
      formatKind: 'preset',
      formatCode: selected.code,
      rowGapMm: draft.rowGapMm,
      colGapMm: draft.colGapMm,
      pageWidthMm: draft.pageWidthMm,
      pageHeightMm: draft.pageHeightMm,
      ...(mediaType === 1 && draft.pagesPerBox ? { pagesPerBox: draft.pagesPerBox } : {})
    }
    // 选中的是内置驱动打印机时，把它的指令集/分辨率/型号写进偏好，模板随它保存（真机语义）。
    const catalogId = parseBuiltInPrinterValue(printer)
    const entry = catalogId ? builtInPrinterById(catalogId) : undefined
    if (entry) writeDefaultPrinter(configFromCatalogEntry(entry, undefined, usbPorts[0]))
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
    // 回填孔形：`innerShape === 'rectangle'` 时必须是「矩形」，否则重开对话框会把矩形打回圆洞。
    hole: paperFor(selected, defaultShape).innerDiameterMm ? (paperFor(selected, defaultShape).innerShape === 'rectangle' ? 'rectangle' : 'circle') : 'none',
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
      rows: clampCustomGrid(Number.parseInt(draft.rows, 10)),
      cols: clampCustomGrid(Number.parseInt(draft.cols, 10)),
      rowGapMm: Math.max(0, Number(draft.rowGap) || 0),
      colGapMm: Math.max(0, Number(draft.colGap) || 0),
      formatKind: 'custom',
      pageWidthMm,
      pageHeightMm
    }
    setCustomDialog(false)
    const catalogId = parseBuiltInPrinterValue(printer)
    const entry = catalogId ? builtInPrinterById(catalogId) : undefined
    if (entry) writeDefaultPrinter(configFromCatalogEntry(entry, undefined, usbPorts[0]))
    onSelect(w, h, paper, entry ? entry.name : (printer && printer !== CONFIGURED_PRINTER_VALUE ? printer : undefined), format)
  }

  const field = { padding: '6px 8px', border: '1px solid #BDBDBD', borderRadius: 2, fontSize: 13, background: '#fff', color: '#1A1B1C', width: '100%', boxSizing: 'border-box' as const }
  const button = { padding: '7px 20px', border: '1px solid #BDBDBD', borderRadius: 2, background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }
  const primaryButton = { ...button, borderColor: '#2E6E93', outline: '1px dotted #111', outlineOffset: -4 }

  return (
    <div data-testid="new-label-dialog-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div data-testid="new-label-dialog" role="dialog" aria-modal="true" aria-label={L('选择标签格式')} style={{ background: '#F5F5F5', width: 760, maxWidth: '96vw', maxHeight: '96vh', overflow: 'auto', boxShadow: '0 12px 48px rgba(0,0,0,0.35)', color: '#111' }}>
        <div style={{ height: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderBottom: '1px solid #D7D7D7', background: '#F4F4F4', fontSize: 16 }}>
          <span>{L('选择标签格式')}</span>
          <button type="button" aria-label="关闭" onClick={onClose} style={{ border: 0, background: 'transparent', fontSize: 24, lineHeight: 1, cursor: 'pointer', color: '#333' }}>×</button>
        </div>

        <div style={{ padding: '14px 18px 8px' }}>
          {/* 预览底白：真机 verifier-r43-choose-label.png 的预览区是白底（复刻版原是 #EFEFEF 灰）。 */}
          <div data-testid="new-label-preview" style={{ position: 'relative', margin: '0 auto', width: 430, maxWidth: '100%', height: 345, background: '#fff' }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${viewW} ${viewH}`} preserveAspectRatio="xMidYMid meet" aria-label={L('标签预览')}>
              {isRoll ? (
                /* 卷筒式：真机把「纸」画成一条竖带（宽度 = 纸宽），主标签居中，
                   上下各露一点相邻标签的边（probe-11-select-format-roll.png）。 */
                <g data-testid="new-label-roll-strip" data-roll-slices={rollSlices}>
                  <rect x={12} y={12} width={pageW} height={pageH} fill="#fff" stroke="#111" strokeWidth={0.45} />
                  {/* 主标签：整版 rows × cols 全部画出来（双列卷筒不能只画左边一格） */}
                  {labelCells.map((cell, index) => (
                    <path
                      key={`label-${index}`}
                      data-testid="new-label-roll-label"
                      d={paperPath(previewW, previewH, previewPaper)}
                      transform={`translate(${12 + cell.x} ${12 + cell.y})`}
                      fill="#fff"
                      stroke="#111"
                      strokeWidth={0.45}
                    />
                  ))}
                  {/* 上下相邻标签的露边：同样按列铺开，纵向从整版底部算起 */}
                  {Array.from({ length: rollSlices }, (_, slice) => {
                    const above = slice === 0
                    const y = above
                      ? 12 + originY - rowGap - rollSliceH
                      : 12 + originY + totalGridH + rowGap
                    return Array.from({ length: cols }, (_, col) => (
                      <path
                        key={`slice-${slice}-${col}`}
                        data-testid="new-label-roll-slice"
                        d={paperPath(previewW, rollSliceH, previewPaper)}
                        transform={`translate(${12 + originX + col * (previewW + colGap)} ${y})`}
                        fill="#fff"
                        stroke="#111"
                        strokeWidth={0.45}
                      />
                    ))
                  })}
                </g>
              ) : (
                <>
                  <rect x={12} y={12} width={pageW} height={pageH} fill="#fff" stroke="#111" strokeWidth={0.45} />
                  {labelCells.map((cell, index) => (
                    <path key={index} data-testid="new-label-preview-label" d={paperPath(previewW, previewH, previewPaper)} transform={`translate(${12 + cell.x} ${12 + cell.y})`} fill="#fff" stroke="#111" strokeWidth={0.45} />
                  ))}
                </>
              )}
              {/* 尺寸标注：线在文字下方（`dimLineY`），文字基线 `dimLineY - dimFont * 0.5`；
                  `dimLineY` 取 `dimFont * 1.1`，保证字号变大后文字不会被 viewBox 上边界裁掉
                  （页面矩形从 y=12 起，字号最大时仍留得下）。 */}
              <line x1={12 + originX} y1={dimLineY} x2={12 + originX + previewW} y2={dimLineY} stroke="#F00" strokeWidth={0.35} />
              <path d={`M ${12 + originX} ${dimLineY} l 2 -1.1 M ${12 + originX} ${dimLineY} l 2 1.1 M ${12 + originX + previewW} ${dimLineY} l -2 -1.1 M ${12 + originX + previewW} ${dimLineY} l -2 1.1`} stroke="#F00" strokeWidth={0.35} fill="none" />
              <text x={12 + originX + previewW / 2} y={dimTextY} textAnchor="middle" fontSize={annotationFont} fill="#E00">{`${Math.round(previewW)}mm`}</text>
              <line x1={viewW - 13} y1={12 + originY} x2={viewW - 13} y2={12 + originY + previewH} stroke="#F00" strokeWidth={0.35} />
              <path d={`M ${viewW - 13} ${12 + originY} l -1.1 2 M ${viewW - 13} ${12 + originY} l 1.1 2 M ${viewW - 13} ${12 + originY + previewH} l -1.1 -2 M ${viewW - 13} ${12 + originY + previewH} l 1.1 -2`} stroke="#F00" strokeWidth={0.35} fill="none" />
              <text x={viewW - 10} y={12 + originY + previewH / 2} textAnchor="middle" fontSize={annotationFont} fill="#E00" transform={`rotate(90 ${viewW - 10} ${12 + originY + previewH / 2})`}>{`${Math.round(previewH)}mm`}</text>
              {Array.from({ length: cols * rows }, (_, index) => {
                const x = 12 + originX + (index % cols) * (previewW + colGap) + previewW / 2
                const y = 12 + originY + Math.floor(index / cols) * (previewH + rowGap) + previewH / 2 + annotationFont * 0.36
                return <text key={`n-${index}`} data-testid="new-label-preview-number" x={x} y={y} textAnchor="middle" fontSize={annotationFont} fill="#111">{index + 1}</text>
              })}
            </svg>
          </div>
          <div data-testid="new-label-sheet-info" style={{ textAlign: 'center', fontSize: 14, lineHeight: 1.8, marginTop: 2 }}>
            {sheetInfoText}
          </div>
          <div data-testid="new-label-label-info" style={{ textAlign: 'center', fontSize: 14, lineHeight: 1.8 }}>
            {L('标签：')}{'  '}{fixedMm(previewW)}{' '}{L('毫米')}{' X '}{fixedMm(previewH)}{' '}{L('毫米')}
          </div>
        </div>

        <fieldset data-testid="new-label-choose-group" style={{ margin: '4px 18px 12px', padding: '10px 12px 12px', border: '1px solid #D5D5D5', background: '#F8F8F8' }}>
          <legend style={{ padding: '0 5px', fontSize: 14 }}><LText text="选择标签"/></legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '7px 12px' }}>
            <label style={{ fontSize: 13 }}><LText text="打印机(P):"/>
              <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                <select data-testid="new-label-printer" value={printer} onChange={(event) => setPrinter(event.target.value)} style={{ ...field, flex: 1 }}>
                  {builtInPrinters.length === 0 && printers.length === 0 && !configuredPrinterLabel && <option value="">{L('（未检测到打印机）')}</option>}
                  {/* 真机 probe-21（装两台后）：内置驱动打印机与系统打印机**合成一个列表按名称升序**排列，
                      不是「已安装的排在前面」。 */}
                  {mergedPrinterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <button type="button" data-testid="new-label-install" onClick={() => onInstallPrinter?.(printer || undefined)} style={{ ...button, whiteSpace: 'nowrap' }}><span><LText text="安装"/></span><span>(I)</span></button>
              </div>
              <div data-testid="new-label-printer-impact" style={{ marginTop: 4, color: '#666', fontSize: 12 }}><LText text="打印机选择会影响条码密度与标签尺寸，请先选择与标签匹配的打印机。"/></div>
            </label>
            <label style={{ fontSize: 13 }}><LText text="介质类型"/>
              <div style={{ display: 'flex', gap: 18, marginTop: 5, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: mediaSupport.roll ? 1 : 0.45 }}>
                  <input
                    type="radio"
                    data-testid="new-label-media-roll"
                    disabled={!mediaSupport.roll}
                    title={mediaSupport.roll ? undefined : L('当前打印机不支持卷筒标签')}
                    checked={mediaType === 0}
                    onChange={() => mediaSupport.roll && setMediaType(0)}
                  />
                  <LText text="卷筒标签"/>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: mediaSupport.sheet ? 1 : 0.45 }}>
                  <input
                    type="radio"
                    data-testid="new-label-media-sheet"
                    disabled={!mediaSupport.sheet}
                    title={mediaSupport.sheet ? undefined : L('当前打印机不支持平张标签')}
                    checked={mediaType === 1}
                    onChange={() => mediaSupport.sheet && setMediaType(1)}
                  />
                  <LText text="平张标签"/>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: mediaSupport.roll ? 1 : 0.45 }}>
                  <input
                    type="radio"
                    data-testid="new-label-media-banner"
                    disabled={!mediaSupport.roll}
                    title={mediaSupport.roll ? undefined : L('当前打印机不支持卷筒标签')}
                    checked={mediaType === 2}
                    onChange={() => mediaSupport.roll && setMediaType(2)}
                  />
                  <LText text="条幅/飘带"/>
                </label>
                <button type="button" data-testid="new-label-format-picker" onClick={() => setPickerOpen(true)} style={{ ...button, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  <LText text="查询常见品牌规格..."/>
                </button>
              </div>
            </label>
            <label style={{ fontSize: 13 }}><LText text="标签类型(G):"/>
              <select data-testid="new-label-type" value={categoryId} onChange={(event) => chooseType(Number(event.target.value))} style={{ ...field, marginTop: 3 }}>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            {mediaType === 2 && (
              <div data-testid="new-label-banner-axis" style={{ display: 'flex', gap: 18, alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: '#4B5563' }}><LText text="排列方式"/></span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <input
                    type="radio"
                    data-testid="new-label-banner-horizontal"
                    checked={bannerAxis === 'horizontal'}
                    onChange={() => {
                      const count = Math.max(1, bannerAxis === 'vertical' ? draft.rows : draft.cols)
                      setBannerAxis('horizontal')
                      patchDraft({ cols: count, rows: 1 })
                    }}
                  />
                  <LText text="水平排列（多条并排）"/>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <input
                    type="radio"
                    data-testid="new-label-banner-vertical"
                    checked={bannerAxis === 'vertical'}
                    onChange={() => {
                      const count = Math.max(1, bannerAxis === 'horizontal' ? draft.cols : draft.rows)
                      setBannerAxis('vertical')
                      patchDraft({ cols: 1, rows: count })
                    }}
                  />
                  <LText text="垂直排列（多条堆叠）"/>
                </label>
              </div>
            )}
            {/* 参数：选中类型时带出默认值，可直接改；卷筒/条幅会按宽高×行列自动算纸面 */}
            <div data-testid="new-label-params" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '7px 12px', marginTop: 3 }}>
              <label style={{ fontSize: 13 }}><LText text="宽度（毫米）"/>
                <input data-testid="new-label-param-width" type="number" min={1} step={0.1} value={draft.widthMm} onChange={(e) => patchDraft({ widthMm: Math.max(1, Number(e.target.value) || 1) })} style={{ ...field, marginTop: 3 }} />
              </label>
              <label style={{ fontSize: 13 }}><LText text="高度（毫米）"/>
                <input data-testid="new-label-param-height" type="number" min={1} step={0.1} value={draft.heightMm} onChange={(e) => patchDraft({ heightMm: Math.max(1, Number(e.target.value) || 1) })} style={{ ...field, marginTop: 3 }} />
              </label>
              {mediaType === 2 ? (
                <label style={{ fontSize: 13 }}><LText text="条数"/>
                  <input
                    data-testid="new-label-param-copies"
                    type="number"
                    min={1}
                    max={100}
                    value={bannerAxis === 'horizontal' ? draft.cols : draft.rows}
                    onChange={(e) => {
                      const count = Math.max(1, Math.min(100, Math.floor(Number(e.target.value) || 1)))
                      patchDraft(bannerAxis === 'horizontal' ? { cols: count, rows: 1 } : { cols: 1, rows: count })
                    }}
                    style={{ ...field, marginTop: 3 }}
                  />
                </label>
              ) : (
                <>
                  <label style={{ fontSize: 13 }}><LText text="列数"/>
                    <input data-testid="new-label-param-cols" type="number" min={1} max={100} value={draft.cols} onChange={(e) => patchDraft({ cols: Math.max(1, Math.min(100, Math.floor(Number(e.target.value) || 1))) })} style={{ ...field, marginTop: 3 }} />
                  </label>
                  <label style={{ fontSize: 13 }}><LText text="行数"/>
                    <input data-testid="new-label-param-rows" type="number" min={1} max={100} value={draft.rows} onChange={(e) => patchDraft({ rows: Math.max(1, Math.min(100, Math.floor(Number(e.target.value) || 1))) })} style={{ ...field, marginTop: 3 }} />
                  </label>
                </>
              )}
              <label style={{ fontSize: 13 }}><LText text="列间距（毫米）"/>
                <input data-testid="new-label-param-col-gap" type="number" min={0} step={0.1} value={draft.colGapMm} onChange={(e) => patchDraft({ colGapMm: Math.max(0, Number(e.target.value) || 0) })} style={{ ...field, marginTop: 3 }} />
              </label>
              <label style={{ fontSize: 13 }}><LText text="行间距（毫米）"/>
                <input data-testid="new-label-param-row-gap" type="number" min={0} step={0.1} value={draft.rowGapMm} onChange={(e) => patchDraft({ rowGapMm: Math.max(0, Number(e.target.value) || 0) })} style={{ ...field, marginTop: 3 }} />
              </label>
              {mediaType === 1 && (
                <label style={{ fontSize: 13 }}><LText text="每盒页数"/>
                  <input data-testid="new-label-param-pages" type="number" min={0} value={draft.pagesPerBox ?? 0} onChange={(e) => patchDraft({ pagesPerBox: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} style={{ ...field, marginTop: 3 }} />
                </label>
              )}
            </div>
          </div>
          <div data-testid="new-label-current-format" style={{ marginTop: 8, fontSize: 12.5, color: '#666' }}>
            {`当前规格：${selected.brandName} · ${selected.categoryName} · ${draft.widthMm}×${draft.heightMm}mm ${bannerAxis === 'vertical' && mediaType === 2 ? `${draft.rows}行` : `${draft.cols}列×${draft.rows}行`}`}
          </div>
          <div data-testid="new-label-hint" style={{ marginTop: 4, fontSize: 12.5 }}><LText text="提示：参数可直接修改；也可以在「查询常见品牌规格」里挑一条已知规格自动带出。"/></div>
        </fieldset>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, padding: '2px 18px 18px' }}>
          <button type="button" data-testid="new-label-select" accessKey="o" data-access-suffix="(O)" className="legacy-access-key" autoFocus onClick={confirm} style={primaryButton}><LText text="选择"/></button>
          <button type="button" data-testid="new-label-custom" accessKey="n" data-access-suffix="(N)" className="legacy-access-key" onClick={() => setCustomDialog(true)} style={button}><LText text="自定义"/></button>
          <button type="button" data-testid="new-label-cancel" accessKey="c" data-access-suffix="(C)" className="legacy-access-key" onClick={onClose} style={button}><LText text="取消"/></button>
          <button type="button" data-testid="new-label-help" accessKey="h" data-access-suffix="(H)" className="legacy-access-key" onClick={onHelp} style={button}><LText text="帮助"/></button>
        </div>
      </div>
      {pickerOpen && (
        <FormatPickerDialog
          formats={availableFormats}
          onPick={chooseFormat}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {customDialog && <CustomLabelFormatDialog initial={customInitial} onClose={() => setCustomDialog(false)} onConfirm={confirmCustom} onPrinterSettings={onPrinterSettings} onInstallPrinter={() => onInstallPrinter?.(printer || undefined)} onHelp={onHelp} />}
    </div>
  )
}
