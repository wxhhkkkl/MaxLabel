import { MAX_DRIVER_PAGE_BYTES } from './limits'

/**
 * Driver print pages may be inline SVG produced by Fabric + bwip-js. This
 * validator is intentionally an allowlist: the print window is sandboxed, but
 * the SVG crosses the IPC trust boundary and must not carry scripts, event
 * handlers, external resources or arbitrary CSS.
 */
const ALLOWED_TAGS = new Set([
  'svg',
  'g',
  'defs',
  'clippath',
  'path',
  'rect',
  'text',
  'tspan',
  'line',
  'polyline',
  'polygon',
  'circle',
  'ellipse',
  'image',
  'desc',
  'title',
  'lineargradient',
  'radialgradient',
  'stop',
  'pattern'
])

const ALLOWED_ATTRIBUTES = new Set([
  'xmlns',
  'xmlns:xlink',
  'version',
  'viewbox',
  'width',
  'height',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'transform',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-miterlimit',
  'opacity',
  'visibility',
  'line-height',
  'text-decoration-thickness',
  'text-align',
  'word-spacing',
  'white-space',
  'clip-path',
  'clip-rule',
  'clippathunits',
  'id',
  'href',
  'xlink:href',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-anchor',
  'dominant-baseline',
  'alignment-baseline',
  'letter-spacing',
  'xml:space',
  'preserveaspectratio',
  'image-rendering',
  'paint-order',
  'vector-effect',
  'style',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientunits',
  'gradienttransform',
  'spreadmethod',
  'patternunits',
  'patterncontentunits',
  'patterntransform'
])

const STYLE_PROPERTIES = new Set([
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-miterlimit',
  'opacity',
  'visibility',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'text-decoration',
  'text-decoration-thickness',
  'text-align',
  'text-anchor',
  'dominant-baseline',
  'alignment-baseline',
  'letter-spacing',
  'word-spacing',
  'white-space',
  'paint-order',
  'vector-effect'
])

const IMAGE_HREF = /^data:image\/(png|jpeg|gif|webp|bmp);base64,[A-Za-z0-9+/=]+$/
const ANCHOR_URL = /^url\(\s*#[^)]+\s*\)$/
const MAX_TAGS = 250_000
const MAX_DEPTH = 64

function fail(label: string): never {
  throw new Error(`${label}格式无效`)
}

function checkValue(name: string, value: string, label: string): void {
  const lower = value.toLowerCase()
  if (lower.includes('javascript:') || lower.includes('vbscript:') || lower.includes('data:text/html') || lower.includes('expression')) {
    fail(label)
  }
  if (name === 'href' || name === 'xlink:href') {
    if (!value.startsWith('#') && !IMAGE_HREF.test(value)) fail(label)
    return
  }
  if (name === 'style') {
    for (const declaration of value.split(';')) {
      const [rawProp, ...rawValue] = declaration.split(':')
      const prop = rawProp?.trim().toLowerCase() ?? ''
      if (!prop) continue
      if (!STYLE_PROPERTIES.has(prop)) fail(label)
      const propertyValue = rawValue.join(':').trim()
      if (!propertyValue) continue
      if (propertyValue.toLowerCase().includes('url(') && !ANCHOR_URL.test(propertyValue)) fail(label)
    }
    return
  }
  if (lower.includes('url(') && !ANCHOR_URL.test(value.trim())) fail(label)
}

function checkAttributes(raw: string, label: string): void {
  const attribute = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  let match: RegExpExecArray | null
  while ((match = attribute.exec(raw))) {
    const name = match[1].toLowerCase()
    const value = match[2] ?? match[3] ?? ''
    if (!ALLOWED_ATTRIBUTES.has(name) || name.startsWith('on')) fail(label)
    checkValue(name, value, label)
  }
  // Everything left must be whitespace. This rejects unquoted attributes and
  // any token the allowlist parser did not understand.
  if (raw.replace(attribute, '').trim() !== '') fail(label)
}

export function validateDriverSvgPage(value: unknown, maxBytes = MAX_DRIVER_PAGE_BYTES, label = '打印矢量数据'): string {
  if (typeof value !== 'string') fail(label)
  if (new TextEncoder().encode(value).length > maxBytes) throw new Error(`${label}超过 ${Math.round(maxBytes / 1024 / 1024)} MB 限制`)
  const svg = value
  const trimmed = svg.trim()
  if (!/^<svg(?:\s|>)/i.test(trimmed) || !/<\/svg>\s*$/i.test(trimmed)) fail(label)
  if (/<\?xml|<!DOCTYPE|<!--|<!\[CDATA\[/i.test(svg)) fail(label)

  const stack: string[] = []
  let tagCount = 0
  let rootClosed = false
  let lastIndex = 0
  const tag = /<(\/?)([A-Za-z_][\w:.-]*)([^<>]*?)(\/?)>/g
  let match: RegExpExecArray | null
  while ((match = tag.exec(svg))) {
    if (svg.slice(lastIndex, match.index).includes('<')) fail(label)
    lastIndex = tag.lastIndex
    tagCount++
    if (tagCount > MAX_TAGS) fail(label)
    const closing = match[1] === '/'
    const name = match[2].toLowerCase()
    const rest = match[3]
    const selfClosing = match[4] === '/'
    if (!ALLOWED_TAGS.has(name)) fail(label)

    if (closing) {
      if (selfClosing || rest.trim() !== '') fail(label)
      const open = stack.pop()
      if (open !== name) fail(label)
      if (stack.length === 0) {
        if (name !== 'svg' || rootClosed) fail(label)
        rootClosed = true
      }
      continue
    }

    if (rootClosed) fail(label)
    if (stack.length === 0 && name !== 'svg') fail(label)
    if (stack.length > 0 && stack.length >= MAX_DEPTH) fail(label)
    checkAttributes(rest, label)
    // A non-self-closing svg at depth 0 is the root; nested svg is allowed.
    if (!selfClosing) stack.push(name)
    else if (stack.length === 0) {
      if (name !== 'svg') fail(label)
      rootClosed = true
    }
  }
  if (svg.slice(lastIndex).includes('<')) fail(label)
  if (!rootClosed || stack.length !== 0) fail(label)
  return svg
}
