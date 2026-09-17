/*
 * 启动态标签页条与真机一致：**只有「起始页」一个页签，不存在空白文档页签**。
 *
 * 出处：帮助 `getstart_main.html`（启动后先到起始页）；真机启动截图
 *       `parity/reference/labelshop/92-00-startup.png`——标签页条上只有 `起始页`，
 *       没有 `新标签模板1` 之类的空白文档。
 *
 * 修复前实测：`useDocumentWorkspace` 的初值写死 `[initialTab()]`，于是启动后页签条上是
 * `起始页 | 新标签模板1 ×` 两个页签（对照 `parity/reference/maxlabel/A9-start-recent.png`），
 * 并且在起始页按 Ctrl+N 新建后编号从 `新标签模板2` 起（因为 tabs.length 已经是 1）。
 * 这会连带影响「新建标签模板」的默认命名与「关闭所有」后的残留页签，属用户可见差异。
 *
 * 断言：
 *   1) 启动后页签条上恰好 1 个页签，就是起始页；
 *   2) 启动后处于起始页（无画布、无文档页签）；
 *   3) Ctrl+N → 模板向导 → 选择标签格式后，恰好 1 个文档页签且标题为「新标签模板1」；
 *   4) 再新建一次 → 标题为「新标签模板2」，文档页签共 2 个（编号连续、不跳号）；
 *   5) 关闭所有标签 → 回到只剩「起始页」一个页签。
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
    const evaluate = async (expression) => {
      const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
      return result.result?.value
    }
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e || e.disabled)return false; e.click(); return true })()`)
    const pressKey = (k, o = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: k, code: k, bubbles: true, cancelable: true, ...o })}); window.dispatchEvent(e); return true })()`)
    const waitFor = async (expression, timeout = 6000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    /** 页签条上的全部页签（含起始页），标题取自 data-document-title。 */
    const tabTitles = () => evaluate(`[...document.querySelectorAll('[data-testid=document-tab]')].map((e)=>e.getAttribute('data-document-title'))`)
    /** 新建一个标签模板：Ctrl+N → 模板向导「下一步」→ 选择标签格式（与帮助 getstart_firstprint 的第一步一致）。 */
    const newTemplate = async () => {
      await pressKey('n', { ctrlKey: true }); await sleep(340)
      if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
        await click('[data-testid="wizard-next"]'); await sleep(320)
      }
      await click('[data-testid="new-label-select"]')
      if (!await waitFor('!!document.querySelector("canvas.upper-canvas")', 8000)) throw new Error('editor did not open')
      await sleep(320)
    }

    // ---------- 1) 启动态：只有起始页 ----------
    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await sleep(400)
    const bootTabs = await tabTitles()
    results['启动后页签条上恰好 1 个页签（只有起始页，无空白文档页签）'] =
      Array.isArray(bootTabs) && bootTabs.length === 1
    results['启动后那个页签就是「起始页」'] = Array.isArray(bootTabs) && bootTabs[0] === '起始页'
    results['启动后不存在「新标签模板」空白文档页签（修复 start=[] 前的 新标签模板1 残留）'] =
      Array.isArray(bootTabs) && !bootTabs.some((t) => typeof t === 'string' && t.startsWith('新标签模板'))

    // ---------- 2) 启动后停在起始页 ----------
    const onStart = await evaluate('!!document.querySelector("[data-testid=start-page]")')
    const hasCanvas = await evaluate('!!document.querySelector("canvas.upper-canvas")')
    results['启动后停在起始页（start-page 存在且没有编辑画布）'] = onStart === true && hasCanvas === false

    // ---------- 3) 第一次新建 → 新标签模板1 ----------
    await newTemplate()
    const afterFirst = await tabTitles()
    results['新建一次后恰好 1 个文档页签（起始页 + 新标签模板1）'] =
      Array.isArray(afterFirst) && afterFirst.length === 2
    results['第一个文档页签命名为「新标签模板1」（编号不含启动残留）'] =
      Array.isArray(afterFirst) && afterFirst[1] === '新标签模板1'

    // ---------- 4) 第二次新建 → 新标签模板2（编号连续） ----------
    const firstTitle = await evaluate(`document.querySelector('[data-testid=document-tab][data-active=true]')?.getAttribute('data-document-title')`)
    await newTemplate()
    const afterSecond = await tabTitles()
    results['再新建一次后编号连续为「新标签模板2」（起始页 + 两个文档页签）'] =
      Array.isArray(afterSecond) && afterSecond.length === 3 && afterSecond[2] === '新标签模板2' && firstTitle === '新标签模板1'

    // ---------- 5) 关闭所有标签 → 只剩起始页 ----------
    await evaluate(`(() => {
      const tab=[...document.querySelectorAll('[data-testid=document-tab]')].find((e)=>e.getAttribute('data-document-title')==='新标签模板2')
      if(!tab) return false
      const b=tab.getBoundingClientRect()
      tab.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,view:window,clientX:b.left+10,clientY:b.top+10}))
      return true
    })()`)
    await sleep(240)
    await click('[data-menu-item="关闭所有(A)"]')
    await sleep(600)
    const afterCloseAll = await tabTitles()
    results['关闭所有标签后回到只剩「起始页」一个页签（不残留空白文档）'] =
      Array.isArray(afterCloseAll) && afterCloseAll.length === 1 && afterCloseAll[0] === '起始页'

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
