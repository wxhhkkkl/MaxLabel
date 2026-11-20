import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { mkdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { validatePreviewPayload } from './ipc/validation'

const PRINT_FROM_PREVIEW = 'https://maxlabel.invalid/print-preview/submit'

/** The preview displays raster samples; its owner runs any actual print job. */
export async function openPreviewWindow(rawPayload: unknown, parent: BrowserWindow | null): Promise<{ ok: true; printRequested: boolean }> {
  const { dataUrl, pages, widthMm, heightMm, truncated, language } = validatePreviewPayload(rawPayload)
  const english = language === 'en-US'
  const text = {
    title: english ? 'Print Preview' : '打印预览',
    truncated: english ? ' · showing the first 200 pages only' : ' · 仅显示前 200 页',
    fit: english ? 'Fit' : '适应',
    print: english ? 'Print' : '打印',
    close: english ? 'Close' : '关闭'
  }
  const imgs = (pages && pages.length ? pages : [dataUrl ?? '']).filter(Boolean)
  const dir = join(tmpdir(), `maxlabel-prev-${randomUUID()}`)
  let prepared = false
  const paths: string[] = []
  try {
    await mkdir(dir, { recursive: true })
    for (let i = 0; i < imgs.length; i++) {
      const base64 = String(imgs[i]).split(',')[1] ?? ''
      if (!base64) throw new Error('preview:open: 图片数据无效')
      const path = join(dir, `p${i}.png`)
      await writeFile(path, Buffer.from(base64, 'base64'))
      paths.push(path)
    }
    const urls = paths.map((path) => pathToFileURL(path).toString())
    // Keep file URLs in the lightweight page shell and decode only the active
    // page. Large preview batches otherwise make Chromium decode 200 PNGs at
    // once even though the user sees one page.
    const pageMarkup = urls.map((url, index) => `<div class="page${index === 0 ? ' active' : ''}"><img data-src=${JSON.stringify(url)} loading="lazy"></div>`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src file:; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><title>${text.title}</title><style>
html,body{margin:0;padding:0;height:100%;background:#3A3F47;font-family:'Segoe UI','Microsoft YaHei',sans-serif}body{display:flex;flex-direction:column;align-items:center;overflow:auto}.bar{display:flex;align-items:center;width:100%;box-sizing:border-box;padding:8px 14px;background:#2C3138;color:#E8EAED;position:sticky;top:0;z-index:5}.bar .t{font-size:13px;font-weight:600}.bar .s{font-size:11px;color:#9AA3AD;margin-left:10px}.zc{display:flex;align-items:center;gap:6px;margin-left:auto}.zc button{background:#3A4049;border:1px solid #4A515B;color:#E8EAED;font-size:13px;line-height:1;padding:5px 10px;border-radius:5px;cursor:pointer}.zc span{font-size:11px;color:#9AA3AD;min-width:44px;text-align:center}.zc input{width:90px;accent-color:#4A90C2;cursor:pointer}.wrap{flex:1;display:flex;align-items:flex-start;justify-content:center;padding:20px;width:100%;box-sizing:border-box}.page{display:none}.page.active{display:block}img{display:block;background:#fff;box-shadow:0 6px 24px rgba(0,0,0,.4);border-radius:4px;border:1px solid #9AA3AD}
@media print{body{display:none}}
 </style></head><body><div class="bar"><span class="t">${text.title}</span><span class="s">${String(widthMm)} × ${String(heightMm)} mm${truncated ? text.truncated : ''}</span><div class="zc"><button id="pprev">‹</button><span id="ppage">1/${imgs.length}</span><button id="pnext">›</button><button id="zout">−</button><input id="zrange" type="range" min="25" max="400" step="5" value="100"><span id="zpct">100%</span><button id="zin">＋</button><button id="zfit">${text.fit}</button><button id="z1">1:1</button><button id="pprint" style="margin-left:10px;background:#4A90C2;border:none;color:#fff">${text.print}</button><button id="pclose">${text.close}</button></div></div><div class="wrap">${pageMarkup}</div><script>
(() => {
  const pages = [...document.querySelectorAll('.page')]
  const images = pages.map((page) => page.querySelector('img'))
  const byId = (id) => document.getElementById(id)
  const range = byId('zrange')
  const percent = byId('zpct')
  const previous = byId('pprev')
  const next = byId('pnext')
  let current = 0

  function load(image) {
    if (!image.src) image.src = image.dataset.src
  }

  function zoom(value) {
    const percentValue = Math.max(25, Math.min(400, value))
    range.value = percentValue
    percent.textContent = percentValue + '%'
    const image = images[current]
    image.style.width = image.naturalWidth * percentValue / 100 + 'px'
    image.style.height = 'auto'
  }

  function fit() {
    const image = images[current]
    if (!image.naturalWidth) return
    const wrap = document.querySelector('.wrap')
    const widthRatio = (wrap.clientWidth - 40) / image.naturalWidth
    const heightRatio = (wrap.clientHeight - 40) / image.naturalHeight
    zoom(Math.min(100, Math.round(Math.min(widthRatio, heightRatio) * 100)))
  }

  function show(index) {
    current = Math.max(0, Math.min(pages.length - 1, index))
    pages.forEach((page, pageIndex) => page.classList.toggle('active', pageIndex === current))
    load(images[current])
    byId('ppage').textContent = (current + 1) + '/' + pages.length
    previous.disabled = current === 0
    next.disabled = current === pages.length - 1
    fit()
  }

  images.forEach((image) => {
    image.onload = () => { if (image === images[current]) fit() }
  })
  previous.onclick = () => show(current - 1)
  next.onclick = () => show(current + 1)
  range.oninput = () => zoom(Number(range.value))
  byId('zout').onclick = () => zoom(Number(range.value) - 10)
  byId('zin').onclick = () => zoom(Number(range.value) + 10)
  byId('zfit').onclick = fit
  byId('z1').onclick = () => zoom(100)
  byId('pprint').onclick = () => { location.href = ${JSON.stringify(PRINT_FROM_PREVIEW)} }
  byId('pclose').onclick = () => window.close()
  window.onresize = fit
  show(0)
})()
    </script></body></html>`
    const htmlPath = join(dir, 'index.html')
    await writeFile(htmlPath, html, 'utf8')
    const ratio = heightMm > 0 ? widthMm / heightMm : 1
    const win = new BrowserWindow({
      ...(parent && !parent.isDestroyed() ? { parent } : {}),
      width: ratio < 0.6 ? 460 : 680,
      height: ratio > 2 ? 360 : 480,
      title: text.title,
      autoHideMenuBar: true,
      backgroundColor: '#3A3F47',
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
    })
    prepared = true
    win.setMenuBarVisibility(false)
    const cleanup = () => { void rm(dir, { recursive: true, force: true }).catch(() => {}) }
    win.on('closed', cleanup)
    let printRequested = false
    const closed = new Promise<{ ok: true; printRequested: boolean }>((resolve) => {
      win.once('closed', () => resolve({ ok: true, printRequested }))
    })
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', (event, url) => {
      event.preventDefault()
      if (url === PRINT_FROM_PREVIEW) {
        printRequested = true
        win.close()
      }
    })
    try {
      await win.loadFile(htmlPath)
      return await closed
    } catch (error) {
      if (!win.isDestroyed()) win.destroy()
      cleanup()
      throw error
    }
  } catch (error) {
    if (!prepared) await rm(dir, { recursive: true, force: true }).catch(() => {})
    throw error
  }
}
