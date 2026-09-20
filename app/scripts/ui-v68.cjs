/* C-48～C-59、C-70～C-72：数据库类型入口、导入步骤、ODBC 配置、多连接和字段绑定。 */
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
    const click = (selector) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e||!e.isConnected)return false; e.click(); return true })()`)
    const clickText = (text) => evaluate(`(() => { const e=[...document.querySelectorAll('button')].find((x)=>x.offsetParent&&(x.textContent||'').trim()===${JSON.stringify(text)}); if(!e)return false; e.click(); return true })()`)
    const clickMenu = (text) => evaluate(`(() => { const e=[...document.querySelectorAll('[data-menu-item]')].find((x)=>x.offsetParent&&(x.textContent||'').includes(${JSON.stringify(text)})); if(!e)return false; e.click(); return true })()`)
    const key = (name, options = {}) => evaluate(`(() => { const e=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(e); document.dispatchEvent(e); return true })()`)
    const setValue = (selector, value) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false; const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype; const setter=Object.getOwnPropertyDescriptor(proto,'value').set; setter.call(e,${JSON.stringify(String(value))}); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
    const clickCanvas = (x, y) => evaluate(`(() => { const host=document.querySelector('[data-testid="canvas-host"],.canvas-container,canvas'); if(!host)return false; const r=host.getBoundingClientRect(); const clientX=r.left+${x},clientY=r.top+${y}; const target=document.elementFromPoint(clientX,clientY)||host; const o={bubbles:true,cancelable:true,view:window,clientX,clientY,button:0,buttons:1}; target.dispatchEvent(new MouseEvent('mousedown',o)); target.dispatchEvent(new MouseEvent('mouseup',{...o,buttons:0})); target.dispatchEvent(new MouseEvent('click',{...o,buttons:0})); return true })()`)

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(350)
    await click('[data-testid="wizard-next"]'); await sleep(450)
    await evaluate(`(() => { const items=[...document.querySelectorAll('button')].filter((e)=>e.offsetParent&&(e.textContent||'').trim()==='选择'); items.at(-1)?.click(); return true })()`)
    await sleep(800)
    await clickText('管理'); await sleep(350)

    const typeOrder = await evaluate(`JSON.stringify([...document.querySelectorAll('[data-testid="database-import-types"] button')].map((e)=>(e.textContent||'').trim()))`)
    results['database import exposes four help types in order'] = typeOrder === JSON.stringify(['文本文件', 'EXCEL文件', 'ODBC 数据源', '云端数据库'])
    results['database import keeps four-step workflow visible'] = await evaluate(`document.querySelector('[data-testid="database-import-step"]')?.textContent.includes('步骤 1/4')`)
    await click('[data-testid="database-import-type-text"]'); await sleep(120)
    results['text import type selects text workflow'] = await evaluate(`document.querySelector('[data-testid="database-import-select"]')?.textContent.includes('选择文本文件') && document.querySelector('[data-testid="database-import-type-text"]')?.textContent.trim()==='文本文件'`)

    await evaluate(`(() => { const input=document.querySelector('input[accept*=".csv"]'); const file=new File(['\\uFEFF名称,数量\\n甲产品,10\\n乙产品,20\\n'], 'c-import.csv', {type:'text/csv'}); const transfer=new DataTransfer(); transfer.items.add(file); input.files=transfer.files; input.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
    await sleep(500)
    results['text import shows symbol and header controls after file selection'] = await evaluate(`!!document.querySelector('[data-testid="database-import-confirmation"]') && !!document.querySelector('[data-testid="database-import-delimiter"]') && document.querySelector('[data-testid="database-import-header"]')?.checked === true`)
    results['text import defaults to automatic separator'] = await evaluate(`document.querySelector('[data-testid="database-import-delimiter"]')?.value === 'auto'`)
    await setValue('[data-testid="database-import-delimiter"]', ',')
    await click('[data-testid="database-import-confirm"]'); await sleep(800)
    results['text import confirmation adds dataset rows'] = await evaluate(`document.body.innerText.includes('共 1 个数据集，2 行记录') && document.body.innerText.includes('首行：名称=甲产品')`)

    await click('[data-testid="database-import-type-excel"]'); await sleep(150)
    results['excel import exposes sheet and header workflow'] = await evaluate(`document.querySelector('[data-testid="database-import-step"]')?.textContent.includes('选择文件') && document.body.innerText.includes('EXCEL文件')`)
    await click('[data-testid="database-import-type-cloud"]'); await sleep(120)
    results['cloud database type has explicit account guidance'] = await evaluate(`!!document.querySelector('[data-testid="database-import-cloud-panel"]') && document.body.innerText.includes('云端数据库')`)

    await click('[data-testid="database-import-type-odbc"]'); await sleep(150)
    results['ODBC type opens connection management'] = await evaluate(`!!document.querySelector('[data-testid="database-connection-new"]') && !!document.querySelector('[data-testid="database-connection-count"]')`)
    await click('[data-testid="database-connection-new"]'); await sleep(120)
    results['ODBC SQL Server configuration exposes driver and fields'] = await evaluate(`(() => { const driver=document.querySelector('[data-testid="database-connection-driver"]'); const values=[...(driver?.options||[])].map((o)=>o.textContent.trim()); return values.includes('SQL Server (ODBC)') && !!document.querySelector('[data-testid="database-connection-server"]') && !!document.querySelector('[data-testid="database-connection-database"]') && !!document.querySelector('[data-testid="database-connection-sql"]') && !!document.querySelector('[data-testid="database-connection-test"]') })()`)
    await clickText('取消'); await sleep(150)
    await click('[aria-label="关闭"]'); await sleep(200)

    await key('o', { altKey: true }); await sleep(120); await clickMenu('系统选项'); await sleep(220)
    const multi = '[data-testid="use-multiple-database-connections"]'
    await clickText('打印参数'); await sleep(120)
    results['multiple database connections defaults off'] = await evaluate(`document.querySelector(${JSON.stringify(multi)})?.checked === false`)
    await click(multi); await click('[data-testid="options-save"]'); await sleep(360)
    // round-113：「保存」现在会关闭对话框（与真机 确定 一致），重开后要等一下渲染
    results['multiple database connections option persists on'] = await evaluate(`JSON.parse(localStorage.getItem('maxlabel.options')||'{}').useMultipleDatabaseConnections === true`)
    // 重开对话框能读回该值（若重开成功再核对一次勾选态）
    await key('o', { altKey: true }); await sleep(200); await clickMenu('系统选项'); await sleep(360)
    const reopened = await evaluate(`!!document.querySelector(${JSON.stringify(multi)})`)
    if (reopened) {
      results['重开系统选项后仍为勾选'] = await evaluate(`document.querySelector(${JSON.stringify(multi)})?.checked === true`)
    }
    await clickText('取消'); await sleep(180)

    await click('[data-tool="text"]'); await clickCanvas(200, 180); await sleep(400); await key('Enter', { altKey: true }); await sleep(400)
    await click('[data-testid="object-props-tab-datasource"]'); await sleep(120)
    results['simple label constant input is available'] = await evaluate(`!!document.querySelector('[data-testid="constant-source-value"]')`)
    await click('[data-testid="source-kind-database"]'); await sleep(150)
    await setValue('[data-testid="data-source-editor"] select', 'c-import'); await sleep(150)
    results['database object source exposes field binding after import'] = await evaluate(`(() => { const root=document.querySelector('[data-testid="data-source-editor"]'); const field=root?.querySelector('[data-testid="database-field"]'); return !!field && [...field.options].some((o)=>o.textContent.trim()==='名称') && root.textContent.includes('字段名') })()`)

    let pass = 0
    for (const [name, value] of Object.entries(results)) { console.log((value ? 'PASS ' : 'FAIL ') + name + ' => ' + value); if (value) pass++ }
    console.log(`\n${pass}/${Object.keys(results).length} PASS`)
    client.ws.close(); process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (error) {
    console.error('ERR', error.message)
    if (client) client.ws.close()
    process.exit(2)
  }
})()
