import type { ImageObj, LabelDoc, LabelObject } from '../types'

/**
 * 模板里的图片路径约定：
 * - 运行时（编辑、打印、属性页）一律使用绝对路径；
 * - 保存 .msdx 时，模板目录内的图片写成相对路径，便于连同图片目录一起拷贝；
 * - 打开 .msdx 时把相对路径按模板所在目录还原成绝对路径。
 */

export function isAbsoluteDocumentPath(value: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(value) || /^(?:\\\\|\/)/.test(value)
}

export function dirnameDocumentPath(value: string): string {
  const index = Math.max(value.lastIndexOf('\\'), value.lastIndexOf('/'))
  if (index < 0) return ''
  if (/^[A-Za-z]:$/.test(value.slice(0, index))) return value.slice(0, index + 1)
  return value.slice(0, index)
}

function joinDocumentPath(dir: string, relative: string): string {
  const base = dir.replace(/\\/g, '/').replace(/\/+$/, '')
  const tail = relative.replace(/^(?:\.\/|\.\\)+/, '').replace(/^[\\/]+/, '')
  return `${base}/${tail}`
}

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, '/')
}

function splitRoot(value: string): { root: string; rest: string } {
  const drive = /^([A-Za-z]:)(?:\/|$)/.exec(value)
  if (drive) return { root: drive[1].toLowerCase(), rest: value.slice(drive[0].length) }
  if (value.startsWith('//')) {
    const parts = value.slice(2).split('/')
    return { root: `//${(parts[0] ?? '').toLowerCase()}/${(parts[1] ?? '').toLowerCase()}`, rest: parts.slice(2).join('/') }
  }
  if (value.startsWith('/')) return { root: '/', rest: value.slice(1) }
  return { root: '', rest: value }
}

function segmentsOf(rest: string): string[] {
  return rest.split('/').filter(Boolean)
}

/** 把绝对文件路径写成相对于 fromDir 的路径；跨盘符/根时返回 null。 */
export function relativeImagePath(fromDir: string, filePath: string): string | null {
  const from = splitRoot(normalizeSlashes(fromDir))
  const target = splitRoot(normalizeSlashes(filePath))
  const windows = /^[A-Za-z]:/.test(from.root) || from.root.startsWith('//')
  if (from.root !== target.root && !(windows && from.root.toLowerCase() === target.root.toLowerCase())) return null
  const fromParts = segmentsOf(from.rest)
  const targetParts = segmentsOf(target.rest)
  const same = (a: string, b: string) => windows ? a.toLowerCase() === b.toLowerCase() : a === b
  let common = 0
  while (common < fromParts.length && common < targetParts.length && same(fromParts[common], targetParts[common])) common += 1
  const up = fromParts.slice(common).map(() => '..')
  return [...up, ...targetParts.slice(common)].join('/')
}

function mapImageObjects(objects: LabelObject[], map: (image: ImageObj) => ImageObj): { objects: LabelObject[]; changed: boolean } {
  let changed = false
  const next = objects.map((object) => {
    if (object.type === 'group') {
      const children = mapImageObjects(object.children, map)
      if (!children.changed) return object
      changed = true
      return { ...object, children: children.objects }
    }
    if (object.type !== 'image') return object
    const mapped = map(object)
    if (mapped === object) return object
    changed = true
    return mapped
  })
  return { objects: next, changed }
}

/** 打开模板后调用：把相对的链接/数据源目录解析成相对于模板目录的绝对路径。 */
export function resolveDocumentImagePaths(doc: LabelDoc, templatePath: string): LabelDoc {
  const dir = dirnameDocumentPath(templatePath)
  if (!dir) return doc
  const { objects, changed } = mapImageObjects(doc.objects, (image) => {
    if (image.imgType !== 'link' && image.imgType !== 'datasource') return image
    if (!image.linkPath || isAbsoluteDocumentPath(image.linkPath)) return image
    return { ...image, linkPath: joinDocumentPath(dir, image.linkPath) }
  })
  return changed ? { ...doc, objects } : doc
}
