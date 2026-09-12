/* 验证：新建标签 → 打印面板标题“打印 - 未命名标签”；查看菜单→打印历史记录 对话框含“打开日志文件”按钮 */
const http = require('http')
const fs = require('fs')
const path = require('path')
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } }) }).on('error', reject)
  })
}
;(async () => {
  try {
    const list = await getJson(`http://127.0.0.1:${process.env.MAXLABEL_DEBUG_PORT || 9222}/json/list`)
    const page = list.find((t) => t.type === 'page')
    if (!page) throw new Error('no page')
    const ws = new (require('ws'))(page.webSocketDebuggerUrl)
    let id = 0
    const pending = {}
    const send = (method, params) => new Promise((resolve) => { const mid = ++id; pending[mid] = resolve; ws.send(JSON.stringify({ id: mid, method, params: params || {} })) })
    ws.on('message', (m) => { const msg = JSON.parse(m); if (msg.id && pending[msg.id]) { pending[msg.id](msg.result); delete pending[msg.id] } })
    await new Promise((r) => ws.on('open', r))
    await send('Page.enable')
    await send('Runtime.enable')
    const js = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) return 'EXC:' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
      return r.result?.value
    }
    const results = {}
    // 首启“新手入门”引导弹窗可能遮挡：先关闭（点 ✕）
    await js(`(() => { const els=[...document.querySelectorAll('*')].filter(e=>e.children.length===0 && (e.textContent||'').trim()==='×'); if(els.length){ els[els.length-1].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})) } return true })()`)
    await new Promise((r) => setTimeout(r, 400))
    // 新建标签 → 选择
    await js(`(() => { const els=[...document.querySelectorAll('*')].filter(e=>e.children.length===0 && (e.textContent||'').trim().startsWith('新建标签')); if(els.length) els[els.length-1].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true })()`)
    await new Promise((r) => setTimeout(r, 900))
    await js(`(() => { const els=[...document.querySelectorAll('*')].filter(e=>e.children.length===0 && (e.textContent||'').trim()==='选择'); if(els.length) els[els.length-1].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true })()`)
    await new Promise((r) => setTimeout(r, 1400))
    let bt = await js('document.body.innerText')
    results['编辑页 打印面板标题'] = (bt || '').includes('打印 - ')
    // 展开 查看(V) 菜单
    await js(`(() => { const els=[...document.querySelectorAll('*')].filter(e=>e.children.length===0 && (e.textContent||'').trim()==='查看(V)'); if(els.length) els[els.length-1].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true })()`)
    await new Promise((r) => setTimeout(r, 400))
    // 点“打印历史记录”菜单项
    const opened = await js(`(() => { const els=[...document.querySelectorAll('*')].filter(e=>e.children.length===0 && (e.textContent||'').trim()==='打印历史记录'); if(!els.length) return false; els[els.length-1].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); return true })()`)
    await new Promise((r) => setTimeout(r, 900))
    bt = await js('document.body.innerText')
    results['打开打印历史对话框'] = opened && (bt || '').includes('打印历史')
    results['含 打开日志文件 按钮'] = (bt || '').includes('打开日志文件')
    results['含 导出CSV 按钮'] = (bt || '').includes('导出')
    results['含 清空 按钮'] = (bt || '').includes('清空')
    await send('Page.captureScreenshot', { format: 'png' }).then((s) => {
      fs.writeFileSync(path.join(__dirname, '..', '_v_history.png'), Buffer.from(s.data, 'base64'))
    }).catch(() => {})
    let pass = 0
    for (const [k, v] of Object.entries(results)) {
      console.log((v ? 'PASS ' : 'FAIL ') + k + ' => ' + v)
      if (v) pass++
    }
    console.log('\n' + pass + '/' + Object.keys(results).length + ' PASS')
    ws.close()
    process.exit(pass === Object.keys(results).length ? 0 : 1)
  } catch (e) {
    console.error('ERR', e.message)
    process.exit(2)
  }
})()
