/*
 * DIFF-83：复刻版把 MFC 加速键标记 `&` 渲染成了**字面量**。
 *
 * 真机判据（两张实拍 + 一张并排图）：
 *   - `parity/reference/labelshop/verifier-20c-barcode-page.png`（真机「条码属性 → 条码」页实拍）
 *     可见文案**不带 `&`**：`条码符号类型(码制)(B):` / `X 尺寸(X):` / `码 高(H):` / `字符集(C):` …
 *   - `parity/reference/labelshop/probe-60-barcode-props-tree.txt`（控件树 dump）
 *     原文**带 `&`**：`条码符号类型(码制)(&B):` —— `&` 是 MFC 的加速键标记，`DrawItem` 时不绘制。
 *   - `parity/review/cmp-propsbarcode-1741523.png`（左真机 × 右复刻版）—— 并排看差异一眼可见。
 *
 * 复刻版原先"照抄 dump 原文"，于是用户看到的是字面量 `(&B)`，与真机可见行为不符。
 * 修法：渲染统一走 `src/shared/mfcCaption.ts` 的 `displayMfcCaption()`（`&&` → 一个 `&`，
 * 单个 `&` 不显示）。本脚本是这条行为的 CDP 回归。
 *
 * 命令：$env:MAXLABEL_UI_SCRIPT='ui-v139.cjs'; npm run test:ui
 */
const http = require('http')
const WebSocket = require('ws')

/** 真机**屏幕显示**口径（verifier-20c-barcode-page.png 实拍逐字；空白归一后比较） */
const REAL_SHOWN_BARCODE_LABELS = [
  '条码符号类型(码制)(B):',
  'X 尺寸(X):',
  '码  高(H):',
  '字符集(C):',
  '位置(P):',
  '垂直偏移(O):',
  '对齐方式(A):',
  'GS1/EAN 128(U)'
]
/** 字面量加速键形态（真机屏幕上永远看不到） */
const LITERAL_ACCELERATOR = /\(&[A-Za-z0-9]\)/
const norm = (s) => String(s || '').replace(/ /g, ' ')

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

    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'n',code:'KeyN',ctrlKey:true,bubbles:true,cancelable:true}))`); await sleep(420)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(380)
    }
    await click('[data-testid="new-label-select"]')
    await waitFor('!!document.querySelector("canvas.upper-canvas")', 9000)
    await sleep(400)

    // 建一个条码对象并打开属性对话框
    await click('[data-tool="barcode"]'); await sleep(170)
    await evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas'); const b=c.getBoundingClientRect()
      const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons})
      c.dispatchEvent(new MouseEvent('mousedown',p(60,60))); c.dispatchEvent(new MouseEvent('mousemove',p(280,190)))
      c.dispatchEvent(new MouseEvent('mouseup',{...p(280,190,0),buttons:0})); return true })()`)
    await sleep(440)
    await click('[data-tool="select"]'); await sleep(180)
    await evaluate(`(() => { const r=[...document.querySelectorAll('[data-testid=layer-object-row]')].find((e)=>e.dataset.objectType==='barcode'); if(r && r.dataset.selected!=='true') r.click(); return !!r })()`)
    await sleep(260)
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',altKey:true,bubbles:true,cancelable:true}))`)
    if (!await waitFor('!!document.querySelector("[data-testid=object-props-dialog]")', 5000)) {
      throw new Error('条码属性没打开')
    }

    const DIALOG = '[data-testid="object-props-dialog"]'

    // ---------- ① 「条码」页：真机屏幕口径逐字命中，且整页无字面量 & ----------
    await click(`${DIALOG} [data-testid="object-props-tab-barcode"]`); await sleep(340)
    const barcodeText = norm(await evaluate(`(document.querySelector('${DIALOG}')||{}).textContent || ''`))
    const shownHits = REAL_SHOWN_BARCODE_LABELS.filter((label) => barcodeText.includes(label))
    results[`A-201/DIFF-83 「条码」页可见文案 = 真机实拍口径（不带 &）逐字命中 ${REAL_SHOWN_BARCODE_LABELS.length} 项`] =
      shownHits.length === REAL_SHOWN_BARCODE_LABELS.length
    results['DIFF-83 「条码」页整页不再出现字面量加速键 (&X)'] = !LITERAL_ACCELERATOR.test(barcodeText)

    // ---------- ② 对象属性对话框四个页签逐页都不含字面量加速键 ----------
    const tabIds = await evaluate(`[...document.querySelectorAll('${DIALOG} [data-testid^="object-props-tab-"]')].map((e)=>e.getAttribute('data-testid'))`)
    const perTabOffenders = []
    for (const tabId of tabIds || []) {
      await click(`[data-testid="${tabId}"]`); await sleep(280)
      const text = norm(await evaluate(`(document.querySelector('${DIALOG}')||{}).textContent || ''`))
      const found = text.match(new RegExp(LITERAL_ACCELERATOR, 'g'))
      if (found) perTabOffenders.push(`${tabId}:${found.slice(0, 4).join(' ')}`)
    }
    results[`DIFF-83 对象属性 ${(tabIds || []).length} 个页签逐页扫描：无字面量加速键`] = perTabOffenders.length === 0
    if (perTabOffenders.length) results['DIFF-83 违规页签明细'] = perTabOffenders.join(' | ')

    // ---------- ③ 数据源页仍在（字段名同样不该带 &） ----------
    await click(`${DIALOG} [data-testid="object-props-tab-datasource"]`); await sleep(300)
    const dataSourceText = norm(await evaluate(`(document.querySelector('${DIALOG}')||{}).textContent || ''`))
    results['DIFF-83 「数据源」页同样无字面量加速键（该页 4 个字段也照抄了 dump 原文）'] =
      !LITERAL_ACCELERATOR.test(dataSourceText)
    await click(`${DIALOG} button`) // 关掉对话框（× 按钮）
    await sleep(260)

    // ---------- ④ 「系统设置」对话框（另一族照抄 dump 原文的字段） ----------
    await evaluate(`document.querySelector('[data-menu-title="选项(O)"]')?.click()`); await sleep(220)
    await evaluate(`(() => { const e=[...document.querySelectorAll('[data-menu-item]')].find((c)=>c.offsetParent && (c.textContent||'').includes('系统选项(C)')); if(!e) return false; e.click(); return true })()`)
    await sleep(360)
    const optionsOpened = await evaluate('!!document.querySelector("[data-testid=options-dialog]")')
    if (optionsOpened) {
      const optionsText = norm(await evaluate(`(document.querySelector('[data-testid=options-dialog]')||{}).textContent || ''`))
      const found = optionsText.match(new RegExp(LITERAL_ACCELERATOR, 'g'))
      results['DIFF-83 「系统设置」对话框无字面量加速键（真机字段原文同样带 &）'] = !found
      if (found) results['DIFF-83 「系统设置」违规项'] = found.slice(0, 6).join(' ')
      results['DIFF-83 「系统设置」仍含真机字段 `标尺单位(U):`（去掉 & 后逐字）'] = optionsText.includes('标尺单位(U):')
      await evaluate(`(() => { const b=[...document.querySelectorAll('[data-testid=options-dialog] button')].find((x)=>(x.textContent||'').trim()==='取消'); b?.click(); return !!b })()`)
      await sleep(300)
    } else {
      results['DIFF-83 「系统设置」对话框无字面量加速键（真机字段原文同样带 &）'] = false
    }

    // ---------- ⑤ 兜底不变量：整个窗口的可见文本里没有任何字面量加速键 ----------
    const bodyOffenders = await evaluate(`(() => {
      const found = (document.body.innerText || '').match(/\\(&[A-Za-z0-9]\\)/g)
      return found ? found.slice(0, 8) : null
    })()`)
    results['DIFF-83 兜底：整个应用窗口可见文本中无 (&X) 字面量'] = !bodyOffenders
    if (bodyOffenders) results['DIFF-83 窗口内违规明细'] = bodyOffenders.join(' ')

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
