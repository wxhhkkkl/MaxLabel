/*
 * 打印机安装/移除 + 卷筒标签展示，逐项对齐真机取证（round-105）：
 *   parity/reference/labelshop/probe-07-install-printer.png  安装对话框界面
 *   parity/reference/labelshop/probe-08-install-list.txt     可安装打印机 125 行
 *   parity/reference/labelshop/probe-10-install-filter.txt   品牌过滤下拉 39 项
 *   parity/reference/labelshop/probe-09-roll-after-select.txt 选中卷筒打印机后的三个下拉
 *
 * 用户实测反馈（2026-09-18）：① 安装逻辑与真机完全不一样 ② 装完删不掉打印机
 * ③ 选中打印机后卷筒标签的展示与真机不一样。本脚本锁住三件事的真机行为。
 *
 * 真机实测（probe-09）：
 *   选中 Microsoft Print to PDF（平张）→ 标签品牌 2 项「京成云马标签 (平张标签)」「普林泰科标签 (平张标签)」
 *                                       标签类型 1 项「云马优质打印纸标签」、标签名称 42 项 [6080xx] …页/盒
 *   选中 Gprinter GPL-N (203 dpi)（卷筒）→ 标签品牌 1 项「京成云马标签 (卷筒标签)」
 *                                       标签类型 7 项、标签名称 31 项 [6020xx] …签/卷
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

const ROLL_TYPES = ['高级铜版纸标签', '优质铜版纸标签', '高级热敏纸标签', '合成纸标签', '白PET标签', '哑银PET标签', '优质热敏标签']

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
    const setSelect = (selector, value) => evaluate(`(() => {
      const el=document.querySelector(${JSON.stringify(selector)}); if(!el) return false
      const setter=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set
      setter.call(el, ${JSON.stringify(value)})
      el.dispatchEvent(new Event('change',{bubbles:true}))
      return true })()`)
    const pressKey = (k, o = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: k, code: k, bubbles: true, cancelable: true, ...o })}); window.dispatchEvent(e); return true })()`)
    const waitFor = async (expression, timeout = 8000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const optionTexts = (selector) => evaluate(`[...(document.querySelector(${JSON.stringify(selector)})?.options||[])].map((o)=>o.textContent.trim())`)
    const optionValues = (selector) => evaluate(`[...(document.querySelector(${JSON.stringify(selector)})?.options||[])].map((o)=>o.value)`)
    const openFormatPage = async () => {
      await pressKey('n', { ctrlKey: true }); await sleep(360)
      if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
        await click('[data-testid="wizard-next"]'); await sleep(340)
      }
      await waitFor('!!document.querySelector("[data-testid=new-label-dialog]")')
      await sleep(200)
    }

    // 干净起点：清掉已安装打印机与打印机偏好
    await sleep(1500)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate('localStorage.removeItem("maxlabel.installedPrinters"); localStorage.removeItem("maxlabel.defaultPrinter")')
    await client.send('Page.reload', { ignoreCache: true })
    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await sleep(300)
    await openFormatPage()

    // ---------- 1) 安装对话框结构（真机 probe-07） ----------
    await click('[data-testid="new-label-install"]')
    await waitFor('!!document.querySelector("[data-testid=printer-install-dialog]")')
    await sleep(200)
    results['安装对话框标题为「安装 LabelShop 打印机」'] = await evaluate(`(document.querySelector('[data-testid=printer-install-dialog]')?.innerText||'').includes('安装 LabelShop 打印机')`)
    const brands = await optionTexts('[data-testid="printer-install-filter"]')
    results['品牌过滤下拉 = 全部 + 38 个品牌（真机 39 项）'] = Array.isArray(brands) && brands.length === 39 && brands[0] === '全部'
    results['品牌过滤含「佳博 (Gprinter)」「斑马 (Zebra)」「TSC / Zenpert」'] = ['佳博 (Gprinter)', '斑马 (Zebra)', 'TSC / Zenpert'].every((b) => brands.includes(b))
    const rowNames = await evaluate(`[...document.querySelectorAll('[data-testid=printer-install-row]')].map((r)=>r.getAttribute('data-printer-name'))`)
    results['可安装打印机列表 125 行（真机 125 行）'] = Array.isArray(rowNames) && rowNames.length === 125
    results['列表首行 Gprinter GPL-N (203 dpi)、末行 Argox PPLB-N (600 dpi)'] =
      rowNames[0] === 'Gprinter GPL-N (203 dpi)' && rowNames[125 - 1] === 'Argox PPLB-N (600 dpi)'
    results['未选中行时「安装」按钮为禁用（真机同）'] = await evaluate(`document.querySelector('[data-testid=printer-install-submit]')?.disabled === true`)
    results['说明文字与真机一致（LabelShop 打印机 / 官方驱动）'] = await evaluate(`(() => { const t=document.querySelector('[data-testid=printer-install-guidance]')?.innerText||''; return t.includes('安装 LabelShop 打印机，可以在LabelShop中实现一般的标签打印功能') && t.includes('请安装官方提供的驱动程序') })()`)

    // ---------- 2) 安装 Gprinter GPL-N (203 dpi) ----------
    const gprinterId = await evaluate(`[...document.querySelectorAll('[data-testid=printer-install-row]')].find((r)=>r.getAttribute('data-printer-name')==='Gprinter GPL-N (203 dpi)')?.getAttribute('data-printer-id')`)
    await click(`[data-printer-id="${gprinterId}"]`)
    await sleep(160)
    results['选中行后「安装」按钮可用'] = await evaluate(`document.querySelector('[data-testid=printer-install-submit]')?.disabled === false`)
    await click('[data-testid="printer-install-submit"]')
    await sleep(320)
    results['安装后该行「状态」列显示「已安装」'] = await evaluate(`document.querySelector('[data-printer-id="${gprinterId}"] [data-testid=printer-install-row-status]')?.textContent.trim() === '已安装'`)
    results['安装后同一行「移除」可用、「安装」再次禁用'] =
      await evaluate(`document.querySelector('[data-testid=printer-install-remove]')?.disabled === false && document.querySelector('[data-testid=printer-install-submit]')?.disabled === true`)

    // ---------- 3) 返回选择标签格式：下拉与卷筒目录 ----------
    await click('[data-testid="printer-install-back"]')
    await sleep(360)
    results['「返回」回到选择标签格式页'] = await evaluate('!!document.querySelector("[data-testid=new-label-dialog]")')
    // 系统打印机是异步取回来的（IPC），等它进入下拉再断言
    await waitFor(`[...document.querySelector('[data-testid="new-label-printer"]').options].some((o)=>!String(o.value).startsWith('ls:'))`, 8000)
    const printerValues = await optionValues('[data-testid="new-label-printer"]')
    const printerTexts = await optionTexts('[data-testid="new-label-printer"]')
    results['打印机下拉第一项是刚安装的 LabelShop 打印机（真机排在最前）'] =
      String(printerValues[0]).startsWith('ls:') && printerTexts[0] === 'Gprinter GPL-N (203 dpi)'
    results['打印机下拉同时保留系统打印机（真机同：LabelShop 打印机在前、系统打印机在后）'] =
      printerValues.some((v) => !String(v).startsWith('ls:'))

    await setSelect('[data-testid="new-label-printer"]', printerValues[0])
    await sleep(300)
    const rollBrands = await optionTexts('[data-testid="new-label-brand"]')
    results['卷筒打印机 → 标签品牌 1 项「京成云马标签 (卷筒标签)」（半角括号，真机同）'] =
      rollBrands.length === 1 && rollBrands[0] === '京成云马标签 (卷筒标签)'
    const rollTypes = await optionTexts('[data-testid="new-label-type"]')
    results['卷筒打印机 → 标签类型 7 项且与真机逐项一致'] = JSON.stringify(rollTypes) === JSON.stringify(ROLL_TYPES)
    const rollFormats = await optionTexts('[data-testid="new-label-format"]')
    const rollReal = rollFormats.filter((t) => t !== '自定义')
    results['卷筒打印机 → 标签名称 31 项（真机 31 项）'] = rollReal.length === 31
    results['卷筒打印机 → 标签名称形如 [6020xx] …签/卷（真机同）'] = rollReal.every((t) => /^\[6020\d\d\] .*签\/卷$/.test(t))

    // 真机上接的佳博 GP-1324D 若以 Windows 驱动形式出现，同样按卷筒式标签打印机处理
    const gprinterValue = printerValues.find((v) => /gprinter|佳博/i.test(String(v)))
    if (gprinterValue) {
      await setSelect('[data-testid="new-label-printer"]', gprinterValue)
      await sleep(300)
      const gBrands = await optionTexts('[data-testid="new-label-brand"]')
      const gTypes = await optionTexts('[data-testid="new-label-type"]')
      results['Windows 驱动形式的佳博 GP-1324D 也走卷筒目录（1 品牌 / 7 类型）'] =
        gBrands.length === 1 && gBrands[0] === '京成云马标签 (卷筒标签)' && gTypes.length === 7
    }

    // ---------- 4) 切回平张打印机 ----------
    const sheetValue = printerValues.find((v) => !String(v).startsWith('ls:') && !/gprinter|佳博/i.test(String(v)))
    await setSelect('[data-testid="new-label-printer"]', sheetValue)
    await sleep(300)
    const sheetBrands = await optionTexts('[data-testid="new-label-brand"]')
    const sheetTypes = await optionTexts('[data-testid="new-label-type"]')
    const sheetFormats = await optionTexts('[data-testid="new-label-format"]')
    results['平张打印机 → 标签品牌 2 项且带「 (平张标签)」'] =
      sheetBrands.length === 2 && sheetBrands.every((t) => t.endsWith(' (平张标签)'))
    results['平张打印机 → 标签类型 1 项「云马优质打印纸标签」、标签名称 42 项 [6080xx]'] =
      sheetTypes.length === 1 && sheetTypes[0] === '云马优质打印纸标签' &&
      sheetFormats.filter((t) => t !== '自定义').length === 42 &&
      sheetFormats.filter((t) => t !== '自定义').every((t) => /^\[6080\d\d\]/.test(t))

    // ---------- 5) 移除打印机（用户实测「删不掉」的回归） ----------
    await click('[data-testid="new-label-install"]')
    await waitFor('!!document.querySelector("[data-testid=printer-install-dialog]")')
    await sleep(200)
    results['重开安装对话框：该行仍显示「已安装」（状态是持久的）'] =
      await evaluate(`document.querySelector('[data-printer-id="${gprinterId}"] [data-testid=printer-install-row-status]')?.textContent.trim() === '已安装'`)
    await click(`[data-printer-id="${gprinterId}"]`)
    await sleep(160)
    await click('[data-testid="printer-install-remove"]')
    await sleep(320)
    results['移除后该行「状态」列清空'] = await evaluate(`(document.querySelector('[data-printer-id="${gprinterId}"] [data-testid=printer-install-row-status]')?.textContent||'').trim() === ''`)
    await click('[data-testid="printer-install-back"]')
    await sleep(360)
    const afterRemoveTexts = await optionTexts('[data-testid="new-label-printer"]')
    results['移除后打印机下拉不再包含该打印机（修复「删不掉」）'] = !afterRemoveTexts.includes('Gprinter GPL-N (203 dpi)')
    results['移除后已安装偏好被清空（localStorage 里没有该条目）'] =
      await evaluate(`!String(localStorage.getItem('maxlabel.installedPrinters')||'').includes(${JSON.stringify(gprinterId)})`)

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
