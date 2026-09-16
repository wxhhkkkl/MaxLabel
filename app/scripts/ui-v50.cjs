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
    const debugPort = process.env.MAXLABEL_DEBUG_PORT || 9222
    let list = await getJson(`http://127.0.0.1:${debugPort}/json/list`)
    const main = list.find((t) => t.type === 'page')
    if (!main) throw new Error('no main page')
    const c1 = await attach(main.webSocketDebuggerUrl)
    await c1.send('Page.enable'); await c1.send('Runtime.enable')
    const js1 = async (expr) => { const r = await c1.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.exceptionDetails ? 'EXC' : r.result?.value }
    // 每个 UI 场景使用独立 userData 时，首次启动引导仍可能遮挡编辑页。
    await js1(`(() => { const els=[...document.querySelectorAll('*')].filter(e=>e.children.length===0 && (e.textContent||'').trim()==='×'); if(els.length) els[els.length-1].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true })()`)
    await sleep(400)
    // 新建标签两步：模板向导 →（下一步）→ 选择标签格式 →（选择）
    // DIFF-3（round-09）起流程是两步向导，缺「下一步」会停在向导第 1 步、建不出文档。
    await js1(`(() => { const els=[...document.querySelectorAll('*')].filter(e=>e.children.length===0 && (e.textContent||'').trim().startsWith('新建标签')); if(els.length) els[els.length-1].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return 1 })()`)
    await sleep(900)
    await js1(`(() => { const els=[...document.querySelectorAll('*')].filter(e=>e.children.length===0 && (e.textContent||'').trim()==='下一步'); if(els.length) els[els.length-1].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return 1 })()`)
    await sleep(900)
    await js1(`(() => { const els=[...document.querySelectorAll('*')].filter(e=>e.children.length===0 && (e.textContent||'').trim()==='选择'); if(els.length) els[els.length-1].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return 1 })()`)
    await sleep(1500)
    // 打印停靠面板本身（DIFF-8 口径：只有「输入数据 / 打印机 / 打印数量 / 单签拷贝 / 打印」，
    // 预览不在面板里；原版同样把「预览」放在打印对话框，见帮助 print_dlg_main.html）
    const dock = await js1(`(() => { const d=document.querySelector('[data-testid=print-dock]'); if(!d) return null; return JSON.stringify({ title: document.querySelector('[data-testid=print-dock-title]')?.textContent||'', submit: !!document.querySelector('[data-testid=print-submit]'), inputData: !!document.querySelector('[data-testid=print-input-data]'), printer: !!document.querySelector('[data-testid=print-printer]'), count: !!document.querySelector('[data-testid=print-count]'), copies: !!document.querySelector('[data-testid=print-copies]') }) })()`)
    const dockInfo = dock ? JSON.parse(dock) : {}
    const results = {}
    results['打印面板存在且标题为「打印 - <文档名>」'] = /^打印 - \S/.test(dockInfo.title || '')
    results['打印面板含输入数据/打印机/打印数量/单签拷贝/打印'] =
      dockInfo.inputData === true && dockInfo.printer === true && dockInfo.count === true &&
      dockInfo.copies === true && dockInfo.submit === true

    // 预览入口在打印对话框：Ctrl+P → 点「预览」
    await js1(`(() => { const e=new KeyboardEvent('keydown',{key:'p',code:'KeyP',ctrlKey:true,bubbles:true,cancelable:true}); document.dispatchEvent(e); window.dispatchEvent(e); return true })()`)
    await sleep(1200)
    const dlgOpen = await js1(`!!document.querySelector('[data-testid=print-dialog]')`)
    const clicked = await js1(`(() => { const b=document.querySelector('[data-testid=print-dialog-preview]'); if(!b) return false; b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true })()`)
    await sleep(2500)
    results['Ctrl+P 打开打印对话框且含「预览」按钮'] = dlgOpen === true && clicked === true

    list = await getJson(`http://127.0.0.1:${debugPort}/json/list`)
    const previewPage = list.find((t) => t.type === 'page' && /maxlabel-prev-/.test(t.url || ''))
    results['出现独立预览窗口'] = !!previewPage
    if (previewPage) {
      const c2 = await attach(previewPage.webSocketDebuggerUrl)
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
