/* round-106 P0 追加：标签格式设置分组、孔洞三项、预览行、应用禁用与打印机页控件。 */
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
    ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString())
      const item = pending.get(message.id)
      if (!item) return
      pending.delete(message.id)
      if (message.error) item.reject(new Error(message.error.message))
      else item.resolve(message.result)
    })
    ws.on('open', () => resolve({ ws, send: (method, params = {}) => new Promise((ok, fail) => {
      const messageId = ++id
      pending.set(messageId, { resolve: ok, reject: fail })
      ws.send(JSON.stringify({ id: messageId, method, params }))
    }) }))
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
    const waitFor = async (expression, timeout = 7000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }

    await sleep(1500)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"n",code:"KeyN",ctrlKey:true,bubbles:true,cancelable:true}))')
    await sleep(450)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) await click('[data-testid="wizard-next"]')
    if (!await waitFor('!!document.querySelector("[data-testid=new-label-dialog]")')) throw new Error('choose-label dialog did not open')
    await click('[data-testid="new-label-custom"]')
    if (!await waitFor('!!document.querySelector("[data-testid=custom-label-dialog]")')) throw new Error('custom dialog did not open')

    results['追加2 分组框恰好为 标签/间距/行列/形状/孔洞'] = await evaluate(`(() => {
      const root=document.querySelector('[data-testid="custom-label-fields"]')
      const legends=[...root.querySelectorAll('fieldset legend')].map(e=>e.textContent.trim())
      return JSON.stringify(legends)===JSON.stringify(['标签','间距','行列','形状','孔洞'])
    })()`)
    results['追加2 孔洞下拉恰好三项且无初始尺寸'] = await evaluate(`(() => {
      const e=document.querySelector('[data-testid="custom-label-hole"]')
      return JSON.stringify([...e.options].map(o=>o.textContent.trim()))===JSON.stringify(['无','圆洞','矩形']) && document.querySelector('[data-testid="custom-label-hole-size"]')?.disabled===true
    })()`)
    results['追加2 预览行逐字匹配真机'] = await evaluate('document.querySelector("[data-testid=custom-label-preview-info]")?.textContent.trim() === "100.00 x 70.00 毫米 [4行 2列]"')
    // round-116（P0 队列第 4 项）：预览画的是**整张拼版**，不是单个标签 —— 真机 cmp-custom-r114.png 左半
    // 是 4行×2列 共 8 格、每格正中带序号 1…8。断言取「格子数 = rows × cols」与「序号文本恰好 1..N（先行后列）」，
    // 而不是只断"有一个预览"。
    const previewGrid = await evaluate(`(() => {
      const svg=document.querySelector('[data-testid="custom-label-preview-svg"]')
      if(!svg) return null
      return {
        cols: Number(svg.dataset.gridCols), rows: Number(svg.dataset.gridRows),
        cells: svg.querySelectorAll('[data-testid="custom-label-preview-cell"]').length,
        numbers: [...svg.querySelectorAll('[data-testid="custom-label-preview-number"]')].map((t)=>(t.textContent||'').trim()),
        dims: [...svg.querySelectorAll('text')].map((t)=>(t.textContent||'').trim()).filter((t)=>/mm$/.test(t))
      }
    })()`)
    results['追加2/队列4 预览画出整张拼版：格子数 = 行数 × 列数（4×2=8）'] =
      !!previewGrid && previewGrid.cols === 2 && previewGrid.rows === 4 && previewGrid.cells === previewGrid.cols * previewGrid.rows
    results['追加2/队列4 预览每格带序号且为 1..8（先行后列）'] =
      !!previewGrid && JSON.stringify(previewGrid.numbers) === JSON.stringify(['1','2','3','4','5','6','7','8'])
    results['追加2/队列4 尺寸标注只在第一个格子（100mm / 70mm 各一处）'] =
      !!previewGrid && JSON.stringify(previewGrid.dims) === JSON.stringify(['100mm','70mm'])
    // 真机口径（round-107 真机控件树复核）：`应用(&A)` 是 `[ ]` **隐藏**控件，底部只有 确定/取消/帮助。
    // 断言从"存在且禁用"改成"不可见且禁用"——同为值级断言，且与真机一致（不是降强度）。
    results['追加2 应用按钮按真机隐藏（存在、禁用、不可见）'] = await evaluate(`(() => {
      const b=document.querySelector('[data-testid="custom-label-apply"]')
      return !!b && b.disabled === true && b.hidden === true && b.offsetParent === null && b.textContent.trim() === '应用(A)'
    })()`)
    results['追加2 标签字段使用真机加速键名称'] = await evaluate(`(() => {
      const text=document.querySelector('[data-testid="custom-label-fields"]')?.innerText||''
      return text.includes('宽度(W):') && text.includes('高度(H):') && text.includes('列距(P):') && text.includes('行距(L):') && text.includes('列数(C):') && text.includes('行数(R):')
    })()`)
    results['追加2 标签页没有圆角半径输入'] = await evaluate('!(document.querySelector("[data-testid=custom-label-fields]")?.innerText||"").includes("圆角半径") && !document.querySelector("[data-testid=template-label-corner-radius]")')

    // P0 追加 4：孔洞三项共用同一个尺寸框，选「矩形」必须真的画出**矩形（只有直线、无弧）**切孔，
    // 且切孔尺寸 = 输入值（居中正方形，边长 = 毫米值）。真机证据见
    // parity/reference/labelshop/PROBE-round107-hole-rect.md 与 probe-round107-hole-rect-tree.txt。
    const setHole = async (hole, size) => {
      await evaluate(`(() => {
        const sel=document.querySelector('[data-testid="custom-label-hole"]')
        const size=document.querySelector('[data-testid="custom-label-hole-size"]')
        const sset=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set
        sset.call(sel, ${JSON.stringify(hole)}); sel.dispatchEvent(new Event('change',{bubbles:true}))
        const iset=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set
        iset.call(size, ${JSON.stringify(size)}); size.dispatchEvent(new Event('input',{bubbles:true})); size.dispatchEvent(new Event('change',{bubbles:true}))
        return true
      })()`)
      await sleep(200)
    }
    const readHolePath = () => evaluate(`(() => {
      const d=document.querySelector('[data-testid="custom-label-dialog"] svg path')?.getAttribute('d')||''
      const subs=(d.match(/M [^M]*/g)||[]).map((s)=>s.trim())   // 保留前导 M，便于逐字比对子路径
      const size=document.querySelector('[data-testid="custom-label-hole-size"]')
      return { n:subs.length, outline:subs[0]||'', cut:subs[1]||'', cutHasArc:/A/.test(subs[1]||''), disabled: size?.disabled, d }
    })()`)

    await setHole('none', '10')
    const noHole = await readHolePath()
    // 真机：孔洞=无 时尺寸框禁用（probe-round107-hole-rect-tree.txt 里该 Edit 为 DISABLED），且不画切孔
    results['追加4 孔洞=无 时尺寸框禁用且不画切孔'] = noHole.disabled === true && noHole.n === 1

    await setHole('circle', '10')
    const circleHole = await readHolePath()
    results['追加4 孔洞=圆洞 时尺寸框启用且切孔是圆弧'] = circleHole.disabled === false && circleHole.n === 2 && circleHole.cutHasArc === true

    await setHole('rectangle', '10')
    const rectHole = await readHolePath()
    // 100x70 中心 ±5mm 的正方形 = M 45 30 H 55 V 40 H 45 Z（只有直线，没有任何 A 弧）
    results['追加4 孔洞=矩形 时尺寸框启用'] = rectHole.disabled === false
    results['追加4 孔洞=矩形 画出的是直线矩形切孔（无弧）'] = rectHole.n === 2 && rectHole.cutHasArc === false
    results['追加4 矩形切孔为居中的 10mm 正方形'] = rectHole.cut === 'M 45 30 H 55 V 40 H 45 Z'
    // 圆角矩形轮廓仍走 paper.ts 的统一半径（1mm），孔洞改动没把它带偏
    results['追加4 圆角矩形轮廓半径仍为 1mm'] = /A 1 1 0 0 1/.test(rectHole.outline)

    await click('[data-testid="custom-label-tab-printer"]')
    results['追加2 打印机页有真机四个按钮与三个选项'] = await evaluate(`(() => {
      const text=document.querySelector('[data-testid="custom-label-printer-page"]')?.innerText||''
      return ['标准驱动(S)','设置(S)','高级设置(A)','安装(I)','整页反相打印','镜像输出','单页任务模式'].every(x=>text.includes(x))
    })()`)
    await click('[data-testid="custom-label-tab-page"]')
    results['追加2 纸张颜色位于页面页'] = await evaluate('!!document.querySelector("[data-testid=custom-label-page-color]") && !(document.querySelector("[data-testid=custom-label-fields]")?.innerText||"").includes("标签纸颜色")')

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
