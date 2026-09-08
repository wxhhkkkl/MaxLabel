// MaxLabel 默认文档格式（.msdx）：JSON 信封包裹 LabelDoc，便于版本演进与向后兼容
import type { LabelDoc } from '../types'

export const MSDX_FORMAT = 'maxlabel-msdx'
export const MSDX_VERSION = 1

export interface MsdxEnvelope {
  format: typeof MSDX_FORMAT
  version: number
  app: string
  doc: LabelDoc
}

/** 序列化 LabelDoc 为 msdx 文本 */
export function toMsdx(doc: LabelDoc): string {
  const envelope: MsdxEnvelope = {
    format: MSDX_FORMAT,
    version: MSDX_VERSION,
    app: 'MaxLabel',
    doc
  }
  return JSON.stringify(envelope, null, 2)
}

/**
 * 解析文档内容：
 * - msdx 信封（format=maxlabel-msdx）→ 取 doc
 * - 旧版裸 LabelDoc JSON（.json）→ 直接返回
 */
export function fromDocJson(content: string): LabelDoc {
  const p = JSON.parse(content) as MsdxEnvelope | LabelDoc
  if (!p || typeof p !== 'object') throw new Error('模板格式不正确')
  if ((p as MsdxEnvelope).format === MSDX_FORMAT && (p as MsdxEnvelope).doc) {
    return (p as MsdxEnvelope).doc as LabelDoc
  }
  return p as LabelDoc
}

/** 判断内容是否为 LabelShop lsdx 文件 */
export function looksLikeLsdx(content: string): boolean {
  const t = content.trimStart()
  return t.startsWith('<?xml') && t.includes('<labelshopdocument')
}
