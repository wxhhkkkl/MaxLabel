import { useEffect, useRef, useState } from 'react'
import type { ColorChangeConfig } from '../types'
import { COLOR_CHANGE_MODES, COLOR_GRANULARITY_LABELS, DEFAULT_COLOR_INDEX_TABLE, colorGranularityOptions } from '../types'
import type { LabelObject, TextObj, BarcodeObj, RfidObj, RectObj, EllipseObj, LineObj, TableObj, ImageObj, Substr, LengthLimit, BarcodeOptions } from '../types'
import Modal, { FormField, selStyle } from './Modal'
import { displayMfcCaption } from '../../../shared/mfcCaption'
import { FONTS, PT_TO_MM } from '../editor/FormatBar'

/** 真机「文字属性 → 字体」页「大小(&P)」下拉的 31 项（round-57 用 Probe-LabelShopCombos
 *  逐项读回）：前 16 项是磅值，后面是中文号数；选项 value 仍用磅值，避免影响既有断言。 */
const FONT_SIZE_OPTIONS: Array<{ label: string; value: string }> = [
  ...[8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72].map((size) => ({ label: String(size), value: String(size) })),
  ...([
    ['初号', 42], ['小初', 36], ['一号', 26], ['小一', 24], ['二号', 22], ['小二', 18], ['三号', 16], ['小三', 15],
    ['四号', 14], ['小四', 12], ['五号', 10.5], ['小五', 9], ['六号', 8], ['小六', 7], ['七号', 5]
  ] as Array<[string, number]>).map(([name, size]) => ({ label: `${name}(${size})`, value: String(size) }))
]

/** EAN/UPC 族：真机上这些码制的「供人识读字符 · 位置」只有 3 项（默认/无/条码下方）。 */
const EAN_UPC_SYMBOLOGIES = ['ean13', 'ean8', 'upca', 'upce']
import { BARCODE_TYPES, W2N_SYMBOLOGIES } from '../editor/barcodeTypes'
import { BARCODE_CHARSETS, usesTwentyFiveOptions } from '../../../shared/domain/barcodeCharset'
import {
  BARCODE_AUTO_LABEL,
  PDF417_COLUMN_OPTIONS,
  PDF417_ROW_OPTIONS,
  X_SIZE_MIL_OPTION_LABELS,
  xSizeMilFromOptionLabel,
  xSizeMilOptionLabel
} from './barcodeSizeFields'
import { VARIABLE_COLOR_JUDGE_NOTE, VARIABLE_COLOR_UNSUPPORTED_NOTE } from '../../../shared/print/capabilities'
import DataSourceEditor from './DataSourceEditor'
import { propertyTabsFor, type PropertyTabKey } from '../features/object-properties/propertyTabs'
import { useObjectGeometryDraft } from '../features/object-properties/useObjectGeometryDraft'
import BarcodeDataFields from '../features/object-properties/BarcodeDataFields'
import { detectMonochrome, validateImageDataUrl } from '../print/imageValidation'
import { IMAGE_FILE_FILTERS } from '../types'

interface Props {
  obj: LabelObject
  datasets: Record<string, import('../types').Dataset>
  connections?: Record<string, import('../types').DbConnectionConfig>
  allowMultipleDatabaseConnections?: boolean
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
  /** 当前打印机是否支持可变颜色打印（帮助 getstart_color.html 的自动判定结果） */
  printerSupportsColor?: boolean
  /** 文档里已用过的共享变量名（真机「变量共享名称」是可编辑组合框，可从已有名里选） */
  docSharedNames?: string[]
  /** 底排「帮助」按钮（真机底排 = 确定 / 取消 / 应用(&A)[隐藏] / 帮助，probe-44-two-objects-tree.txt）。 */
  onHelp?: () => void
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

/**
 * 「条码」页的三个分组框样式与真机 `probe-60-barcode-props-tree.txt` 的 group box 行一一对应
 * （`尺寸`(928,521) / `条码特殊选项`(928,665) / `供人识读字符`(928,821)，三者同为 704 宽、无边框标题）。
 */
const BARCODE_GROUP_STYLE: React.CSSProperties = {
  border: '1px solid #D5D4CD',
  borderRadius: 6,
  padding: '10px 12px 12px',
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 12
}
const BARCODE_LEGEND_STYLE: React.CSSProperties = { fontSize: 12.5, color: '#1A1B1C', padding: '0 4px' }

/** 「常规」页带单位的数值行（真机 dump 里 `毫米` 是 Edit 右侧的独立 Static，如 probe-44 的 (1195,491)）。 */
const UNIT_ROW_STYLE: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 }
const UNIT_TEXT_STYLE: React.CSSProperties = { fontSize: 12, color: '#4B5563' }
/** 「常规·其它」组里的复选框行（真机是 Button 型复选框，如 `位置锁定(&L)` / `不打印输出(&N)`）。 */
const CHECK_ROW_STYLE: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }

/**
 * 真机「文字属性 → 文本」页 `类型` 组里的三个单选按钮
 * （`parity/reference/labelshop/probe-r201-textprops-text-tree.txt`：`Button 单行(&S)` / `多行(&M)` / `圆形(&C)`，
 * 三个都是 121×30 的 Button，x 依次为 1025 / 1223 / 1421 —— 同一行、等距，即一组**单选**）。
 * 标题原文带 MFC 加速键标记，渲染一律经 `displayMfcCaption`（DIFF-83）。
 */
const TEXT_KIND_OPTIONS = [
  { value: 'single' as const, caption: displayMfcCaption('单行(&S)'), accel: 's' as const },
  { value: 'multi' as const, caption: displayMfcCaption('多行(&M)'), accel: 'm' as const },
  { value: 'circle' as const, caption: displayMfcCaption('圆形(&C)'), accel: 'c' as const }
]

function randomHex8(): string {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()
}

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

function resizedTableAxis(values: number[] | undefined, oldCount: number, nextCount: number, keepSize: boolean): number[] | undefined {
  if (!values || values.length !== oldCount) return undefined
  if (!keepSize) return undefined
  const average = values.reduce((sum, value) => sum + Math.max(0.01, value), 0) / Math.max(1, oldCount)
  return Array.from({ length: nextCount }, (_, index) => Math.max(0.01, values[index] ?? average))
}

const NAMED_COLORS: Record<string, string> = {
  black: '#000000', white: '#FFFFFF', red: '#FF0000', green: '#008000', blue: '#0000FF',
  yellow: '#FFFF00', cyan: '#00FFFF', magenta: '#FF00FF', gray: '#808080', grey: '#808080',
  orange: '#FFA500', purple: '#800080', brown: '#A52A2A', lime: '#00FF00', navy: '#000080'
}

function colorDetails(value: string): { rgb: string; hex: string | null } {
  const raw = value.trim()
  const named = NAMED_COLORS[raw.toLowerCase()]
  const hex = named ?? (/^#[0-9a-f]{6}$/i.test(raw) ? raw.toUpperCase() : null)
  if (!hex) return { rgb: '—', hex: null }
  const digits = hex.slice(1)
  const channels = [0, 2, 4].map((offset) => parseInt(digits.slice(offset, offset + 2), 16))
  return { rgb: `rgb(${channels.join(', ')})`, hex }
}

function ColorIndexTableEditor({ values, onChange, testIdPrefix }: { values: string[]; onChange: (values: string[]) => void; testIdPrefix: string }) {
  const setAt = (index: number, value: string) => onChange(values.map((current, item) => item === index ? value : current))
  return (
    <div data-testid="color-index-table" style={{ border: '1px solid #D8D6CF', borderRadius: 6, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: '#F4F5F6', color: '#4B5563' }}>
            {['颜色索引', '颜色', 'RGB颜色值', '十六进制'].map((label) => <th key={label} style={{ padding: '7px 6px', borderBottom: '1px solid #D8D6CF', textAlign: 'left', fontWeight: 600 }}>{label}</th>)}
            <th style={{ padding: '7px 6px', borderBottom: '1px solid #D8D6CF', width: 48 }} />
          </tr>
        </thead>
        <tbody>
          {values.length === 0 && <tr><td colSpan={5} style={{ padding: 10, color: '#9AA0A6', textAlign: 'center' }}>暂无颜色索引，请添加颜色</td></tr>}
          {values.map((value, index) => {
            const details = colorDetails(value)
            return (
              <tr key={`${testIdPrefix}-${index}`} data-testid={`${testIdPrefix}-row-${index}`}>
                <td style={{ padding: '5px 6px', borderBottom: '1px solid #ECEBE6', color: '#6B7280' }}>{index + 1}</td>
                <td style={{ padding: '5px 6px', borderBottom: '1px solid #ECEBE6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span aria-hidden="true" style={{ width: 18, height: 18, border: '1px solid #9AA0A6', borderRadius: 3, background: details.hex ?? value }} />
                    <input data-testid={`${testIdPrefix}-value-${index}`} value={value} onChange={(event) => setAt(index, event.target.value)} placeholder="#RRGGBB 或 red" style={{ ...numStyle, width: 125, padding: '4px 6px', fontSize: 12 }} />
                    <input aria-label={`颜色索引${index + 1}取色`} type="color" value={details.hex ?? '#000000'} onChange={(event) => setAt(index, event.target.value.toUpperCase())} style={{ width: 28, height: 24, padding: 0, border: 'none' }} />
                  </div>
                </td>
                <td style={{ padding: '5px 6px', borderBottom: '1px solid #ECEBE6', color: '#4B5563' }}>{details.rgb}</td>
                <td style={{ padding: '5px 6px', borderBottom: '1px solid #ECEBE6', color: '#4B5563', fontFamily: 'Consolas, monospace' }}>{details.hex ?? '—'}</td>
                <td style={{ padding: '5px 6px', borderBottom: '1px solid #ECEBE6' }}><button type="button" data-testid={`${testIdPrefix}-remove-${index}`} onClick={() => onChange(values.filter((_, item) => item !== index))} style={{ border: 'none', background: 'none', color: '#B42318', cursor: 'pointer', fontSize: 12 }}>删除</button></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ padding: '7px 8px', borderTop: '1px solid #ECEBE6', background: '#FAFAF8' }}>
        <button type="button" data-testid={`${testIdPrefix}-add`} onClick={() => onChange([...values, '#000000'])} style={{ padding: '4px 10px', border: '1px solid #C8C6BF', borderRadius: 5, background: '#fff', cursor: 'pointer', fontSize: 12 }}>添加颜色</button>
      </div>
      {/* 帮助 color_main.html：颜色索引表包括十个预先定义的颜色，分别对应索引 0 到 9 */}
      <div data-testid={`${testIdPrefix}-predefined`} style={{ padding: '7px 8px', borderTop: '1px solid #ECEBE6' }}>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 5 }}>预定义颜色（索引 0–9，未添加自定义颜色时按此表取色）</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
          {DEFAULT_COLOR_INDEX_TABLE.map((color, index) => (
            <span key={color} data-testid={`${testIdPrefix}-predefined-row-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#4B5563' }}>
              <span aria-hidden="true" style={{ width: 14, height: 14, border: '1px solid #9AA0A6', borderRadius: 3, background: color }} />
              {index} {color}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function resizeTableRows(table: TableObj, rows: number): Partial<TableObj> {
  return {
    rows,
    rowHeights: resizedTableAxis(table.rowHeights, table.rows, rows, table.keepSize === true),
    merges: (table.merges ?? []).filter((merge) => merge.r < rows && merge.r2 < rows)
  }
}

function resizeTableCols(table: TableObj, cols: number): Partial<TableObj> {
  return {
    cols,
    colWidths: resizedTableAxis(table.colWidths, table.cols, cols, table.keepSize === true),
    merges: (table.merges ?? []).filter((merge) => merge.c < cols && merge.c2 < cols)
  }
}

/** 对象属性对话框（双击对象 / 右键"属性" / Alt+Enter）：按对象类型细分页签 */
export default function ObjectPropsDialog({ obj: initialObj, datasets, connections, allowMultipleDatabaseConnections, onPatch: applyPatch, onClose, initialTab, colorIndexTable, onPatchDoc: applyDocPatch, labelWidthMm, labelHeightMm, printerSupportsColor = true, docSharedNames = [], onHelp }: Props) {
  // Property editing is transactional. The old dialog wrote most fields to
  // the document on every keystroke, so “取消” only rolled back geometry.
  // Keep a local draft and commit it once, preserving the LabelShop dialog
  // workflow while making cancel reliable for every tab.
  const draftRef = useRef<LabelObject>(initialObj)
  const [obj, setObj] = useState<LabelObject>(initialObj)
  const [colorIndexDraft, setColorIndexDraft] = useState<string[]>(colorIndexTable ?? [])
  const onPatch = (patch: Partial<LabelObject>) => {
    const next = { ...draftRef.current, ...patch } as LabelObject
    draftRef.current = next
    setObj(next)
  }
  const type = obj.type
  const tabs = propertyTabsFor(type)

  const legacyTab = initialTab === 'appearance'
    ? (type === 'text' ? 'font' : type === 'barcode' ? 'barcode' : type === 'image' ? 'image' : type === 'table' ? 'table' : 'shape')
    : (type === 'barcode' && initialTab === 'text' ? 'font' : initialTab)
  const startKey = (legacyTab && tabs.some((t) => t.key === legacyTab) ? legacyTab : tabs[0].key) as PropertyTabKey
  const [tab, setTab] = useState<PropertyTabKey>(startKey)
  const { x, setX, y, setY, w, setW, h, setH, rotation: rot, setRotation: setRot, commit: commitGeom } = useObjectGeometryDraft(obj, onPatch)
  const [mergeR, setMergeR] = useState(0)
  const [mergeC, setMergeC] = useState(0)
  const [mergeR2, setMergeR2] = useState(0)
  const [mergeC2, setMergeC2] = useState(0)
  const [mergeMsg, setMergeMsg] = useState('')
  const [imageMsg, setImageMsg] = useState('')
  /** 「字体」页的 `颜色(&C)...` 按钮（真机是 Button，点开系统取色器）——隐藏的 color 输入由它触发。 */
  const fontColorRef = useRef<HTMLInputElement | null>(null)
  /** 浏览图片对话框的「预览图片」勾选（帮助 label_object_create_drag.html），默认勾选 */
  const [imagePreview, setImagePreview] = useState(true)
  // 帮助 color_main.html：图片只有单色的黑白图片支持可变颜色——对嵌入/链接图片做真实像素判定。
  const [imageMono, setImageMono] = useState<'mono' | 'color' | 'unknown' | null>(null)
  useEffect(() => {
    if (obj.type !== 'image') { setImageMono(null); return }
    const img = obj as ImageObj
    const kind = img.imgType ?? 'embed'
    // 数据源图片的内容在打印时才确定，按 LabelShop 的单色位图语义放行（见 imageColorAllowed）。
    if (kind === 'datasource') { setImageMono(null); return }
    let cancelled = false
    const run = async () => {
      let src = img.src ?? ''
      if (kind === 'link' && img.linkPath) {
        try {
          const r = await window.maxlabel.readImage(img.linkPath)
          if (r.ok && r.dataUrl) src = r.dataUrl
        } catch { /* 读不到就按 unknown 处理 */ }
      }
      const result = src ? await detectMonochrome(src) : 'unknown'
      if (!cancelled) setImageMono(result)
    }
    void run()
    return () => { cancelled = true }
  }, [obj])
  /** 表格逐行行高/逐列列宽（帮助 label_object_page_form.html），空数组表示均分 */
  const tableRowHeights = (obj.type === 'table' ? (obj as TableObj).rowHeights : undefined) ?? []
  const tableColWidths = (obj.type === 'table' ? (obj as TableObj).colWidths : undefined) ?? []

  const commit = () => {
    applyPatch(draftRef.current)
    if (applyDocPatch && JSON.stringify(colorIndexDraft) !== JSON.stringify(colorIndexTable ?? [])) {
      applyDocPatch({ colorIndexTable: colorIndexDraft })
    }
    onClose()
  }

  const textObj = type === 'text' ? (obj as TextObj) : null
  /** 「字体」页底部「示例」组显示的文本：取当前对象的常量内容（没有则留空由调用处给占位） */
  const textObjPreviewContent = textObj?.source?.kind === 'constant' ? String(textObj.source.value ?? '').slice(0, 40) : ''
  /** 真机「文本」页 `类型` 组当前选中的单选（默认单行 —— 与真机 dump 的现场态一致） */
  const textKind = (textObj as { textType?: 'single' | 'multi' | 'circle' } | null)?.textType ?? 'single'
  const barcodeObj = type === 'barcode' ? (obj as BarcodeObj) : null
  const rfidObj = type === 'rfid' ? (obj as RfidObj) : null
  const rectObj = type === 'rect' ? (obj as RectObj) : null
  const ellipseObj = type === 'ellipse' ? (obj as EllipseObj) : null
  const lineObj = type === 'line' ? (obj as LineObj) : null
  const tableObj = type === 'table' ? (obj as TableObj) : null
  const shapeObj = rectObj ?? ellipseObj
  const shapeValue = rectObj?.shape ?? (ellipseObj ? 'ellipse' : 'rect')
  const rfidAccess = rfidObj?.accessControl ?? { epc: 'none', user: 'none', tid: 'none', accessPassword: 'none', killPassword: 'none' }
  const patchRfidAccess = (key: keyof typeof rfidAccess, value: 'none' | 'lock' | 'unlock') => {
    if (!rfidObj) return
    const accessControl = { ...rfidAccess, [key]: value }
    onPatch({ accessControl, lock: accessControl.epc !== 'none', lockOp: accessControl.epc === 'none' ? undefined : accessControl.epc } as never)
  }
  const source = (obj as { source?: import('../types').DataSource }).source
  const cc = (obj as { colorChange?: ColorChangeConfig }).colorChange
  const patchCc = (p: Partial<ColorChangeConfig>) => {
    onPatch({ colorChange: { mode: 'fixed', tableSource: 'private', privateTable: [], changeMode: 'solid', blockRows: 1, blockCols: 1, variableName: '', inputValue: '', ...cc, ...p } } as never)
  }
  const imageObj = type === 'image' ? (obj as ImageObj) : null
  // 帮助 color_main.html：直线/矩形/图片仅整体变色；文字整体或逐字符；条码整体/区块/渐变
  const colorGranularities = colorGranularityOptions(type)
  // 帮助 getstart_color.html：签赋LabelShop 会根据打印机自动判断是否支持可变颜色打印，
  // 普通条码标签打印机（指令集直接驱动）无法选择彩色打印，此时不提供「变色设置」。
  const colorChangeEnabled = colorGranularities.length > 0 && printerSupportsColor
  const colorPrinterBlocked = colorGranularities.length > 0 && !printerSupportsColor
  // 帮助 label_object_page_general.html：位置锁定后「使用常规属性页时位置选项被禁止无法更改其数值」。
  const positionLocked = obj.locked === true
  /** 真机 round-57：条码属性「水平(W)/垂直(T)」有 3 项（左齐/居中/右齐、顶部/居中/底部），
   *  文字属性则是空且禁用；矩形等几何对象未取证，先按「跟着真机已确认的两类走」处理。 */
  const alignOptionsAvailable = obj.type !== 'text'
  // 帮助 color_main.html：图片只有单色的黑白图片支持可变颜色。
  // 数据源图片运行期才确定内容（LabelShop 中按单色位图处理）→ 沿用放行策略；
  // 嵌入/链接图片按 detectMonochrome 的真实像素判定结果决定是否允许。
  const imageColorAllowed = type !== 'image' || imageObj?.imgType === 'datasource' || imageMono === 'mono'
  const ccMode: ColorChangeConfig['mode'] = cc?.mode ?? 'fixed'
  // 需要索引表的模式（随机 / 内容索引 / 索引变量 / 颜色索引）
  const ccNeedsTable = ccMode === 'random' || ccMode === 'indexByContent' || ccMode === 'indexVar' || ccMode === 'index'
  const ccNeedsInput = ccMode === 'index' || ccMode === 'rgb'
  const ccNeedsVariable = ccMode === 'indexVar' || ccMode === 'valueVar'

  return (
    <Modal
      title={`对象属性 - ${OBJ_LABEL[type] ?? type}`}
      onClose={onClose}
      width={560}
      testId="object-props-dialog"
      footer={
        <>
          {/* 底排按真机点位顺序（左→右）`确定` / `取消` / `应用(&A)`(隐藏且 DISABLED) / `帮助`
              —— 见 parity/reference/labelshop/probe-44-two-objects-tree.txt 的四条按钮行。
              「应用」真机是**不可见**控件（行首 `[ ]`），所以这里也不渲染可见按钮（照 DIFF-71 口径）。 */}
          <button
            type="button"
            data-testid="object-props-ok"
            accessKey="o"
            data-access-suffix="(O)"
            onClick={() => {
              commitGeom()
              commit()
            }}
            style={{ padding: '7px 20px', borderRadius: 6, border: 'none', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
          >
            确定
          </button>
          <button type="button" data-testid="object-props-cancel" accessKey="c" data-access-suffix="(C)" onClick={onClose} style={{ padding: '7px 18px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            取消
          </button>
          <button type="button" data-testid="object-props-help" accessKey="h" data-access-suffix="(H)" onClick={onHelp} disabled={!onHelp} style={{ padding: '7px 18px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', cursor: onHelp ? 'pointer' : 'default', color: onHelp ? '#1A1B1C' : '#B0AFA9', fontSize: 13, fontFamily: 'inherit' }}>
            帮助
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #ECEBE6', marginBottom: 14, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button key={t.key} type="button" data-testid={`object-props-tab-${t.key}`} data-tab-key={t.key} style={TAB(tab === t.key)} onClick={() => setTab(t.key)}>
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
              connections={connections}
              allowMultipleDatabaseConnections={allowMultipleDatabaseConnections}
              onChange={(s) => onPatch({ source: s } as never)}
              subSources={(obj as { subSources?: import("../types").DataSource[] }).subSources}
              onSubSources={(list) => onPatch({ subSources: list } as never)}
              sharedNames={docSharedNames}
            />
          ) : (
            <div style={{ fontSize: 12.5, color: '#6B7280', padding: '8px 0' }}>该对象类型没有文本数据源。</div>
          )}
        </div>
      )}

      {tab === 'datasource' && barcodeObj && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14, paddingTop: 12, borderTop: '1px solid #E4E3DD' }}>
          <BarcodeDataFields obj={barcodeObj} onPatch={onPatch} />
        </div>
      )}

      {(tab === 'font' || tab === 'text' || tab === 'shape' || tab === 'barcode' || tab === 'image') && (
        <div style={{ maxHeight: 360, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {textObj && (
            <>
              {tab === 'font' && <>
              {/* 真机「文字属性 → 字体」页（`parity/reference/labelshop/probe-r201-textprops-font-tree.txt`）：
                  首行三个字段 `字体名称(&T):` / `字体样式(&Y):` / `大小(&P):`（三者都是 ComboBox，不是数字框）；
                  其下两个组框 Button：
                    `特殊效果`（696×144）＝ 左列三个**复选框** `删除线(&S)`/`下划线(&U)`/`黑底白字(&W)`，
                      右列 `字体宽度方向缩放倍数(&H):`＋Edit＋Spin、`颜色(&C)...` 按钮、`字间距(&J):`＋Edit＋`毫米`；
                    `示例`（696×156）＝ `显示示例` 预览区 + `这是TRUETYPE字体，显示与打印完全相同!`。
                  文案一律经 `displayMfcCaption` 渲染（DIFF-83：屏幕不显示 `&`）。 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <FormField label="字体名称(&T):">
                  <select data-testid="object-props-font-family" accessKey="t" data-access-suffix="(T)" value={textObj.fontFamily} onChange={(e) => onPatch({ fontFamily: e.target.value })} style={selStyle}>
                    {FONTS.map((f: string) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="字体样式(&Y):">
                  <select
                    data-testid="text-font-style"
                    accessKey="y"
                    data-access-suffix="(Y)"
                    value={textObj.bold && textObj.italic ? 'boldItalic' : textObj.bold ? 'bold' : textObj.italic ? 'italic' : 'normal'}
                    onChange={(e) => onPatch({ bold: e.target.value === 'bold' || e.target.value === 'boldItalic', italic: e.target.value === 'italic' || e.target.value === 'boldItalic' })}
                    style={selStyle}
                  >
                    <option value="normal">正常体</option>
                    <option value="bold">粗体</option>
                    <option value="italic">斜体</option>
                    <option value="boldItalic">粗斜体</option>
                  </select>
                </FormField>
                <FormField label="大小(&P):" hint="选项与顺序同真机（31 项，含中文字号名）">
                  <select
                    data-testid="object-props-font-size"
                    accessKey="p"
                    data-access-suffix="(P)"
                    value={String(Math.round((textObj.fontSize / PT_TO_MM) * 10) / 10)}
                    onChange={(e) => onPatch({ fontSize: parseFloat(e.target.value) * PT_TO_MM })}
                    style={selStyle}
                  >
                    {FONT_SIZE_OPTIONS.map((option) => (
                      <option key={option.label} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
              <fieldset data-testid="font-group-effects" style={BARCODE_GROUP_STYLE}>
                <legend style={BARCODE_LEGEND_STYLE}>{displayMfcCaption('特殊效果')}</legend>
                <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <label style={CHECK_ROW_STYLE}>
                      <input type="checkbox" data-testid="text-font-strikeout" accessKey="s" data-access-suffix="(S)" checked={textObj.strikeout === true} onChange={(e) => onPatch({ strikeout: e.target.checked })} />
                      {displayMfcCaption('删除线(&S)')}
                    </label>
                    <label style={CHECK_ROW_STYLE}>
                      <input type="checkbox" data-testid="text-font-underline" accessKey="u" data-access-suffix="(U)" checked={textObj.underline === true} onChange={(e) => onPatch({ underline: e.target.checked })} />
                      {displayMfcCaption('下划线(&U)')}
                    </label>
                    <label style={CHECK_ROW_STYLE}>
                      <input type="checkbox" data-testid="text-font-reverse" accessKey="w" data-access-suffix="(W)" checked={textObj.reverse === true} onChange={(e) => onPatch({ reverse: e.target.checked })} />
                      {displayMfcCaption('黑底白字(&W)')}
                    </label>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <FormField label="字体宽度方向缩放倍数(&H):" hint="默认 1.00">
                      <input data-testid="text-font-width-scale" accessKey="h" data-access-suffix="(H)" type="number" min={0.1} max={10} step={0.01} value={textObj.fontWidthScale ?? 1} onChange={(e) => onPatch({ fontWidthScale: Math.max(0.1, Math.min(10, parseFloat(e.target.value) || 1)) })} style={numStyle} />
                    </FormField>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        data-testid="text-font-color"
                        accessKey="c"
                        data-access-suffix="(C)"
                        onClick={() => fontColorRef.current?.click()}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
                      >
                        {displayMfcCaption('颜色(&C)...')}
                        <span data-testid="text-font-color-swatch" style={{ width: 20, height: 20, border: '1px solid #8A8880', background: textObj.color }} />
                      </button>
                      <input ref={fontColorRef} data-testid="text-font-color-input" type="color" value={textObj.color} onChange={(e) => onPatch({ color: e.target.value })} style={{ width: 0, height: 0, padding: 0, border: 'none', opacity: 0, position: 'absolute' }} />
                    </div>
                    <FormField label="字间距(&J):">
                      <div style={UNIT_ROW_STYLE}>
                        <input data-testid="text-font-char-spacing" accessKey="j" data-access-suffix="(J)" type="number" min={0} max={100} step={0.1} value={textObj.charSpacing ?? 0} onChange={(e) => onPatch({ charSpacing: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })} style={numStyle} />
                        <span style={UNIT_TEXT_STYLE}>毫米</span>
                      </div>
                    </FormField>
                  </div>
                </div>
              </fieldset>
              <fieldset data-testid="font-group-sample" style={BARCODE_GROUP_STYLE}>
                <legend style={BARCODE_LEGEND_STYLE}>{displayMfcCaption('示例')}</legend>
                <div data-testid="text-font-preview" style={{ border: '1px solid #D8D6CF', borderRadius: 6, padding: '10px 12px', background: '#FCFCFA' }}>
                  <div data-testid="text-font-sample-label" style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>{displayMfcCaption('显示示例')}</div>
                  <div
                    style={{
                      fontFamily: textObj.fontFamily,
                      fontSize: Math.max(10, Math.min(34, (textObj.fontSize / PT_TO_MM) * 1.333)),
                      fontWeight: textObj.bold ? 700 : 400,
                      fontStyle: textObj.italic ? 'italic' : 'normal',
                      textDecoration: [textObj.underline ? 'underline' : '', textObj.strikeout ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
                      color: textObj.reverse ? '#ffffff' : textObj.color,
                      background: textObj.reverse ? '#000000' : ((textObj as { backgroundColor?: string }).backgroundColor ?? 'transparent'),
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
                    }}
                  >
                    {textObjPreviewContent || '1234567890 Abc 标签'}
                  </div>
                </div>
                <div data-testid="text-font-truetype-note" style={{ fontSize: 11.5, color: '#6B7280', marginTop: 8 }}>这是TRUETYPE字体，显示与打印完全相同!</div>
              </fieldset>
              {/* 真机「字体」页 dump 里**没有**下面两项 —— 复刻版为了不静默删功能集中在扩展区并标注（口径同「文本」页）。 */}
              <fieldset data-testid="font-extensions" style={{ border: '1px dashed #C8C6BF', borderRadius: 6, padding: '10px 12px 12px', margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <legend style={{ fontSize: 12, color: '#6B7280', padding: '0 4px' }}>复刻版扩展（原版「字体」页中无此项）</legend>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FormField label="打印机内建字体" hint="TSPL: Font0-Font8；ZPL: A-Z / 0。仅指令打印时生效，缺省 = 按字号缩放的内建字体">
                    <select data-testid="text-font-printer-font" value={(textObj as { printerFont?: string }).printerFont ?? ''} onChange={(e) => onPatch({ printerFont: e.target.value || undefined } as never)} style={selStyle}>
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
                  <FormField label="背景" hint="真机「字体」页无此项；对象底色，供反白/贴底打印使用">
                    <input data-testid="text-font-background" type="color" value={(textObj as { backgroundColor?: string }).backgroundColor ?? '#ffffff'} onChange={(e) => onPatch({ backgroundColor: e.target.value } as never)} style={{ width: 44, height: 28, border: '1px solid #C8C6BF', padding: 0, background: 'none' }} />
                  </FormField>
                </div>
              </fieldset>
              </>}
              {tab === 'text' && <>
              {/* 真机「文字属性 → 文本」页（`parity/reference/labelshop/probe-r201-textprops-text-tree.txt`）
                  是**两个分组框**：`类型`（704×102，内含 `单行(&S)` / `多行(&M)` / `圆形(&C)` **三个单选按钮**）
                  与 `属性`（704×378，内含 `水平对齐(&A):` 下拉 + `行宽度(&W):` ＋ `毫米` + `字符模板(&T):` 复选＋输入框）。
                  dump 的单行态里：`行宽度(&W):` 的 Static/Edit/`毫米` 与 `字符模板` 的 Edit 都是 **DISABLED**；
                  `文字停靠(&P)` / `角度(&E)` / `行距(&L)` / `弧度(&R)` / `字符剪裁(&C)` 行首是 `[ ]`＝该状态下**不显示**
                  （**按模式出现**，不是删掉）。 */}
              <fieldset data-testid="text-group-type" style={BARCODE_GROUP_STYLE}>
                <legend style={BARCODE_LEGEND_STYLE}>类型</legend>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  {TEXT_KIND_OPTIONS.map((o) => (
                    <label key={o.value} style={CHECK_ROW_STYLE}>
                      <input
                        type="radio"
                        name="text-kind"
                        data-testid={`text-type-${o.value}`}
                        accessKey={o.accel}
                        data-access-suffix={`(${o.accel.toUpperCase()})`}
                        checked={textKind === o.value}
                        onChange={() => onPatch({ textType: o.value, arc: o.value === 'circle' } as never)}
                      />
                      {o.caption}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset data-testid="text-group-props" style={BARCODE_GROUP_STYLE}>
                <legend style={BARCODE_LEGEND_STYLE}>属性</legend>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FormField label="水平对齐(&A):" hint="文本行的水平对齐方式（真机是 ComboBox）">
                    <select data-testid="text-align" accessKey="a" data-access-suffix="(A)" value={(textObj as { align?: string }).align ?? 'left'} onChange={(e) => onPatch({ align: e.target.value } as never)} style={selStyle}>
                      <option value="left">左对齐</option>
                      <option value="center">居中</option>
                      <option value="right">右对齐</option>
                      <option value="justify">撑满</option>
                    </select>
                  </FormField>
                  <FormField label="行宽度(&W):" hint="文本行的宽度值；多行文字以此值换行">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        data-testid="text-line-width"
                        accessKey="w"
                        data-access-suffix="(W)"
                        type="number"
                        min={0.1}
                        step={0.1}
                        disabled={textKind === 'single'}
                        value={(textObj as { lineWidth?: number }).lineWidth ?? textObj.w}
                        onChange={(e) => onPatch({ lineWidth: Math.max(0.1, parseFloat(e.target.value) || textObj.w) } as never)}
                        style={textKind === 'single' ? { ...numStyle, background: '#F0EFEA', color: '#B0AFA9' } : numStyle}
                      />
                      <span style={{ fontSize: 12, color: textKind === 'single' ? '#B0AFA9' : '#4B5563' }}>毫米</span>
                    </span>
                  </FormField>
                  {/* 真机 `字符模板(&T):` = Button(复选框) + 右侧 Edit（`probe-r201-textprops-text-tree.txt` (950,812) / (1135,809)）。
                      未勾选 ⇒ 不启用模板（`charTemplate` 置 undefined，`applyObjectFormat` 即不做替换）；勾选后才可编辑。 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={CHECK_ROW_STYLE}>
                      <input
                        type="checkbox"
                        data-testid="text-char-template-enabled"
                        accessKey="t"
                        data-access-suffix="(T)"
                        checked={(textObj as { charTemplate?: string }).charTemplate !== undefined}
                        onChange={(e) => onPatch({ charTemplate: e.target.checked ? ((textObj as { charTemplate?: string }).charTemplate ?? '') : undefined } as never)}
                      />
                      {displayMfcCaption('字符模板(&T):')}
                    </label>
                    <input
                      data-testid="text-char-template"
                      disabled={(textObj as { charTemplate?: string }).charTemplate === undefined}
                      value={(textObj as { charTemplate?: string }).charTemplate ?? ''}
                      onChange={(e) => onPatch({ charTemplate: e.target.value } as never)}
                      placeholder="(01)??????????"
                      style={{ ...fullStyle, flex: 1, minWidth: 0 }}
                    />
                  </div>
                  {textKind === 'multi' && (
                    <>
                      <FormField label="垂直对齐">
                        <select value={(textObj as { verticalAlign?: string }).verticalAlign ?? 'top'} onChange={(e) => onPatch({ verticalAlign: e.target.value } as never)} style={selStyle}>
                          <option value="top">顶部</option>
                          <option value="middle">中间</option>
                          <option value="bottom">底部</option>
                        </select>
                      </FormField>
                      <FormField label="文字停靠(&P)" hint="撑满时控制首尾未填充区域">
                        <select accessKey="p" data-access-suffix="(P)" value={textObj.textDock ?? 'both'} onChange={(e) => onPatch({ textDock: e.target.value as TextObj['textDock'] })} style={selStyle}>
                          <option value="both">两端</option>
                          <option value="left">左侧</option>
                          <option value="right">右侧</option>
                          <option value="center">居中</option>
                        </select>
                      </FormField>
                      <FormField label="行距(&L):" hint="文字的行间距">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input data-testid="text-line-spacing" accessKey="l" data-access-suffix="(L)" type="number" min={0} step={0.1} value={(textObj as { lineSpacingMm?: number }).lineSpacingMm ?? textObj.fontSize * 0.2} onChange={(e) => onPatch({ lineSpacingMm: Math.max(0, parseFloat(e.target.value) || 0) } as never)} style={numStyle} />
                          <span style={{ fontSize: 12, color: '#4B5563' }}>毫米</span>
                        </span>
                      </FormField>
                    </>
                  )}
                  {textKind === 'circle' && (
                    <>
                      <FormField label="弧度(&R):">
                        <input data-testid="text-arc-extent" accessKey="r" data-access-suffix="(R)" type="number" min={0} max={360} value={(textObj as { arcExtent?: number }).arcExtent ?? 180} onChange={(e) => onPatch({ arcExtent: Math.max(0, Math.min(360, parseInt(e.target.value || '0', 10))) } as never)} style={numStyle} />
                      </FormField>
                      <FormField label="角度(&E):">
                        <input data-testid="text-arc-angle" accessKey="e" data-access-suffix="(E)" type="number" min={0} max={360} value={(textObj as { arcAngle?: number }).arcAngle ?? 0} onChange={(e) => onPatch({ arcAngle: Math.max(0, Math.min(360, parseInt(e.target.value || '0', 10))) } as never)} style={numStyle} />
                      </FormField>
                      <FormField label="半径（毫米）" hint="0=自动">
                        <input data-testid="text-arc-radius" type="number" min={0} value={(textObj as { arcRadius?: number }).arcRadius ?? 0} onChange={(e) => onPatch({ arcRadius: Math.max(0, parseFloat(e.target.value) || 0) } as never)} style={numStyle} />
                      </FormField>
                      <FormField label="回绕方向">
                        <select data-testid="text-arc-direction" value={(textObj as { arcDir?: string }).arcDir ?? 'cw'} onChange={(e) => onPatch({ arcDir: e.target.value } as never)} style={selStyle}>
                          <option value="cw">顺时针</option>
                          <option value="ccw">逆时针</option>
                        </select>
                      </FormField>
                      <FormField label="文字方向">
                        <select data-testid="text-arc-text-direction" value={(textObj as { arcTextDir?: string }).arcTextDir ?? 'out'} onChange={(e) => onPatch({ arcTextDir: e.target.value } as never)} style={selStyle}>
                          <option value="out">向外</option>
                          <option value="in">向内</option>
                        </select>
                      </FormField>
                    </>
                  )}
                </div>
              </fieldset>
              </>}
            </>
          )}
          {(rectObj || ellipseObj) && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="填充色">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <select
                      data-testid="shape-fill-mode"
                      value={shapeObj?.fillEnabled === false ? 'none' : 'solid'}
                      onChange={(e) => onPatch({ fillEnabled: e.target.value === 'solid' } as never)}
                      style={{ ...selStyle, width: 54, flexShrink: 0 }}
                    >
                      <option value="solid">纯色</option>
                      <option value="none">无</option>
                    </select>
                    {shapeObj?.fillEnabled !== false && (
                      <input type="color" value={shapeObj?.fill ?? '#ffffff'} onChange={(e) => onPatch({ fill: e.target.value } as never)} style={{ width: 44, height: 30, border: 'none', padding: 0, background: 'none' }} />
                    )}
                  </span>
                </FormField>
                <FormField label="线条色">
                  <input type="color" value={shapeObj?.stroke ?? '#000000'} onChange={(e) => onPatch({ stroke: e.target.value } as never)} style={{ width: 44, height: 30, border: 'none', padding: 0, background: 'none' }} />
                </FormField>
              </div>
              <FormField label="线宽（mm）">
                <input type="number" step={0.1} min={0} value={shapeObj?.strokeWidth ?? 0.3} onChange={(e) => onPatch({ strokeWidth: parseFloat(e.target.value) || 0 })} style={numStyle} />
              </FormField>
              <FormField label="形状">
                <select
                  data-testid="shape-kind"
                  value={shapeValue}
                  onChange={(e) => {
                    const next = e.target.value as 'rect' | 'roundRect' | 'ellipse'
                    onPatch(rectObj ? { shape: next } as never : { type: 'rect', shape: next } as never)
                  }}
                  style={selStyle}
                >
                  <option value="rect">矩形</option>
                  <option value="roundRect">圆角矩形</option>
                  <option value="ellipse">椭圆</option>
                </select>
              </FormField>
              {shapeValue === 'roundRect' && (
                <FormField label="圆角半径（mm）">
                  <input data-testid="shape-corner-radius" type="number" min={0} max={Math.min(shapeObj?.w ?? 0, shapeObj?.h ?? 0) / 2} step={0.1} value={shapeObj?.cornerRadius ?? 0} onChange={(e) => onPatch({ cornerRadius: Math.max(0, parseFloat(e.target.value) || 0) } as never)} style={numStyle} />
                </FormField>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
                <input data-testid="shape-fill-enabled" type="checkbox" checked={shapeObj?.fillEnabled !== false} onChange={(e) => onPatch({ fillEnabled: e.target.checked } as never)} />
                填充方框内部
              </label>
            </>
          )}
          {lineObj && (
            <>
              <FormField label="线条色">
                <input type="color" value={lineObj.stroke} onChange={(e) => onPatch({ stroke: e.target.value } as never)} style={{ width: 44, height: 30, border: 'none', padding: 0, background: 'none' }} />
              </FormField>
              <FormField label="线宽（mm）">
                <input type="number" step={0.1} min={0} value={lineObj.strokeWidth} onChange={(e) => onPatch({ strokeWidth: parseFloat(e.target.value) || 0 })} style={numStyle} />
              </FormField>
              <FormField label="长度（mm）">
                <input data-testid="line-length" type="number" step={0.1} min={0.1} value={lineObj.w} onChange={(e) => onPatch({ w: Math.max(0.1, parseFloat(e.target.value) || lineObj.w) } as never)} style={numStyle} />
              </FormField>
            </>
          )}
          {barcodeObj && tab === 'barcode' && (
            <>
              {/* 字段原文与加速键照抄真机「条码属性 → 条码」页（probe-45-barcode-props-p3.txt 第一段）：
                  `条码符号类型(码制)(&B):` / `X 尺寸(&X):` / `码  高(&H):`（「码」与「高」之间两个空格） */}
              {<FormField label="条码符号类型(码制)(&B):">
                <select data-testid="barcode-symbology" value={barcodeObj.symbology} onChange={(e) => onPatch({ symbology: e.target.value })} style={selStyle}>
                  {BARCODE_TYPES.map((b) => (
                    <option key={b.bcid} value={b.bcid}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </FormField>}
              {tab === 'barcode' && (() => {
                const bo = (barcodeObj as { barcodeOptions?: BarcodeOptions }).barcodeOptions ?? {}
                const patchBo = (p: Partial<BarcodeOptions>) => onPatch({ barcodeOptions: { ...bo, ...p } } as never)
                return (
                  /* 真机「条码」页的三个分组框（`probe-60-barcode-props-tree.txt` 的 group box 行：
                     `尺寸` / `条码特殊选项` / `供人识读字符`），字段按真机归组。 */
                  <>
                  <fieldset data-testid="barcode-group-size" style={BARCODE_GROUP_STYLE}>
                    <legend style={BARCODE_LEGEND_STYLE}>尺寸</legend>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {/* 真机该控件是**下拉**：61 项 = 60 个 mil 档（步长 1/600 英寸，`1.67 mil`…`100.00 mil`）
                        + 末尾 `固定宽度`，默认第 6 项 `10.00 mil`（`probe-sym-pdf417-values.txt` /
                        `probe-sym-pdf417-combos.txt` combo[2]）。复刻版原先是自由数字框 → 按真机改成下拉。 */}
                    <FormField label="X 尺寸(&X):" hint="真机 61 项下拉：1.67 mil 起、步长 1/600 英寸，末项「固定宽度」">
                      <select
                        data-testid="barcode-x-size"
                        value={xSizeMilOptionLabel(bo.xSizeMil ?? (bo.xSizeMm ? bo.xSizeMm / 0.0254 : undefined), bo.xSizeFixed === true)}
                        onChange={(e) => {
                          const mil = xSizeMilFromOptionLabel(e.target.value)
                          patchBo(mil === undefined
                            // `固定宽度`：清掉 mil/mm，改为「不指定窄条宽度」（由对象宽度决定）
                            ? { xSizeFixed: true, xSizeMil: undefined, xSizeMm: undefined }
                            : { xSizeFixed: false, xSizeMil: mil, xSizeMm: mil * 0.0254 })
                        }}
                        style={selStyle}
                      >
                        {X_SIZE_MIL_OPTION_LABELS.map((label) => <option key={label} value={label}>{label}</option>)}
                      </select>
                    </FormField>
                    {W2N_SYMBOLOGIES.has(barcodeObj.symbology) && (
                      <FormField label="条宽比(&W):">
                        <select value={bo.w2n ?? (barcodeObj.symbology === 'pdf417' ? 3 : 2)} onChange={(e) => patchBo({ w2n: parseFloat(e.target.value) })} style={selStyle}>
                          {barcodeObj.symbology === 'pdf417'
                            // 真机 PDF 417 的「条宽比(&W)」是 9 档 1 X…9 X（默认 3 X）
                            ? [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n} X</option>)
                            // 其余有该项的码制（Code 39/CodaBar/25 码族/China Post/Pharmacode/ITF 14）真机是 7 档 2.00…3.00（默认 3.00）
                            : [2, 2.17, 2.33, 2.5, 2.67, 2.83, 3].map((n) => <option key={n} value={n}>{n.toFixed(2)}</option>)}
                        </select>
                      </FormField>
                    )}
                    {/* 真机该控件的标签原文是「码  高(&H):」（两个空格），单位「毫米」是框后的独立静态文字 */}
                    <FormField label={'码  高(&H):'} hint="条码符号高度">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {/* 码高与「常规」页的「高度（毫米）」是**同一个值**（真机两页都能改条码高度），
                            故这里走同一个几何草稿（`useObjectGeometryDraft` 的 h/setH）：
                            否则本页直接 onPatch、而底排「确定」会用草稿里的旧高度覆盖它 —— 用户的改动会被吞掉。 */}
                        <input
                          data-testid="barcode-height"
                          type="number"
                          min={1}
                          step={0.1}
                          value={h}
                          onChange={(e) => setH(e.target.value)}
                          style={numStyle}
                        />
                        <span>毫米</span>
                      </span>
                    </FormField>
                    {/* 真机 EAN/UPC 码制下的「缩减量」（.lsdx 的 reduction 属性）：压低条码高度。
                        真机原文 `缩减量(&M):`（`probe-60-barcode-props-tree.txt` (1316,611)）。
                        注意：行首的注释 **不**自带收尾大括号——这个花括号是**跨行的表达式起点**，
                        条件与注释同属一个表达式，收尾在下面缩进处的 `)}`。 */
                    EAN_UPC_SYMBOLOGIES.includes(barcodeObj.symbology) && (
                      <FormField label="缩减量(&M):" hint="真机 EAN/UPC 条码页的「缩减量」：把条码高度压低指定毫米数">
                        <input
                          data-testid="barcode-reduction"
                          type="number"
                          min={0}
                          step={0.1}
                          value={(barcodeObj as { reductionMm?: number }).reductionMm ?? 0}
                          onChange={(e) => onPatch({ reductionMm: Math.max(0, Math.min(100, Math.round((parseFloat(e.target.value) || 0) * 100) / 100)) } as never)}
                          style={numStyle}
                        />
                      </FormField>
                    )}
                    </div>
                  </fieldset>
                  </>
                )
              })()}
              {/* —— 各码制特殊选项（对标原版条码对象的属性"特殊选项"页） —— */}
              {/* —— 各码制特殊选项：真机把它们放在「条码」页内的「条码特殊选项」分组里（无独立页签）—— */}
              {(() => {
                const bo = (barcodeObj as { barcodeOptions?: BarcodeOptions }).barcodeOptions ?? {}
                const patchBo = (p: Partial<BarcodeOptions>) => onPatch({ barcodeOptions: { ...bo, ...p } } as never)
                const rows: React.ReactNode[] = []
                if (barcodeObj.symbology === 'code128' || barcodeObj.symbology === 'qrcode' || barcodeObj.symbology === 'datamatrix') {
                  rows.push(
                    <label key="gs1" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
                      <input type="checkbox" checked={!!bo.gs1} onChange={(e) => patchBo({ gs1: e.target.checked })} style={{ width: 14, height: 14 }} />
                      {/* 真机原文 `GS1/EAN 128(&U)`（`probe-60-barcode-props-tree.txt` (961,704)，是复选框）；
                          屏幕显示按 MFC 语义去掉加速键标记 `&`（DIFF-83）。 */}
                      {displayMfcCaption(barcodeObj.symbology === 'code128' ? 'GS1/EAN 128(&U)' : 'GS1 模式(&U)')}
                    </label>
                  )
                }
                if (barcodeObj.symbology === 'code128') {
                  rows.push(
                    <FormField key="charset" label="字符集(&C):">
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
                      {/* 真机 QR Code 页原文 `纠错级别(&E):`，4 项纯字母 `L`/`M`/`Q`/`H`、默认 `M`
                          （`probe-sym-qrcode-values.txt`：`value='M  (选中 1 / 共 4 项)'`；
                          `probe-sym-qrcode-combos.txt` combo[3] 逐项 `L / M / Q / H`）。
                          复刻版原先写作 `纠错级别`（缺加速键）且选项带自造的「（约7%）」后缀 → 按真机原文改。 */}
                      <FormField label="纠错级别(&E):">
                        <select data-testid="qr-eclevel" value={bo.eclevel ?? 'M'} onChange={(e) => patchBo({ eclevel: e.target.value })} style={selStyle}>
                          <option value="L">L</option>
                          <option value="M">M</option>
                          <option value="Q">Q</option>
                          <option value="H">H</option>
                        </select>
                      </FormField>
                      {/* 真机原文 `字符编码:`（无加速键、带冒号），2 项且**顺序为 `UTF-8` / `ANSI`**、默认 `ANSI`
                          （`probe-sym-qrcode-combos.txt` combo[4]：`count=2 sel=1 cur='ANSI'`，逐项 UTF-8 / ANSI）。
                          复刻版原先写作 `字符编码`（缺冒号）且项序为 ANSI / UTF-8 → 按真机改。 */}
                      <FormField label="字符编码:">
                        <select data-testid="qr-encoding" value={bo.encoding ?? 'ansi'} onChange={(e) => patchBo({ encoding: e.target.value as BarcodeOptions['encoding'] })} style={selStyle}>
                          <option value="utf8">UTF-8</option>
                          <option value="ansi">ANSI</option>
                        </select>
                      </FormField>
                    </div>
                  )
                  // 真机 `图标区域：` 是**下拉**（31 项 `无` + `1`…`30`，默认 `无`）：`probe-sym-qrcode-combos.txt`
                  // combo[5]（xy=(1440,752)，`count=31 sel=0 cur='无'`）。复刻版原先是一个**复选框**
                  // （`图标区域（中央留白，供插入 Logo 图标）`）→ 形态与真机不符，按真机改成下拉。
                  rows.push(
                    <FormField key="qrIcon" label="图标区域：" hint="中央留空供插入 Logo 图标的模块数，「无」表示不留白">
                      <select
                        data-testid="qr-icon-area"
                        value={String(bo.qrIconAreaSize ?? 0)}
                        onChange={(e) => patchBo({ qrIconAreaSize: Math.max(0, Math.min(30, parseInt(e.target.value, 10) || 0)) })}
                        style={selStyle}
                      >
                        <option value="0">无</option>
                        {Array.from({ length: 30 }, (_, index) => index + 1).map((v) => (
                          <option key={v} value={String(v)}>{v}</option>
                        ))}
                      </select>
                    </FormField>
                  )
                  // 真机 QR Code 页有「符号版本:」下拉 41 项（自动 + 1 (21x21) … 40 (177x177)）
                  rows.push(
                    <FormField key="qrVer" label="符号版本:" hint="真机 QR Code 页的「符号版本」：自动或 1–40">
                      <select data-testid="qr-version" value={bo.qrVersion ?? 'auto'} onChange={(e) => patchBo({ qrVersion: e.target.value })} style={selStyle}>
                        <option value="auto">自动</option>
                        {Array.from({ length: 40 }, (_, index) => index + 1).map((v) => (
                          <option key={v} value={String(v)}>{`${v} (${21 + (v - 1) * 4}x${21 + (v - 1) * 4})`}</option>
                        ))}
                      </select>
                    </FormField>
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
                    <div key="pdfSize" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {/* 真机 PDF 417 的 `层数(&R):` = 89 项下拉（`自动` + 3…90）、`列数(&C):` = 31 项下拉
                          （`自动` + 1…30），两者默认都是 `自动`（`probe-sym-pdf417-combos.txt` combo[5]/[6]）。
                          复刻版此前是数字框、且 `层数` 绑的是自造的「层高 = X 尺寸倍数」语义 → 按真机改正，
                          并把值接上 bwip-js 的 `rows` / `columns`（`自动` = 不指定）。 */}
                      <FormField label="层数(&R):" hint="PDF417 的行数；「自动」= 由编码器按数据量决定">
                        <select
                          data-testid="pdf417-rows"
                          value={bo.pdf417Rows !== undefined ? String(bo.pdf417Rows) : BARCODE_AUTO_LABEL}
                          onChange={(e) => patchBo({ pdf417Rows: e.target.value === BARCODE_AUTO_LABEL ? undefined : parseInt(e.target.value, 10) })}
                          style={selStyle}
                        >
                          {PDF417_ROW_OPTIONS.map((label) => <option key={label} value={label}>{label}</option>)}
                        </select>
                      </FormField>
                      <FormField label="列数(&C):" hint="PDF417 的列数；「自动」= 由编码器按数据量决定">
                        <select
                          data-testid="pdf417-columns"
                          value={bo.pdf417Columns !== undefined ? String(bo.pdf417Columns) : BARCODE_AUTO_LABEL}
                          onChange={(e) => patchBo({ pdf417Columns: e.target.value === BARCODE_AUTO_LABEL ? undefined : parseInt(e.target.value, 10) })}
                          style={selStyle}
                        >
                          {PDF417_COLUMN_OPTIONS.map((label) => <option key={label} value={label}>{label}</option>)}
                        </select>
                      </FormField>
                    </div>
                  )
                  // 真机 PDF 417 页原文 `纠错级别(&E):`，**10 项** `自动` + `0`…`8`、默认 `自动`
                  // （`probe-sym-pdf417-values.txt`：`value='自动  (选中 0 / 共 10 项)'`；
                  // `probe-sym-pdf417-combos.txt` combo[4] 逐项 `自动 / 0 / 1 … 8`）。
                  // 复刻版原先是自造的 5 档 0/2/4/6/8（默认 2）→ 按真机改成 10 项、默认「自动」。
                  rows.push(
                    <FormField key="pdfEcl" label="纠错级别(&E):">
                      <select data-testid="pdf417-eclevel" value={bo.eclevel ?? 'auto'} onChange={(e) => patchBo({ eclevel: e.target.value })} style={selStyle}>
                        <option value="auto">自动</option>
                        {Array.from({ length: 9 }, (_, index) => index).map((v) => (
                          <option key={v} value={String(v)}>{v}</option>
                        ))}
                      </select>
                    </FormField>
                  )
                }
                if (barcodeObj.symbology === 'datamatrix') {
                  // 真机 Data Matrix 页原文 `字符编码:`，2 项**顺序 `UTF-8` / `ANSI`**、默认 `ANSI`
                  // （`probe-sym-datamatrix-combos.txt` combo[4]：`count=2 sel=1 cur='ANSI'`）。
                  rows.push(
                    <FormField key="dmEnc" label="字符编码:">
                      <select data-testid="dm-encoding" value={bo.encoding ?? 'ansi'} onChange={(e) => patchBo({ encoding: e.target.value as BarcodeOptions['encoding'] })} style={selStyle}>
                        <option value="utf8">UTF-8</option>
                        <option value="ansi">ANSI</option>
                      </select>
                    </FormField>
                  )
                  // 帮助 label_object_page_barcode_dm.html：纠错级别——签赋LabelShop 只支持 ECC200。
                  rows.push(
                    <FormField key="dmEcc" label="纠错级别" hint="签赋LabelShop 只支持 ECC200">
                      <select data-testid="datamatrix-eclevel" value="ECC200" disabled style={selStyle}><option value="ECC200">ECC200</option></select>
                    </FormField>
                  )
                  // 真机 Data Matrix 页有「符号版本」下拉 31 项（自动 + 1 (10x10) … 30）
                  rows.push(
                    <FormField key="dmVer" label="符号版本:" hint="真机 Data Matrix 页的「符号版本」：自动或 1–30">
                      <select data-testid="dm-version" value={bo.dmVersion ?? 'auto'} onChange={(e) => patchBo({ dmVersion: e.target.value })} style={selStyle}>
                        <option value="auto">自动</option>
                        {Array.from({ length: 30 }, (_, index) => index + 1).map((v) => (
                          <option key={v} value={String(v)}>{`${v} (${10 + (v - 1) * 2}x${10 + (v - 1) * 2})`}</option>
                        ))}
                      </select>
                    </FormField>
                  )
                }
                if (barcodeObj.symbology === 'microqrcode') {
                  // 真机 Micro QR 页：纠错级别 3 项（L/M/Q，默认 M）、字符编码 2 项、符号版本 5 项（自动 + M1..M4）
                  rows.push(
                    <div key="mx" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {/* 真机 Micro QR 页原文 `纠错级别(&E):`，3 项 `L`/`M`/`Q`、默认 `M`
                          （`probe-sym-microqr-combos.txt` combo[3]：`count=3 sel=1 cur='M'`）。 */}
                      <FormField label="纠错级别(&E):">
                        <select data-testid="microqr-eclevel" value={bo.eclevel ?? 'M'} onChange={(e) => patchBo({ eclevel: e.target.value })} style={selStyle}>
                          <option value="L">L</option>
                          <option value="M">M</option>
                          <option value="Q">Q</option>
                        </select>
                      </FormField>
                      {/* 真机原文 `字符编码:`，2 项顺序 `UTF-8` / `ANSI`、默认 `ANSI`
                          （`probe-sym-microqr-combos.txt` combo[4]：`count=2 sel=1 cur='ANSI'`）。 */}
                      <FormField label="字符编码:">
                        <select data-testid="microqr-encoding" value={bo.encoding ?? 'ansi'} onChange={(e) => patchBo({ encoding: e.target.value as BarcodeOptions['encoding'] })} style={selStyle}>
                          <option value="utf8">UTF-8</option>
                          <option value="ansi">ANSI</option>
                        </select>
                      </FormField>
                      <FormField label="符号版本:" hint="真机 Micro QR 页的「符号版本」：自动或 M1–M4">
                        <select data-testid="microqr-version" value={bo.microQrVersion ?? 'auto'} onChange={(e) => patchBo({ microQrVersion: e.target.value })} style={selStyle}>
                          <option value="auto">自动</option>
                          <option value="M1">M1 (11x11)</option>
                          <option value="M2">M2 (13x13)</option>
                          <option value="M3">M3 (15x15)</option>
                          <option value="M4">M4 (17x17)</option>
                        </select>
                      </FormField>
                    </div>
                  )
                }
                if (barcodeObj.symbology === 'hanxin') {
                  // 帮助 label_object_page_barcode_hx.html：纠错级别 / 字符编码（ANSI 或 UTF-8）/ 版本。
                  rows.push(
                    <div key="hx" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {/* 真机汉信码页原文 `纠错级别(&E):`，**4 项** `1`/`2`/`3`/`4`、默认 `1`
                          （`probe-sym-hanxin-values.txt`：`value='1  (选中 0 / 共 4 项)'`；
                          `probe-sym-hanxin-combos.txt` combo[2] 逐项 `1 / 2 / 3 / 4`）。
                          复刻版原先是自造的 `L1…L4`（默认 L2），且 `L1` 这类值送进 bwip-js 不合规 → 一并修正。 */}
                      <FormField label="纠错级别(&E):">
                        <select data-testid="hanxin-eclevel" value={bo.eclevel ?? '1'} onChange={(e) => patchBo({ eclevel: e.target.value })} style={selStyle}>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                        </select>
                      </FormField>
                      {/* 真机原文 `字符编码:`，2 项顺序 `UTF-8` / `ANSI`、默认 `ANSI`。 */}
                      <FormField label="字符编码:">
                        <select data-testid="hanxin-encoding" value={bo.encoding ?? 'ansi'} onChange={(e) => patchBo({ encoding: e.target.value as BarcodeOptions['encoding'] })} style={selStyle}>
                          <option value="utf8">UTF-8</option>
                          <option value="ansi">ANSI</option>
                        </select>
                      </FormField>
                      {/* 真机原文 `版本(&V):`，85 项 `自动` + `1`…`84`，**项文本就是纯数字**
                          （`probe-sym-hanxin-combos.txt` combo[3]：`count=85 sel=0 cur='自动'`，逐项 自动 / 1 / 2 …）。
                          复刻版原先写作 `版本 1`… → 按真机改成纯数字。 */}
                      <FormField label="版本(&V):" hint="真机汉信码页的「版本(&V)」是 85 项（自动 + 1…84）">
                        <select data-testid="hanxin-version" value={bo.hanxinVersion ?? 'auto'} onChange={(e) => patchBo({ hanxinVersion: e.target.value })} style={selStyle}>
                          <option value="auto">自动</option>
                          {Array.from({ length: 84 }, (_, index) => index + 1).map((v) => (
                            <option key={v} value={`v${v}`}>{v}</option>
                          ))}
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
                if (usesTwentyFiveOptions(barcodeObj.symbology)) {
                  // 帮助 label_object_page_barcode.html：25 码的特殊选项（提示：包括 Code25、
                  // ITF25、Matrix25 和中国邮政码）——四个码制共用同一组校验字符设置。
                  rows.push(
                    <div key="itf25" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
                        <input data-testid="barcode-25-check" type="checkbox" checked={!!bo.itf25Check} onChange={(e) => patchBo({ itf25Check: e.target.checked })} style={{ width: 14, height: 14 }} />
                        校验字符（模10）
                      </label>
                      <div style={{ fontSize: 11.5, color: '#6B7280', lineHeight: 1.6 }} data-testid="barcode-25-note">
                        本组选项包括 Code25、ITF25、Matrix25 和中国邮政码；25 码使用模10校验字符，校验字符正确性需用户程序自行检验，更多校验要求可通过脚本功能实现。
                      </div>
                    </div>
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
                  // 真机 ITF 14 页：检验字符 + 「保护框(&R)」3 项下拉（无/方框/保护条）+
                  // 「粗细(&N)」「空白区(&S)」各 15 档 X 比值（1X…15X，默认 5X/10X）。
                  const bearerMode = bo.itf14BearerMode ?? (bo.itf14Bearer ? 'box' : 'none')
                  const ratioOptions = () =>
                    Array.from({ length: 15 }, (_, index) => index + 1).map((n) => (
                      <option key={n} value={n}>{`${n}X`}</option>
                    ))
                  rows.push(
                    <div key="itf" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
                        <input type="checkbox" checked={bo.itf14Check !== false} onChange={(e) => patchBo({ itf14Check: e.target.checked })} style={{ width: 14, height: 14 }} />
                        检验字符（建议总是选中）
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        <FormField label="保护框">
                          <select
                            data-testid="itf14-bearer"
                            value={bearerMode}
                            onChange={(e) => patchBo({ itf14BearerMode: e.target.value as BarcodeOptions['itf14BearerMode'], itf14Bearer: e.target.value !== 'none' })}
                            style={selStyle}
                          >
                            <option value="none">无</option>
                            <option value="box">方框</option>
                            <option value="bar">保护条</option>
                          </select>
                        </FormField>
                        <FormField label="粗细">
                          <select data-testid="itf14-bearer-ratio" value={bo.itf14BearerRatio ?? 5} onChange={(e) => patchBo({ itf14BearerRatio: parseInt(e.target.value, 10) })} style={selStyle}>
                            {ratioOptions()}
                          </select>
                        </FormField>
                        <FormField label="空白区">
                          <select data-testid="itf14-quiet-ratio" value={bo.itf14QuietRatio ?? 10} onChange={(e) => patchBo({ itf14QuietRatio: parseInt(e.target.value, 10) })} style={selStyle}>
                            {ratioOptions()}
                          </select>
                        </FormField>
                      </div>
                    </div>
                  )
                }
                if (rows.length === 0) {
                  // 帮助 label_object_barcode.html：「Code 93条码的特殊选项（93码没有相关的特殊选项）」
                  const specNote = BARCODE_CHARSETS[barcodeObj.symbology]?.note
                  rows.push(
                    <div key="none" style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6 }} data-testid="barcode-special-none">
                      {specNote ?? '该码制无特殊选项。'}
                    </div>
                  )
                }
                return (
                  <fieldset
                    data-testid="barcodeSpecial"
                    style={{ border: '1px solid #D5D4CD', borderRadius: 6, padding: '10px 12px 12px', margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}
                  >
                    <legend style={{ fontSize: 12.5, color: '#1A1B1C', padding: '0 4px' }}>条码特殊选项</legend>
                    {rows}
                  </fieldset>
                )
              })()}
                  {/* 真机「供人识读字符」组：`位置(&P):` / `垂直偏移(&O):`＋`毫米` / `对齐方式(&A):` /
                      `字符模板(&T)` 复选＋只读输入框（`probe-60-barcode-props-tree.txt` (961,857) 起）。
                      **位置按真机 y 序**：`尺寸`(y=521) → `条码特殊选项`(y=665) → `供人识读字符`(y=821)，
                      三者 704 宽、依次向下排列；故本组渲染在「条码特殊选项」之后、页尾「颜色:」之前。
                      round-126 曾把它排在「条码特殊选项」之前（与真机相反），由 ui-v134 的分组框整数组全等断言抓出。 */}
                  {(() => {
                    const bo = (barcodeObj as { barcodeOptions?: BarcodeOptions }).barcodeOptions ?? {}
                    const patchBo = (p: Partial<BarcodeOptions>) => onPatch({ barcodeOptions: { ...bo, ...p } } as never)
                    return (
                  <fieldset data-testid="barcode-group-human" style={BARCODE_GROUP_STYLE}>
                    <legend style={BARCODE_LEGEND_STYLE}>供人识读字符</legend>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <FormField label="位置(&P):" hint="真机「供人识读字符」组的位置下拉（EAN/UPC 只有 3 项，其余码制 4 项）">
                      <select
                        data-testid="barcode-human-position"
                        value={bo.humanPosition ?? 'default'}
                        onChange={(e) => patchBo({ humanPosition: e.target.value as BarcodeOptions['humanPosition'] })}
                        style={selStyle}
                      >
                        <option value="default">默认</option>
                        <option value="none">无</option>
                        {!EAN_UPC_SYMBOLOGIES.includes(barcodeObj.symbology) && <option value="above">条码上方</option>}
                        <option value="below">条码下方</option>
                      </select>
                    </FormField>
                    <FormField label="垂直偏移(&O):" hint="供人识读字符相对条码的垂直偏移（毫米）">
                      <input
                        data-testid="barcode-human-offset"
                        type="number"
                        step={0.01}
                        value={bo.humanOffsetMm ?? 0}
                        onChange={(e) => patchBo({ humanOffsetMm: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                        style={numStyle}
                      />
                    </FormField>
                    <FormField label="对齐方式(&A):" hint="供人识读字符的对齐方式：左齐/右齐/居中/撑满">
                      <select
                        data-testid="barcode-human-align"
                        value={bo.humanAlign ?? 'center'}
                        onChange={(e) => patchBo({ humanAlign: e.target.value as BarcodeOptions['humanAlign'] })}
                        style={selStyle}
                      >
                        <option value="left">左齐</option>
                        <option value="right">右齐</option>
                        <option value="center">居中</option>
                        <option value="justify">撑满</option>
                      </select>
                    </FormField>
                    {/* 真机「供人识读字符」组末尾是 `字符模板(&T)` 复选 + 只读输入框
                        （`probe-60-barcode-props-tree.txt` (961,959) Button enabled / (1137,956) Edit DISABLED）。
                        复刻版该值本来就是正式模型字段（`charTemplate`，`lsdxImport` 也解析它），此处只是把入口
                        从「数据源」页迁回真机所在的「条码」页。 */}
                    <FormField label="字符模板(&T)" hint="一个 '?' 表示原有数据的一个字符，其它字符插入数据序列。如数据 0123456789，模板 (01)??… 输出 (01)0123456789">
                      <input
                        data-testid="barcode-char-template"
                        style={numStyle}
                        value={(barcodeObj as { charTemplate?: string }).charTemplate ?? ''}
                        onChange={(e) => onPatch({ charTemplate: e.target.value } as never)}
                        placeholder="(01)??????????"
                      />
                    </FormField>
                    </div>
                  </fieldset>
                    )
                  })()}
                  <div data-testid="barcode-extensions" style={{ border: '1px dashed #C9C7BF', borderRadius: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>复刻版扩展（原版「条码」页中无此项）</div>
                    {/* 真机「条码」页没有「对齐」控件（`probe-60-barcode-props-tree.txt` 全页无 `对齐` 组外字段，
                        真机的 `对齐` 是「常规」页的分组框，装的是 `水平(&W):` / `垂直(&T):` 两个下拉，语义不同）。
                        复刻版这个字段驱动可变数据打印时的条码摆位（rendering/fabricObjects.ts），是**在用**的功能，
                        按「不静默删功能」口径保留并把入口标注为复刻版扩展。 */}
                    <FormField label="对齐" hint="可变数据打印时条码数据长度可能不一致，用对齐控制条码的位置；居中时长度变化后仍保持中间对齐">
                      <select
                        data-testid="barcode-align"
                        value={(barcodeObj as BarcodeObj).barcodeAlign ?? 'center'}
                        onChange={(e) => onPatch({ barcodeAlign: e.target.value as BarcodeObj['barcodeAlign'] } as never)}
                        style={selStyle}
                      >
                        <option value="left">左对齐</option>
                        <option value="center">居中对齐</option>
                        <option value="right">右对齐</option>
                      </select>
                    </FormField>
                  </div>
              {/* 真机「条码」页**页尾**（`verifier-20c-barcode-page.png` 实拍）：`颜色:` + 黑色色块 + 下拉箭头，
                  位于「供人识读字符」组之后、底排按钮之前。round-113 曾据控件树文本 dump 判定"本页无颜色"
                  并把色块迁去「常规」页 —— round-79 实拍更正后**放回本页页尾**（DIFF-72）。
                  真机该行的下拉选项集尚未取证，故只还原有实拍证据的色块，不造第二份下拉。 */}
              <FormField label="颜色:" hint="条码的绘制颜色（真机「条码」页页尾的颜色色块）">
                <input data-testid="barcode-color" type="color" value={barcodeObj.color ?? '#000000'} onChange={(e) => onPatch({ color: e.target.value } as never)} style={{ width: 44, height: 30, border: 'none', padding: 0, background: 'none' }} />
              </FormField>
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
              {/* 帮助 label_object_page_picture.html：「还决定如果在打印时未找到图片该如何进行处理」 */}
              <FormField label="无效图片" hint="打印时未找到图片该如何处理：中止输出（默认）/ 忽略该对象 / 画占位框（虚线框）">
                <select
                  data-testid="image-missing-behavior"
                  value={imageObj.missingImage ?? 'error'}
                  onChange={(e) => onPatch({ missingImage: e.target.value } as never)}
                  style={selStyle}
                >
                  <option value="error">中止输出</option>
                  <option value="skip">忽略该对象</option>
                  <option value="placeholder">画占位框</option>
                </select>
              </FormField>
              {imageObj.imgType === 'embed' && (
                <>
                  <FormField label="更换图片" hint="浏览图片对话框的文件类型默认为「所有支持的图象文件」">
                    <button
                      type="button"
                      data-testid="image-browse"
                      onClick={() => {
                        void window.maxlabel.pickFile({ filters: IMAGE_FILE_FILTERS }).then(async (r) => {
                          if (!r.ok || !r.path) return
                          const read = await window.maxlabel.readImage(r.path)
                          if (!read.ok || !read.dataUrl) {
                            setImageMsg(read.message ?? '图片内容无法解码')
                            return
                          }
                          await validateImageDataUrl(read.dataUrl).catch((error) => {
                            setImageMsg(error instanceof Error ? error.message : String(error))
                            throw error
                          })
                          setImageMsg('')
                          onPatch({ src: read.dataUrl } as never)
                        }).catch((error) => setImageMsg(error instanceof Error ? error.message : String(error)))
                      }}
                      style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13 }}
                    >
                      浏览图片…
                    </button>
                  </FormField>
                  <FormField label="文件类型" hint="浏览图片对话框的下拉项，默认选中第一项">
                    <select data-testid="image-file-type" defaultValue={IMAGE_FILE_FILTERS[0].name} style={selStyle}>
                      {IMAGE_FILE_FILTERS.map((f) => (
                        <option key={f.name} value={f.name}>{f.name}</option>
                      ))}
                    </select>
                  </FormField>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
                    <input
                      data-testid="image-preview-toggle"
                      type="checkbox"
                      checked={imagePreview}
                      onChange={(e) => setImagePreview(e.target.checked)}
                    />
                    预览图片
                  </label>
                  {imagePreview && imageObj.src && (
                    <div data-testid="image-preview" style={{ border: '1px solid #E5E4DE', borderRadius: 6, padding: 6, background: '#FAFAF8', display: 'flex', justifyContent: 'center' }}>
                      <img src={imageObj.src} alt="预览图片" style={{ maxWidth: '100%', maxHeight: 140, objectFit: 'contain' }} />
                    </div>
                  )}
                  {imageMsg && <div style={{ marginTop: 6, fontSize: 11, color: '#C0392B' }}>{imageMsg}</div>}
                </>
              )}
              {imageObj.imgType === 'link' && (
                <FormField label="图片文件" hint="点击按钮选择本地图片文件（按路径引用，图片变化后打印自动更新）">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={fullStyle} value={imageObj.linkPath ?? ''} onChange={(e) => onPatch({ linkPath: e.target.value } as never)} placeholder="C:\images\logo.png" />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const r = await window.maxlabel.pickFile()
                          if (r.ok && r.path) onPatch({ linkPath: r.path } as never)
                        } catch (error) {
                          setImageMsg('选择图片文件失败：' + (error instanceof Error ? error.message : String(error)))
                        }
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
                        try {
                          const r = await window.maxlabel.pickDir()
                          if (r.ok && r.path) onPatch({ linkPath: r.path } as never)
                        } catch (error) {
                          setImageMsg('选择图片目录失败：' + (error instanceof Error ? error.message : String(error)))
                        }
                      }}
                      style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
                    >
                      选择目录…
                    </button>
                  </div>
                </FormField>
              )}
              <FormField label="缩放方式" hint="原始尺寸锁定原图大小；比例缩放使用百分比；适合边框按当前图片适配；保持边框尺寸输出时适配但编辑边框可任意设置">
                <select data-testid="image-fit" value={imageObj.imageFit ?? 'fit'} onChange={(e) => onPatch({ imageFit: e.target.value as ImageObj['imageFit'] } as never)} style={selStyle}>
                  <option value="original">原始尺寸</option>
                  <option value="scale">比例缩放</option>
                  <option value="fit">适合边框</option>
                  <option value="fitBox">保持边框尺寸</option>
                </select>
              </FormField>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
                <input data-testid="image-keep-aspect" type="checkbox" checked={imageObj.keepAspect !== false} onChange={(e) => onPatch({ keepAspect: e.target.checked } as never)} />
                保持长宽比
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="宽度（%）">
                  <input data-testid="image-width-percent" type="number" min={1} max={1000} step={1} disabled={(imageObj.imageFit ?? 'fit') !== 'scale'} value={imageObj.widthPercent ?? 100} onChange={(e) => { const value = Math.max(1, Math.min(1000, parseFloat(e.target.value) || 100)); onPatch(imageObj.keepAspect !== false ? { widthPercent: value, heightPercent: value } as never : { widthPercent: value } as never) }} style={numStyle} />
                </FormField>
                <FormField label="高度（%）">
                  <input data-testid="image-height-percent" type="number" min={1} max={1000} step={1} disabled={(imageObj.imageFit ?? 'fit') !== 'scale'} value={imageObj.heightPercent ?? imageObj.widthPercent ?? 100} onChange={(e) => { const value = Math.max(1, Math.min(1000, parseFloat(e.target.value) || 100)); onPatch(imageObj.keepAspect !== false ? { widthPercent: value, heightPercent: value } as never : { heightPercent: value } as never) }} style={numStyle} />
                </FormField>
              </div>
              <FormField label="对齐方式" hint="用于链接式图片或数据源图片尺寸变化时的摆位">
                <select data-testid="image-align" value={imageObj.imageAlign ?? 'center'} onChange={(e) => onPatch({ imageAlign: e.target.value as ImageObj['imageAlign'] } as never)} style={selStyle}>
                  <option value="center">中心对齐</option>
                  <option value="topLeft">左上角对齐</option>
                  <option value="topCenter">上中对齐</option>
                  <option value="topRight">右上角对齐</option>
                  <option value="middleRight">右中对齐</option>
                  <option value="bottomRight">右下角对齐</option>
                  <option value="bottomCenter">下中对齐</option>
                  <option value="bottomLeft">左下角对齐</option>
                  <option value="middleLeft">左中对齐</option>
                </select>
              </FormField>
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
            <select data-testid="rfid-reader-type" value={rfidObj.readerType ?? 'auto'} onChange={(e) => onPatch({ readerType: e.target.value } as never)} style={selStyle}>
              <option value="auto">自动 / 打印机默认</option>
              <option value="iso18000-6c">ISO18000-6C（UHF）</option>
              <option value="iso14443">ISO14443（HF）</option>
              <option value="gbt29768">国标 GB/T 29768</option>
              <option value="gjb7377">军标 GJB 7377.1</option>
            </select>
          </FormField>
          <FormField label="数据段位置" hint="RFID 标签存储区：EPC（常用）/ USER / TID">
            <select data-testid="rfid-bank" value={rfidObj.bank} onChange={(e) => onPatch({ bank: e.target.value as 'EPC' | 'USER' | 'TID' })} style={selStyle}>
              <option value="EPC">EPC 区</option>
              <option value="USER">USER 区</option>
              <option value="TID">TID 区</option>
            </select>
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="起始块位置">
              <input data-testid="rfid-start-block" type="number" min={0} value={rfidObj.startBlock ?? 0} onChange={(e) => onPatch({ startBlock: parseInt(e.target.value, 10) || 0 } as never)} style={numStyle} />
            </FormField>
            <FormField label="数据类型" hint="RFID 标记数据默认 16 进制类型">
              <select data-testid="rfid-data-type" value={rfidObj.dataType ?? 'hex'} onChange={(e) => onPatch({ dataType: e.target.value } as never)} style={selStyle}>
                <option value="hex">十六进制</option>
                <option value="auto">自动（纯 16 进制原样，否则按 ASCII 转码）</option>
                <option value="ascii">ASCII</option>
              </select>
            </FormField>
          </div>
          {rfidObj.bank === 'EPC' && (
            <FormField label="EPC 区 PC 协议控制字" hint="ISO1800-6C 协议 PC 值（十六进制，如 3000）">
              <input data-testid="rfid-pc-word" style={fullStyle} value={rfidObj.pcWord ?? ''} onChange={(e) => onPatch({ pcWord: e.target.value } as never)} placeholder="3000" />
            </FormField>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="编码码头" hint="国标/军标协议编码码头">
              <input data-testid="rfid-code-head" style={fullStyle} value={rfidObj.codeHead ?? ''} onChange={(e) => onPatch({ codeHead: e.target.value } as never)} />
            </FormField>
            <FormField label="编码长度">
              <input data-testid="rfid-code-len" type="number" min={0} value={rfidObj.codeLen ?? 0} onChange={(e) => onPatch({ codeLen: parseInt(e.target.value, 10) || 0 } as never)} style={numStyle} />
            </FormField>
          </div>
          <div style={{ borderTop: '1px solid #ECEBE6', paddingTop: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1B1C', marginBottom: 8 }}>访问控制</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 8, alignItems: 'center' }}>
              {([['epc', 'EPC Block'], ['user', 'User Block'], ['tid', 'TID Block'], ['accessPassword', 'Access Password'], ['killPassword', 'Kill Password']] as const).map(([key, label]) => (
                <div key={key} style={{ display: 'contents' }}>
                  <label htmlFor={`rfid-access-${key}`} style={{ fontSize: 12.5, color: '#374151' }}>{label}</label>
                  <select id={`rfid-access-${key}`} data-testid={`rfid-access-${key}`} value={rfidAccess[key]} onChange={(e) => patchRfidAccess(key, e.target.value as 'none' | 'lock' | 'unlock')} style={selStyle}>
                    <option value="none">不操作</option>
                    <option value="lock">锁定</option>
                    <option value="unlock">解锁</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Access 口令（4 字节 Hex）">
              <div style={{ display: 'flex', gap: 6 }}>
                <input data-testid="rfid-access-password" style={{ ...fullStyle, flex: 1 }} maxLength={8} value={rfidObj.accessPwd ?? '00000000'} onChange={(e) => onPatch({ accessPwd: e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 8).toUpperCase() })} />
                <button type="button" data-testid="rfid-random-access" onClick={() => onPatch({ accessPwd: randomHex8() })} style={{ padding: '6px 8px', border: '1px solid #D5D4CD', borderRadius: 6, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>随机生成</button>
              </div>
            </FormField>
            <FormField label="Kill 口令（4 字节 Hex）">
              <div style={{ display: 'flex', gap: 6 }}>
                <input data-testid="rfid-kill-password" style={{ ...fullStyle, flex: 1 }} maxLength={8} value={rfidObj.killPwd ?? '00000000'} onChange={(e) => onPatch({ killPwd: e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 8).toUpperCase() })} />
                <button type="button" data-testid="rfid-random-kill" onClick={() => onPatch({ killPwd: randomHex8() })} style={{ padding: '6px 8px', border: '1px solid #D5D4CD', borderRadius: 6, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>随机生成</button>
              </div>
            </FormField>
          </div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>
            RFID 标签编程：在打印时把数据源内容写入对应区域，需打印机带 RFID 打印头；标签上不打印可见内容。写入指令随固件而异，请真机验证。
          </div>
        </div>
      )}

      {tab === 'table' && tableObj && (
        <div data-testid="table-property-editor" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="行数">
              <input type="number" min={1} max={50} value={tableObj.rows} onChange={(e) => { const rows = Math.max(1, Math.min(50, parseInt(e.target.value || '1', 10) || 1)); onPatch(resizeTableRows(tableObj, rows) as never) }} style={numStyle} />
            </FormField>
            <FormField label="列数">
              <input type="number" min={1} max={50} value={tableObj.cols} onChange={(e) => { const cols = Math.max(1, Math.min(50, parseInt(e.target.value || '1', 10) || 1)); onPatch(resizeTableCols(tableObj, cols) as never) }} style={numStyle} />
            </FormField>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1A1B1C' }}>
            <input data-testid="table-keep-size" type="checkbox" checked={!!tableObj.keepSize} onChange={(e) => onPatch({ keepSize: e.target.checked } as never)} style={{ width: 14, height: 14 }} />
            增删行列时保持表格尺寸（在表格外框内重排行高列宽）
          </label>
          {/* 行高/列宽（帮助 label_object_page_form.html）：表格属性中可设置行高和列宽 */}
          <FormField label="行高（毫米）" hint="逐行设置行高；留空表示按表格高度均分">
            <div data-testid="table-row-heights" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Array.from({ length: tableObj.rows }, (_, r) => (
                <input
                  key={r}
                  data-testid={`table-row-height-${r}`}
                  type="number"
                  min={0.1}
                  step={0.1}
                  style={{ ...numStyle, width: 66 }}
                  value={tableRowHeights[r] ?? +(tableObj.h / tableObj.rows).toFixed(2)}
                  onChange={(e) => {
                    const next = [...tableRowHeights]
                    next[r] = Math.max(0.1, parseFloat(e.target.value) || 0.1)
                    onPatch({ rowHeights: next } as never)
                  }}
                />
              ))}
            </div>
          </FormField>
          <FormField label="列宽（毫米）" hint="逐列设置列宽；留空表示按表格宽度均分">
            <div data-testid="table-col-widths" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Array.from({ length: tableObj.cols }, (_, c) => (
                <input
                  key={c}
                  data-testid={`table-col-width-${c}`}
                  type="number"
                  min={0.1}
                  step={0.1}
                  style={{ ...numStyle, width: 66 }}
                  value={tableColWidths[c] ?? +(tableObj.w / tableObj.cols).toFixed(2)}
                  onChange={(e) => {
                    const next = [...tableColWidths]
                    next[c] = Math.max(0.1, parseFloat(e.target.value) || 0.1)
                    onPatch({ colWidths: next } as never)
                  }}
                />
              ))}
            </div>
          </FormField>
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
            <div data-testid="table-embedded-object-note" style={{ padding: '7px 9px', borderRadius: 5, background: '#F4F5F6', color: '#5B6470', fontSize: 12 }}>
              表格单元格内不能直接排入文字、条码等对象；请单独建立对象并移动到表格对应位置。
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <FormField label="起始行"><input data-testid="table-merge-start-row" type="number" min={0} value={mergeR} onChange={(e) => setMergeR(Math.max(0, parseInt(e.target.value || '0', 10)))} style={numStyle} /></FormField>
              <FormField label="起始列"><input data-testid="table-merge-start-col" type="number" min={0} value={mergeC} onChange={(e) => setMergeC(Math.max(0, parseInt(e.target.value || '0', 10)))} style={numStyle} /></FormField>
              <FormField label="结束行"><input data-testid="table-merge-end-row" type="number" min={0} value={mergeR2} onChange={(e) => setMergeR2(Math.max(0, parseInt(e.target.value || '0', 10)))} style={numStyle} /></FormField>
              <FormField label="结束列"><input data-testid="table-merge-end-col" type="number" min={0} value={mergeC2} onChange={(e) => setMergeC2(Math.max(0, parseInt(e.target.value || '0', 10)))} style={numStyle} /></FormField>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                data-testid="table-merge-apply"
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
                      data-testid={`table-merge-remove-${idx}`}
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

      {((tab === 'text' && textObj) || (tab === 'font' && barcodeObj)) && (
        <div style={{ maxHeight: 360, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {textObj && (
            <>
              {/* ⚠️ 复刻版扩展（真机「文本」页在**任何模式**下都没有这些字段：
                  `probe-r201-textprops-text-tree.txt` 全页只有 类型/属性 两个分组框 + 上述字段）。
                  按验收方「不静默删功能，但要明确标注」的口径集中放在这里，与真机字段区分开。 */}
              <div data-testid="text-extensions" style={{ border: '1px dashed #C9C7BF', borderRadius: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, color: '#6B7280' }}>复刻版扩展（原版「文本」页中无以下字段）</div>
              <FormField label="大小写转换" hint="仅影响打印输出，不影响编辑">
                <select value={textObj.format ?? 'none'} onChange={(e) => onPatch({ format: e.target.value === 'none' ? undefined : e.target.value as 'upper' | 'lower' | 'capitalize' } as never)} style={selStyle}>
                  <option value="none">无</option>
                  <option value="upper">全部大写</option>
                  <option value="lower">全部小写</option>
                  <option value="capitalize">首字母大写</option>
                </select>
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
                  data-testid="text-cut-type"
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
                  {/* 帮助 datasource_advanced_cut.html：保留也可「单独保留数字的整数或者小数部分（包含小数点）」 */}
                  <option value="keepInt">保留整数部分</option>
                  <option value="keepDecimal">保留小数部分（含小数点）</option>
                </select>
              </FormField>
              {((textObj as { substr?: { cutType?: string } }).substr?.cutType === 'dropLeft' ||
                (textObj as { substr?: { cutType?: string } }).substr?.cutType === 'dropRight' ||
                (textObj as { substr?: { cutType?: string } }).substr?.cutType === 'keepLeft' ||
                (textObj as { substr?: { cutType?: string } }).substr?.cutType === 'keepRight') && (
                <FormField label="字符数">
                  <input
                    data-testid="text-cut-count"
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
                  data-testid="text-length-limit"
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
                      data-testid="text-length-min"
                      type="number" min={0}
                      value={(textObj as { lengthLimit?: LengthLimit }).lengthLimit?.min ?? 0}
                      onChange={(e) => {
                        const cur = (textObj as { lengthLimit?: LengthLimit }).lengthLimit
                        onPatch({ lengthLimit: { ...(cur ?? {}), min: parseInt(e.target.value || '0', 10) } } as never)
                      }}
                      style={numStyle}
                    />
                  </FormField>
                  <FormField label="长度不足时">
                    <select
                      data-testid="text-pad-direction"
                      value={(textObj as { lengthLimit?: LengthLimit }).lengthLimit?.padDir ?? 'left'}
                      onChange={(e) => {
                        const cur = (textObj as { lengthLimit?: LengthLimit }).lengthLimit
                        onPatch({ lengthLimit: { ...(cur ?? {}), padDir: e.target.value } } as never)
                      }}
                      style={selStyle}
                    >
                      <option value="left">在数据的左侧填加</option>
                      <option value="right">在数据的右侧填加</option>
                    </select>
                  </FormField>
                  <FormField label="填充字符">
                    <input
                      data-testid="text-pad-char"
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
                      data-testid="text-length-max"
                      type="number" min={0}
                      value={(textObj as { lengthLimit?: LengthLimit }).lengthLimit?.max ?? 0}
                      onChange={(e) => {
                        const cur = (textObj as { lengthLimit?: LengthLimit }).lengthLimit
                        onPatch({ lengthLimit: { ...(cur ?? {}), max: parseInt(e.target.value || '0', 10) } } as never)
                      }}
                      style={numStyle}
                    />
                  </FormField>
                  <FormField label="长度超过时截去">
                    <select
                      data-testid="text-trim-direction"
                      value={(textObj as { lengthLimit?: LengthLimit }).lengthLimit?.trimDir ?? 'right'}
                      onChange={(e) => {
                        const cur = (textObj as { lengthLimit?: LengthLimit }).lengthLimit
                        onPatch({ lengthLimit: { ...(cur ?? {}), trimDir: e.target.value } } as never)
                      }}
                      style={selStyle}
                    >
                      <option value="right">从右侧截去多余字符</option>
                      <option value="left">从左侧截去多余字符</option>
                    </select>
                  </FormField>
                </div>
              )}
              <div style={{ fontSize: 12, color: '#6B7280', borderTop: '1px solid #E4E3DD', paddingTop: 8 }}>
                控制字符：数据源文本中可输入 &lt;HT&gt;（Tab）、&lt;CR&gt;（回车）、&lt;LF&gt;（换行）等 ASCII 1-31 控制字符；输入 &lt;&lt;HT&gt; 表示字面文本 &lt;HT&gt;。
              </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 结构照真机「文字属性 → 常规」页控件树 dump：`parity/reference/labelshop/probe-44-two-objects-tree.txt`。
              四个分组框按该 dump 的坐标次序（自上而下）：`位置`(934,458) / `对齐`(934,533) / `颜色`(934,611) / `其它`(934,689)；
              字段文案逐字照抄（含 MFC 加速键 `(&X)`，屏幕不显示 `&` 由 FormField 的 displayMfcCaption 处理）。 */}
          <fieldset data-testid="obj-group-position" style={BARCODE_GROUP_STYLE}>
            <legend style={BARCODE_LEGEND_STYLE}>位置</legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="水平(&H):">
                <div style={UNIT_ROW_STYLE}>
                  <input data-testid="obj-x" accessKey="h" data-access-suffix="(H)" disabled={positionLocked} value={x} onChange={(e) => setX(e.target.value)} style={{ ...numStyle, flex: 1, background: positionLocked ? '#F0EFEA' : undefined, color: positionLocked ? '#B0AFA9' : undefined }} />
                  <span style={UNIT_TEXT_STYLE}>毫米</span>
                </div>
              </FormField>
              <FormField label="垂直(&V):">
                <div style={UNIT_ROW_STYLE}>
                  <input data-testid="obj-y" accessKey="v" data-access-suffix="(V)" disabled={positionLocked} value={y} onChange={(e) => setY(e.target.value)} style={{ ...numStyle, flex: 1, background: positionLocked ? '#F0EFEA' : undefined, color: positionLocked ? '#B0AFA9' : undefined }} />
                  <span style={UNIT_TEXT_STYLE}>毫米</span>
                </div>
              </FormField>
            </div>
          </fieldset>

          <fieldset data-testid="obj-group-align" style={BARCODE_GROUP_STYLE}>
            <legend style={BARCODE_LEGEND_STYLE}>对齐</legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* 真机 round-57 取证：条码对象这两个下拉有 3 项（左齐/居中/右齐、顶部/居中/底部），
                  文字对象则是**空且禁用**（CB_GETCOUNT=0）——按对象类型决定可用性。
                  dump（probe-44）里文字对象下两个 Static + ComboBox 都是 DISABLED，故此处保持"有控件但禁用"。 */}
              <FormField label="水平(&W):" hint={alignOptionsAvailable ? '相对标签边对齐（保持当前尺寸）' : '当前对象类型不支持该选项（同真机）'}>
                <select
                  data-testid="obj-align-h"
                  accessKey="w"
                  data-access-suffix="(W)"
                  defaultValue=""
                  disabled={positionLocked || !alignOptionsAvailable}
                  style={{ ...selStyle, width: '100%', background: positionLocked || !alignOptionsAvailable ? '#F0EFEA' : undefined, color: positionLocked || !alignOptionsAvailable ? '#B0AFA9' : undefined }}
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
                  {alignOptionsAvailable && <>
                    <option value="">（保持当前位置）</option>
                    <option value="left">左齐</option>
                    <option value="center">居中</option>
                    <option value="right">右齐</option>
                  </>}
                </select>
              </FormField>
              <FormField label="垂直(&T):" hint={alignOptionsAvailable ? '相对标签边对齐（保持当前尺寸）' : '当前对象类型不支持该选项（同真机）'}>
                <select
                  data-testid="obj-align-v"
                  accessKey="t"
                  data-access-suffix="(T)"
                  defaultValue=""
                  disabled={positionLocked || !alignOptionsAvailable}
                  style={{ ...selStyle, width: '100%', background: positionLocked || !alignOptionsAvailable ? '#F0EFEA' : undefined, color: positionLocked || !alignOptionsAvailable ? '#B0AFA9' : undefined }}
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
                  {alignOptionsAvailable && <>
                    <option value="">（保持当前位置）</option>
                    <option value="top">顶部</option>
                    <option value="center">居中</option>
                    <option value="bottom">底部</option>
                  </>}
                </select>
              </FormField>
            </div>
          </fieldset>

          {/* 真机「常规」页的 `颜色(&C):` 是**颜色模式**（本机值 `固定颜色`），与「条码」页页尾的颜色**色块**
              不是同一个控件 —— 见 DIFF-72 的 round-79 更正（`verifier-20c-barcode-page.png` 实拍）。
              模式取值沿用复刻版既有的 COLOR_CHANGE_MODES（第一项即真机显示的 `固定颜色`）。
              可用性判据与「变色设置」同源（`colorChangeEnabled`）：帮助 getstart_color.html 明确
              「普通条码标签打印机无法选择彩色打印」，此时颜色模式**不提供**（只有 `colorPrinterBlocked`
              那条提示）。此处曾按对象类型单条件（`colorGranularities.length > 0`）渲染，导致 USB 直连时
              仍能选颜色模式 —— 与 A-201 冲突，见 round-117 修复。 */}
          <fieldset data-testid="obj-group-color" style={BARCODE_GROUP_STYLE}>
            <legend style={BARCODE_LEGEND_STYLE}>颜色</legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {colorChangeEnabled && <FormField label="颜色(&C):" hint="对象的颜色模式；真机「常规」页本机值为「固定颜色」">
                <select data-testid="color-change-mode" accessKey="c" data-access-suffix="(C)" disabled={!imageColorAllowed} value={ccMode} onChange={(e) => patchCc({ mode: e.target.value as ColorChangeConfig['mode'] })} style={selStyle}>
                  {COLOR_CHANGE_MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </FormField>}
              <FormField label="设置颜色" hint="真机该按钮在此对象类型下为 DISABLED（probe-44）">
                <button type="button" data-testid="obj-set-color" disabled style={{ ...selStyle, width: '100%', cursor: 'default', background: '#F0EFEA', color: '#B0AFA9' }}>设置颜色</button>
              </FormField>
            </div>
          </fieldset>

          <fieldset data-testid="obj-group-other" style={BARCODE_GROUP_STYLE}>
            <legend style={BARCODE_LEGEND_STYLE}>其它</legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="旋转(&R):">
                <select data-testid="obj-rotation" accessKey="r" data-access-suffix="(R)" value={String(parseInt(rot, 10) || 0)} onChange={(e) => setRot(e.target.value)} style={{ ...selStyle, width: 90 }}>
                  <option value="0">0</option>
                  <option value="90">90</option>
                  <option value="180">180</option>
                  <option value="270">270</option>
                </select>
              </FormField>
              <FormField label="镜像(&M):">
                <select
                  data-testid="obj-mirror"
                  accessKey="m"
                  data-access-suffix="(M)"
                  value={(obj as { flipX?: boolean; flipY?: boolean }).flipX === true && (obj as { flipY?: boolean }).flipY === true ? 'both' : (obj as { flipX?: boolean; flipY?: boolean }).flipX === true ? 'h' : (obj as { flipY?: boolean }).flipY === true ? 'v' : 'none'}
                  onChange={(e) => {
                    const v = e.target.value
                    onPatch({ flipX: v === 'h' || v === 'both' || undefined, flipY: v === 'v' || v === 'both' || undefined } as never)
                  }}
                  style={selStyle}
                >
                  <option value="none">无</option>
                  <option value="h">水平镜像</option>
                  <option value="v">垂直镜像</option>
                </select>
              </FormField>
              <FormField label="背景(&B):">
                <select data-testid="obj-background" accessKey="b" data-access-suffix="(B)" value={obj.backgroundTransparent === true ? 'transparent' : 'opaque'} onChange={(e) => onPatch({ backgroundTransparent: e.target.value === 'transparent' } as never)} style={selStyle}>
                  <option value="opaque">不透明</option>
                  <option value="transparent">透明</option>
                </select>
              </FormField>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'flex-end' }}>
                <label style={CHECK_ROW_STYLE}>
                  <input type="checkbox" accessKey="l" data-access-suffix="(L)" checked={(obj as { locked?: boolean }).locked === true} onChange={(e) => onPatch({ locked: e.target.checked } as never)} />
                  {displayMfcCaption('位置锁定(&L)')}
                </label>
                <label style={CHECK_ROW_STYLE}>
                  <input type="checkbox" accessKey="n" data-access-suffix="(N)" checked={(obj as { suppressPrint?: boolean }).suppressPrint === true} onChange={(e) => onPatch({ suppressPrint: e.target.checked } as never)} />
                  {displayMfcCaption('不打印输出(&N)')}
                </label>
              </div>
              <FormField label="对象名称标识：" hint="真机用**全角冒号**；仅作为模板中的对象标识">
                <input data-testid="obj-name" value={(obj as { name?: string }).name ?? ''} onChange={(e) => onPatch({ name: e.target.value } as never)} style={fullStyle} maxLength={128} />
              </FormField>
              <FormField label="图层：" hint="真机该下拉在此状态下为 DISABLED（probe-44）">
                <select data-testid="obj-layer" disabled style={{ ...selStyle, background: '#F0EFEA', color: '#B0AFA9' }}>
                  <option value="0">0</option>
                </select>
              </FormField>
            </div>
          </fieldset>

          {/* 真机 dump 里 `对象附加说明(&C)` 的分组框坐标在「其它」组之外（y=980 > 689+288），整行独占。 */}
          <FormField label="对象附加说明(&C)" hint="仅作为模板中的对象备注，不参与打印">
            <input data-testid="obj-note" accessKey="c" data-access-suffix="(C)" value={obj.note ?? ''} onChange={(e) => onPatch({ note: e.target.value } as never)} style={fullStyle} maxLength={1024} />
          </FormField>

          {/* ⚠️ 复刻版扩展（真机「常规」页无此两项；真机靠画布拖拽改尺寸）——按验收方口径**明确标注**而非静默保留。
              保留理由：复刻版的数值改尺寸入口在其它页签并不完整（文字对象仅此处可精确输入宽高）。 */}
          <div data-testid="obj-general-extension" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderTop: '1px dashed #D5D4CD', paddingTop: 10 }}>
            <FormField label="宽度（毫米）" hint="复刻版扩展（真机「常规」页无此字段）">
              <input value={w} onChange={(e) => setW(e.target.value)} style={numStyle} />
            </FormField>
            <FormField label="高度（毫米）" hint="复刻版扩展（真机「常规」页无此字段）">
              <input value={h} onChange={(e) => setH(e.target.value)} style={numStyle} />
            </FormField>
          </div>
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
          {colorPrinterBlocked && (
            <div data-testid="color-change-printer-note" style={{ gridColumn: '1 / -1', borderTop: '1px solid #ECEBE6', paddingTop: 12, fontSize: 12, color: '#B45309' }}>
              变色设置不可用：{VARIABLE_COLOR_UNSUPPORTED_NOTE}。（{VARIABLE_COLOR_JUDGE_NOTE}）
            </div>
          )}
          {colorChangeEnabled && (
            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #ECEBE6', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1B1C' }}>变色设置</div>
              {type === 'image' && (
                <div data-testid="color-change-image-hint" style={{ fontSize: 12, color: imageColorAllowed ? '#6B7280' : '#B45309' }}>
                  {imageObj?.imgType === 'datasource'
                    ? '数据源图片按单色黑白位图输出，支持可变颜色。'
                    : imageMono === 'mono'
                      ? '已检测：当前图片为单色黑白图片，支持可变颜色。'
                      : imageMono === 'color'
                        ? '已检测：当前图片包含彩色像素，不是单色黑白图片，不能设置可变颜色，仅支持整体颜色。'
                        : '图片仅有单色的黑白图片支持可变颜色；无法判定当前图片时按不支持处理。'}
                </div>
              )}
              {/* 「颜色变化模式」不在这里重复渲染：同一个 `colorChange.mode` 只由上面「常规」页的
                  `颜色(&C):`（`data-testid=color-change-mode`）一处承载 —— 真机的颜色模式就长在常规页
                  （`颜色(&C):` 值 `固定颜色`，见 DIFF-72），两处入口会让同一个值有两个控件。 */}
              {ccNeedsTable && imageColorAllowed && (
                <>
                  <FormField label="索引表来源">
                    <select data-testid="color-index-source" value={cc?.tableSource ?? 'private'} onChange={(e) => patchCc({ tableSource: e.target.value as ColorChangeConfig['tableSource'] })} style={selStyle}>
                      <option value="private">对象私有索引表</option>
                      <option value="shared">模板公共索引表</option>
                    </select>
                  </FormField>
                  {(cc?.tableSource ?? 'private') === 'private' ? (
                    <FormField label="私有索引表" hint="未添加自定义颜色时按预定义索引 0–9 取色；支持颜色名与 #RRGGBB">
                      <ColorIndexTableEditor values={cc?.privateTable ?? []} onChange={(values) => patchCc({ privateTable: values })} testIdPrefix="color-index-private" />
                    </FormField>
                  ) : (
                    <FormField label="模板公共索引表" hint="未添加自定义颜色时按预定义索引 0–9 取色；保存到模板共享使用">
                      <ColorIndexTableEditor values={colorIndexDraft} onChange={setColorIndexDraft} testIdPrefix="color-index-shared" />
                    </FormField>
                  )}
                </>
              )}
              {ccNeedsVariable && imageColorAllowed && (
                <FormField label={ccMode === 'indexVar' ? '颜色索引变量' : '颜色值变量'} hint="数据库字段名或键盘输入提示标签，其值作为索引值或 RGB 颜色值">
                  <input data-testid="color-change-variable" value={cc?.variableName ?? ''} onChange={(e) => patchCc({ variableName: e.target.value })} style={fullStyle} />
                </FormField>
              )}
              {ccNeedsInput && imageColorAllowed && (
                <FormField
                  label={ccMode === 'index' ? '颜色索引（输入内容）' : 'RGB 颜色值（输入内容）'}
                  hint={ccMode === 'index' ? '内容按字符取索引；也可以用“,”或“|”分隔多个值' : '如 #FF0000 或 “#FF0000 | #00FF00”；多个颜色值用“,”或者“|”分隔'}
                >
                  <input data-testid="color-change-input" value={cc?.inputValue ?? ''} onChange={(e) => patchCc({ inputValue: e.target.value })} style={fullStyle} />
                </FormField>
              )}
              {ccMode !== 'fixed' && imageColorAllowed && (
                <>
                  <FormField label="对象变色方式">
                    <select data-testid="color-change-granularity" value={cc?.changeMode ?? 'solid'} onChange={(e) => patchCc({ changeMode: e.target.value as ColorChangeConfig['changeMode'] })} style={selStyle}>
                      {colorGranularities.map((item) => (
                        <option key={item} value={item}>{COLOR_GRANULARITY_LABELS[item]}</option>
                      ))}
                    </select>
                  </FormField>
                  {(cc?.changeMode === 'block' || cc?.changeMode === 'gradient') && (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <FormField label="区块行数"><input type="number" min={1} value={cc.blockRows ?? 1} onChange={(e) => patchCc({ blockRows: parseInt(e.target.value || '1', 10) })} style={numStyle} /></FormField>
                      <FormField label="区块列数"><input type="number" min={1} value={cc.blockCols ?? 1} onChange={(e) => patchCc({ blockCols: parseInt(e.target.value || '1', 10) })} style={numStyle} /></FormField>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {type === 'group' && (
            <div style={{ gridColumn: '1 / -1', fontSize: 12, color: '#6B7280' }}>组合对象：按住 Alt 双击可打开子对象属性；移动/缩放作用于整体。</div>
          )}
        </div>
      )}
    </Modal>
  )
}
