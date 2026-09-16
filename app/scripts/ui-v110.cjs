/* A-121 主工具栏「添加或删除按钮」：按组显示/隐藏按钮 + 结果持久化。
   帮助 toolbar_mainbar.html 的分组标题：文件操作 / 复制、粘贴 / 撤消、重做 / 打印 /
   对象 / 数据库 / 显示 / 帮助，末项「添加或删除按钮」用于添加或删除工具栏按钮。 */
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
    const toolbarTitles = () => evaluate('[...document.querySelectorAll("[data-testid=toolbar] button[title]")].map((e)=>e.getAttribute("title"))')
    const hasTitle = (t) => `[...document.querySelectorAll("[data-testid=toolbar] button[title]")].some((e)=>e.getAttribute("title")===${JSON.stringify(t)})`
    /** 打开「添加或删除按钮 → 添加或删除按钮(A) → 标准」三级结构，露出分组勾选清单。 */
    const openGroupMenu = async () => {
      await click('[data-testid=toolbar-customize]')
      if (!await waitFor('!!document.querySelector("[data-testid=toolbar-customize-menu]")')) return false
      await click('[data-testid=toolbar-customize-root]')
      if (!await waitFor('!!document.querySelector("[data-testid=toolbar-customize-submenu]")')) return false
      await click('[data-testid=toolbar-customize-standard]')
      return await waitFor('!!document.querySelector("[data-testid=toolbar-customize-groups]")')
    }
    /** 勾选/取消「添加或删除按钮」下拉里的某个分组（按帮助原文的分组名匹配）。 */
    const toggleGroup = (label, visible) => evaluate(`(() => {
      const rows=[...document.querySelectorAll('[data-testid^=toolbar-group-]')]
      const row=rows.find((r)=>(r.textContent||'').trim()===${JSON.stringify(label)})
      if(!row) return 'no-row'
      const box=row.querySelector('input[type=checkbox]')
      if(!box) return 'no-box'
      if(box.checked===${visible}) return 'already'
      box.click()
      return 'clicked'
    })()`)

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    // 起始页也要有工具栏（原版工具栏常驻），先断言入口本身
    if (!await waitFor('!!document.querySelector("[data-testid=toolbar-customize]")')) throw new Error('工具栏没有「添加或删除按钮」入口')

    results['工具栏提供「添加或删除按钮」入口'] = await evaluate('document.querySelector("[data-testid=toolbar-customize]").getAttribute("title")') === '添加或删除按钮：用于添加或删除工具栏按钮，也可自定义按键及布局'

    // 打开一个文档，确认编辑态工具栏同样有该入口
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return e.defaultPrevented })()`)
    await key('n', { ctrlKey: true }); await sleep(400)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { await click('[data-testid=wizard-next]'); await sleep(400) }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')
    await sleep(400)
    results['编辑态工具栏同样有该入口'] = await evaluate('!!document.querySelector("[data-testid=toolbar-customize]")')

    // ① 下拉结构与原版一致（真机 91-toolbar-customize-submenu.png）：
    //    第一级「添加或删除按钮(A)」自带二级子菜单「标准 ▸」+「自定义...」
    await click('[data-testid=toolbar-customize]')
    if (!await waitFor('!!document.querySelector("[data-testid=toolbar-customize-menu]")')) throw new Error('下拉未打开')
    results['第一级只有「添加或删除按钮(A)」且带子菜单'] = await evaluate(`(() => {
      const root=document.querySelector('[data-testid=toolbar-customize-root]')
      return !!root && (root.textContent||'').indexOf('添加或删除按钮(A)')>=0 && root.getAttribute('aria-haspopup')==='menu'
    })()`)
    await click('[data-testid=toolbar-customize-root]')
    if (!await waitFor('!!document.querySelector("[data-testid=toolbar-customize-submenu]")')) throw new Error('二级子菜单未打开')
    results['二级子菜单为「标准」+「自定义...」'] = await evaluate(`(() => {
      const sub=document.querySelector('[data-testid=toolbar-customize-submenu]')
      const std=document.querySelector('[data-testid=toolbar-customize-standard]')
      const adv=document.querySelector('[data-testid=toolbar-customize-advanced]')
      return !!sub && !!std && !!adv && (std.textContent||'').trim().indexOf('标准')===0 && (adv.textContent||'').trim()==='自定义...'
    })()`)
    results['「自定义...」是独立入口（对应帮助「自定义按键及布局」）'] = await evaluate("document.querySelector('[data-testid=toolbar-customize-advanced]').getAttribute('role')==='menuitem'")
    await click('[data-testid=toolbar-customize-standard]')
    if (!await waitFor('!!document.querySelector("[data-testid=toolbar-customize-groups]")')) throw new Error('三级分组清单未打开')
    results['下拉列出帮助原文的 8 个按钮组'] = await evaluate(`(() => {
      const want=['文件操作','复制、粘贴','撤消、重做','打印','对象','数据库','显示','帮助']
      const got=[...document.querySelectorAll('[data-testid^=toolbar-group-]')].map((r)=>(r.textContent||'').trim())
      return JSON.stringify(got)===JSON.stringify(want)
    })()`)
    results['下拉默认全部勾选'] = await evaluate('[...document.querySelectorAll("[data-testid^=toolbar-group-] input")].every((b)=>b.checked)')

    // ② 取消「显示」组 → 放大/缩小/适应宽度/适应高度/撑满窗口 全部消失，其余组仍在
    results['取消勾选「显示」组生效'] = (await toggleGroup('显示', false)) === 'clicked' && await waitFor(`!(${hasTitle('放大')})`)
    results['「显示」组隐藏后其余按钮不受影响'] = await evaluate(`(${hasTitle('新建标签模版')}) && (${hasTitle('打印')}) && (${hasTitle('帮助主题')})`)

    // ③ 取消「对象」组 → 条码/文字等对象工具消失
    results['取消勾选「对象」组生效'] = (await toggleGroup('对象', false)) === 'clicked' && await waitFor('!document.querySelector("[data-testid=toolbar] [data-tool=barcode]")')

    // ④ 取消「数据库」组 → 七键消失
    results['取消勾选「数据库」组生效'] = (await toggleGroup('数据库', false)) === 'clicked' && await waitFor(`!(${hasTitle('设置数据库')})`)

    // ⑤ 下拉入口本身不随分组隐藏（否则再也调不回来）
    results['入口不随分组隐藏'] = await evaluate('!!document.querySelector("[data-testid=toolbar-customize]")')

    // ⑥ 持久化：重新加载渲染进程（等价于重启应用，同一个 user-data-dir 的 localStorage 被保留）
    const storedBefore = await evaluate('JSON.parse(localStorage.getItem("maxlabel.options")||"{}").toolbarGroups')
    results['勾选结果写入系统选项'] = Boolean(storedBefore) && storedBefore.view === false && storedBefore.object === false && storedBefore.database === false && storedBefore.file === true

    await client.send('Page.enable')
    await client.send('Page.reload', { ignoreCache: false })
    await sleep(2600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    if (!await waitFor('!!document.querySelector("[data-testid=toolbar]")')) throw new Error('重载后工具栏未出现')
    results['重载后隐藏仍然生效（持久化）'] = await evaluate(`!(${hasTitle('放大')}) && !document.querySelector("[data-testid=toolbar] [data-tool=barcode]") && !(${hasTitle('设置数据库')})`)
    results['重载后未取消的组仍显示'] = await evaluate(`(${hasTitle('新建标签模版')}) && (${hasTitle('打开标签模版')}) && (${hasTitle('帮助主题')}) && (${hasTitle('标签格式设置')})`)

    // ⑦ 重新勾选后按钮回来，且写回系统选项
    if (!await openGroupMenu()) throw new Error('重载后下拉未打开')
    await toggleGroup('显示', true)
    await toggleGroup('对象', true)
    await toggleGroup('数据库', true)
    results['重新勾选后按钮恢复'] = await waitFor(`(${hasTitle('放大')}) && (${hasTitle('设置数据库')})`) && await evaluate('!!document.querySelector("[data-testid=toolbar] [data-tool=barcode]")')
    results['重新勾选写回系统选项'] = await evaluate(`(() => { const t=JSON.parse(localStorage.getItem("maxlabel.options")||"{}").toolbarGroups||{}; return t.view===true&&t.object===true&&t.database===true })()`)

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
