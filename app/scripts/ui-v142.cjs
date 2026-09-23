/* A1/A3：「打印」对话框的「打印机 名称/位置」与「打印机属性」窗口标题必须取**真实**设备数据。
 *
 * 依据（真机实拍，不是猜测）：
 *  - `parity/reference/labelshop/probe-63-30-print-dialog.png`：真机「打印」对话框里
 *      `名称: Microsoft Print to PDF` / `位置: PORTPROMPT:` —— 名称是打印队列名、位置是该队列的端口名，
 *    两处都是**只读文本**（所以结构对，只缺值）。
 *  - `parity/reference/labelshop/probe-15-cloudbox-port.png`：真机打印机属性窗口标题
 *      `Gprinter GPL-N (203 dpi) 属性` —— 即 **`<设备名> 属性`**，不是自造标题。
 *
 * round-234 的定位：两处都是「数据现成、没接上」——
 *  - A1 的占位词不是 `PrintDialog.tsx` 造的（它只吃 props），是**调用方**（`App.tsx`）传进来的；
 *  - A3 的标题写死在 `PrinterSettings.tsx` 的 `<Modal title="打印机设置">`。
 *
 * 本脚本的判定口径是**值级、可证伪**的：不是"标题里有『属性』两个字就算过"（那太松），
 * 而是把 UI 上读到的名称/端口，拿去和同一时刻 `window.maxlabel.listPrinters()` 的真实返回**逐字比对**，
 * 并要求所读到的名称**确实是一台真实打印机**（不在占位词黑名单里）。这样：
 *  - 任何一处退回占位词 → 红；
 *  - 名称与端口**配错对**（张三的名、李四的端口）→ 红。
 *
 * 占位词黑名单来自本缺口的历史观测值：`打印机`（名称位）与 `Windows 打印机驱动端口`（位置位）。
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
      const message = JSON.parse(raw.toString()); const item = pending.get(message.id)
      if (!item) return
      pending.delete(message.id); if (message.error) item.rej(new Error(message.error.message)); else item.res(message.result)
    })
    ws.on('open', () => resolve({ ws, send })); ws.on('error', reject)
  })
}

;(async () => {
  let client
  const results = {}
  try {
    const port = process.env.MAXLABEL_DEBUG_PORT || 9222
    const pages = await getJson(`http://127.0.0.1:${port}/json/list`); const page = pages.find((item) => item.type === 'page')
    if (!page) throw new Error('no main page')
    client = await attach(page.webSocketDebuggerUrl)
    const evaluate = async (expression) => {
      const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
      return result.result?.value
    }
    const waitFor = async (expression, timeout = 8000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) { if (await evaluate(expression)) return true; await sleep(120) }
      return false
    }

    // 进编辑器：Ctrl+N → 向导下一步 → 选默认格式（与 Check-PrintDialogFields.cjs 同一条路径）。
    await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(700)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await evaluate('document.querySelector("[data-testid=wizard-next]")?.click()'); await sleep(800) }
    if (await evaluate('!!document.querySelector("[data-testid=new-label-dialog]")')) { await evaluate('document.querySelector("[data-testid=new-label-select]")?.click()'); await sleep(1400) }
    if (!(await waitFor('!!document.querySelector("canvas.upper-canvas")'))) throw new Error('没进编辑器')
    await sleep(600)

    // 真实打印机清单：本脚本的**唯一**期望值来源（避免把"看起来像设备名"当成通过）。
    const printers = await evaluate(`window.maxlabel.listPrinters().then((r) => (r.printers ?? []).map((p) => ({ name: p.name, displayName: p.displayName || p.name, port: p.port || '', isDefault: p.isDefault === true })))`)
    const list = Array.isArray(printers) ? printers : []
    results['A1 前置：能枚举到系统打印机（否则本脚本无法给出值级判定，应显式失败而不是空过）'] = list.length > 0
    const expected = list.find((item) => item.isDefault) ?? list[0] ?? null

    // ---- A1：文件(F) → 打印(P)... 的「名称 / 位置」----
    await evaluate(`document.querySelector('[data-menu-title="文件(F)"]')?.click()`)
    await sleep(350)
    await evaluate(`(() => { const it=[...document.querySelectorAll('[data-menu-item]')].find((e)=>e.offsetParent && /^打印\\(P\\)/.test((e.textContent||'').trim())); if(it) it.click(); return !!it })()`)
    if (!(await waitFor('!!document.querySelector(\'[data-testid="print-dialog"]\')', 6000))) throw new Error('没打开打印对话框')
    // 等"名称"落到真实值：真机口径下它不该是占位词，所以这里等的是**内容变化**而不是固定时长。
    await waitFor(`(() => { const el=document.querySelector('[data-testid=print-dialog-printer]'); return !!el && (el.textContent||'').trim() !== '打印机' })()`, 6000)
    const shownName = ((await evaluate(`document.querySelector('[data-testid=print-dialog-printer]')?.textContent ?? ''`)) || '').trim()
    const shownPos = ((await evaluate(`document.querySelector('[data-testid=print-dialog-printer-position]')?.textContent ?? ''`)) || '').trim()
    results['A1 打印对话框「名称」是真实打印机名（不再是占位词「打印机」）'] =
      shownName !== '' && shownName !== '打印机' && expected !== null && shownName === expected.displayName
    results['A1 打印对话框「位置」是该打印机的真实端口（不再是占位词「Windows 打印机驱动端口」）'] =
      shownPos !== '' && shownPos !== 'Windows 打印机驱动端口' && expected !== null && shownPos === expected.port
    results['A1 名称与位置取自同一台打印机（不是各取一台拼出来的）'] =
      list.some((item) => item.displayName === shownName && item.port === shownPos)
    await evaluate(`(() => { const b=[...document.querySelectorAll('[data-testid=print-dialog] button')].find((x)=>(x.textContent||'').trim()==='取消' && x.offsetParent); b?.click(); return true })()`)
    await sleep(400)

    // ---- A3：打印机属性窗口标题 = `<设备名> 属性` ----
    await evaluate(`document.querySelector('[data-menu-title="文件(F)"]')?.click()`)
    await sleep(350)
    await evaluate(`(() => { const it=[...document.querySelectorAll('[data-menu-item]')].find((e)=>e.offsetParent && /^打印\\(P\\)/.test((e.textContent||'').trim())); if(it) it.click(); return !!it })()`)
    if (!(await waitFor('!!document.querySelector(\'[data-testid="print-dialog"]\')', 6000))) throw new Error('没打开打印对话框')
    await evaluate(`document.querySelector('[data-testid=print-dialog-printer-properties]')?.click()`)
    if (!(await waitFor('!!document.querySelector(\'[data-testid="printer-settings-dialog"]\')', 6000))) throw new Error('没打开打印机属性')
    // 标题依赖异步的打印机枚举，等它落到 `<设备名> 属性` 再取值（否则会读到加载中的回退名）。
    await waitFor(`(() => { const t=document.querySelector('[data-testid=printer-settings-dialog] [data-testid=modal-title]'); return !!t && / 属性$/.test((t.textContent||'').trim()) && (t.textContent||'').trim() !== '打印机 属性' })()`, 6000)
    const settingsTitle = ((await evaluate(`document.querySelector('[data-testid=printer-settings-dialog] [data-testid=modal-title]')?.textContent ?? ''`)) || '').trim()
    results['A3 打印机属性标题 = `<设备名> 属性`（真机 probe-15 / probe-63 口径，不再是写死的「打印机设置」）'] =
      settingsTitle !== '打印机设置' && / 属性$/.test(settingsTitle)
    results['A3 打印机属性标题里的设备名是真实打印机名'] =
      expected !== null && settingsTitle === `${expected.displayName} 属性`
  } catch (error) {
    results['脚本执行'] = 'ERR ' + (error && error.message ? error.message : String(error))
  } finally {
    try { client?.ws?.close() } catch { /* 忽略关闭异常 */ }
  }
  let failed = 0
  for (const [name, value] of Object.entries(results)) {
    const ok = value === true
    if (!ok) failed++
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' -> ' + JSON.stringify(value)}`)
  }
  // 前缀换行与 ui-v140/ui-v141 一致：runner 用 `^\s*(\d+)/(\d+) PASS\s*$` 判定，
  // 摘要行必须自成一行（上一条断言名以中文结尾时，若与摘要同行会被判成解析失败）。
  console.log(`\n${Object.keys(results).length - failed}/${Object.keys(results).length} PASS`)
  process.exit(failed === 0 ? 0 : 1)
})()
