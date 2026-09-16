/* A-44/A-49/A-50/A-269：查看菜单逐项、退出确认流程、起始页最近文件回归。 */
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

/**
 * 板面实际渲染出的旋转矩阵的 sin 分量。CSS `rotate(θ)` 编译成
 * `matrix(cosθ, sinθ, -sinθ, cosθ, …)`，因此第二位 b = sinθ：
 * b < 0 说明板面在屏幕上**逆时针**（左旋），b > 0 说明**顺时针**（右旋）。
 * 只断言存储的角度值证明不了方向，必须看真正画出来的矩阵。
 */
const BOARD_SIN_JS = `(() => {
  const el = document.querySelector('[data-testid=label-board-rotator]')
  if (!el) return NaN
  const nums = (getComputedStyle(el).transform.match(/matrix\\(([^)]+)\\)/) || [])[1]
  return nums ? Number(nums.split(',')[1]) : NaN
})()`

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
    const waitFor = async (expression, timeout = 4000) => {
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
    const menuOpen = (title) => click(`[data-menu-title="${title}"]`)
    const itemClick = (label) => evaluate(`(() => {
      const wanted=${JSON.stringify(label)}
      const e=[...document.querySelectorAll('[data-menu-item]')].find((c)=>c.offsetParent && c.getAttribute('data-menu-item')===wanted)
      if(!e || e.getAttribute('data-menu-disabled')==='true')return false
      e.click(); return true
    })()`)
    const itemLabels = () => evaluate(`[...document.querySelectorAll('[data-menu-item]')].filter((e)=>e.offsetParent).map((e)=>e.getAttribute('data-menu-item'))`)
    const zoomValue = () => evaluate('Number(document.querySelector("[data-testid=zoom-level]")?.value)')
    const zoomMode = () => evaluate('document.querySelector("[data-testid=zoom-control]")?.getAttribute("data-zoom-mode")')
    const closeMenu = () => evaluate(`(() => { document.body.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); return true })()`)
    // React 的 onMouseEnter 走 mouseover/mouseout 委托，合成 'mouseenter' 事件不触发；
    // 子菜单展开需要真实指针移动，用 CDP Input 域发鼠标事件。
    const hover = async (label) => {
      const box = await evaluate(`(() => {
        const e=[...document.querySelectorAll('[data-menu-item]')].find((c)=>c.offsetParent && c.getAttribute('data-menu-item')===${JSON.stringify(label)})
        if(!e)return null
        const r=e.getBoundingClientRect()
        return { x: r.left + r.width/2, y: r.top + r.height/2 }
      })()`)
      if (!box) return false
      await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y, button: 'none' })
      await sleep(200)
      return true
    }
    const openRotationMenu = async () => {
      await menuOpen('查看(V)')
      await hover('标签旋转')
    }

    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await sleep(200)

    // 打开一个文档（跳过模板向导），查看菜单的缩放/旋转项才有可作用对象。
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(300)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) await click('[data-testid=wizard-next]')
    await sleep(300)
    // 向导第二步：选择标签格式对话框确认后进入编辑器。
    if (!await waitFor('!!document.querySelector("[data-testid=new-label-select]")', 5000)) throw new Error('label chooser did not open')
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("[data-testid=workspace-viewport]")', 8000)) throw new Error('editor did not open')
    await sleep(300)

    // ---- A-49 查看菜单项与顺序照抄 menu_view.html ----
    await menuOpen('查看(V)')
    const viewItems = await itemLabels() || []
    const expectedPrefix = ['工具栏(T)', '格式栏(F)', '对齐栏(A)', '状态栏(S)', '显示启始页(M)', '显示打印窗体(P)', '打印历史记录']
    results['A-49 查看菜单前七项与帮助顺序一致'] = JSON.stringify(viewItems.slice(0, 7)) === JSON.stringify(expectedPrefix)
    results['A-49 查看菜单不含原版没有的显示图层窗体'] = !viewItems.includes('显示图层窗体')
    results['A-49 显示对象信息位于打印历史记录之后且带 Ctrl+R'] = viewItems.indexOf('显示对象信息(R)') > viewItems.indexOf('打印历史记录') &&
      await evaluate(`document.querySelector('[data-menu-item="显示对象信息(R)"]')?.getAttribute('data-menu-shortcut')==='Ctrl+R'`)
    // 勾选类项的切换：显示打印窗体开关一次后勾选态翻转（原版「是否显示快捷打印区」）。
    const printPanelBefore = await evaluate(`document.querySelector('[data-menu-item="显示打印窗体(P)"]')?.getAttribute('data-menu-checked')`)
    await itemClick('显示打印窗体(P)')
    await sleep(150)
    await menuOpen('查看(V)')
    const printPanelAfter = await evaluate(`document.querySelector('[data-menu-item="显示打印窗体(P)"]')?.getAttribute('data-menu-checked')`)
    results['A-49 显示打印窗体可切换快捷打印区'] = printPanelBefore !== null && printPanelAfter !== null && printPanelBefore !== printPanelAfter
    await closeMenu()
    await sleep(150)

    // ---- A-50 查看菜单的缩放与适应 ----
    const zoomBefore = await zoomValue()
    await menuOpen('查看(V)')
    results['A-50 查看菜单放大改变显示比例'] = await itemClick('放大(I)') && await waitFor(`Number(document.querySelector("[data-testid=zoom-level]")?.value) > ${zoomBefore}`)
    const zoomMid = await zoomValue()
    await menuOpen('查看(V)')
    results['A-50 查看菜单缩小改变显示比例'] = await itemClick('缩小(O)') && await waitFor(`Number(document.querySelector("[data-testid=zoom-level]")?.value) < ${zoomMid}`)
    await menuOpen('查看(V)')
    results['A-50 查看菜单适应宽度进入宽度适应模式'] = await itemClick('适应宽度') && await waitFor(`document.querySelector("[data-testid=zoom-control]")?.getAttribute("data-zoom-mode")==="w"`)
    await menuOpen('查看(V)')
    results['A-50 查看菜单适应高度进入高度适应模式'] = await itemClick('适应高度') && await waitFor(`document.querySelector("[data-testid=zoom-control]")?.getAttribute("data-zoom-mode")==="h"`)
    await menuOpen('查看(V)')
    results['A-50 查看菜单撑满窗口进入窗口适应模式'] = await itemClick('撑满窗口(W)') && await waitFor(`document.querySelector("[data-testid=zoom-control]")?.getAttribute("data-zoom-mode")==="win"`)

    // 标签旋转子菜单：展开后四项齐全，点击后标签板面实际旋转。
    await openRotationMenu()
    const rotationLabels = await evaluate(`[...document.querySelectorAll('[data-menu-item]')].filter((e)=>e.offsetParent).map((e)=>e.getAttribute('data-menu-item')).filter((v)=>['正常显示','左旋90度','右旋90度','旋转180度'].includes(v))`)
    results['A-50 标签旋转含正常显示/左旋90度/右旋90度/旋转180度'] = JSON.stringify(rotationLabels) === JSON.stringify(['正常显示', '左旋90度', '右旋90度', '旋转180度'])
    // 帮助 menu_view.html：「左旋90度 向左旋转90度显示标签板面」＝屏幕上逆时针；
    // 板面用 CSS rotate(Ndeg)（正角度＝顺时针）渲染，故左旋写入 270、右旋写入 90。
    results['A-50 左旋90度改变标签板面角度'] = await itemClick('左旋90度') &&
      await waitFor('document.querySelector("[data-testid=label-rotation-indicator]")?.getAttribute("data-rotation")==="270"')
    results['A-50 左旋90度板面逆时针渲染'] = await waitFor(BOARD_SIN_JS + ' < -0.5')
    await openRotationMenu()
    results['A-50 右旋90度改变标签板面角度'] = await itemClick('右旋90度') &&
      await waitFor('document.querySelector("[data-testid=label-rotation-indicator]")?.getAttribute("data-rotation")==="90"')
    results['A-50 右旋90度板面顺时针渲染'] = await waitFor(BOARD_SIN_JS + ' > 0.5')
    await openRotationMenu()
    results['A-50 旋转180度改变标签板面角度'] = await itemClick('旋转180度') &&
      await waitFor('document.querySelector("[data-testid=label-rotation-indicator]")?.getAttribute("data-rotation")==="180"')
    await openRotationMenu()
    await itemClick('正常显示')
    await sleep(150)

    // A-44「退出」的确认流程走原生 dialog.showMessageBox（保存/不保存/取消），
    // 该窗口在 CDP 页面上下文之外且 contextBridge 的 window.maxlabel 不可重定义，
    // 无法在冒烟脚本里驱动；此处只断言入口本身。
    results['A-44 文件菜单提供退出入口且未禁用'] = await menuOpen('文件(F)') &&
      await evaluate(`document.querySelector('[data-menu-item="退出(X)"]')?.getAttribute('data-menu-disabled')==='false'`)
    await closeMenu()
    await sleep(120)

    // ---- A-269 起始页最近文件 ----
    const fixture = JSON.stringify({ version: 1, name: 'ui-v91-recent', widthMm: 60, heightMm: 40, objects: [] })
    const saved = await evaluate(`window.maxlabel.saveTemplateToLib('ui-v91-recent', ${JSON.stringify(fixture)})`)
    if (!saved?.ok) throw new Error('fixture save failed')
    await evaluate(`localStorage.setItem('maxlabel.recent', JSON.stringify([{title:'ui-v91-recent',path:${JSON.stringify(saved.path)},state:0}])); location.reload()`)
    await sleep(1500)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await sleep(200)
    results['A-269 起始页最近列表显示真实最近文件标题'] = await waitFor(`document.querySelector('[data-testid="start-recent-list"] a')?.textContent.trim()==='ui-v91-recent'`)
    results['A-269 点击最近文件可打开对应模板'] = await click('[data-testid="start-recent-list"] a') &&
      await waitFor('!!document.querySelector("canvas.upper-canvas")', 5000)

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
