/* A-121 「添加或删除按钮 → 自定义...」：自定义工具栏按钮的显隐、布局顺序与按键。
   帮助 toolbar_mainbar.html：「用于添加或删除工具栏按钮，也可自定义按键及布局」。
   真机证据 parity/reference/labelshop/91-toolbar-customize-submenu.png（二级子菜单含「自定义...」）。 */
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
    const waitFor = async (expression, timeout = 4000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) { if (await evaluate(expression)) return true; await sleep(80) }
      return false
    }
    // 「添加或删除按钮」入口本身也有 title，统计工具栏按钮时排除它
    const SEL = '[data-testid=toolbar] button[title]:not([data-testid=toolbar-customize])'
    const hasTitle = (t) => `[...document.querySelectorAll(${JSON.stringify(SEL)})].some((e)=>e.getAttribute("title")===${JSON.stringify(t)})`
    const toolbarOrder = () => evaluate(`[...document.querySelectorAll(${JSON.stringify(SEL)})].map((e)=>e.getAttribute("title"))`)
    /** 打开「添加或删除按钮 → 添加或删除按钮(A) → 自定义...」 */
    const openCustomizeDialog = async () => {
      await click('[data-testid=toolbar-customize]')
      if (!await waitFor('!!document.querySelector("[data-testid=toolbar-customize-menu]")')) return false
      await click('[data-testid=toolbar-customize-root]')
      if (!await waitFor('!!document.querySelector("[data-testid=toolbar-customize-advanced]")')) return false
      await click('[data-testid=toolbar-customize-advanced]')
      return await waitFor('!!document.querySelector("[data-testid=customize-toolbar-dialog]")')
    }

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    if (!await waitFor('!!document.querySelector("[data-testid=toolbar]")')) throw new Error('工具栏未出现')

    // ① 入口：下拉 → 自定义... 打开「自定义」对话框
    results['「自定义...」打开对话框'] = await openCustomizeDialog()
    results['对话框列出全部工具栏按钮'] = await evaluate(`(() => {
      const keys=['new','open','save','cut','copy','paste','delete','undo','redo','labelFormat','preview','print','select','barcode','text','line','diagonal','rect','image','table','rfid','data','dbConfig','dbLocate','dbRefresh','dbFirst','dbPrev','dbNext','dbLast','zoomIn','zoomOut','fitWidth','fitHeight','fitWindow','help']
      return keys.every((k)=>!!document.querySelector('[data-testid=customize-toolbar-row-'+k+']'))
    })()`)

    // ② 取消勾选「打印」按钮 → 工具栏不再含该按钮；确定后写回系统选项
    results['取消勾选「打印」按钮'] = await evaluate(`(() => { const b=document.querySelector('[data-testid=customize-toolbar-visible-print]'); if(!b||!b.checked)return false; b.click(); return true })()`)
    await click('[data-testid=customize-toolbar-ok]')
    results['确定后工具栏移除「打印」按钮'] = await waitFor(`!(${hasTitle('打印')})`)
    results['隐藏按钮写入系统选项'] = await evaluate(`(() => { const l=JSON.parse(localStorage.getItem("maxlabel.options")||"{}").toolbarLayout||{}; return Array.isArray(l.hidden)&&l.hidden.includes('print') })()`)

    // ③ 布局：把「帮助主题」上移一位（顺序变化立即体现在工具栏上）
    const before = await toolbarOrder()
    if (!await openCustomizeDialog()) throw new Error('自定义对话框未打开')
    await click('[data-testid=customize-toolbar-row-help]')
    results['选中行显示按钮名'] = (await evaluate("document.querySelector('[data-testid=customize-toolbar-selected]').textContent")) === '帮助主题'
    await click('[data-testid=customize-toolbar-up]')
    await click('[data-testid=customize-toolbar-ok]')
    const after = await toolbarOrder()
    // 「帮助主题」原本是最后一个按钮，上移一次后应与「撑满窗口」交换位置
    const expected = [...before.slice(0, before.length - 2), '帮助主题', '撑满窗口']
    results['上移改变工具栏按钮顺序'] = JSON.stringify(after) === JSON.stringify(expected)
    results['顺序写入系统选项'] = await evaluate(`(() => { const l=JSON.parse(localStorage.getItem("maxlabel.options")||"{}").toolbarLayout||{}; return Array.isArray(l.order)&&l.order[l.order.length-2]==='help' })()`)

    // ④ 按键：给「帮助主题」指派 Ctrl+9，关闭对话框后按该组合键等价于点该按钮
    if (!await openCustomizeDialog()) throw new Error('自定义对话框未打开')
    await click('[data-testid=customize-toolbar-row-help]')
    await click('[data-testid=customize-toolbar-keyassign]')
    await evaluate(`(() => {
      const b=document.querySelector('[data-testid=customize-toolbar-keyassign]')
      b.dispatchEvent(new KeyboardEvent('keydown',{key:'9',code:'Digit9',bubbles:true,cancelable:true,ctrlKey:true}))
      return true
    })()`)
    await sleep(200)
    results['指派按键后显示组合键'] = (await evaluate("document.querySelector('[data-testid=customize-toolbar-key-help]').textContent")) === 'Ctrl+9'
    await click('[data-testid=customize-toolbar-ok]')
    results['按键写入系统选项'] = await evaluate(`(() => { const l=JSON.parse(localStorage.getItem("maxlabel.options")||"{}").toolbarLayout||{}; return l.keys&&l.keys.help==='Ctrl+9' })()`)
    await evaluate(`(() => { window.dispatchEvent(new KeyboardEvent('keydown',{key:'9',code:'Digit9',bubbles:true,cancelable:true,ctrlKey:true})); return true })()`)
    results['按 Ctrl+9 等价于点「帮助主题」'] = await waitFor('!!document.querySelector("[data-testid=help-dialog]")')
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await sleep(300)

    // ⑤ 持久化：重载渲染进程（同一 user-data-dir，等价于重启应用）后仍生效
    await client.send('Page.enable')
    await client.send('Page.reload', { ignoreCache: false })
    await sleep(2600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    if (!await waitFor('!!document.querySelector("[data-testid=toolbar]")')) throw new Error('重载后工具栏未出现')
    results['重载后隐藏的「打印」仍不出现'] = await evaluate(`!(${hasTitle('打印')})`)
    // 「打印」已隐藏，故「帮助主题」落在倒数第二位（其余顺序不变）
    const reloaded = await toolbarOrder()
    results['重载后自定义顺序仍生效'] = reloaded[reloaded.length - 2] === '帮助主题' && reloaded[reloaded.length - 1] === '撑满窗口'

    // ⑥ 取消不改动设置；全部重置可恢复默认
    if (!await openCustomizeDialog()) throw new Error('重载后自定义对话框未打开')
    await evaluate(`(() => { const b=document.querySelector('[data-testid=customize-toolbar-visible-zoomIn]'); b.click(); return true })()`)
    await click('[data-testid=customize-toolbar-cancel]')
    results['取消不改动设置'] = await waitFor(`(${hasTitle('放大')})`) && await evaluate(`(() => { const l=JSON.parse(localStorage.getItem("maxlabel.options")||"{}").toolbarLayout||{}; return !l.hidden.includes('zoomIn') })()`)

    if (!await openCustomizeDialog()) throw new Error('重载后自定义对话框未打开')
    await click('[data-testid=customize-toolbar-reset]')
    await click('[data-testid=customize-toolbar-ok]')
    results['全部重置恢复默认布局'] = await waitFor(`(${hasTitle('打印')}) && (${hasTitle('放大')}) && (${hasTitle('新建标签模版')})`) && (await toolbarOrder())[0] === '新建标签模版'
    results['重置写回系统选项'] = await evaluate(`(() => { const l=JSON.parse(localStorage.getItem("maxlabel.options")||"{}").toolbarLayout||{}; return l.hidden.length===0 && Object.keys(l.keys).length===0 && l.order[0]==='new' })()`)

    let pass = 0
    for (const [name, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value); if (value === true) pass++ }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    client.ws.close()
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
