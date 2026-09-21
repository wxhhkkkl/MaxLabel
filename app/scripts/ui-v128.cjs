/*
 * round-60：收口 DIFF-62 的两项（真机/帮助明确、复刻版原先缺的）。
 *
 * 1) 共享变量名：真机数据源页的「变量共享名称(&N)」是**可编辑组合框**（下拉可选已有名，也可手输新名），
 *    复刻版原先只有输入框 → 现在挂 `datalist`（列出文档里已用过的共享名）。
 * 2) 截短「保留」：帮助 datasource_advanced_cut.html「保留……也可以单独保留数字的整数或者小数部分（包含小数点）」，
 *    复刻版原先只有 保留左/右 N 字符 → 现在加「保留整数部分 / 保留小数部分（含小数点）」
 *    （语义在 datasource.ts 的 applyCut 里实现，单测 editor-operations.test.ts 覆盖）。
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
    await client.send('Runtime.enable')
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
    const waitFor = async (expression, timeout = 5000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const optionTexts = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); return e ? [...e.options].map((o)=>o.textContent.trim()) : null })()`)
    const createObject = async (tool, x1, y1, x2, y2) => {
      await click(`[data-tool="${tool}"]`); await sleep(170)
      await evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas'); const b=c.getBoundingClientRect()
        const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons})
        c.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1}))); c.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2})))
        c.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2},0),buttons:0})); return true })()`)
      await sleep(440)
    }
    const openObjectProps = async (index = 0) => {
      await click('[data-tool="select"]'); await sleep(180)
      await evaluate(`(() => { const rows=[...document.querySelectorAll('[data-testid=layer-object-row][data-object-type="text"]')]
        const r=rows[${index}]; if(!r)return false; if(r.dataset.selected!=='true') r.click(); return true })()`)
      await sleep(260)
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',altKey:true,bubbles:true,cancelable:true}))`)
      return waitFor('!!document.querySelector("[data-testid=object-props-dialog]")', 5000)
    }
    const confirmProps = async () => {
      await evaluate(`(() => { const d=document.querySelector('[data-testid=object-props-dialog]'); const b=[...d.querySelectorAll('button')].find((x)=>x.textContent.trim()==='确定'); b.click(); return true })()`)
      await waitFor('!document.querySelector("[data-testid=object-props-dialog]")', 3000)
      await sleep(240)
    }
    const closeProps = async () => {
      await evaluate(`document.querySelector('[data-testid=object-props-dialog] button[aria-label]')?.click()`)
      await waitFor('!document.querySelector("[data-testid=object-props-dialog]")', 3000)
      await sleep(220)
    }

    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'keyN',code:'KeyN',ctrlKey:true,bubbles:true,cancelable:true}))`); await sleep(200)
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'n',code:'KeyN',ctrlKey:true,bubbles:true,cancelable:true}))`); await sleep(420)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(380)
    }
    await click('[data-testid="new-label-select"]')
    await waitFor('!!document.querySelector("canvas.upper-canvas")', 9000)
    await sleep(400)
    await createObject('text', 60, 60, 220, 110)
    await createObject('text', 300, 60, 460, 110)

    // ---------- DIFF-62 ①：共享变量名（对象 A 命名 → 对象 B 能下拉选到） ----------
    // 真机的「变量共享名称」是子串的属性（帮助 datasource_shard.html：在两个对象中为子串使用相同的共享变量名称），
    // 所以先加一条子串使该字段出现。
    if (!await openObjectProps(0)) throw new Error('第一个文字对象属性没打开')
    await click('[data-testid="object-props-tab-datasource"]'); await sleep(300)
    await click('[data-testid="source-substring-add"]'); await sleep(300)
    const namedOk = await setValue('[data-testid="shared-source-name"]', 'BatchNo')
    await sleep(260)
    await confirmProps()

    if (!await openObjectProps(1)) throw new Error('第二个文字对象属性没打开')
    await click('[data-testid="object-props-tab-datasource"]'); await sleep(320)
    await click('[data-testid="source-substring-add"]'); await sleep(320)
    const datalistNames = await evaluate(`[...(document.querySelector('[data-testid="shared-source-name-options"]')?.options||[])].map((o)=>o.value)`)
    const inputHasList = await evaluate(`document.querySelector('[data-testid="shared-source-name"]')?.getAttribute('list') === 'maxlabel-shared-names'`)
    const pickedOk = await setValue('[data-testid="shared-source-name"]', 'BatchNo')
    await sleep(220)
    results['DIFF-62① 共享变量名可从「文档里已用过的名字」下拉选（真机是可编辑组合框）'] =
      namedOk === true && inputHasList === true && Array.isArray(datalistNames) && datalistNames.includes('BatchNo') && pickedOk === true

    // ---------- DIFF-62 ②：截短「保留整数部分 / 小数部分」 ----------
    // 文本页签里的「截短」下拉（textObj.substr.cutType）
    await click('[data-testid="object-props-tab-text"]'); await sleep(300)
    const cutOptions = await optionTexts('[data-testid="text-cut-type"]')
    const keepDecimalOk = await setValue('[data-testid="object-props-dialog"] [data-testid="text-cut-type"]', 'keepDecimal')
    await sleep(260)
    const cutValue = await evaluate(`document.querySelector('[data-testid="text-cut-type"]')?.value`)
    results['DIFF-62② 截短含「保留整数部分 / 保留小数部分（含小数点）」（帮助 datasource_advanced_cut.html）'] =
      Array.isArray(cutOptions) && cutOptions.includes('保留整数部分') && cutOptions.includes('保留小数部分（含小数点）') &&
      keepDecimalOk === true && cutValue === 'keepDecimal'
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
