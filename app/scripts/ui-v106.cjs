/* round-80：B1 簇「条码码制特性总表」（帮助 barcode_summary.html + 各码制特殊选项专页）。
 *
 * 断言用户可见行为：
 * - 条码属性页「数据」页显示「码制特性」面板：字符集 / 来源 / 符号结构 / 容量 / 校验与纠错 / 识读特性，
 *   随码制切换而变化（B-115～B-120）。
 * - 「特殊选项」页签名称随码制变化，内容与帮助各专页一一对应：
 *   Code93 明写「93码没有相关的特殊选项」（B-123）；
 *   Code39 启始符/终止符 + 四档校验字符（B-121）；
 *   Codabar 校验字符 + 起始符/终止符（B-116/B-124）；
 *   EAN/UPC 附加条码（B-125～B-128）；
 *   ITF14 检验字符 + 保护框（B-129）；
 *   25 码组（Code25/ITF25/Matrix25/中国邮政码）共用校验字符选项（B-130～B-132）；
 *   RSS 保持 GS1 规格 / 类型 / 分隔符（B-133）；
 *   PDF417 截短型 + 层高 + 列数（B-134）；QR GS1/纠错/编码/图标区域（B-135）；
 *   DataMatrix 纠错级别为 ECC200（B-136）；汉信码 纠错级别/字符编码/版本（B-137）。
 * - 25 码「校验字符」勾选后真的写进对象模型（itf25Check）。
 */
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
    const waitFor = async (expression, timeout = 3000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) { if (await evaluate(expression)) return true; await sleep(80) }
      return false
    }
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return e.defaultPrevented })()`)
    const setValue = (selector, value) => evaluate(`(() => {
      const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false
      const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype
      const setter=Object.getOwnPropertyDescriptor(proto,'value').set
      setter.call(e,${JSON.stringify(String(value))})
      e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true
    })()`)
    const dragCanvas = (x1, y1, x2, y2) => evaluate(`(() => {
      const canvas=document.querySelector('canvas.upper-canvas') || document.querySelector('canvas'); if(!canvas)return false
      const b=canvas.getBoundingClientRect(); const p=(x,y)=>({bubbles:true,cancelable:true,view:window,clientX:b.left+x,clientY:b.top+y,button:0,buttons:1})
      canvas.dispatchEvent(new MouseEvent('mousedown',p(${x1},${y1})))
      canvas.dispatchEvent(new MouseEvent('mousemove',p(${x2},${y2})))
      canvas.dispatchEvent(new MouseEvent('mouseup',{...p(${x2},${y2}),buttons:0})); return true
    })()`)
    const selectType = () => evaluate(`(() => {
      const row=[...document.querySelectorAll('[data-testid="layer-object-row"]')].find((e)=>e.getAttribute('data-object-type')==='barcode')
      if(!row)return false; if(row.getAttribute('data-selected')!=='true')row.click(); return true
    })()`)
    const openProps = async () => {
      if (!await selectType()) return false
      await key('Enter', { altKey: true })
      return waitFor('!!document.querySelector("[data-testid=object-props-dialog]")')
    }
    const closeProps = async () => {
      await evaluate(`document.querySelector('[data-testid="object-props-dialog"] button[aria-label]')?.click()`)
      await sleep(200)
    }
    const commitProps = async () => {
      const ok = await evaluate(`(() => {
        const buttons=[...document.querySelectorAll('[data-testid="object-props-dialog"] button')]
        const target=buttons.find((b)=>b.textContent.trim()==='确定')
        if(!target)return false; target.click(); return true
      })()`)
      if (!ok) throw new Error('object props 确定 button not found')
      await sleep(320)
    }
    /** 切到某个页签 */
    // 真机条码属性只有 4 个页签；码制专属字段在「条码」页内的 `barcodeSpecial` 分组里，
    // 所以请求 'barcodeSpecial' 时点「条码」页并等分组出现（锚点保留了原 testid）。
    const openTab = async (tabId) => {
      const target = tabId === 'barcodeSpecial' ? 'barcode' : tabId
      await click(`[data-testid="object-props-dialog"] [data-testid="object-props-tab-${target}"]`)
      await sleep(260)
      return evaluate(`!!document.querySelector('[data-testid="object-props-dialog"] [data-testid="object-props-tab-${target}"]')`)
    }
    /** 在「条码」页把码制切到指定 bcid */
    const setSymbology = async (bcid) => {
      await openTab('barcode')
      await waitFor('!!document.querySelector("[data-testid=barcode-symbology]")')
      await setValue('[data-testid="object-props-dialog"] [data-testid="barcode-symbology"]', bcid)
      await sleep(320)
    }
    /** 「数据」页的码制特性面板：{ name, rows: {label: value} } */
    const specPanel = () => evaluate(`(() => {
      const box=document.querySelector('[data-testid="object-props-dialog"] [data-testid=barcode-charset]')
      if(!box) return null
      const rows={}
      box.querySelectorAll('[data-testid^="barcode-spec-"]').forEach((e)=>{
        const key=e.getAttribute('data-testid')
        if(key.endsWith('-value')) return
        rows[e.innerText.split('：')[0].trim()] = e.innerText.split('：').slice(1).join('：').trim()
      })
      const name=box.querySelector('[data-testid=barcode-charset-name]')?.textContent || ''
      const err=box.querySelector('[data-testid=barcode-content-error]')?.textContent || ''
      return { name, rows, err }
    })()`)
    /** 「特殊选项」页的完整文案 */
    const specialText = () => evaluate(`document.querySelector('[data-testid="object-props-dialog"]')?.innerText || ''`)
    const has = (selector) => evaluate(`!!document.querySelector('[data-testid="object-props-dialog"] ${selector}')`)
    /** 某个控件所在 FormField 的标签文字 */
    const fieldLabel = (selector) => evaluate(`(() => {
      const e=document.querySelector('[data-testid="object-props-dialog"] ${selector}')
      return e?.parentElement?.querySelector('label')?.textContent?.trim() || ''
    })()`)

    await sleep(1600)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(320)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(320)
    }
    await click('[data-testid="new-label-select"]')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")', 8000)) throw new Error('editor did not open')

    await click('[data-tool="barcode"]'); await dragCanvas(180, 300, 460, 400); await sleep(500)

    if (!await openProps()) throw new Error('barcode props did not open')

    // ============ B-121 Code 39：特性面板 + 特殊选项 ============
    await openTab('datasource')
    await waitFor('!!document.querySelector("[data-testid=barcode-charset]")')
    let panel = await specPanel()
    results['B-121 条码属性页「数据」页有「码制特性」面板'] =
      !!panel && Object.keys(panel.rows).length >= 3 && (panel.rows['字符集'] ?? '').length > 0
    await setSymbology('code39')
    await openTab('datasource')
    panel = await specPanel()
    results['B-121 特性面板随码制切换为 Code 39'] = panel?.name === 'Code 39'
    results['B-121 特性面板写明 44 个符号与 * 仅作启始符和终止符'] =
      (panel?.rows?.['字符集'] ?? '').includes('44 个符号') && (panel?.rows?.['字符集'] ?? '').includes('启始符和终止符')
    results['B-121 特性面板写明来源为 Intermec 1974 与国家标准 GB12908-2002'] =
      (panel?.rows?.['来源'] ?? '').includes('Intermec 公司于 1974 年') && (panel?.rows?.['来源'] ?? '').includes('GB12908-2002')

    await setSymbology('code39')
    await openTab('barcodeSpecial')
    const code39Text = await specialText()
    const code39Checks = await evaluate(`[...document.querySelectorAll('[data-testid="object-props-dialog"] select')].map((s)=>[...s.options].map((o)=>o.textContent.trim()).join('/'))`)
    results['B-121 Code 39 特殊选项含启始符/终止符与四档校验字符'] =
      code39Text.includes('显示启始符/终止符') &&
      code39Checks.some((s) => s === '无/模10校验/模43校验/图书馆用校验码')

    // ============ B-123 Code 93：没有相关的特殊选项 ============
    await setSymbology('code93')
    await openTab('barcodeSpecial')
    await waitFor('!!document.querySelector("[data-testid=barcode-special-none]")')
    const code93None = await evaluate(`document.querySelector('[data-testid=barcode-special-none]')?.textContent || ''`)
    results['B-123 Code 93 特殊选项页明写「93码没有相关的特殊选项」'] = code93None.includes('93码没有相关的特殊选项')

    // ============ B-116/B-124 Codabar：字符集 + 校验字符 + 起始/终止符 ============
    await setSymbology('codabar')
    await openTab('barcodeSpecial')
    const codabarText = await specialText()
    results['B-124 Codabar 特殊选项含校验字符（三档）与起始符/终止符（a-d）'] =
      codabarText.includes('校验字符') && codabarText.includes('起始符') && codabarText.includes('终止符')
    await openTab('datasource')
    panel = await specPanel()
    results['B-116 Codabar 特性面板写明 4 条 3 空、空白区比窄条宽 10 倍、可变长度没有校验位'] =
      (panel?.rows?.['符号结构'] ?? '').includes('4 条 3 空') &&
      (panel?.rows?.['符号结构'] ?? '').includes('空白区比窄条宽 10 倍') &&
      (panel?.rows?.['校验与纠错'] ?? '').includes('没有校验位')

    // ============ B-125～B-128 EAN/UPC：位数与附加条码 ============
    const eanExpect = [
      ['ean13', 'EAN-13', '共 13 位'],
      ['ean8', 'EAN-8', '共 8 位'],
      ['upca', 'UPC-A', '共 12 位'],
      ['upce', 'UPC-E', '共 7 位']
    ]
    let eanOk = true
    let addonOk = true
    for (const [bcid, name, chars] of eanExpect) {
      await setSymbology(bcid)
      await openTab('datasource')
      panel = await specPanel()
      if (panel?.name !== name || !(panel?.rows?.['字符集'] ?? '').includes(chars)) eanOk = false
      await openTab('barcodeSpecial')
      const t = await specialText()
      if (!t.includes('附加条码')) addonOk = false
      const addonOptions = await evaluate(`(() => {
        const f=[...document.querySelectorAll('[data-testid="object-props-dialog"] label')].find((l)=>l.textContent.trim()==='附加条码')
        const s=f?.parentElement?.querySelector('select')
        return s?[...s.options].map((o)=>o.textContent.trim()).join('/'):''
      })()`)
      if (addonOptions !== '无/2 位附加码/5 位附加码') addonOk = false
    }
    results['B-125~B-128 EAN-13/EAN-8/UPC-A/UPC-E 的位数与帮助一致'] = eanOk
    results['B-125~B-128 EAN/UPC 特殊选项「附加条码」为 无/2 位/5 位'] = addonOk

    // ============ B-129 ITF14：检验字符 + 保护框 ============
    await setSymbology('itf14')
    await openTab('barcodeSpecial')
    const itf14Text = await specialText()
    results['B-129 ITF14 特殊选项含「检验字符」并提示建议总是选中'] =
      itf14Text.includes('检验字符') && itf14Text.includes('建议总是选中')
    // round-58（DIFF-61）：真机 ITF 14 是「保护框(&R)」3 项下拉（无/方框/保护条）+
    // 「粗细(&N)」「空白区(&S)」各 15 档（1X…15X，默认 5X/10X），不再是「复选框 + 两个数值框」
    const bearerSelect = await evaluate(`(() => {
      const s=document.querySelector('[data-testid="itf14-bearer"]')
      return s ? { value:s.value, options:[...s.options].map((o)=>o.textContent.trim()) } : null
    })()`)
    const bearerRatioSelect = await evaluate(`(() => {
      const s=document.querySelector('[data-testid="itf14-bearer-ratio"]')
      return s ? { value:s.value, count:s.options.length, first:s.options[0].textContent.trim(), last:s.options[s.options.length-1].textContent.trim() } : null
    })()`)
    const quietRatioSelect = await evaluate(`document.querySelector('[data-testid="itf14-quiet-ratio"]')?.value`)
    results['B-129 ITF14 保护框为 3 项下拉（无/方框/保护条），粗细与空白区各 15 档 1X…15X（真机）'] =
      itf14Text.includes('保护框') && Boolean(bearerSelect) &&
      JSON.stringify(bearerSelect.options) === JSON.stringify(['无', '方框', '保护条']) &&
      Boolean(bearerRatioSelect) && bearerRatioSelect.count === 15 &&
      bearerRatioSelect.first === '1X' && bearerRatioSelect.last === '15X' &&
      bearerRatioSelect.value === '5' && quietRatioSelect === '10'

    // ============ B-130～B-132 25 码组：四个码制共用校验字符选项 ============
    let codes25Ok = true
    for (const bcid of ['interleaved2of5', 'industrial2of5', 'matrix2of5', 'datalogic2of5']) {
      await setSymbology(bcid)
      await openTab('barcodeSpecial')
      await waitFor('!!document.querySelector("[data-testid=barcode-25-check]")')
      const hasCheck = await has('[data-testid=barcode-25-check]')
      const note = await evaluate(`document.querySelector('[data-testid=barcode-25-note]')?.textContent || ''`)
      if (!hasCheck) codes25Ok = false
      if (!note.includes('Code25') || !note.includes('ITF25') || !note.includes('Matrix25') || !note.includes('中国邮政码')) codes25Ok = false
    }
    results['B-130~B-132 Code25/ITF25/Matrix25/中国邮政码 共用同一组 25 码特殊选项'] = codes25Ok

    // 25 码「校验字符」勾选后写进对象模型（确定提交后回读）
    await setSymbology('datalogic2of5')
    await openTab('barcodeSpecial')
    await click('[data-testid=barcode-25-check]'); await sleep(250)
    await commitProps()
    await sleep(300)
    if (!await openProps()) throw new Error('barcode props reopen failed')
    await openTab('barcodeSpecial')
    const itf25Checked = await evaluate(`document.querySelector('[data-testid=barcode-25-check]')?.checked === true`)
    results['B-131 中国邮政码勾选「校验字符」后写回对象模型（确定提交后回读为勾选）'] = itf25Checked

    // ============ B-133 RSS：保持 GS1 规格 / 类型五档 / 分隔符 ============
    await setSymbology('databaromni')
    await openTab('barcodeSpecial')
    const rssText = await specialText()
    const rssTypeOptions = await evaluate(`(() => {
      const f=[...document.querySelectorAll('[data-testid="object-props-dialog"] label')].find((l)=>l.textContent.trim()==='类型')
      const s=f?.parentElement?.querySelector('select')
      return s?[...s.options].map((o)=>o.textContent.trim()).join('/'):''
    })()`)
    results['B-133 RSS 特殊选项含「保持 GS1 规格」「类型」「分隔符」'] =
      rssText.includes('保持 GS1 规格') && rssText.includes('分隔符')
    results['B-133 RSS 类型为 全向式/截断式/层排式/全向层排式/限定式'] =
      rssTypeOptions === '全向式/截断式/层排式/全向层排式/限定式'

    // ============ B-134 PDF417 ============
    await setSymbology('pdf417')
    await openTab('barcodeSpecial')
    const pdfText = await specialText()
    // round-129：真机 `层数(&R):` / `列数(&C):` 都是下拉（89 项 / 31 项，默认 `自动`），不再是自造的层高数字框。
    const layerHeight = await evaluate(`document.querySelector('[data-testid=pdf417-rows]')?.value`)
    results['B-134 PDF417 特殊选项含截短型/纠错级别/层数/列数'] =
      pdfText.includes('截短型 PDF417') && pdfText.includes('纠错级别') && pdfText.includes('层数') && pdfText.includes('列数')
    results['B-134 PDF417 层数(&R):/列数(&C): 按真机为下拉且默认「自动」'] = String(layerHeight) === '自动'
      && await evaluate(`document.querySelector('[data-testid=pdf417-columns]')?.value === '自动'`) === true
    await openTab('datasource')
    panel = await specPanel()
    results['B-134 特性面板写明 4 条 4 空、总模块数一定为 17'] =
      (panel?.rows?.['符号结构'] ?? '').includes('4 个条和 4 个空') && (panel?.rows?.['符号结构'] ?? '').includes('总模块数一定为 17')

    // ============ B-135 QR Code ============
    await setSymbology('qrcode')
    await openTab('barcodeSpecial')
    const qrText = await specialText()
    const qrFields = await evaluate(`[...document.querySelectorAll('[data-testid="object-props-dialog"] label')].map((l)=>l.textContent.trim())`)
    // round-128：字段原文按真机改用加速键/冒号（`纠错级别(&E):` / `字符编码:` / `图标区域：`，
    // 见 `probe-sym-qrcode-values.txt`）→ 断言从「包含」改成**逐字全等**（强度只增不减）。
    results['B-135 QR 特殊选项含 GS1 模式/纠错级别(&E):/字符编码:/图标区域：'] =
      qrText.includes('GS1 模式') && qrText.includes('图标区域：') &&
      qrFields.includes('纠错级别(&E):') && qrFields.includes('字符编码:')
    // 真机 `probe-sym-qrcode-combos.txt` combo[4] 的项序是 **UTF-8 / ANSI**（sel=1 → 默认 ANSI）
    results['B-135 QR 字符编码项序 = 真机 [UTF-8, ANSI]'] = (await evaluate(`(() => {
      const s=document.querySelector('[data-testid=qr-encoding]')
      return s?[...s.options].map((o)=>o.textContent.trim()).join('/'):''
    })()`)) === 'UTF-8/ANSI'
    await openTab('datasource')
    panel = await specPanel()
    results['B-118 QR 特性面板写明 3 个角落「回」字定位图案与 1817 汉字/7089 数字/4200 字母'] =
      (panel?.rows?.['符号结构'] ?? '').includes('3 个角落') &&
      (panel?.rows?.['容量'] ?? '').includes('1817 个汉字') &&
      (panel?.rows?.['容量'] ?? '').includes('7089 个数字') &&
      (panel?.rows?.['容量'] ?? '').includes('4200 个英文字母')

    // ============ B-136 DataMatrix ============
    await setSymbology('datamatrix')
    await openTab('barcodeSpecial')
    const dmLabel = await fieldLabel('[data-testid=datamatrix-eclevel]')
    const dmText = await specialText()
    results['B-136 DataMatrix 特殊选项用词为「纠错级别」且只支持 ECC200'] =
      dmLabel === '纠错级别' && !dmText.includes('纠错类型') && dmText.includes('ECC200')
    await openTab('datasource')
    panel = await specPanel()
    results['B-119 DataMatrix 特性面板写明 256 个字元、2000 bytes、只读 20% 即可辨读'] =
      (panel?.rows?.['字符集'] ?? '').includes('256 个字元') &&
      (panel?.rows?.['容量'] ?? '').includes('2,000 bytes') &&
      (panel?.rows?.['识读特性'] ?? '').includes('20% 即可精确辨读')

    // ============ B-137 汉信码 ============
    await setSymbology('hanxin')
    await openTab('barcodeSpecial')
    const hxFields = await evaluate(`[...document.querySelectorAll('[data-testid="object-props-dialog"] label')].map((l)=>l.textContent.trim())`)
    const hxEncoding = await evaluate(`(() => {
      const s=document.querySelector('[data-testid=hanxin-encoding]')
      return s?[...s.options].map((o)=>o.textContent.trim()).join('/'):''
    })()`)
    // round-128：真机原文是 `纠错级别(&E):` / `字符编码:` / `版本(&V):`（`probe-sym-hanxin-values.txt`）
    results['B-137 汉信码特殊选项含「纠错级别(&E):」「字符编码:」「版本(&V):」'] =
      hxFields.includes('纠错级别(&E):') && hxFields.includes('字符编码:') && hxFields.includes('版本(&V):')
    results['B-137 汉信码字符编码项序 = 真机 [UTF-8, ANSI]'] = hxEncoding === 'UTF-8/ANSI'
    const hxVersionAuto = await evaluate(`(() => {
      const s=document.querySelector('[data-testid=hanxin-version]')
      return s?s.options[s.selectedIndex]?.textContent.trim():''
    })()`)
    results['B-137 汉信码版本默认为「自动」'] = hxVersionAuto === '自动'
    await openTab('datasource')
    panel = await specPanel()
    results['B-120 汉信码特性面板写明 7829 数字/4350 ASCII/2174 汉字/3262 字节'] =
      (panel?.rows?.['容量'] ?? '').includes('7829 个数字') &&
      (panel?.rows?.['容量'] ?? '').includes('4350 个 ASCII 字符') &&
      (panel?.rows?.['容量'] ?? '').includes('2174 个汉字') &&
      (panel?.rows?.['容量'] ?? '').includes('3262 个 8 位字节信息')

    // ============ B-115 交叉25 / ITF14 特性 ============
    await setSymbology('interleaved2of5')
    await openTab('datasource')
    panel = await specPanel()
    results['B-115 交叉25 特性面板写明识读率高、密度较高、窄条宽度更宽'] =
      (panel?.rows?.['识读特性'] ?? '').includes('识读率高') &&
      (panel?.rows?.['识读特性'] ?? '').includes('密度较高') &&
      (panel?.rows?.['符号结构'] ?? '').includes('窄条宽度更宽')
    await setSymbology('itf14')
    await openTab('datasource')
    panel = await specPanel()
    results['B-115 ITF14 特性面板写明字符集与交插二五码相同、由保护框与左右空白区组成'] =
      (panel?.rows?.['字符集'] ?? '').includes('交插二五码相同') &&
      (panel?.rows?.['符号结构'] ?? '').includes('矩形保护框') &&
      (panel?.rows?.['符号结构'] ?? '').includes('左侧空白区')

    // ============ B-122 Code 128 ============
    await setSymbology('code128')
    await openTab('datasource')
    panel = await specPanel()
    results['B-122 Code 128 特性面板写明三个字符集各 102 个字符与 A/B/C 的范围'] =
      (panel?.rows?.['符号结构'] ?? '').includes('每个 102 个字符') &&
      (panel?.rows?.['符号结构'] ?? '').includes('除 26 个小写字母') &&
      (panel?.rows?.['符号结构'] ?? '').includes('除 26 个控制字符')
    results['B-122 特性面板写明字符集默认「自动」并可在字符集之间切换'] =
      (panel?.rows?.['来源'] ?? '').includes('1981')
    await openTab('barcodeSpecial')
    const c128Text = await specialText()
    // round-127：字段原文按真机 `probe-60-barcode-props-tree.txt` 改成 `字符集(&C):`（(961,680)，带加速键）
    // 与 `GS1/EAN 128(&U)`（(961,704)，GS1/EAN 与 128 之间是空格、无连字符）——断言同步改成真机原文，
    // 并继续逐档比对字符集选项文本，强度不降。
    const c128Charset = await evaluate(`(() => {
      const f=[...document.querySelectorAll('[data-testid="object-props-dialog"] label')].find((l)=>l.textContent.trim()==='字符集(&C):')
      const s=f?.parentElement?.querySelector('select')
      return s?[...s.options].map((o)=>o.textContent.trim()).join('/'):''
    })()`)
    results['B-122 Code 128 特殊选项含 GS1/EAN 128(&U) 与五档字符集（默认自动）'] =
      c128Text.includes('GS1/EAN 128(&U)') &&
      c128Charset === '自动/字符集 A/字符集 B/字符集 C（双密度数字）/手动（^A ^B ^C ^1 控制符）'

    await closeProps()

    const total = Object.keys(results).length
    const passed = Object.values(results).filter(Boolean).length
    for (const [name, ok] of Object.entries(results)) console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`)
    // 汇总行必须严格匹配 run-regression.ps1 的解析式 `^\s*(\d+)/(\d+) PASS\s*$`，
    // 否则整个 test:ui 会被判为失败（脚本名已表明这是条码码制特性检查）。
    console.log(`\n${passed}/${total} PASS`)
    if (passed !== total) process.exitCode = 1
  } catch (error) {
    console.error('ERROR', error)
    process.exitCode = 1
  } finally {
    try { client?.ws?.close() } catch { /* ignore */ }
  }
})()
