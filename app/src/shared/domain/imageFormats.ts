/**
 * 图片文件格式登记表。
 *
 * 帮助 `label_object_picture.html` 要求支持 BMP、PNG、GIF、JPG、TIFF 等常见格式。
 * 但图片解码由 Electron 的 `nativeImage`（Chromium 解码器）完成，实测其只认
 * PNG / JPEG / GIF / BMP / WebP，TIFF 一律返回空图。因此这里只登记**运行时确实
 * 可解码**的格式，避免文件类型下拉里出现选了必然失败的类型。
 * 浏览图片对话框（`label_object_create_drag.html`）的文件类型下拉默认项为
 * 「所有支持的图象文件」，与帮助一致。
 */
export const SUPPORTED_IMAGE_EXTENSIONS = ['bmp', 'png', 'gif', 'jpg', 'jpeg', 'webp'] as const

export interface FileDialogFilter {
  name: string
  extensions: string[]
}

/** 浏览图片对话框的「文件类型」下拉项；第一项为默认项 */
export const IMAGE_FILE_FILTERS: FileDialogFilter[] = [
  { name: '所有支持的图象文件', extensions: [...SUPPORTED_IMAGE_EXTENSIONS] },
  { name: '位图文件 (*.bmp)', extensions: ['bmp'] },
  { name: 'PNG 图象文件 (*.png)', extensions: ['png'] },
  { name: 'GIF 图象文件 (*.gif)', extensions: ['gif'] },
  { name: 'JPEG 图象文件 (*.jpg;*.jpeg)', extensions: ['jpg', 'jpeg'] },
  { name: 'WebP 图象文件 (*.webp)', extensions: ['webp'] },
  { name: '所有文件 (*.*)', extensions: ['*'] }
]
