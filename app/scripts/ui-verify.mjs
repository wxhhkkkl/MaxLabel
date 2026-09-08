import WebSocket from 'ws'
import { writeFileSync } from 'node:fs'

const list = await (await fetch('http://127.0.0.1:9222/json/list')).json()
const page = list.find((t) => t.type === 'page' && /MaxLabel/.test(t.title))
if (!page) {
  console.log('NO-PAGE')
  process.exit(1)
}
const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const mid = ++id
    pending.set(mid, { resolve, reject })
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
}
ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString())
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) p.reject(new Error(msg.error.message))
    else p.resolve(msg.result)
  }
})
await new Promise((res) => ws.on('open', res))

async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) return 'EXC:' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result?.value !== undefined ? r.result.value : 'OK'
}
async function snap(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`C:/Users/liyan/Desktop/maxlabel/ui_cdp_${name}.png`, Buffer.from(r.data, 'base64'))
  console.log('saved ui_cdp_' + name + '.png')
}

// 1. 点"起始页"标签
console.log('tab start:', await evalJs(`(() => { const el=[...document.querySelectorAll('div')].find(x=>x.textContent==='起始页'&&x.offsetParent); if(!el)return 'NO'; el.click(); return 'OK'; })()`))
await new Promise((r) => setTimeout(r, 400))
await snap('1_start')

// 2. 点"新建标签模版"
console.log('new:', await evalJs(`(() => { const el=[...document.querySelectorAll('button')].find(x=>x.textContent&&x.textContent.indexOf('新建标签模版')!==-1&&x.offsetParent); if(!el)return 'NO'; el.click(); return 'OK'; })()`))
await new Promise((r) => setTimeout(r, 500))
await snap('2_modal')

// 3. 弹窗点"选择"
console.log('select:', await evalJs(`(() => { const el=[...document.querySelectorAll('button')].find(x=>x.textContent&&x.textContent.trim()==='选择'&&x.offsetParent); if(!el)return 'NO'; el.click(); return 'OK'; })()`))
await new Promise((r) => setTimeout(r, 600))
await snap('3_after')

// 4. 打开"帮助(H)"菜单
console.log('menu help:', await evalJs(`(() => { const el=[...document.querySelectorAll('button')].find(x=>x.textContent&&x.textContent.indexOf('帮助(H)')!==-1); if(!el)return 'NO'; el.click(); return 'OK'; })()`))
await new Promise((r) => setTimeout(r, 300))
// 5. 点"关于 MaxLabel"
console.log('about:', await evalJs(`(() => { const el=[...document.querySelectorAll('div')].find(x=>x.textContent==='关于 MaxLabel'&&x.offsetParent); if(!el)return 'NO'; el.click(); return 'OK'; })()`))
await new Promise((r) => setTimeout(r, 300))
await snap('4_about')

ws.close()
process.exit(0)
