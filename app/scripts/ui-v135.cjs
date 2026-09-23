/*
 * 「条码属性 → 条码」页：**各二维码制的字段原文与选项集**按真机对齐（round-128）。
 *
 * 真机判据（全部来自 `parity/reference/labelshop/` 的真机控件 dump，逐字）：
 *
 *   probe-sym-qrcode-values.txt      `纠错级别(E):` = `M  (选中 1 / 共 4 项)`
 *                                    `字符编码:`      = `ANSI  (选中 1 / 共 2 项)`
 *                                    `图标区域：`     = `无  (选中 0 / 共 31 项)`
 *                                    `符号版本:`      = `自动  (选中 0 / 共 41 项)`
 *   probe-sym-qrcode-combos.txt      combo[3] = L / M / Q / H
 *                                    combo[4] = UTF-8 / ANSI        ← 顺序：UTF-8 在前
 *                                    combo[5] = 无 / 1 / 2 … 30
 *                                    combo[2] = 自动 / 1 (21x21) … 40 (177x177)
 *   probe-sym-microqr-values.txt     `纠错级别(E):` = `M  (选中 1 / 共 3 项)`、`符号版本:` = 5 项
 *   probe-sym-microqr-combos.txt     combo[3] = L / M / Q
 *   probe-sym-datamatrix-values.txt  `字符编码:` = `ANSI  (选中 1 / 共 2 项)`、`符号版本:` = 31 项
 *                                    （注意：该页**没有**「纠错级别」控件）
 *   probe-sym-pdf417-values.txt      `纠错级别(E):` = `自动  (选中 0 / 共 10 项)`
 *   probe-sym-pdf417-combos.txt      combo[4] = 自动 / 0 / 1 … 8
 *   probe-sym-hanxin-values.txt      `纠错级别(E):` = `1  (选中 0 / 共 4 项)`、`版本(V):` = 85 项
 *   probe-sym-hanxin-combos.txt      combo[2] = 1 / 2 / 3 / 4
 *                                    combo[3] = 自动 / 1 / 2 … 84   ← 项文本是**纯数字**
 *
 * 复刻版本轮改动前的偏差（本脚本逐条钉住）：
 *   ① `纠错级别`（无加速键）→ 真机 `纠错级别(E):`；
 *   ② 选项集自造：QR 带「（约7%）」后缀、PDF 417 只有 5 档 0/2/4/6/8、汉信码是 `L1…L4`；
 *   ③ `字符编码`（无冒号）且项序为 ANSI / UTF-8 → 真机 `字符编码:`、项序 UTF-8 / ANSI；
 *   ④ `符号版本`（无冒号）/ `版本` → 真机 `符号版本:` / `版本(V):`；汉信码项文本 `版本 1` → 真机纯数字 `1`；
 *   ⑤ `图标区域` 是**复选框**，真机是**下拉**（31 项 `无` + `1`…`30`，默认 `无`）。
 *
 * 命令：$env:MAXLABEL_UI_SCRIPT='ui-v135.cjs'; npm run test:ui
 */
const http = require('http')
const WebSocket = require('ws')

const QR_ECL = ['L', 'M', 'Q', 'H']
const MICROQR_ECL = ['L', 'M', 'Q']
const PDF417_ECL = ['自动', '0', '1', '2', '3', '4', '5', '6', '7', '8']
const HANXIN_ECL = ['1', '2', '3', '4']
const ENCODING = ['UTF-8', 'ANSI']
const QR_ICON_AREA = ['无', ...Array.from({ length: 30 }, (_, index) => String(index + 1))]
const QR_VERSION = ['自动', ...Array.from({ length: 40 }, (_, index) => `${index + 1} (${21 + index * 4}x${21 + index * 4})`)]
const MICROQR_VERSION = ['自动', 'M1 (11x11)', 'M2 (13x13)', 'M3 (15x15)', 'M4 (17x17)']
const DM_VERSION = ['自动', ...Array.from({ length: 30 }, (_, index) => `${index + 1} (${10 + index * 2}x${10 + index * 2})`)]
const HANXIN_VERSION = ['自动', ...Array.from({ length: 84 }, (_, index) => String(index + 1))]

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
    /** 某 testid 的 select 当前选中项文本 */
    const selectedText = (testid) => evaluate(`(() => {
      const e=document.querySelector('[data-testid=${JSON.stringify(testid)}]')
      return e ? (e.selectedOptions[0]?.textContent.trim() ?? '') : null })()`)
    /** 当前「条码」页里是否存在指定的标签原文（label 元素文本） */
    const hasLabel = (text) => evaluate(`(() => {
      const dialog=document.querySelector('[data-testid="object-props-dialog"]'); if(!dialog) return false
      return [...dialog.querySelectorAll('label,span,div')].some((e)=>e.children.length===0 && (e.textContent||'').trim()===${JSON.stringify(text)}) })()`)
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
    /** 切到某码制并停在「条码」页 */
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
    if (!await openBarcodeProps()) throw new Error('条码属性没打开')

    // ---------- ① QR Code ----------
    await useSymbology('qrcode')
    results['QR：标签是真机原文 纠错级别(E):（不再是无加速键的「纠错级别」）'] = await hasLabel('纠错级别(E):')
    results['QR：纠错级别 选项整数组全等 = 真机 [L, M, Q, H]'] = arrEq(await optionTexts('qr-eclevel'), QR_ECL)
    results['QR：纠错级别不再带自造的「（约7%）」等百分比后缀'] =
      !(await optionTexts('qr-eclevel') || []).some((t) => t.includes('（约'))
    results['QR：纠错级别默认选中 M（真机 sel=1 / 共 4 项）'] = (await selectedText('qr-eclevel')) === 'M'
    results['QR：标签是 字符编码:（带冒号）'] = await hasLabel('字符编码:')
    results['QR：字符编码 选项整数组全等 = 真机 [UTF-8, ANSI]（真机 UTF-8 在前）'] =
      arrEq(await optionTexts('qr-encoding'), ENCODING)
    results['QR：字符编码默认选中 ANSI（真机 sel=1 / 共 2 项）'] = (await selectedText('qr-encoding')) === 'ANSI'
    results['QR：图标区域是真机原文的下拉（标签 `图标区域：`）'] = await hasLabel('图标区域：')
    results['QR：图标区域 选项整数组全等 = 真机 无 + 1…30（31 项）'] =
      arrEq(await optionTexts('qr-icon-area'), QR_ICON_AREA)
    results['QR：图标区域默认选中 无（真机 sel=0 / 共 31 项）'] = (await selectedText('qr-icon-area')) === '无'
    results['QR：图标区域不再是复选框形态（真机是下拉，复刻版原是 checkbox）'] = await evaluate(`(() => {
      const dialog=document.querySelector('[data-testid="object-props-dialog"]'); if(!dialog) return false
      return ![...dialog.querySelectorAll('label')].some((e)=>e.textContent.includes('图标区域（中央留白'))
    })()`)
    results['QR：标签是 符号版本:（带冒号）'] = await hasLabel('符号版本:')
    results['QR：符号版本 选项整数组全等 = 真机 自动 + 1 (21x21) … 40 (177x177)（41 项）'] =
      arrEq(await optionTexts('qr-version'), QR_VERSION)

    // ---------- ② Micro QR ----------
    await useSymbology('microqrcode')
    results['Micro QR：纠错级别(E): 选项整数组全等 = 真机 [L, M, Q]'] =
      arrEq(await optionTexts('microqr-eclevel'), MICROQR_ECL)
    results['Micro QR：纠错级别默认选中 M'] = (await selectedText('microqr-eclevel')) === 'M'
    results['Micro QR：字符编码: 选项整数组全等 = 真机 [UTF-8, ANSI]'] =
      arrEq(await optionTexts('microqr-encoding'), ENCODING)
    results['Micro QR：符号版本: 选项整数组全等 = 真机 自动 + M1…M4（5 项）'] =
      arrEq(await optionTexts('microqr-version'), MICROQR_VERSION)

    // ---------- ③ Data Matrix ----------
    await useSymbology('datamatrix')
    results['Data Matrix：字符编码: 选项整数组全等 = 真机 [UTF-8, ANSI]'] =
      arrEq(await optionTexts('dm-encoding'), ENCODING)
    results['Data Matrix：符号版本: 选项整数组全等 = 真机 自动 + 1 (10x10) … 30（31 项）'] =
      arrEq(await optionTexts('dm-version'), DM_VERSION)

    // ---------- ④ PDF 417 ----------
    await useSymbology('pdf417')
    results['PDF 417：标签是真机原文 纠错级别(E):'] = await hasLabel('纠错级别(E):')
    results['PDF 417：纠错级别 选项整数组全等 = 真机 自动 + 0…8（10 项）'] =
      arrEq(await optionTexts('pdf417-eclevel'), PDF417_ECL)
    results['PDF 417：纠错级别默认选中 自动（真机 sel=0 / 共 10 项）'] = (await selectedText('pdf417-eclevel')) === '自动'
    results['PDF 417：纠错级别不再是自造的 5 档 0/2/4/6/8'] =
      !(await optionTexts('pdf417-eclevel') || []).some((t) => t.includes('（最低）') || t.includes('（默认）'))

    // ---------- ⑤ 汉信码 ----------
    await useSymbology('hanxin')
    results['汉信码：标签是真机原文 纠错级别(E):'] = await hasLabel('纠错级别(E):')
    results['汉信码：纠错级别 选项整数组全等 = 真机 [1, 2, 3, 4]'] =
      arrEq(await optionTexts('hanxin-eclevel'), HANXIN_ECL)
    results['汉信码：纠错级别默认选中 1（真机 sel=0 / 共 4 项）'] = (await selectedText('hanxin-eclevel')) === '1'
    results['汉信码：纠错级别不再是自造的 L1…L4'] =
      !(await optionTexts('hanxin-eclevel') || []).some((t) => /^L[1-4]/.test(t))
    results['汉信码：字符编码: 选项整数组全等 = 真机 [UTF-8, ANSI]'] =
      arrEq(await optionTexts('hanxin-encoding'), ENCODING)
    results['汉信码：标签是真机原文 版本(V):'] = await hasLabel('版本(V):')
    results['汉信码：版本 选项整数组全等 = 真机 自动 + 1…84（85 项，项文本纯数字）'] =
      arrEq(await optionTexts('hanxin-version'), HANXIN_VERSION)

    let pass = 0
    for (const [name, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value); if (value) pass++ }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    client.ws.close()
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    for (const [name, value] of Object.entries(results)) console.log((value ? 'PASS ' : 'FAIL ') + name)
    client?.ws.close()
    process.exit(1)
  }
})()
