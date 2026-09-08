// ---------- 共享数据模型（主进程 / 渲染层 / 指令引擎共用，毫米单位） ----------

export type ObjType = 'text' | 'barcode' | 'rfid' | 'rect' | 'line' | 'ellipse' | 'table' | 'image' | 'group'

// ---------- 数据源（对标 LabelShop 七类数据源） ----------
export interface ConstantSource {
  kind: 'constant'
  value: string
}
export interface SerialSource {
  kind: 'serial'
  prefix: string
  /** 起始值（显示/初始化用）；实际取值为 current 推进 */
  start: number
  step: number
  digits: number
  /** 下一张待打印标签的取值 */
  current: number
  /**
   * 字符集（可选，对标原版序列号字符集）。
   * 缺省 / 纯数字串：按数字递增并补零（digits 生效）。
   * 其它字符集（如 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'、'0123456789ABCDEF' 等）：按字符集做 1→首字符、2→次字符… 超长进位，digits 忽略。
   */
  charset?: string
}
export interface DateSource {
  kind: 'date'
  format: string
  /** 日期偏移（天），正=未来（推迟），负=过去（提前） */
  offset?: number
}
export interface TimeSource {
  kind: 'time'
  format: string
  /** 时间偏移（分钟），正=未来（推迟），负=过去（提前） */
  offset?: number
}
export interface DatabaseSource {
  kind: 'database'
  dataset: string
  field: string
}
export interface ScriptSource {
  kind: 'script'
  /** JS 脚本，定义 OnGetData() 返回标签文本；可用 V_PAGE/V_ROW/V_TITLE 等全局变量 */
  code: string
  /** 若填写，脚本返回值写入共享变量，供后续脚本对象读取 */
  sharedName?: string
}
export interface KeyboardSource {
  kind: 'keyboard'
  /** 打印时弹出的提示标签 */
  label: string
}

export type DataSource =
  | ConstantSource
  | SerialSource
  | DateSource
  | TimeSource
  | DatabaseSource
  | ScriptSource
  | KeyboardSource

/** 文本/条码对象级的显示格式化 */
export type TextFormat = 'none' | 'upper' | 'lower' | 'capitalize'

/** 截短类型（对标 LabelShop 数据源"截短变量长度"） */
export type CutType = 'none' | 'trimLeft' | 'trimRight' | 'dropLeft' | 'dropRight' | 'keepLeft' | 'keepRight'
export interface Substr {
  start: number
  length: number
  /** 截短类型（配合 cutCount） */
  cutType?: CutType
  /** 丢弃/保留的字符数 */
  cutCount?: number
}

/** 字符数限制（对标 LabelShop 数据源"字符数限制"） */
export interface LengthLimit {
  /** 限制模式 */
  mode?: 'none' | 'min' | 'max' | 'both'
  /** 最小字符数 */
  min?: number
  /** 最大字符数 */
  max?: number
  /** 长度不足时的填充方向 */
  padDir?: 'left' | 'right'
  /** 填充字符 */
  padChar?: string
  /** 超出时的截去方向 */
  trimDir?: 'left' | 'right'
}

/** 导入的数据集（CSV / Excel） */
export interface Dataset {
  name: string
  columns: string[]
  rows: string[][]
}

/** 解析数据源的上下文（批量打印时逐标签推进） */
export interface DataCtx {
  /** 标签序号，从 1 开始（按打印数量推进，序列号/记录号依据它） */
  labelIndex: number
  /** 数据库记录序号，从 0 开始 */
  recordIndex: number
  /** 单签拷贝序号，从 1 开始 */
  copy: number
  /** 打印数量 */
  count: number
  /** 本次打印标签总数（= 打印数量） */
  totalLabels: number
  title: string
  printerName: string
  datasets: Record<string, Dataset>
  /** 脚本共享命名变量 */
  sharedVars: Record<string, string>
  /** 键盘输入数据源在打印时收集到的值（按提示标签） */
  keyboardValues: Record<string, string>
  /** 预渲染单色位图（图片对象 / 含中文文本对象），按对象 id（指令打印嵌入用） */
  images?: Record<string, MonoBitmap>
  /** 数据库当前记录行（按列顺序），供颜色变量等取值 */
  recordRow?: string[]
  /** 当前激活的数据库连接/数据集名 */
  activeDataset?: string
}

/** 对象变色设置（对象的常规属性 → 变色设置） */
export interface ColorChangeConfig {
  /** 颜色变化模式：fixed=固定颜色；index=颜色索引表；variable=颜色变量 */
  mode: 'fixed' | 'index' | 'variable'
  /** 索引表来源：shared=模板公共索引表；private=对象私有索引表 */
  tableSource: 'shared' | 'private'
  /** 对象私有索引表（颜色值列表） */
  privateTable: string[]
  /** 对象变色方式：solid=整体变色；block=按区块变色；gradient=渐变变色 */
  changeMode: 'solid' | 'block' | 'gradient'
  /** 按区块变色：区块行数 */
  blockRows: number
  /** 按区块变色：区块列数 */
  blockCols: number
  /** 颜色变量模式下使用的变量名（数据库字段/键盘输入标签） */
  variableName: string
}

// ---------- 标签对象 ----------
interface BaseObj {
  id: string
  type: ObjType
  /** 单位：毫米 */
  x: number
  y: number
  w: number
  h: number
  rotation: number
  /** 图层可见性（默认可见） */
  visible?: boolean
  /** 位置锁定：编辑时不可移动/缩放 */
  locked?: boolean
  /** 不打印输出：在打印机上输出时跳过该对象（编辑仍可见） */
  suppressPrint?: boolean
  /** 水平镜像 */
  flipX?: boolean
  /** 垂直镜像 */
  flipY?: boolean
}

export interface TextObj extends BaseObj {
  /** 对象变色设置 */
  colorChange?: ColorChangeConfig
  type: 'text'
  fontFamily: string
  /** 字号，单位毫米 */
  fontSize: number
  bold: boolean
  italic?: boolean
  underline?: boolean
  /** 删除线 */
  strikeout?: boolean
  /** 反白：黑底白字 */
  reverse?: boolean
  align: 'left' | 'center' | 'right' | 'justify'
  color: string
  /** 文字背景色（未设置 = 透明） */
  backgroundColor?: string
  source: DataSource
  format?: TextFormat
  substr?: Substr
  /** 字符数限制（截短/填充/截去） */
  lengthLimit?: LengthLimit
  /** 字符模板：一个 '?' 表示原有数据的一个字符，模板中其它字符插入数据序列（如 "(01)??"） */
  charTemplate?: string
  /** 打印机内建字体名（TSPL: Font0-Font8；ZPL: A-Z/0）；设置后指令打印优先使用内建字体 */
  printerFont?: string
  /** 弧形文字：沿顶部弧线排布 */
  arc?: boolean
  /** 文字类型：单行 / 多行 / 圆形（弧形） */
  textType?: 'single' | 'multi' | 'circle'
  /** 多行垂直对齐：顶部 / 中间 / 底部 */
  verticalAlign?: 'top' | 'middle' | 'bottom'
  /** 多行行距倍率（默认 1.2） */
  lineSpacing?: number
  /** 圆形文字角度（起始角度，度，默认 0） */
  arcAngle?: number
  /** 圆形文字弧度范围（度，默认 180） */
  arcExtent?: number
  /** 圆形文字半径（mm，0 = 按对象尺寸自动） */
  arcRadius?: number
  /** 回绕方向：顺时针 / 逆时针 */
  arcDir?: 'cw' | 'ccw'
  /** 文字方向：向外 / 向内 */
  arcTextDir?: 'out' | 'in'
  /** 附加数据源（子串）：对象数据 = 主数据源 + 各子串依次连接 */
  subSources?: DataSource[]
}

/** 条码对象各码制专属选项（对标原版"条码对象的属性"各码制特殊选项页） */
export interface BarcodeOptions {
  /** GS1/EAN-128 模式（Code128 / QR / DataMatrix） */
  gs1?: boolean
  /** X 尺寸（窄条宽度，mm；0/缺省 = 按码高自动推算密度） */
  xSizeMm?: number
  /** 条宽比（宽单元 : 窄单元，如 2:1 / 3:1） */
  w2n?: number
  /** Code128 字符集：auto / a / b / c / manual */
  charset?: 'auto' | 'a' | 'b' | 'c' | 'manual'
  /** 二维码纠错级别（QR: L/M/Q/H；PDF417: 0-8；汉信码: L1-L4；DataMatrix: ECC200 固定） */
  eclevel?: string
  /** 字符编码：ansi / utf8 */
  encoding?: 'ansi' | 'utf8'
  /** QR Code 图标区域（中间留白） */
  qrIconArea?: boolean
  /** PDF417 截短型 */
  truncated?: boolean
  /** Code39 显示启始符/终止符 * */
  code39Stars?: boolean
  /** Code39 校验字符：none / mod10 / mod43 / library */
  code39Check?: 'none' | 'mod10' | 'mod43' | 'library'
  /** EAN/UPC 附加条码：none / 2 / 5 */
  eanAddon?: 'none' | '2' | '5'
  /** ITF14 校验字符 */
  itf14Check?: boolean
  /** ITF14 保护框 */
  itf14Bearer?: boolean
  /** ITF14 保护框粗细（相对 X 尺寸比值） */
  itf14BearerRatio?: number
  /** ITF14 保护框空白区（相对 X 尺寸比值） */
  itf14QuietRatio?: number
  /** 汉信码版本（auto 或具体版本） */
  hanxinVersion?: string
  /** ITF-25（Interleaved 2 of 5）校验字符（模10） */
  itf25Check?: boolean
  /** CodaBar 校验字符：none / mod10 / library */
  codabarCheck?: 'none' | 'mod10' | 'library'
  /** CodaBar 起始符：a / b / c / d */
  codabarStart?: 'a' | 'b' | 'c' | 'd'
  /** CodaBar 终止符：a / b / c / d */
  codabarStop?: 'a' | 'b' | 'c' | 'd'
  /** RSS(GS1 DataBar) 保持 GS1 规格尺寸比例 */
  rssGs1?: boolean
  /** RSS 类型：omni(全向式) / truncated(截断式) / stacked(层排式) / stackedomni(全向层排式) / limited(限定式) */
  rssType?: 'omni' | 'truncated' | 'stacked' | 'stackedomni' | 'limited'
  /** RSS 分隔符尺寸与 X 尺寸的比值 */
  rssSep?: number
}

export interface BarcodeObj extends BaseObj {
  type: 'barcode'
  /** bwip-js 的 bcid，如 code128 / ean13 / qrcode */
  symbology: string
  showText: boolean
  source: DataSource
  format?: TextFormat
  substr?: Substr
  /** 字符数限制（截短/填充/截去） */
  lengthLimit?: LengthLimit
  /** 字符模板：一个 '?' 表示原有数据的一个字符，模板中其它字符插入数据序列（如 "(01)??"） */
  charTemplate?: string
  /** 附加数据源（子串）：对象数据 = 主数据源 + 各子串依次连接 */
  subSources?: DataSource[]
  /** 各码制专属选项（GS1/纠错/校验等） */
  barcodeOptions?: BarcodeOptions
}

export interface RfidObj extends BaseObj {
  type: 'rfid'
  /** 写入区域：EPC / USER / TID */
  bank: 'EPC' | 'USER' | 'TID'
  /** 写入的数据源（通常为序列号），写入内容按数据源解析 */
  source: DataSource
  /** 附加数据源（子串）：对象数据 = 主数据源 + 各子串依次连接 */
  subSources?: DataSource[]
  /** 是否锁定（LOCK） */
  lock: boolean
  /** Access 口令（4 字节，十六进制字符串） */
  accessPwd?: string
  /** Kill 口令（4 字节，十六进制字符串） */
  killPwd?: string
  /** 读写器类型（协议）：ISO18000-6C / ISO14443 / 国标 GB/T 29768 / 军标 GJB 7377.1 等 */
  readerType?: string
  /** 起始块位置 */
  startBlock?: number
  /** 数据类型：十六进制 / ASCII */
  dataType?: 'hex' | 'ascii'
  /** EPC 区 PC 协议控制字（十六进制，ISO1800-6C） */
  pcWord?: string
  /** 国标/军标协议编码码头 */
  codeHead?: string
  /** 国标/军标协议编码长度 */
  codeLen?: number
  /** 访问控制操作：锁定 / 解锁 / 永久锁定 */
  lockOp?: 'lock' | 'unlock' | 'permanent'
  format?: TextFormat
  substr?: Substr
  /** 字符数限制（截短/填充/截去） */
  lengthLimit?: LengthLimit
  /** 字符模板：一个 '?' 表示原有数据的一个字符，模板中其它字符插入数据序列（如 "(01)??"） */
  charTemplate?: string
}

export interface RectObj extends BaseObj {
  /** 对象变色设置 */
  colorChange?: ColorChangeConfig
  type: 'rect'
  fill: string
  stroke: string
  strokeWidth: number
}

export interface LineObj extends BaseObj {
  type: 'line'
  stroke: string
  strokeWidth: number
}

export interface EllipseObj extends BaseObj {
  /** 对象变色设置 */
  colorChange?: ColorChangeConfig
  type: 'ellipse'
  fill: string
  stroke: string
  strokeWidth: number
}

export interface TableObj extends BaseObj {
  type: 'table'
  rows: number
  cols: number
  /** 线宽（mm） */
  borderWidth: number
  /** 线色 */
  borderColor: string
  /** 各列宽比例（可选，默认等分） */
  colWidths?: number[]
  /** 各行高比例（可选，默认等分） */
  rowHeights?: number[]
  /** 保持尺寸增删行列：增减行列时保持表格外框尺寸并重排行高列宽 */
  keepSize?: boolean
  /** 合并单元格：{r,c,r2,c2} 合并矩形（含边界） */
  merges?: Array<{ r: number; c: number; r2: number; c2: number }>
}

export interface ImageObj extends BaseObj {
  type: 'image'
  /** 图片内容（dataURL / file 路径）。imgType=embed 时必为 dataURL */
  src: string
  /** 图片引入类型：embed=嵌入；link=链接文件；datasource=数据源图片（文件名来自数据源） */
  imgType?: 'embed' | 'link' | 'datasource'
  /** 链接图片：图片文件路径；数据源图片：图片所在目录 */
  linkPath?: string
  /** 数据源图片：用于解析图片文件名的数据源（database 等） */
  source?: DataSource
}

/**
 * 组合对象：把多个对象组合为一个整体移动/旋转/缩放。
 * x/y 为组中心点（毫米），w/h 为组未旋转边界尺寸，rotation 为绕中心的旋转角；
 * children 坐标为绝对毫米坐标（与其它对象一致），rotation 为自身绝对旋转角。
 */
export interface GroupObj extends BaseObj {
  type: 'group'
  children: LabelObject[]
}

export type LabelObject = TextObj | BarcodeObj | RfidObj | RectObj | LineObj | EllipseObj | TableObj | ImageObj | GroupObj

/** 展平分组对象：把 group 展开为绝对坐标的子对象（用于打印/渲染），组旋转围绕组中心 */
export function flattenObjects(objects: LabelObject[]): LabelObject[] {
  const out: LabelObject[] = []
  const walk = (arr: LabelObject[]) => {
    for (const o of arr) {
      if (o.type !== 'group') {
        out.push(o)
        continue
      }
      const cx = o.x
      const cy = o.y
      const a = ((o.rotation || 0) * Math.PI) / 180
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      for (const c of o.children) {
        const dx = c.x - cx
        const dy = c.y - cy
        const abs = {
          ...c,
          x: round2(cx + dx * ca - dy * sa),
          y: round2(cy + dx * sa + dy * ca),
          rotation: round2((c.rotation || 0) + (o.rotation || 0))
        } as LabelObject
        if (abs.type === 'group') walk([abs])
        else out.push(abs)
      }
    }
  }
  walk(objects)
  return out
}

/** 单色位图（行优先、每像素 1 bit、每行字节数向上取整）——用于指令打印嵌入图片 / 中文位图 */
export interface MonoBitmap {
  width: number
  height: number
  bytesPerRow: number
  bytes: Uint8Array
}

// ---------- 打印机配置 ----------
export type CommandSet = 'tspl' | 'zpl' | 'cpcl'
export type PortType = 'driver' | 'file' | 'tcp' | 'com' | 'usb' | 'bluetooth'

export interface PortConfig {
  type: PortType
  /** TCP 直连参数 */
  tcpHost?: string
  tcpPort?: number
  /** 串口（COM）/ 蓝牙 SPP 虚拟串口参数 */
  comPort?: string
  baudRate?: number
  /** 指令文本编码：标签打印机多默认 GBK/GB18030，佳博等部分支持 UTF-8 */
  encoding: 'utf8' | 'gbk'
}

export interface PrinterConfig {
  driver: CommandSet
  /** 分辨率 203 / 300 / 600 */
  dpi: number
  /** 打印速度 1-6 */
  speed: number
  /** 浓度 1-15 */
  density: number
  /** 打印方式：打印机默认 / 热敏 / 热转印 */
  printMode: 'default' | 'thermal' | 'transfer'
  /** 标签类型：打印机默认 / 间隔定位 / 连续纸 / 标记定位 */
  labelType: 'default' | 'gap' | 'continuous' | 'mark'
  /** 顶部偏移（mm） */
  topOffsetMm: number
  /** 介质处理：撕纸 / 剥离 / 切纸 / 无 */
  mediaHandle: 'tear' | 'peel' | 'cut' | 'none'
  /** 出纸回退（mm） */
  backfeedMm: number
  /** 自定义命令：打印机参数命令（作业开始前发送一次） */
  preCmd?: string
  /** 自定义命令：标签内容命令（每张标签内容前发送） */
  contentCmd?: string
  /** 自定义命令：打印后处理命令（作业结束后发送，如切纸/回退） */
  postCmd?: string
  /** 是否将本配置保存为默认值（下次新建模板使用） */
  saveAsDefault?: boolean
  port: PortConfig
}

export function defaultPrinterConfig(): PrinterConfig {
  return {
    driver: 'tspl',
    dpi: 203,
    speed: 4,
    density: 8,
    printMode: 'thermal',
    labelType: 'gap',
    topOffsetMm: 0,
    mediaHandle: 'tear',
    backfeedMm: 0,
    port: { type: 'driver', encoding: 'utf8' }
  }
}

// ---------- 数据库连接（ODBC / SQL，对标原版数据库多连接） ----------
export type DbDriver = 'sqlserver' | 'mysql' | 'sqlite' | 'dsn'

export interface DbConnectionConfig {
  id: string
  name: string
  driver: DbDriver
  dsn?: string
  server?: string
  database?: string
  user?: string
  password?: string
  filePath?: string
  timeoutSec?: number
  /** 关联的数据集名称（查询结果导入到该数据集） */
  datasetName?: string
  /** 每次打印前自动刷新（数据库直连模式） */
  autoRefresh?: boolean
  /** 自动刷新时执行的 SQL */
  sql?: string
}

// ---------- 标签文档 ----------
export interface LabelDoc {
  version: number
  name: string
  widthMm: number
  heightMm: number
  objects: LabelObject[]
  printer?: PrinterConfig
  datasets?: Record<string, Dataset>
  connections?: Record<string, DbConnectionConfig>
  /** 模板备注 */
  remark?: string
  /** 键盘输入数据源的打印输入顺序（提示标签列表） */
  keyboardOrder?: string[]
  /** 页面上标签的排列（多标签拼版，对标原版标签格式设置-标签/其它页） */
  layout?: {
    /** 行数 */
    rows: number
    /** 列数 */
    cols: number
    /** 行间隔（mm） */
    rowGapMm: number
    /** 列间隔（mm） */
    colGapMm: number
    /** 外观形状 */
    shape: 'rect' | 'roundRect' | 'ellipse'
    /** 打印顺序：row=先行后列，col=先列后行 */
    printOrder?: 'row' | 'col'
    /** 起始位置：tl(左上) / tr(右上) / bl(左下) / br(右下) */
    startPos?: 'tl' | 'tr' | 'bl' | 'br'
    /** 打印位置微调：左侧偏移（mm） */
    offsetXMm?: number
    /** 打印位置微调：顶部偏移（mm） */
    offsetYMm?: number
  }
  /** 页面方向（0/90/180/270） */
  orientation?: number
  /** 模板库缩略图（PNG dataURL，仅模板库保存时写入，编辑器忽略） */
  thumb?: string
  /** 模板公共颜色索引表（变色设置-共享索引表） */
  colorIndexTable?: string[]
}

/** 编辑环境中画布的毫米→像素换算比例 */
export const PX_PER_MM = 10

/** 打印目标分辨率（300 dpi）对应像素/毫米 */
export const PRINT_PX_PER_MM = 300 / 25.4

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

// ---------- 数据源解析 ----------
export function formatDateLike(format: string, d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return format
    .replace(/yyyy/g, String(d.getFullYear()))
    .replace(/MM/g, p(d.getMonth() + 1))
    .replace(/dd/g, p(d.getDate()))
    .replace(/HH/g, p(d.getHours()))
    .replace(/mm/g, p(d.getMinutes()))
    .replace(/ss/g, p(d.getSeconds()))
}

/** 序列号第 labelIndex 张的取值（1-based） */
export function serialText(s: SerialSource, labelIndex: number): string {
  const value = s.current + s.step * (labelIndex - 1)
  const cs = s.charset && s.charset.length > 1 ? s.charset : ''
  // 非纯数字字符集：按字符集序列进位（1→cs[0], 2→cs[1]…）
  if (cs && !/^\d+$/.test(cs)) {
    const len = cs.length
    let n = Math.max(1, Math.floor(value))
    let out = ''
    while (n > 0) {
      out = cs[(n - 1) % len] + out
      n = Math.floor((n - 1) / len)
    }
    return s.prefix + out
  }
  return s.prefix + String(value).padStart(s.digits, '0')
}

/** 在受限作用域执行用户脚本，返回 OnGetData() 结果（对标 LabelShop 的 VBScript 生命周期） */
export function runScriptSource(code: string, ctx: DataCtx): string {
  const shared = Object.entries(ctx.sharedVars || {})
    .map(([k, v]) => `var ${k} = ${JSON.stringify(v)};`)
    .join('\n')
  const body = `${shared}
var V_PAGE=${ctx.labelIndex};
var V_COPY=${ctx.copy};
var V_LABELNO=${ctx.labelIndex};
var V_ROW=${ctx.recordIndex + 1};
var V_COL=1;
var V_TOTALLABELS=${ctx.totalLabels};
var V_TITLE=${JSON.stringify(ctx.title)};
var V_PRINTER=${JSON.stringify(ctx.printerName)};
${code}
if (typeof OnGetData === 'function') return OnGetData();
return '';`
  try {
    // eslint-disable-next-line no-new-func
    return String(new Function(body)())
  } catch {
    return ''
  }
}

const EMPTY_CTX: DataCtx = {
  labelIndex: 1,
  recordIndex: 0,
  copy: 1,
  count: 1,
  totalLabels: 1,
  title: '',
  printerName: '',
  datasets: {},
  sharedVars: {},
  keyboardValues: {}
}

/** 依据数据源取对象显示文本（ctx 缺省时按第一张标签解析，用于编辑器预览） */
export function resolveSourceText(source: DataSource, ctx: DataCtx = EMPTY_CTX): string {
  switch (source.kind) {
    case 'constant':
      return source.value
    case 'serial':
      return serialText(source, ctx.labelIndex)
    case 'date':
      return formatDateLike(source.format, new Date(Date.now() + (source.offset ?? 0) * 86400000))
    case 'time':
      return formatDateLike(source.format, new Date(Date.now() + (source.offset ?? 0) * 60000))
    case 'keyboard':
      return ctx.keyboardValues?.[source.label] ?? ''
    case 'database': {
      const ds = ctx.datasets[source.dataset]
      if (!ds || !ds.rows[ctx.recordIndex]) return ''
      const ci = ds.columns.indexOf(source.field)
      return ci >= 0 ? ds.rows[ctx.recordIndex][ci] ?? '' : ''
    }
    case 'script': {
      const out = runScriptSource(source.code, ctx)
      if (source.sharedName && out !== '') ctx.sharedVars[source.sharedName] = out
      return out
    }
  }
}

/** ASCII 控制字符表（对标 LabelShop 非打印字符：输入 <HT> 即 TAB 等） */
const CONTROL_CHAR_MAP: Record<string, number> = {
  SOH: 1, STX: 2, ETX: 3, EOT: 4, ENQ: 5, ACK: 6, BEL: 7, BS: 8, HT: 9, LF: 10,
  VT: 11, FF: 12, CR: 13, SO: 14, SI: 15, DLE: 16, DC1: 17, DC2: 18, DC3: 19,
  DC4: 20, NAK: 21, SYN: 22, ETB: 23, CAN: 24, EM: 25, SUB: 26, ESC: 27, FS: 28,
  GS: 29, RS: 30, US: 31
}

/**
 * 解码数据源文本中的控制字符标记：
 * - `<HT>` `<LF>` `<CR>` 等 → 对应 ASCII 控制字符（1-31）
 * - `<<HT>` → 字面文本 `<HT>`（转义）
 */
export function decodeControlChars(text: string): string {
  if (!text || !text.includes('<')) return text
  return text.replace(/<+([A-Z]+)>/g, (m, name: string) => {
    const code = CONTROL_CHAR_MAP[name]
    if (code === undefined) return m
    // 每多一个 "<" 前缀表示一层转义：<<X> → <X>；<<<X> → <<X>
    const depth = m.indexOf(name)
    if (depth > 1) return '<'.repeat(depth - 1) + name + '>'
    return String.fromCharCode(code)
  })
}

/** 截短：删除左右空格 / 丢弃左右字符 / 保留左右字符 */
function applyCut(text: string, cut?: CutType, n = 0): string {
  switch (cut) {
    case 'trimLeft': return text.replace(/^\s+/, '')
    case 'trimRight': return text.replace(/\s+$/, '')
    case 'dropLeft': return text.slice(Math.min(n, text.length))
    case 'dropRight': return n >= text.length ? '' : text.slice(0, text.length - n)
    case 'keepLeft': return text.slice(0, Math.min(n, text.length))
    case 'keepRight': return n >= text.length ? text : text.slice(text.length - n)
    default: return text
  }
}

/** 字符数限制：长度下限填充 + 长度上限截去 */
function applyLengthLimit(text: string, lim?: LengthLimit): string {
  if (!lim || !lim.mode || lim.mode === 'none') return text
  let t = text
  const min = lim.mode === 'min' || lim.mode === 'both' ? Math.max(0, lim.min || 0) : 0
  const max = lim.mode === 'max' || lim.mode === 'both' ? Math.max(0, lim.max || 0) : 0
  if (max > 0 && t.length > max) {
    const pad = lim.trimDir === 'left' ? t.slice(t.length - max) : t.slice(0, max)
    t = pad
  }
  if (min > 0 && t.length < min) {
    const padChar = lim.padChar && lim.padChar.length > 0 ? lim.padChar[0] : ' '
    const fill = padChar.repeat(min - t.length)
    t = lim.padDir === 'right' ? t + fill : fill + t
  }
  return t
}

/** 对象级显示变换：截短 + 子串 + 格式化 + 字符数限制（作用于解析后的文本） */
export function applyObjectFormat(text: string, format?: TextFormat, substr?: Substr, lengthLimit?: LengthLimit, charTemplate?: string): string {
  let t = text
  if (substr && substr.cutType && substr.cutType !== 'none') {
    t = applyCut(t, substr.cutType, substr.cutCount || 0)
  }
  if (substr) {
    const start = Math.max(0, substr.start || 0)
    // 长度 0/缺省 = 不截取子串（保留到末尾，若 start>0 则从 start 起）
    if (substr.length && substr.length > 0) t = t.slice(start, start + substr.length)
    else if (start > 0) t = t.slice(start)
  }
  if (format === 'upper') t = t.toUpperCase()
  else if (format === 'lower') t = t.toLowerCase()
  else if (format === 'capitalize') t = t.charAt(0).toUpperCase() + t.slice(1)
  // 字符模板：一个 '?' 表示原有数据的一个字符，模板中其它字符插入数据序列
  if (charTemplate && charTemplate.indexOf('?') >= 0) {
    let ci = 0
    t = charTemplate.replace(/\?/g, () => (ci < t.length ? t[ci++] : ''))
  }
  t = applyLengthLimit(t, lengthLimit)
  return t
}

/** 取文本/条码对象实际显示文本（数据源 + 控制字符 + 截短 + 子串 + 格式化 + 字符数限制） */
export function resolveObjectText(obj: { source: DataSource; format?: TextFormat; substr?: Substr; lengthLimit?: LengthLimit; subSources?: DataSource[]; charTemplate?: string }, ctx: DataCtx = EMPTY_CTX): string {
  // 多数据源（子串）连接：主数据源 + 各附加子串依次连接；先解码控制字符（<HT>→TAB 等）
  if (!ctx.sharedVars) (ctx as { sharedVars: Record<string, string> }).sharedVars = {}
  let t = decodeControlChars(resolveSourceText(obj.source, ctx))
  for (const sub of obj.subSources ?? []) {
    const sh = (sub as { sharedName?: string }).sharedName
    // 共享变量：同一次打印（同一 DataCtx）内同名子串只解析一次，多对象引用同一值
    let subText = ''
    if (sh && ctx.sharedVars[sh] !== undefined) subText = ctx.sharedVars[sh]
    else {
      subText = decodeControlChars(resolveSourceText(sub, ctx))
      if (sh) ctx.sharedVars[sh] = subText
    }
    t += subText
  }
  // 截短/子串/长度限制等高级处理基于连接后的完整文本
  return applyObjectFormat(t, obj.format, obj.substr, obj.lengthLimit, obj.charTemplate)
}

/** 打印 count 张后推进序列号 current */
export function advanceSerial(source: DataSource, count: number): DataSource {
  if (source.kind !== 'serial') return source
  return { ...source, current: source.current + source.step * count }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 解析对象变色后的颜色：index=索引表取色；variable=变量取色；fixed 返回 fallback */
export function resolveObjectColor(
  obj: { colorChange?: ColorChangeConfig },
  ctx: DataCtx | undefined,
  fallback: string,
  sharedTable?: string[]
): string {
  const cc = obj.colorChange
  if (!cc || cc.mode === 'fixed') return fallback
  if (cc.mode === 'index') {
    const table = cc.tableSource === 'shared' ? (sharedTable ?? []) : (cc.privateTable ?? [])
    if (!table.length) return fallback
    const recIdx = ctx ? (ctx.recordIndex >= 0 ? ctx.recordIndex : ctx.labelIndex - 1) : 0
    const idx = ((recIdx % table.length) + table.length) % table.length
    return table[idx] || fallback
  }
  if (cc.mode === 'variable') {
    const name = cc.variableName
    if (!name) return fallback
    const kv = ctx?.keyboardValues?.[name]
    if (kv) return kv
    const ds = ctx?.activeDataset ? ctx.datasets?.[ctx.activeDataset] : undefined
    if (ds && ctx) {
      const col = ds.columns.indexOf(name)
      if (col >= 0 && ctx.recordRow && ctx.recordRow[col] != null) return ctx.recordRow[col] || fallback
    }
    return fallback
  }
  return fallback
}
/** 数据源类型中文名（用于"修改数据"对话框等） */
export function sourceLabel(s?: DataSource): string {
  if (!s) return '—'
  switch (s.kind) {
    case 'constant': return '固定数据'
    case 'serial': return '序列号'
    case 'date': return '日期'
    case 'time': return '时间'
    case 'database': return '数据库'
    case 'keyboard': return '键盘输入'
    case 'script': return '脚本'
  }
}