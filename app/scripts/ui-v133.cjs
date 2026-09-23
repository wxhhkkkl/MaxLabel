/*
 * 「打印机属性」对话框底排按钮与扩展区标注（round-121 收口小改清单第 4/5 项）：
 *   真机 `Gprinter GPL-N (203 dpi) 属性`（Windows 属性表）底排实拍 = `确定 / 取消 / 帮助`
 *     — parity/reference/labelshop/probe-15-cloudbox-port.png
 *   LabelShop 自有属性表同形（`标签格式设置` 递归控件树逐行）：
 *     `确定`(1364) / `取消`(1513) / 隐藏的 `应用(A)`(1661) / `帮助`(1662)
 *     — parity/reference/labelshop/r121-lfs-printer-page.txt
 *   `系统设置` 亦同（DIFF-71 / round-116）。
 *
 * 复刻版原先底排是 `恢复默认 / 取消 / 保存（随模板一起保存）`：
 *   - `保存` 改真机原文 `确定`；
 *   - 补 `帮助`（打开「帮助主题」，与 OptionsDialog 同手法）；
 *   - `恢复默认` 是真机没有的按钮（不静默删功能）→ 移入「首选项」页的**复刻版扩展**区并加图例。
 *
 * 同轮另一个取证结论（小改清单第 4 项）：真机该对话框与 LabelShop「标签格式设置」四页
 * （r121-lfs-default-page.txt / r121-lfs-after-ctrltab.txt / r121-lfs-printer-page.txt 全页 grep）
 * 都没有 `指令编码` → 复刻版端口页那一项按「复刻版扩展」加 hint 标注。
 *
 * 另：DIFF-68（`整页反相打印` / `单页任务模式` 的控件形态）本轮实拍确证为**复选框**
 *   — r121-prn-switches-before.png（☐）/ r121-prn-switches-after.png（☑ 点击后保持，未弹窗）。
 */
const http = require('http')
const WebSocket = require('ws')

const EXPECTED_FOOTER = ['确定', '取消', '帮助']

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
    const openPrinterSettings = async () => {
      await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"p",code:"KeyP",ctrlKey:true,bubbles:true,cancelable:true}))')
      await sleep(400)
      await click('[data-testid="print-dialog-printer-properties"]')
      await sleep(340)
    }

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate('localStorage.removeItem("maxlabel.defaultPrinter")')
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(400)
    await click('[data-testid="wizard-next"]')
    await sleep(450)
    await evaluate(`(() => { const items=[...document.querySelectorAll('button')].filter((e)=>e.offsetParent&&(e.textContent||'').trim()==='选择'); items.at(-1)?.click(); return !!items.length })()`)
    await waitFor('!!document.querySelector("canvas.upper-canvas")', 9000)
    await sleep(400)
    await openPrinterSettings()

    results['打印机属性对话框已打开'] = await evaluate('!!document.querySelector("[data-testid=printer-settings-dialog]")')

    // ---- 底排按钮：真机原文整数组全等 ----
    const footerLabels = await evaluate(`[...document.querySelectorAll('[data-testid="printer-settings-dialog"] > div:last-child button')]
      .filter((b)=>b.offsetParent !== null).map((b)=>(b.textContent||'').trim())`)
    results['底排按钮整数组全等 = 真机原文 [确定,取消,帮助]'] = JSON.stringify(footerLabels) === JSON.stringify(EXPECTED_FOOTER)
    results['底排「保存（随模板一起保存）」已改为真机原文「确定」'] =
      await evaluate(`document.querySelector('[data-testid="printer-settings-save"]')?.textContent.trim()==='确定'`)
    results['底排「恢复默认」已不在底排（真机底排无此按钮）'] =
      await evaluate(`[...document.querySelectorAll('[data-testid="printer-settings-dialog"] > div:last-child button')].every((b)=>(b.textContent||'').trim()!=='恢复默认')`)
    results['底排无可见「应用」按钮（真机为隐藏控件 应用(A)）'] =
      await evaluate(`[...document.querySelectorAll('[data-testid="printer-settings-dialog"] button')].every((b)=>!(b.textContent||'').trim().startsWith('应用') && b.offsetParent !== null)`)

    // ---- 帮助按钮真的打开「帮助主题」----
    await click('[data-testid="printer-settings-help"]')
    await sleep(420)
    results['点底排「帮助」打开 help-dialog'] = await evaluate('!!document.querySelector("[data-testid=help-dialog]")')
    await evaluate('document.querySelector("[data-testid=help-dialog] button[aria-label=关闭]")?.click()')
    await sleep(300)
    if (!await evaluate('!!document.querySelector("[data-testid=printer-settings-dialog]")')) {
      await openPrinterSettings()
    }

    // ---- 复刻版扩展区（恢复默认的新位置）----
    results['「首选项」页有「复刻版扩展」区且含「恢复默认」按钮'] = await evaluate(`(() => {
      const box=document.querySelector('[data-testid="printer-extensions"]')
      if(!box) return false
      return box.textContent.includes('复刻版扩展（原版打印机属性中无此项）')
        && !!box.querySelector('[data-testid="printer-settings-reset"]')
    })()`)

    // ---- 端口页「指令编码」按复刻版扩展标注 ----
    await click('[data-testid="printer-settings-port-tab"]')
    await sleep(260)
    results['端口页「指令编码」带「复刻版扩展」hint（真机该对话框无此项）'] = await evaluate(`(() => {
      const sel=document.querySelector('[data-testid="printer-port-encoding"]')
      if(!sel) return false
      const field=sel.parentElement
      return (field?.textContent||'').includes('复刻版扩展（原版该对话框无此项）')
    })()`)

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
