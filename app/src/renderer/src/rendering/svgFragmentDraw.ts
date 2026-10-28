/**
 * 把 `barcodeToSvgFragment` 生成的 SVG 片段画到 Canvas 上。
 *
 * 片段的标签集合是我们自己可控的：条码主体一律是 bwip-js 输出的 `<path>`
 * （一维码用 `stroke` + `stroke-width`，二维码用 `fill` + `fill-rule`），
 * 人读文字是我们自己拼的 `<text>` / `<line>` / `<rect>`，外面套一层
 * `<svg>`（根）和可能的一层嵌套 `<svg viewBox>`。
 *
 * 所以不引 SVG 渲染库，解析成一组绘制指令，用 `Path2D` 直接描边/填充——
 * 是矢量绘制，画布放大到多少倍都锐利。指令本身不碰 Canvas，便于单测。
 */

export type FragmentMatrix = readonly [number, number, number, number, number, number]

const IDENTITY: FragmentMatrix = [1, 0, 0, 1, 0, 0]

interface OpBase {
  /** 该元素生效的仿射矩阵（已乘上所有祖先的变换）。 */
  matrix: FragmentMatrix
}

export type FragmentOp =
  | (OpBase & { kind: 'rect'; x: number; y: number; width: number; height: number; fill: string | null })
  | (OpBase & {
      kind: 'path'
      d: string
      fill: string | null
      fillRule: CanvasFillRule
      stroke: string | null
      strokeWidth: number
    })
  | (OpBase & { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string | null; strokeWidth: number })
  | (OpBase & { kind: 'text'; x: number; y: number; text: string; font: string; fill: string })

interface XmlNode {
  name: string
  attrs: Record<string, string>
  text: string
  children: XmlNode[]
}

const TAG_RE = /<(\/?)([a-zA-Z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g
const ATTR_RE = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g

function parseAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  ATTR_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ATTR_RE.exec(source))) {
    attrs[match[1]] = match[2] ?? match[3] ?? ''
  }
  return attrs
}

/** 把片段解析成一棵最小 XML 树；片段由本仓库自己生成，文法受控。 */
export function parseSvgFragment(markup: string): XmlNode {
  const root: XmlNode = { name: '#root', attrs: {}, text: '', children: [] }
  const stack: XmlNode[] = [root]
  TAG_RE.lastIndex = 0
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = TAG_RE.exec(markup))) {
    const between = markup.slice(cursor, match.index)
    if (between) stack[stack.length - 1].text += between
    cursor = TAG_RE.lastIndex
    const [, closing, name, attrText, selfClosing] = match
    if (closing) {
      if (stack.length > 1) stack.pop()
      continue
    }
    const node: XmlNode = { name, attrs: parseAttrs(attrText), text: '', children: [] }
    stack[stack.length - 1].children.push(node)
    if (!selfClosing) stack.push(node)
  }
  return root
}

export function multiplyMatrix(m: FragmentMatrix, n: FragmentMatrix): FragmentMatrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5]
  ]
}

/** 支持 `translate` / `scale` / `matrix`（片段里只用到前两种）。 */
export function parseTransform(source: string | undefined): FragmentMatrix {
  if (!source) return IDENTITY
  let result: FragmentMatrix = IDENTITY
  const re = /([a-zA-Z]+)\s*\(([^)]*)\)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(source))) {
    const values = match[2].split(/[\s,]+/).filter(Boolean).map(Number)
    if (values.some((value) => !Number.isFinite(value))) continue
    const name = match[1].toLowerCase()
    let step: FragmentMatrix = IDENTITY
    if (name === 'translate') step = [1, 0, 0, 1, values[0] ?? 0, values[1] ?? 0]
    else if (name === 'scale') step = [values[0] ?? 1, 0, 0, values[1] ?? values[0] ?? 1, 0, 0]
    else if (name === 'matrix' && values.length === 6) {
      step = [values[0], values[1], values[2], values[3], values[4], values[5]]
    }
    result = multiplyMatrix(result, step)
  }
  return result
}

function num(value: string | undefined, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** 嵌套 `<svg>` 的 viewBox 缩放到它的 width/height。 */
function svgMatrix(node: XmlNode, parent: FragmentMatrix): FragmentMatrix {
  const box = (node.attrs.viewBox ?? '').split(/[\s,]+/).filter(Boolean).map(Number)
  const translate: FragmentMatrix = [1, 0, 0, 1, num(node.attrs.x), num(node.attrs.y)]
  let scale: FragmentMatrix = IDENTITY
  if (box.length === 4 && box[2] > 0 && box[3] > 0) {
    const width = num(node.attrs.width, box[2])
    const height = num(node.attrs.height, box[3])
    scale = [width / box[2], 0, 0, height / box[3], 0, 0]
  }
  return multiplyMatrix(multiplyMatrix(parent, translate), scale)
}

function textFont(attrs: Record<string, string>): string {
  const style = attrs['font-style'] === 'italic' ? 'italic ' : ''
  const weight = attrs['font-weight'] ?? 'normal'
  const size = num(attrs['font-size'], 12)
  const family = attrs['font-family'] ?? 'Arial'
  return `${style}${weight} ${size}px ${family}`
}

function walk(node: XmlNode, matrix: FragmentMatrix, ops: FragmentOp[]): void {
  for (const child of node.children) {
    if (child.name === 'svg') {
      walk(child, svgMatrix(child, matrix), ops)
      continue
    }
    if (child.name === 'g') {
      walk(child, multiplyMatrix(matrix, parseTransform(child.attrs.transform)), ops)
      continue
    }
    if (child.name === 'rect') {
      ops.push({
        kind: 'rect',
        matrix,
        x: num(child.attrs.x),
        y: num(child.attrs.y),
        width: num(child.attrs.width),
        height: num(child.attrs.height),
        fill: child.attrs.fill ?? null
      })
      continue
    }
    if (child.name === 'path') {
      const d = child.attrs.d
      if (!d) continue
      ops.push({
        kind: 'path',
        matrix,
        d,
        fill: child.attrs.fill ?? (child.attrs.stroke ? null : '#000000'),
        fillRule: child.attrs['fill-rule'] === 'evenodd' ? 'evenodd' : 'nonzero',
        stroke: child.attrs.stroke ?? null,
        strokeWidth: num(child.attrs['stroke-width'], 1)
      })
      continue
    }
    if (child.name === 'line') {
      ops.push({
        kind: 'line',
        matrix,
        x1: num(child.attrs.x1),
        y1: num(child.attrs.y1),
        x2: num(child.attrs.x2),
        y2: num(child.attrs.y2),
        stroke: child.attrs.stroke ?? '#000000',
        strokeWidth: num(child.attrs['stroke-width'], 1)
      })
      continue
    }
    if (child.name === 'text') {
      ops.push({
        kind: 'text',
        matrix,
        x: num(child.attrs.x),
        y: num(child.attrs.y),
        text: child.text,
        font: textFont(child.attrs),
        fill: child.attrs.fill ?? '#000000'
      })
    }
  }
}

export function buildFragmentOps(markup: string): FragmentOp[] {
  const root = parseSvgFragment(markup)
  const ops: FragmentOp[] = []
  walk(root, IDENTITY, ops)
  return ops
}

export function drawFragmentOps(ctx: CanvasRenderingContext2D, ops: readonly FragmentOp[]): void {
  for (const op of ops) {
    ctx.save()
    const [a, b, c, d, e, f] = op.matrix
    ctx.transform(a, b, c, d, e, f)
    switch (op.kind) {
      case 'rect':
        if (op.fill) {
          ctx.fillStyle = op.fill
          ctx.fillRect(op.x, op.y, op.width, op.height)
        }
        break
      case 'path': {
        const path = new Path2D(op.d)
        if (op.fill) {
          ctx.fillStyle = op.fill
          ctx.fill(path, op.fillRule)
        }
        if (op.stroke) {
          ctx.strokeStyle = op.stroke
          ctx.lineWidth = op.strokeWidth
          ctx.stroke(path)
        }
        break
      }
      case 'line':
        if (op.stroke) {
          ctx.strokeStyle = op.stroke
          ctx.lineWidth = op.strokeWidth
          ctx.beginPath()
          ctx.moveTo(op.x1, op.y1)
          ctx.lineTo(op.x2, op.y2)
          ctx.stroke()
        }
        break
      case 'text':
        ctx.font = op.font
        ctx.fillStyle = op.fill
        // 片段里的 `<text>` 用 `dominant-baseline="text-before-edge"`，即 y 是文字顶边。
        ctx.textBaseline = 'top'
        ctx.fillText(op.text, op.x, op.y)
        break
    }
    ctx.restore()
  }
}
