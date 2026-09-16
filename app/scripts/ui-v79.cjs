/* C-85/C-86/C-87/C-88/C-89：查看比例与标签旋转的多入口回归。 */
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
    const clickToolbar = (title) => evaluate(`(() => { const e=document.querySelector('[data-testid="toolbar"] button[title="${title}"]'); if(!e || e.disabled)return false; e.click(); return true })()`)
    const readZoom = () => evaluate('Number(document.querySelector("[data-testid=zoom-level]")?.value || 0)')
    const readZoomMode = () => evaluate('document.querySelector("[data-testid=zoom-control]")?.dataset.zoomMode || ""')
    const readRotation = () => evaluate('Number(document.querySelector("[data-testid=label-rotation-indicator]")?.dataset.rotation || 0)')
    const waitFor = async (expression, timeout = 3000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key:name, code:name, bubbles:true, cancelable:true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return true })()`)
    const setRange = (value) => evaluate(`(() => { const e=document.querySelector('[data-testid="status-zoom"] input[type="range"]'); if(!e)return false; const p=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; p.call(e,${Number(value)}); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
    const openView = async () => {
      await click('[data-menu-title="查看(V)"]')
      await sleep(70)
      return evaluate('!!document.querySelector("[data-menu-item=\\"标签旋转\\"]")')
    }
    const clickViewItem = async (label) => {
      if (!await openView()) return false
      return click(`[data-menu-item=${JSON.stringify(label)}]`)
    }
    const clickRotationItem = async (label) => {
      if (!await openView()) return false
      if (!await click('[data-menu-item="标签旋转"]')) return false
      await sleep(70)
      return click(`[data-menu-item=${JSON.stringify(label)}]`)
    }

    await sleep(1500)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(350)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid=wizard-next]'); await sleep(350)
    }
    await click('[data-testid=new-label-select]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')

    results['C-85 工具栏提供放大/缩小/适应宽度/适应高度/撑满窗口'] = await evaluate('(() => { const root=document.querySelector("[data-testid=toolbar]"); return ["放大","缩小","适应宽度","适应高度","撑满窗口"].every((t)=>!!root?.querySelector(`button[title="${t}"]`)) })()')

    await evaluate('(() => { const e=document.querySelector("[data-testid=zoom-level]"); const p=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set; p.call(e,"1"); e.dispatchEvent(new Event("change",{bubbles:true})); })()')
    const beforeMenuZoom = await readZoom()
    await clickViewItem('放大(I)'); await sleep(250)
    results['C-85 查看菜单放大与工具栏共用缩放回调'] = (await readZoom()) > beforeMenuZoom

    results['C-87 状态栏显示比例控件可直接调整'] = await setRange(150) && await waitFor('Number(document.querySelector("[data-testid=zoom-level]")?.value) === 1.5')

    await clickToolbar('适应宽度'); await sleep(250)
    const fitWidth = await readZoomMode()
    await clickViewItem('适应高度'); await sleep(250)
    const fitHeight = await readZoomMode()
    await clickToolbar('撑满窗口'); await sleep(250)
    const fitWindow = await readZoomMode()
    results['C-87 工具栏/查看菜单的三种适应方式写入对应模式'] = fitWidth === 'w' && fitHeight === 'h' && fitWindow === 'win'

    const beforeArrow = await readRotation()
    await click('[data-testid=label-rotation-indicator]'); await sleep(220)
    results['C-86 标尺左上角箭头旋转整个页面'] = beforeArrow === 0 && await waitFor('Number(document.querySelector("[data-testid=label-rotation-indicator]")?.dataset.rotation) === 90')

    const rotationModes = [['正常显示', 0], ['左旋90度', 90], ['右旋90度', 270], ['旋转180度', 180]]
    let allModes = true
    for (const [label, expected] of rotationModes) {
      if (!await clickRotationItem(label)) { allModes = false; break }
      await sleep(180)
      if (await readRotation() !== expected) { allModes = false; break }
    }
    results['C-88/C-89 查看菜单提供并执行正常/左旋90/右旋90/旋转180'] = allModes

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
