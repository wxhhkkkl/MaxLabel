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
window.__mlFindByTitle = (title) => {
  const t = (title||'').trim()
  const all = [...document.querySelectorAll('[title],[aria-label],[data-tool]')]
  let hit = all.filter(e => (e.getAttribute('title')||'') === t || (e.getAttribute('aria-label')||'') === t || (e.getAttribute('data-tool')||'') === t)
  if (!hit.length) hit = all.filter(e => ((e.getAttribute('title')||'') + (e.getAttribute('aria-label')||'') + (e.getAttribute('data-tool')||'')).includes(t))
  return hit.length ? hit[0] : null
}
window.__mlClickTitle = (title) => { const el = window.__mlFindByTitle(title); if (!el) return false; el.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, view:window})); return true }
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
        case 'clicktitle': {
          const r = await evaluate(`window.__mlClickTitle(${JSON.stringify(step.text)})`)
          results.push(`clicktitle "${step.text}" => ${r.value}`)
          await sleep(step.wait || 600)
          break
        }
        case 'clickxy': {
          // 在画布容器上按相对坐标点一下（用于放置对象）
          const r = await evaluate(`(() => {
            const host = document.querySelector('[data-testid="canvas-host"], .canvas-container, canvas')
            if (!host) return 'no-canvas'
            const box = host.getBoundingClientRect()
            const x = box.left + ${Number(step.x) || 0}
            const y = box.top + ${Number(step.y) || 0}
            const target = document.elementFromPoint(x, y) || host
            const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 }
            // fabric 6/7 默认监听 pointer 事件，两种都发一遍最稳
            try { target.dispatchEvent(new PointerEvent('pointerdown', opts)) } catch (e) {}
            target.dispatchEvent(new MouseEvent('mousedown', opts))
            try { target.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0 })) } catch (e) {}
            target.dispatchEvent(new MouseEvent('mouseup', { ...opts, buttons: 0 }))
            target.dispatchEvent(new MouseEvent('click', { ...opts, buttons: 0 }))
            return target.tagName + '@' + Math.round(x) + ',' + Math.round(y)
          })()`)
          results.push(`clickxy ${step.x},${step.y} => ${r.value}`)
          await sleep(step.wait || 800)
          break
        }
        case 'dblclickxy': {
          const r = await evaluate(`(() => {
            const host = document.querySelector('[data-testid="canvas-host"], .canvas-container, canvas')
            if (!host) return 'no-canvas'
            const box = host.getBoundingClientRect()
            const x = box.left + ${Number(step.x) || 0}
            const y = box.top + ${Number(step.y) || 0}
            const target = document.elementFromPoint(x, y) || host
            const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, detail: 2, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 }
            try { target.dispatchEvent(new PointerEvent('pointerdown', opts)) } catch (e) {}
            target.dispatchEvent(new MouseEvent('mousedown', opts))
            try { target.dispatchEvent(new PointerEvent('pointerup', { ...opts, buttons: 0 })) } catch (e) {}
            target.dispatchEvent(new MouseEvent('mouseup', { ...opts, buttons: 0 }))
            target.dispatchEvent(new MouseEvent('click', { ...opts, buttons: 0 }))
            target.dispatchEvent(new MouseEvent('dblclick', { ...opts, buttons: 0 }))
            return target.tagName + '@' + Math.round(x) + ',' + Math.round(y)
          })()`)
          results.push(`dblclickxy ${step.x},${step.y} => ${r.value}`)
          await sleep(step.wait || 900)
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
        case 'setfile': {
          // 给页面里的 <input type=file> 塞文件（走 CDP DOM.setFileInputFiles），
          // 用于验证 CSV/Excel 导入、图片对象导入等需要文件选择器的流程。
          try {
            await conn.send('DOM.enable')
            const doc = await conn.send('DOM.getDocument', { depth: 1 })
            const sel = step.sel || 'input[type=file]'
            let nodeId = null
            const q = await conn.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: sel })
            nodeId = q && q.nodeId
            if (!nodeId) {
              // 页面里可能有多个 file input，逐个试
              const all = await conn.send('DOM.querySelectorAll', { nodeId: doc.root.nodeId, selector: 'input[type=file]' })
              if (all && all.nodeIds && all.nodeIds.length) nodeId = all.nodeIds[all.nodeIds.length - 1]
            }
            if (!nodeId) results.push(`setfile ${step.file} => 未找到 input[type=file]`)
            else {
              await conn.send('DOM.setFileInputFiles', { files: [step.file], nodeId })
              results.push(`setfile ${step.file} => ok`)
            }
          } catch (e) {
            results.push(`setfile 失败: ${e.message}`)
          }
          await sleep(step.wait || 900)
          break
        }
        case 'key': {
          // 只把修饰键小写化，键名保留原大小写（应用判断的是 e.key === 'Enter' 这种）
          const raw = String(step.key)
          const parts = raw.split('+').map((p, i, arr) => (i === arr.length - 1 ? p : p.toLowerCase()))
          const keyRaw = parts.pop()
          const key = keyRaw.length === 1 ? keyRaw.toLowerCase() : (keyRaw.charAt(0).toUpperCase() + keyRaw.slice(1).toLowerCase())
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
