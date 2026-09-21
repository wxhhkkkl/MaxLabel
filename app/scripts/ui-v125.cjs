/*
 * 需求清单「对象属性」的前 18 条 + 本轮由真机读值发现的四处形态差异（round-57）。
 *
 * 真机判据（parity/reference/labelshop/probe-45-barcode-props-p1..p6.txt、probe-42-text-props-values.txt，
 * 由 `Probe-LabelShopCombos.ps1` 的 CB_GETCOUNT/CB_GETLBTEXT 与 `Read-LabelShopDialogValues.ps1` 读回）：
 *   - 63 旋转：`旋转(&R)` 4 项 0°/90°/180°/270°
 *   - 64 镜像：`镜像(&M)` **3 项** 无 / 水平镜像 / 垂直镜像（复刻版原先多一个「水平+垂直镜像」→ DIFF-56）
 *   - 65 背景：`背景(&B)` 2 项 不透明 / 透明，默认「透明」
 *   - 66 位置锁定：常规页复选框（不可移动，见 ui-v122 的 DIFF-48/49）
 *   - 67 不打印输出 / 68 对象附加说明：常规页「不打印输出(&N)」与「对象附加说明(&C)」
 *   - 72 字体大小：`大小(&P)` **31 项**：8,9,10,11,12,14,16,18,20,22,24,26,28,36,48,72,
 *              初号(42),小初(36),一号(26),小一(24),二号(22),小二(18),三号(16),小三(15),
 *              四号(14),小四(12),五号(10.5),小五(9),六号(8),小六(7),七号(5)
 *   - 76 字体宽度缩放倍数：`字体宽度方向缩放倍数(&H)` 默认 1.00
 *   - 77 字间距：`字间距(&J)` 默认 0.00
 *   - 79 示例：字体页底部「示例」组预览
 *   - 115/116 条码通用：`条码符号类型(码制)(&B)` **20 项**（DIFF-55）、`X 尺寸(&X)` 61 项、
 *              `码 高(&H)` 10.00、`字符集(&C)` 自动、供人识读字符 位置/垂直偏移/对齐方式
 *   - 常规页「水平(W)/垂直(T)」：条码 **3 项**（左齐/居中/右齐、顶部/居中/底部），文字 **0 项且禁用**（DIFF-50）
 */
const http = require('http')
const WebSocket = require('ws')

const REAL_SYMBOLOGIES = [
  'Code 39', 'Code 128', 'EAN-13', 'Interleaved 25', 'Code 93', 'UPC-A', 'EAN-8', 'UPC-E', 'CodaBar',
  'Code 25', 'Matrix 25', 'China Post', 'Pharmacode', 'ITF 14', 'GS1 RSS 条码', 'PDF 417', 'QR Code',
  'Data Matrix', '汉信码', 'Micro QR'
]

const REAL_FONT_SIZES = [
  '8', '9', '10', '11', '12', '14', '16', '18', '20', '22', '24', '26', '28', '36', '48', '72',
  '初号(42)', '小初(36)', '一号(26)', '小一(24)', '二号(22)', '小二(18)', '三号(16)', '小三(15)',
  '四号(14)', '小四(12)', '五号(10.5)', '小五(9)', '六号(8)', '小六(7)', '七号(5)'
]

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
    await client.send('Runtime.enable')
    const evaluate = async (expression) => {
      const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
      return result.result?.value
    }
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e || e.disabled)return false; e.click(); return true })()`)
    const setValue = (selector, value) => evaluate(`(() => {
      const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false
      const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(String(value))})
      e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
    const waitFor = async (expression, timeout = 5000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const optionTexts = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); return e ? [...e.options].map((o)=>o.textContent.trim()) : null })()`)
    const rows = () => evaluate(`([...document.querySelectorAll('[data-testid=layer-object-row]')].map((e)=>({ id:e.dataset.objectId, type:e.dataset.objectType })))`)
    const createObject = async (tool, x1, y1, x2, y2) => {
      await click(`[data-tool="${tool}"]`); await sleep(170)
      await evaluate(`(() => { const c=document.querySelector('canvas.upper-canvas'); const b=c.getBoundingClientRect()
        const p=(x,y,buttons=1)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons})
        c.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1}))); c.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2})))
        c.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2},0),buttons:0})); return true })()`)
      await sleep(440)
    }
    const openProps = async (type) => {
      await click('[data-tool="select"]'); await sleep(180)
      await evaluate(`(() => { const r=[...document.querySelectorAll('[data-testid=layer-object-row]')].find((e)=>e.dataset.objectType===${JSON.stringify(type)}); if(r && r.dataset.selected!=='true') r.click(); return !!r })()`)
      await sleep(260)
      await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',altKey:true,bubbles:true,cancelable:true}))`)
      return waitFor('!!document.querySelector("[data-testid=object-props-dialog]")', 5000)
    }
    const closeProps = async () => {
      await evaluate(`document.querySelector('[data-testid=object-props-dialog] button[aria-label]')?.click()`)
      await waitFor('!document.querySelector("[data-testid=object-props-dialog]")', 3000)
      await sleep(220)
    }

    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'n',code:'KeyN',ctrlKey:true,bubbles:true,cancelable:true}))`); await sleep(420)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(380)
    }
    await click('[data-testid="new-label-select"]')
    await waitFor('!!document.querySelector("canvas.upper-canvas")', 9000)
    await sleep(400)
    await createObject('text', 60, 60, 200, 110)
    await createObject('barcode', 60, 220, 260, 340)

    // ---------- 文字对象：常规页（63/64/65/66/67/68 + DIFF-50） ----------
    if (!await openProps('text')) throw new Error('文字属性没打开')
    await click('[data-testid="object-props-tab-general"]'); await sleep(260)
    const textRotation = await optionTexts('[data-testid="obj-rotation"]')
    const textMirror = await optionTexts('[data-testid="obj-mirror"]')
    const textBackground = await optionTexts('[data-testid="obj-background"]')
    const textGeneralText = await evaluate(`document.querySelector('[data-testid=object-props-dialog]')?.innerText || ''`)
    const textAlignH = await evaluate(`(() => { const e=document.querySelector('[data-testid=obj-align-h]'); return e?{disabled:e.disabled, count:e.options.length}:null })()`)
    const textAlignV = await evaluate(`(() => { const e=document.querySelector('[data-testid=obj-align-v]'); return e?{disabled:e.disabled, count:e.options.length}:null })()`)
    const textLock = await evaluate(`!!document.querySelector('[data-testid=obj-x]')`)
    results['63 常规属性「旋转」4 项且为 0/90/180/270（真机 probe-45/42 同）'] =
      JSON.stringify(textRotation) === JSON.stringify(['0', '90', '180', '270'])
    results['64 常规属性「镜像」3 项：无/水平镜像/垂直镜像（真机 3 项，DIFF-56）'] =
      JSON.stringify(textMirror) === JSON.stringify(['无', '水平镜像', '垂直镜像'])
    results['65 常规属性「背景」2 项：不透明/透明（真机默认「透明」）'] =
      JSON.stringify(textBackground) === JSON.stringify(['不透明', '透明']) && (await evaluate(`document.querySelector('[data-testid="obj-background"]')?.value`)) === 'transparent'
    results['66/67/68 常规属性含位置锁定、不打印输出、对象附加说明三项'] =
      textGeneralText.includes('位置锁定') && textGeneralText.includes('不打印输出') && textGeneralText.includes('对象附加说明') && textLock
    results['DIFF-50 文字对象的「水平/垂直位置」下拉为空且禁用（真机 CB_GETCOUNT=0）'] =
      Boolean(textAlignH) && textAlignH.disabled === true && textAlignH.count === 0 &&
      Boolean(textAlignV) && textAlignV.disabled === true && textAlignV.count === 0

    // ---------- 文字对象：字体页（72/76/77/79） ----------
    await click('[data-testid="object-props-tab-font"]'); await sleep(280)
    const fontSizes = await optionTexts('[data-testid="object-props-font-size"]')
    const fontStyles = await optionTexts('[data-testid="text-font-style"]')
    const fontText = await evaluate(`document.querySelector('[data-testid=object-props-dialog]')?.innerText || ''`)
    const previewExists = await evaluate(`!!document.querySelector('[data-testid="text-font-preview"]')`)
    results['72 字体「大小」下拉 31 项且名称/顺序同真机（8…72 + 初号(42)…七号(5)）'] =
      Array.isArray(fontSizes) && JSON.stringify(fontSizes) === JSON.stringify(REAL_FONT_SIZES)
    results['76/77 字体页含「字体宽度缩放倍数」与「字间距」'] =
      fontText.includes('字体宽度缩放倍数') && fontText.includes('字间距')
    results['字体样式 4 项：正常体/粗体/斜体/粗斜体（真机 combo 4 项）'] =
      JSON.stringify(fontStyles) === JSON.stringify(['正常体', '粗体', '斜体', '粗斜体'])
    results['79 字体页底部「示例」组有预览块'] = previewExists
    await closeProps()

    // ---------- 条码对象：常规页（DIFF-50 的另一半）+ 条码页（115…122） ----------
    if (!await openProps('barcode')) throw new Error('条码属性没打开')
    await click('[data-testid="object-props-tab-general"]'); await sleep(260)
    const barcodeAlignH = await optionTexts('[data-testid="obj-align-h"]')
    const barcodeAlignV = await optionTexts('[data-testid="obj-align-v"]')
    const barcodeAlignEnabled = await evaluate(`document.querySelector('[data-testid="obj-align-h"]')?.disabled === false`)
    results['DIFF-50 条码对象的「水平/垂直位置」可用且选项同真机（左齐/居中/右齐、顶部/居中/底部）'] =
      barcodeAlignEnabled === true &&
      JSON.stringify(barcodeAlignH) === JSON.stringify(['（保持当前位置）', '左齐', '居中', '右齐']) &&
      JSON.stringify(barcodeAlignV) === JSON.stringify(['（保持当前位置）', '顶部', '居中', '底部'])

    await click('[data-testid="object-props-tab-barcode"]'); await sleep(300)
    const symbologies = await optionTexts('[data-testid="barcode-symbology"]')
    const barcodeText = await evaluate(`document.querySelector('[data-testid=object-props-dialog]')?.innerText || ''`)
    results['115 条码页「条码符号类型(码制)」20 项且名称/顺序同真机下拉（DIFF-55）'] =
      Array.isArray(symbologies) && JSON.stringify(symbologies) === JSON.stringify(REAL_SYMBOLOGIES)
    results['116/119/120/121 条码页含 码高、供人识读字符（位置/垂直偏移/对齐方式）'] =
      barcodeText.includes('码 高') && barcodeText.includes('供人识读字符') &&
      barcodeText.includes('垂直偏移') && barcodeText.includes('对齐方式')
    const humanPositionOptions = await optionTexts('[data-testid="barcode-human-position"]')
    const humanAlignOptions = await optionTexts('[data-testid="barcode-human-align"]')
    results['119/121 供人识读字符位置 4 项（默认/无/条码上方/条码下方）与对齐 4 项（左齐/右齐/居中/撑满）同真机'] =
      JSON.stringify(humanPositionOptions) === JSON.stringify(['默认', '无', '条码上方', '条码下方']) &&
      JSON.stringify(humanAlignOptions) === JSON.stringify(['左齐', '右齐', '居中', '撑满'])
    // 字符集/校验字符等按码制变化的选项在「条码」页内的「条码特殊选项」分组（与真机同结构）
    await click('[data-testid="object-props-tab-barcode"]'); await sleep(300)
    const specialText = await evaluate(`document.querySelector('[data-testid="barcodeSpecial"]')?.innerText || ''`)
    results['118 条码页「条码特殊选项」分组含「字符集」（Code 128，同真机）'] = specialText.includes('字符集')
    await click('[data-testid="object-props-tab-barcode"]'); await sleep(280)

    // 新码制能真正选中并渲染（Pharmacode / Micro QR）
    const beforeRows = await rows()
    const pharmacodeOk = await setValue('[data-testid="object-props-dialog"] [data-testid="barcode-symbology"]', 'pharmacode')
    await sleep(600)
    await evaluate(`(() => { const d=document.querySelector('[data-testid=object-props-dialog]'); const b=[...d.querySelectorAll('button')].find((x)=>x.textContent.trim()==='确定'); b.click(); return true })()`)
    await sleep(600)
    const afterPharmacode = await rows()
    const pharmacodeValue = await evaluate(`document.querySelector('[data-testid="layer-object-row"][data-object-type="barcode"]')?.textContent?.includes('pharmacode')`)
    results['DIFF-55 新增码制 Pharmacode 能选中并渲染（对象数不变、图层显示 pharmacode）'] =
      pharmacodeOk === true && afterPharmacode.length === beforeRows.length && pharmacodeValue === true
    if (!await openProps('barcode')) throw new Error('条码属性第二次没打开')
    await click('[data-testid="object-props-tab-barcode"]'); await sleep(300)
    const microQrOk = await setValue('[data-testid="object-props-dialog"] [data-testid="barcode-symbology"]', 'microqrcode')
    await sleep(600)
    await evaluate(`(() => { const d=document.querySelector('[data-testid=object-props-dialog]'); const b=[...d.querySelectorAll('button')].find((x)=>x.textContent.trim()==='确定'); b.click(); return true })()`)
    await sleep(600)
    const microQrValue = await evaluate(`document.querySelector('[data-testid="layer-object-row"][data-object-type="barcode"]')?.textContent?.includes('microqrcode')`)
    results['DIFF-55 新增码制 Micro QR 能选中并渲染'] = microQrOk === true && microQrValue === true
    await closeProps()

    // 页面无异常
    const pageErrors = await evaluate(`(window.__maxlabelPageErrors ?? []).length`)
    results['页面无运行时异常'] = pageErrors === 0 || pageErrors === undefined

    let pass = 0
    for (const [name, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value); if (value) pass++ }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    client.ws.close()
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    for (const [name, value] of Object.entries(results)) console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
