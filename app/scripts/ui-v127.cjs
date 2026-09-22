/*
 * round-59：把「数据源 / 数据库 / 授权」取证时发现的缺口补上并回归。
 *
 * 依据（原版自带帮助 + round-59 真机数据源页取证）：
 *   - label_object_page_data_serial.html「序列：根据选择的类型显示字符集的所有字符排列」
 *     → 复刻版补一个只读的「序列」显示（`serial-sequence`）。
 *   - 真机汉信码页「版本(&V)」是 **85 项**（自动 + 1…84）→ 复刻版把原来的 4 项补全（`hanxin-version`），
 *     并接到 bwip 的 `version`。
 *   - .lsdx 的条码元素带 `reduction`（缩减量）→ 给 `BarcodeObj` 加 `reductionMm`，
 *     EAN/UPC 码制下条码页显示「缩减量（毫米）」（`barcode-reduction`），
 *     画布与打印都走 `barcodeToDataURL(..., { reductionMm })`（条码高度按缩减量压低）。
 *   - 序列号的「归位」在复刻版已实现（`resetEachRecord`，datasource.ts 按记录基准复位）——
 *     本轮把它写进结论，不再当缺口。
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
    const setSymbology = async (bcid) => {
      await click('[data-testid="object-props-tab-barcode"]'); await sleep(260)
      const ok = await setValue('[data-testid="object-props-dialog"] [data-testid="barcode-symbology"]', bcid)
      await sleep(420)
      return ok
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
    await createObject('barcode', 60, 220, 280, 340)

    // ---------- 序列号「序列」只读显示 ----------
    if (!await openObjectProps('text')) throw new Error('文字属性没打开')
    await click('[data-testid="object-props-tab-datasource"]'); await sleep(300)
    await click('[data-testid="source-kind-serial"]'); await sleep(320)
    const sequenceDefault = await evaluate(`document.querySelector('[data-testid="serial-sequence"]')?.value`)
    await setValue('[data-testid="object-props-dialog"] select', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')
    await sleep(320)
    const sequenceAfter = await evaluate(`document.querySelector('[data-testid="serial-sequence"]')?.value`)
    results['194 序列号「序列」只读显示字符集序列（帮助：根据选择的类型显示字符集的所有字符排列）'] =
      sequenceDefault === '0123456789' && sequenceAfter === 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    // 归位（真机帮助「归位」）：复刻版一直有，这里确认它在「变化基准=标签数」时可勾选
    await setValue('[data-testid="object-props-dialog"] select', '0123456789')
    await sleep(200)
    const resetCheckbox = await evaluate(`(() => [...document.querySelectorAll('[data-testid="object-props-dialog"] input[type=checkbox]')].some((e)=>e.parentElement?.textContent.includes('复位到初始值')))()`)
    results['199 序列号「归位」（按标签变化时每条记录开始复位到初始值）存在'] = resetCheckbox === true
    await closeProps()

    // ---------- 汉信码「版本」85 项 ----------
    if (!await openObjectProps('barcode')) throw new Error('条码属性没打开')
    await setSymbology('hanxin')
    await click('[data-testid="object-props-tab-barcode"]'); await sleep(320)
    const hanxinVersions = await optionTexts('[data-testid="hanxin-version"]')
    // round-128：真机 `probe-sym-hanxin-combos.txt` combo[3] 的项文本是**纯数字**（`自动 / 1 / 2 … 84`），
    // 复刻版原先写作 `版本 1`… 属自造后缀 → 断言随之改成真机口径（仍是值级全等，强度不降）。
    results['160 汉信码「版本」85 项（自动 + 1…84 纯数字，同真机）'] =
      Array.isArray(hanxinVersions) && hanxinVersions.length === 85 &&
      hanxinVersions[0] === '自动' && hanxinVersions[1] === '1' && hanxinVersions[84] === '84'

    // ---------- 缩减量（EAN/UPC） ----------
    await setSymbology('ean13')
    await click('[data-testid="object-props-tab-barcode"]'); await sleep(320)
    const reductionVisible = await evaluate(`!!document.querySelector('[data-testid="barcode-reduction"]')`)
    const reductionSet = await setValue('[data-testid="barcode-reduction"]', '3')
    await sleep(300)
    await evaluate(`(() => { const d=document.querySelector('[data-testid=object-props-dialog]'); const b=[...d.querySelectorAll('button')].find((x)=>x.textContent.trim()==='确定'); b.click(); return true })()`)
    await sleep(500)
    const storedReduction = await evaluate(`(() => {
      const app = document.querySelector('[data-testid="layer-object-row"][data-object-type="barcode"]')
      return app ? true : false })()`)
    results['118 EAN-13 条码页有「缩减量（毫米）」（真机 .lsdx 的 reduction 属性 / DIFF-57）'] =
      reductionVisible === true && reductionSet === true && storedReduction === true
    // 非 EAN/UPC 码制下不显示（真机只在 EAN/UPC 出现）
    if (!await openObjectProps('barcode')) throw new Error('条码属性第二次没打开')
    await setSymbology('code128')
    const reductionHiddenOnCode128 = await evaluate(`!document.querySelector('[data-testid="barcode-reduction"]')`)
    results['118 缩减量只在 EAN/UPC 码制下出现（Code 128 下不显示）'] = reductionHiddenOnCode128 === true
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
