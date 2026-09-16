/* P0-C / DIFF-15：导入三行数据库后，状态栏显示当前记录/总记录与当前拷贝数 */
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
    const click = (selector) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e || !e.isConnected) return false; e.click(); return true })()`)

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await evaluate('window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", code: "KeyN", ctrlKey: true, bubbles: true, cancelable: true }))')
    await sleep(350)
    await click('[data-testid="wizard-next"]')
    await sleep(450)
    await evaluate(`(() => { const items = [...document.querySelectorAll('button')].filter((e) => e.offsetParent && e.textContent.trim() === '选择'); items.at(-1)?.click(); return !!items.length })()`)
    await sleep(900)
    await evaluate(`(() => { const e = [...document.querySelectorAll('button')].find((x) => x.offsetParent && (x.textContent || '').trim() === '管理'); e?.click(); return !!e })()`)
    await sleep(900)

    const inputReady = await evaluate('!!document.querySelector("input[accept*=\\".csv\\"]")')
    if (!inputReady) throw new Error('database file input missing')
    await evaluate(`(() => {
      const input = document.querySelector('input[accept*=".csv"]')
      const file = new File(['\\uFEFF名称,数量,备注\\n甲产品,10,第一批\\n乙产品,20,第二批\\n丙产品,30,第三批\\n'], 'maxlabel-import-fixture.csv', { type: 'text/csv' })
      const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files
      return input.files.length
    })()`)
    await evaluate('document.querySelector("input[accept*=\\".csv\\"]")?.dispatchEvent(new Event("change", { bubbles: true }))')
    await sleep(1800)
    const importState = await evaluate(`(() => { const t = document.body.innerText; const el = document.querySelector('[data-testid="status-database"]'); return { jia: t.includes('甲产品'), yi: t.includes('乙产品'), bing: t.includes('丙产品'), status: el?.textContent.trim() } })()`)
    results['three-row database import is visible'] = await evaluate(`document.body.innerText.includes('共 1 个数据集，3 行记录') && document.body.innerText.includes('首行：名称=甲产品')`)
    results['status bar uses current record over total and copies'] = importState.status.includes('1/3（1）')

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
