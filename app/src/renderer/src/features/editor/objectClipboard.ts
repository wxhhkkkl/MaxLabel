import type { LabelObject } from '../../types'
import { normalizeDocument } from '../../../../shared/domain/document'

export async function readObjectClipboard(readText: (() => Promise<string>) | undefined, fallback: LabelObject[]): Promise<LabelObject[]> {
  if (!readText) return fallback
  let raw: string
  try { raw = await readText() } catch { return fallback }
  try {
    const parsed: unknown = JSON.parse(raw)
    const value = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as { objects?: unknown }).objects : parsed
    if (!Array.isArray(value) || !value.length) return []
    return normalizeDocument({ version: 2, name: 'Clipboard', widthMm: 10000, heightMm: 10000, objects: value }).objects
  } catch { return [] }
}
