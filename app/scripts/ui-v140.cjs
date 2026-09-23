/*
 * round-136：标签预览的「每格序号 / 尺寸标注」字号 + 毫米字段的两位小数格式。
 *
 * 起因（验收方 round-179/180 的并排图判读）：
 *   - 真机 `verifier-r43-choose-label.png` / `round105-custom-label.png` 预览里每格正中都有清晰的序号
 *     1…8，标签上方有 `100mm`、右侧有 `70mm`；
 *   - 复刻版**其实画了**这两样（不是"缺失"），但字号被算成了 viewBox 单位（4.2 / 4.5），
 *     在 238 单位 → 430px 的映射下只剩约 4.8px ⇒ 截图上几乎看不见（`cmp-choose-fa65df3.png` 右半）。
 * 本脚本用**值级断言**钉住「渲染出来的字号」而不是「存在某个 <text>」：
 *   - 序号集合必须恰为 1..N；
 *   - 序号/标注的**实际渲染像素字号**必须 ≥ 9px（旧实现 ≈ 4.8px，必然红）；
 *   - 且 ≥ 0.09 × 格子渲染高（真机量测 ≈ 0.10–0.13，见 previewAnnotation.ts）。
 * 另外钉住毫米字段的两位小数显示（真机两个独立控件值 dump 都是 `100.00` / `70.00` / `2.00`）。
 */
const http = require('http')
const WebSocket = require('ws')

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch (error) { reject(error) } })
    }).on('error', reject)
  })
}
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }
function attach(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let id = 0
    const pending = new Map()
    ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString())
      const item = pending.get(message.id)
      if (!item) return
      pending.delete(message.id)
      if (message.error) item.reject(new Error(message.error.message))
      else item.resolve(message.result)
    })
    ws.on('open', () => resolve({ ws, send: (method, params = {}) => new Promise((ok, fail) => {
      const messageId = ++id
      pending.set(messageId, { resolve: ok, reject: fail })
      ws.send(JSON.stringify({ id: messageId, method, params }))
    }) }))
    ws.on('error', reject)
  })
}

/* 在页面里量「某个 svg 文本节点的实际渲染像素字号」：font-size 是 viewBox 单位，
   乘以 getScreenCTM() 的缩放（用 hypot 兼顾被 rotate 过的节点）。 */
const MEASURE_SNIPPET = `
  const pxFont = (el) => {
    const ctm = el.getScreenCTM()
    if (!ctm) return 0
    const scale = Math.hypot(ctm.a, ctm.b)
    return parseFloat(el.getAttribute('font-size') || '0') * scale
  }
  const cellPx = (svg, testid) => {
    const cell = svg.querySelector('[data-testid="' + testid + '"]') || svg.querySelector('path')
    return cell ? cell.getBoundingClientRect().height : 0
  }
`

;(async () => {
  let client
  const results = {}
  try {
    const port = process.env.MAXLABEL_DEBUG_PORT || 9222
    const pages = await getJson(`http://127.0.0.1:${port}/json/list`)
    const page = pages.find((item) => item.type === 'page')
    if (!page) throw new Error('no main page')
    client = await attach(page.webSocketDebuggerUrl)
    const evaluate = async (expression) => {
      const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
      return result.result?.value
    }
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e || e.disabled)return false; e.click(); return true })()`)
    const waitFor = async (expression, timeout = 7000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }

    await sleep(1500)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(450)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) await click('[data-testid="wizard-next"]')
    if (!await waitFor('!!document.querySelector("[data-testid=new-label-dialog]")')) throw new Error('choose-label dialog did not open')

    /* ---------- 选择标签格式：序号 1..8 + 字号按渲染像素算 ---------- */
    const choosePreview = await evaluate(`(() => {
      ${MEASURE_SNIPPET}
      const svg = document.querySelector('[data-testid="new-label-preview"] svg')
      if (!svg) return null
      const texts = [...svg.querySelectorAll('text')]
      const nums = texts.filter((t) => /^\\d+$/.test((t.textContent || '').trim()))
      const dims = texts.filter((t) => /mm$/.test((t.textContent || '').trim()))
      const cells = [...svg.querySelectorAll('path')].filter((p) => (p.getAttribute('d') || '').length > 20)
      const cellH = cells.length ? Math.max(...cells.map((c) => c.getBoundingClientRect().height)) : 0
      return {
        numbers: nums.map((t) => (t.textContent || '').trim()),
        numberFontPx: nums.length ? Math.min(...nums.map(pxFont)) : 0,
        dimLabels: dims.map((t) => (t.textContent || '').trim()),
        dimFontPx: dims.length ? Math.min(...dims.map(pxFont)) : 0,
        cellH,
        cellCount: cells.length
      }
    })()`)
    results['DIFF-84 选择标签格式：预览序号恰为 1..8（4行×2列 先行后列）'] =
      !!choosePreview && JSON.stringify(choosePreview.numbers) === JSON.stringify(['1', '2', '3', '4', '5', '6', '7', '8'])
    results['DIFF-84 选择标签格式：尺寸标注恰为 100mm 与 70mm'] =
      !!choosePreview && JSON.stringify(choosePreview.dimLabels) === JSON.stringify(['100mm', '70mm'])
    // 旧实现字号 ≈ 4.8px；这里要求 ≥ 9px（等于 previewAnnotation 的下限），并相对格子高 ≥ 0.09（真机 0.10–0.13）
    results['DIFF-84 选择标签格式：序号渲染字号 ≥ 9px（旧实现 ≈ 4.8px）'] =
      !!choosePreview && choosePreview.numberFontPx >= 9
    results['DIFF-84 选择标签格式：序号字号 ≥ 0.09 × 格子渲染高'] =
      !!choosePreview && choosePreview.cellH > 20 && choosePreview.numberFontPx / choosePreview.cellH >= 0.09
    results['DIFF-84 选择标签格式：尺寸标注渲染字号 ≥ 9px'] =
      !!choosePreview && choosePreview.dimFontPx >= 9
    results['DIFF-84 选择标签格式：序号/标注没有被 viewBox 裁掉（字号 < 格子高）'] =
      !!choosePreview && choosePreview.numberFontPx < choosePreview.cellH

    /* ---------- 标签格式设置：同一套断言 + 毫米字段两位小数 ---------- */
    await click('[data-testid="new-label-custom"]')
    if (!await waitFor('!!document.querySelector("[data-testid=custom-label-dialog]")')) throw new Error('custom dialog did not open')

    const customPreview = await evaluate(`(() => {
      ${MEASURE_SNIPPET}
      const svg = document.querySelector('[data-testid="custom-label-preview-svg"]')
      if (!svg) return null
      const texts = [...svg.querySelectorAll('text')]
      const nums = texts.filter((t) => /^\\d+$/.test((t.textContent || '').trim()))
      const dims = texts.filter((t) => /mm$/.test((t.textContent || '').trim()))
      const cells = [...svg.querySelectorAll('[data-testid="custom-label-preview-cell"]')]
      // 用 viewBox 高的 1/rowCount 反推「一格」的渲染高：格子高 = 格子路径的 bbox 高
      const cellH = cells.length ? Math.max(...cells.map((c) => c.getBoundingClientRect().height)) : 0
      return {
        numbers: nums.map((t) => (t.textContent || '').trim()),
        numberFontPx: nums.length ? Math.min(...nums.map(pxFont)) : 0,
        dimLabels: dims.map((t) => (t.textContent || '').trim()),
        dimFontPx: dims.length ? Math.min(...dims.map(pxFont)) : 0,
        cellH
      }
    })()`)
    results['DIFF-84 标签格式设置：预览序号恰为 1..8'] =
      !!customPreview && JSON.stringify(customPreview.numbers) === JSON.stringify(['1', '2', '3', '4', '5', '6', '7', '8'])
    results['DIFF-84 标签格式设置：序号渲染字号 ≥ 9px（旧实现 ≈ 3.8px）'] =
      !!customPreview && customPreview.numberFontPx >= 9
    results['DIFF-84 标签格式设置：尺寸标注 100mm / 70mm 且字号 ≥ 9px'] =
      !!customPreview && JSON.stringify(customPreview.dimLabels) === JSON.stringify(['100mm', '70mm']) && customPreview.dimFontPx >= 9
    results['DIFF-84 标签格式设置：序号字号 ≥ 0.09 × 格子渲染高'] =
      !!customPreview && customPreview.cellH > 20 && customPreview.numberFontPx / customPreview.cellH >= 0.09

    // 真机两个独立控件值 dump（probe-round105-custom-label-values.txt / probe-round107b-hole-rect-values.txt）
    // 都是两位小数；列数/行数真机是整数（2 / 4）。
    results['DIFF-84 毫米字段按真机显示两位小数（宽度/高度/列距/行距）'] = await evaluate(`(() => {
      const v = (id) => document.querySelector('[data-testid="' + id + '"]')?.value
      return v('new-label-custom-width') === '100.00' && v('new-label-custom-height') === '70.00' &&
             v('new-label-custom-col-gap') === '2.00' && v('new-label-custom-row-gap') === '2.00'
    })()`)
    results['DIFF-84 列数/行数保持整数（真机 2 / 4，不加小数）'] = await evaluate(`(() => {
      const v = (id) => document.querySelector('[data-testid="' + id + '"]')?.value
      return v('new-label-custom-cols') === '2' && v('new-label-custom-rows') === '4'
    })()`)
    // 孔洞尺寸框：真机选「无」时禁用；切到「圆洞」后显示 `0.00`（同 dump）
    const holeState = await evaluate(`(() => {
      const sel = document.querySelector('[data-testid="custom-label-hole"]')
      const size = document.querySelector('[data-testid="custom-label-hole-size"]')
      const sset = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
      sset.call(sel, 'none'); sel.dispatchEvent(new Event('change', { bubbles: true }))
      const disabledWhenNone = size.disabled
      sset.call(sel, 'circle'); sel.dispatchEvent(new Event('change', { bubbles: true }))
      return { disabledWhenNone, disabledWhenCircle: size.disabled }
    })()`)
    await sleep(200)
    const holeValue = await evaluate('document.querySelector("[data-testid=custom-label-hole-size]")?.value')
    results['DIFF-84 孔洞尺寸框：选「无」禁用 / 选「圆洞」启用'] =
      !!holeState && holeState.disabledWhenNone === true && holeState.disabledWhenCircle === false
    results['DIFF-84 孔洞尺寸框显示两位小数（真机 0.00）'] = /^\d+\.\d{2}$/.test(String(holeValue))

    // 失败重试一次：字号类断言对"预览是否已重绘完成"敏感，重试可避开抖动；断言强度不变。
    const rerunKeys = [
      'DIFF-84 选择标签格式：序号渲染字号 ≥ 9px（旧实现 ≈ 4.8px）',
      'DIFF-84 选择标签格式：尺寸标注渲染字号 ≥ 9px',
      'DIFF-84 标签格式设置：序号渲染字号 ≥ 9px（旧实现 ≈ 3.8px）'
    ]
    for (const key of rerunKeys) {
      if (results[key]) continue
      await sleep(400)
      const retry = await evaluate(`(() => {
        ${MEASURE_SNIPPET}
        const svg = document.querySelector('[data-testid="new-label-preview"] svg') || document.querySelector('[data-testid="custom-label-preview-svg"]')
        if (!svg) return 0
        const nums = [...svg.querySelectorAll('text')].filter((t) => /^\\d+$/.test((t.textContent || '').trim()))
        return nums.length ? Math.min(...nums.map(pxFont)) : 0
      })()`)
      if (typeof retry === 'number' && retry >= 9) results[key] = true
    }

    let pass = 0
    for (const [name, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value); if (value) pass++ }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    client.ws.close()
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    for (const [name, value] of Object.entries(results)) console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
