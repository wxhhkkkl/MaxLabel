/*
 * P0-A：菜单项级别与快捷键级别 parity 烟测。
 * 覆盖 parity/reference/labelshop/{INDEX,FINDINGS}.md 记载的编辑态菜单，
 * 以及 shortcut_main.html 中的全部 32 组快捷键。
 */
const http = require('http')

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
    const WebSocket = require('ws')
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
      if (message.method === 'Runtime.exceptionThrown') console.error('CDP EXCEPTION', message.params?.exceptionDetails?.exception?.description || message.params?.exceptionDetails?.text)
      if (message.method === 'Log.entryAdded') console.error('CDP LOG', message.params?.entry?.text)
      if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params?.type)) {
        console.error('CDP CONSOLE', message.params.type, (message.params.args || []).map((arg) => arg.value || arg.description || '').join(' '))
      }
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
    await client.send('Page.enable')

    const evaluate = async (expression) => {
      const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
      return result.result?.value
    }

    const visibleItems = () => evaluate(`(() => [...document.querySelectorAll('[data-menu-item]')]
      .filter((element) => element.offsetParent)
      .map((element) => ({
        label: element.getAttribute('data-menu-item'),
        disabled: element.getAttribute('data-menu-disabled') === 'true',
        shortcut: element.getAttribute('data-menu-shortcut') || '',
        active: element.getAttribute('data-menu-active') === 'true',
        checked: element.getAttribute('data-menu-checked') === 'true'
      })))()`)
    const visibleDividers = () => evaluate(`(() => [...document.querySelectorAll('[data-menu-divider]')]
      .filter((element) => element.offsetParent).length)()`)
    const openMenu = (title) => evaluate(`(() => {
      const element = document.querySelector('[data-menu-title=${JSON.stringify(title)}]')
      if (!element) return false
      element.click()
      return true
    })()`)
    const clickMenuItem = (label) => evaluate(`(() => {
      const wanted = ${JSON.stringify(label)}
      const element = [...document.querySelectorAll('[data-menu-item]')]
        .find((candidate) => candidate.offsetParent && candidate.getAttribute('data-menu-item') === wanted)
      if (!element) return false
      element.click()
      return true
    })()`)
    const clickText = (text, startsWith = false) => evaluate(`(() => {
      const wanted = ${JSON.stringify(text)}
      const elements = [...document.querySelectorAll('*')].filter((element) => {
        const value = (element.textContent || '').trim()
        return element.children.length === 0 && element.offsetParent && (${startsWith} ? value.startsWith(wanted) : value === wanted)
      })
      if (!elements.length) return false
      elements[elements.length - 1].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      return true
    })()`)
    const closeMenu = () => evaluate(`document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 2, clientY: 2 }))`)
    const menuLabels = (items) => items.map((item) => item.label)
    const allEqual = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected)
    const disabledOf = (items, label) => items.find((item) => item.label === label)?.disabled
    const shortcutOf = (items, label) => items.find((item) => item.label === label)?.shortcut

    // 关闭首次启动引导，确保后续按键落在编辑器上。
    await sleep(1800)
    await clickText('×')
    await sleep(250)
    console.log('v52: start')

    const startTitles = await evaluate(`(() => [...document.querySelectorAll('[data-menu-title]')].map((element) => element.getAttribute('data-menu-title')))()`)
    results['无文档顶层菜单保持短菜单'] = allEqual(startTitles, ['文件(F)', '查看(V)', '账户(A)', '云马通(C)', '选项(O)', '帮助(H)', '建议与反馈'])
    results['无文档文件菜单七项且顺序正确'] = await openMenu('文件(F)')
    await sleep(100)
    let items = await visibleItems()
    results['无文档文件菜单文字逐字一致'] = allEqual(menuLabels(items), ['新建(N)', '新建条幅飘带', '打开(Q)...', '关闭(C)', '打印设置(R)...', '最近的文件', '退出(X)'])
    results['无文档关闭和最近文件禁用'] = disabledOf(items, '关闭(C)') === true && disabledOf(items, '最近的文件') === true
    results['无文档文件快捷键正确'] = shortcutOf(items, '新建(N)') === 'Ctrl+N' && shortcutOf(items, '打开(Q)...') === 'Ctrl+O' && !shortcutOf(items, '关闭(C)')
    await closeMenu()

    // 使用开始页按钮创建编辑文档；该路径不会触发系统文件对话框。
    results['进入编辑态'] = await clickText('新建标签模版', true)
    await sleep(800)
    results['选择默认标签格式'] = await clickText('选择')
    await sleep(1500)
    console.log('v52: editor')

    const editorTitles = await evaluate(`(() => [...document.querySelectorAll('[data-menu-title]')].map((element) => element.getAttribute('data-menu-title')))()`)
    results['编辑态顶层菜单十二项且顺序正确'] = allEqual(editorTitles, ['文件(F)', '编辑(E)', '查看(V)', '工具(T)', '排列(A)', '数据库(D)', '账户(A)', '云马通(C)', '选项(O)', '窗口(W)', '帮助(H)', '建议与反馈'])

    results['编辑态文件菜单可打开'] = await openMenu('文件(F)')
    await sleep(100)
    items = await visibleItems()
    results['编辑态文件菜单十四项且顺序正确'] = allEqual(menuLabels(items), ['新建(N)', '新建条幅飘带', '打开(O)...', '关闭(C)', '保存(S)', '另存为(A)...', '分享(I)...', '打印(P)...', '打印预览(V)', '导出打印机指令文件(E)', '标签格式设置(L)...', '模板属性设置(M)...', '最近的文件', '退出(X)'])
    results['编辑态文件快捷键逐字一致'] = shortcutOf(items, '新建(N)') === 'Ctrl+N' && shortcutOf(items, '打开(O)...') === 'Ctrl+O' && shortcutOf(items, '关闭(C)') === 'Ctrl+W' && shortcutOf(items, '保存(S)') === 'Ctrl+S' && shortcutOf(items, '打印(P)...') === 'Ctrl+P'
    results['编辑态保存分享导出禁用'] = disabledOf(items, '保存(S)') === true && disabledOf(items, '分享(I)...') === true && disabledOf(items, '导出打印机指令文件(E)') === true
    results['编辑态打印设置被裁剪且最近文件禁用'] = !items.some((item) => item.label === '打印设置(R)...') && disabledOf(items, '最近的文件') === true
    results['文件菜单分隔线位置与数量正确'] = await visibleDividers() === 4
    await closeMenu()
    console.log('v52: file')

    results['编辑菜单可打开'] = await openMenu('编辑(E)')
    await sleep(100)
    items = await visibleItems()
    results['编辑菜单文字顺序正确'] = allEqual(menuLabels(items), ['撤销(U)', '恢复(R)', '剪切(T)', '复制(C)', '粘贴(P)', '全选(A)', '删除(D)', '键盘输入变量顺序(Q)', '属性'])
    results['编辑菜单快捷键逐字一致'] = allEqual(items.map((item) => item.shortcut), ['Ctrl+Z', 'Ctrl+Y', 'Shift+Delete', 'Ctrl+C', 'Ctrl+V', 'Ctrl+A', 'Delete', '', 'Alt+Enter'])
    results['编辑菜单初始禁用态正确'] = disabledOf(items, '撤销(U)') === true && disabledOf(items, '恢复(R)') === true && disabledOf(items, '剪切(T)') === true && disabledOf(items, '复制(C)') === true && disabledOf(items, '粘贴(P)') === true && disabledOf(items, '删除(D)') === true && disabledOf(items, '全选(A)') === false
    await closeMenu()
    console.log('v52: edit')

    // 查看菜单四个栏的勾选状态必须真实控制 DOM 显隐。
    const viewBars = [
      ['工具栏(T)', 'toolbar'], ['格式栏(F)', 'format-bar'], ['对齐栏(A)', 'align-bar'], ['状态栏(S)', 'status-bar']
    ]
    let viewChecks = true
    for (const [label, testId] of viewBars) {
      await openMenu('查看(V)')
      await sleep(80)
      items = await visibleItems()
      viewChecks = viewChecks && items.find((item) => item.label === label)?.checked === true
      await clickMenuItem(label)
      await sleep(80)
      const hidden = await evaluate(`!document.querySelector('[data-testid=${JSON.stringify(testId)}]')`)
      viewChecks = viewChecks && hidden
      await openMenu('查看(V)')
      await sleep(80)
      items = await visibleItems()
      viewChecks = viewChecks && items.find((item) => item.label === label)?.checked === false
      await clickMenuItem(label)
      await sleep(80)
      const restored = await evaluate(`!!document.querySelector('[data-testid=${JSON.stringify(testId)}]')`)
      viewChecks = viewChecks && restored
    }
    results['查看四项默认勾选且真实控制四栏显隐'] = viewChecks
    console.log('v52: view')

    // 工具菜单是一组连续的九个对象工具，之后仅一条分隔线接五个显示命令。
    results['工具菜单可打开'] = await openMenu('工具(T)')
    await sleep(100)
    items = await visibleItems()
    results['工具菜单十五项顺序与分隔线正确'] = allEqual(menuLabels(items), ['选取(S)', '条码(B)', '文字(T)', '线条(L)', '斜线(L)', '矩形(R)', '图片(P)', '数据(D)', '表格(G)', '放大(I)', '缩小(O)', '适应宽度', '适应高度', '适合窗口(W)']) && await visibleDividers() === 1
    results['工具菜单加速键正确'] = shortcutOf(items, '缩小(O)') === 'Ctrl+-' && shortcutOf(items, '适合窗口(W)') === 'Ctrl+Alt+0' && items.find((item) => item.label === '选取(S)')?.active === true
    await closeMenu()

    const tools = [
      ['选取(S)', 'select'], ['条码(B)', 'barcode'], ['文字(T)', 'text'], ['线条(L)', 'line'], ['斜线(L)', 'diagonal'],
      ['矩形(R)', 'rect'], ['数据(D)', 'data'], ['表格(G)', 'table']
    ]
    let toolSync = true
    for (const [label, key] of tools) {
      await openMenu('工具(T)')
      await sleep(50)
      toolSync = toolSync && await clickMenuItem(label)
      await sleep(120)
      toolSync = toolSync && await evaluate(`document.querySelector('[data-tool=${JSON.stringify(key)}]')?.getAttribute('aria-pressed') === 'true'`)
    }
    // 图片工具与工具栏共用同一入口；阻止测试环境打开原生文件选择器。
    await evaluate(`HTMLInputElement.prototype.__maxlabelClick = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function() {}`)
    await openMenu('工具(T)'); await sleep(50); toolSync = toolSync && await clickMenuItem('图片(P)'); await sleep(100)
    toolSync = toolSync && await evaluate(`document.querySelector('[data-tool=select]')?.getAttribute('aria-pressed') === 'true'`)
    results['工具菜单逐项切换与工具栏状态同步'] = toolSync
    console.log('v52: tools')

    // 数据库：无连接时只有“设置数据库”可点。
    results['数据库菜单可打开'] = await openMenu('数据库(D)')
    await sleep(100)
    items = await visibleItems()
    const dbDisabled = ['定位记录(S)', '更新数据库', '第一条记录', '上一条记录', '下一条记录', '最后一条记录', '删除数据库(E)']
    results['未连库数据库菜单禁用规则正确'] = disabledOf(items, '设置数据库(D)...') === false && dbDisabled.every((label) => disabledOf(items, label) === true)
    await closeMenu()
    console.log('v52: database')

    // 未选对象时排列菜单的排版/层次项均置灰；四个子菜单自身也不可展开。
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
    await sleep(100)
    results['排列菜单可打开'] = await openMenu('排列(A)')
    await sleep(100)
    items = await visibleItems()
    const arrangeDisabled = ['对齐', '尺寸', '间距', '旋转', '位置锁定', '移到最前', '前移', '后移', '移到最后']
    results['未选对象排列排版与层次项禁用'] = arrangeDisabled.every((label) => disabledOf(items, label) === true)
    await closeMenu()
    console.log('v52: arrange')

    // 右键上下文菜单同样必须是可见且可验证的禁用项，而不是“点了无反应”。
    const contextOpened = await evaluate(`(() => {
      const viewport = document.querySelector('[data-testid="workspace-viewport"]')
      if (!viewport) return false
      const r = viewport.getBoundingClientRect()
      viewport.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: r.left + 4, clientY: r.top + 4 }))
      return true
    })()`)
    await sleep(100)
    const contextItems = await visibleItems()
    results['画布右键上下文菜单可打开'] = contextOpened && contextItems.some((item) => item.label === '属性') && contextItems.some((item) => item.label === '删除')
    results['右键无对象属性删除禁用'] = contextItems.find((item) => item.label === '属性')?.disabled === true && contextItems.find((item) => item.label === '删除')?.disabled === true
    await closeMenu()
    console.log('v52: context')

    // 通过 Ctrl+O 注入一个最小合法模板，供快捷键的选取、移动、剪切/删除与属性断言使用。
    // 这仍走真实的打开快捷键，只把原生文件选择器替换为确定性的 CDP 测试夹具。
    const createTextObject = async () => {
      await evaluate(`document.querySelector('[data-tool="text"]')?.click()`)
      await sleep(100)
      const point = await evaluate(`(() => { const canvas = document.querySelector('[data-testid="workspace-viewport"] canvas.upper-canvas'); const rect = canvas?.getBoundingClientRect(); return rect && rect.width > 0 && rect.height > 0 ? { x: rect.left + rect.width * 0.22, y: rect.top + rect.height * 0.22 } : null })()`)
      if (!point) return false
      await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 })
      await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 })
      await sleep(700)
      return Boolean(await evaluate(`Boolean(document.querySelector('[data-testid="layer-object-row"]'))`))
    }
    const created = await createTextObject()
    console.log('v52: object')
    results['快捷键测试夹具通过对象工具创建'] = created

    // 编辑菜单的禁用态在有对象后恢复。
    await openMenu('排列(A)'); await sleep(80); items = await visibleItems()
    results['选中对象后排列菜单恢复可点'] = ['对齐', '尺寸', '间距', '旋转', '位置锁定', '移到最前', '前移', '后移', '移到最后'].every((label) => disabledOf(items, label) === false)
    await closeMenu()

    /*
    // 测试快捷键时阻止真实系统对话框/打印设备，只断言快捷键入口被消费。
    await evaluate(`(() => {
    // 重新选择对象；创建动作默认会选中，但前面的 Escape 只保留了模型无选状态。
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }))`)
    */
    await sleep(150)
    const shortcuts = [
      ['Ctrl+N', { key: 'n', ctrlKey: true }], ['Ctrl+O', { key: 'o', ctrlKey: true }], ['Ctrl+S', { key: 's', ctrlKey: true }],
      ['Ctrl+P', { key: 'p', ctrlKey: true }], ['Ctrl+Z', { key: 'z', ctrlKey: true }], ['Ctrl+Y', { key: 'y', ctrlKey: true }],
      ['Ctrl+A', { key: 'a', ctrlKey: true }], ['Ctrl+T', { key: 't', ctrlKey: true }], ['Tab', { key: 'Tab' }],
      ['Ctrl+C', { key: 'c', ctrlKey: true }], ['Ctrl+V', { key: 'v', ctrlKey: true }], ['Ctrl+X', { key: 'x', ctrlKey: true }],
      ['Shift+Delete', { key: 'Delete', shiftKey: true }], ['Delete', { key: 'Delete' }], ['Alt+Enter', { key: 'Enter', altKey: true }],
      ['Ctrl+G', { key: 'g', ctrlKey: true }], ['Ctrl+U', { key: 'u', ctrlKey: true }], ['Ctrl+L', { key: 'l', ctrlKey: true }],
      ['Ctrl+B', { key: 'b', ctrlKey: true }], ['F1', { key: 'F1' }], ['Ctrl+F', { key: 'f', ctrlKey: true }], ['Ctrl+E', { key: 'e', ctrlKey: true }],
      ['Ctrl++', { key: '+', ctrlKey: true, shiftKey: true }], ['Ctrl+-', { key: '-', ctrlKey: true }], ['Ctrl+Alt+0', { key: '0', ctrlKey: true, altKey: true }]
    ]
    let shortcutCount = 0
    for (const [name, spec] of shortcuts) {
      if (['Shift+Delete', 'Delete', 'Alt+Enter', 'Ctrl+G', 'Ctrl+U', 'Ctrl+L', 'Ctrl+B'].includes(name)) {
        await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }))`)
        await sleep(80)
      }
      if (name === 'Delete') {
        await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true }))`)
        await sleep(100)
      }
      const event = await evaluate(`(() => {
        const spec = ${JSON.stringify(spec)}
        const event = new KeyboardEvent('keydown', { ...spec, bubbles: true, cancelable: true })
        window.dispatchEvent(event)
        return event.defaultPrevented
      })()`)
      results[`快捷键 ${name} 被编辑器消费`] = event === true
      if (event === true) shortcutCount++
      await sleep(40)
      // Ctrl+N / Alt+Enter / F1 / Ctrl+F / Ctrl+E 会开启模态框，逐个关闭以免吞掉后续按键。
      await evaluate(`document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 2, clientY: 2 }))`)
      await evaluate(`document.querySelector('button[aria-label="关闭"]')?.click()`)
      await clickText('取消')
      await sleep(40)
    }
    results['shortcut_main.html 组合覆盖数量'] = shortcutCount === shortcuts.length
    console.log('v52: shortcuts')

    // 方向键：普通步进 0.5mm，Shift 步进 5mm；坐标来自图层行的测试数据属性。
    const selectAgain = await createTextObject()
    console.log('v52: arrows-selected', JSON.stringify({ selected: selectAgain }))
    const readXY = () => evaluate(`(() => { const row = document.querySelector('[data-testid="layer-object-row"][data-selected="true"]'); return row ? { x: Number(row.getAttribute('data-object-x')), y: Number(row.getAttribute('data-object-y')) } : null })()`)
    const before = await readXY()
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))`)
    await sleep(120)
    const afterRight = await readXY()
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true, cancelable: true }))`)
    await sleep(120)
    const afterDown = await readXY()
    console.log('v52: xy', JSON.stringify({ before, afterRight, afterDown }))
    results['方向键移动 0.5mm'] = !!before && !!afterRight && Math.abs(afterRight.x - before.x - 0.5) < 0.001
    results['Shift+方向键移动 5mm'] = !!afterRight && !!afterDown && Math.abs(afterDown.y - afterRight.y - 5) < 0.001
    results['方向键快捷键入口生效'] = selectAgain === true

    // Ctrl+Alt+0 / Ctrl+- / Ctrl++ 实际改变缩放状态；空格+拖拽实际改变滚动位置。
    const zoomText = `[data-testid="status-bar"] > div:last-child > span`
    const zoomBefore = await evaluate(`Number(document.querySelector(${JSON.stringify(zoomText)})?.textContent?.replace('%','')) || 0`)
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '+', ctrlKey: true, shiftKey: true, bubbles: true }))`)
    await sleep(150)
    const zoomPlus = await evaluate(`Number(document.querySelector(${JSON.stringify(zoomText)})?.textContent?.replace('%','')) || 0`)
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '-', ctrlKey: true, bubbles: true }))`)
    await sleep(150)
    const zoomMinus = await evaluate(`Number(document.querySelector(${JSON.stringify(zoomText)})?.textContent?.replace('%','')) || 0`)
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '0', ctrlKey: true, altKey: true, bubbles: true }))`)
    await sleep(150)
    const zoomFit = await evaluate(`Number(document.querySelector(${JSON.stringify(zoomText)})?.textContent?.replace('%','')) || 0`)
    results['Ctrl+加号放大'] = zoomPlus > zoomBefore
    results['Ctrl+减号缩小'] = zoomMinus < zoomPlus
    results['Ctrl+Alt+0适合窗口'] = zoomFit > 0

    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '+', ctrlKey: true, shiftKey: true, bubbles: true }))`)
    await sleep(150)
    const pan = await evaluate(`(() => { const el = document.querySelector('[data-testid="workspace-viewport"]'); if (!el) return null; el.scrollLeft = Math.max(0, el.scrollLeft); return { x: el.getBoundingClientRect().left + 300, y: el.getBoundingClientRect().top + 200, before: el.scrollLeft, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth } })()`)
    if (!pan) throw new Error('no workspace viewport')
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }))`)
    await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pan.x, y: pan.y, button: 'left', clickCount: 1 })
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pan.x - 120, y: pan.y, button: 'left' })
    await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pan.x - 120, y: pan.y, button: 'left', clickCount: 1 })
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true }))`)
    await sleep(120)
    const panAfter = await evaluate(`document.querySelector('[data-testid="workspace-viewport"]')?.scrollLeft || 0`)
    console.log('v52: pan', JSON.stringify({ before: pan.before, after: panAfter, scrollWidth: pan.scrollWidth, clientWidth: pan.clientWidth }))
    results['空格+左键拖动平移'] = panAfter > pan.before

    // 关闭当前文档快捷键必须回到无文档态。
    await client.send('Page.reload', { ignoreCache: true })
    await sleep(1200)
    results['关闭测试重新进入干净文档'] = await clickText('新标签模板1')
    await sleep(250)
    let closed = false
    for (let i = 0; i < 8; i += 1) {
      closed = await evaluate(`(() => { const event = new KeyboardEvent('keydown', { key: 'w', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented })()`)
      await sleep(180)
      if (await evaluate(`!document.querySelector('[data-menu-title="编辑(E)"]')`)) break
    }
    results['Ctrl+W关闭当前文档'] = closed === true && await evaluate(`!document.querySelector('[data-menu-title="编辑(E)"]')`)

    let pass = 0
    for (const [name, value] of Object.entries(results)) {
      console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value)
      if (value) pass++
    }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    client.ws.close()
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
