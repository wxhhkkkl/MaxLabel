/* C-51、C-73～C-75、C-77～C-78、C-81～C-82：数据源与数据库入口、模板打开链路。 */
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
    const clickText = (text) => evaluate(`(() => { const e=[...document.querySelectorAll('button')].find((x)=>x.offsetParent&&(x.textContent||'').trim()===${JSON.stringify(text)}); if(!e)return false; e.click(); return true })()`)
    const key = (name, options = {}) => evaluate(`(() => { const event=new KeyboardEvent('keydown',${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })}); window.dispatchEvent(event); document.dispatchEvent(event); return true })()`)
    const setValue = (selector, value) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return false; const proto=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype; const setter=Object.getOwnPropertyDescriptor(proto,'value').set; setter.call(e,${JSON.stringify(String(value))}); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
    const waitFor = async (expression, timeout = 5000) => {
      const started = Date.now()
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return true
        await sleep(80)
      }
      return false
    }
    const clickCanvas = (x, y) => evaluate(`(() => { const host=document.querySelector('[data-testid="canvas-host"],.canvas-container,canvas'); if(!host)return false; const r=host.getBoundingClientRect(); const clientX=r.left+${x},clientY=r.top+${y}; const target=document.elementFromPoint(clientX,clientY)||host; const o={bubbles:true,cancelable:true,view:window,clientX,clientY,button:0,buttons:1}; target.dispatchEvent(new MouseEvent('mousedown',o)); target.dispatchEvent(new MouseEvent('mouseup',{...o,buttons:0})); target.dispatchEvent(new MouseEvent('click',{...o,buttons:0})); return true })()`)

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(350)
    if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
      await click('[data-testid="wizard-next"]'); await sleep(350)
      await evaluate(`(() => { const items=[...document.querySelectorAll('button')].filter((e)=>e.offsetParent&&(e.textContent||'').trim()==='选择'); items.at(-1)?.click(); return true })()`)
      await sleep(800)
    }
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")')) throw new Error('editor did not open')

    await click('[data-tool="text"]'); await clickCanvas(200, 180); await sleep(350); await key('Enter', { altKey: true }); await sleep(400)
    if (!await waitFor('!!document.querySelector("[data-testid=object-props-dialog]")')) throw new Error('object properties did not open')
    await click('[data-testid="object-props-tab-datasource"]'); await sleep(150)
    results['C-51 数据源类型入口按帮助顺序显示'] = await evaluate(`JSON.stringify([...document.querySelectorAll('[data-testid="data-source-editor"] [data-testid^="source-kind-"]')].map((e)=>(e.textContent||'').trim())) === JSON.stringify(['常量','序列号','日期','时间','数据库','键盘输入','脚本'])`)
    results['C-51 常量默认字段可编辑'] = await evaluate('!!document.querySelector("[data-testid=constant-source-value]") && !document.querySelector("[data-testid=constant-source-value]").disabled')
    await click('[data-testid="source-kind-serial"]'); await sleep(150)
    results['C-51 序列号默认值与推进说明存在'] = await evaluate('document.querySelector("[data-testid=serial-settings]")?.textContent.includes("打印完成后才推进") && document.querySelector("[data-testid=serial-current]")?.value === "1"')

    await click('[aria-label="关闭"]'); await sleep(180)
    await clickText('管理'); await sleep(350)
    await click('[data-testid="database-import-type-odbc"]'); await sleep(150)
    results['C-73 ODBC 四步流程入口存在'] = await evaluate(`document.querySelector('[data-testid="database-odbc-step"]')?.textContent.includes('1/4 新建机器数据源') && document.querySelector('[data-testid="database-odbc-step"]')?.textContent.includes('4/4 选表/查询并导入')`)
    await click('[data-testid="database-connection-new"]'); await sleep(150)
    results['C-73 SQL Server ODBC 驱动和连接字段存在'] = await evaluate(`(() => { const driver=document.querySelector('[data-testid="database-connection-driver"]'); return [...(driver?.options||[])].some((o)=>o.textContent.trim()==='SQL Server (ODBC)') && !!document.querySelector('[data-testid="database-connection-server"]') && !!document.querySelector('[data-testid="database-connection-database"]') && !!document.querySelector('[data-testid="database-connection-test"]') })()`)
    results['C-74 SQL Server 默认 Windows 身份验证且禁用用户名密码'] = await evaluate('document.querySelector("[data-testid=database-connection-auth-mode]")?.value === "windows" && document.querySelector("[data-testid=database-connection-user]")?.disabled === true && document.querySelector("[data-testid=database-connection-password]")?.disabled === true')
    await setValue('[data-testid="database-connection-auth-mode"]', 'sql'); await sleep(120)
    results['C-74 SQL Server 身份验证切换启用账号字段'] = await evaluate('document.querySelector("[data-testid=database-connection-auth-mode]")?.value === "sql" && document.querySelector("[data-testid=database-connection-user]")?.disabled === false && document.querySelector("[data-testid=database-connection-password]")?.disabled === false && !!document.querySelector("[data-testid=database-connection-table]") && !!document.querySelector("[data-testid=database-connection-sql]")')
    await clickText('取消'); await sleep(150)

    await clickText('本地数据（CSV / Excel）'); await sleep(120)
    await click('[data-testid="database-import-type-cloud"]'); await sleep(120)
    results['C-75 云数据库四步流程和未选择时禁用确定'] = await evaluate('document.querySelector("[data-testid=cloud-import-workflow]")?.textContent.includes("1/4 选定数据库") && document.querySelector("[data-testid=cloud-import-workflow]")?.textContent.includes("4/4 确定") && document.querySelector("[data-testid=cloud-database-table]")?.disabled === true && document.querySelector("[data-testid=cloud-database-confirm]")?.disabled === true')
    await click('[data-testid="cloud-database-select"]'); await sleep(500)
    results['C-75 选择云端数据库后进入云马通交接态'] = await evaluate('document.querySelector("[data-testid=cloud-database-select]")?.textContent.includes("重新打开云马通") && document.querySelector("[data-testid=cloud-database-table]")?.disabled === true && document.querySelector("[data-testid=cloud-database-confirm]")?.disabled === true && document.body.innerText.includes("登录云马通")')

    if (!await click('[data-testid="database-import-type-text"]')) throw new Error('text import type is not visible after cloud flow')
    if (!await waitFor('!!document.querySelector("input[accept*=\\".csv\\"]")', 1000)) throw new Error('text import file input is missing: ' + await evaluate('document.body.innerText.slice(-1200)'))
    await evaluate(`(() => { const input=document.querySelector('input[accept*=".csv"]'); const file=new File(['\\uFEFF名称,数量\\n甲产品,10\\n乙产品,20\\n'], 'c-v81.csv', {type:'text/csv'}); const transfer=new DataTransfer(); transfer.items.add(file); input.files=transfer.files; input.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
    await sleep(450)
    await setValue('[data-testid="database-import-delimiter"]', ',')
    await click('[data-testid="database-import-confirm"]'); await sleep(700)
    await click('[aria-label="关闭"]'); await sleep(180)
    await key('Enter', { altKey: true }); await sleep(350)
    await click('[data-testid="object-props-tab-datasource"]'); await sleep(100)
    await click('[data-testid="source-kind-database"]'); await sleep(120)
    await setValue('[data-testid="data-source-editor"] select', 'c-v81'); await sleep(120)
    results['C-82 数据库字段绑定显示导入数据集字段'] = await evaluate(`(() => { const field=document.querySelector('[data-testid="data-source-editor"] [data-testid="database-field"]'); return !!field && [...field.options].some((o)=>o.textContent.trim()==='名称') })()`)
    await click('[aria-label="关闭"]'); await sleep(180)

    const legacyJson = JSON.stringify({ name: 'ui-v81-legacy', widthMm: 30, heightMm: 20, objects: [] })
    const saved = await evaluate(`window.maxlabel.saveTemplateToLib('ui-v81-legacy', ${JSON.stringify(legacyJson)})`)
    await evaluate('document.querySelector("[data-testid=document-tab][data-document-title=起始页]")?.click()'); await sleep(250)
    await evaluate('document.querySelector("a[title=打开保存的标签格式模板]")?.click()'); await sleep(500)
    results['C-77 模板库提供本机模板打开/保存入口'] = await evaluate('document.body.innerText.includes("本机模板库") && document.body.innerText.includes("保存当前模板到模板库") && !!document.querySelector("button")')
    const opened = await evaluate(`(() => { const e=[...document.querySelectorAll('button')].find((x)=>x.offsetParent&&(x.textContent||'').trim()==='打开'); if(!e)return false; e.click(); return true })()`)
    if (!saved?.ok || !opened) throw new Error('template library legacy fixture could not be opened')
    if (!await waitFor('!!document.querySelector("canvas.upper-canvas")', 5000)) throw new Error('legacy template did not open')
    results['C-78 模板库可打开旧版裸 LabelDoc JSON'] = await evaluate('!!document.querySelector("[data-testid=document-tab][data-document-title=ui-v81-legacy]") && !!document.querySelector("canvas.upper-canvas")')

    await click('button[title="标签格式设置"]'); await sleep(350)
    results['C-81 标签格式设置对话框保留四页入口'] = await evaluate('!!document.querySelector("[data-testid=template-props-dialog]") && JSON.stringify([...document.querySelectorAll("[data-testid^=template-props-tab-]")].map((e)=>(e.textContent||"").trim())) === JSON.stringify(["打印机","页面","标签","其它"])')

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
