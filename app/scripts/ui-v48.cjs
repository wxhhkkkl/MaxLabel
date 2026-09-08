/* 编辑页整体冒烟：新建标签 → 编辑器核心区（工具栏/格式栏/对齐栏/画布/图层/打印面板/属性） */
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
    const list = await getJson('http://127.0.0.1:9222/json/list')
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
    const bodyText = await js(`document.body.innerText`)
    const has = (s) => (bodyText || '').includes(s)
    const results = {
      'start page': has('新标签模板') || has('新建标签'),
      'menubar 文件(F)': has('文件(F)'),
      'menubar 编辑(E)': has('编辑(E)'),
      'menubar 帮助(H)': has('帮助(H)'),
    }
    // 首启“新手入门”引导弹窗可能遮挡：先关闭（点 ✕）
    await js(`(() => { const els=[...document.querySelectorAll('*')].filter(e=>e.children.length===0 && (e.textContent||'').trim()==='×'); if(els.length){ els[els.length-1].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})) } return true })()`)
    await new Promise((r) => setTimeout(r, 400))
    // 点“新建标签”按钮/卡片进入编辑页
    const clickedNew = await js(`(() => {
      const els = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && (e.textContent||'').trim().startsWith('新建标签'))
      if (!els.length) return false
      els[els.length-1].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      return true
    })()`)
    await new Promise((r) => setTimeout(r, 1000))
    // 选择标签格式对话框 → 点“选择”进入编辑页
    const clickedSelect = await js(`(() => {
      const els = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && (e.textContent||'').trim() === '选择')
      if (!els.length) return false
      els[els.length-1].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      return true
    })()`)
    await new Promise((r) => setTimeout(r, 1500))
    const editText = await js(`document.body.innerText`)
    const ehas = (s) => (editText || '').includes(s)
    results['clicked new label'] = clickedNew
    results['clicked 选择'] = clickedSelect
    results['editor 图层'] = ehas('图层')
    results['editor 打印面板标题'] = ehas('打印 -')
    results['editor 参数设置'] = ehas('参数设置')
    results['editor 起始标签'] = ehas('起始标签')
    results['editor 打印按钮'] = ehas('打印预览') && ehas('测试打印')
    results['editor 打印机(TSPL)'] = ehas('TSPL')
    results['editor 状态栏尺寸'] = ehas('mm') && ehas('dpi')
    // 截图
    await send('Page.captureScreenshot', { format: 'png' }).then((s) => {
      fs.writeFileSync(path.join(__dirname, '..', '_v_edit_smoke.png'), Buffer.from(s.data, 'base64'))
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
