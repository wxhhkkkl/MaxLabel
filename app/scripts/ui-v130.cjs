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
    results['追加2 应用按钮存在且禁用'] = await evaluate('document.querySelector("[data-testid=custom-label-apply]")?.disabled === true && document.querySelector("[data-testid=custom-label-apply]")?.textContent.trim() === "应用(A)"')
    results['追加2 标签字段使用真机加速键名称'] = await evaluate(`(() => {
      const text=document.querySelector('[data-testid="custom-label-fields"]')?.innerText||''
      return text.includes('宽度(W):') && text.includes('高度(H):') && text.includes('列距(P):') && text.includes('行距(L):') && text.includes('列数(C):') && text.includes('行数(R):')
    })()`)
    results['追加2 标签页没有圆角半径输入'] = await evaluate('!(document.querySelector("[data-testid=custom-label-fields]")?.innerText||"").includes("圆角半径") && !document.querySelector("[data-testid=template-label-corner-radius]")')

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
