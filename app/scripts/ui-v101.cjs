/* B 章节：对象属性 → 数据源 / 脚本 / 表格逐项断言（B-90~B-107） */
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
    const click = (selector) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e || !e.isConnected) return false; e.click(); return true })()`)
    const setValue = (selector, value) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return false; const proto = e instanceof HTMLSelectElement ? HTMLSelectElement.prototype : e instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; const setter = Object.getOwnPropertyDescriptor(proto, 'value').set; setter.call(e, ${JSON.stringify(String(value))}); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
    const clickMenu = (token) => evaluate(`(() => { const e = [...document.querySelectorAll('[data-menu-item]')].find((x) => x.offsetParent && (x.textContent || '').includes(${JSON.stringify(token)})); if (!e) return false; e.click(); return true })()`)
    const key = (name, options = {}) => evaluate(`(() => { window.dispatchEvent(new KeyboardEvent('keydown', ${JSON.stringify({ key: name, bubbles: true, cancelable: true, ...options })})); return true })()`)
    const clickCanvas = (x, y, double = false) => evaluate(`(() => {
      const host = document.querySelector('[data-testid="canvas-host"], .canvas-container, canvas'); if (!host) return false
      const box = host.getBoundingClientRect(); const clientX = box.left + ${Number(x) || 0}; const clientY = box.top + ${Number(y) || 0}; const target = document.elementFromPoint(clientX, clientY) || host
      const opts = { bubbles: true, cancelable: true, view: window, clientX, clientY, detail: ${double ? 2 : 1}, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 }
      try { target.dispatchEvent(new PointerEvent('pointerdown', opts)) } catch {}; target.dispatchEvent(new MouseEvent('mousedown', opts)); try { target.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0 })) } catch {}
      target.dispatchEvent(new MouseEvent('mouseup', { ...opts, buttons: 0 })); target.dispatchEvent(new MouseEvent('click', { ...opts, buttons: 0 })); ${double ? "target.dispatchEvent(new MouseEvent('dblclick', { ...opts, buttons: 0 }))" : ''}; return true
    })()`)
    const closeModal = () => evaluate('window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); true')
    const tabText = () => evaluate(`document.querySelector('[data-testid="object-props-dialog"]')?.textContent || ''`)

    await sleep(1800); await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(300); await click('[data-testid="wizard-next"]'); await sleep(450)
    await evaluate(`(() => { const items = [...document.querySelectorAll('button')].filter((e) => e.offsetParent && (e.textContent || '').trim() === '选择'); items.at(-1)?.click(); return !!items.length })()`)
    await sleep(700); await click('[data-tool="text"]'); await clickCanvas(200, 180); await sleep(450); await clickCanvas(200, 180, true); await sleep(700)
    if (!await evaluate('!!document.querySelector("[data-testid=object-props-dialog]")')) throw new Error('object properties dialog did not open')
    await click('[data-testid="object-props-tab-datasource"]'); await sleep(150)

    // B-90 子串列表与六项子串工具栏
    const barItems = await evaluate(`(() => {
      const add = !!document.querySelector('[data-testid="source-substring-add"]')
      const paste = !!document.querySelector('[data-testid="source-substring-paste"]')
      return { add, paste }
    })()`)
    await click('[data-testid="source-substring-add"]'); await sleep(220)
    await setValue('[data-testid="constant-source-value"]', '批次'); await sleep(150)
    await click('[data-testid="source-substring-add"]'); await sleep(220)
    await setValue('[data-testid="constant-source-value"]', '号'); await sleep(150)
    const six = await evaluate(`(() => {
      const need = ['source-substring-add', 'source-substring-paste', 'source-substring-copy-1', 'source-substring-move-up-1', 'source-substring-move-down-1', 'source-substring-remove-1']
      const missing = need.filter((t) => !document.querySelector('[data-testid="' + t + '"]'))
      const rows = [...document.querySelectorAll('[data-testid]')].filter((e) => /^source-substring-\d+$/.test(e.dataset.testid || '')).map((e) => e.dataset.testid)
      return { ok: missing.length === 0 && ${JSON.stringify(barItems.add)} && ${JSON.stringify(barItems.paste)}, missing: missing.join('|'), rows: rows.join('|'), list: !!document.querySelector('[data-testid="source-substring-list"]') }
    })()`)
    if (!six.ok) console.log('DEBUG-B90 ' + JSON.stringify(six))
    results['B-90 子串工具栏含新建/复制/粘贴/删除/上移/下移六项'] = six.ok
    const subRows = () => evaluate(`[...document.querySelectorAll('[data-testid]')].filter((e) => /^source-substring-\\d+$/.test(e.dataset.testid || '')).length`)
    const beforeCopy = await subRows()
    await click('[data-testid="source-substring-copy-1"]'); await sleep(200)
    results['B-90 复制后粘贴按钮启用'] = await evaluate(`document.querySelector('[data-testid="source-substring-paste"]')?.disabled === false`)
    await click('[data-testid="source-substring-paste"]'); await sleep(250)
    results['B-90 复制后粘贴新增一条相同子串'] = beforeCopy === 2 && (await subRows()) === 3
    await click('[data-testid="source-substring-remove-2"]'); await sleep(150)

    // B-91 数据类型 / 显示数据 / 变量共享名称
    results['B-91 数据源页含七类数据类型入口'] = await evaluate(`(() => {
      const items = [...document.querySelectorAll('[data-testid="data-source-editor"] [data-testid^="source-kind-"]')]
      return items.length === 7
    })()`)
    await click('[data-testid="source-kind-serial"]'); await sleep(200)
    results['B-91 数据源页含显示数据字段与变量共享名称'] = await evaluate(`(() => {
      const root = document.querySelector('[data-testid="data-source-editor"]')
      const t = root.textContent || ''
      return !!root.querySelector('[data-testid="serial-current"]') && t.includes('显示数据')
    })()`)
    await click('[data-testid="source-substring-add"]'); await sleep(220)
    results['B-91 子串变量共享名称字段存在'] = await evaluate(`(() => { const root = document.querySelector('[data-testid="data-source-editor"]'); return !!document.querySelector('[data-testid="shared-source-name"]') && (root.textContent || '').includes('共享变量名') })()`)
    results['B-91 共享变量名称可写入'] = await setValue('[data-testid="shared-source-name"]', 'BatchNo').then(async () => { await sleep(150); return await evaluate(`document.querySelector('[data-testid="shared-source-name"]')?.value === 'BatchNo'`) })
    await click('[data-testid="source-substring-remove-2"]'); await sleep(200)

    // B-92 高级选项 / 示例 / 非打印 ASCII 字符
    await click('[data-testid="source-kind-constant"]'); await sleep(150)
    results['B-92 数据源页提供 ASCII 1-31 非打印字符插入条'] = await evaluate(`(() => {
      const bar = document.querySelector('[data-testid="control-char-bar"]')
      const buttons = [...(bar?.querySelectorAll('[data-testid^="control-char-"]') || [])]
      return buttons.length === 31 && buttons[0].dataset.testid === 'control-char-1' && buttons.at(-1).dataset.testid === 'control-char-31'
    })()`)
    await click('[data-testid="control-char-9"]'); await sleep(250)
    results['B-92 插入 <HT> 后显示数据包含控制字符转义'] = await evaluate(`(document.querySelector('[data-testid="constant-source-value"]')?.value || '').endsWith('<HT>')`)
    await click('[data-testid="source-kind-serial"]'); await sleep(150)
    results['B-92 序列号页给出示例'] = await evaluate(`(() => {
      const root = document.querySelector('[data-testid="data-source-editor"]')
      return !!root.querySelector('[data-testid="serial-preview"]') && /示例/.test(root.textContent || '')
    })()`)

    // B-93/B-94 截断与字符数属性
    await click('[data-testid="object-props-tab-text"]'); await sleep(150)
    results['B-93 截断属性含删除空格/丢弃/保留七项'] = await evaluate(`(() => {
      const sel = document.querySelector('[data-testid="text-cut-type"]')
      const values = [...(sel?.options || [])].map((o) => o.value)
      return values.join(',') === 'none,trimLeft,trimRight,dropLeft,dropRight,keepLeft,keepRight'
    })()`)
    await setValue('[data-testid="text-cut-type"]', 'dropLeft'); await sleep(150)
    results['B-93 选择丢弃左侧字符后出现字符数输入'] = await evaluate(`!!document.querySelector('[data-testid="text-cut-count"]')`)
    await setValue('[data-testid="text-length-limit"]', 'both'); await sleep(180)
    const lenText = await tabText()
    results['B-94 长度下限含最小字符数/填充方向/填充字符'] = await evaluate(`!!document.querySelector('[data-testid="text-length-min"]') && !!document.querySelector('[data-testid="text-pad-direction"]') && !!document.querySelector('[data-testid="text-pad-char"]')`)
    results['B-94 长度上限含最大字符数与截去方向'] = await evaluate(`!!document.querySelector('[data-testid="text-length-max"]') && !!document.querySelector('[data-testid="text-trim-direction"]')`)
    results['B-94 字段文案按帮助的左右填加/截去措辞'] = lenText.includes('长度不足时') && lenText.includes('在数据的左侧填加') && lenText.includes('长度超过时截去') && lenText.includes('从右侧截去多余字符')

    // B-99 日期 / 时间属性
    await click('[data-testid="object-props-tab-datasource"]'); await sleep(150)
    await click('[data-testid="source-kind-date"]'); await sleep(150)
    results['B-99 日期属性含格式与偏移且默认格式为 yyyy-MM-dd'] = await evaluate(`(() => {
      const f = document.querySelector('[data-testid="date-format"]')
      return !!f && f.value === 'yyyy-MM-dd' && document.querySelector('[data-testid="date-offset"]')?.value === '0' && [...f.options].length > 3
    })()`)
    await click('[data-testid="source-kind-time"]'); await sleep(150)
    results['B-99 时间属性含格式/区域/偏移且默认为 HH:mm:ss 与默认区域'] = await evaluate(`(() => {
      const f = document.querySelector('[data-testid="time-format"]')
      return !!f && f.value === 'HH:mm:ss' && document.querySelector('[data-testid="time-region"]')?.value === 'default' && document.querySelector('[data-testid="time-offset"]')?.value === '0'
    })()`)

    // B-100 数据库属性
    await click('[data-testid="source-kind-database"]'); await sleep(150)
    results['B-100 数据库属性含字段名与第几条记录选择'] = await evaluate(`!!document.querySelector('[data-testid="database-field"]') && !!document.querySelector('[data-testid="database-record-offset"]')`)
    results['B-100 数据库属性含字段名提示与当前记录说明'] = await evaluate(`(() => {
      const t = document.querySelector('[data-testid="data-source-editor"]')?.textContent || ''
      return t.includes('字段名') && t.includes('第几条记录')
    })()`)

    // B-101 / B-102 键盘输入属性
    await click('[data-testid="source-kind-keyboard"]'); await sleep(150)
    results['B-101 键盘输入属性含键盘/电子秤两种输入来源'] = await evaluate(`(() => {
      const sel = document.querySelector('[data-testid="keyboard-input-device"]')
      return [...(sel?.options || [])].map((o) => o.value).join(',') === 'keyboard,weigh'
    })()`)
    const kb102 = await evaluate(`(() => {
      const label = document.querySelector('[data-testid="keyboard-label"]')
      const t = document.querySelector('[data-testid="data-source-editor"]')?.textContent || ''
      return { has: !!label, value: label?.value, hint: t.includes('打印作业开始时请求输入'), sample: t.slice(0, 200) }
    })()`)
    if (!(kb102.has && /请输入/.test(kb102.value || '') && kb102.hint)) console.log('DEBUG-B102 ' + JSON.stringify(kb102))
    results['B-102 键盘输入属性含提示字段且默认提示存在'] = kb102.has && /请输入/.test(kb102.value || '') && kb102.hint

    // B-103 / B-104 / B-105 脚本属性
    await click('[data-testid="source-kind-script"]'); await sleep(180)
    results['B-103 脚本属性提供脚本语言选择且默认 VB Script'] = await evaluate(`(() => {
      const sel = document.querySelector('[data-testid="script-language"]')
      return [...(sel?.options || [])].map((o) => o.value).join(',') === 'vbscript,javascript' && sel.value === 'vbscript'
    })()`)
    results['B-103 脚本模板为 VB Script 的 Function OnGetData 形式'] = await evaluate(`(() => {
      const c = document.querySelector('[data-testid="script-code"]')?.value || ''
      return /Function\\s+OnGetData/.test(c) && /End Function/.test(c)
    })()`)
    await click('[data-testid="script-syntax-check"]'); await sleep(250)
    const syn103 = await evaluate(`(() => {
      const r = document.querySelector('[data-testid="script-syntax-result"]')
      return { exists: !!r, ok: r?.dataset.ok, text: r?.textContent }
    })()`)
    if (syn103.ok !== 'true') console.log('DEBUG-B103 ' + JSON.stringify(syn103))
    results['B-103 语法检查对合法脚本报告通过'] = syn103.ok === 'true'
    results['B-104 脚本范围含私有/公共/预定义三项'] = await evaluate(`(() => {
      const sel = document.querySelector('[data-testid="script-scope"]')
      return [...(sel?.options || [])].map((o) => o.value).join(',') === 'private,public,predefined' && sel.value === 'private'
    })()`)
    await setValue('[data-testid="script-scope"]', 'predefined'); await sleep(180)
    results['B-104 预定义脚本可从标准库选择且脚本内容只读'] = await evaluate(`(() => {
      const list = document.querySelector('[data-testid="script-predefined-list"]')
      const code = document.querySelector('[data-testid="script-code"]')
      return !!list && [...list.options].length >= 3 && code.readOnly === true && !!document.querySelector('[data-testid="script-syntax-check"]')
    })()`)
    await setValue('[data-testid="script-scope"]', 'private'); await sleep(180)
    await setValue('[data-testid="script-code"]', 'Function OnGetData()\n  while true\nEnd Function'); await sleep(200)
    await click('[data-testid="script-syntax-check"]'); await sleep(250)
    const syn105 = await evaluate(`(() => { const r = document.querySelector('[data-testid="script-syntax-result"]'); return { ok: r?.dataset.ok, text: r?.textContent } })()`)
    if (syn105.ok !== 'false') console.log('DEBUG-B105 ' + JSON.stringify(syn105))
    results['B-105 语法检查对不配对脚本报告错误'] = syn105.ok === 'false'
    results['B-105 脚本页写明出错时变量置空字符串'] = await evaluate(`(document.querySelector('[data-testid="script-error-handling"]')?.textContent || '').includes('空字符串')`)
    await closeModal(); await sleep(250)

    let pass = 0; for (const [name, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value); if (value) pass++ }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`); client.ws.close(); process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    for (const [name, value] of Object.entries(results)) console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value)
    console.error('ERR', error.message)
    if (client) client.ws.close(); process.exit(2)
  }
})()
