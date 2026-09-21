/* P0-A：菜单上下文、状态栏和左右停靠面板的 LabelShop 结构冒烟。 */
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
    const clickText = (text, startsWith = false) => evaluate(`(() => {
      const wanted = ${JSON.stringify(text)}
      const items = [...document.querySelectorAll('*')].filter((element) => {
        const value = (element.textContent || '').trim()
        return element.children.length === 0 && element.offsetParent && (${startsWith} ? value.startsWith(wanted) : value === wanted)
      })
      if (!items.length) return false
      items[items.length - 1].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      return true
    })()`)
    const menuTitles = () => evaluate(`(() => [...document.querySelectorAll('[data-menu-title]')].map((element) => element.getAttribute('data-menu-title')))()`)
    const visibleItems = () => evaluate(`(() => [...document.querySelectorAll('[data-menu-item]')].filter((element) => element.offsetParent).map((element) => ({ label: element.getAttribute('data-menu-item'), disabled: element.getAttribute('data-menu-disabled') === 'true' })))()`)
    const openMenu = (title) => evaluate(`(() => { const element = document.querySelector('[data-menu-title=${JSON.stringify(title)}]'); if (!element) return false; element.click(); return true })()`)

    await sleep(2500)
    // 首次启动提示不应改变菜单上下文断言。
    await clickText('×')
    await sleep(300)

    const startTitles = await menuTitles()
    const expectedStart = ['文件(F)', '查看(V)', '账户(A)', '云马通(C)', '选项(O)', '帮助(H)', '建议与反馈']
    const results = {
      '无文档顶层菜单收窄且顺序正确': JSON.stringify(startTitles) === JSON.stringify(expectedStart),
      '无文档使用云马通(C)': startTitles.includes('云马通(C)') && !startTitles.includes('云服务(C)')
    }

    results['无文档文件菜单可打开'] = await openMenu('文件(F)')
    await sleep(100)
    const startFile = await visibleItems()
    const startLabels = startFile.map((item) => item.label)
    results['无文档文件菜单为原版短菜单'] = ['新建(N)', '打开(Q)...', '关闭(C)', '打印设置(R)...', '最近的文件', '退出(X)'].every((label) => startLabels.includes(label)) && !startLabels.includes('保存(S)')
    results['最近的文件无记录时禁用'] = startFile.some((item) => item.label === '最近的文件' && item.disabled)
    await clickText('文件(F)')

    results['进入新建标签对话框'] = await clickText('新建标签模版', true)
    await sleep(800)
    results['选择标签格式进入编辑态'] = await clickText('选择')
    await sleep(1200)

    const editorTitles = await menuTitles()
    const expectedEditor = ['文件(F)', '编辑(E)', '查看(V)', '工具(T)', '排列(A)', '数据库(D)', '账户(A)', '云马通(C)', '选项(O)', '窗口(W)', '帮助(H)', '建议与反馈']
    results['有文档顶层菜单为12项且顺序正确'] = JSON.stringify(editorTitles) === JSON.stringify(expectedEditor)
    results['编辑态仍使用云马通(C)'] = editorTitles.includes('云马通(C)') && !editorTitles.includes('云服务(C)')

    results['编辑态文件菜单可打开'] = await openMenu('文件(F)')
    await sleep(100)
    const editorFile = await visibleItems()
    const editorLabels = editorFile.map((item) => item.label)
    results['编辑态文件菜单文案和加速键对齐'] = ['新建(N)', '打开(O)...', '关闭(C)', '打印(P)...', '打印预览(V)', '标签格式设置(L)...', '模板属性设置(M)...', '退出(X)'].every((label) => editorLabels.includes(label)) && editorLabels.includes('分享(T)...') && editorLabels.includes('导出打印机指令文件(E)') && !editorLabels.includes('模板库(L)...') && !editorLabels.includes('打印设置(R)...')
    results['编辑态分享和导出保持原版禁用'] = editorFile.some((item) => item.label === '分享(T)...' && item.disabled) && editorFile.some((item) => item.label === '导出打印机指令文件(E)' && item.disabled)
    results['编辑态无最近文件项禁用'] = editorFile.some((item) => item.label === '最近的文件' && item.disabled)
    await clickText('文件(F)')

    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', altKey: true, bubbles: true }))`)
    await sleep(100)
    const accountVisible = await evaluate(`!![...document.querySelectorAll('[data-menu-item]')].find((element) => element.offsetParent && element.getAttribute('data-menu-item') === '登录...')`)
    results['重复加速键Alt+A按原版打开账户'] = accountVisible
    await clickText('账户(A)')

    const body = await evaluate('document.body.innerText')
    results['状态栏使用标签规格和数据库状态'] = body.includes('未使用数据库') && body.includes('mm') && !body.includes('未打开标签模板')
    results['状态栏字段顺序可查询'] = await evaluate(`(() => {
      const bar = document.querySelector('[data-testid="status-bar"]')
      if (!bar) return false
      const ids = [...bar.children].map((element) => element.getAttribute('data-testid')).filter(Boolean)
      return JSON.stringify(ids.slice(0, 5)) === JSON.stringify(['status-printer', 'status-label-spec', 'status-database', 'status-cursor', 'status-object-info'])
    })()`)
    results['左侧默认图层行和右侧打印面板存在'] = await evaluate('!!(document.querySelector("[data-testid=layer-default]") && document.querySelector("[data-testid=print-dock]"))')
    results['打印面板页签结构对齐'] = await evaluate(`(() => {
      const dock = document.querySelector('[data-testid="print-dock"]')
      if (!dock) return false
      return ['params', 'server', 'help'].every((key) => dock.querySelector('[data-testid="print-tab-' + key + '"]')) && dock.querySelector('[data-testid="print-tab-help"]').disabled
    })()`)
    results['打印面板输入数据和数量字段存在'] = await evaluate(`(() => {
      const dock = document.querySelector('[data-testid="print-dock"]')
      return Boolean(dock && dock.querySelector('[data-testid="print-input-data"]') && dock.querySelector('[data-testid="print-count"]') && dock.querySelector('[data-testid="print-copies"]') && dock.querySelector('button') && [...dock.querySelectorAll('button')].some((element) => element.textContent.trim() === '打印'))
    })()`)

    let pass = 0
    for (const [name, value] of Object.entries(results)) {
      console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value)
      if (value) pass += 1
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
