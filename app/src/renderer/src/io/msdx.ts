// MaxLabel 默认文档格式（.msdx）：JSON 信封包裹 LabelDoc，便于版本演进与向后兼容
import { DOCUMENT_MODEL_VERSION, migrateDocument, normalizeDocument, redactDocumentSecrets, type LabelDoc } from '../../../shared/domain'

export const MSDX_FORMAT = 'maxlabel-msdx'
export const MSDX_VERSION = 2

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
    doc: redactDocumentSecrets(doc)
  }
  return JSON.stringify(envelope, null, 2)
}

/**
 * 解析文档内容：
 * - msdx 信封（format=maxlabel-msdx）→ 取 doc
 * - 旧版裸 LabelDoc JSON（.json）→ 直接返回
 */
export function fromDocJson(content: string): LabelDoc {
  const p = JSON.parse(content) as unknown
  if (!p || typeof p !== 'object') throw new Error('模板格式不正确')
  const envelope = p as Partial<MsdxEnvelope>
  if (envelope.format === MSDX_FORMAT) {
    if (typeof envelope.version !== 'number' || envelope.version > DOCUMENT_MODEL_VERSION) {
      throw new Error(`模板文件版本不受支持（最高 v${DOCUMENT_MODEL_VERSION}）`)
    }
    return normalizeDocument(migrateDocument(envelope.doc))
  }
  return normalizeDocument(migrateDocument(p))
}

/** 判断内容是否为 LabelShop lsdx 文件 */
export function looksLikeLsdx(content: string): boolean {
  const t = content.trimStart()
  return t.startsWith('<?xml') && t.includes('<labelshopdocument')
}
