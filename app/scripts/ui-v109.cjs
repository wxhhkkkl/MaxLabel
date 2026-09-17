/* A-207 / A-208：help getstart_firstprint.html「编辑并打印第一个标签」第 3–13 步端到端走查。
 *
 * 帮助原文（逐字）：
 *   3、用鼠标点击工具栏上的“条码”工具，并在标签空白位置上按住鼠标左键拖动，放开左键后，就会排入一个条码对象。
 *   4、鼠标左键双击条码，出现条码属性，在“数据源”中修改显示数据为“6901234567892”，在“条码”中修改码制为“EAN13”，并“确定”。
 *   5、鼠标左键点击条码，并按住左键拖动条码到合适的位置。
 *   6、排入一个文字对象，并更改文字内容
 *   7、使用工具栏更改文字的字体和字号等。
 *   8、同样的方法排入产地和价格：
 *   9、排入图标，使用工具栏上的图标工具在模板上点击，放入一个图片，然后双击图片，在“图片”属性中“浏览图片”，找到需要排入的图片，并确认。
 *   10、使用鼠标拖动调整图片的大小和位置，完成标签模板的编辑
 *   11、保存标签模板…（云保存需注册登录 —— 已记录边界，见 parity/matrix.md A-207/A-208）
 *   12、打印标签，输入打印数量…也可以通过“预览”预览查看打印效果。
 *   13、预览效果
 *
 * 第 9 步的「浏览图片」是系统原生文件对话框，位于 CDP 上下文之外：run-regression.ps1 为
 * 本脚本设置 MAXLABEL_PICK_PATH（主进程 dialog:pickFile 在该变量存在时直接返回指定文件，
 * 与 template:open 的 MAXLABEL_OPEN_PATH 同一模式），脚本先落一张真实 PNG 再点「浏览图片」，
 * 断言图片真的被解码并载入预览。未设置该变量时主进程仍走真实对话框。
 */
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')
const WebSocket = require('ws')

/** 8×8 纯黑 PNG（单色黑白图，满足可参与可变颜色的图片口径）。 */
const FIXTURE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAADElEQVR4nGNgGB4AAADIAAGtQHYiAAAAAElFTkSuQmCC'

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
/** 页面侧未捕获异常 / console.error 的收集口（诊断用：断言失败时能看出是不是应用自己炸了）。 */
const pageErrors = []
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
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString())
      if (m.method === 'Runtime.exceptionThrown') {
        pageErrors.push('EXC ' + (m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text || ''))
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
        pageErrors.push('ERR ' + (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '))
      }
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
      const setter=Object.getOwnPropertyDescriptor(proto,'value').set
      setter.call(e,${JSON.stringify(String(value))})
      e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true
    })()`)
    const waitFor = async (expression, timeout = 4000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    /* ---- 画布手势：一律走 CDP Input 域 ----
     *
     * 在页面里 new MouseEvent / new PointerEvent 派发的是**不可信合成事件**：它们能触发
     * 编辑器自己挂在 fabric 上的 mouse:down（所以"拖拽创建对象"看起来是好的），但驱动不了
     * fabric 内部的拖拽变换机 —— `_currentTransform` 建立不起来，mousemove 阶段就没有对象
     * 可变换，表现为"对象拖不动"、"角把柄缩不了"。
     *
     * `Input.dispatchMouseEvent` 走的是浏览器真实输入管线，Chromium 会按 clickCount 合成
     * click/dblclick，fabric 的 pointer/mouse 事件与 transform 状态机都正常建立。仓库内
     * ui-v52 / ui-v53 / ui-v67 / ui-v91 / ui-v103 早已用同一手法驱动画布。
     */
    const canvasRect = () => evaluate(`(() => {
      const c=document.querySelector('canvas.upper-canvas') || document.querySelector('canvas'); if(!c)return null
      const b=c.getBoundingClientRect()
      return b.width>0 && b.height>0 ? { left:b.left, top:b.top, width:b.width, height:b.height } : null
    })()`)
    const press = (x, y, clickCount) => client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount })
    const moveTo = (x, y) => client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 })
    const release = (x, y, clickCount) => client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount })
    /** 场景像素 → 视口像素。画布在 100% 缩放下的 element 尺寸即标签场景尺寸，原点对齐（10px/mm）。 */
    const sceneToViewport = (sx, sy, rect) => ({ x: rect.left + sx, y: rect.top + sy })
    /** 工具栏对象工具：在标签上按住左键拖出区域创建对象（帮助第 3 / 6 / 8 / 9 步）。 */
    const dragCanvas = async (x1, y1, x2, y2) => {
      const rect = await canvasRect()
      if (!rect) return false
      const a = sceneToViewport(x1, y1, rect)
      const mid = sceneToViewport((x1 + x2) / 2, (y1 + y2) / 2, rect)
      const b = sceneToViewport(x2, y2, rect)
      await press(a.x, a.y, 1); await sleep(40)
      await moveTo(mid.x, mid.y); await sleep(40)
      await moveTo(b.x, b.y); await sleep(40)
      await release(b.x, b.y, 1)
      return true
    }
    /** 视口坐标处的真实双击（Chromium 按 clickCount=2 合成 dblclick）。 */
    const doubleClickAt = async (x, y) => {
      await press(x, y, 1); await release(x, y, 1); await sleep(50)
      await press(x, y, 2); await release(x, y, 2)
      return true
    }
    /** 标签编辑区尺寸（毫米），由 WorkArea 带到 DOM 上供断言核对。 */
    const labelSize = () => evaluate(`(() => {
      const a=document.querySelector('[data-testid="template-edit-area"]'); if(!a)return null
      return { w:Number(a.getAttribute('data-width-mm')), h:Number(a.getAttribute('data-height-mm')) }
    })()`)
    /** 全部图层对象的毫米包围盒（判定「该落点是否压到已有对象」用）。 */
    const allBoxes = () => evaluate(`[...document.querySelectorAll('[data-testid="layer-object-row"]')].map((r)=>({
      t:r.getAttribute('data-object-type'), x:Number(r.getAttribute('data-object-x')), y:Number(r.getAttribute('data-object-y')),
      w:Number(r.getAttribute('data-object-w')), h:Number(r.getAttribute('data-object-h')) }))`)
    /** 在标签内找一块 w×h（毫米）不与任何已有对象相交的空位，返回其中心点（毫米）。 */
    const findFreeSpot = async (wMm, hMm) => {
      const size = await labelSize()
      const boxes = await allBoxes()
      if (!size) return null
      const pad = 0.6
      const hits = (x, y) => boxes.some((b) => b.w > 0 && b.h > 0 &&
        x < b.x + b.w + pad && x + wMm > b.x - pad && y < b.y + b.h + pad && y + hMm > b.y - pad)
      for (let y = 0; y + hMm <= size.h; y += 1) {
        for (let x = 0; x + wMm <= size.w; x += 1) {
          if (!hits(x, y)) return { x: x + wMm / 2, y: y + hMm / 2, x0: x, y0: y }
        }
      }
      return null
    }
    /** 单击画布（帮助第 9 步「在模板上点击，放入一个图片」＝点击放置默认尺寸对象）。 */
    const clickCanvasAt = async (mmX, mmY) => {
      const rect = await canvasRect()
      if (!rect) return false
      const p = sceneToViewport(mmX * 10, mmY * 10, rect)
      await press(p.x, p.y, 1); await sleep(60); await release(p.x, p.y, 1)
      return true
    }
    /** 图层行的几何字段（x/y/w/h 单位毫米，画布默认 10px/mm）。 */
    const geomOf = (type) => evaluate(`(() => {
      const row=[...document.querySelectorAll('[data-testid="layer-object-row"]')].find((e)=>e.getAttribute('data-object-type')===${JSON.stringify(type)})
      if(!row)return null
      return { x:Number(row.getAttribute('data-object-x')), y:Number(row.getAttribute('data-object-y')), w:Number(row.getAttribute('data-object-w')), h:Number(row.getAttribute('data-object-h')) }
    })()`)
    const countOfType = (type) => evaluate(`document.querySelectorAll('[data-testid="layer-object-row"][data-object-type=${JSON.stringify(type)}]').length`)
    /** 对象在画布上的落点（视口像素）：图层行的毫米几何 × 10px/mm + 画布原点。 */
    const objectPoint = async (type, ratioX = 0.5, ratioY = 0.5) => {
      const rect = await canvasRect()
      if (!rect) return null
      const geom = await geomOf(type)
      if (!geom) return null
      // geom 的 x/y/w/h 单位是毫米，画布 10px/mm；w/h 必须一并换算，否则落点会贴到对象左上角
      // 而误抓把柄（曾把「拖动条码」变成拖角缩放）。
      return sceneToViewport((geom.x + geom.w * ratioX) * 10, (geom.y + geom.h * ratioY) * 10, rect)
    }
    /** 按帮助原文的手势（鼠标左键双击对象）打开属性对话框。 */
    const doubleClickObject = async (type, ratioX = 0.5, ratioY = 0.5) => {
      const point = await objectPoint(type, ratioX, ratioY)
      if (!point) return false
      return doubleClickAt(point.x, point.y)
    }
    /** 鼠标左键按住对象拖动（帮助第 5/10 步）。fromXRatio/fromYRatio 为对象内的相对落点。 */
    const dragObject = async (type, dx, dy, fromXRatio = 0.5, fromYRatio = 0.5) => {
      const point = await objectPoint(type, fromXRatio, fromYRatio)
      if (!point) return false
      await press(point.x, point.y, 1); await sleep(60)
      await moveTo(point.x + dx / 2, point.y + dy / 2); await sleep(60)
      await moveTo(point.x + dx, point.y + dy); await sleep(60)
      await release(point.x + dx, point.y + dy, 1)
      return true
    }
    /** 属性对话框是否打开（waitFor 需要的是表达式字符串，故单独留一份常量）。 */
    const PROPS_DIALOG = '!!document.querySelector(\'[data-testid="object-props-dialog"]\')'
    const dialogOpen = () => evaluate(PROPS_DIALOG)
    /* 关闭属性框后必须等**遮罩真正从 DOM 卸载**再发画布手势：模态遮罩是 position:fixed
     * 覆盖全屏的，只要它还挂在树上，CDP Input 的鼠标事件就落在遮罩而不是画布上，表现为
     * 紧随其后的「拖动对象 / 拖拽创建」全部无效（不是 canvas 收不到，是被挡住）。 */
    let propsDialogStuck = false
    const waitDialogGone = async (timeout = 2500) => {
      const gone = await waitFor(`!document.querySelector('[data-testid="object-props-dialog"]')`, timeout)
      if (!gone) propsDialogStuck = true
      await sleep(260)
      return gone
    }
    const confirmProps = async () => {
      await evaluate(`(() => { const d=document.querySelector('[data-testid="object-props-dialog"]'); if(!d)return false
        const btn=[...d.querySelectorAll('button')].find((b)=>(b.textContent||'').trim()==='确定'); if(!btn)return false; btn.click(); return true })()`)
      await waitDialogGone()
    }
    const closeProps = async () => {
      await evaluate(`document.querySelector('[data-testid="object-props-dialog"] button[aria-label]')?.click()`)
      await waitDialogGone()
    }
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return true })()`)

    // 第 9 步的图片素材：先落盘真实 PNG，MAXLABEL_PICK_PATH 由 run-regression.ps1 指向同一路径。
    const fixturePng = path.join(os.tmpdir(), 'maxlabel-pick-fixture.png')
    fs.writeFileSync(fixturePng, Buffer.from(FIXTURE_PNG_BASE64, 'base64'))

    // ---- 第 1–2 步：新建标签模板（帮助：工具栏或菜单新建 → 新建标签格式对话框 → 「选择」）----
    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(350)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(320)
    }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas")', 8000)) throw new Error('editor did not open')
    // 折叠缩放固定为 100%，使「拖动对象」的像素坐标可从图层行几何直接换算（10px/mm）
    await setValue('[data-testid="zoom-level"]', '1'); await sleep(300)

    // ---- 第 3 步：工具栏「条码」工具 → 标签空白位置按住左键拖动 → 排入条码对象 ----
    const barcodeTool = await evaluate(`(() => { const b=document.querySelector('[data-tool="barcode"]'); return !!b && !b.disabled })()`)
    const beforeBarcode = await countOfType('barcode')
    await click('[data-tool="barcode"]'); await sleep(150)
    await dragCanvas(60, 30, 220, 110); await sleep(500)
    results['getstart_firstprint 第3步 工具栏「条码」工具拖拽后排入条码对象'] =
      barcodeTool === true && beforeBarcode === 0 && (await countOfType('barcode')) === 1

    // ---- 第 4 步：鼠标左键双击条码 → 条码属性 ----
    await click('[data-tool="select"]'); await sleep(150)
    const dbl = await doubleClickObject('barcode')
    results['getstart_firstprint 第4步 鼠标左键双击条码打开条码属性对话框'] =
      dbl === true && await waitFor(PROPS_DIALOG, 4000)
    // 页签名沿用帮助原文（数据源 / 条码）
    const tabLabels = await evaluate(`([...document.querySelectorAll('[data-testid="object-props-dialog"] [data-testid^="object-props-tab-"]')].map((e)=>(e.textContent||'').trim()))`)
    results['getstart_firstprint 第4步 条码属性含「数据」与「条码」页签'] =
      Array.isArray(tabLabels) && tabLabels[0] === '通用' && tabLabels.includes('条码') && tabLabels.includes('数据')

    // 在“数据源”中修改显示数据为“6901234567892”
    await click('[data-testid="object-props-tab-datasource"]'); await sleep(220)
    await click('[data-testid="source-kind-constant"]'); await sleep(200)
    const dataWritten = await setValue('[data-testid="constant-source-value"]', '6901234567892')
    await sleep(200)
    results['getstart_firstprint 第4步 「数据」页把显示数据改为 6901234567892'] =
      dataWritten === true && (await evaluate(`document.querySelector('[data-testid="constant-source-value"]')?.value`)) === '6901234567892'

    // 在“条码”中修改码制为“EAN13”
    await click('[data-testid="object-props-tab-barcode"]'); await sleep(220)
    const symbologyOptions = await evaluate(`[...(document.querySelector('[data-testid="barcode-symbology"]')?.options||[])].map((o)=>o.value)`)
    const symbologySet = await setValue('[data-testid="barcode-symbology"]', 'ean13'); await sleep(250)
    results['getstart_firstprint 第4步 「条码」页可把码制改为 EAN13'] =
      Array.isArray(symbologyOptions) && symbologyOptions.includes('ean13') && symbologySet === true &&
      (await evaluate(`document.querySelector('[data-testid="barcode-symbology"]')?.value`)) === 'ean13'

    // 并“确定”
    await confirmProps()
    results['getstart_firstprint 第4步 点「确定」后属性对话框关闭（遮罩未卡住）且对象仍选中'] =
      propsDialogStuck === false && (await dialogOpen()) === false &&
      (await evaluate(`!!document.querySelector('[data-testid="layer-object-row"][data-object-type="barcode"][data-selected="true"]')`)) === true

    // 回读：重新打开属性页，数据与码制确实写进了文档（而不是只停留在对话框草稿里）
    await doubleClickObject('barcode'); await waitFor(PROPS_DIALOG, 4000)
    await click('[data-testid="object-props-tab-datasource"]'); await sleep(200)
    const readBackData = await evaluate(`document.querySelector('[data-testid="constant-source-value"]')?.value`)
    await click('[data-testid="object-props-tab-barcode"]'); await sleep(200)
    const readBackSymbology = await evaluate(`document.querySelector('[data-testid="barcode-symbology"]')?.value`)
    results['getstart_firstprint 第4步 重新打开属性页可回读到 6901234567892 / EAN13'] =
      readBackData === '6901234567892' && readBackSymbology === 'ean13'
    await closeProps()

    // ---- 第 5 步：鼠标左键点击条码，并按住左键拖动条码到合适的位置 ----
    const barcodeBefore = await geomOf('barcode')
    await dragObject('barcode', 40, 30); await sleep(400)
    const barcodeAfter = await geomOf('barcode')
    results['getstart_firstprint 第5步 按住左键拖动条码后位置改变'] =
      barcodeBefore !== null && barcodeAfter !== null &&
      (Math.abs(barcodeAfter.x - barcodeBefore.x) > 0.5 || Math.abs(barcodeAfter.y - barcodeBefore.y) > 0.5)

    // ---- 第 6 步：排入一个文字对象，并更改文字内容 ----
    await click('[data-tool="text"]'); await sleep(150)
    await dragCanvas(60, 130, 220, 165); await sleep(420)
    await click('[data-tool="select"]'); await sleep(150)
    const textPlaced = (await countOfType('text')) === 1
    await doubleClickObject('text'); await waitFor(PROPS_DIALOG, 4000)
    await click('[data-testid="object-props-tab-datasource"]'); await sleep(220)
    await click('[data-testid="source-kind-constant"]'); await sleep(200)
    await setValue('[data-testid="constant-source-value"]', '产地：北京'); await sleep(200)
    await confirmProps()
    await doubleClickObject('text'); await waitFor(PROPS_DIALOG, 4000)
    await click('[data-testid="object-props-tab-datasource"]'); await sleep(220)
    const textContent = await evaluate(`document.querySelector('[data-testid="constant-source-value"]')?.value`)
    results['getstart_firstprint 第6步 排入文字对象并把文字内容改为「产地：北京」'] =
      textPlaced === true && textContent === '产地：北京'
    await closeProps()

    // ---- 第 7 步：使用工具栏更改文字的字体和字号 ----
    // 文字对象在第 6 步点「确定」后仍处于选中态；图层行是切换式点选，已选中时再点会取消选中。
    await evaluate(`(() => { const row=document.querySelector('[data-testid="layer-object-row"][data-object-type="text"]'); if(row && row.getAttribute('data-selected')!=='true') row.click(); return true })()`)
    await sleep(250)
    const fontBar = await evaluate(`(() => {
      const fam=document.querySelector('[data-testid="format-font-family"]')
      const size=document.querySelector('[data-testid="format-font-size"]')
      return { famDisabled: !!fam?.disabled, sizeDisabled: !!size?.disabled,
        families: [...(fam?.options||[])].map((o)=>o.value), sizes: [...(size?.options||[])].map((o)=>o.value) }
    })()`)
    const targetFamily = fontBar.families[1]
    const targetSize = fontBar.sizes.includes('24') ? '24' : fontBar.sizes[1]
    const familySet = await setValue('[data-testid="format-font-family"]', targetFamily); await sleep(280)
    const sizeSet = await setValue('[data-testid="format-font-size"]', targetSize); await sleep(280)
    const appliedFamily = await evaluate(`document.querySelector('[data-testid="format-font-family"]')?.value`)
    const appliedSize = await evaluate(`document.querySelector('[data-testid="format-font-size"]')?.value`)
    results['getstart_firstprint 第7步 选中文字后格式栏的字体与字号可用'] =
      fontBar.famDisabled === false && fontBar.sizeDisabled === false && fontBar.families.length > 1 && fontBar.sizes.length > 1
    results['getstart_firstprint 第7步 改字体与字号后格式栏回显新值'] =
      familySet === true && sizeSet === true && appliedFamily === targetFamily &&
      Math.abs(parseFloat(appliedSize) - parseFloat(targetSize)) < 0.5

    // ---- 第 8 步：同样的方法排入产地和价格 ----
    await click('[data-tool="text"]'); await sleep(150)
    await dragCanvas(240, 30, 400, 65); await sleep(400)
    await click('[data-tool="text"]'); await sleep(150)
    await dragCanvas(240, 80, 400, 115); await sleep(400)
    await click('[data-tool="select"]'); await sleep(200)
    results['getstart_firstprint 第8步 同样的方法再排入两个文字对象（产地与价格）'] = (await countOfType('text')) === 3

    // ---- 第 9 步：图片工具在模板上点击放入图片，双击图片 →「图片」属性 →「浏览图片」 ----
    await click('[data-tool="image"]'); await sleep(150)
    const imgToolActive = await evaluate(`document.querySelector('[data-tool="image"]')?.getAttribute('data-active') === 'true' || !!document.querySelector('[data-tool="image"][aria-pressed="true"]')`)
    // 帮助原文是「在模板上点击」（而不是拖动）：图片工具单击即以默认帧尺寸排入。
    // 落点必须避开已有对象的**实际包围盒**——文字帧会随第 7 步的字号变化而增宽，
    // 压到已有对象上时 LabelEditor 的 mouse:down 会判定为「点在已有对象上」并放弃绘制
    // （LabelEditor.tsx 的 `点击在已有对象上时不启动拖拽绘制`）。
    const spot = await findFreeSpot(24, 16)
    // 单击创建以落点为对象左上角（LabelEditor mouse:up 的 mmX/mmY 即按下点），故点空位左上角。
    if (spot) await clickCanvasAt(spot.x0, spot.y0); await sleep(520)
    if ((await countOfType('image')) !== 1) {
      console.log('DIAG9 image-not-placed; toolActive=', imgToolActive, 'spot=', spot,
        '标签尺寸mm=', await labelSize(), 'canvasRect=', await canvasRect(),
        '该区域命中的现有对象=', await allBoxes())
    }
    await click('[data-tool="select"]'); await sleep(150)
    const imagePlaced = (await countOfType('image')) === 1
    await doubleClickObject('image'); await waitFor(PROPS_DIALOG, 4000)
    results['getstart_firstprint 第9步 双击图片打开「图片」属性页'] =
      imagePlaced === true && (await evaluate(`!!document.querySelector('[data-testid="object-props-dialog"] [data-testid="object-props-tab-image"]')`)) === true
    // 「浏览图片」在该页签的面板内，先切到「图片」页签
    await click('[data-testid="object-props-tab-image"]'); await sleep(300)
    const browseEntry = await evaluate(`(() => { const b=document.querySelector('[data-testid="image-browse"]'); return !!b && !b.disabled && (b.textContent||'').includes('浏览图片') })()`)
    const fileTypeDefault = await evaluate(`(() => { const s=document.querySelector('[data-testid="image-file-type"]'); if(!s)return null; return { selected: s.value, first: s.options[0]?.value, selectedIndex: s.selectedIndex } })()`)
    results['getstart_firstprint 第9步 「图片」属性提供「浏览图片」入口'] = browseEntry === true
    results['getstart_firstprint 第9步 文件类型默认选中「所有支持的图象文件」'] =
      fileTypeDefault !== null && fileTypeDefault.selectedIndex === 0 && fileTypeDefault.selected === fileTypeDefault.first
    const browseClicked = await click('[data-testid="image-browse"]')
    await sleep(700)
    const picked = await evaluate(`(() => { const img=document.querySelector('[data-testid="image-preview"] img'); return { hasPreview: !!img, src: img?.getAttribute('src') || '', msg: document.querySelector('[data-testid="object-props-dialog"]')?.innerText || '' } })()`)
    results['getstart_firstprint 第9步 点「浏览图片」选中本地图片后载入预览（图片已解码）'] =
      browseClicked === true && picked.hasPreview === true && picked.src.startsWith('data:image/png') && !/无法解码/.test(picked.msg)
    await confirmProps()
    // 帮助第 10 步是在画布上用鼠标拖动，前提是属性框已「确定」关闭
    results['getstart_firstprint 第9步 点「确定」后图片属性对话框关闭'] = (await dialogOpen()) === false

    // ---- 第 10 步：使用鼠标拖动调整图片的大小和位置 ----
    const imageBefore = await geomOf('image')
    await dragObject('image', 30, 5, 0.5, 0.5); await sleep(400)
    const imageMoved = await geomOf('image')
    results['getstart_firstprint 第10步 拖动图片后位置改变'] =
      imageBefore !== null && imageMoved !== null &&
      (Math.abs(imageMoved.x - imageBefore.x) > 0.5 || Math.abs(imageMoved.y - imageBefore.y) > 0.5)
    await dragObject('image', 50, 10, 1, 1); await sleep(450)
    const imageResized = await geomOf('image')
    results['getstart_firstprint 第10步 拖动角把柄调整图片大小'] =
      imageResized !== null && (imageResized.w !== imageMoved.w || imageResized.h !== imageMoved.h)

    // ---- 第 12 步：打印标签，输入打印数量 ----
    await key('p', { ctrlKey: true, code: 'KeyP' }); await sleep(700)
    const printOpen = await waitFor(`!!document.querySelector('[data-testid="print-dialog"]')`, 4000)
    if (!printOpen) {
      console.log('DIAGP no-print-dialog; dialogs=', await evaluate(`(() => [...document.querySelectorAll('[role="dialog"],[aria-modal="true"]')].map((d)=>d.getAttribute('data-testid')||d.className||d.tagName))()`),
        '模态状态=', await evaluate(`document.querySelector('[data-testid="object-props-dialog"]')?'props':(document.querySelector('[data-testid="keyboard-input-modal"]')?'kbd':'无')`))
    }
    const countSet = await setValue('[data-testid="print-dialog-count"]', '3'); await sleep(250)
    const countValue = await evaluate(`document.querySelector('[data-testid="print-dialog-count"]')?.value`)
    results['getstart_firstprint 第12步 打印对话框可输入打印数量'] =
      printOpen === true && countSet === true && countValue === '3'
    if (!results['getstart_firstprint 第12步 打印对话框可输入打印数量']) {
      console.log('DIAGC12 countSet=', countSet, 'value=', JSON.stringify(countValue),
        'input=', await evaluate(`(() => { const e=document.querySelector('[data-testid="print-dialog-count"]'); return e?{disabled:e.disabled,value:e.value,type:e.type}:null })()`),
        'currentOnly=', await evaluate(`document.querySelector('[data-testid="print-option-current-only"]')?.checked`),
        'copies=', await evaluate(`document.querySelector('[data-testid="print-dialog-copies"]')?.value`))
    }

    // ---- 第 13 步：点「预览」预览查看打印效果 ----
    // 预览走主进程另开一个 BrowserWindow（src/main/previewWindow.ts），因此断言必须落到那个
    // CDP 目标上：单页 1/N、尺寸标注、页面里的 img 指向真实 PNG 文件。预览窗口的页数取自
    // 打印对话框的「打印数量」（第 12 步输入 3），而不是停靠面板的数量。
    const previewClicked = await click('[data-testid="print-dialog-preview"]')
    let previewTarget = null
    for (let attempt = 0; attempt < 50 && !previewTarget; attempt++) {
      await sleep(200)
      try {
        const list = await getJson(`http://127.0.0.1:${port}/json/list`)
        previewTarget = list.find((item) => item.type === 'page' && /maxlabel-prev-/.test(item.url || '')) || null
      } catch { /* 调试端口偶发未就绪，继续轮询 */ }
    }
    let previewInfo = { title: '', sizeText: '', pageText: '', imgSrc: '', imgAlt: '' }
    if (previewTarget) {
      const pv = await attach(previewTarget.webSocketDebuggerUrl)
      try {
        const pvEval = async (expression) => {
          const r = await pv.send('Runtime.evaluate', { expression, returnByValue: true })
          return r.result?.value
        }
        for (let attempt = 0; attempt < 25; attempt++) {
          previewInfo = await pvEval(`(() => ({
            title: document.title,
            sizeText: (document.querySelector('.bar .s')?.textContent||'').trim(),
            pageText: (document.querySelector('#ppage')?.textContent||'').trim(),
            imgSrc: (document.querySelector('.page.active img')?.getAttribute('src')||'').slice(0,5),
            imgAlt: document.querySelector('.page.active img')?.tagName||'' }))()`)
          if (previewInfo.pageText) break
          await sleep(200)
        }
      } finally { pv.ws.close() }
    } else {
      console.log('DIAGP13 预览窗口未出现；当前 CDP 目标=', (await getJson(`http://127.0.0.1:${port}/json/list`)).map((i) => i.url))
    }
    // 预览按**整页**输出：窗口标题栏标注的是整页尺寸（默认标签格式为 A4 210 × 297 mm 的 2×4 版面，
    // 单张标签 100 × 70 mm），页码是 1/N（N = 需要输出的页数，一页装 cellsPerPage 张），
    // 故不能拿标签尺寸或第 12 步的数量去比对。
    const previewExpectedSize = await labelSize()
    const previewSize = /^(\d+(?:\.\d+)?) × (\d+(?:\.\d+)?) mm/.exec(previewInfo.sizeText)
    results['getstart_firstprint 第13步 点「预览」打开打印预览窗口展示标签效果'] =
      previewClicked === true && previewTarget !== null &&
      previewInfo.title === '打印预览' &&
      /^1\/\d+$/.test(previewInfo.pageText) && previewInfo.imgSrc === 'file:' &&
      previewSize !== null &&
      Number(previewSize[1]) >= (previewExpectedSize?.w ?? Infinity) &&
      Number(previewSize[2]) >= (previewExpectedSize?.h ?? Infinity)
    if (!results['getstart_firstprint 第13步 点「预览」打开打印预览窗口展示标签效果']) {
      console.log('DIAGP13 clicked=', previewClicked, 'target=', previewTarget?.url || null, 'info=', previewInfo, 'labelSize=', previewExpectedSize)
    }

    let pass = 0
    for (const [name, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value); if (value) pass++ }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    if (Object.values(results).some((v) => !v)) {
      console.log('DIAGERR page-errors=', pageErrors.length ? pageErrors.join(' | ') : '（无）')
      console.log('DIAGEND counts=', await evaluate(`(() => { const c={}; document.querySelectorAll('[data-testid="layer-object-row"]').forEach((r)=>{const t=r.getAttribute('data-object-type'); c[t]=(c[t]||0)+1}); return c })()`),
        '工具=', await evaluate(`document.querySelector('[data-tool][aria-pressed="true"]')?.getAttribute('data-tool') || document.querySelector('[data-tool].active')?.getAttribute('data-tool') || '无'`),
        '应用根节点存在=', await evaluate(`!!document.querySelector('#root')?.firstElementChild`))
    }
    client.ws.close()
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
