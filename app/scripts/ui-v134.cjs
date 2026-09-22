/*
 * 「条码属性 → 条码」页的结构与字段原文（round-126，B-71 未收口项收口）。
 *
 * 真机判据 = `parity/reference/labelshop/probe-60-barcode-props-tree.txt`（Code 128 条码的递归控件树，
 * 每行带 `[V]/[ ]` 可见性与对话框内坐标）。该页逐项原文与坐标：
 *
 *   顶部（组外）：`条码符号类型(码制)(&B):`(928,479) + ComboBox
 *   分组框 `尺寸`(928,521)：
 *       `X 尺寸(&X):`(961,557) + Combo；`条宽比(&W):`(1316,557)【Code 128 不可见】；
 *       `码  高(&H):`(961,611) + Edit + Spin + `毫米`(1201,611)；
 *       `码  宽(&D):`/`缩减量(&M):`/`字符编码:` 均不可见（Code 128）
 *   分组框 `条码特殊选项`(928,665)：
 *       `GS1/EAN 128(&U)`(961,704) 复选框 + `字符集(&C):`(1297,707) + Combo
 *   分组框 `供人识读字符`(928,821)：
 *       `位置(&P):`(961,857) + Combo；`垂直偏移(&O):`(1300,857)+Edit+`毫米`；
 *       `对齐方式(&A):`(961,911) + Combo；`字符模板(&T)`(961,959) 复选 + 只读 Edit(1137,956)
 *   页尾：`颜色:`(928,1040) + `颜色(&L)...`(1005,1022)
 *
 * 复刻版本轮改动：
 *   ① 三个分组框（原先平铺，只有一个自造的「条码特殊选项」fieldset）；
 *   ② 字段原文与加速键：`位置(&P):` / `垂直偏移(&O):` / `对齐方式(&A):` / `字符集(&C):` /
 *      `缩减量(&M):` / `GS1/EAN 128(&U)`；
 *   ③ `字符模板(&T)` 补到「供人识读字符」组（真机位置），值绑的是正式模型字段 `charTemplate`；
 *      同一字段原先在「数据源」页也渲染了一份 → 按「同一状态只留一个入口」移除数据源页那份；
 *   ④ 自造的「对齐」字段（真机条码页无此控件）移入标注过的「复刻版扩展」区（功能在用，不静默删）。
 *
 * 命令：$env:MAXLABEL_UI_SCRIPT='ui-v134.cjs'; npm run test:ui
 */
const http = require('http')
const WebSocket = require('ws')

/** 真机 `probe-60-barcode-props-tree.txt` 的三个 group box 文案（顺序即真机 y 序） */
const EXPECTED_GROUPS = ['尺寸', '条码特殊选项', '供人识读字符']
/** 真机「供人识读字符」组内的字段原文（含加速键，逐字） */
const EXPECTED_HUMAN_FIELDS = ['位置(&P):', '垂直偏移(&O):', '对齐方式(&A):', '字符模板(&T)']

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
    await click('[data-testid="object-props-tab-barcode"]'); await sleep(320)

    // ---------- ① 三个真机分组框 ----------
    const legends = await evaluate(`[...document.querySelectorAll('[data-testid="object-props-dialog"] fieldset > legend')]
      .map((e)=>(e.textContent||'').trim())`)
    results['「条码」页分组框整数组全等 = 真机 [尺寸, 条码特殊选项, 供人识读字符]'] =
      JSON.stringify(legends) === JSON.stringify(EXPECTED_GROUPS)
    results['分组框按真机坐标次序出现（尺寸 在 条码特殊选项 之前、供人识读字符 在最后）'] =
      await evaluate(`(() => {
        const size=document.querySelector('[data-testid="barcode-group-size"]')
        const human=document.querySelector('[data-testid="barcode-group-human"]')
        const special=document.querySelector('[data-testid="barcodeSpecial"]')
        if(!size||!human||!special) return false
        const pos=(a,b)=>(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
        return pos(size,special) && pos(special,human)
      })()`)

    // ---------- ② 「供人识读字符」组：字段原文整数组全等 ----------
    const humanText = await evaluate(`document.querySelector('[data-testid="barcode-group-human"]')?.innerText || ''`)
    results['「供人识读字符」组字段原文整数组全等（含加速键）'] =
      EXPECTED_HUMAN_FIELDS.every((label) => humanText.includes(label))
    results['「字符模板(&T)」是真输入框且绑定 charTemplate（真机该控件为复选+只读框）'] =
      await evaluate(`!!document.querySelector('[data-testid="barcode-char-template"]')`)
    results['「位置」不再是自造的「供人识读字符 · 位置」写法'] =
      !humanText.includes('供人识读字符 · 位置')

    // ---------- ③ 「供人识读字符」组内只出现一个位置/对齐/偏移控件 ----------
    results['位置(&P): 下拉在整页恰好 1 个（不再与数据源页重复绑定同一状态）'] =
      await evaluate(`document.querySelectorAll('[data-testid="barcode-human-position"]').length === 1`)
    results['对齐方式(&A): 下拉在整页恰好 1 个'] =
      await evaluate(`document.querySelectorAll('[data-testid="barcode-human-align"]').length === 1`)
    results['垂直偏移(&O): 输入框在整页恰好 1 个'] =
      await evaluate(`document.querySelectorAll('[data-testid="barcode-human-offset"]').length === 1`)
    results['字符模板输入框在整页恰好 1 个'] =
      await evaluate(`document.querySelectorAll('[data-testid="barcode-char-template"]').length === 1`)

    // ---------- ④ 「数据源」页不再重复渲染供人识读字段（真机数据源页无此控件） ----------
    await click('[data-testid="object-props-tab-datasource"]'); await sleep(300)
    const dsText = await evaluate(`document.querySelector('[data-testid="object-props-dialog"]')?.innerText || ''`)
    results['数据源页没有「供人识读的字符：位置/垂直偏移/对齐方式」重复项（真机数据源页无这些控件）'] =
      !dsText.includes('供人识读的字符：位置') && !dsText.includes('供人识读的字符：垂直偏移') && !dsText.includes('供人识读的字符：对齐方式')
    results['数据源页仍保留码制特性说明（未误删数据源页内容）'] =
      await evaluate(`!!document.querySelector('[data-testid="barcode-charset"]')`)

    // ---------- ⑤ 「尺寸」组字段原文 + 缩减量按真机原文 ----------
    await click('[data-testid="object-props-tab-barcode"]'); await sleep(300)
    const sizeText = await evaluate(`document.querySelector('[data-testid="barcode-group-size"]')?.innerText || ''`)
    results['「尺寸」组含真机原文 X 尺寸(&X): 与 码  高(&H):（「码」「高」间两个空格）'] =
      sizeText.includes('X 尺寸(&X):') && sizeText.includes('码  高(&H):')
    results['Code 128 的「尺寸」组**没有**「缩减量」（真机 EAN/UPC 专属，Code 128 不可见）'] =
      !sizeText.includes('缩减量')

    // ---------- ⑥ 「条码特殊选项」组：<legend> 文案 + GS1 复选框按真机原文 ----------
    const specialText = await evaluate(`document.querySelector('[data-testid="barcodeSpecial"]')?.innerText || ''`)
    results['「条码特殊选项」组 legend 已是真机原文'] =
      await evaluate(`document.querySelector('[data-testid="barcodeSpecial"] > legend')?.textContent.trim() === '条码特殊选项'`)
    results['Code 128 的 GS1 复选框按真机原文 GS1/EAN 128(&U)'] = specialText.includes('GS1/EAN 128(&U)')
    results['Code 128 的字符集下拉按真机原文 字符集(&C):'] = specialText.includes('字符集(&C):')

    // ---------- ⑦ 自造「对齐」字段：真机条码页无，按复刻版扩展区保留 ----------
    results['自造「对齐」字段已移入「复刻版扩展」区并加图例（真机条码页无此控件）'] = await evaluate(`(() => {
      const box=document.querySelector('[data-testid="barcode-extensions"]')
      if(!box) return false
      return box.textContent.includes('复刻版扩展（原版「条码」页中无此项）')
        && !!box.querySelector('[data-testid="barcode-align"]')
    })()`)
    results['「对齐」字段不在三个真机分组框内（不污染真机组结构）'] =
      await evaluate(`(() => {
        const a=document.querySelector('[data-testid="barcode-align"]')
        return !!a && !a.closest('fieldset')
      })()`)
    results['页尾仍保留真机实拍的「颜色:」色块（DIFF-72 方向）'] =
      await evaluate(`!!document.querySelector('[data-testid="barcode-color"]')`)

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
