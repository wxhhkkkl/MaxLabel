/* round-117 DIFF-63：序列号数据源面板的「重置」按钮与字段名逐字对齐真机。
 *
 * 真机证据：
 * - `parity/reference/labelshop/PROBE-verifier-round88-DIFF63-serial.md`：真机「序列号设置」里
 *   **只有**一个 `重置` 按钮，控件树为 `[V] class=Button DISABLED text='重置'` —— **可见且禁用**；
 *   同对话框字段原文为 `类型(&T):` / `序列(&Q):` / `步长(&S):` / `重复(&E):` / `初始值来源(&R):`。
 * - `PROBE-round104-DIFF63.md`：资源里的「重置初始值:」「立即重置」在本机全部可达状态下都是**隐藏**控件，
 *   用户点不到 → 复刻版**不落地**这两项（口径同「应用(&A)」隐藏控件）。
 *
 * 断言口径（不许按猜测造行为）：
 * ① `重置` 存在、可见、**禁用**，且点它不改变「显示数据」（真机本机观测恒禁用，启用条件未知）；
 * ② 序列号区的 label **整数组全等**真机原文（含加速键），不是"包含"；
 * ③ 整个对话框内不出现「立即重置」「重置初始值」两处隐藏控件字样。
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
    const setValue = (selector, value) => evaluate(`(() => {
      const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false
      const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(String(value))})
      e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
    const waitFor = async (expression, timeout = 6000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const createObject = async (tool, x1, y1, x2, y2) => {
      await click(`[data-tool="${tool}"]`); await sleep(170)
      await evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas'); const b=c.getBoundingClientRect()
        const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons})
        c.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1}))); c.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2})))
        c.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2},0),buttons:0})); return true })()`)
      await sleep(440)
    }
    const openObjectProps = async (type) => {
      await click('[data-tool="select"]'); await sleep(180)
      await evaluate(`(() => { const r=[...document.querySelectorAll('[data-testid=layer-object-row]')].find((e)=>e.dataset.objectType===${JSON.stringify(type)}); if(r && r.dataset.selected!=='true') r.click(); return !!r })()`)
      await sleep(260)
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',altKey:true,bubbles:true,cancelable:true}))`)
      return waitFor('!!document.querySelector("[data-testid=object-props-dialog]")', 5000)
    }
    const closeProps = async () => {
      await evaluate(`document.querySelector('[data-testid=object-props-dialog] button[aria-label]')?.click()`)
      await waitFor('!document.querySelector("[data-testid=object-props-dialog]")', 3000)
      await sleep(220)
    }

    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'n',code:'KeyN',ctrlKey:true,bubbles:true,cancelable:true}))`); await sleep(420)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(380)
    }
    await click('[data-testid="new-label-select"]')
    await waitFor('!!document.querySelector("canvas.upper-canvas")', 9000)
    await sleep(400)
    await createObject('text', 60, 60, 220, 110)

    if (!await openObjectProps('text')) throw new Error('文字属性没打开')
    await click('[data-testid="object-props-tab-datasource"]'); await sleep(300)
    await click('[data-testid="source-kind-serial"]'); await sleep(360)

    // ---------- ② 序列号区 label 整数组全等真机原文（含加速键） ----------
    const labels = await evaluate(`[...document.querySelector('[data-testid="data-source-editor"]').querySelectorAll('label')].map((e)=>e.textContent.trim())`)
    const expected = ['显示数据前缀', '类型(&T):', '序列(&Q):', '显示数据', '序列起始值', '步长(&S):', '位数', '重复(&E):', '变化基准', '初始值来源(&R):', '初始值字段', '按标签变化时每条记录开始复位到初始值']
    results['DIFF-63 序列号区字段名整数组全等真机原文（类型(&T):/序列(&Q):/步长(&S):/重复(&E):/初始值来源(&R):）'] =
      JSON.stringify(labels) === JSON.stringify(expected)

    // ---------- ① `重置` 按钮：存在、可见、禁用，点它不改变显示数据 ----------
    const reset = await evaluate(`(() => {
      const b=document.querySelector('[data-testid="data-source-editor"] [data-testid="serial-reset"]')
      if(!b) return null
      return { tag: b.tagName, text: b.textContent.trim(), disabled: b.disabled === true, visible: b.offsetParent !== null }
    })()`)
    results['DIFF-63 序列号区有且只有一个「重置」按钮且可见'] =
      !!reset && reset.tag === 'BUTTON' && reset.text === '重置' && reset.visible === true &&
      (await evaluate(`[...document.querySelectorAll('[data-testid="data-source-editor"] button')].filter((b)=>b.textContent.trim()==='重置').length === 1`)) === true
    results['DIFF-63 「重置」默认禁用（真机 round-88 控件树 [V] DISABLED）'] = !!reset && reset.disabled === true

    const before = await evaluate(`document.querySelector('[data-testid="serial-current"]')?.value`)
    await evaluate(`(() => { const b=document.querySelector('[data-testid="serial-reset"]'); b?.click(); return true })()`)
    await sleep(260)
    const after = await evaluate(`document.querySelector('[data-testid="serial-current"]')?.value`)
    results['DIFF-63 点「重置」不改变显示数据（禁用态无行为，与真机一致）'] = before !== null && before === after

    // ---------- ③ 真机的隐藏控件「重置初始值:」「立即重置」不落地 ----------
    const dialogText = await evaluate(`document.querySelector('[data-testid="object-props-dialog"]')?.innerText || ''`)
    results['DIFF-63 不落地真机的隐藏控件「立即重置」「重置初始值:」'] =
      !dialogText.includes('立即重置') && !dialogText.includes('重置初始值')
    await closeProps()

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
