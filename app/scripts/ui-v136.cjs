/*
 * 「条码属性 → 条码」页「尺寸」组：三个**下拉** + 新建条码码高默认值，按真机对齐（round-129）。
 *
 * 真机判据（`parity/reference/labelshop/`，逐字）：
 *
 *   probe-sym-pdf417-values.txt
 *     ComboBox label='X 尺寸(&X):'      value='10.00 mil  (选中 5 / 共 61 项)'
 *     ComboBox label='层数(&R):'        value='自动  (选中 0 / 共 89 项)'
 *     ComboBox label='列数(&C):'        value='自动  (选中 0 / 共 31 项)'
 *   probe-sym-pdf417-combos.txt
 *     combo[2] = 1.67 mil / 3.33 mil / 5.00 mil / 6.67 mil / 8.33 mil / 10.00 mil / … / 100.00 mil / 固定宽度
 *     combo[5] = 自动 / 3 / 4 / … / 90
 *     combo[6] = 自动 / 1 / 2 / … / 30
 *   probe-45-barcode-props-p3.txt
 *     Edit label='码  高(&H):' value='10.00'      ← 新建条码的码高默认 10.00 毫米
 *
 * 复刻版本轮改动前：三个控件都是**自由数字框**，且 `层数` 绑的是自造的「层高 = X 尺寸的倍数」
 * （该值当时根本没进渲染）。本脚本钉住：形态（select）、逐项文本、默认档，以及**真的落到模型**
 * （改完关掉属性对话框再打开，值仍是改后的）。
 *
 * 命令：$env:MAXLABEL_UI_SCRIPT='ui-v136.cjs'; npm run test:ui
 */
const http = require('http')
const WebSocket = require('ws')

const X_SIZE_FIRST_SIX = ['1.67 mil', '3.33 mil', '5.00 mil', '6.67 mil', '8.33 mil', '10.00 mil']
const X_SIZE_LAST = '固定宽度'
const PDF417_ROWS = ['自动', ...Array.from({ length: 88 }, (_, index) => String(index + 3))]
const PDF417_COLUMNS = ['自动', ...Array.from({ length: 30 }, (_, index) => String(index + 1))]

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
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e || e.disabled) return false; e.click(); return true })()`)
    const waitFor = async (expression, timeout = 8000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const setValue = (selector, value) => evaluate(`(() => {
      const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false
      const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(String(value))})
      e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
    /** 某 testid 的 select 的逐项文本数组（不存在返回 null） */
    const optionTexts = (testid) => evaluate(`(() => {
      const e=document.querySelector('[data-testid=${JSON.stringify(testid)}]')
      return e ? [...e.options].map((o)=>o.textContent.trim()) : null })()`)
    /** 某 testid 的控件形态 / 选中项文本 */
    const controlState = (testid) => evaluate(`(() => {
      const e=document.querySelector('[data-testid=${JSON.stringify(testid)}]')
      return e ? { tag: e.tagName, value: e.value, selected: e.selectedOptions?.[0]?.textContent.trim() ?? '' } : null })()`)
    const createBarcode = async () => {
      await click('[data-tool="barcode"]'); await sleep(170)
      await evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas'); const b=c.getBoundingClientRect()
        const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons})
        c.dispatchEvent(new MouseEvent('mousedown',p(60,60))); c.dispatchEvent(new MouseEvent('mousemove',p(280,190)))
        c.dispatchEvent(new MouseEvent('mouseup',{...p(280,190,0),buttons:0})); return true })()`)
      await sleep(440)
    }
    const openBarcodeProps = async () => {
      await click('[data-tool="select"]'); await sleep(180)
      await evaluate(`(() => { const r=[...document.querySelectorAll('[data-testid=layer-object-row]')].find((e)=>e.dataset.objectType==='barcode'); if(r && r.dataset.selected!=='true') r.click(); return !!r })()`)
      await sleep(260)
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',altKey:true,bubbles:true,cancelable:true}))`)
      return waitFor('!!document.querySelector("[data-testid=object-props-dialog]")', 5000)
    }
    /** 点属性对话框底排的「确定」提交（真机同款：改动在确定后才落到文档） */
    const confirmProps = async () => {
      await evaluate(`(() => { const b=[...document.querySelectorAll('[data-testid="object-props-dialog"] button')].find((e)=>e.textContent.trim()==='确定'); if(!b) return false; b.click(); return true })()`)
      await sleep(320)
      return waitFor('!document.querySelector("[data-testid=object-props-dialog]")', 4000)
    }
    const useSymbology = async (bcid) => {
      await click('[data-testid="object-props-tab-barcode"]'); await sleep(160)
      await setValue('[data-testid="barcode-symbology"]', bcid); await sleep(320)
    }
    const arrEq = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected)

    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'n',code:'KeyN',ctrlKey:true,bubbles:true,cancelable:true}))`); await sleep(420)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(380)
    }
    await click('[data-testid="new-label-select"]')
    await waitFor('!!document.querySelector("canvas.upper-canvas")', 9000)
    await sleep(400)

    await createBarcode()
    results['新建条码后能打开条码属性'] = await openBarcodeProps()
    await click('[data-testid="object-props-tab-barcode"]'); await sleep(200)

    // ---- ① 尺寸组三个控件的形态与逐项文本（真机 61 / 89 / 31 项） ----
    const xOptions = await optionTexts('barcode-x-size')
    results['X尺寸(&X): 是下拉且为真机 61 项（60 个 mil 档 + 固定宽度）'] =
      Array.isArray(xOptions) && xOptions.length === 61 && arrEq(xOptions.slice(0, 6), X_SIZE_FIRST_SIX)
      && xOptions[59] === '100.00 mil' && xOptions[60] === X_SIZE_LAST
    const xState = await controlState('barcode-x-size')
    results['X尺寸默认档 = 真机 10.00 mil（sel=5）'] = xState?.tag === 'SELECT' && xState?.selected === '10.00 mil'

    // ---- ② 「码  高(&H):」是毫米输入框，改动点「确定」后落到模型 ----
    // （新建条码的**出厂**高度 10mm 由 `objectFactory` 保证，见 `barcode-spec.test.ts` 的 B-134b：
    //  拖拽创建的条码高度取自拖拽框，故这里验的是「字段可改且落到模型」）
    await setValue('[data-testid="barcode-height"]', '15'); await sleep(200)
    await confirmProps()
    await openBarcodeProps(); await click('[data-testid="object-props-tab-barcode"]'); await sleep(220)
    const heightAfter = await evaluate(`document.querySelector('[data-testid="barcode-height"]')?.value`)
    results['码  高(&H): 改为 15 后点确定再打开仍是 15（落到模型）'] = String(heightAfter) === '15'

    // ---- ③ 固定宽度 / mil 档都真的落到模型（点「确定」提交后再打开仍保持） ----
    await setValue('[data-testid="barcode-x-size"]', X_SIZE_LAST); await sleep(260)
    await confirmProps()
    await openBarcodeProps(); await click('[data-testid="object-props-tab-barcode"]'); await sleep(220)
    const afterFixed = await controlState('barcode-x-size')
    results['选「固定宽度」后点确定再打开，仍是「固定宽度」（落到模型）'] = afterFixed?.selected === X_SIZE_LAST

    await setValue('[data-testid="barcode-x-size"]', '20.00 mil'); await sleep(260)
    await confirmProps()
    await openBarcodeProps(); await click('[data-testid="object-props-tab-barcode"]'); await sleep(220)
    const afterMil = await controlState('barcode-x-size')
    results['选「20.00 mil」后点确定再打开，仍是「20.00 mil」'] = afterMil?.selected === '20.00 mil'

    // ---- ④ PDF 417 的 层数(&R): / 列数(&C):（真机 89 / 31 项，默认「自动」） ----
    await useSymbology('pdf417')
    const rowOptions = await optionTexts('pdf417-rows')
    const colOptions = await optionTexts('pdf417-columns')
    results['PDF417 层数(&R): 为真机 89 项下拉（自动 + 3…90）'] =
      Array.isArray(rowOptions) && rowOptions.length === 89 && arrEq(rowOptions, PDF417_ROWS)
    results['PDF417 列数(&C): 为真机 31 项下拉（自动 + 1…30）'] =
      Array.isArray(colOptions) && colOptions.length === 31 && arrEq(colOptions, PDF417_COLUMNS)
    const rowState = await controlState('pdf417-rows')
    const colState = await controlState('pdf417-columns')
    results['层数/列数默认都是「自动」（真机 sel=0）'] =
      rowState?.tag === 'SELECT' && rowState?.selected === '自动' && colState?.tag === 'SELECT' && colState?.selected === '自动'
    const labels = await evaluate(`(() => { const d=document.querySelector('[data-testid="object-props-dialog"]')
      return [...d.querySelectorAll('label,span,div')].filter((e)=>e.children.length===0).map((e)=>(e.textContent||'').trim()) })()`)
    results['字段原文为真机 `层数(&R):` / `列数(&C):`'] =
      Array.isArray(labels) && labels.includes('层数(&R):') && labels.includes('列数(&C):')

    // ---- ⑤ 层数/列数真的落到模型 ----
    await setValue('[data-testid="pdf417-rows"]', '12'); await sleep(200)
    await setValue('[data-testid="pdf417-columns"]', '5'); await sleep(260)
    await confirmProps()
    await openBarcodeProps(); await useSymbology('pdf417')
    const rowAfter = await controlState('pdf417-rows')
    const colAfter = await controlState('pdf417-columns')
    results['选 层数=12 / 列数=5 后点确定再打开仍保持（落到模型）'] =
      rowAfter?.selected === '12' && colAfter?.selected === '5'

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
    if (client) client.ws.close()
    process.exit(1)
  }
})()
