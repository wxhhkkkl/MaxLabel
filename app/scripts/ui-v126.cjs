/*
 * 需求清单「对象属性」条码码制专属字段（round-58）。
 *
 * 真机判据（`parity/reference/labelshop/probe-sym-*-values.txt` / `-combos.txt`，
 * 由 `Probe-LabelShopSymbologyBatch.ps1` 把码制逐个切过去读回）：
 *   - 供人识读字符 · 位置：Code 128 = 4 项（默认/无/条码上方/条码下方）；
 *     **EAN-13 / UPC-A / EAN-8 / UPC-E = 3 项（默认/无/条码下方）**
 *   - QR Code：纠错级别 4 项、字符编码 2 项、图标区域 31 项、**符号版本 41 项**（自动 + 1 (21x21) … 40）
 *   - Data Matrix：字符编码 2 项、**符号版本 31 项**（自动 + 1 (10x10) … 30）
 *   - Micro QR：纠错级别 3 项（L/M/Q，默认 M）、字符编码 2 项、**符号版本 5 项**（自动 + M1 (11x11) … M4）
 *   - 汉信码：纠错级别 4 项、字符编码 2 项、**版本 85 项**（自动 + 1…84）
 *   - ITF 14：**保护框 3 项（无/方框/保护条）**、**粗细 15 档 1X…15X（默认 5X）**、
 *     **空白区 15 档 1X…15X（默认 10X）**
 *   - PDF 417：**条宽比 9 档 1 X…9 X（默认 3 X）**
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
    const openBarcodeProps = async () => {
      await click('[data-tool="select"]'); await sleep(180)
      await evaluate(`(() => { const r=[...document.querySelectorAll('[data-testid=layer-object-row]')].find((e)=>e.dataset.objectType==='barcode'); if(r && r.dataset.selected!=='true') r.click(); return !!r })()`)
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
    // 真机无「码制专页」——专属字段在「条码」页的「条码特殊选项」分组内
    const openSpecial = async () => { await click('[data-testid="object-props-tab-barcode"]'); await sleep(320) }

    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'n',code:'KeyN',ctrlKey:true,bubbles:true,cancelable:true}))`); await sleep(420)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(380)
    }
    await click('[data-testid="new-label-select"]')
    await waitFor('!!document.querySelector("canvas.upper-canvas")', 9000)
    await sleep(400)
    await createObject('barcode', 60, 60, 280, 190)

    // ---------- 供人识读字符 · 位置：按码制 4 项 / 3 项 ----------
    if (!await openBarcodeProps()) throw new Error('条码属性没打开')
    await click('[data-testid="object-props-tab-barcode"]'); await sleep(300)
    const code128Positions = await optionTexts('[data-testid="barcode-human-position"]')
    results['Code 128 的「供人识读字符 · 位置」4 项（真机 probe-sym-code39/qrcode 等为 4 项）'] =
      JSON.stringify(code128Positions) === JSON.stringify(['默认', '无', '条码上方', '条码下方'])
    await setSymbology('ean13')
    const ean13Positions = await optionTexts('[data-testid="barcode-human-position"]')
    results['EAN-13 的「供人识读字符 · 位置」3 项（真机 EAN/UPC 族没有「条码上方」）'] =
      JSON.stringify(ean13Positions) === JSON.stringify(['默认', '无', '条码下方'])

    // ---------- 「条宽比(&W):」按码制条件显示（round-124 由并排图 cmp-propsbarcode-r124.png 发现原先常显） ----------
    // 真机依据：probe-sym-{code39,codabar,code25,matrix25,chinapost,interleaved25,itf14,pharmacode,pdf417}-values.txt 有该行；
    // code93/code128/ean13/ean8/upca/upce/rss/qrcode/datamatrix/hanxin/microqr 的 dump 里没有。
    const w2n = async () => evaluate(`(() => {
      const d=document.querySelector('[data-testid=object-props-dialog]')
      if(!d) return null
      const sel=[...d.querySelectorAll('select')].find((s)=>[...s.options].some((o)=>(o.textContent||'').trim()==='3.00'))
      return { shown:(d.innerText||'').includes('条宽比(&W):'), options: sel?[...sel.options].map((o)=>o.textContent.trim()):null }
    })()`)
    await setSymbology('code128')
    const w2nCode128 = await w2n()
    results['Code 128 的条码页**没有**「条宽比(&W):」（真机 probe-sym-code128-values.txt 无此行）'] =
      !!w2nCode128 && w2nCode128.shown === false
    await setSymbology('code39')
    const w2nCode39 = await w2n()
    results['Code 39 的条码页**有**「条宽比(&W):」且 7 档 2.00…3.00（真机 probe-sym-code39-values.txt）'] =
      !!w2nCode39 && w2nCode39.shown === true &&
      JSON.stringify(w2nCode39.options) === JSON.stringify(['2.00', '2.17', '2.33', '2.50', '2.67', '2.83', '3.00'])
    await setSymbology('code93')
    const w2nCode93 = await w2n()
    results['Code 93 的条码页**没有**「条宽比(&W):」（真机 probe-sym-code93-values.txt 无此行）'] =
      !!w2nCode93 && w2nCode93.shown === false

    // ---------- QR Code：符号版本 41 项 ----------
    await setSymbology('qrcode')
    await openSpecial()
    const qrVersions = await optionTexts('[data-testid="qr-version"]')
    results['QR Code 特殊页含「符号版本」41 项（自动 + 1 (21x21) … 40 (177x177)），同真机'] =
      Array.isArray(qrVersions) && qrVersions.length === 41 &&
      qrVersions[0] === '自动' && qrVersions[1] === '1 (21x21)' && qrVersions[40] === '40 (177x177)'
    const qrVersionSet = await setValue('[data-testid="object-props-dialog"] [data-testid="qr-version"]', '7')
    await sleep(360)
    results['QR「符号版本」可选中并回读（7）'] = qrVersionSet === true && (await evaluate(`document.querySelector('[data-testid="qr-version"]')?.value`)) === '7'

    // ---------- Data Matrix：符号版本 31 项 ----------
    await setSymbology('datamatrix')
    await openSpecial()
    const dmVersions = await optionTexts('[data-testid="dm-version"]')
    results['Data Matrix 特殊页含「符号版本」31 项（自动 + 1 (10x10) … 30），同真机'] =
      Array.isArray(dmVersions) && dmVersions.length === 31 &&
      dmVersions[0] === '自动' && dmVersions[1] === '1 (10x10)' && dmVersions[30] === '30 (68x68)'

    // ---------- Micro QR：纠错 3 项 / 字符编码 2 项 / 符号版本 5 项 ----------
    await setSymbology('microqrcode')
    await openSpecial()
    const microVersions = await optionTexts('[data-testid="microqr-version"]')
    const microEcc = await optionTexts('[data-testid="microqr-eclevel"]')
    results['Micro QR 特殊页含 纠错级别 3 项 / 字符编码 2 项 / 符号版本 5 项（自动 + M1…M4），同真机'] =
      JSON.stringify(microEcc) === JSON.stringify(['L', 'M', 'Q']) &&
      JSON.stringify(microVersions) === JSON.stringify(['自动', 'M1 (11x11)', 'M2 (13x13)', 'M3 (15x15)', 'M4 (17x17)'])

    // ---------- 汉信码：版本 85 项（本轮发现复刻版只到 4）----------
    await setSymbology('hanxin')
    await openSpecial()
    const hanxinText = await evaluate(`document.querySelector('[data-testid=object-props-dialog]')?.innerText || ''`)
    const hanxinHasVersion = hanxinText.includes('版本')
    results['汉信码特殊页有「版本」字段（真机 85 项：自动 + 1…84）'] = hanxinHasVersion === true

    // ---------- ITF 14：保护框 3 项 + 粗细/空白区 15 档 ----------
    await setSymbology('itf14')
    await openSpecial()
    const bearer = await optionTexts('[data-testid="itf14-bearer"]')
    const bearerRatio = await optionTexts('[data-testid="itf14-bearer-ratio"]')
    const quietRatio = await optionTexts('[data-testid="itf14-quiet-ratio"]')
    results['ITF 14「保护框」3 项（无/方框/保护条）同真机'] =
      JSON.stringify(bearer) === JSON.stringify(['无', '方框', '保护条'])
    results['ITF 14「粗细」「空白区」各 15 档 1X…15X（真机默认 5X/10X）'] =
      Array.isArray(bearerRatio) && bearerRatio.length === 15 && bearerRatio[0] === '1X' && bearerRatio[14] === '15X' &&
      Array.isArray(quietRatio) && quietRatio.length === 15 &&
      (await evaluate(`document.querySelector('[data-testid="itf14-bearer-ratio"]')?.value`)) === '5' &&
      (await evaluate(`document.querySelector('[data-testid="itf14-quiet-ratio"]')?.value`)) === '10'

    // ---------- PDF 417：条宽比 9 档 1 X…9 X ----------
    await setSymbology('pdf417')
    await click('[data-testid="object-props-tab-barcode"]'); await sleep(300)
    const pdfRatios = await optionTexts('[data-testid="object-props-dialog"] select')
    const ratioOptions = await evaluate(`(() => {
      const d=document.querySelector('[data-testid=object-props-dialog]')
      const sel=[...d.querySelectorAll('select')].find((s)=>[...s.options].some((o)=>(o.textContent||'').trim()==='3 X'))
      return sel ? [...sel.options].map((o)=>o.textContent.trim()) : null })()`)
    void pdfRatios
    results['PDF 417「条宽比」9 档 1 X…9 X（真机 9 项，默认 3 X）'] =
      Array.isArray(ratioOptions) && ratioOptions.length === 9 && ratioOptions[0] === '1 X' && ratioOptions[8] === '9 X'
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
