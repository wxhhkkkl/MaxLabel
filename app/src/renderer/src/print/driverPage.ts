import { validateDriverSvgPage } from '../../../shared/print/driverSvg'
import type { LabelDoc } from '../types'
import { renderLabelDataUrl, type RenderOptions } from './renderLabel'
import { renderLabelSvg } from './renderLabelSvg'
import { VectorUnsupportedError } from './vectorSupport'

/** Rollback switch: set false to send every driver page through the existing raster path. */
export const VECTOR_DRIVER_PAGES = true

export type DriverPageResult =
  | { kind: 'svg'; svg: string }
  | { kind: 'raster'; dataUrl: string; fallbackReason?: string }

async function raster(doc: LabelDoc, opts: RenderOptions, fallbackReason?: string): Promise<DriverPageResult> {
  return {
    kind: 'raster',
    dataUrl: await renderLabelDataUrl(doc, opts),
    ...(fallbackReason ? { fallbackReason } : {})
  }
}

/**
 * Driver page renderer. Vector output is used only when the page is faithfully
 * representable and passes the same allowlist that guards the IPC boundary;
 * otherwise the existing PNG path is used for that page.
 */
export async function renderDriverPage(doc: LabelDoc, opts: RenderOptions): Promise<DriverPageResult> {
  if (!VECTOR_DRIVER_PAGES) return raster(doc, opts)
  let svg: string
  try {
    svg = await renderLabelSvg(doc, opts)
  } catch (error) {
    if (error instanceof VectorUnsupportedError) return raster(doc, opts, error.message)
    throw error
  }
  try {
    validateDriverSvgPage(svg)
  } catch (error) {
    return raster(doc, opts, error instanceof Error ? error.message : '矢量页校验失败')
  }
  return { kind: 'svg', svg }
}
