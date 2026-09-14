/* P0-C：数据库记录导航、打印起始记录与定位查找方向（C-60～C-69） */
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
    const setValue = (selector, value) => evaluate(`(() => {
      const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return false
      const proto = e instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
      setter.call(e, ${JSON.stringify(String(value))})
      e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true
    })()`)
    const key = (name, options = {}) => evaluate(`(() => { window.dispatchEvent(new KeyboardEvent('keydown', ${JSON.stringify({ key: name, code: name, bubbles: true, cancelable: true, ...options })})); return true })()`)
    const status = () => evaluate('document.querySelector("[data-testid=status-database]")?.textContent.trim() || ""')

    await sleep(1800)
    await evaluate('document.querySelector("button[aria-label=关闭]")?.click()')
    await key('n', { ctrlKey: true }); await sleep(350)
    await click('[data-testid="wizard-next"]'); await sleep(450)
    await evaluate(`(() => { const items = [...document.querySelectorAll('button')].filter((e) => e.offsetParent && (e.textContent || '').trim() === '选择'); items.at(-1)?.click(); return !!items.length })()`)
    await sleep(800)
    await evaluate(`(() => { const e = [...document.querySelectorAll('button')].find((x) => x.offsetParent && (x.textContent || '').trim() === '管理'); e?.click(); return !!e })()`)
    await sleep(500)
    await evaluate(`(() => {
      const input = document.querySelector('input[accept*=".csv"]'); if (!input) return false
      const file = new File(['\\uFEFF名称,数量\\n甲产品,10\\n乙产品,20\\n丙产品,30\\n'], 'c62.csv', { type: 'text/csv' })
      const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files
      input.dispatchEvent(new Event('change', { bubbles: true })); return true
    })()`)
    await sleep(1000)
    await evaluate(`(() => { const e = [...document.querySelectorAll('button')].find((x) => x.offsetParent && (x.textContent || '').trim() === '关闭'); e?.click(); return !!e })()`)
    await sleep(450)

    await click('[title="第一条记录"]'); await sleep(100)
    results['database status starts at first record'] = (await status()).includes('1/3')
    await click('[title="下一条记录"]'); await sleep(100)
    results['next record advances current record'] = (await status()).includes('2/3')
    await click('[title="第一条记录"]'); await sleep(100)
    await click('[data-menu-title="数据库(D)"]'); await sleep(100)
    await evaluate(`(() => { const items = [...document.querySelectorAll('[data-menu-item]')].filter((e) => e.offsetParent && (e.textContent || '').trim() === '下一条记录'); items.at(-1)?.click(); return !!items.length })()`)
    await sleep(100)
    results['database menu next record uses the same pointer'] = (await status()).includes('2/3')
    await click('[title="最后一条记录"]'); await sleep(100)
    results['last record reaches dataset end'] = (await status()).includes('3/3')
    await click('[title="上一条记录"]'); await sleep(100)
    results['previous record moves back one row'] = (await status()).includes('2/3')

    await click('[title="定位记录"]'); await sleep(250)
    await click('[data-testid="locate-mode-field"]'); await sleep(100)
    results['record locator exposes four search directions'] = await evaluate('document.querySelector("[data-testid=locate-direction]")?.options.length === 4')
    results['record locator exposes field and fuzzy search'] = await evaluate('!!document.querySelector("[data-testid=locate-mode-field]") && !!document.querySelector("[data-testid=locate-fuzzy]") && !!document.querySelector("[data-testid=locate-field-content]")')
    await setValue('[data-testid="locate-field-content"]', '甲产品')
    await setValue('[data-testid="locate-direction"]', 'forward-cycle')
    await click('[data-testid="locate-submit"]'); await sleep(250)
    results['cyclic field search locates a matching record'] = (await status()).includes('1/3')

    await click('[title="定位记录"]'); await sleep(200)
    await click('[data-testid="locate-mode-field"]'); await sleep(80)
    await setValue('[data-testid="locate-field-content"]', '乙')
    await setValue('[data-testid="locate-direction"]', 'forward')
    await click('[data-testid="locate-submit"]'); await sleep(250)
    results['forward fuzzy search locates the next matching row'] = (await status()).includes('2/3')

    await click('[title="第一条记录"]'); await sleep(100)
    await key('p', { ctrlKey: true }); await sleep(250)
    const dialogText = await evaluate('document.querySelector("[data-testid=print-dialog]")?.innerText || ""')
    results['database print dialog has start record and defaults'] = dialogText.includes('打印数量') && dialogText.includes('单签拷贝') && dialogText.includes('启始记录') && await evaluate('document.querySelector("[data-testid=print-dialog-start-record]")?.value === "1" && document.querySelector("[data-testid=print-dialog-count]")?.value === "1" && document.querySelector("[data-testid=print-dialog-copies]")?.value === "1"')
    results['database print advanced labels match help'] = dialogText.includes('打印时自动设置数据库记录数量') && dialogText.includes('拷贝数量从数据库字段引入') && dialogText.includes('允许打印时输入第一个标签的拷贝数量')
    await click('[data-testid="print-option-copy-field"]'); await sleep(100)
    results['copy count field reveals field name input'] = await evaluate('!!document.querySelector("[data-testid=print-option-copy-field-name]")')
    await setValue('[data-testid="print-dialog-start-record"]', '2'); await sleep(120)
    results['print start record changes current dataset pointer'] = (await status()).includes('2/3')
    await click('[aria-label="关闭打印对话框"]'); await sleep(120)

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
