/* DIFF-27：对象可变颜色的模式、索引表默认值、颜色值分隔写法与粒度限制。 */
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
    const send = (method, params = {}) => new Promise((res, rej) => {
      const messageId = ++id
      pending.set(messageId, { res, rej })
      ws.send(JSON.stringify({ id: messageId, method, params }))
    })
    ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString())
      const item = pending.get(message.id)
      if (!item) return
      pending.delete(message.id)
      if (message.error) item.rej(new Error(message.error.message))
      else item.res(message.result)
    })
    ws.on('open', () => resolve({ ws, send }))
    ws.on('error', reject)
  })
}

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
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return true })()`)
    const waitFor = async (expression, timeout = 3000) => {
      const started = Date.now()
      const probe = expression.trim().startsWith('[') ? `!!document.querySelector(${JSON.stringify(expression)})` : expression
      while (Date.now() - started < timeout) {
        if (await evaluate(probe)) return true
        await sleep(80)
      }
      return false
    }
    const setValue = (selector, value) => evaluate(`(() => {
      const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false
      const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype
      const setter=Object.getOwnPropertyDescriptor(proto,'value').set
      setter.call(e,${JSON.stringify(String(value))})
      e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true
    })()`)
    const optionsOf = (selector) => evaluate(`[...(document.querySelector(${JSON.stringify(selector)})?.options||[])].map((o)=>o.value)`)
    const dragCanvas = (x1, y1, x2, y2) => evaluate(`(() => {
      const canvas=document.querySelector('canvas.upper-canvas') || document.querySelector('canvas'); if(!canvas)return false
      const b=canvas.getBoundingClientRect(); const p=(x,y)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons:1})
      canvas.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1})))
      canvas.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2})))
      canvas.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2}),buttons:0})); return true
    })()`)
    const selectType = (type) => evaluate(`(() => {
      const row=[...document.querySelectorAll('[data-testid="layer-object-row"]')].find((e)=>e.getAttribute('data-object-type')===${JSON.stringify(type)})
      if(!row)return false; if(row.getAttribute('data-selected')!=='true')row.click(); return true
    })()`)
    const openProps = async (type) => {
      if (!await selectType(type)) return false
      await key('Enter', { altKey: true })
      return waitFor('!!document.querySelector("[data-testid=object-props-dialog]")')
    }
    const closeProps = async () => {
      await evaluate(`document.querySelector('[data-testid="object-props-dialog"] button[aria-label]')?.click()`)
      await sleep(200)
    }

    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(300)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(320)
    }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas")', 8000)) throw new Error('editor did not open')

    // 造一个矩形（直线/矩形仅整体变色）、一个文字、一个条码与一个图片对象
    await click('[data-tool="rect"]'); await dragCanvas(180, 150, 340, 240); await sleep(320)
    await click('[data-tool="text"]'); await dragCanvas(420, 150, 620, 220); await sleep(320)
    await click('[data-tool="barcode"]'); await dragCanvas(180, 300, 420, 420); await sleep(420)
    await click('[data-tool="image"]'); await dragCanvas(500, 320, 680, 440); await sleep(520)

    // ---- ① 六种颜色变化模式 ----
    if (!await openProps('rect')) throw new Error('rect props did not open')
    const modeValues = await optionsOf('[data-testid="object-props-dialog"] [data-testid="color-change-mode"]')
    const modeLabels = await evaluate(`[...(document.querySelector('[data-testid="object-props-dialog"] [data-testid="color-change-mode"]')?.options||[])].map((o)=>o.textContent.trim())`)
    results['DIFF-27 六种颜色变化模式齐全'] =
      JSON.stringify(modeValues) === JSON.stringify(['fixed', 'random', 'indexByContent', 'indexVar', 'valueVar', 'index', 'rgb'])
    results['DIFF-27 模式文案对齐帮助原文'] =
      ['随机颜色', '以数据源内容为索引', '颜色索引变量', '颜色值变量', '颜色索引', 'RGB颜色值'].every((label) => modeLabels.includes(label))

    // ---- ④ 粒度限制：直线/矩形仅整体变色 ----
    await setValue('[data-testid="object-props-dialog"] [data-testid="color-change-mode"]', 'index'); await sleep(200)
    const rectGranularity = await optionsOf('[data-testid="object-props-dialog"] [data-testid="color-change-granularity"]')
    results['DIFF-27 矩形对象只有整体变色粒度'] = JSON.stringify(rectGranularity) === JSON.stringify(['solid'])

    // ---- ② 索引表默认注入十个预定义颜色 ----
    const privateRows = await evaluate(`(() => {
      const rows=[...document.querySelectorAll('[data-testid^="color-index-private-row-"]')]
      return { count: rows.length, first: rows[0]?.innerText || '', second: rows[1]?.innerText || '' }
    })()`)
    results['DIFF-27 索引表默认十个预定义颜色（索引 0–9）'] =
      privateRows.count === 10 && /#000000/i.test(privateRows.first) && /#FF0000/i.test(privateRows.second)

    // ---- ③ 颜色值两种分隔写法 ----
    await setValue('[data-testid="object-props-dialog"] [data-testid="color-change-mode"]', 'rgb'); await sleep(200)
    const hint = await evaluate(`document.querySelector('[data-testid="object-props-dialog"]')?.innerText || ''`)
    const commaOk = await setValue('[data-testid="object-props-dialog"] [data-testid="color-change-input"]', '#FF0000')
    await sleep(120)
    const commaBack = await evaluate('document.querySelector("[data-testid=object-props-dialog] [data-testid=color-change-input]")?.value')
    const pipeOk = await setValue('[data-testid="object-props-dialog"] [data-testid="color-change-input"]', '#FF0000 | #00FF00')
    await sleep(120)
    const pipeBack = await evaluate('document.querySelector("[data-testid=object-props-dialog] [data-testid=color-change-input]")?.value')
    results['DIFF-27 颜色值两种分隔写法均可输入并保留'] = commaOk && pipeOk && commaBack === '#FF0000' && pipeBack === '#FF0000 | #00FF00'
    results['DIFF-27 输入提示写明逗号与竖线两种分隔'] = /[，,]/.test(hint) && hint.includes('|')
    await closeProps()

    // ---- ④ 文字对象整体/逐字符 ----
    if (!await openProps('text')) throw new Error('text props did not open')
    await setValue('[data-testid="object-props-dialog"] [data-testid="color-change-mode"]', 'rgb'); await sleep(200)
    const textGranularity = await optionsOf('[data-testid="object-props-dialog"] [data-testid="color-change-granularity"]')
    results['DIFF-27 文字对象可选整体与逐字符变色'] = JSON.stringify(textGranularity) === JSON.stringify(['solid', 'char'])
    const textGranularityLabels = await evaluate(`[...(document.querySelector('[data-testid="object-props-dialog"] [data-testid="color-change-granularity"]')?.options||[])].map((o)=>o.textContent.trim())`)
    results['DIFF-27 逐字符变色文案对齐帮助'] = textGranularityLabels.includes('逐字符变色')
    await closeProps()

    // ---- ④ 条码对象整体/区块/渐变 ----
    if (!await openProps('barcode')) throw new Error('barcode props did not open')
    await setValue('[data-testid="object-props-dialog"] [data-testid="color-change-mode"]', 'index'); await sleep(200)
    const barcodeGranularity = await optionsOf('[data-testid="object-props-dialog"] [data-testid="color-change-granularity"]')
    results['DIFF-27 条码对象可选整体/区块/渐变变色'] = JSON.stringify(barcodeGranularity) === JSON.stringify(['solid', 'block', 'gradient'])
    await setValue('[data-testid="object-props-dialog"] [data-testid="color-change-granularity"]', 'block'); await sleep(200)
    results['DIFF-27 区块变色展开行列输入'] = await waitFor('!!document.querySelector("[data-testid=object-props-dialog]")?.innerText.includes("区块行数")')
    await closeProps()

    // ---- ⑤ 图片仅单色黑白图 ----
    if (!await openProps('image')) throw new Error('image props did not open')
    const imageHint = await evaluate('document.querySelector("[data-testid=color-change-image-hint]")?.innerText || ""')
    const imageModeDisabled = await evaluate('document.querySelector("[data-testid=object-props-dialog] [data-testid=color-change-mode]")?.disabled === true')
    const imageGranularity = await optionsOf('[data-testid="object-props-dialog"] [data-testid="color-change-granularity"]')
    results['DIFF-27 图片给出单色黑白图提示并在不支持时禁用颜色模式'] =
      imageHint.includes('单色黑白') && imageModeDisabled === true && imageGranularity.length === 0
    await closeProps()

    let pass = 0
    for (const [name, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value); if (value) pass++ }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    client.ws.close()
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
