/* 验证：编辑页点击"打印预览" → 弹出独立预览窗口（第二个 page）且渲染出标签内容 */
const http = require('http')
const fs = require('fs')
const path = require('path')
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } }) }).on('error', reject)
  })
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }
function attach(wsUrl) {
  return new Promise((resolve) => {
    const ws = new (require('ws'))(wsUrl)
    let id = 0
    const pending = {}
    const send = (method, params) => new Promise((res) => { const mid = ++id; pending[mid] = res; ws.send(JSON.stringify({ id: mid, method, params: params || {} })) })
    ws.on('message', (m) => { const msg = JSON.parse(m); if (msg.id && pending[msg.id]) { pending[msg.id](msg.result); delete pending[msg.id] } })
    ws.on('open', () => resolve({ ws, send }))
  })
}
;(async () => {
  try {
    let list = await getJson('http://127.0.0.1:9222/json/list')
    const main = list.find((t) => t.type === 'page')
    if (!main) throw new Error('no main page')
    const c1 = await attach(main.webSocketDebuggerUrl)
    await c1.send('Page.enable'); await c1.send('Runtime.enable')
    const js1 = async (expr) => { const r = await c1.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.exceptionDetails ? 'EXC' : r.result?.value }
    // 新建标签两步
    await js1(`(() => { const els=[...document.querySelectorAll('*')].filter(e=>e.children.length===0 && (e.textContent||'').trim().startsWith('新建标签')); if(els.length) els[els.length-1].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return 1 })()`)
    await sleep(900)
    await js1(`(() => { const els=[...document.querySelectorAll('*')].filter(e=>e.children.length===0 && (e.textContent||'').trim()==='选择'); if(els.length) els[els.length-1].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return 1 })()`)
    await sleep(1500)
    // 点打印预览按钮（打印面板内）
    const clicked = await js1(`(() => { const els=[...document.querySelectorAll('*')].filter(e=>e.children.length===0 && (e.textContent||'').trim()==='打印预览'); if(!els.length) return false; els[els.length-1].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true })()`)
    await sleep(2000)
    const results = { '点击打印预览按钮': clicked }
    list = await getJson('http://127.0.0.1:9222/json/list')
    const pages = list.filter((t) => t.type === 'page')
    results['出现独立预览窗口'] = pages.length >= 2
    if (pages.length >= 2) {
      const pv = pages[pages.length - 1]
      const c2 = await attach(pv.webSocketDebuggerUrl)
      await c2.send('Page.enable'); await c2.send('Runtime.enable')
      const t2 = await c2.send('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true })
      const body = (t2.result?.value || '')
      results['预览窗口含打印按钮'] = body.includes('打印')
      results['预览窗口含缩放控件'] = body.includes('%') || body.includes('放大')
      await c2.send('Page.captureScreenshot', { format: 'png' }).then((s) => { fs.writeFileSync(path.join(__dirname, '..', '_v_preview.png'), Buffer.from(s.data, 'base64')) }).catch(() => {})
      c2.ws.close()
    }
    c1.ws.close()
    let pass = 0
    for (const [k, v] of Object.entries(results)) { console.log((v ? 'PASS ' : 'FAIL ') + k + ' => ' + v); if (v) pass++ }
    console.log('\n' + pass + '/' + Object.keys(results).length + ' PASS')
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (e) { console.error('ERR', e.message); process.exit(2) }
})()
