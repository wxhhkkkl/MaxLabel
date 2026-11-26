import type { LabelObject } from '../types'
import { dirnameDocumentPath, relativeImagePath } from './documentImagePaths'

export interface CloudImageExport {
  fileName: string
  dataUrl: string
  /** 使用同一张云图片的对象 id（多个对象可复用同一文件）。 */
  objectIds: string[]
}

export interface ExportedImageFile {
  fileName: string
  path: string
}

function visitCloudImages(objects: LabelObject[], collect: (fileName: string, dataUrl: string, objectId: string) => void): void {
  for (const object of objects) {
    if (object.type === 'group') {
      visitCloudImages(object.children, collect)
      continue
    }
    if (object.type !== 'image') continue
    if (!object.cloudImage || !object.src.startsWith('data:image/')) continue
    collect(object.cloudImage, object.src, object.id)
  }
}

/** 收集需要导出的云图片；同一文件名只下载/写入一次。 */
export function collectCloudImages(objects: LabelObject[]): CloudImageExport[] {
  const byName = new Map<string, CloudImageExport>()
  visitCloudImages(objects, (fileName, dataUrl, objectId) => {
    const key = fileName.toLowerCase()
    const existing = byName.get(key)
    if (existing) {
      if (!existing.objectIds.includes(objectId)) existing.objectIds.push(objectId)
      return
    }
    byName.set(key, { fileName, dataUrl, objectIds: [objectId] })
  })
  return [...byName.values()]
}

/** 把导出结果转换成对象 id → 相对路径；跨盘符时退回绝对路径。 */
export function buildCloudImageLinks(
  exports: CloudImageExport[],
  files: ExportedImageFile[],
  targetPath: string
): Record<string, string> {
  const dir = dirnameDocumentPath(targetPath)
  const byName = new Map(files.map((file) => [file.fileName.toLowerCase(), file]))
  const links: Record<string, string> = {}
  for (const item of exports) {
    const file = byName.get(item.fileName.toLowerCase())
    if (!file) continue
    const relative = relativeImagePath(dir, file.path)
    const linkPath = relative && relative !== '..' && !relative.startsWith('../') ? relative : file.path
    for (const objectId of item.objectIds) links[objectId] = linkPath
  }
  return links
}

/** 另存为时默认建议的图片目录：模板同目录下的「<模板名>_images」。 */
export function suggestCloudImageDir(targetPath: string): string {
  const dir = dirnameDocumentPath(targetPath)
  const slash = Math.max(targetPath.lastIndexOf('\\'), targetPath.lastIndexOf('/'))
  const name = targetPath.slice(slash + 1).replace(/\.(msdx|json)$/i, '')
  if (!dir) return `${name}_images`
  if (dir === '/') return `/${name}_images`
  const sep = targetPath.includes('\\') ? '\\' : '/'
  return `${dir}${sep}${name}_images`
}
