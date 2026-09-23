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
    // 真机口径（PROBE-verifier-object-tabs.md）：文字属性页签 = 数据源 / 字体 / 文本 / 常规
    results['文字页签顺序与名称'] = JSON.stringify(textTabs) === JSON.stringify(['数据源', '字体', '文本', '常规'])
    await click('[data-testid="object-props-tab-text"]')
    // 真机「文本」页（`probe-r201-textprops-text-tree.txt`）：`文字停靠(&P)` 在**单行态不显示**（dump 行首 `[ ]`），
    // 切到「多行」才出现 —— 所以按模式分别断言（round-142 加严：原来只查"整页文本里有没有"）。
    results['单行态文本页有类型/字符模板、且不显示文字停靠'] = await evaluate(`(() => { const d = document.querySelector('[data-testid="object-props-dialog"]'); const t = d?.textContent || ''; const kind=[...(d?.querySelectorAll('[data-testid^="text-type-"]')||[])].find((e)=>e.checked)?.getAttribute('data-testid'); return t.includes('类型') && t.includes('字符模板') && !t.includes('文字停靠') && kind === 'text-type-single' })()`)
    await click('[data-testid="text-type-multi"]')
    await sleep(200)
    results['切到多行后文本页出现文字停靠'] = await evaluate(`(() => { const d = document.querySelector('[data-testid="object-props-dialog"]'); return (d?.textContent || '').includes('文字停靠') })()`)
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
    // round-57：码制清单改为照抄真机下拉的 20 项（名称带空格、顺序一致、新增 Pharmacode/Micro QR，见 DIFF-55）
    const required = ['Code 39', 'Code 128', 'EAN-13', 'Interleaved 25', 'Code 93', 'UPC-A', 'EAN-8', 'UPC-E', 'CodaBar', 'Code 25', 'Matrix 25', 'China Post', 'Pharmacode', 'ITF 14', 'GS1 RSS 条码', 'PDF 417', 'QR Code', 'Data Matrix', '汉信码', 'Micro QR']
    results['条码码制下拉包含完整清单'] = required.every((item) => barcodeOptions.includes(item))
    // round-129：真机 X 尺寸是 61 项下拉（不是数字框），默认档 `10.00 mil` —— 断言随之加严为「项数 + 默认档 + 单位」。
    results['条码X尺寸按真机为mil下拉（61 项 / 默认 10.00 mil）'] = await evaluate(`(() => { const root = document.querySelector('[data-testid=object-props-dialog]'); const input = root?.querySelector('[data-testid=barcode-x-size]'); return !!input && input.tagName === 'SELECT' && input.options.length === 61 && input.value === '10.00 mil' && (root.textContent || '').includes('mil') })()`)
    // 真机条码属性只有 4 个页签，码制专属字段在「条码」页内的「条码特殊选项」分组里（PROBE-verifier-object-tabs.md §五）
    const barcodeTabs = await evaluate(`(() => [...document.querySelectorAll('[data-testid="object-props-dialog"] [data-testid^="object-props-tab-"]')].map((e) => (e.textContent || '').trim()))()`)
    results['条码页签为真机的四页（无码制专页）'] = JSON.stringify(barcodeTabs) === JSON.stringify(['数据源', '条码', '字体', '常规'])
    await click('[data-testid="object-props-tab-barcode"]')
    const specialGroup = await evaluate(`(() => { const g = document.querySelector('[data-testid="barcodeSpecial"]'); return g ? (g.textContent || '') : null })()`)
    // round-127：字段原文按真机 `probe-60-barcode-props-tree.txt` (961,704) 改成 `GS1/EAN 128(&U)`
    //（真机原文里 GS1/EAN 与 128 之间是**空格**、没有连字符，且带加速键 `(&U)`）——断言同步改成真机原文，
    // 并同时钉住加速键，强度不降（原断言查 `GS1/EAN-128` 是被真机证伪的旧文案）。
    results['Code128专属字段在条码页的「条码特殊选项」分组内'] =
      typeof specialGroup === 'string' && specialGroup.includes('条码特殊选项') && specialGroup.includes('字符集(C):') && specialGroup.includes('GS1/EAN 128(U)')
    const setSymbology = (value) => evaluate(`(() => { const select = document.querySelector('[data-testid="object-props-dialog"] [data-testid="barcode-symbology"]'); if (!select) return false; const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; setter.call(select, ${JSON.stringify(value)}); select.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
    await click('[data-testid="object-props-tab-barcode"]')
    await setSymbology('pdf417')
    await sleep(180)
    // round-129：真机 PDF 417 的 `层数(&R):` 是 **89 项下拉**（`自动` + 3…90）、`列数(&C):` 是 31 项（`自动` + 1…30），
    // 默认都是 `自动`（`probe-sym-pdf417-combos.txt` combo[5]/[6]）——复刻版原先是自造「层高 = X 尺寸 3 倍」的数字框。
    const pdf417State = await evaluate(`(() => {
      const q=(s)=>document.querySelector('[data-testid="object-props-dialog"] [data-testid="'+s+'"]')
      const rows=q('pdf417-rows'), cols=q('pdf417-columns')
      return { rowCount: rows?.options.length, rowValue: rows?.value, rowFirst: rows?.options[0].textContent,
               colCount: cols?.options.length, colValue: cols?.value, rowLast: rows?.options[rows.options.length-1].textContent }
    })()`)
    results['PDF417 层数/列数按真机为下拉：层数 89 项(自动+3…90)、列数 31 项(自动+1…30)、默认均为「自动」'] =
      Boolean(pdf417State && pdf417State.rowCount === 89 && pdf417State.colCount === 31
        && pdf417State.rowFirst === '自动' && pdf417State.rowLast === '90'
        && pdf417State.rowValue === '自动' && pdf417State.colValue === '自动')
    await click('[data-testid="object-props-tab-barcode"]')
    await setSymbology('datamatrix')
    await sleep(180)
    results['DataMatrix纠错固定为ECC200'] = await evaluate(`document.querySelector('[data-testid="barcodeSpecial"] select[disabled]')?.value === 'ECC200'`)

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
