/*
 * 标签页条的位置与跨幅：**横跨整个窗口宽度**，位于工具栏/对齐栏之下、左栏之上。
 *
 * 出处：真机启动截图 `parity/reference/labelshop/92-00-startup.png`——
 *   `起始页 ×` 页签条从窗口左边缘一直延伸到右边缘（y≈166 一行，横向占满），
 *   起始页的 `未登录 / 优惠券 / 开始 / 最近` 左栏**在它下面**才开始（y≈205 起，x 0–220）。
 *
 * 修复前（对照 `parity/reference/maxlabel/A9-start-recent.png`）：页签条分别渲染在
 *   起始页右区（`.start-main`）与编辑区内部，于是 220px 左栏 / 图层窗体顶到了
 *   与页签条同一行的左侧，页签条只覆盖右区、不横跨窗口。
 *
 * 断言：
 *   1) 起始页：页签条左右边缘贴住窗口左右边缘（跨满整宽，允许 1px 取整误差）；
 *   2) 起始页：页签条底边不越过左栏顶边 —— 左栏在页签条**下方**；
 *   3) 起始页：页签条顶边在菜单栏/工具栏之下（不是浮在最上面）；
 *   4) 编辑态：页签条同样跨满整宽，且图层窗体顶边不低于页签条底边；
 *   5) 编辑态：画布区顶边不低于页签条底边（页签条不压在画布上）。
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
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false; e.click(); return true })()`)
    const pressKey = (k, o = {}) => evaluate(`(() => { window.dispatchEvent(new KeyboardEvent('keydown',${JSON.stringify({ key: k, code: k, bubbles: true, cancelable: true, ...o })})); return true })()`)
    const waitFor = async (expression, timeout = 8000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    /** 元素包围盒 + 窗口宽度，供跨幅/上下关系判定。 */
    const box = (selector) => evaluate(`(() => {
      const e = document.querySelector(${JSON.stringify(selector)})
      if (!e) return null
      const r = e.getBoundingClientRect()
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, win: window.innerWidth }
    })()`)

    await sleep(1800)
    await evaluate(`document.querySelector('button[aria-label="关闭"]')?.click()`)
    await sleep(400)

    // ---------- 起始页 ----------
    const strip = await box('[data-testid=tab-strip]')
    const left = await box('[data-testid=start-left]')
    const startPage = await box('[data-testid=start-page]')
    results['起始页存在页签条与左栏'] = !!strip && !!left && !!startPage
    if (!strip || !left || !startPage) throw new Error('start page layout missing')

    results['起始页：页签条跨满窗口整宽（左右贴边）'] =
      strip.left <= 1 && strip.right >= strip.win - 1
    results['起始页：左栏在页签条下方（左栏顶边不高于页签条底边）'] =
      left.top >= strip.bottom - 1
    results['起始页：页签条在工具栏之下（不浮在窗口最顶端）'] =
      strip.top >= 40 && strip.top < startPage.bottom

    // ---------- 编辑态 ----------
    await pressKey('n', { ctrlKey: true }); await sleep(340)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(320)
    }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')
    await sleep(400)

    const editorStrip = await box('[data-testid=tab-strip]')
    const viewport = await box('[data-testid=workspace-viewport]')
    results['编辑态：页签条仍跨满窗口整宽'] =
      !!editorStrip && editorStrip.left <= 1 && editorStrip.right >= editorStrip.win - 1
    results['编辑态：画布区在页签条下方（页签条不压在画布上）'] =
      !!editorStrip && !!viewport && viewport.top >= editorStrip.bottom - 1
    // 图层窗体默认开启时也必须在页签条下方；关闭状态下该断言退化为「无图层窗体」，视为通过。
    const layer = await box('[data-testid=layer-panel]')
    results['编辑态：图层窗体顶边不低于页签条底边'] =
      !!editorStrip && (!layer || layer.top >= editorStrip.bottom - 1)
    console.log('v115: boxes', JSON.stringify({ start: { strip, left }, editor: { strip: editorStrip, viewport, layer } }))

    let pass = 0
    for (const [name, value] of Object.entries(results)) {
      console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value)
      if (value) pass++
    }
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
