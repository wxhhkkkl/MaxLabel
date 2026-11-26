// MaxLabel 默认文档格式（.msdx）：JSON 信封包裹 LabelDoc，便于版本演进与向后兼容
import { DOCUMENT_MODEL_VERSION, migrateDocument, normalizeDocument, redactDocumentSecrets, type ImageObj, type LabelDoc, type LabelObject } from '../../../shared/domain'
import { dirnameDocumentPath, isAbsoluteDocumentPath, relativeImagePath } from './documentImagePaths'

export const MSDX_FORMAT = 'maxlabel-msdx'
export const MSDX_VERSION = 3

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

export interface MsdxLocalSaveOptions {
  /** 目标 .msdx 路径；模板目录内的图片会写成相对路径。 */
  targetPath: string
  /** 云图片对象 id → 已导出文件的相对（或跨盘绝对）路径。 */
  cloudImageLinks?: Record<string, string>
}

function isInsideDirectory(dir: string, filePath: string): boolean {
  if (!dir) return false
  const relative = relativeImagePath(dir, filePath)
  return relative !== null && relative !== '' && relative !== '..' && !relative.startsWith('../')
}

function localSaveObjects(
  objects: LabelObject[],
  targetDir: string,
  cloudImageLinks: Record<string, string> | undefined
): LabelObject[] {
  return objects.map((object) => {
    if (object.type === 'group') {
      return { ...object, children: localSaveObjects(object.children, targetDir, cloudImageLinks) }
    }
    if (object.type !== 'image') return object
    const cloudLink = cloudImageLinks?.[object.id]
    if (cloudLink && object.cloudImage) {
      const localized: ImageObj = { ...object }
      delete localized.cloudImage
      return { ...localized, imgType: 'link', linkPath: cloudLink, src: '' }
    }
    if ((object.imgType === 'link' || object.imgType === 'datasource') &&
      object.linkPath && isAbsoluteDocumentPath(object.linkPath) && isInsideDirectory(targetDir, object.linkPath)) {
      const relative = relativeImagePath(targetDir, object.linkPath)
      if (relative) return { ...object, linkPath: relative }
    }
    return object
  })
}

/** 本地另存为：云图片改为本地相对链接，模板目录内的链接图片也写成相对路径。 */
export function toMsdxForLocalSave(doc: LabelDoc, options: MsdxLocalSaveOptions): string {
  const targetDir = dirnameDocumentPath(options.targetPath)
  return toMsdx({
    ...doc,
    objects: localSaveObjects(doc.objects, targetDir, options.cloudImageLinks)
  })
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

/** 判断内容是否为 原版 lsdx 文件 */
export function looksLikeLsdx(content: string): boolean {
  const t = content.trimStart()
  return t.startsWith('<?xml') && t.includes('<labelshopdocument')
}

/** 判断内容是否为 LabelShop 云端私有 JSON（docid/lfrm/pfrm），非 MaxLabel LabelDoc。 */
export function looksLikeLegacyCloudJson(content: string): boolean {
  try {
    const parsed = JSON.parse(content) as unknown
    if (!parsed || typeof parsed !== 'object') return false
    const obj = parsed as Record<string, unknown>
    return 'docid' in obj || 'lfrm' in obj || 'pfrm' in obj
  } catch {
    return false
  }
}

export type CloudContentKind = 'lsdx' | 'archive-json' | 'doc-json'

/** 云端内容分类：原版 lsdx / 旧版不私有 JSON 归档 / MaxLabel JSON。 */
export function cloudContentKind(content: string, name?: string): CloudContentKind {
  if (looksLikeLsdx(content)) return 'lsdx'
  const lower = (name ?? '').toLowerCase()
  if (lower.endsWith('.json') && looksLikeLegacyCloudJson(content)) return 'archive-json'
  return 'doc-json'
}
