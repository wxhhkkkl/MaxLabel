/* D-57/D-58：打印时输入数据的触发、回车确认与取消。 */
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
    const click = (selector) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e || !e.isConnected) return false; e.click(); return true })()`)
    const key = (name, options = {}) => evaluate(`(() => { const event = new KeyboardEvent('keydown', ${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(event); document.dispatchEvent(event); return true })()`)
    const setValue = (selector, value) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return false; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set; setter?.call(e, ${JSON.stringify(String(value))}); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return e.value })()`)

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(350)
    await click('[data-testid="wizard-next"]'); await sleep(450)
    await evaluate(`(() => { const items = [...document.querySelectorAll('button')].filter((e) => e.offsetParent && (e.textContent || '').trim() === '选择'); items.at(-1)?.click(); return true })()`)
    await sleep(800)
    await click('[data-tool="text"]')
    await evaluate(`(() => { const host = document.querySelector('[data-testid="canvas-host"], .canvas-container, canvas'); if (!host) return false; const r = host.getBoundingClientRect(); const x=r.left+220, y=r.top+180; const target=document.elementFromPoint(x,y)||host; target.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:x,clientY:y,button:0})); target.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,clientX:x,clientY:y,button:0})); target.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:x,clientY:y,button:0})); return true })()`)
    await sleep(450)
    await key('Enter', { altKey: true }); await sleep(450)
    // 数据源侧已有“键盘输入”变量；直接通过属性对话框替换为键盘输入，复现打印前输入流程。
    await click('[data-testid="object-props-tab-datasource"]'); await sleep(100)
    await click('[data-testid="source-kind-keyboard"]'); await sleep(100)
    await setValue('[data-testid="keyboard-label"]', '批次号')
    await evaluate(`(() => { const root=document.querySelector('[data-testid="object-props-dialog"]'); const button=[...(root?.querySelectorAll('button')||[])].find((e)=>(e.textContent||'').trim()==='确定'); button?.click(); return !!button })()`); await sleep(150)
    await click('[data-testid="print-submit"]'); await sleep(400)
    results['keyboard source triggers print-time input dialog'] = await evaluate(`(() => { const root=document.querySelector('[data-testid=keyboard-input-modal]'); return !!root && root.textContent.includes('提示输入数据') && root.textContent.includes('输入数据') && !!root.querySelector('[data-testid=keyboard-input-批次号]') })()`)
    results['keyboard input dialog exposes cancel and help'] = await evaluate('!!document.querySelector("[data-testid=keyboard-input-cancel]") && !!document.querySelector("[data-testid=keyboard-input-help]")')
    await setValue('[data-testid="keyboard-input-批次号"]', 'LOT-001')
    await evaluate(`(() => { const e=document.querySelector('[data-testid="keyboard-input-批次号"]'); e?.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true})); return true })()`)
    await sleep(600)
    results['Enter confirms input and closes dialog'] = await evaluate('!document.querySelector("[data-testid=keyboard-input-modal]")')

    let pass = 0
    for (const [name, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value); if (value) pass++ }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    client.ws.close(); process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
