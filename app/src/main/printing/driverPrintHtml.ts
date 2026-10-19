import { MAX_PRINT_PHYSICAL_LABELS } from '../../shared/print/plan'

export interface DriverPrintHtmlPage {
  svg?: string
  dataUrl?: string
  copies?: number
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/**
 * Builds the hidden print window document for driver mode. Vector pages are
 * inlined so Chromium keeps their text/paths vector; raster fallback pages are
 * loaded from the temp PNG files. Copies are expanded here (A,A,B,B) instead of
 * relying on Electron's copies option, which repeats the whole document.
 */
export function buildDriverPrintHtml(pages: DriverPrintHtmlPage[], widthMm: number, heightMm: number): { html: string; copies: number } {
  const physicalPages = pages.reduce((sum, page) => sum + (page.copies ?? 1), 0)
  if (physicalPages > MAX_PRINT_PHYSICAL_LABELS) throw new Error(`实际打印标签数量超过限制（最大 ${MAX_PRINT_PHYSICAL_LABELS} 张）`)
  const expanded = pages.flatMap((page) => Array.from({ length: page.copies ?? 1 }, () => page))
  const body = expanded
    .map((page) => {
      if (page.svg) return `<div class="page">${page.svg}</div>`
      if (page.dataUrl) return `<div class="page"><img src="${escapeAttribute(page.dataUrl)}"></div>`
      throw new Error('驱动打印页数据无效')
    })
    .join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: file:; style-src 'unsafe-inline'; script-src 'none'; object-src 'none'"><style>*{margin:0;padding:0;box-sizing:border-box}@page{size:${widthMm}mm ${heightMm}mm;margin:0}html,body{width:100%;height:100%}.page{width:${widthMm}mm;height:${heightMm}mm;overflow:hidden;page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}.page>svg{display:block;width:${widthMm}mm;height:${heightMm}mm}img{display:block;width:${widthMm}mm;height:${heightMm}mm}</style></head><body>${body}</body></html>`
  return { html, copies: 1 }
}
