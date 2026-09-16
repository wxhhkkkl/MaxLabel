/**
 * 码制字符集与位数约束（帮助 `barcode_summary.html`）。
 *
 * 帮助原文要点（逐条落到本表）：
 * - EAN-13 13 位 / EAN-8 8 位 / UPC-A 12 位 / UPC-E 7 位，纯数字、定长，
 *   最后一位是校验字符；EAN-13 与 UPC-A 允许只输入数据位由软件补校验字符。
 * - Code 39 可表示数字、英文字母以及 `-` `.` `/` `+` `%` `$` 空格和 `*` 共 44 个符号，
 *   其中 `*` 仅作为启始符和终止符，不能出现在数据里。
 * - Code 128 可表示 ASCII 0 到 ASCII 127 共 128 个字符（含数字、字母和符号）。
 *
 * 本模块只做「用户可见的码制特性校验」，供条码属性页显示与提示；
 * 渲染与指令输出仍由 `editor/barcode.ts` 的 `resolveBarcode` 统一解析。
 */

export interface BarcodeCharsetSpec {
  /** 帮助里的码制名 */
  name: string
  /** 数据字符集描述（属性页直接显示） */
  charset: string
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

export const BARCODE_CHARSETS: Record<string, BarcodeCharsetSpec> = {
  ean13: {
    name: 'EAN-13',
    charset: '数字 0-9，共 13 位（前 12 位为数据、最后 1 位为校验字符）',
    digits: { dataChars: 12, totalChars: 13 },
    digitsOnly: true
  },
  ean8: {
    name: 'EAN-8',
    charset: '数字 0-9，共 8 位（前 7 位为数据、最后 1 位为校验字符）',
    digits: { dataChars: 7, totalChars: 8 },
    digitsOnly: true
  },
  upca: {
    name: 'UPC-A',
    charset: '数字 0-9，共 12 位（前 11 位为数据、最后 1 位为校验字符）',
    digits: { dataChars: 11, totalChars: 12 },
    digitsOnly: true
  },
  upce: {
    name: 'UPC-E',
    charset: '数字 0-9，共 7 位（缩短版 UPC，含 1 位校验字符）',
    digits: { dataChars: 6, totalChars: 7 },
    digitsOnly: true
  },
  code39: {
    name: 'Code 39',
    charset: '可表示数字、英文字母以及 - . / + % $ 空格，共 44 个符号；* 仅作启始符和终止符',
    allowed: CODE39_DATA_CHARS + 'abcdefghijklmnopqrstuvwxyz',
    reserved: { chars: '*', message: 'Code 39：「*」仅作为启始符和终止符，不能作为数据字符。' }
  },
  code128: {
    name: 'Code 128',
    charset: 'ASCII 0 – ASCII 127 共 128 个字符（数字、字母与符号）',
    maxAscii: 127
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
