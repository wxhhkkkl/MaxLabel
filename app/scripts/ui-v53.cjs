/*
 * P0-A：状态栏、打印停靠面板、图层面板字段级 parity。
 * 证据来源：parity/reference/labelshop/44-statusbar.png、
 * 45-left-panel.png、46-right-print-panel.png、63-dlg-print.png。
 */
const http = require('http')

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (error) { reject(error) }
      })
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

    await sleep(1800)
    await clickText('×')
    await sleep(250)
    results['进入编辑态'] = await clickText('新建标签模版', true)
    await sleep(800)
    await clickText('下一步')
    await sleep(300)
    results['选择默认标签格式'] = await clickText('选择')
    await sleep(1500)

    const status = await evaluate(`(() => {
      const id = (name) => document.querySelectorAll('[data-testid="' + name + '"]')
      const text = (name) => document.querySelector('[data-testid="' + name + '"]')?.textContent?.trim() || ''
      const zoom = document.querySelector('[data-testid="status-zoom"]')
      const range = zoom?.querySelector('input[type="range"]')
      return {
        printerCount: id('status-printer').length,
        specCount: id('status-label-spec').length,
        databaseCount: id('status-database').length,
        cursorCount: id('status-cursor').length,
        zoomCount: id('status-zoom').length,
        hasObjectInfo: id('status-object-info').length > 0,
        objectInfoContent: [...(document.querySelector('[data-testid="status-object-info"]')?.querySelectorAll('span') || [])].slice(1).map((element) => element.textContent || '').join('').trim(),
        printer: text('status-printer').replace('▣', '').trim(),
        spec: text('status-label-spec').replace('▤', '').trim(),
        cursor: text('status-cursor').replace('⌖', '').trim(),
        zoomText: zoom?.textContent?.trim() || '',
        rangeMin: range?.getAttribute('min'),
        rangeMax: range?.getAttribute('max')
      }
    })()`)
    console.log('v53: status', JSON.stringify(status))
    results['状态栏保留六段'] = status.printerCount === 1 && status.specCount === 1 && status.databaseCount === 1 && status.cursorCount === 1 && status.zoomCount === 1 && status.hasObjectInfo
    results['空对象信息只保留图标'] = status.hasObjectInfo && !status.objectInfoContent
    results['状态栏打印机段仅显示名称'] = !!status.printer && !/(TSPL|ZPL|CPCL|dpi|USB|TCP|COM|\bLPT\d*\b|@\d+)/i.test(status.printer)
    results['状态栏标签规格使用整数去尾零形状与版式页盒数据'] = status.spec === '100mm x 70mm 圆角8枚/页 20页/盒'
    results['状态栏缩放单值且范围为百分之五十至四百'] = /^\d+%$/.test(status.zoomText) && status.rangeMin === '50' && status.rangeMax === '400' && (status.zoomText.match(/%/g) || []).length === 1

    const point = await evaluate(`(() => {
      const canvas = document.querySelector('[data-testid="workspace-viewport"] canvas.upper-canvas')
      const rect = canvas?.getBoundingClientRect()
      return rect && rect.width > 0 && rect.height > 0 ? { x: rect.left + Math.min(24, rect.width / 2), y: rect.top + Math.min(24, rect.height / 2) } : null
    })()`)
    let cursor = ''
    if (point) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y })
        await evaluate(`document.querySelector('[data-testid="workspace-viewport"] canvas.upper-canvas')?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: ${point.x}, clientY: ${point.y} }))`)
        await sleep(180)
        cursor = await evaluate(`document.querySelector('[data-testid="status-cursor"]')?.textContent?.trim() || ''`)
        if (/\d+\.\d{2},\s*-?\d+\.\d{2}\s*毫米/.test(cursor)) break
      }
    }
    results['状态栏鼠标位置显示两位小数和毫米'] = /\d+\.\d{2},\s*-?\d+\.\d{2}\s*毫米/.test(cursor)
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 })
    await sleep(80)
    const cursorAfterLeave = await evaluate(`(() => { const el = document.querySelector('[data-testid="status-cursor"]'); return [...(el?.querySelectorAll('span') || [])].slice(1).map((item) => item.textContent || '').join('').trim() })()`)
    results['鼠标离开画布后只保留图标'] = cursorAfterLeave === ''

    await evaluate(`document.querySelector('button[data-tool="text"]')?.click()`)
    const objectPoint = await evaluate(`(() => {
      const canvas = document.querySelector('[data-testid="workspace-viewport"] canvas.upper-canvas')
      const rect = canvas?.getBoundingClientRect()
      return rect && rect.width > 0 && rect.height > 0 ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null
    })()`)
    if (objectPoint) {
      await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: objectPoint.x, y: objectPoint.y, button: 'left', clickCount: 1 })
      await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: objectPoint.x, y: objectPoint.y, button: 'left', clickCount: 1 })
    }
    await sleep(350)
    const selectedObjectInfo = await evaluate(`document.querySelector('[data-testid="status-object-info"]')?.textContent?.trim() || ''`)
    results['选中对象后显示位置与尺寸'] = /X:\s*\d+\.\d{2},\s*Y:\s*\d+\.\d{2},\s*W:\s*\d+\.\d{2},\s*H:\s*\d+\.\d{2}/.test(selectedObjectInfo)

    const dock = await evaluate(`(() => {
      const root = document.querySelector('[data-testid="print-dock"]')
      const title = root?.querySelector('[data-testid="print-dock-title"]')?.textContent?.trim() || ''
      const activeTab = (document.querySelector('[data-testid="document-tab"][data-active="true"]')?.getAttribute('data-document-title') || '').replace(' *', '')
      const text = root?.textContent || ''
      return {
        title,
        activeTab,
        checkboxCount: root?.querySelectorAll('input[type="checkbox"]').length || 0,
        inputData: !!root?.querySelector('[data-testid="print-input-data"]'),
        printer: !!root?.querySelector('[data-testid="print-printer"]'),
        printerSettings: !!root?.querySelector('[data-testid="print-printer-settings"]'),
        count: !!root?.querySelector('[data-testid="print-count"]'),
        copies: !!root?.querySelector('[data-testid="print-copies"]'),
        submit: !!root?.querySelector('[data-testid="print-submit"]'),
        noMovedFields: !/(起始标签|打印预览|测试打印|打印时自动|拷贝数量从数据库|数据查重|仅打印当前|更新序列号)/.test(text)
      }
    })()`)
    results['打印面板标题跟随当前文档'] = dock.title === `打印 - ${dock.activeTab}` && dock.activeTab.length > 0
    results['打印面板仅保留原版基础字段'] = dock.checkboxCount === 0 && dock.inputData && dock.printer && dock.printerSettings && dock.count && dock.copies && dock.submit && dock.noMovedFields

    const layers = await evaluate(`(() => {
      const toolbar = document.querySelector('[data-testid="layer-toolbar"]')
      const buttons = [...(toolbar?.querySelectorAll('button') || [])]
      const defaultRow = document.querySelector('[data-testid="layer-default"]')
      return {
        buttonCount: buttons.length,
        titles: buttons.map((button) => button.getAttribute('title')),
        defaultText: defaultRow?.textContent?.trim() || '',
        columns: ['visibility', 'name', 'lock'].map((name) => !!defaultRow?.querySelector('[data-testid="layer-column-' + name + '"]')),
        objectRows: document.querySelectorAll('[data-testid="layer-object-row"]').length
      }
    })()`)
    results['图层面板六个工具按钮顺序正确'] = JSON.stringify(layers.titles) === JSON.stringify(['新建图层', '设置', '复制图层', '删除图层', '重命名图层', '图层属性']) && layers.buttonCount === 6
    results['图层列表三列且保留默认层'] = layers.defaultText.includes('默认') && layers.columns.every(Boolean) && layers.objectRows >= 1

    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, bubbles: true, cancelable: true }))`)
    await sleep(250)
    const dialog = await evaluate(`(() => {
      const root = document.querySelector('[data-testid="print-dialog"]')
      const text = root?.textContent || ''
      return {
        visible: !!root,
        options: !!root?.querySelector('[data-testid="print-dialog-advanced"]'),
        checkboxes: root?.querySelectorAll('[data-testid^="print-option-"]').length || 0,
        moved: ['打印后更新变量数据', '打印标签边框', '旋转180度输出', '只打印数据表中当前记录行的数据'].every((label) => text.includes(label))
      }
    })()`)
    results['Ctrl+P打开打印对话框并承载高级选项'] = dialog.visible && dialog.options && dialog.checkboxes >= 4 && dialog.moved
    await evaluate(`document.querySelector('[data-testid="print-dialog"] button[aria-label="关闭打印对话框"]')?.click()`)

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
