import { useEffect, useMemo, useRef, useState } from 'react'
import { paperPath, type PaperGeometry, type PaperShape } from '../../../shared/domain/paper'
import type { LabelFormatRecord } from '../../../shared/domain/labelFormats.generated'
import { previewAnnotationLayout } from './previewAnnotation'
import { PAPER_HOLE_OPTIONS, PAPER_SHAPE_OPTIONS, holeSelectionOf, maxHoleSizeMm, withHoleSelection, type PaperHoleSelection } from './paperHoleFields'

/** 预览 svg 的最大像素尺寸（字号按实际渲染尺寸换算，见 previewAnnotation.ts）。
 *  实际画框按 viewBox 等比收缩，避免固定 430×345 时四周大片空白。 */
const PREVIEW_BOX_W = 420
const PREVIEW_BOX_H = 260
import { readDefaultPrinter, writeDefaultPrinter } from '../features/shell/printerPreferences'
import { CONFIGURED_PRINTER_VALUE, mediaSupportOfSelection, mediaTypeOfSelection } from '../features/label-formats/mediaType'
import { distinctBrands, distinctCategories, formatsByMedia, nextFormatForMedia } from '../features/label-formats/catalog'
import { BANNER_FORMATS } from '../../../shared/domain/labelFormats.banner'
import { computePreviewGeometry, labelCellPositions } from '../features/label-formats/previewGeometry'
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
  pageLeftMm?: number
  pageTopMm?: number
}

/** 「标签格式设置」编辑现有标签时的初值（来自当前文档，而不是目录默认值）。 */
export interface LabelFormatInitial {
  widthMm: number
  heightMm: number
  rows: number
  cols: number
  rowGapMm: number
  colGapMm: number
  pagesPerBox?: number
  pageWidthMm?: number
  pageHeightMm?: number
  pageLeftMm?: number
  pageTopMm?: number
  shape?: PaperShape
  innerShape?: 'circle' | 'rectangle'
  innerDiameterMm?: number
  labelColor?: string
  formatKind?: 'preset' | 'custom'
}

interface Props {
  onSelect: (w: number, h: number, paper?: PaperGeometry, printerName?: string, format?: LabelFormatSelection) => void
  onClose: () => void
  onPrinterSettings?: () => void
  defaultW?: number
  defaultH?: number
  defaultShape?: PaperGeometry['shape']
  /** new = 新建标签；edit = 修改当前标签的格式（确认后作用于现有文档） */
  mode?: 'new' | 'edit'
  /** edit 模式的初值；不传则仍按打印机推断的目录默认值 */
  initial?: LabelFormatInitial
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
  pageLeftMm: number
  pageTopMm: number
  /** 标签形状 / 孔洞（与「标签格式设置」同一套语义） */
  shape: PaperShape
  hole: PaperHoleSelection
  holeSizeMm: number
  /** 只影响预览与编辑背景，不参与实际打印底色 */
  labelColor: string
}

/** 卷筒的默认规格：高级热敏纸标签（6060xx）里的 40×30，默认按双列 */
const ROLL_DEFAULT_CODE = '606015'

/** 选中项 → 参数草稿；卷筒默认那条会套用 40×30 双列（目录里没有这个组合） */
function draftForSelection(format: LabelFormatRecord, mediaType: 0 | 1 | 2, fallbackShape: PaperShape): LabelFormatDraft {
  const base = draftFromFormat(format, mediaType, fallbackShape)
  if (mediaType === 0 && format.code === ROLL_DEFAULT_CODE) {
    // 卷筒默认按双列排版（与 604003 双列卷筒同几何）：纸宽 = 宽×列 + 列距 + 2×左空
    const cols = 2
    return {
      ...base,
      widthMm: 40,
      heightMm: 30,
      cols,
      rows: 1,
      pageWidthMm: cols * 40 + (cols - 1) * base.colGapMm + 2 * base.pageLeftMm,
      pageHeightMm: 30
    }
  }
  return base
}

/** 已有标签 → 参数草稿：几何全部取自当前文档，孔洞/颜色一并回填。 */
function draftFromInitial(initial: LabelFormatInitial, mediaType: 0 | 1 | 2, fallbackShape: PaperShape): LabelFormatDraft {
  const cols = Math.max(1, initial.cols)
  const rows = Math.max(1, initial.rows)
  const pageLeftMm = initial.pageLeftMm ?? 0
  const pageTopMm = initial.pageTopMm ?? 0
  const paper: PaperGeometry = {
    shape: initial.shape ?? fallbackShape,
    ...(initial.innerDiameterMm && initial.innerDiameterMm > 0
      ? { innerDiameterMm: initial.innerDiameterMm, ...(initial.innerShape ? { innerShape: initial.innerShape } : {}) }
      : {}),
    ...(initial.labelColor ? { labelColor: initial.labelColor } : {})
  }
  return {
    widthMm: initial.widthMm,
    heightMm: initial.heightMm,
    cols,
    rows,
    colGapMm: initial.colGapMm,
    rowGapMm: initial.rowGapMm,
    ...(initial.pagesPerBox !== undefined ? { pagesPerBox: initial.pagesPerBox } : {}),
    pageWidthMm: initial.pageWidthMm ?? (mediaType === 1
      ? initial.widthMm
      : cols * initial.widthMm + (cols - 1) * initial.colGapMm + 2 * pageLeftMm),
    pageHeightMm: initial.pageHeightMm ?? (mediaType === 1
      ? initial.heightMm
      : rows * initial.heightMm + (rows - 1) * initial.rowGapMm),
    pageLeftMm,
    pageTopMm,
    shape: paper.shape ?? fallbackShape,
    hole: holeSelectionOf(paper, initial.widthMm, initial.heightMm),
    holeSizeMm: initial.innerDiameterMm ?? 0,
    labelColor: initial.labelColor ?? '#ffffff'
  }
}

function draftFromFormat(format: LabelFormatRecord, mediaType: 0 | 1 | 2, fallbackShape: PaperShape): LabelFormatDraft {
  const cols = Math.max(1, format.cols)
  const rows = Math.max(1, format.rows)
  const paper = paperFor(format, fallbackShape)
  return {
    widthMm: format.labelWidthMm,
    heightMm: format.labelHeightMm,
    cols,
    rows,
    colGapMm: format.colGapMm,
    rowGapMm: format.rowGapMm,
    ...(format.type === 1 ? { pagesPerBox: format.totalLabels } : {}),
    // 卷筒/条幅：纸面按网格算，左右各留一份左空；平张：纸张尺寸沿用格式（A4 等）
    pageWidthMm: mediaType === 0 || mediaType === 2
      ? cols * format.labelWidthMm + (cols - 1) * format.colGapMm + 2 * format.pageLeftMm
      : format.pageWidthMm,
    pageHeightMm: mediaType === 0 || mediaType === 2 ? rows * format.labelHeightMm + (rows - 1) * format.rowGapMm : format.pageHeightMm,
    pageLeftMm: format.pageLeftMm,
    pageTopMm: format.pageTopMm,
    shape: paper.shape ?? fallbackShape,
    hole: holeSelectionOf(paper, format.labelWidthMm, format.labelHeightMm),
    holeSizeMm: paper.innerDiameterMm ?? 0,
    labelColor: '#ffffff'
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

export default function NewLabelDialog({ onSelect, onClose, onPrinterSettings, defaultShape = 'rect', mode = 'new', initial }: Props) {
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
  const [draft, setDraft] = useState(() => initial
    ? draftFromInitial(initial, initialMediaType, defaultShape)
    : draftForSelection(initialForMedia, initialMediaType, defaultShape))
  /** edit：初值来自当前标签，用户没挑新规格前不要被目录默认值冲掉。 */
  const [draftLocked, setDraftLocked] = useState(mode === 'edit' && Boolean(initial))
  /** 用户是否从「查询常见品牌规格」里挑过一条（决定确认后是 preset 还是保留原 formatKind）。 */
  const [formatPicked, setFormatPicked] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  /** 页面设置默认收起，点标题才展开 */
  const [pageExpanded, setPageExpanded] = useState(false)
  /** 确认过程中可能要等 USB 端口枚举；期间禁用「选择」防止重复提交。 */
  const [confirming, setConfirming] = useState(false)
  const confirmBusyRef = useRef(false)
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
  // 品牌下拉与「标签类型」下拉都已去掉：默认格式取当前介质目录的第一条（具体格式在清单里挑）。
  const availableFormats = useMemo(
    () => (mediaType === 2 ? BANNER_FORMATS : formatsByMedia(mediaType)),
    [mediaType]
  )
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

  // 选中项变了（换类型 / 换介质 / 从清单挑了一条）→ 参数区带出该规格的默认值。
  // 编辑现有标签时先锁住：初值来自当前文档，不能一打开就被目录默认值覆盖。
  useEffect(() => {
    if (draftLocked) return
    setDraft(draftForSelection(selected, mediaType, defaultShape))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.code, mediaType, draftLocked])

  const patchDraft = (patch: Partial<LabelFormatDraft>) => setDraft((prev) => {
    const next = { ...prev, ...patch }
    // 卷筒/条幅：改标签尺寸或行列间距时纸面跟着网格算；平张沿用格式里的纸张尺寸（A4 等）。
    // 只改形状/孔洞/颜色/左空时不重算，避免把用户刚改过的页面尺寸又冲掉。
    const gridChanged = ['widthMm', 'heightMm', 'cols', 'rows', 'colGapMm', 'rowGapMm'].some((key) => key in patch)
    if (mediaType !== 1 && gridChanged) {
      next.pageWidthMm = next.cols * next.widthMm + Math.max(0, next.cols - 1) * next.colGapMm + 2 * next.pageLeftMm
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
    pageHeightMm: draft.pageHeightMm,
    pageLeftMm: draft.pageLeftMm,
    pageTopMm: draft.pageTopMm
  }
  // 留白要跟着标注字号走（长条标签的字号换算回 viewBox 后可能超过默认留白），
  // 所以先算页面尺寸 → 再按字号定留白 → 最后用该留白重算视图。
  const baseGeometry = computePreviewGeometry(previewRecord, mediaType === 1 ? 1 : 0)
  const annotationLayout = previewAnnotationLayout(baseGeometry.pageW, baseGeometry.pageH, PREVIEW_BOX_W, PREVIEW_BOX_H, baseGeometry.previewH)
  const previewGeometry = computePreviewGeometry(previewRecord, mediaType === 1 ? 1 : 0, annotationLayout.margin)
  const {
    previewW, previewH, cols, rows, colGap, rowGap, isRoll, rollSlices, rollSliceH,
    pageW, pageH, originX, originY, totalGridH, margin, viewW, viewH
  } = previewGeometry
  // 整版要画的标签格子：卷筒与平张共用（卷筒双列以前只画一格）
  const labelCells = labelCellPositions(previewGeometry)
  // 序号与尺寸标注的字号：**按渲染像素算再换算回 viewBox 单位**（见 previewAnnotation.ts）。
  const previewScaleFactor = annotationLayout.scale
  const previewBoxW = viewW * previewScaleFactor
  const previewBoxH = viewH * previewScaleFactor
  const annotationFont = annotationLayout.font
  // 标注画在页面四周的留白里：尺寸线贴着页面边，文字在线的外侧。
  const dimLineY = margin - annotationFont * 0.3
  const dimTextY = margin - annotationFont * 0.62
  /** 由「形状 / 孔洞 / 纸张颜色」参数生成的纸面几何（确认时原样交给上层）。 */
  const previewPaper: PaperGeometry = {
    shape: draft.shape,
    labelColor: draft.labelColor,
    ...(draft.hole === 'none' ? {} : withHoleSelection({}, draft.hole, draft.holeSizeMm, draft.widthMm, draft.heightMm))
  }
  /** 真机第二行文字：平张 = 「纸张： W 毫米 X  H 毫米」（高度右对齐 4 位），卷筒 = 「纸宽： W 毫米」。
   *  ⚠️ 用**参数草稿**算出来的纸面（pageW/pageH），不是目录记录的原始值 —— 参数可改。 */
  const sheetInfoText = mediaType !== 1
      ? L('纸宽：') + '  ' + Math.round(pageW) + ' ' + L('毫米')
      : L('纸张：') + '  ' + Math.round(pageW) + ' ' + L('毫米') + ' X  ' + String(Math.round(pageH)).padStart(4) + ' ' + L('毫米')

  /** 清单里挑中一条：介质、类型、具体规格一起切过去，参数随后由 effect 带出 */
  const chooseFormat = (next: LabelFormatRecord) => {
    // 条幅目录里的记录 type 也是 0（连续走纸），按分类判定它属于「条幅/飘带」介质
    const targetMedia: 0 | 1 | 2 = next.categoryId === BANNER_FORMATS[0].categoryId
      ? 2
      : (next.type as 0 | 1)
    if (targetMedia !== mediaType) setMediaType(targetMedia)
    setCategoryId(next.categoryId)
    setFormatCode(next.code)
    setDraftLocked(false)
    setFormatPicked(true)
    setDraft(draftForSelection(next, targetMedia, defaultShape))
    setBannerAxis(next.rows > 1 ? 'vertical' : 'horizontal')
    setPickerOpen(false)
  }

  /** USB 端口枚举比打开对话框慢时，确认前补一次，避免把「USB + 空端口」写进偏好。 */
  const resolveUsbPort = async (): Promise<string | undefined> => {
    if (usbPorts[0]) return usbPorts[0]
    try {
      const result = await window.maxlabel.listPorts()
      const ports = result.usbPrinterPorts ?? []
      if (ports.length) setUsbPorts(ports)
      return ports[0]
    } catch {
      return undefined
    }
  }

  const confirm = async () => {
    if (confirmBusyRef.current) return
    confirmBusyRef.current = true
    setConfirming(true)
    try {
      const w = draft.widthMm
      const h = draft.heightMm
      const format: LabelFormatSelection = {
        rows: draft.rows,
        cols: draft.cols,
        // 编辑现有标签且没挑新规格时保留原格式类型（模板属性页据此决定是否只读）；
        // 新建或从清单挑了规格 → preset。
        formatKind: mode === 'edit' && !formatPicked ? (initial?.formatKind ?? 'custom') : 'preset',
        formatCode: selected.code,
        rowGapMm: draft.rowGapMm,
        colGapMm: draft.colGapMm,
        pageWidthMm: draft.pageWidthMm,
        pageHeightMm: draft.pageHeightMm,
        pageLeftMm: draft.pageLeftMm,
        pageTopMm: draft.pageTopMm,
        ...(mediaType === 1 && draft.pagesPerBox ? { pagesPerBox: draft.pagesPerBox } : {})
      }
      // 选中的是内置驱动打印机时，把它的指令集/分辨率/型号写进偏好，模板随它保存（真机语义）。
      // USB 端口可能还在枚举中（打开对话框时才发起），必须等结果再写，否则会存成「USB + 空端口」，
      // 新建后直接打印就会报「请选择 USB 打印机端口」。
      const catalogId = parseBuiltInPrinterValue(printer)
      const entry = catalogId ? builtInPrinterById(catalogId) : undefined
      if (entry) writeDefaultPrinter(configFromCatalogEntry(entry, undefined, await resolveUsbPort()))
      const printerNameArg = entry ? entry.name : (printer && printer !== CONFIGURED_PRINTER_VALUE ? printer : undefined)
      onSelect(w, h, previewPaper, printerNameArg, format)
    } finally {
      confirmBusyRef.current = false
      setConfirming(false)
    }
  }

  const field = { padding: '6px 8px', border: '1px solid #BDBDBD', borderRadius: 2, fontSize: 13, background: '#fff', color: '#1A1B1C', width: '100%', boxSizing: 'border-box' as const }
  const button = { padding: '7px 20px', border: '1px solid #BDBDBD', borderRadius: 2, background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }
  /** 主按钮（选择）：实心主色 + 加长，视觉上最突出 */
  const primaryButton = { ...button, minWidth: 200, padding: '8px 32px', borderColor: '#2E6E93', background: '#2E6E93', color: '#fff', fontWeight: 600 }
  /** 次强调按钮（查询常见品牌规格） */
  const highlightedButton = { ...button, borderColor: '#2E6E93', background: '#EAF2F7', color: '#2E6E93', fontWeight: 600 }
  /** 参数分组样式：与「标签格式设置」的 标签 / 间距 / 行列 三栏一致 */
  const paramGroup = { margin: 0, padding: '12px 12px 10px', border: '1px solid #D5D5D5' } as const
  const paramLegend = { padding: '0 5px', fontSize: 13 } as const
  /** 一行参数：标签（含快捷键字母）+ 输入框 + 单位「毫米」 */
  const paramRow = (
    testId: string,
    label: string,
    value: number,
    onChange: (raw: string) => void,
    opts: { min?: number; max?: number; step?: number; unit?: boolean } = {}
  ) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
      <span style={{ minWidth: 62 }}>{label}</span>
      <input
        data-testid={testId}
        type="number"
        min={opts.min ?? 1}
        max={opts.max}
        step={opts.step ?? 1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ ...field, width: 96 }}
      />
      {opts.unit && <span>{L('毫米')}</span>}
    </label>
  )

  return (
    <div data-testid="new-label-dialog-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div data-testid="new-label-dialog" role="dialog" aria-modal="true" aria-label={mode === 'edit' ? L('标签格式设置') : L('选择标签格式')} style={{ background: '#F5F5F5', width: 760, maxWidth: '96vw', maxHeight: '96vh', overflow: 'auto', boxShadow: '0 12px 48px rgba(0,0,0,0.35)', color: '#111' }}>
        <div style={{ height: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderBottom: '1px solid #D7D7D7', background: '#F4F4F4', fontSize: 16 }}>
          <span>{mode === 'edit' ? L('标签格式设置') : L('选择标签格式')}</span>
          <button type="button" aria-label="关闭" onClick={onClose} style={{ border: 0, background: 'transparent', fontSize: 24, lineHeight: 1, cursor: 'pointer', color: '#333' }}>×</button>
        </div>

        <div style={{ padding: '10px 18px 6px' }}>
          {/* 预览底白：真机 verifier-r43-choose-label.png 的预览区是白底（复刻版原是 #EFEFEF 灰）。 */}
          <div data-testid="new-label-preview-area" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <div data-testid="new-label-preview" style={{ position: 'relative', flex: '0 0 auto', width: previewBoxW, height: previewBoxH, background: '#fff' }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${viewW} ${viewH}`} preserveAspectRatio="xMidYMid meet" aria-label={L('标签预览')}>
              {isRoll ? (
                /* 卷筒式：真机把「纸」画成一条竖带（宽度 = 纸宽），主标签居中，
                   上下各露一点相邻标签的边（probe-11-select-format-roll.png）。 */
                <g data-testid="new-label-roll-strip" data-roll-slices={rollSlices}>
                  <rect x={margin} y={margin} width={pageW} height={pageH} fill={draft.labelColor} stroke="#111" strokeWidth={0.45} />
                  {/* 主标签：整版 rows × cols 全部画出来（双列卷筒不能只画左边一格） */}
                  {labelCells.map((cell, index) => (
                    <path
                      key={`label-${index}`}
                      data-testid="new-label-roll-label"
                      d={paperPath(previewW, previewH, previewPaper)}
                      transform={`translate(${margin + cell.x} ${margin + cell.y})`}
                      fill={draft.labelColor}
                      stroke="#111"
                      strokeWidth={0.45}
                    />
                  ))}
                  {/* 上下相邻标签的露边：同样按列铺开，纵向从整版底部算起 */}
                  {Array.from({ length: rollSlices }, (_, slice) => {
                    const above = slice === 0
                    const y = above
                      ? margin + originY - rowGap - rollSliceH
                      : margin + originY + totalGridH + rowGap
                    return Array.from({ length: cols }, (_, col) => (
                      <path
                        key={`slice-${slice}-${col}`}
                        data-testid="new-label-roll-slice"
                        d={paperPath(previewW, rollSliceH, previewPaper)}
                        transform={`translate(${margin + originX + col * (previewW + colGap)} ${y})`}
                        fill={draft.labelColor}
                        stroke="#111"
                        strokeWidth={0.45}
                      />
                    ))
                  })}
                </g>
              ) : (
                <>
                  <rect x={margin} y={margin} width={pageW} height={pageH} fill={draft.labelColor} stroke="#111" strokeWidth={0.45} />
                  {labelCells.map((cell, index) => (
                    <path key={index} data-testid="new-label-preview-label" d={paperPath(previewW, previewH, previewPaper)} transform={`translate(${margin + cell.x} ${margin + cell.y})`} fill={draft.labelColor} stroke="#111" strokeWidth={0.45} />
                  ))}
                </>
              )}
              {/* 尺寸标注画在页面四周的留白里：横线在页面上方、竖线在页面右侧；
                  留白由 previewAnnotationLayout 按标称字号算出，长条标签也不会被 viewBox 裁掉。 */}
              <line x1={margin + originX} y1={dimLineY} x2={margin + originX + previewW} y2={dimLineY} stroke="#F00" strokeWidth={0.35} />
              <path d={`M ${margin + originX} ${dimLineY} l 2 -1.1 M ${margin + originX} ${dimLineY} l 2 1.1 M ${margin + originX + previewW} ${dimLineY} l -2 -1.1 M ${margin + originX + previewW} ${dimLineY} l -2 1.1`} stroke="#F00" strokeWidth={0.35} fill="none" />
              <text x={margin + originX + previewW / 2} y={dimTextY} textAnchor="middle" fontSize={annotationFont} fill="#E00">{`${Math.round(previewW)}mm`}</text>
              {(() => {
                // 竖排标注放在页面右侧：线离纸边 0.35 字高，文字再往右 0.95 字高。
                const vx = margin + pageW + annotationFont * 0.35
                const vy = margin + originY + previewH / 2
                return (
                  <>
                    <line x1={vx} y1={margin + originY} x2={vx} y2={margin + originY + previewH} stroke="#F00" strokeWidth={0.35} />
                    <path d={`M ${vx} ${margin + originY} l -1.1 2 M ${vx} ${margin + originY} l 1.1 2 M ${vx} ${margin + originY + previewH} l -1.1 -2 M ${vx} ${margin + originY + previewH} l 1.1 -2`} stroke="#F00" strokeWidth={0.35} fill="none" />
                    <text x={vx + annotationFont * 0.95} y={vy} textAnchor="middle" fontSize={annotationFont} fill="#E00" transform={`rotate(90 ${vx + annotationFont * 0.95} ${vy})`}>{`${Math.round(previewH)}mm`}</text>
                  </>
                )
              })()}
              {Array.from({ length: cols * rows }, (_, index) => {
                const x = margin + originX + (index % cols) * (previewW + colGap) + previewW / 2
                const y = margin + originY + Math.floor(index / cols) * (previewH + rowGap) + previewH / 2 + annotationFont * 0.36
                return <text key={`n-${index}`} data-testid="new-label-preview-number" x={x} y={y} textAnchor="middle" fontSize={annotationFont} fill="#111">{index + 1}</text>
              })}
            </svg>
          </div>
          {/* 纸宽 / 标签尺寸放在示意图右侧，而不是图下方居中 */}
          <div style={{ flex: '0 0 auto', minWidth: 156, fontSize: 13.5, lineHeight: 2, whiteSpace: 'nowrap' }}>
            <div data-testid="new-label-sheet-info">{sheetInfoText}</div>
            <div data-testid="new-label-label-info">
              {L('标签：')}{'  '}{fixedMm(previewW)}{' '}{L('毫米')}{' X '}{fixedMm(previewH)}{' '}{L('毫米')}
            </div>
          </div>
          </div>
        </div>

        <div data-testid="new-label-choose-group" style={{ margin: '4px 18px 12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '7px 12px' }}>
            <label style={{ fontSize: 13 }}><LText text="打印机(P):"/>
              <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                <select data-testid="new-label-printer" value={printer} onChange={(event) => setPrinter(event.target.value)} style={{ ...field, flex: 1 }}>
                  {builtInPrinters.length === 0 && printers.length === 0 && !configuredPrinterLabel && <option value="">{L('（未检测到打印机）')}</option>}
                  {/* 真机 probe-21（装两台后）：内置驱动打印机与系统打印机**合成一个列表按名称升序**排列，
                      不是「已安装的排在前面」。 */}
                  {mergedPrinterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <button type="button" data-testid="new-label-printer-settings" onClick={() => onPrinterSettings?.()} style={{ ...button, whiteSpace: 'nowrap' }}><LText text="打印机设置"/></button>
              </div>
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
                <button type="button" data-testid="new-label-format-picker" onClick={() => setPickerOpen(true)} style={{ ...highlightedButton, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  <LText text="查询常见品牌规格..."/>
                </button>
              </div>
            </label>
            {/* 参数：按「标签 / 行列 / 间距」三栏分组（与标签格式设置一致），选中类型时带出默认值，可直接改；
                卷筒/条幅会按宽高×行列自动算纸面 */}
            <div data-testid="new-label-params" style={{ display: 'grid', gridTemplateColumns: '1fr 0.9fr 1fr', gap: 16, marginTop: 8 }}>
              <fieldset style={paramGroup}>
                <legend style={paramLegend}><LText text="标签"/></legend>
                <div style={{ display: 'grid', gap: 10 }}>
                  {paramRow('new-label-param-width', L('宽度(W):'), draft.widthMm, (raw) => patchDraft({ widthMm: Math.max(1, Number(raw) || 1) }), { step: 0.1, unit: true })}
                  {paramRow('new-label-param-height', L('高度(H):'), draft.heightMm, (raw) => patchDraft({ heightMm: Math.max(1, Number(raw) || 1) }), { step: 0.1, unit: true })}
                  {mediaType === 1 && paramRow('new-label-param-pages', L('每盒页数'), draft.pagesPerBox ?? 0, (raw) => patchDraft({ pagesPerBox: Math.max(0, Math.floor(Number(raw) || 0)) }), { min: 0 })}
                </div>
              </fieldset>
              <fieldset style={paramGroup}>
                <legend style={paramLegend}><LText text="行列"/></legend>
                <div style={{ display: 'grid', gap: 10 }}>
                  {mediaType === 2 && (
                    // 条幅的排列方式并进「行列」：水平 = 多条并排（列），垂直 = 多条堆叠（行）
                    <label style={{ display: 'block', fontSize: 13 }}>
                      <LText text="排列方式"/>
                      <select
                        data-testid="new-label-banner-axis"
                        value={bannerAxis}
                        onChange={(event) => {
                          const next = event.target.value as 'horizontal' | 'vertical'
                          const count = Math.max(1, next === 'vertical' ? draft.cols : draft.rows)
                          setBannerAxis(next)
                          patchDraft(next === 'horizontal' ? { cols: count, rows: 1 } : { cols: 1, rows: count })
                        }}
                        style={{ ...field, marginTop: 3 }}
                      >
                        <option value="horizontal">{L('水平排列（多条并排）')}</option>
                        <option value="vertical">{L('垂直排列（多条堆叠）')}</option>
                      </select>
                    </label>
                  )}
                  {mediaType === 2 ? (
                    paramRow('new-label-param-copies', L('条数'), bannerAxis === 'horizontal' ? draft.cols : draft.rows, (raw) => {
                      const count = Math.max(1, Math.min(100, Math.floor(Number(raw) || 1)))
                      patchDraft(bannerAxis === 'horizontal' ? { cols: count, rows: 1 } : { cols: 1, rows: count })
                    }, { max: 100 })
                  ) : (
                    <>
                      {paramRow('new-label-param-cols', L('列数(C):'), draft.cols, (raw) => patchDraft({ cols: Math.max(1, Math.min(100, Math.floor(Number(raw) || 1))) }), { max: 100 })}
                      {paramRow('new-label-param-rows', L('行数(R):'), draft.rows, (raw) => patchDraft({ rows: Math.max(1, Math.min(100, Math.floor(Number(raw) || 1))) }), { max: 100 })}
                    </>
                  )}
                </div>
              </fieldset>
              <fieldset style={paramGroup}>
                <legend style={paramLegend}><LText text="间距"/></legend>
                <div style={{ display: 'grid', gap: 10 }}>
                  {paramRow('new-label-param-col-gap', L('列距(P):'), draft.colGapMm, (raw) => patchDraft({ colGapMm: Math.max(0, Number(raw) || 0) }), { min: 0, step: 0.1, unit: true })}
                  {paramRow('new-label-param-row-gap', L('行距(L):'), draft.rowGapMm, (raw) => patchDraft({ rowGapMm: Math.max(0, Number(raw) || 0) }), { min: 0, step: 0.1, unit: true })}
                </div>
              </fieldset>
            </div>

            {/* 形状 / 孔洞：与「标签格式设置」同一套选项与语义 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginTop: 12 }}>
              <fieldset style={paramGroup}>
                <legend style={paramLegend}><LText text="形状"/></legend>
                <select data-testid="new-label-shape" aria-label={L('形状')} value={draft.shape} onChange={(event) => patchDraft({ shape: event.target.value as PaperShape })} style={{ ...field, width: '100%' }}>
                  {PAPER_SHAPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{L(option.label)}</option>)}
                </select>
              </fieldset>
              <fieldset style={paramGroup}>
                <legend style={paramLegend}><LText text="孔洞"/></legend>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <select data-testid="new-label-hole" aria-label={L('孔洞')} value={draft.hole} onChange={(event) => patchDraft({ hole: event.target.value as PaperHoleSelection })} style={{ ...field, width: 150 }}>
                    {PAPER_HOLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{L(option.label)}</option>)}
                  </select>
                  <input
                    data-testid="new-label-hole-size"
                    type="number"
                    min={0}
                    step={0.1}
                    max={maxHoleSizeMm(draft.widthMm, draft.heightMm)}
                    disabled={draft.hole === 'none'}
                    value={draft.holeSizeMm}
                    onChange={(event) => patchDraft({ holeSizeMm: Math.max(0, Number(event.target.value) || 0) })}
                    style={{ ...field, width: 86 }}
                  />
                  <span style={{ color: draft.hole === 'none' ? '#999' : '#111' }}>{L('毫米')}</span>
                </div>
              </fieldset>
            </div>

            {/* 页面属性单独一行：纸张尺寸、左空/上空、纸张颜色；默认收起，点标题展开 */}
            <div data-testid="new-label-page-group" style={{ marginTop: 12, border: '1px solid #D5D5D5', borderRadius: 2, overflow: 'hidden', background: '#F5F5F5' }}>
              <button
                type="button"
                data-testid="new-label-page-toggle"
                aria-expanded={pageExpanded}
                onClick={() => setPageExpanded((open) => !open)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, width: '100%', boxSizing: 'border-box',
                  padding: '8px 12px', border: 0, background: pageExpanded ? '#ECECEC' : '#F0F0F0',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#111', textAlign: 'left'
                }}
              >
                <span aria-hidden="true" style={{ display: 'inline-block', width: 10, fontSize: 9, color: '#555', transition: 'transform 120ms', transform: pageExpanded ? 'rotate(90deg)' : 'none' }}>▶</span>
                <LText text="页面设置"/>
              </button>
              {pageExpanded && (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, fontSize: 13, padding: '12px 12px 10px', borderTop: '1px solid #D5D5D5' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                    <span style={{ minWidth: 36 }}>{L('尺寸')}</span>
                    <input data-testid="new-label-page-width" type="number" min={1} step={0.1} value={draft.pageWidthMm} onChange={(event) => patchDraft({ pageWidthMm: Math.max(1, Number(event.target.value) || 1) })} style={{ ...field, width: 96 }} />
                    <span>{L('毫米')}</span>
                    <span>×</span>
                    <input data-testid="new-label-page-height" type="number" min={1} step={0.1} value={draft.pageHeightMm} onChange={(event) => patchDraft({ pageHeightMm: Math.max(1, Number(event.target.value) || 1) })} style={{ ...field, width: 96 }} />
                    <span>{L('毫米')}</span>
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                    <span>{L('左空')}</span>
                    <input data-testid="new-label-page-left" type="number" step={0.1} value={draft.pageLeftMm} onChange={(event) => patchDraft({ pageLeftMm: Number(event.target.value) || 0 })} style={{ ...field, width: 86 }} />
                    <span>{L('毫米')}</span>
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                    <span>{L('上空')}</span>
                    <input data-testid="new-label-page-top" type="number" step={0.1} value={draft.pageTopMm} onChange={(event) => patchDraft({ pageTopMm: Number(event.target.value) || 0 })} style={{ ...field, width: 86 }} />
                    <span>{L('毫米')}</span>
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                    <span>{L('纸张颜色')}</span>
                    <input
                      data-testid="new-label-page-color"
                      aria-label={L('纸张颜色')}
                      type="color"
                      value={draft.labelColor}
                      onChange={(event) => patchDraft({ labelColor: event.target.value })}
                      style={{ width: 42, height: 26, padding: 0, border: '1px solid #BDBDBD', background: '#fff' }}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
          <div data-testid="new-label-current-format" style={{ marginTop: 8, fontSize: 12.5, color: '#666' }}>
            {mode === 'edit' && !formatPicked
              ? `当前标签：${draft.widthMm}×${draft.heightMm}mm ${draft.cols}列×${draft.rows}行`
              : `当前规格：${selected.brandName} · ${selected.categoryName} · ${draft.widthMm}×${draft.heightMm}mm ${bannerAxis === 'vertical' && mediaType === 2 ? `${draft.rows}行` : `${draft.cols}列×${draft.rows}行`}`}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, padding: '2px 18px 18px' }}>
          <button type="button" data-testid="new-label-select" accessKey="o" data-access-suffix="(O)" className="legacy-access-key" autoFocus onClick={confirm} disabled={confirming} style={{ ...primaryButton, opacity: confirming ? 0.7 : 1, cursor: confirming ? 'wait' : 'pointer' }}><LText text="选择"/></button>
        </div>
      </div>
      {pickerOpen && (
        <FormatPickerDialog
          formats={availableFormats}
          onPick={chooseFormat}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
