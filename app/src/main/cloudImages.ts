import { parseCloudImageReference } from '../shared/domain/cloudImages'
import { sniffImageMime } from '../shared/print/imageBytes'
import { MAX_IMAGE_DECOMPRESSED_BYTES, MAX_IMAGE_PIXELS } from '../shared/print/limits'

export interface CloudImageBinary {
  status: number
  contentType?: string
  body: Buffer
}

export interface CloudImageFetchDeps {
  getBinary(url: string): Promise<CloudImageBinary>
  decode(buffer: Buffer): { width: number; height: number } | null
}

export interface CloudImageFetchResult {
  ok: boolean
  dataUrl?: string
  fileName?: string
  url?: string
  message?: string
  messageKey?: string
}

/** 按 OSS → i.codingv.com 的顺序下载 LabelShop 云图片；只在 main 进程执行。 */
export async function fetchCloudImage(reference: unknown, deps: CloudImageFetchDeps): Promise<CloudImageFetchResult> {
  const parsed = parseCloudImageReference(reference)
  if (!parsed) {
    return { ok: false, message: '不是可识别的 LabelShop 云图片引用', messageKey: 'error.imageCloud' }
  }
  let lastError = ''
  for (const url of parsed.urls) {
    try {
      const response = await deps.getBinary(url)
      if (response.status !== 200) {
        lastError = `HTTP ${response.status}`
        continue
      }
      if (response.body.length > MAX_IMAGE_DECOMPRESSED_BYTES) {
        lastError = `图片超过 ${Math.round(MAX_IMAGE_DECOMPRESSED_BYTES / 1024 / 1024)} MB 限制`
        continue
      }
      const mime = sniffImageMime(response.body)
      if (!mime) {
        lastError = '返回内容不是受支持的图片'
        continue
      }
      const size = deps.decode(response.body)
      if (!size || size.width <= 0 || size.height <= 0) {
        lastError = '图片内容无法解码'
        continue
      }
      if (size.width * size.height > MAX_IMAGE_PIXELS) {
        lastError = '图片像素尺寸过大（最大 4000 万像素）'
        continue
      }
      return {
        ok: true,
        dataUrl: `data:${mime};base64,${response.body.toString('base64')}`,
        fileName: parsed.fileName,
        url
      }
    } catch (error) {
      lastError = String((error as { message?: string }).message ?? error)
    }
  }
  return { ok: false, message: `云图片下载失败：${lastError || '未知错误'}（${parsed.fileName}）`, messageKey: 'error.imageCloud' }
}
