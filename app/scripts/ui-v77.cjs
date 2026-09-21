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

    const sizeState = await evaluate(`(() => {
      const d=document.querySelector('[data-testid="object-props-dialog"]'); const x=d?.querySelector('[data-testid="barcode-x-size"]')
      const ratio=[...d?.querySelectorAll('select')||[]].find((e)=>[...e.options].some((o)=>o.value==='2.5'))
      return { xMin:x?.min, xMax:x?.max, xStep:x?.step, unit:d?.innerText.includes('mil'), ratio:[...(ratio?.options||[])].map((e)=>e.value) }
    })()`)
    await click('[data-testid="object-props-tab-general"]'); await sleep(100)
    const heightVisible = await evaluate('document.querySelector("[data-testid=object-props-dialog]")?.innerText.includes("高度")')
    await click('[data-testid="object-props-tab-barcode"]'); await sleep(80)
    results['B-69 条码尺寸提供 mil X尺寸与条宽比（真机 7 档 2.00–3.00），常规页保留高度'] = Boolean(sizeState && sizeState.xMin === '1' && sizeState.xMax === '1000' && sizeState.xStep === '1' && sizeState.unit && JSON.stringify(sizeState.ratio) === JSON.stringify(['2', '2.17', '2.33', '2.5', '2.67', '2.83', '3'])) && heightVisible
    // round-57（DIFF-59）：真机条码页有「码  高(&H)」与「供人识读字符」组，复刻版补齐
    // round-113（DIFF-72）：字段名逐字改成真机原文（含加速键；「码」与「高」之间两个空格）——断言同步加严
    results['B-69b 条码页含「码  高(&H):」与供人识读字符（位置/垂直偏移/对齐方式）四项'] = await evaluate(`(() => { const d=document.querySelector('[data-testid="object-props-dialog"]'); const t=d?.innerText||''; return !!d?.querySelector('[data-testid="barcode-height"]') && !!d?.querySelector('[data-testid="barcode-human-position"]') && !!d?.querySelector('[data-testid="barcode-human-offset"]') && !!d?.querySelector('[data-testid="barcode-human-align"]') && t.includes('码  高(&H):') && t.includes('垂直偏移(&O):') && t.includes('对齐方式(&A):') })()`)

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
      const gs1=[...d.querySelectorAll('input[type=checkbox]')].find((e)=>e.parentElement?.textContent.includes('GS1/EAN-128'))
      return { charset:[...(s?.options||[])].map((e)=>e.value), value:s?.value, gs1:!!gs1, fnc1:d.innerText.includes('^1') }
    })()`)
    results['B-74 Code128 提供 GS1/EAN-128 与 ^1 FNC1 说明'] = Boolean(charsetState && charsetState.gs1 && charsetState.fnc1)
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
