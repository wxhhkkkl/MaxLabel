/*
 * 需求清单「打印和预览」15 条逐条对齐（round-115）。
 *
 * 判据来自原版自带帮助（app/docs/labelshop-help-zh）与真机打印对话框清单
 * （parity/reference/labelshop/INDEX.md 的 63-dlg-print.png / 64a-dlg-adv-print-options.png）：
 *   - 245 打印机 名称        print_dlg_main.html「显示指定用来打印标签的打印机名，如果需要更改目标打印机，请在标签设置对话框中进行」
 *   - 246 打印机 位置        「显示打印机安装的端口位置或网络路径」
 *   - 247 打印到文件          「支持命令打印到文件（需专业版及以上版本支持）」
 *   - 250 打印范围 单签拷贝    「如果相同的标签需要打印多份，则需要指定拷贝选项」「实际输出 = 打印数量 X 单签拷贝」
 *   - 251 打印范围 作业份数    帮助只在「还受拷贝数和份数影响」一句里提到份数；真机打印对话框**没有独立的份数控件**
 *                            （INDEX 63 图字段清单：打印数量 / 单签拷贝 / 启始记录）→ 复刻版同样不设独立字段
 *   - 252 打印范围 记录数量    「当有数据库联接时，打印数量指定了输出记录的个数」
 *   - 253 打印范围 起始记录    「配合数据库使用，用于指定数据库中记录行数」
 *   - 254 设置 打印后更新变量数据「完成打印作业后，是否自动更新变量数据，如序列号」
 *   - 255 设置 打印标签边框    「此选项对于命令输出方式无效」（真机 63 图里该项文字带删除线＝禁用）
 *   - 256 高级选项/数据库 打印时自动设置数据库记录数量
 *   - 257 高级选项/数据库 拷贝数量从数据库字段引入
 *   - 258 高级选项/数据库 字段名称
 *   - 259 高级选项/数据库 允许打印时输入第一个标签的拷贝数量
 *   - 260 起始标签位置 选择起始标签位置「被指定为起始标签之前的标签都将变成灰色，而之后的所有标签将重新排号，
 *                            指定的起始标签排号为1」「对于命令输出方式不可选择起始标签位置」
 *   - 261 起始标签位置 自动跟踪起始标签位置「每次执行打印任务后，根据标签的实际输出数量自动更新标签的起始位置」
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
      const setter=Object.getOwnPropertyDescriptor(proto,'value').set
      setter.call(e,${JSON.stringify(String(value))})
      e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
    const waitFor = async (expression, timeout = 5000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); return true })()`)
    const text = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent || ''`)
    const openPrintDialog = async () => {
      await key('p', { ctrlKey: true })
      return waitFor('!!document.querySelector("[data-testid=print-dialog]")', 6000)
    }
    const closePrintDialog = async () => {
      await evaluate(`document.querySelector('[aria-label="关闭打印对话框"]')?.click()`)
      await waitFor('!document.querySelector("[data-testid=print-dialog]")', 3000)
      await sleep(200)
    }
    const openAdvanced = async (tab) => {
      await click('[data-testid="print-dialog-advanced"]'); await sleep(240)
      if (tab) { await click(`[data-testid="print-advanced-tab-${tab}"]`); await sleep(160) }
    }

    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(420)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(380)
    }
    const selectLabel = await evaluate(`(() => { const items=[...document.querySelectorAll('button')].filter((e)=>e.offsetParent&&(e.textContent||'').trim()==='选择'); items.at(-1)?.click(); return !!items.length })()`)
    await waitFor('!!document.querySelector("canvas.upper-canvas")', 9000)
    await sleep(400)
    if (!selectLabel) throw new Error('新建标签失败')

    // ---------- 245 / 246 打印机 名称 与 位置 ----------
    if (!await openPrintDialog()) throw new Error('打印对话框没打开')
    const printerGroup = await text('[data-testid="print-dialog-group-printer"]')
    const printerName = (await text('[data-testid="print-dialog-printer"]')).trim()
    results['245 打印机「名称」显示当前打印机（帮助：改打印机要到标签设置对话框）'] =
      printerGroup.includes('名称') && printerName.length > 0 &&
      (await evaluate(`document.querySelectorAll('[data-testid="print-dialog"] select').length === 0`)) === true
    const printerPosition = (await text('[data-testid="print-dialog-printer-position"]')).trim()
    results['246 打印机「位置」显示端口位置（帮助：端口位置或网络路径）'] =
      printerGroup.includes('位置') && printerPosition.length > 0
    results['245/246 打印对话框有「打印机属性」按钮（帮助：设置打印机的属性）'] =
      (await text('[data-testid="print-dialog-printer-properties"]')).trim() === '打印机属性'

    // ---------- 250 单签拷贝 / 252 记录数量 / 253 起始记录 ----------
    const countInput = await evaluate(`(() => { const e=document.querySelector('[data-testid="print-dialog-count"]'); return e?{value:e.value,disabled:e.disabled}:null })()`)
    const copiesInput = await evaluate(`(() => { const e=document.querySelector('[data-testid="print-dialog-copies"]'); return e?{value:e.value,disabled:e.disabled}:null })()`)
    await setValue('[data-testid="print-dialog-copies"]', '3'); await sleep(200)
    const copiesAfter = await evaluate(`document.querySelector('[data-testid="print-dialog-copies"]')?.value`)
    results['250 打印范围含「单签拷贝」可改（帮助：相同标签打印多份；输出 = 打印数量 X 单签拷贝）'] =
      Boolean(copiesInput) && copiesInput.disabled === false && copiesInput.value === '1' && copiesAfter === '3'

    const rangeGroup = await text('[data-testid="print-dialog-group-range"]')
    results['251 打印范围不设独立「作业份数」字段（真机 63 图也只有 打印数量/单签拷贝/启始记录）'] =
      rangeGroup.includes('打印数量') && rangeGroup.includes('单签拷贝') && rangeGroup.includes('启始记录') &&
      !rangeGroup.includes('作业份数') && !rangeGroup.includes('份数')

    const startRecord = await evaluate(`(() => { const e=document.querySelector('[data-testid="print-dialog-start-record"]'); return e?{value:e.value,disabled:e.disabled}:null })()`)
    results['253 打印范围含「启始记录」且默认 1（帮助：配合数据库指定记录行数）'] =
      Boolean(startRecord) && startRecord.value === '1' && startRecord.disabled === false

    // 252 记录数量：勾选「只打印数据表中当前记录行的数据」后打印数量失效（帮助：数据库的打印数量失效）
    await click('[data-testid="print-option-current-only"]'); await sleep(240)
    const countDisabledWhenCurrentOnly = await evaluate(`document.querySelector('[data-testid="print-dialog-count"]')?.disabled === true`)
    await click('[data-testid="print-option-current-only"]'); await sleep(240)
    const countEnabledAgain = await evaluate(`document.querySelector('[data-testid="print-dialog-count"]')?.disabled === false`)
    results['252 「打印数量」即数据库记录数量：勾选只打印当前记录行后失效，取消后恢复'] =
      Boolean(countInput) && countInput.disabled === false && countDisabledWhenCurrentOnly && countEnabledAgain

    // ---------- 254 打印后更新变量数据 / 255 打印标签边框 ----------
    const settingsGroup = await text('[data-testid="print-dialog-group-settings"]')
    const updateVarsDefault = await evaluate(`document.querySelector('[data-testid="print-option-update-vars"]')?.checked`)
    await click('[data-testid="print-option-update-vars"]'); await sleep(200)
    const updateVarsAfter = await evaluate(`document.querySelector('[data-testid="print-option-update-vars"]')?.checked`)
    results['254 设置含「打印后更新变量数据」复选框且默认不勾选、可切换（帮助：序列号打印后写回）'] =
      settingsGroup.includes('打印后更新变量数据') && updateVarsDefault === false && updateVarsAfter === true

    const borderOption = await evaluate(`(() => { const e=document.querySelector('[data-testid="print-option-border"]'); return e?{checked:e.checked,disabled:e.disabled}:null })()`)
    results['255 设置含「打印标签边框」且禁用（帮助：该项对命令输出方式无效；真机 63 图该项带删除线）'] =
      settingsGroup.includes('打印标签边框') && Boolean(borderOption) && borderOption.disabled === true && borderOption.checked === false

    // ---------- 256–259 高级选项 → 数据库页 ----------
    await openAdvanced('database')
    const advancedText = await text('[data-testid="print-advanced-dialog"]')
    // 「字段名称」只在勾选「拷贝数量从数据库字段引入」后才出现（真机同页也是这组从属关系）
    const databaseLabels = ['打印时自动设置数据库记录数量', '拷贝数量从数据库字段引入', '允许打印时输入第一个标签的拷贝数量']
    const databasePresent = databaseLabels.every((label) => advancedText.includes(label))
    const autoCountDefault = await evaluate(`document.querySelector('[data-testid="print-option-auto-count"]')?.checked`)
    const firstCopyDefault = await evaluate(`document.querySelector('[data-testid="print-option-first-copy"]')?.checked`)
    await click('[data-testid="print-option-auto-count"]'); await sleep(150)
    await click('[data-testid="print-option-copy-field"]'); await sleep(260)
    const fieldNameVisible = (await text('[data-testid="print-advanced-dialog"]')).includes('字段名称')
    const fieldNameEnabled = await evaluate(`document.querySelector('[data-testid="print-option-copy-field-name"]')?.disabled === false`)
    const fieldNameSet = await setValue('[data-testid="print-option-copy-field-name"]', 'qty'); await sleep(180)
    await click('[data-testid="print-option-first-copy"]'); await sleep(150)
    await click('[data-testid="print-advanced-submit"]'); await sleep(260)
    results['256–259 高级选项→数据库页四项齐全且默认未勾选（帮助 print_dlg_dbs.html 逐条原文）'] =
      databasePresent && autoCountDefault === false && firstCopyDefault === false
    results['258 「字段名称」随「拷贝数量从数据库字段引入」出现且可填写'] = fieldNameVisible && fieldNameEnabled && fieldNameSet === true

    // 复核选择在关闭/重开打印对话框后仍然保留
    await closePrintDialog()
    if (!await openPrintDialog()) throw new Error('打印对话框第二次没打开')
    await openAdvanced('database')
    const autoCountKept = await evaluate(`document.querySelector('[data-testid="print-option-auto-count"]')?.checked`)
    const fieldNameKept = await evaluate(`document.querySelector('[data-testid="print-option-copy-field-name"]')?.value`)
    await click('[data-testid="print-advanced-submit"]'); await sleep(240)
    results['256–259 高级选项的选择写进打印设置（重开打印对话框后仍保留）'] = autoCountKept === true && fieldNameKept === 'qty'

    // ---------- 260 选择起始标签位置 ----------
    const labelButtons = await evaluate(`[...document.querySelectorAll('[data-testid^="print-start-label-"]')].map((e)=>({ text:e.textContent.trim(), disabled:e.disabled }))`)
    const clickThird = await click('[data-testid="print-start-label-3"]'); await sleep(260)
    const afterPick = await evaluate(`[...document.querySelectorAll('[data-testid^="print-start-label-"]')].map((e)=>({ text:e.textContent.trim(), disabled:e.disabled }))`)
    results['260 起始标签预览共 8 格（100mm x 70mm 圆角 8 枚/页）且可点选第 3 格'] =
      Array.isArray(labelButtons) && labelButtons.length === 8 && clickThird === true
    results['260 起始标签之前的格子变灰禁用、起始标签起重新排号为 1（帮助原文）'] =
      afterPick.length === 8 && afterPick[0].disabled === true && afterPick[1].disabled === true &&
      afterPick[2].disabled === false && afterPick[2].text === '1' && afterPick[3].text === '2' &&
      afterPick[7].text === '6'

    // ---------- 261 自动跟踪起始标签位置 ----------
    const trackDefault = await evaluate(`document.querySelector('[data-testid="print-option-track-start"]')?.checked`)
    await click('[data-testid="print-option-track-start"]'); await sleep(200)
    const trackAfter = await evaluate(`document.querySelector('[data-testid="print-option-track-start"]')?.checked`)
    results['261 含「自动跟踪起始标签位置」复选框且默认为不勾选、可切换'] =
      trackDefault === false && trackAfter === true

    await closePrintDialog()

    // ---------- 247 打印到文件（命令输出方式）----------
    await openPrintDialog()
    await click('[data-testid="print-dialog-printer-properties"]'); await sleep(420)
    await click('[data-testid="printer-settings-port-tab"]'); await sleep(220)
    await setValue('[data-testid="printer-port-type"]', 'file'); await sleep(260)
    await click('[data-testid="printer-settings-save"]'); await sleep(360)
    const commandModePosition = (await text('[data-testid="print-dialog-printer-position"]')).trim()
    const startLabelsHidden = await evaluate(`!!document.querySelector('[data-testid="print-dialog-start-disabled"]')`)
    const trackDisabledInCommandMode = await evaluate(`document.querySelector('[data-testid="print-option-track-start"]')?.disabled === true`)
    results['247 指令文件端口下「位置」显示打印到文件（帮助：支持命令打印到文件）'] =
      commandModePosition.includes('打印到文件')
    results['260/261 命令输出方式下不可选择起始标签、自动跟踪也禁用（帮助原文）'] =
      startLabelsHidden && trackDisabledInCommandMode

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
