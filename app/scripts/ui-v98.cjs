/* A-171~A-176 主界面元素 1~12（帮助 interface_interface.html / interface_main.html）。
 * 依据原文：
 *   1 程序标题栏显示程序版本、登录状态等信息
 *   2 主菜单为菜单命令项目
 *   3 主工具栏为文件、对象、数据库等操作工具
 *   4 格式工具栏为文字、停靠等工具
 *   5 对齐工具栏为对象的对齐操作和位置、尺寸、旋转工具
 *   6 窗口标题栏显示和切换标签模板文档
 *   7 水平标尺用于对象的尺寸和位置参考
 *   8 版面旋转方向指示图标指示标签模板版面的旋转方向，单击可以旋转版面
 *   9 垂直标尺用于对象的尺寸和位置参考
 *  10 模板编辑区在此区域内完成模板对象的编辑，此区域也是标签被打印出来的区域
 *  11 状态栏显示程序的状态信息
 *  12 快捷打印区（打印面板：链接数据库、输入数据或电子秤接口）
 * 原版标题栏原文见 parity/reference/labelshop/00-main.png / 40-editor.png。 */
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
    const exists = (selector) => evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e || e.disabled)return false; e.click(); return true })()`)
    const menuLabels = () => evaluate(`[...document.querySelectorAll('[data-menu-item]')].filter((e)=>e.offsetParent).map((e)=>e.getAttribute('data-menu-item'))`)
    const openMenu = async (title) => {
      await evaluate(`(() => { const b=document.querySelector('[data-menu-title=${JSON.stringify(title)}]'); if(!b) return false; if(!b.parentElement.querySelector('[data-menu-item],[data-menu-divider]')) b.click(); return true })()`)
      await sleep(180)
      return menuLabels()
    }
    const closeMenu = async (title) => {
      await evaluate(`(() => { const b=document.querySelector('[data-menu-title=${JSON.stringify(title)}]'); if(b && b.parentElement.querySelector('[data-menu-item]')) b.click(); return true })()`)
      await sleep(150)
    }
    const pressEscape = () => evaluate(`(() => { const e=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}); window.dispatchEvent(e); document.dispatchEvent(e); return true })()`)
    const tabTitles = () => evaluate(`[...document.querySelectorAll('[data-testid=document-tab]')].map((e)=>e.innerText.trim())`)
    const statusSegments = () => evaluate(`(() => { const bar=document.querySelector('[data-testid=status-bar]'); if(!bar) return null; const names=['status-printer','status-label-spec','status-database','status-cursor','status-object-info','status-zoom']; return names.map((n)=>{ const el=bar.querySelector('[data-testid='+n+']'); return el? el.getAttribute('title')||el.innerText.trim() : null }) })()`)

    await sleep(2000)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate(`(() => { localStorage.setItem('maxlabel.firstRun','1'); return true })()`)

    // ============ 元素 1 程序标题栏 ============
    const titleAtStart = await evaluate('document.title')
    results['A-174 元素1 程序标题栏含产品名与版本号'] = /^MaxLabel .*V\d+\.\d+\.\d+/.test(titleAtStart)
    results['A-174 元素1 程序标题栏含激活状态分段（原始为「版本 - 激活状态」）'] = /\[(已|未)激活\]/.test(titleAtStart)
    results['A-174 元素1 程序标题栏含登录状态分段'] = /\((请登录 LabelShop|[^)]+@[^)]+)\)/.test(titleAtStart)
    results['A-174 元素1 起始页时标题末段为「起始页」'] = titleAtStart.endsWith(' - 起始页')
    results['A-174 元素1 标题分段顺序与真机一致：产品名 [激活] V版本 (登录) - 文档'] =
      /^\S+ \[[^\]]+\] V[0-9.]+ \([^)]+\) - .+$/.test(titleAtStart)

    // ============ 元素 2 主菜单 ============
    const fileMenu = await openMenu('文件(F)')
    results['A-174 元素2 主菜单存在且含菜单命令项目'] = Array.isArray(fileMenu) && fileMenu.length > 0
    await closeMenu('文件(F)')

    // ============ 元素 3/4/5 三条工具栏 ============
    results['A-174 元素3 主工具栏存在且含文件/对象/数据库操作工具'] =
      (await exists('[data-testid=toolbar]')) &&
      (await exists('[data-testid=toolbar] [title="新建标签模版"]')) &&
      (await exists('[data-testid=toolbar] [title="选择工具：条码"]')) &&
      (await exists('[data-testid=toolbar] [title="设置数据库"]'))
    results['A-174 元素4 格式工具栏存在'] = await exists('[data-testid=format-bar]')
    results['A-174 元素5 对齐工具栏存在'] = await exists('[data-testid=align-bar]')
    // 三条工具栏由「查看」菜单控制显隐，勾选项与真机 52-editor-menu-view.png 一致
    const viewMenu = await openMenu('查看(V)')
    results['A-174 元素3~5 查看菜单含三条工具栏勾选项'] =
      viewMenu.includes('工具栏(T)') && viewMenu.includes('格式栏(F)') && viewMenu.includes('对齐栏(A)')
    await closeMenu('查看(V)')

    // ============ 元素 12 快捷打印区（起始页无文档时不出现） ============
    results['A-174 元素12 起始页无文档时快捷打印区不出现'] = !(await exists('[data-testid=print-dock]'))

    // ============ 新建模板后进入编辑器，核对 6~12 ============
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true, cancelable: true }))`)
    await sleep(500)
    results['A-174 新建标签模板先出模板向导'] = await waitFor('!!document.querySelector("[data-testid=template-wizard]")')
    await evaluate(`document.querySelector('[data-testid="wizard-next"]')?.click()`)
    await sleep(500)
    await waitFor('!!document.querySelector("[data-testid=new-label-select]")')
    await evaluate(`document.querySelector('[data-testid="new-label-select"]')?.click()`)
    await sleep(800)
    const editorReady = await waitFor('!!document.querySelector("[data-testid=template-edit-area]")', 6000)
    results['A-174 选择标签格式后进入编辑器（模板编辑区出现）'] = editorReady

    // 元素 6 窗口标题栏（页签）显示和切换标签模板文档
    const tabs = await tabTitles()
    results['A-176 元素6 窗口标题栏显示「起始页」与当前模板两个页签'] =
      tabs.length >= 2 && tabs[0].includes('起始页') && tabs[1].length > 0
    const editAreaSize = () => evaluate(`(() => { const el=document.querySelector('[data-testid=template-edit-area]'); return el ? el.getAttribute('data-width-mm')+'x'+el.getAttribute('data-height-mm') : null })()`)
    const labelSpecMm = () => evaluate(`(() => { const el=document.querySelector('[data-testid=status-label-spec]'); const m=(el? el.innerText : '').match(/([0-9.]+) *mm *x *([0-9.]+) *mm/); return m ? m[1]+'x'+m[2] : null })()`)
    const beforeSwitch = await editAreaSize()
    const specBefore = await labelSpecMm()
    await evaluate(`(() => { const t=[...document.querySelectorAll('[data-testid=document-tab]')][0]; if(t) t.click(); return true })()`)
    await sleep(500)
    const startShown = await evaluate(`document.body.innerText.includes('新建标签模板') || !!document.querySelector('[data-testid=start-page]') || !document.querySelector('[data-testid=template-edit-area]')`)
    results['A-176 元素6 点击页签可切换文档'] = startShown
    await evaluate(`(() => { const t=[...document.querySelectorAll('[data-testid=document-tab]')][1]; if(t) t.click(); return true })()`)
    await sleep(500)
    results['A-176 元素6 切回模板页签恢复编辑区'] = await waitFor('!!document.querySelector("[data-testid=template-edit-area]")')
    const afterSwitch = await editAreaSize()
    // 模板编辑区「也是标签被打印出来的区域」，故其尺寸须等于当前标签格式尺寸；
    // 对照状态栏「标签格式」段（同一文档的规格文本）做交叉核对。
    const specAfter = await labelSpecMm()
    results['A-176 元素10 模板编辑区尺寸等于标签尺寸（与状态栏标签格式段一致）'] =
      /^\d+(\.\d+)?x\d+(\.\d+)?$/.test(String(beforeSwitch)) && String(beforeSwitch) === specBefore
    results['A-176 元素10 切回模板页签后编辑区尺寸仍等于该文档标签格式尺寸'] =
      Boolean(afterSwitch) && afterSwitch === specAfter

    // 元素 7/9 水平/垂直标尺
    results['A-175 元素7 水平标尺存在'] = await exists('[data-testid=ruler-x]')
    results['A-175 元素9 垂直标尺存在'] = await exists('[data-testid=ruler-y]')
    results['A-175 元素7/9 标尺刻度以毫米标注（用于尺寸和位置参考）'] =
      (await evaluate(`(document.querySelector('[data-testid=ruler-x]')||{}).innerText || ''`)).includes('10')

    // 元素 8 版面旋转方向指示图标：指示版面旋转方向，单击可以旋转版面
    const rotationOf = () => evaluate(`(document.querySelector('[data-testid=label-rotation-indicator]')||{}).dataset?.rotation`)
    const r0 = await rotationOf()
    await click('[data-testid=label-rotation-indicator]')
    await sleep(300)
    const r1 = await rotationOf()
    await click('[data-testid=label-rotation-indicator]')
    await sleep(300)
    const r2 = await rotationOf()
    results['A-175 元素8 版面旋转方向指示图标存在'] = r0 !== undefined && r0 !== null
    results['A-175 元素8 单击指示图标旋转版面（每次 90 度）'] =
      Number(r1) === (Number(r0) + 90) % 360 && Number(r2) === (Number(r0) + 180) % 360

    // 元素 11 状态栏
    const segs = await statusSegments()
    results['A-176 元素11 状态栏存在'] = await exists('[data-testid=status-bar]')
    results['A-176 元素11 状态栏六段顺序：打印机|标签格式|数据库|鼠标位置|对象信息|显示比例'] =
      Array.isArray(segs) && segs.every((s) => typeof s === 'string' && s.length > 0) &&
      segs[0] === '打印机' && segs[3].includes('鼠标位置') && segs[4] === '对象信息'

    // 元素 12 快捷打印区：编辑器内出现（链接数据库、输入数据或电子秤接口）
    const viewItems = await openMenu('查看(V)')
    results['A-176 元素12 查看菜单含快捷打印区（打印窗体）显隐项'] = viewItems.includes('显示打印窗体(P)')
    if (!(await exists('[data-testid=print-dock]'))) {
      await click('[data-menu-item="显示打印窗体(P)"]')
      await sleep(300)
    } else {
      await closeMenu('查看(V)')
    }
    results['A-176 元素12 快捷打印区含打印机/打印数量/单签拷贝/打印入口'] =
      (await exists('[data-testid=print-dock]')) &&
      (await exists('[data-testid=print-input-data]')) &&
      (await exists('[data-testid=print-count]')) &&
      (await exists('[data-testid=print-copies]')) &&
      (await exists('[data-testid=print-submit]'))

    // ============ 标题栏随当前文档变化 ============
    const titleInEditor = await evaluate('document.title')
    results['A-174 元素1 打开模板后标题末段为当前模板名'] =
      !titleInEditor.endsWith(' - 起始页') && / - \S+$/.test(titleInEditor)

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
