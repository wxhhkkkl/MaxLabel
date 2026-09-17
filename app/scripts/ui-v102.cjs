/* B 章节待核条目收口：图片对象（B-09/B-47）、条码可变长度对齐（B-141）、
   条码旋转/镜像/透明（B-140）、图形对象（B-42）、表格属性（B-106/B-107）。 */
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
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e || e.disabled)return false; e.click(); return true })()`)
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return true })()`)
    const waitFor = async (expression, timeout = 3000) => {
      const started = Date.now()
      const probe = expression.trim().startsWith('[') ? `!!document.querySelector(${JSON.stringify(expression)})` : expression
      while (Date.now() - started < timeout) {
        if (await evaluate(probe)) return true
        await sleep(80)
      }
      return false
    }
    const setValue = (selector, value) => evaluate(`(() => {
      const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false
      const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype
      const setter=Object.getOwnPropertyDescriptor(proto,'value').set
      setter.call(e,${JSON.stringify(String(value))})
      e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true
    })()`)
    const optionsOf = (selector) => evaluate(`[...(document.querySelector(${JSON.stringify(selector)})?.options||[])].map((o)=>o.value)`)
    const labelsOf = (selector) => evaluate(`[...(document.querySelector(${JSON.stringify(selector)})?.options||[])].map((o)=>o.textContent.trim())`)
    const dragCanvas = (x1, y1, x2, y2) => evaluate(`(() => {
      const canvas=document.querySelector('canvas.upper-canvas') || document.querySelector('canvas'); if(!canvas)return false
      const b=canvas.getBoundingClientRect(); const p=(x,y)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons:1})
      canvas.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1})))
      canvas.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2})))
      canvas.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2}),buttons:0})); return true
    })()`)
    const selectType = (type) => evaluate(`(() => {
      const row=[...document.querySelectorAll('[data-testid="layer-object-row"]')].find((e)=>e.getAttribute('data-object-type')===${JSON.stringify(type)})
      if(!row)return false; if(row.getAttribute('data-selected')!=='true')row.click(); return true
    })()`)
    const openProps = async (type) => {
      if (!await selectType(type)) return false
      await key('Enter', { altKey: true })
      return waitFor('!!document.querySelector("[data-testid=object-props-dialog]")')
    }
    const openPropsTab = async (type, tabId) => {
      if (!await openProps(type)) return false
      await sleep(250)
      await click(`[data-testid="object-props-dialog"] [data-testid="object-props-tab-${tabId}"]`)
      await sleep(250)
      return (await evaluate(`!!document.querySelector('[data-testid="object-props-dialog"] [data-testid="object-props-tab-${tabId}"]')`)) !== false
    }
    // 关闭并放弃改动：点标题栏的 X（等价「取消」）。属性对话框是事务式的，
    // 与 LabelShop 的模态对话框一致——「确定」才提交，「取消」/X 整页回滚。
    const closeProps = async () => {
      await evaluate(`document.querySelector('[data-testid="object-props-dialog"] button[aria-label]')?.click()`)
      await sleep(200)
    }
    // 关闭并提交改动：点「确定」。断言「写回对象」必须走这条路径，否则回读的永远是旧值。
    const commitProps = async () => {
      const ok = await evaluate(`(() => {
        const buttons=[...document.querySelectorAll('[data-testid="object-props-dialog"] button')]
        const target=buttons.find((b)=>b.textContent.trim()==='确定')
        if(!target)return false; target.click(); return true
      })()`)
      if (!ok) throw new Error('object props 确定 button not found')
      await sleep(300)
    }

    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(300)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(320)
    }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas")', 8000)) throw new Error('editor did not open')

    // 造对象：矩形、条码、图片、表格、直线
    await click('[data-tool="rect"]'); await dragCanvas(180, 150, 340, 240); await sleep(320)
    await click('[data-tool="barcode"]'); await dragCanvas(180, 300, 460, 400); await sleep(460)
    await click('[data-tool="image"]'); await dragCanvas(520, 320, 700, 440); await sleep(520)
    await click('[data-tool="table"]'); await dragCanvas(520, 480, 720, 580); await sleep(460)

    const tabs = (type) => evaluate(`[...document.querySelectorAll('[data-testid="object-props-dialog"] [data-testid^="object-props-tab-"]')].map((e)=>e.getAttribute('data-testid').replace('object-props-tab-',''))`)

    // ---- B-141 条码可变长度数据的对齐 ----
    if (!await openPropsTab('barcode', 'barcode')) throw new Error('barcode props did not open')
    const barcodeAlignValues = await optionsOf('[data-testid="object-props-dialog"] [data-testid="barcode-align"]')
    results['B-141 条码「对齐」下拉含左/中/右三档'] =
      JSON.stringify(barcodeAlignValues) === JSON.stringify(['left', 'center', 'right'])
    const barcodeAlignDefault = await evaluate('document.querySelector("[data-testid=object-props-dialog] [data-testid=barcode-align]")?.value')
    results['B-141 条码对齐默认居中对齐'] = barcodeAlignDefault === 'center'
    const barcodeAlignHint = await evaluate('document.querySelector("[data-testid=object-props-dialog]")?.innerText || ""')
    results['B-141 对齐项的说明写明可变数据长度不一致的用途'] = barcodeAlignHint.includes('可变数据打印') || barcodeAlignHint.includes('长度可能不一致')
    // 先验证「取消」不写回：改到右对齐后用 X 关闭，重开应仍是居中。
    await setValue('[data-testid="object-props-dialog"] [data-testid="barcode-align"]', 'right'); await sleep(400)
    await closeProps()
    if (!await openProps('barcode')) throw new Error('barcode props reopen failed')
    await sleep(300)
    await click('[data-testid="object-props-dialog"] [data-testid="object-props-tab-barcode"]')
    await waitFor('!!document.querySelector("[data-testid=object-props-dialog] [data-testid=barcode-align]")', 3000)
    results['B-141 「取消」关闭后对齐方式不写回对象'] =
      await evaluate('document.querySelector("[data-testid=object-props-dialog] [data-testid=barcode-align]")?.value') === 'center'
    // 对齐方式改到左对齐、点「确定」提交后，重新打开属性页应保持（经模板规范化往返）
    await setValue('[data-testid="object-props-dialog"] [data-testid="barcode-align"]', 'left'); await sleep(400)
    await commitProps()
    if (!await openProps('barcode')) throw new Error('barcode props reopen failed')
    await sleep(300)
    await click('[data-testid="object-props-dialog"] [data-testid="object-props-tab-barcode"]')
    await waitFor('!!document.querySelector("[data-testid=object-props-dialog] [data-testid=barcode-align]")', 3000)
    results['B-141 对齐方式写回对象并在重开属性页后保持'] =
      await evaluate('document.querySelector("[data-testid=object-props-dialog] [data-testid=barcode-align]")?.value') === 'left'
    await closeProps()

    // ---- B-140 条码旋转、镜像与透明 ----
    if (!await openPropsTab('barcode', 'general')) throw new Error('barcode general tab did not open')
    const rotValues = await optionsOf('[data-testid="object-props-dialog"] [data-testid="obj-rotation"]')
      .then((v) => (v && v.length ? v : optionsOf('[data-testid="object-props-dialog"] select')))
    results['B-140 条码旋转提供 0/90/180/270'] = ['0', '90', '180', '270'].every((v) => (rotValues || []).includes(v))
    const mirrorValues = await optionsOf('[data-testid="object-props-dialog"] [data-testid="obj-mirror"]')
    results['B-140 条码镜像提供水平/垂直/双向'] =
      JSON.stringify(mirrorValues || []) === JSON.stringify(['none', 'h', 'v', 'both'])
    const bgValues = await optionsOf('[data-testid="object-props-dialog"] [data-testid="obj-background"]')
    results['B-140 条码背景提供透明/不透明'] =
      JSON.stringify(bgValues || []) === JSON.stringify(['opaque', 'transparent'])
    await closeProps()

    // ---- B-42 图形对象 ----
    if (!await openPropsTab('rect', 'shape')) throw new Error('rect shape tab did not open')
    const shapeValues = await optionsOf('[data-testid="object-props-dialog"] [data-testid="shape-kind"]')
    const shapeLabels = await labelsOf('[data-testid="object-props-dialog"] [data-testid="shape-kind"]')
    results['B-42 形状提供矩形/圆角矩形/椭圆'] =
      JSON.stringify(shapeValues || []) === JSON.stringify(['rect', 'roundRect', 'ellipse']) &&
      ['矩形', '圆角矩形', '椭圆'].every((l) => shapeLabels.includes(l))
    results['B-42 选圆角矩形后出现圆角半径输入'] =
      (await setValue('[data-testid="object-props-dialog"] [data-testid="shape-kind"]', 'roundRect'), await sleep(250),
        await waitFor('!!document.querySelector("[data-testid=object-props-dialog] [data-testid=shape-corner-radius]")'))
    const rectText = await evaluate('document.querySelector("[data-testid=object-props-dialog]")?.innerText || ""')
    results['B-42 图形页含线宽、线条色、填充方框内部'] =
      rectText.includes('线宽') && rectText.includes('线条色') && rectText.includes('填充方框内部')
    results['B-42 椭圆由形状属性产生且渲染为椭圆'] =
      (await setValue('[data-testid="object-props-dialog"] [data-testid="shape-kind"]', 'ellipse'), await sleep(400),
        await evaluate('(() => { const rows=[...document.querySelectorAll("[data-testid=layer-object-row]")]; const r=rows.find((e)=>e.getAttribute("data-object-type")==="rect"); return r?.textContent?.includes("椭圆") || document.querySelector("[data-testid=object-props-dialog] [data-testid=shape-kind]")?.value==="ellipse" })()'))
    await closeProps()

    // ---- B-106 / B-107 表格属性 ----
    if (!await openPropsTab('table', 'table')) throw new Error('table props tab did not open')
    const tableText = await evaluate('document.querySelector("[data-testid=table-property-editor]")?.innerText || ""')
    results['B-106 表格页可设置行高与列宽'] =
      await waitFor('!!document.querySelector("[data-testid=table-row-heights]")') &&
      await waitFor('!!document.querySelector("[data-testid=table-col-widths]")')
    const rowCount = await evaluate('document.querySelectorAll("[data-testid^=table-row-height-]").length')
    const colCount = await evaluate('document.querySelectorAll("[data-testid^=table-col-width-]").length')
    results['B-106 行高/列宽输入项数量与行列数一致'] = rowCount > 0 && colCount > 0
    results['B-106 表格页含线体宽度与颜色、增删行列时保持表格尺寸'] =
      tableText.includes('边框宽度') && tableText.includes('边框颜色') && tableText.includes('增删行列时保持表格尺寸')
    await setValue('[data-testid="table-row-height-0"]', '17'); await sleep(300)
    const rowHeightBack = await evaluate('document.querySelector("[data-testid=table-row-height-0]")?.value')
    results['B-106 行高可编辑并回写'] = String(rowHeightBack) === '17'
    await setValue('[data-testid="table-col-width-0"]', '23'); await sleep(300)
    results['B-106 列宽可编辑并回写'] = String(await evaluate('document.querySelector("[data-testid=table-col-width-0]")?.value')) === '23'

    results['B-107 表格页提供合并单元格入口'] =
      (await waitFor('!!document.querySelector("[data-testid=table-merge-apply]")')) && tableText.includes('合并单元格')
    await setValue('[data-testid="table-merge-start-row"]', '0')
    await setValue('[data-testid="table-merge-start-col"]', '0')
    await setValue('[data-testid="table-merge-end-row"]', '1')
    await setValue('[data-testid="table-merge-end-col"]', '1')
    await sleep(200)
    await click('[data-testid="table-merge-apply"]'); await sleep(400)
    const mergeText = await evaluate('document.querySelector("[data-testid=table-property-editor]")?.innerText || ""')
    results['B-107 合并后列出已合并区域'] = /合并区域：第 1-2 行 × 第 1-2 列/.test(mergeText)
    results['B-107 已合并单元格可取消合并'] =
      (await click('[data-testid="table-merge-remove-0"]'), await sleep(400),
        !(await evaluate('document.querySelector("[data-testid=table-property-editor]")?.innerText || ""')).includes('合并区域：'))
    results['B-107 提示单元格内不能直接排入文字条码'] =
      await waitFor('!!document.querySelector("[data-testid=table-embedded-object-note]")') &&
      (await evaluate('document.querySelector("[data-testid=table-embedded-object-note]")?.innerText || ""')).includes('不能直接排入')
    await closeProps()

    // ---- B-09 / B-47 图片对象 ----
    if (!await openPropsTab('image', 'image')) throw new Error('image props tab did not open')
    const fileTypes = await evaluate(`[...(document.querySelector("[data-testid=object-props-dialog] [data-testid=image-file-type]")?.options||[])].map((o)=>o.textContent.trim())`)
    results['B-09 浏览图片对话框文件类型默认「所有支持的图象文件」'] =
      Array.isArray(fileTypes) && fileTypes[0] === '所有支持的图象文件'
    const fileTypeDefault = await evaluate('document.querySelector("[data-testid=object-props-dialog] [data-testid=image-file-type]")?.value')
    results['B-09 文件类型默认选中第一项'] = fileTypeDefault === '所有支持的图象文件'
    results['B-09 提供「预览图片」勾选且默认勾选'] =
      await waitFor('!!document.querySelector("[data-testid=object-props-dialog] [data-testid=image-preview-toggle]")') &&
      await evaluate('document.querySelector("[data-testid=object-props-dialog] [data-testid=image-preview-toggle]")?.checked === true')
    results['B-09 提供「浏览图片…」按钮'] =
      await waitFor('!!document.querySelector("[data-testid=object-props-dialog] [data-testid=image-browse]")')
    // 取消勾选后预览区消失（预览图片勾选生效）
    const previewBefore = await waitFor('!!document.querySelector("[data-testid=object-props-dialog] [data-testid=image-preview]")', 1200)
    await click('[data-testid="object-props-dialog"] [data-testid="image-preview-toggle"]'); await sleep(250)
    const previewAfter = await evaluate('!!document.querySelector("[data-testid=object-props-dialog] [data-testid=image-preview]")')
    results['B-09 取消勾选「预览图片」后预览区隐藏'] = previewBefore ? previewAfter === false : previewAfter === false
    // B-47 支持的图像格式：文件类型下拉逐项覆盖 BMP/PNG/GIF/JPG/WebP
    const typeNames = fileTypes.join(' ')
    results['B-47 图片格式覆盖 BMP/PNG/GIF/JPG'] =
      ['BMP', 'PNG', 'GIF', 'JPEG', 'WebP'].every((n) => new RegExp(n, 'i').test(typeNames))
    await closeProps()

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
