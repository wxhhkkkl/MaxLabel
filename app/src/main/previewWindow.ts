import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { mkdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { validatePreviewPayload } from './ipc/validation'

/** 独立预览窗口；渲染页只负责提供已经栅格化的 PNG。 */
export async function openPreviewWindow(rawPayload: unknown): Promise<{ ok: boolean }> {
  const { dataUrl, pages, widthMm, heightMm, truncated } = validatePreviewPayload(rawPayload)
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
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src file:; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><title>打印预览</title><style>
html,body{margin:0;padding:0;height:100%;background:#3A3F47;font-family:'Segoe UI','Microsoft YaHei',sans-serif}body{display:flex;flex-direction:column;align-items:center;overflow:auto}.bar{display:flex;align-items:center;width:100%;box-sizing:border-box;padding:8px 14px;background:#2C3138;color:#E8EAED;position:sticky;top:0;z-index:5}.bar .t{font-size:13px;font-weight:600}.bar .s{font-size:11px;color:#9AA3AD;margin-left:10px}.zc{display:flex;align-items:center;gap:6px;margin-left:auto}.zc button{background:#3A4049;border:1px solid #4A515B;color:#E8EAED;font-size:13px;line-height:1;padding:5px 10px;border-radius:5px;cursor:pointer}.zc span{font-size:11px;color:#9AA3AD;min-width:44px;text-align:center}.zc input{width:90px;accent-color:#4A90C2;cursor:pointer}.wrap{flex:1;display:flex;align-items:flex-start;justify-content:center;padding:20px;width:100%;box-sizing:border-box}.page{display:none}.page.active{display:block}img{display:block;background:#fff;box-shadow:0 6px 24px rgba(0,0,0,.4);border-radius:4px}@media print{html,body{height:auto;background:#fff}.bar{display:none}.wrap{display:block;padding:0;width:auto}.page,.page.active{display:block!important;width:${String(widthMm)}mm;height:${String(heightMm)}mm;page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}.page img{width:${String(widthMm)}mm;height:${String(heightMm)}mm;box-shadow:none;border-radius:0}}
 </style></head><body><div class="bar"><span class="t">打印预览</span><span class="s">${String(widthMm)} × ${String(heightMm)} mm${truncated ? ' · 仅显示前 200 页' : ''}</span><div class="zc"><button id="pprev">‹</button><span id="ppage">1/${imgs.length}</span><button id="pnext">›</button><button id="zout">−</button><input id="zrange" type="range" min="25" max="400" step="5" value="100"><span id="zpct">100%</span><button id="zin">＋</button><button id="zfit">适应</button><button id="z1">1:1</button><button id="pprint" style="margin-left:10px;background:#4A90C2;border:none;color:#fff">打印${truncated ? '预览页' : '全部'}</button><button id="pclose">关闭</button></div></div><div class="wrap">${pageMarkup}</div><script>
(function(){var pages=[...document.querySelectorAll('.page')],images=pages.map(function(p){return p.querySelector('img')}),range=document.getElementById('zrange'),pct=document.getElementById('zpct'),pp=document.getElementById('pprev'),pn=document.getElementById('pnext'),page=document.getElementById('ppage'),total=pages.length,cur=0,img=images[0],nw=0,nh=0;function load(i){var node=images[i];if(node&&!node.src)node.src=node.dataset.src}function apply(z){z=Math.max(25,Math.min(400,z));range.value=z;pct.textContent=z+'%';if(img){img.style.width=nw*z/100+'px';img.style.height='auto'}}function fit(){if(!nw)return;var w=document.querySelector('.wrap').clientWidth-40,h=document.querySelector('.wrap').clientHeight-40;apply(Math.min(100,Math.round(Math.min(w/nw*100,h/nh*100))))}function show(i){cur=Math.max(0,Math.min(total-1,i));pages.forEach(function(node,index){node.classList.toggle('active',index===cur)});load(cur);img=images[cur];page.textContent=(cur+1)+'/'+total;pp.disabled=cur===0;pn.disabled=cur===total-1;nw=img.naturalWidth;nh=img.naturalHeight;fit()}images.forEach(function(node){node.onload=function(){if(node===img){nw=node.naturalWidth;nh=node.naturalHeight;fit()}}});pp.onclick=function(){show(cur-1)};pn.onclick=function(){show(cur+1)};range.oninput=function(){apply(parseInt(range.value,10))};document.getElementById('zout').onclick=function(){apply(parseInt(range.value,10)-10)};document.getElementById('zin').onclick=function(){apply(parseInt(range.value,10)+10)};document.getElementById('zfit').onclick=fit;document.getElementById('z1').onclick=function(){apply(100)};document.getElementById('pprint').onclick=function(){images.forEach(function(_,i){load(i)});setTimeout(function(){window.print()},50)};document.getElementById('pclose').onclick=function(){window.close()};window.onresize=fit;show(0)})();
    </script></body></html>`
    const htmlPath = join(dir, 'index.html')
    await writeFile(htmlPath, html, 'utf8')
    const ratio = heightMm > 0 ? widthMm / heightMm : 1
    const win = new BrowserWindow({
      width: ratio < 0.6 ? 460 : 680,
      height: ratio > 2 ? 360 : 480,
      title: '打印预览',
      autoHideMenuBar: true,
      backgroundColor: '#3A3F47',
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
    })
    prepared = true
    win.setMenuBarVisibility(false)
    const cleanup = () => { void rm(dir, { recursive: true, force: true }).catch(() => {}) }
    win.on('closed', cleanup)
    try {
      await win.loadFile(htmlPath)
      return { ok: true }
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
