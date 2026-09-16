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
    const dragCanvas = (x1, y1, x2, y2) => evaluate(`(() => {
      const canvas=document.querySelector('canvas.upper-canvas') || document.querySelector('canvas'); if(!canvas)return false
      const b=canvas.getBoundingClientRect(); const p=(x,y)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons:1})
      canvas.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1})))
      canvas.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2})))
      canvas.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2}),buttons:0})); return true
    })()`)
    /** 图层行的几何字段（x/y/w/h 单位毫米，画布默认 10px/mm）。 */
    const geomOf = (type) => evaluate(`(() => {
      const row=[...document.querySelectorAll('[data-testid="layer-object-row"]')].find((e)=>e.getAttribute('data-object-type')===${JSON.stringify(type)})
      if(!row)return null
      return { x:Number(row.getAttribute('data-object-x')), y:Number(row.getAttribute('data-object-y')), w:Number(row.getAttribute('data-object-w')), h:Number(row.getAttribute('data-object-h')) }
    })()`)
    const countOfType = (type) => evaluate(`document.querySelectorAll('[data-testid="layer-object-row"][data-object-type=${JSON.stringify(type)}]').length`)
    /** 按帮助原文的手势（鼠标左键双击对象）打开属性对话框：坐标取自图层行的毫米几何 × 10px/mm。 */
    const doubleClickObject = (type, ratioX = 0.5, ratioY = 0.5) => evaluate(`(() => {
      const canvas=document.querySelector('canvas.upper-canvas'); if(!canvas)return false
      const row=[...document.querySelectorAll('[data-testid="layer-object-row"]')].find((e)=>e.getAttribute('data-object-type')===${JSON.stringify(type)})
      if(!row)return false
      const b=canvas.getBoundingClientRect()
      const x=Number(row.getAttribute('data-object-x')), y=Number(row.getAttribute('data-object-y'))
      const w=Number(row.getAttribute('data-object-w')||40), h=Number(row.getAttribute('data-object-h')||8)
      const opts={bubbles:true,cancelable:true,view:window,clientX:b.left+(x*10+w*${ratioX}),clientY:b.top+(y*10+h*${ratioY}),detail:2,button:0}
      canvas.dispatchEvent(new MouseEvent('mousedown',{...opts,buttons:1}))
      canvas.dispatchEvent(new MouseEvent('mouseup',{...opts,buttons:0}))
      canvas.dispatchEvent(new MouseEvent('click',{...opts,buttons:0}))
      canvas.dispatchEvent(new MouseEvent('dblclick',{...opts,buttons:0}))
      return true
    })()`)
    /** 鼠标左键按住对象拖动（帮助第 5/10 步）。fromXRatio/fromYRatio 为对象内的相对落点。 */
    const dragObject = (type, dx, dy, fromXRatio = 0.5, fromYRatio = 0.5) => evaluate(`(() => {
      const canvas=document.querySelector('canvas.upper-canvas'); if(!canvas)return false
      const row=[...document.querySelectorAll('[data-testid="layer-object-row"]')].find((e)=>e.getAttribute('data-object-type')===${JSON.stringify(type)})
      if(!row)return false
      const b=canvas.getBoundingClientRect()
      const x=Number(row.getAttribute('data-object-x')), y=Number(row.getAttribute('data-object-y'))
      const w=Number(row.getAttribute('data-object-w')||40), h=Number(row.getAttribute('data-object-h')||8)
      const p=(cx,cy,buttons)=>({bubbles:true,cancelable:true,view:window,clientX:cx,clientY:cy,button:0,buttons,pointerId:1,pointerType:'mouse',isPrimary:true})
      const sx=b.left+(x*10+w*${fromXRatio}), sy=b.top+(y*10+h*${fromYRatio})
      const fire=(type,cx,cy,buttons)=>{
        canvas.dispatchEvent(new PointerEvent(type,p(cx,cy,buttons)))
        canvas.dispatchEvent(new MouseEvent(type,p(cx,cy,buttons)))
      }
      fire('pointerdown',sx,sy,1)
      fire('pointermove',sx+${dx}/2,sy+${dy}/2,1)
      fire('pointermove',sx+${dx},sy+${dy},1)
      fire('pointerup',sx+${dx},sy+${dy},0)
      return true
    })()`)
    /** 属性对话框是否打开（waitFor 需要的是表达式字符串，故单独留一份常量）。 */
    const PROPS_DIALOG = '!!document.querySelector(\'[data-testid="object-props-dialog"]\')'
    const dialogOpen = () => evaluate(PROPS_DIALOG)
    const confirmProps = async () => {
      await evaluate(`(() => { const d=document.querySelector('[data-testid="object-props-dialog"]'); if(!d)return false
        const btn=[...d.querySelectorAll('button')].find((b)=>(b.textContent||'').trim()==='确定'); if(!btn)return false; btn.click(); return true })()`)
      await sleep(320)
    }
    const closeProps = async () => {
      await evaluate(`document.querySelector('[data-testid="object-props-dialog"] button[aria-label]')?.click()`)
      await sleep(220)
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
    results['getstart_firstprint 第4步 点「确定」后属性对话框关闭且对象仍选中'] =
      (await dialogOpen()) === false &&
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
    await dragCanvas(60, 170, 180, 220); await sleep(520)
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
    const countSet = await setValue('[data-testid="print-dialog-count"]', '3'); await sleep(250)
    const countValue = await evaluate(`document.querySelector('[data-testid="print-dialog-count"]')?.value`)
    results['getstart_firstprint 第12步 打印对话框可输入打印数量'] =
      printOpen === true && countSet === true && countValue === '3'

    // ---- 第 13 步：点「预览」预览查看打印效果 ----
    const previewClicked = await click('[data-testid="print-dialog-preview"]')
    const previewShown = await waitFor(`[...document.querySelectorAll('div')].some((d)=>d.children.length===0 && (d.textContent||'').trim().startsWith('打印预览 · '))`, 8000)
    const previewImg = await evaluate(`(() => { const img=[...document.querySelectorAll('img')].find((i)=>i.getAttribute('alt')==='标签预览'); return { present: !!img, src: (img?.getAttribute('src')||'').slice(0,22) } })()`)
    results['getstart_firstprint 第13步 点「预览」出现打印预览效果'] =
      previewClicked === true && previewShown === true && previewImg.present === true && previewImg.src.startsWith('data:image/png')

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
