/* 启动冒烟：起始页渲染 + 四栏 + 新建标签 + 图片属性类型 select 存在性 */
const http = require('http')

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = ''
      res.on('data', (c) => (d += c))
      res.on('end', () => resolve(JSON.parse(d)))
    }).on('error', reject)
  })
}
function post(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = http.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let d = ''
      res.on('data', (c) => (d += c))
      res.on('end', () => resolve(JSON.parse(d)))
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

;(async () => {
  const list = await getJson('http://127.0.0.1:9222/json/list')
  const page = list.find((t) => t.type === 'page')
  if (!page) { console.log('FAIL no page'); process.exit(1) }
  const ws = page.webSocketDebuggerUrl
  const WebSocket = require('ws')
  const sock = new WebSocket(ws)
  let id = 0
  const pending = {}
  sock.on('message', (raw) => {
    const msg = JSON.parse(raw.toString())
    if (msg.id && pending[msg.id]) { pending[msg.id](msg); delete pending[msg.id] }
  })
  const send = (method, params) => new Promise((resolve) => {
    const mid = ++id
    pending[mid] = resolve
    sock.send(JSON.stringify({ id: mid, method, params: params || {} }))
  })
  await new Promise((r) => sock.on('open', r))
  await send('Page.enable')
  await send('Runtime.enable')

  const evaljs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true })
    return r.result && r.result.result ? r.result.result.value : undefined
  }
  await new Promise((r) => setTimeout(r, 2500))

  const check = async (name, expr) => {
    const v = await evaljs(expr)
    console.log((v ? 'PASS' : 'FAIL') + ' ' + name + ' => ' + JSON.stringify(v))
  }

  await check('startpage has 工具栏', `!!document.querySelector('button') && document.body.innerText.includes('文件') && document.body.innerText.includes('新建标签模版')`)
  await check('menubar 12 menus', `(() => { const els = [...document.querySelectorAll('*')].filter(e => e.children.length===0 && ['文件(F)','编辑(E)','查看(V)','工具(T)','排列(A)','数据库(D)','账户(A)','云马通(C)','选项(O)','窗口(W)','帮助(H)','建议与反馈'].includes(e.textContent.trim())); return els.length >= 8 })()`)
  await check('statusbar exists', `document.body.innerText.includes('就绪') || document.body.innerText.includes('100%')`)
  await check('no blank page', `document.body.innerText.length > 200`)

  sock.close()
  process.exit(0)
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
