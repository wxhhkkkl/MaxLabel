/*
 * MaxLabel 侧取证器：通过 CDP 驱动 Electron 渲染进程，按步骤脚本点击/截图。
 *
 * 用法：
 *   node tools/parity/maxlabel-cdp.cjs <steps.json> [outDir]
 *
 * 步骤脚本是 JSON 数组，支持的操作：
 *   { "op": "eval",     "js": "……" }                在页面里执行 JS
 *   { "op": "click",    "text": "新建标签" }          点击文本匹配的最内层元素（等于优先，其次前缀）
 *   { "op": "dblclick", "text": "……" }               双击
 *   { "op": "key",      "key": "ctrl+n" }            派发快捷键（keydown/keyup，支持 ctrl/shift/alt）
 *   { "op": "sleep",    "ms": 800 }                  等待
 *   { "op": "shot",     "name": "10-main" }          截图到 <outDir>/<name>.png
 *
 * 环境：MAXLABEL_DEBUG_PORT 指定 CDP 端口（默认 9222）
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const stepsFile = process.argv[2]
const outDir = process.argv[3] || path.join(__dirname, '..', '..', 'parity', 'reference', 'maxlabel')
if (!stepsFile) {
  console.error('用法: node maxlabel-cdp.cjs <steps.json> [outDir]')
  process.exit(2)
}
const steps = JSON.parse(fs.readFileSync(stepsFile, 'utf8'))
fs.mkdirSync(outDir, { recursive: true })

const debugPort = process.env.MAXLABEL_DEBUG_PORT || 9222

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = ''
      res.on('data', (c) => (d += c))
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } })
    }).on('error', reject)
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ws 模块装在 app/node_modules 下，脚本在 tools/ 下运行，这里显式多路径解析
function requireWs() {
  const candidates = ['ws', path.join(__dirname, '..', '..', 'app', 'node_modules', 'ws')]
  for (const c of candidates) {
    try { return require(c) } catch (e) { /* 继续找 */ }
  }
  throw new Error('找不到 ws 模块（先在 app 下 npm install）')
}

function attach(wsUrl) {
  return new Promise((resolve, reject) => {
    const WebSocket = requireWs()
    const ws = new WebSocket(wsUrl)
    let id = 0
    const pending = {}
    const send = (method, params) => new Promise((res) => {
      const mid = ++id
      pending[mid] = res
      ws.send(JSON.stringify({ id: mid, method, params: params || {} }))
    })
    ws.on('message', (m) => {
      const msg = JSON.parse(m)
      if (msg.id && pending[msg.id]) { pending[msg.id](msg.result); delete pending[msg.id] }
    })
    ws.on('open', () => resolve({ ws, send }))
    ws.on('error', reject)
  })
}

// 页面内通用工具：按文本找最内层元素
const HELPERS = `
window.__mlFind = (text, exact) => {
  const all = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && (e.textContent||'').trim().length > 0)
  const t = (text||'').trim()
  let hit = all.filter(e => (e.textContent||'').trim() === t)
  if (!hit.length) hit = all.filter(e => (e.textContent||'').trim().startsWith(t))
  if (!hit.length) hit = [...document.querySelectorAll('*')].filter(e => ((e.textContent||'').trim().startsWith(t)) && (e.offsetWidth||e.offsetHeight))
  return hit.length ? hit[hit.length - 1] : null
}
window.__mlClick = (text) => { const el = window.__mlFind(text); if (!el) return false; el.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, view:window})); return true }
window.__mlDbl = (text) => { const el = window.__mlFind(text); if (!el) return false; el.dispatchEvent(new MouseEvent('dblclick', {bubbles:true, cancelable:true, view:window})); return true }
window.__mlDismiss = () => {
  const els = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && ['×','✕','关闭','确定','知道了'].includes((e.textContent||'').trim()))
  if (els.length) { els[els.length-1].dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true})); return true }
  return false
}
true
`

;(async () => {
  const results = []
  let page = null
  try {
    const list = await getJson(`http://127.0.0.1:${debugPort}/json/list`)
    page = list.find((t) => t.type === 'page')
    if (!page) throw new Error('CDP 里没有 page 目标，应用可能没起来')
  } catch (e) {
    console.error('连接失败:', e.message)
    process.exit(3)
  }

  const conn = await attach(page.webSocketDebuggerUrl)
  await conn.send('Page.enable')
  await conn.send('Runtime.enable')
  await conn.send('Runtime.evaluate', { expression: HELPERS, returnByValue: true })

  const evaluate = async (expr) => {
    const r = await conn.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
    if (r && r.exceptionDetails) return { error: r.exceptionDetails.text || 'exception' }
    return { value: r && r.result ? r.result.value : undefined }
  }

  for (const step of steps) {
    try {
      switch (step.op) {
        case 'eval': {
          const r = await evaluate(step.js)
          results.push(`eval ${step.label || ''} => ${r.error ? 'EXC ' + r.error : JSON.stringify(r.value)}`)
          break
        }
        case 'click': {
          const r = await evaluate(`window.__mlClick(${JSON.stringify(step.text)})`)
          results.push(`click "${step.text}" => ${r.value}`)
          await sleep(step.wait || 600)
          break
        }
        case 'dblclick': {
          const r = await evaluate(`window.__mlDbl(${JSON.stringify(step.text)})`)
          results.push(`dblclick "${step.text}" => ${r.value}`)
          await sleep(step.wait || 800)
          break
        }
        case 'dismiss': {
          const r = await evaluate('window.__mlDismiss()')
          results.push(`dismiss => ${r.value}`)
          await sleep(step.wait || 400)
          break
        }
        case 'key': {
          const combo = String(step.key).toLowerCase()
          const parts = combo.split('+')
          const key = parts.pop()
          const opts = {
            key,
            code: key.length === 1 ? 'Key' + key.toUpperCase() : key,
            ctrlKey: parts.includes('ctrl'),
            shiftKey: parts.includes('shift'),
            altKey: parts.includes('alt'),
            metaKey: parts.includes('meta'),
            bubbles: true,
            cancelable: true
          }
          const r = await evaluate(`(() => { const o = ${JSON.stringify(opts)}; document.dispatchEvent(new KeyboardEvent('keydown', o)); document.dispatchEvent(new KeyboardEvent('keyup', o)); window.dispatchEvent(new KeyboardEvent('keydown', o)); return true })()`)
          results.push(`key "${step.key}" => ${r.value}`)
          await sleep(step.wait || 700)
          break
        }
        case 'sleep': {
          await sleep(step.ms || 500)
          results.push(`sleep ${step.ms || 500}`)
          break
        }
        case 'shot': {
          const shot = await conn.send('Page.captureScreenshot', { format: 'png' })
          const file = path.join(outDir, `${step.name}.png`)
          fs.writeFileSync(file, Buffer.from(shot.data, 'base64'))
          results.push(`shot ${file}`)
          break
        }
        default:
          results.push(`未知步骤: ${JSON.stringify(step)}`)
      }
    } catch (e) {
      results.push(`步骤失败 ${JSON.stringify(step)}: ${e.message}`)
    }
  }

  // 结束时把窗口 DOM 文本存一份，便于比对控件文案
  try {
    const body = await evaluate('document.body.innerText')
    fs.writeFileSync(path.join(outDir, '_last-body.txt'), String(body.value || ''), 'utf8')
  } catch (e) { /* ignore */ }

  conn.ws.close()
  console.log(results.join('\n'))
  process.exit(0)
})()
