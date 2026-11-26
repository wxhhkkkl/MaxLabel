/**
 * LabelShop 云图片引用。
 *
 * 老模板把云图片存成 `file="labelshop:\\codingv\<文件名>"`（伪主机名由原版客户端填写，
 * 实测所有云图片的最后一段就是 OSS 图片库 `/li/` 下的文件名）。MaxLabel 打开时可以
 * 按这个文件名从 OSS 直连取图，失败再回退到 LabelShop 的 i.codingv.com。
 *
 * 只取最后一段文件名并限制为常见图片扩展名，避免把引用里的路径片段带进 URL。
 */

export interface CloudImageReference {
  /** OSS 图片库中的文件名（原版 file 属性的最后一段）。 */
  fileName: string
  /** 按优先级排序的下载地址。 */
  urls: string[]
}

const CLOUD_IMAGE_FILE = /^[^\\/:*?"<>|\u0000-\u001f]+\.(?:png|jpe?g|gif|bmp|webp)$/i
const OSS_BASE = 'https://cvsimg.oss-cn-beijing.aliyuncs.com/li/'
const CODINGV_BASE = 'http://i.codingv.com/li/'

export function parseCloudImageReference(reference: unknown): CloudImageReference | null {
  const text = typeof reference === 'string' ? reference.trim() : ''
  if (!/^labelshop:/i.test(text)) return null
  const fileName = text.split(/[\\/]/).pop() ?? ''
  if (!CLOUD_IMAGE_FILE.test(fileName)) return null
  const encoded = encodeURIComponent(fileName)
  return { fileName, urls: [OSS_BASE + encoded, CODINGV_BASE + encoded] }
}
