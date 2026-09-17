/**
 * 码制特性总表（帮助 `barcode_summary.html` 与各码制特殊选项专页）。
 *
 * 帮助原文要点（逐条落到本表）：
 * - 商品条码 EAN/UPC：EAN-13 13 位、EAN-8 8 位、UPC-A 12 位、UPC-E 7 位；
 *   无含义、定长、纯数字，最后一位是校验字符；中国商品以 690-699 开头；
 *   特殊选项「附加条码」可增加 2 位或 5 位附加码。
 * - Code 39：数字、英文字母以及 `-` `.` `/` `+` `%` `$` 空格和 `*` 共 44 个符号，
 *   `*` 仅作启始符和终止符，仅有两种单元宽度；1974 年由 Intermec 发明，对应 GB12908-2002。
 * - Code 128：ASCII 0 – ASCII 127 共 128 个字符；实际包含三个字符集（A/B/C），每组 102 个字符；
 *   特殊选项为「GS1/EAN-128」与「字符集（自动/字符集A/字符集B/字符集C/手动设置）」。
 * - Code 93：帮助明确「93码没有相关的特殊选项」。
 * - 交叉 25 码：识读率高、密度较高，同样标签大小与位数下窄条宽度更宽；
 *   25 码特殊选项「校验字符」包括 Code25、ITF25、Matrix25 和中国邮政码，签赋LabelShop 用模10校验。
 * - Codabar：数字 0-9 与 `$` `+` `-`，另有只能用作起始/终止符的 a、b、c、d；
 *   非连续性条码，每个字符 4 条 3 空；空白区比窄条宽 10 倍；可变长度、没有校验位。
 * - ITF 14：字符集与交叉二五码相同，连续型、定长、自带校验功能；
 *   由矩形保护框、左侧空白区、条码字符、右侧空白区组成；特殊选项为「检验字符」与「保护框」。
 * - RSS / GS1 DataBar：特殊选项为「保持 GS1 规格」「类型」「分隔符」。
 * - PDF417：每符号字符 4 条 4 空、总模块数一定为 17；每层最少三列；层高默认为 X 尺寸的三倍。
 * - QR Code：1994 年 9 月由日本 Denso 研制，正方形、3 个角落有「回」字定位图案；
 *   可放 1817 个汉字、7089 个数字、4200 个英文字母。
 * - Data Matrix：可编码全部 ASCII 及扩充 ASCII 共 256 个字元；最大 14 平方英寸、最小 0.0002 平方英寸；
 *   读取资料的 20% 即可辨读；最大储存量 2,000 bytes；只支持 ECC200。
 * - 汉信码：我国第一个制定国家标准的二维码；最多 7829 个数字、4350 个 ASCII 字符、
 *   2174 个汉字、3262 个 8 位字节。
 *
 * 本模块只做「用户可见的码制特性展示与校验」，供条码属性页显示与提示；
 * 渲染与指令输出仍由 `editor/barcode.ts` 的 `resolveBarcode` 统一解析。
 */

export interface BarcodeCharsetSpec {
  /** 帮助里的码制名 */
  name: string
  /** 数据字符集描述（属性页直接显示） */
  charset?: string
  /** 发明人/标准/来源 */
  origin?: string
  /** 符号的结构与组成 */
  structure?: string
  /** 存储容量 */
  capacity?: string
  /** 校验字符与纠错能力 */
  check?: string
  /** 密度与识读特性 */
  reading?: string
  /** 特殊选项（帮助原文的分组与选项名） */
  specialOptions?: string[]
  /** 帮助原文的附加说明（与其它码制的关系、标准提示等） */
  note?: string
  /** 定长数字码制的位数信息；非数字码制为 undefined */
  digits?: {
    /** 数据位数（不含校验字符） */
    dataChars: number
    /** 最终位数（含校验字符） */
    totalChars: number
  }
  /** 是否把最后一个输入字符当校验字符校验 */
  digitsOnly?: boolean
  /** 数据位可用字符集合；给定时用于逐字符判定 */
  allowed?: string
  /** 出现在数据里必须报错的字符（如 Code 39 的 `*`） */
  reserved?: { chars: string; message: string }
  /** 可接受的最大 ASCII 码（Code 128 为 127） */
  maxAscii?: number
}

/** `-` `.` `/` `+` `%` `$` 与空格加上数字与英文字母（`*` 单列为启止符） */
const CODE39_DATA_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%'

/** EAN/UPC 共用「附加条码」特殊选项（帮助 `label_object_page_barcode_ean13.html`） */
const EAN_ADDON_OPTIONS = ['附加条码：无 / 2 位附加码 / 5 位附加码']

/**
 * 共用同一组 25 码特殊选项的码制（帮助 `label_object_page_barcode.html`：
 * 「25 码的特殊选项（提示：包括Code25、ITF25、Matrix25和中国邮政码）」）。
 */
export const TWENTY_FIVE_CODE_SYMBOLOGIES = ['interleaved2of5', 'industrial2of5', 'matrix2of5', 'datalogic2of5']

const TWENTY_FIVE_OPTIONS = ['校验字符：是否在条码中添加校验字符（本组选项包括 Code25、ITF25、Matrix25 和中国邮政码）']

/** 25 码共用说明（帮助 `label_object_page_barcode_itl25.html`） */
const TWENTY_FIVE_NOTE =
  '25 码符号类型规范中并不包括校验符，但一般仍可使用校验字符来提高条码的安全性；此种条码的校验字符正确性需要用户程序自行检验。在签赋LabelShop 中，25 码使用模10校验字符；更多校验要求可通过脚本功能来实现。'

export const BARCODE_CHARSETS: Record<string, BarcodeCharsetSpec> = {
  // ———— 商品条码 EAN / UPC ————
  ean13: {
    name: 'EAN-13',
    charset: '数字 0-9，共 13 位（前 12 位为数据、最后 1 位为校验字符）',
    origin: '国际物品编码协会（EAN）在全球推广的商品条码标准版',
    structure: '无含义、定长、纯数字的条形码，主要用于商品标识',
    check: '最后一位是校验字符',
    note: '中国的商品以 690-699 开头，后面是厂商识别码和商品项目代码，最后一位是校验字符。',
    specialOptions: EAN_ADDON_OPTIONS,
    digits: { dataChars: 12, totalChars: 13 },
    digitsOnly: true
  },
  ean8: {
    name: 'EAN-8',
    charset: '数字 0-9，共 8 位（前 7 位为数据、最后 1 位为校验字符）',
    origin: 'EAN 码体系的缩短版',
    structure: '定长、纯数字的商品条码',
    check: '最后一位是校验字符',
    specialOptions: EAN_ADDON_OPTIONS,
    digits: { dataChars: 7, totalChars: 8 },
    digitsOnly: true
  },
  upca: {
    name: 'UPC-A',
    charset: '数字 0-9，共 12 位（前 11 位为数据、最后 1 位为校验字符）',
    origin: 'UPC 码的标准版，主要用于美国和加拿大地区',
    check: '最后一位是校验字符',
    specialOptions: EAN_ADDON_OPTIONS,
    digits: { dataChars: 11, totalChars: 12 },
    digitsOnly: true
  },
  upce: {
    name: 'UPC-E',
    charset: '数字 0-9，共 7 位（缩短版 UPC，含 1 位校验字符）',
    origin: 'UPC 码的缩短版，主要用于美国和加拿大地区',
    specialOptions: EAN_ADDON_OPTIONS,
    digits: { dataChars: 6, totalChars: 7 },
    digitsOnly: true
  },

  // ———— 一维码 ————
  code39: {
    name: 'Code 39',
    charset: '可表示数字、英文字母以及 - . / + % $ 空格，共 44 个符号；* 仅作启始符和终止符',
    origin: 'Intermec 公司于 1974 年发明，我国对应国家标准 GB12908-2002',
    structure: '仅有两种单元宽度',
    reading:
      '编码规则简单、误码率低、所能表示字符个数多，广泛应用于工业生产线、图书管理、快递物流、仓库管理等领域',
    specialOptions: [
      '启始符/终止符：是否在供人识读的字符中显示 39 码的启始符和终止符「*」',
      '校验字符：无 / 模10校验 / 模43校验 / 图书馆用校验码'
    ],
    allowed: CODE39_DATA_CHARS + 'abcdefghijklmnopqrstuvwxyz',
    reserved: { chars: '*', message: 'Code 39：「*」仅作为启始符和终止符，不能作为数据字符。' }
  },
  code128: {
    name: 'Code 128',
    charset: 'ASCII 0 – ASCII 127 共 128 个字符（数字、字母与符号）',
    origin: '1981 年引入的高密度条码',
    structure:
      '实际包含三个字符集，每个 102 个字符：字符集A 为全 ASCII 除 26 个小写字母、字符集B 为全 ASCII 除 26 个控制字符、字符集C 为双密度数字（100 个字符表示 00 到 99）',
    reading: '比 Code 39 能表现更多字符、单位长度的编码密度更高，但 Code 39 具有更好的试读性',
    specialOptions: [
      'GS1/EAN-128：勾选后自动添加字符并生成 UCC/EAN-128，可用 ^1 插入 FNC1 功能字符',
      '字符集：自动 / 字符集A / 字符集B / 字符集C / 手动设置（^A ^B ^C 表示 START A/B/C，^1–^4 表示 FNC1–FNC4）'
    ],
    note: '字符集默认设置为「自动」，应用程序自动选择最有效的字符集并可在字符集之间自动切换，以减少整个条码的尺寸。',
    maxAscii: 127
  },
  code93: {
    name: 'Code 93',
    note: '93码没有相关的特殊选项。',
    specialOptions: []
  },
  codabar: {
    name: 'Codabar（库德巴码）',
    charset: '数字 0-9、字符 $、+、-，以及只能用作起始/终止符的 a、b、c、d 四个字符',
    structure: '非连续性条形码，每个字符表示为 4 条 3 空；空白区比窄条宽 10 倍',
    check: '可变长度，没有校验位',
    reading: '主要应用于物料管理、图书馆、血库血站和机场包裹发送跟踪管理',
    specialOptions: [
      '校验字符：无 / 模10校验 / 图书馆用校验码',
      '起始符：从 a – d 中选择一个作为起始符',
      '终止符：从 a – d 中选择一个作为终止符'
    ],
    reserved: {
      chars: 'abcdABCD',
      message: 'Codabar：a、b、c、d 只能用作起始符/终止符，请在「起始符」「终止符」选项里设置。'
    }
  },
  interleaved2of5: {
    name: 'Interleaved 25（交叉25 码）',
    reading:
      '主要应用于商品批发、仓库、机场、生产/包装识别、工业中；条形码的识读率高，可适用于固定条码扫描器可靠扫描，在所有一维条形码中的密度较高',
    structure: '标签大小以及位数相同时窄条宽度更宽，因此即使打印机打印质量不好也可以打印，并允许从远距离读取条码',
    specialOptions: TWENTY_FIVE_OPTIONS,
    note: TWENTY_FIVE_NOTE
  },
  industrial2of5: {
    name: 'Code 25 码',
    specialOptions: TWENTY_FIVE_OPTIONS,
    note: `与 ITF25、Matrix25 和中国邮政码共用同一组 25 码特殊选项。${TWENTY_FIVE_NOTE}`
  },
  matrix2of5: {
    name: 'Matrix 25 码',
    specialOptions: TWENTY_FIVE_OPTIONS,
    note: `与 Code25、ITF25 和中国邮政码共用同一组 25 码特殊选项。${TWENTY_FIVE_NOTE}`
  },
  datalogic2of5: {
    name: 'China Post 中国邮政码',
    specialOptions: TWENTY_FIVE_OPTIONS,
    note: `归入 25 码特殊选项分组，与 Code25、ITF25、Matrix25 共用校验字符设置。${TWENTY_FIVE_NOTE}`
  },
  itf14: {
    name: 'ITF 14',
    charset: '条码字符集与交插二五码相同',
    structure: '连续型、定长、自带校验功能的双向条码，条与空都表示信息；由矩形保护框、左侧空白区、条码字符、右侧空白区组成',
    check: '标准中需要一个检验字符，因此建议总是选中校验字符项',
    reading:
      '主要用于商品运输包装上标识非零售的商品，比较适合直接印制（热转印或喷墨）于表面不够光滑、受力后尺寸易变形的包装材料，如瓦楞纸或纤维板上',
    specialOptions: ['检验字符：是否为 ITF14 加入一个校验字符（建议总是选中）', '保护框：粗细与空白区分别设置与 X 尺寸的比值'],
    note: '保护框用来防止打印压力直接集中在条码上并保持均匀的打印压力。'
  },
  databaromni: {
    name: 'RSS GS1 DataBar',
    specialOptions: [
      '保持 GS1 规格：条码的尺寸比例保持 GS1 标准推荐的尺寸比例',
      '类型：全向式 / 截断式 / 层排式 / 全向层排式 / 限定式',
      '分隔符：分隔符尺寸与 X 尺寸的比值'
    ]
  },

  // ———— 二维码 ————
  pdf417: {
    name: 'PDF417（便携数据文件码）',
    origin: 'PDF 取英文 Portable Data File 三个单词的首字母，意为「便携数据文件」',
    structure:
      '组成条码的每一符号字符由 4 个条和 4 个空构成；将最窄条或空称为一个模块，4 个条和 4 个空的总模块数一定为 17；每层最少由三列（12 个条和 12 个空）信息组成',
    capacity: '本身可存储大量数据，应用于医院、驾驶证、物料管理、货物运输',
    check: '当条形码受一定破坏时，错误纠正能使条形码正确解码',
    reading: '每层高度默认设置为 X 尺寸的三倍；列数设为「自动」时层数与列数自动调整，使整个条码的宽度与高度的比值接近 2 : 1',
    specialOptions: ['截短型 PDF417：右侧终止符替换成一个竖条以节省空间', '纠错级别', '层数：每层的高度', '列数：数据区域中列的数目，范围 1 到 30']
  },
  qrcode: {
    name: 'QR Code',
    origin: '日本 Denso 公司于 1994 年 9 月研制的矩阵二维码符号',
    structure: '呈正方形，在 3 个角落印有像「回」字的定位图案；用户不需要对准，无论以任何角度扫描数据仍可正确被读取',
    capacity: '容量密度大，可以放入 1817 个汉字、7089 个数字、4200 个英文字母',
    check: '可靠性高、抗损毁能力强',
    specialOptions: ['GS1 模式', '纠错级别', '字符编码：ANSI / UTF-8', '图标区域：设置中间空白区位置，用于插入其他图标']
  },
  datamatrix: {
    name: 'Data Matrix',
    charset: '可编码字符集包括全部的 ASCII 字元及扩充 ASCII 字元，共 256 个字元',
    structure: '尺寸可任意调整，最大可到 14 平方英寸、最小可到 0.0002 平方英寸，尺寸与编入的资料量相互独立',
    capacity: '最大储存量为 2,000 bytes',
    check: '自动纠正错误的能力较低；签赋LabelShop 只支持 ECC200',
    reading: '只需要读取资料的 20% 即可精确辨读，特别适合在条码容易受损的场所',
    specialOptions: ['GS1 模式', '纠错级别：签赋LabelShop 只支持 ECC200', '字符编码：ANSI / UTF-8']
  },
  hanxin: {
    name: '汉信码',
    origin: '我国第一个制定了国家标准并且拥有自主知识产权的二维码',
    capacity: '最多可以表示 7829 个数字、4350 个 ASCII 字符、2174 个汉字、3262 个 8 位字节信息',
    check: '极高的二进制数据等信息的编码效率，纠错及抗污损变形能力强',
    reading: '汉字信息表示达到国际领先水平，识读速度快；支持照片、指纹、掌纹、签字、声音、文字等数字化信息的编码',
    specialOptions: ['纠错级别', '字符编码：ANSI / UTF-8', '版本：汉信码符号的版本，建议选择自动']
  }
}

/** 码制显示名（未知码制回落到输入串本身） */
export function barcodeCharsetName(symbology: string): string {
  return BARCODE_CHARSETS[symbology]?.name ?? symbology
}

/** 属性页「码制特性」提示文字：帮助写明该码制的字符集与位数 */
export function barcodeCharsetLabel(symbology: string): string {
  return BARCODE_CHARSETS[symbology]?.charset ?? ''
}

/**
 * 属性页「码制特性」面板的行（帮助 `barcode_summary.html` 逐条对应）。
 * 只输出帮助写明了的字段，文档未写的细节一律不补。
 */
export function barcodeSpecRows(symbology: string): Array<{ key: string; label: string; value: string }> {
  const spec = BARCODE_CHARSETS[symbology]
  if (!spec) return []
  const rows: Array<{ key: string; label: string; value: string }> = []
  const push = (key: string, label: string, value?: string) => {
    if (value && value.trim() !== '') rows.push({ key, label, value })
  }
  push('charset', '字符集', spec.charset)
  push('origin', '来源', spec.origin)
  push('structure', '符号结构', spec.structure)
  push('capacity', '容量', spec.capacity)
  push('check', '校验与纠错', spec.check)
  push('reading', '识读特性', spec.reading)
  return rows
}

/** 该码制的特殊选项清单（帮助原文选项名；空数组表示帮助写明「没有相关的特殊选项」） */
export function barcodeSpecialOptions(symbology: string): string[] {
  return BARCODE_CHARSETS[symbology]?.specialOptions ?? []
}

/** 该码制是否归入「25 码特殊选项」分组（Code25 / ITF25 / Matrix25 / 中国邮政码） */
export function usesTwentyFiveOptions(symbology: string): boolean {
  return TWENTY_FIVE_CODE_SYMBOLOGIES.includes(symbology)
}

export interface BarcodeContentCheck {
  ok: boolean
  /** 不合法时给出与帮助一致的说明；合法时为空串 */
  message: string
}

const OK: BarcodeContentCheck = { ok: true, message: '' }

/**
 * EAN/UPC 校验字符（帮助 `barcode_summary.html`：最后一位是校验字符）。
 * 权重自右向左 3、1 交替（UPC-A/EAN-13 口径），EAN-8 同法。
 */
export function eanCheckDigit(dataChars: string): string {
  const digits = dataChars.replace(/[^0-9]/g, '')
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    const d = parseInt(digits[digits.length - 1 - i], 10) || 0
    sum += i % 2 === 0 ? d * 3 : d
  }
  return String((10 - (sum % 10)) % 10)
}

/** 校验条码内容是否符合该码制的字符集与位数（帮助 `barcode_summary.html`） */
export function validateBarcodeContent(symbology: string, text: string): BarcodeContentCheck {
  const spec = BARCODE_CHARSETS[symbology]
  if (!spec) return OK
  const value = (text ?? '').trim()
  if (value === '') return OK

  if (spec.reserved) {
    for (const ch of spec.reserved.chars) {
      if (value.includes(ch)) return { ok: false, message: spec.reserved.message }
    }
  }

  if (spec.digitsOnly && spec.digits) {
    if (!/^[0-9]+$/.test(value)) {
      return { ok: false, message: `${spec.name} 只能使用数字 0-9，当前内容含非数字字符。` }
    }
    const { dataChars, totalChars } = spec.digits
    if (value.length === dataChars) return OK
    if (value.length === totalChars) {
      const expected = eanCheckDigit(value.slice(0, dataChars))
      const actual = value.slice(-1)
      if (actual !== expected) {
        return { ok: false, message: `${spec.name} 校验字符错误：应为 ${expected}，当前为 ${actual}。` }
      }
      return OK
    }
    return {
      ok: false,
      message: `${spec.name} 需要 ${dataChars} 位数据（可再补 1 位校验字符，共 ${totalChars} 位），当前 ${value.length} 位。`
    }
  }

  if (spec.allowed) {
    const bad = [...value].find((ch) => !spec.allowed!.includes(ch))
    if (bad) return { ok: false, message: `${spec.name} 不支持字符「${bad}」。可用：${spec.charset}` }
  }

  if (spec.maxAscii !== undefined) {
    const bad = [...value].find((ch) => ch.charCodeAt(0) > spec.maxAscii!)
    if (bad) return { ok: false, message: `${spec.name} 只能表示 ASCII 0 – ASCII 127，「${bad}」超出范围。` }
  }

  return OK
}
