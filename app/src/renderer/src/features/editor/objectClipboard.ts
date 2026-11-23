import type { LabelObject } from '../../types'
import { round2, uid } from '../../types'
import { normalizeDocument } from '../../../../shared/domain/document'

const HTML_MARKER = /<!--maxlabel-objects:([A-Za-z0-9+/=]+)-->/i

/** 复制到系统剪贴板的纯文本：文字/条码取实际内容，图形类没有可读文本。 */
export function objectClipboardText(objects: LabelObject[]): string {
  const lines: string[] = []
  const visit = (object: LabelObject): void => {
    if (object.type === 'group') {
      object.children.forEach(visit)
      return
    }
    if (object.type !== 'text' && object.type !== 'barcode') return
    const source = object.source
    if (!source) return
    if (source.kind === 'constant') {
      if (source.value) lines.push(source.value)
    } else if (source.kind === 'serial') {
      const digits = Math.max(1, source.digits)
      lines.push(`${source.prefix ?? ''}${String(source.current).padStart(digits, '0')}`)
    } else if (source.kind === 'database' && source.sampleValue) {
      lines.push(source.sampleValue)
    } else if (source.kind === 'keyboard' && source.placeholder) {
      lines.push(source.placeholder)
    }
  }
  objects.forEach(visit)
  return lines.join('\n')
}

function base64OfUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function utf8OfBase64(base64: string): string {
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
}

/**
 * 系统剪贴板同时写 `text/plain`（人可读内容）和 `text/html`（隐藏 JSON 标记）。
 * 外部编辑器粘贴得到纯文本；MaxLabel 自己粘贴时从 HTML 注释里还原对象，
 * 保留完整样式与条码参数。
 */
export function objectClipboardHtml(objects: LabelObject[]): string {
  const payload = JSON.stringify({ format: 'maxlabel-objects', version: 1, objects })
  return `<div>${escapeHtml(objectClipboardText(objects))}</div><!--maxlabel-objects:${base64OfUtf8(payload)}-->`
}

/** 写入对象剪贴板；自定义 HTML 失败时退回旧的 JSON 文本，保证内部粘贴仍可用。 */
export async function writeObjectClipboard(objects: LabelObject[]): Promise<void> {
  const html = objectClipboardHtml(objects)
  const text = objectClipboardText(objects)
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' })
        })
      ])
      return
    }
  } catch {
    // 权限/平台不支持多格式时继续走文本兜底。
  }
  await navigator.clipboard?.writeText(JSON.stringify({ format: 'maxlabel-objects', version: 1, objects }))
}

function parseObjects(raw: string): LabelObject[] | undefined {
  try {
    const parsed: unknown = JSON.parse(raw)
    const value = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as { objects?: unknown }).objects : parsed
    if (!Array.isArray(value) || !value.length) return []
    return normalizeDocument({ version: 2, name: 'Clipboard', widthMm: 10000, heightMm: 10000, objects: value }).objects
  } catch {
    return undefined
  }
}

export async function readObjectClipboard(
  readText: (() => Promise<string>) | undefined,
  fallback: LabelObject[],
  readHtml?: () => Promise<string | undefined>
): Promise<LabelObject[]> {
  // 优先读 HTML 里的隐藏对象数据（新格式）；兼容旧的 JSON 文本剪贴板。
  if (readHtml) {
    try {
      const html = await readHtml()
      const marker = html?.match(HTML_MARKER)?.[1]
      if (marker) {
        const objects = parseObjects(utf8OfBase64(marker))
        if (objects !== undefined) return objects
      }
    } catch {
      // 继续尝试纯文本。
    }
  }
  if (!readText) return fallback
  let raw: string
  try { raw = await readText() } catch { return fallback }
  return parseObjects(raw) ?? []
}


/** Deep-clone pasted objects, assigning fresh IDs and a 1 mm offset. */
export function cloneWithFreshIds(object: LabelObject): LabelObject {
  const copy = structuredClone(object)
  const offset = (value: LabelObject): LabelObject => {
    const next = { ...value, id: uid(), x: round2(value.x + 1), y: round2(value.y + 1) }
    return next.type === 'group' ? { ...next, children: next.children.map(cloneWithFreshIds) } : next
  }
  return offset(copy)
}
