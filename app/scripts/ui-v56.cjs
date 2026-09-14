/* P0-B：对象属性页签、条码码制全集与帮助文档规定的默认值。 */
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
    const click = (selector) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e || !e.offsetParent) return false; e.click(); return true })()`)
    const clickText = (text) => evaluate(`(() => {
      const wanted = ${JSON.stringify(text)}
      const elements = [...document.querySelectorAll('button')].filter((element) => element.offsetParent && (element.textContent || '').trim() === wanted)
      if (!elements.length) return false
      elements[elements.length - 1].click(); return true
    })()`)
    const key = (name, options = {}) => evaluate(`(() => { const e = new KeyboardEvent('keydown', ${JSON.stringify({ key: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); return e.defaultPrevented })()`)
    const draw = (dx, dy, dw, dh) => evaluate(`(() => {
      const canvas = document.querySelector('canvas.upper-canvas') || document.querySelector('canvas')
      if (!canvas) return false
      const r = canvas.getBoundingClientRect()
      const x1 = r.left + ${dx}, y1 = r.top + ${dy}, x2 = x1 + ${dw}, y2 = y1 + ${dh}
      const event = (type, x, y) => canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: type === 'mouseup' ? 0 : 1 }))
      event('mousedown', x1, y1); event('mousemove', x2, y2); event('mouseup', x2, y2); return true
    })()`)
    const selectLatestObject = async () => { const clicked = await evaluate(`(() => { const rows = [...document.querySelectorAll('[data-testid="layer-object-row"]')]; if (!rows.length) return false; if (rows[0].getAttribute('data-selected') !== 'true') rows[0].click(); return true })()`); await sleep(180); return clicked }
    const openProperties = async () => { await key('Enter', { altKey: true }); await sleep(350); return evaluate('!!document.querySelector("[data-testid=object-props-dialog]")') }
    const closeDialog = () => click('[data-testid="object-props-dialog"] button[aria-label="关闭"]')

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await sleep(200)
    await key('n', { ctrlKey: true })
    await sleep(300)
    await click('[data-testid="wizard-next"]')
    await sleep(450)
    await clickText('选择')
    await sleep(700)
    await click('[data-tool="text"]')
    await draw(80, 60, 180, 48)
    await sleep(350)
    const textSelected = await selectLatestObject()
    results['文字对象可打开属性对话框'] = textSelected && await openProperties()
    const textTabs = await evaluate(`(() => [...document.querySelectorAll('[data-testid="object-props-dialog"] [data-testid^="object-props-tab-"]')].map((e) => (e.textContent || '').trim()))()`)
    results['文字页签顺序与名称'] = JSON.stringify(textTabs) === JSON.stringify(['通用', '文字', '字体', '数据'])
    await click('[data-testid="object-props-tab-text"]')
    results['文字页包含停靠与布局字段'] = await evaluate(`(() => { const t = document.querySelector('[data-testid="object-props-dialog"]')?.textContent || ''; return t.includes('文字停靠') && t.includes('文字类型') && t.includes('字符模板') })()`)
    await click('[data-testid="object-props-tab-font"]')
    results['文字字体宽度默认值'] = await evaluate('document.querySelector("[data-testid=object-props-dialog] input[type=number]")?.value === "1"')
    await closeDialog()
    await sleep(250)

    await click('[data-tool="barcode"]')
    await draw(300, 60, 220, 82)
    await sleep(450)
    results['条码对象可打开属性对话框'] = await selectLatestObject() && await openProperties()
    await click('[data-testid="object-props-tab-barcode"]')
    const barcodeOptions = await evaluate(`(() => {
      const select = document.querySelector('[data-testid="object-props-dialog"] select')
      return [...(select?.options || [])].map((option) => option.textContent.trim())
    })()`)
    const required = ['Code39', 'Code128', 'EAN-13', 'Interleaved25', 'Code93', 'UPC-A', 'UPC-E', 'EAN-8', 'CodaBar', 'Code25', 'Matrix25', 'China Post', 'ITF14', 'RSS GS1 DataBar', 'PDF417', 'QR Code', 'DataMatrix', '汉信码']
    results['条码码制下拉包含完整清单'] = required.every((item) => barcodeOptions.includes(item))
    results['条码X尺寸按帮助使用mil且默认10'] = await evaluate(`(() => { const root = document.querySelector('[data-testid=object-props-dialog]'); const input = root?.querySelector('[data-testid=barcode-x-size]'); return !!input && input.value === '10' && (root.textContent || '').includes('mil') })()`)
    const specialTab = await evaluate('document.querySelector("[data-testid=object-props-tab-barcodeSpecial]")?.textContent.trim()')
    results['条码对象有当前码制专页'] = specialTab === 'Code128'
    await click('[data-testid="object-props-tab-barcodeSpecial"]')
    results['Code128专页字段已接线'] = await evaluate(`(() => { const t = document.querySelector('[data-testid="object-props-dialog"]')?.textContent || ''; return t.includes('字符集') && t.includes('GS1/EAN-128') })()`)
    const setSymbology = (value) => evaluate(`(() => { const select = document.querySelector('[data-testid="object-props-dialog"] [data-testid="object-props-tab-barcode"]')?.parentElement?.parentElement?.querySelector('select'); if (!select) return false; const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; setter.call(select, ${JSON.stringify(value)}); select.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
    await click('[data-testid="object-props-tab-barcode"]')
    await setSymbology('pdf417')
    await sleep(180)
    await click('[data-testid="object-props-tab-barcodeSpecial"]')
    results['PDF417层高默认是X尺寸3倍'] = await evaluate(`document.querySelector('[data-testid="pdf417-layer-height"]')?.value === '3'`)
    await click('[data-testid="object-props-tab-barcode"]')
    await setSymbology('datamatrix')
    await sleep(180)
    await click('[data-testid="object-props-tab-barcodeSpecial"]')
    results['DataMatrix纠错固定为ECC200'] = await evaluate(`document.querySelector('[data-testid="object-props-dialog"] select[disabled]')?.value === 'ECC200'`)

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
