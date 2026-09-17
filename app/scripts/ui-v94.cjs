/* A1 主工具栏收尾（A-81/A-82/A-83/A-86）+ 数据库导航七键点击行为（A-107～A-114）。
   依据 toolbar_mainbar.html / menu_main.html；数据库记录指针行为依据 database_print.html。 */
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
    const waitFor = async (expression, timeout = 5000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const click = (selector) => evaluate(`(() => {
      const e=document.querySelector(${JSON.stringify(selector)})
      if(!e || e.disabled || !e.offsetParent)return false
      e.click(); return true
    })()`)
    const closeModal = async () => {
      await evaluate(`(() => { const b=[...document.querySelectorAll('button[aria-label="关闭"]')].filter((e)=>e.offsetParent); b.at(-1)?.click(); return true })()`)
      await sleep(250)
    }
    const tb = (title) => `[data-testid="toolbar"] button[title="${title}"]`
    const clickTb = (title) => click(tb(title))
    const tbDisabled = (title) => evaluate(`document.querySelector('${tb(title)}')?.disabled`)
    const openMenu = async (title) => { const opened = await click(`[data-menu-title="${title}"]`); await sleep(120); return opened }
    const closeMenu = () => evaluate('document.body.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,clientX:2,clientY:2}))')
    const dbStatus = () => evaluate(`document.querySelector('[data-testid=status-database]')?.textContent.trim() || ''`)
    const statusText = () => evaluate(`document.querySelector('[data-testid=status-bar]')?.title || ''`)

    await sleep(1800)
    await closeModal()

    // ---- A-82 工具栏构成：主工具栏 / 格式栏 / 对齐栏 / 状态栏（toolbar_main.html） ----
    // 先进入编辑器（起始页只有主工具栏）。
    await clickTb('新建标签模版')
    if (await waitFor('!!document.querySelector("[data-testid=template-wizard]")', 1500)) {
      await click('[data-testid="wizard-next"]')
      await sleep(300)
    }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')
    results['A-82 工具栏四部分（主工具栏/格式栏/对齐栏/状态栏）同时存在'] = await evaluate(`!!document.querySelector('[data-testid=toolbar]') && !!document.querySelector('[data-testid=format-bar]') && !!document.querySelector('[data-testid=align-bar]') && !!document.querySelector('[data-testid=status-bar]')`)

    // ---- A-81 菜单入口：11 个顶级菜单均可点开且含菜单项；右键上下文菜单可达（menu_main.html） ----
    const MENUS = ['文件(F)', '编辑(E)', '查看(V)', '工具(T)', '排列(A)', '数据库(D)', '账户(A)', '云马通(C)', '选项(O)', '窗口(W)', '帮助(H)']
    results['A-81 菜单快捷键入口可点开且每个菜单含菜单项'] = await evaluate(`(async () => {
      const wanted=${JSON.stringify(MENUS)}
      for (const title of wanted) {
        const head=document.querySelector('[data-menu-title="'+title+'"]')
        if(!head) return false
        head.click()
        await new Promise((r)=>setTimeout(r,60))
        const items=[...document.querySelectorAll('[data-menu-item]')].filter((e)=>e.offsetParent)
        if(items.length===0) return false
        document.body.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:2,clientY:2}))
        await new Promise((r)=>setTimeout(r,40))
      }
      return true
    })()`)
    // 右键上下文菜单与菜单栏共用同一套命令回调（menu_context.html）。
    results['A-81 画布右键上下文菜单可打开'] = await evaluate(`(() => {
      const c=document.querySelector('canvas.upper-canvas')||document.querySelector('canvas'); if(!c)return false
      const b=c.getBoundingClientRect()
      c.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,view:window,clientX:b.left+b.width/2,clientY:b.top+b.height/2,button:2,buttons:2}))
      return true
    })()`) && await waitFor(`[...document.querySelectorAll('[data-menu-item]')].some((e)=>e.offsetParent && e.getAttribute('data-menu-item')==='属性')`)
    await closeMenu()
    await sleep(150)

    // ---- A-83 文件与剪贴板按钮组：九个按钮按帮助顺序排布（各按钮点击行为见 ui-v93.cjs 的 A-84/A-87～A-92） ----
    const FILE_CLIP_TITLES = ['新建标签模版', '打开标签模版', '保存', '剪切', '复制', '粘贴', '删除', '撤销', '恢复']
    results['A-83 文件与剪贴板按钮组九个按钮按帮助顺序排布'] = await evaluate(`(() => {
      const wanted=${JSON.stringify(FILE_CLIP_TITLES)}
      const titles=[...document.querySelectorAll('[data-testid=toolbar] button[title]')].map((e)=>e.title)
      const indexes=wanted.map((t)=>titles.indexOf(t))
      return indexes.every((i)=>i>-1) && indexes.every((v,i)=>i===0||v>indexes[i-1])
    })()`)

    // ---- A-86 保存：已带路径的文档点「保存」直接写回，不弹保存对话框 ----
    const fixture = { version: 1, name: 'ui-v94-save', widthMm: 42, heightMm: 24, objects: [] }
    const lib = await evaluate(`window.maxlabel.saveTemplateToLib('ui-v94-save', ${JSON.stringify(JSON.stringify(fixture))})`)
    if (!lib?.ok || !lib.path) throw new Error('could not create save fixture')
    await evaluate(`localStorage.setItem('maxlabel.recent', JSON.stringify([{title:'ui-v94-save',path:${JSON.stringify(lib.path)},state:0}])); location.reload()`)
    await sleep(1400)
    await closeModal()
    await click('[data-testid="start-recent-list"] a')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('recent fixture did not open')
    await sleep(400)
    // 加一个对象令文档变脏。
    await click('[data-tool="text"]')
    await sleep(150)
    await evaluate(`(() => {
      const c=document.querySelector('canvas.upper-canvas'); const r=c?.getBoundingClientRect(); if(!c||!r)return false
      const p={bubbles:true,cancelable:true,view:window,clientX:r.left+r.width*.3,clientY:r.top+r.height*.3,button:0,buttons:1}
      c.dispatchEvent(new MouseEvent('mousedown',p)); c.dispatchEvent(new MouseEvent('mouseup',{...p,buttons:0})); return true
    })()`)
    await sleep(450)
    const dirtyBefore = await evaluate(`(document.querySelector('[data-testid="document-tab"][data-active="true"]')?.getAttribute('data-document-title')||'').endsWith(' *')`)
    const savedClick = await clickTb('保存')
    await waitFor(`!document.querySelector('[data-testid="document-tab"][data-active="true"]')?.getAttribute('data-document-title')?.endsWith(' *')`, 4000)
    // 保存产物是 msdx 信封：{format, version, app, doc}。
    const writtenObjects = await evaluate(`(async()=>{ const r=await window.maxlabel.openTemplatePath(${JSON.stringify(lib.path)}); if(!r?.ok)return -1; try{ const j=JSON.parse(r.content); return (j.doc??j).objects?.length ?? -2 }catch{ return -3 } })()`)
    const savedStatus = await statusText()
    results['A-86 保存按钮把当前模板写回已打开文件'] = Boolean(savedClick) && dirtyBefore === true && writtenObjects === 1 && savedStatus.startsWith('已保存：') && (await evaluate(`document.querySelector('[data-testid="document-tab"][data-active="true"]')?.getAttribute('data-document-title')||''`)).indexOf(' *') === -1

    // ---- A-107～A-114 数据库导航七键（database_print.html / toolbar_mainbar.html） ----
    // 未连库时七键禁用已由 ui-v74.cjs 断言；这里先导入三行数据集，再逐键点击。
    const sevenDisabledBefore = await evaluate(`(async () => {
      const titles=['设置数据库','定位记录','更新数据库','第一条记录','上一条记录','下一条记录','最后一条记录']
      return titles.every((t)=>document.querySelector('[data-testid="toolbar"] button[title="'+t+'"]')?.disabled===true)
    })()`)
    await evaluate(`(() => { const e=[...document.querySelectorAll('button')].find((x)=>x.offsetParent && (x.textContent||'').trim()==='管理'); e?.click(); return !!e })()`)
    if (!await waitFor('!!document.querySelector("input[accept*=\\".csv\\"]")', 4000)) throw new Error('database panel did not open')
    await evaluate(`(() => {
      const input=document.querySelector('input[accept*=".csv"]')
      const file=new File(['\\uFEFF名称,数量,备注\\n甲产品,10,第一批\\n乙产品,20,第二批\\n丙产品,30,第三批\\n'],'ui-v94.csv',{type:'text/csv'})
      const transfer=new DataTransfer(); transfer.items.add(file); input.files=transfer.files
      input.dispatchEvent(new Event('change',{bubbles:true})); return true
    })()`)
    await sleep(1500)
    await closeModal()

    const sevenEnabledAfter = await evaluate(`(async () => {
      const titles=['设置数据库','定位记录','更新数据库','第一条记录','上一条记录','下一条记录','最后一条记录']
      return titles.every((t)=>document.querySelector('[data-testid="toolbar"] button[title="'+t+'"]')?.disabled===false)
    })()`)
    const statusAfterImport = await dbStatus()
    results['A-107 导入三行数据集后数据库导航七键由禁用转为可用'] = sevenDisabledBefore === true && sevenEnabledAfter === true && statusAfterImport.includes('1/3（1）')

    // A-108 设置数据库：再次打开数据管理对话框。
    results['A-108 设置数据库按钮打开数据管理对话框'] = await clickTb('设置数据库') && await waitFor('!!document.querySelector("input[accept*=\\".csv\\"]")')
    await closeModal()

    // A-110 更新数据库：重新读取数据集并给出状态反馈。
    const refreshClicked = await clickTb('更新数据库')
    await sleep(500)
    const refreshStatus = await statusText()
    results['A-110 更新数据库按钮重新读取数据集并反馈状态'] = refreshClicked && refreshStatus.includes('数据库') && Boolean(await evaluate(`document.querySelector('[data-testid=status-database]')?.textContent.includes('/3')`))

    // A-113 下一条记录 → A-114 最后一条记录 → A-112 上一条记录 → A-111 第一条记录，边界处夹紧。
    const nextOk = await clickTb('下一条记录') && await sleep(320).then(async () => (await dbStatus()).includes('2/3'))
    const lastOk = await clickTb('最后一条记录') && await sleep(320).then(async () => (await dbStatus()).includes('3/3'))
    const clampOk = await clickTb('下一条记录') && await sleep(320).then(async () => (await dbStatus()).includes('3/3'))
    const prevOk = await clickTb('上一条记录') && await sleep(320).then(async () => (await dbStatus()).includes('2/3'))
    const firstOk = await clickTb('第一条记录') && await sleep(320).then(async () => (await dbStatus()).includes('1/3'))
    const prevClamp = await clickTb('上一条记录') && await sleep(320).then(async () => (await dbStatus()).includes('1/3'))
    results['A-113 下一条记录按钮把记录指针推进一条'] = nextOk
    results['A-114 最后一条记录按钮跳到末条记录'] = lastOk
    results['A-112 上一条记录按钮把记录指针回退一条'] = prevOk
    results['A-111 第一条记录按钮跳到首条记录'] = firstOk
    results['A-107 记录指针在首尾边界夹紧不越界'] = clampOk && prevClamp

    // A-109 定位记录：打开定位记录对话框，按记录号定位并改变指针。
    const locateOpened = await clickTb('定位记录') && await waitFor('!!document.querySelector("[data-testid=locate-record-number]")')
    await evaluate(`(() => {
      const e=document.querySelector('[data-testid=locate-record-number]'); if(!e)return false
      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set
      setter.call(e,'3'); e.dispatchEvent(new Event('input',{bubbles:true})); return true
    })()`)
    await click('[data-testid="locate-submit"]')
    await sleep(500)
    const locatedStatus = await dbStatus()
    results['A-109 定位记录按钮按记录号定位后指针落到指定记录'] = locateOpened && locatedStatus.includes('3/3')
    await closeModal()

    let pass = 0
    for (const [name, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value); if (value) pass++ }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    client.ws.close()
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
