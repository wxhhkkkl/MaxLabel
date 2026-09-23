/* B6 条码页：码制、尺寸与 Code128/QR 特殊选项逐项回归。 */
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
    const setSelect = (selector, value) => evaluate(`(() => {
      const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false
      const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set
      setter.call(e,${JSON.stringify(String(value))})
      e.dispatchEvent(new Event('change',{bubbles:true})); return true
    })()`)
    const setBarcodeSymbology = (value) => evaluate(`(() => {
      const d=document.querySelector('[data-testid="object-props-dialog"]');
      const e=[...d?.querySelectorAll('select')||[]].find((s)=>s.options.length===20); // round-57: 真机码制 20 项
      if(!e)return false;
      const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;
      setter.call(e,${JSON.stringify(value)}); e.dispatchEvent(new Event('change',{bubbles:true})); return true
    })()`)
    const waitFor = async (expression, timeout = 2500) => {
      const started = Date.now()
      while (Date.now() - started < timeout) { if (await evaluate(expression)) return true; await sleep(80) }
      return false
    }
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key:name, code:name, bubbles:true, cancelable:true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return true })()`)
    const clickCanvas = (x, y) => evaluate(`(() => {
      const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false
      const b=c.getBoundingClientRect(); const clientX=b.left+${x}, clientY=b.top+${y}
      const p={bubbles:true,cancelable:true,view:window,clientX,clientY,button:0,buttons:1}
      try { c.dispatchEvent(new PointerEvent('pointerdown',p)); c.dispatchEvent(new PointerEvent('pointerup',{...p,buttons:0})) } catch (e) {}
      c.dispatchEvent(new MouseEvent('mousedown',p)); c.dispatchEvent(new MouseEvent('mouseup',{...p,buttons:0})); c.dispatchEvent(new MouseEvent('click',{...p,buttons:0})); return true
    })()`)
    const selectBarcode = () => evaluate(`(() => {
      const row=document.querySelector('[data-testid="layer-object-row"][data-object-type="barcode"]');
      if(!row)return false; if(row.dataset.selected!=='true')row.click(); return true
    })()`)
    const openProps = async () => {
      if (!await selectBarcode()) return false
      await key('Enter', { altKey: true })
      return waitFor('!!document.querySelector("[data-testid=object-props-dialog]")')
    }
    const closeProps = async () => { await click('[data-testid="object-props-dialog"] button[aria-label="关闭"]'); await sleep(160) }

    await sleep(1500)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(300)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await click('[data-testid=wizard-next]'); await sleep(300) }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')

    await click('[data-tool="barcode"]'); await clickCanvas(320, 170); await sleep(400)
    if (!await waitFor('!!document.querySelector("[data-testid=layer-object-row][data-object-type=barcode]")')) throw new Error('barcode row missing')
    if (!await openProps()) throw new Error('barcode props did not open')
    await click('[data-testid="object-props-tab-barcode"]'); await sleep(120)

    const expectedTypes = ['code39', 'code128', 'ean13', 'interleaved2of5', 'code93', 'upca', 'ean8', 'upce', 'codabar', 'industrial2of5', 'matrix2of5', 'datalogic2of5', 'pharmacode', 'itf14', 'databaromni', 'pdf417', 'qrcode', 'datamatrix', 'hanxin', 'microqrcode']
    results['B-68 码制下拉按真机下拉顺序包含20种码制'] = await evaluate(`(() => {
      const selects=[...document.querySelectorAll('[data-testid="object-props-dialog"] select')]
      const barcode=selects.find((e)=>e.value==='code128' || e.value==='code39' || e.options.length===20)
      return JSON.stringify([...(barcode?.options||[])].map((e)=>e.value))===${JSON.stringify(JSON.stringify(expectedTypes))}
    })()`)

    // round-127：`条宽比(&W):` 自 round-124 起**按码制条件渲染**（真机 probe-sym-*-values.txt：Code 128 无此行、
    // Code 39 等 8 种码制有，7 档 2.00…3.00）——原先这条断言在新建条码的默认码制 Code 128 上读 `条宽比`，
    // 与真机口径冲突。现改为**切到 Code 39**（真机有该行的码制）读取，档位数组与升级前逐项相同，强度不降；
    // Code 128 上「没有该行」的负面断言由 ui-v126.cjs 单独钉住。
    // round-129：真机 `X 尺寸(&X):` 是 **61 项下拉**（60 个 mil 档 + `固定宽度`，步长 1/600 英寸，默认 `10.00 mil`）
    // ——`probe-sym-pdf417-values.txt`：`value='10.00 mil  (选中 5 / 共 61 项)'`。原先自由数字框（min1/max1000/step1）
    // 不是真机形态，故本断言改为**逐项文本全等**（强度只增）。
    const sizeState = await evaluate(`(() => {
      const d=document.querySelector('[data-testid="object-props-dialog"]'); const x=d?.querySelector('[data-testid="barcode-x-size"]')
      const opts=[...(x?.options||[])].map((o)=>o.textContent)
      return { count:opts.length, first:opts[0], sixth:opts[5], last:opts[opts.length-1], value:x?.value, unit:d?.innerText.includes('mil') }
    })()`)
    const code128HasRatio = await evaluate(`(() => { const d=document.querySelector('[data-testid="object-props-dialog"]');
      return [...d?.querySelectorAll('select')||[]].some((e)=>[...e.options].some((o)=>o.value==='2.5')) })()`)
    await setBarcodeSymbology('code39'); await sleep(180)
    const ratioState = await evaluate(`(() => {
      const d=document.querySelector('[data-testid="object-props-dialog"]')
      const ratio=[...d?.querySelectorAll('select')||[]].find((e)=>[...e.options].some((o)=>o.value==='2.5'))
      return { shown:!!ratio, options:[...(ratio?.options||[])].map((e)=>e.value) }
    })()`)
    await setBarcodeSymbology('code128'); await sleep(180)
    await click('[data-testid="object-props-tab-general"]'); await sleep(100)
    const heightVisible = await evaluate('document.querySelector("[data-testid=object-props-dialog]")?.innerText.includes("高度")')
    await click('[data-testid="object-props-tab-barcode"]'); await sleep(80)
    // B-69 拆成两条，覆盖面比原来更宽（原来只查「有条宽比」；现在同时钉住「Code 128 没有、Code 39 有且 7 档」）：
    // ① X 尺寸 mil 的 min/max/step + 单位 + 常规页保留高度（原断言的前半段）
    results['B-69 X尺寸(X): 按真机为 61 项下拉（1.67 mil 起 / 第 6 项 10.00 mil 默认 / 末项 固定宽度），常规页保留高度'] =
      Boolean(sizeState && sizeState.count === 61 && sizeState.first === '1.67 mil' && sizeState.sixth === '10.00 mil'
        && sizeState.last === '固定宽度' && sizeState.value === '10.00 mil' && sizeState.unit) && heightVisible
    // ② 条宽比按真机口径**按码制**出现：Code 128（默认码制）无此行、Code 39 有且 7 档 2.00–3.00
    results['B-69a 条宽比(W): 按真机按码制显示（Code 128 无 / Code 39 有且 7 档 2.00–3.00）'] =
      Boolean(ratioState && code128HasRatio === false && ratioState.shown === true && JSON.stringify(ratioState.options) === JSON.stringify(['2', '2.17', '2.33', '2.5', '2.67', '2.83', '3']))
    // round-57（DIFF-59）：真机条码页有「码  高(&H)」与「供人识读字符」组，复刻版补齐
    // round-113（DIFF-72）：字段名逐字改成真机原文（含加速键；「码」与「高」之间两个空格）——断言同步加严
    results['B-69b 条码页含「码  高(H):」与供人识读字符（位置/垂直偏移/对齐方式）四项'] = await evaluate(`(() => { const d=document.querySelector('[data-testid="object-props-dialog"]'); const t=d?.innerText||''; return !!d?.querySelector('[data-testid="barcode-height"]') && !!d?.querySelector('[data-testid="barcode-human-position"]') && !!d?.querySelector('[data-testid="barcode-human-offset"]') && !!d?.querySelector('[data-testid="barcode-human-align"]') && t.includes('码  高(H):') && t.includes('垂直偏移(O):') && t.includes('对齐方式(A):') })()`)

    await setBarcodeSymbology('code128'); await sleep(160)
    await click('[data-testid="object-props-tab-barcode"]'); await sleep(120)
    // 真机条码属性只有 4 个页签，码制专属字段在「条码」页内的「条码特殊选项」分组里（无独立码制页签）
    results['B-70 条码特殊选项按码制切换且在条码页的「条码特殊选项」分组内'] = await evaluate(`(() => {
      const d=document.querySelector('[data-testid="object-props-dialog"]')
      const tabs=[...d?.querySelectorAll('[data-testid^="object-props-tab-"]')||[]].map((e)=>e.textContent.trim())
      const group=document.querySelector('[data-testid="barcodeSpecial"]')
      return JSON.stringify(tabs)===JSON.stringify(['数据源','条码','字体','常规']) &&
        !!group && (group.innerText||'').includes('特殊选项')
    })()`)
    const charsetState = await evaluate(`(() => {
      const d=document.querySelector('[data-testid="object-props-dialog"]'); const s=[...d.querySelectorAll('select')].find((e)=>[...e.options].some((o)=>o.value==='manual'))
      // round-127：真机原文是 GS1/EAN 128(&U)（probe-60-barcode-props-tree.txt (961,704)）——
      // GS1/EAN 与 128 之间是空格、无连字符，且带加速键。断言随之换成真机原文。
      const gs1=[...d.querySelectorAll('input[type=checkbox]')].find((e)=>e.parentElement?.textContent.includes('GS1/EAN 128(U)'))
      return { charset:[...(s?.options||[])].map((e)=>e.value), value:s?.value, gs1:!!gs1, fnc1:d.innerText.includes('^1') }
    })()`)
    results['B-74 Code128 提供 GS1/EAN 128(U) 与 ^1 FNC1 说明'] = Boolean(charsetState && charsetState.gs1 && charsetState.fnc1)
    results['B-75 Code128 字符集默认自动且含 A/B/C/手动'] = Boolean(charsetState && charsetState.value === 'auto' && JSON.stringify(charsetState.charset) === JSON.stringify(['auto', 'a', 'b', 'c', 'manual']))
    await closeProps()

    if (!await openProps()) throw new Error('barcode props did not reopen')
    await click('[data-testid="object-props-tab-barcode"]'); await sleep(80)
    await setBarcodeSymbology('qrcode'); await sleep(180)
    await sleep(100)
    const qrState = await evaluate(`(() => {
      const d=document.querySelector('[data-testid="object-props-dialog"]'); const selects=[...d.querySelectorAll('select')]
      return { gs1:d.innerText.includes('GS1 模式'), ecl:selects.some((e)=>e.options.length===4 && [...e.options].every((o)=>['L','M','Q','H'].includes(o.value))), encoding:d.innerText.includes('字符编码'), icon:d.innerText.includes('图标区域') }
    })()`)
    results['B-85 QR Code 的「条码特殊选项」分组提供 GS1/纠错/编码/图标区域'] = Boolean(qrState && qrState.gs1 && qrState.ecl && qrState.encoding && qrState.icon)
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
