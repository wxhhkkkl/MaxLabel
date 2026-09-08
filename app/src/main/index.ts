import { app, shell, BrowserWindow, ipcMain, dialog, clipboard, nativeImage } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { writeFile, readFile, appendFile, rm, mkdir, readdir, stat } from 'fs/promises'
import { createConnection } from 'node:net'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import iconv from 'iconv-lite'
import type { PortConfig } from '../shared/model'
import {
  cloudDelete,
  cloudList,
  cloudLoad,
  cloudLogin,
  cloudRegister,
  cloudSave
} from './cloud'
import {
  defaultServerUrl,
  openCloudWindow,
  closeCloudWindow
} from './cloudService'
import { activateLicense, checkLicenseOnline, machineId, randomLicenseSample, readLicenseState, startTrial } from './license'
import { dbQuery, dbTestConnection, type DbConnectionConfig } from './db'
import {
  enterpriseDeleteTemplate,
  enterpriseListTemplates,
  enterpriseLoadTemplate,
  enterpriseLogSummary,
  enterprisePublishTemplate,
  enterpriseSetRole,
  enterpriseStatus,
  type EnterpriseRole
} from './enterprise'

const execFileP = promisify(execFile)

let mainWindow: BrowserWindow | null = null

/** 打印日志文件（专业版：本地 JSONL） */
function printLogPath(): string {
  return join(app.getPath('userData'), 'print-log.jsonl')
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'MaxLabel',
    backgroundColor: '#F4F3EE',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => {
    mainWindow = null
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

/** 生成用于打印的 HTML：页面尺寸 = 标签尺寸（毫米），仅包含标签位图 */
function printHtml(dataUrl: string, widthMm: number, heightMm: number): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box;}
@page{size:${widthMm}mm ${heightMm}mm;margin:0;}
html,body{width:100%;height:100%;background:#fff;}
.page{width:${widthMm}mm;height:${heightMm}mm;overflow:hidden;}
img{display:block;width:${widthMm}mm;height:${heightMm}mm;}
</style></head><body><div class="page"><img src="${dataUrl}"/></div></body></html>`
}

// ---------- 串口/蓝牙：经 Windows .NET SerialPort（PowerShell）直写，避免原生模块 ABI 依赖 ----------
async function writeSerialWindows(portName: string, baud: number, buf: Buffer): Promise<{ ok: boolean; message: string }> {
  const tmp = join(tmpdir(), `maxlabel-serial-${randomUUID()}.bin`)
  await writeFile(tmp, buf)
  const script = [
    "$ErrorActionPreference='Stop'",
    'try {',
    `  $p = New-Object System.IO.Ports.SerialPort('${portName}', ${baud}, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One)`,
    '  $p.WriteTimeout = 10000',
    '  $p.Open()',
    `  $b = [System.IO.File]::ReadAllBytes('${tmp}')`,
    '  $p.Write($b, 0, $b.Length)',
    '  $p.Close()',
    "  Write-Output 'OK'",
    '} catch { Write-Output $_.Exception.Message; exit 1 }'
  ].join('\n')
  try {
    const { stdout } = await execFileP('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      timeout: 30000,
      windowsHide: true
    })
    await rm(tmp, { force: true }).catch(() => {})
    return { ok: stdout.includes('OK'), message: `已发送到串口 ${portName}（${baud} bps）` }
  } catch (e) {
    await rm(tmp, { force: true }).catch(() => {})
    const msg = (e as { stderr?: string; message?: string }).stderr || (e as { message?: string }).message || '未知错误'
    return { ok: false, message: '串口发送失败：' + String(msg).slice(0, 300) }
  }
}

async function listWindowsComPorts(): Promise<string[]> {
  try {
    const { stdout } = await execFileP('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '[System.IO.Ports.SerialPort]::GetPortNames()'], {
      timeout: 15000,
      windowsHide: true
    })
    return stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

// ---------- IPC：枚举串口（COM/蓝牙虚拟串口） ----------
ipcMain.handle('ports:list', async () => {
  if (process.platform !== 'win32') return { comPorts: [], ok: true }
  const comPorts = await listWindowsComPorts()
  return { comPorts, ok: true }
})

// ---------- IPC：枚举 Windows 打印机（用于"选择标签格式"与打印面板） ----------
ipcMain.handle('printers:list', async (event) => {
  try {
    const win = event.sender as unknown as Electron.WebContents
    const printers = await win.getPrintersAsync()
    const list = printers.map((p) => ({ name: p.name, displayName: p.displayName ?? p.name, status: p.status ?? 0 }))
    return { ok: true, printers: list }
  } catch (e) {
    return { ok: false, message: String((e as { message?: string }).message ?? e) }
  }
})

// ---------- IPC：打开帮助文档 ----------
ipcMain.handle('help:open', async () => {
  try {
    const docs = join(app.getAppPath(), 'docs', 'labelshop-help-zh')
    if (existsSync(docs)) {
      await shell.openPath(docs)
    } else {
      await shell.openExternal('https://www.360code.com/')
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, message: String((e as { message?: string }).message ?? e) }
  }
})

// ---------- IPC：打印标签（走系统打印机驱动，弹出 Windows 打印对话框） ----------
ipcMain.handle('print-label', async (_event, payload: { dataUrl: string; widthMm: number; heightMm: number }) => {
  const { dataUrl, widthMm, heightMm } = payload
  if (!dataUrl || !widthMm || !heightMm) {
    throw new Error('print-label: 参数不完整')
  }
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true }
  })
  try {
    const html = printHtml(dataUrl, widthMm, heightMm)
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    // pageSize 单位为微米（1mm = 1000µm）
    const ok = await win.webContents.print({
      silent: false,
      pageSize: { width: Math.round(widthMm * 1000), height: Math.round(heightMm * 1000) },
      margins: { marginType: 'none' },
      printBackground: true
    })
    return { ok }
  } finally {
    setTimeout(() => {
      if (!win.isDestroyed()) win.destroy()
    }, 800)
  }
})

// ---------- IPC：打印预览（独立窗口） ----------
ipcMain.handle(
  'preview:open',
  async (_event, payload: { dataUrl?: string; pages?: string[]; widthMm: number; heightMm: number }) => {
    const { dataUrl, pages, widthMm, heightMm } = payload
    const imgs = (pages && pages.length ? pages : [dataUrl ?? '']).filter(Boolean)
    if (!imgs.length || !widthMm || !heightMm) throw new Error('preview:open: 参数不完整')
    const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const dir = join(tmpdir(), `maxlabel-prev-${stamp}`)
    await mkdir(dir, { recursive: true })
    const paths: string[] = []
    for (let i = 0; i < imgs.length; i++) {
      const base64 = String(imgs[i]).split(',')[1] ?? ''
      if (!base64) throw new Error('preview:open: 图片数据无效')
      const p = join(dir, `p${i}.png`)
      await writeFile(p, Buffer.from(base64, 'base64'))
      paths.push(p)
    }
    const url = (i: number) => 'file:///' + paths[i].replace(/\\/g, '/')
    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8"><title>打印预览</title>
<style>
  html,body{margin:0;padding:0;height:100%;background:#3A3F47;font-family:'Segoe UI','Microsoft YaHei',sans-serif;}
  body{display:flex;flex-direction:column;align-items:center;overflow:auto;}
  .bar{display:flex;align-items:center;justify-content:space-between;width:100%;box-sizing:border-box;padding:8px 14px;background:#2C3138;color:#E8EAED;position:sticky;top:0;z-index:5;}
  .bar .t{font-size:13px;font-weight:600;}
  .bar .s{font-size:11px;color:#9AA3AD;margin-left:10px;}
  .bar .zc{display:flex;align-items:center;gap:6px;margin-left:auto;}
  .bar .zc button{background:#3A4049;border:1px solid #4A515B;color:#E8EAED;font-size:13px;line-height:1;padding:5px 10px;border-radius:5px;cursor:pointer;}
  .bar .zc button:hover{background:#4A515B;}
  .bar .zc span{font-size:11px;color:#9AA3AD;min-width:44px;text-align:center;}
  .bar .zc input{width:90px;accent-color:#4A90C2;cursor:pointer;}
  .wrap{flex:1;display:flex;align-items:flex-start;justify-content:center;padding:20px;width:100%;box-sizing:border-box;}
  img{background:#fff;box-shadow:0 6px 24px rgba(0,0,0,0.4);border-radius:4px;}
</style>
</head>
<body>
  <div class="bar">
    <span class="t">打印预览</span>
    <span class="s">${String(widthMm)} × ${String(heightMm)} mm</span>
    <div class="zc">
      <button id="pprev" title="上一页">‹</button>
      <span id="ppage" style="min-width:56px;">1/${imgs.length}</span>
      <button id="pnext" title="下一页">›</button>
      <button id="zout" title="缩小">−</button>
      <input id="zrange" type="range" min="25" max="400" step="5" value="100" title="缩放比例"/>
      <span id="zpct">100%</span>
      <button id="zin" title="放大">＋</button>
      <button id="zfit" title="适应窗口">适应</button>
      <button id="z1" title="100%">1:1</button>
      <button id="pprint" title="打印当前页" style="margin-left:10px;background:#4A90C2;border:none;color:#fff;">打印</button>
      <button onclick="window.close()" style="margin-left:6px;background:#3A4049;border:1px solid #4A515B;color:#E8EAED;">关闭</button>
    </div>
  </div>
  <div class="wrap"><img id="pv" src="${url(0)}" style="width:auto;height:auto;" /></div>
<script>
(function(){
  var img=document.getElementById('pv'), range=document.getElementById('zrange'), pct=document.getElementById('zpct');
  var zout=document.getElementById('zout'), zin=document.getElementById('zin'), zfit=document.getElementById('zfit'), z1=document.getElementById('z1');
  var pp=document.getElementById('pprev'), pn=document.getElementById('pnext'), ppage=document.getElementById('ppage');
  var pprint=document.getElementById('pprint');
  var total=${imgs.length}, cur=0;
  var natW=0,natH=0;
  img.onload=function(){ natW=img.naturalWidth; natH=img.naturalHeight; fit(); };
  pprint.addEventListener('click', function(){ if(typeof window.print==='function') window.print(); });
  function apply(p){ var z=Math.max(25,Math.min(400,p)); range.value=z; pct.textContent=z+'%'; img.style.width=(natW*z/100)+'px'; img.style.height='auto'; }
  function fit(){ if(!natW) return; var zw=document.querySelector('.wrap').clientWidth-40; var zh=document.querySelector('.wrap').clientHeight-40; var z=Math.min(100, Math.round(Math.min(zw/natW*100, zh/natH*100))); apply(z); }
  function show(i){ cur=Math.max(0,Math.min(total-1,i)); img.src='${url(0)}'.replace(/p0\\.png$/, 'p'+cur+'.png'); ppage.textContent=(cur+1)+'/'+total; pp.disabled=cur===0; pn.disabled=cur===total-1; }
  pp.addEventListener('click', function(){ show(cur-1); });
  pn.addEventListener('click', function(){ show(cur+1); });
  range.addEventListener('input', function(){ apply(parseInt(range.value,10)); });
  zout.addEventListener('click', function(){ apply(parseInt(range.value,10)-10); });
  zin.addEventListener('click', function(){ apply(parseInt(range.value,10)+10); });
  z1.addEventListener('click', function(){ apply(100); });
  zfit.addEventListener('click', fit);
  document.addEventListener('keydown', function(e){ if(e.key==='ArrowLeft') show(cur-1); else if(e.key==='ArrowRight') show(cur+1); else if(e.key==='+'||e.key==='=') apply(parseInt(range.value,10)+10); else if(e.key==='-') apply(parseInt(range.value,10)-10); });
  window.addEventListener('resize', fit);
  show(0);
})();
</script>
</body>
</html>`
    const htmlPath = join(dir, 'index.html')
    await writeFile(htmlPath, html, 'utf8')
    const ratio = heightMm > 0 ? widthMm / heightMm : 1
    let w = Math.round(680)
    let h = Math.round(480)
    if (ratio < 0.6) w = Math.round(460)
    else if (ratio > 2) h = Math.round(360)
    const win = new BrowserWindow({
      width: w,
      height: h,
      title: '打印预览',
      autoHideMenuBar: true,
      backgroundColor: '#3A3F47',
      webPreferences: { sandbox: true }
    })
    win.setMenuBarVisibility(false)
    win.loadFile(htmlPath)
    win.on('closed', () => {
      void rm(dir, { recursive: true, force: true }).catch(() => {})
    })
    return { ok: true }
  }
)

// ---------- IPC：打印日志（专业版，本地 JSONL 追加 / 读取） ----------
ipcMain.handle(
  'log:print',
  async (_event, payload: { time: string; title: string; mode: string; count: number; copies: number; test: boolean; printer: string; dataSnapshot?: string[] }) => {
    const line = JSON.stringify({ ...payload, app: 'maxlabel' })
    await appendFile(printLogPath(), line + '\n', 'utf-8')
    return { ok: true, path: printLogPath() }
  }
)
ipcMain.handle('log:list', async () => {
  try {
    if (!existsSync(printLogPath())) return { ok: true, logs: [] }
    const raw = await readFile(printLogPath(), 'utf-8')
    const logs = raw
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => {
        try {
          return JSON.parse(l) as Record<string, unknown>
        } catch {
          return null
        }
      })
      .filter(Boolean)
    return { ok: true, logs }
  } catch (e) {
    return { ok: false, message: String((e as { message?: string }).message ?? e) }
  }
})
ipcMain.handle('dialog:pickFile', async (_e, opts?: { filters?: Array<{ name: string; extensions: string[] }> }) => {
  const r = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: opts?.filters ?? [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] }]
  })
  return { ok: !r.canceled, path: r.canceled ? '' : r.filePaths[0] }
})
ipcMain.handle('dialog:pickDir', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return { ok: !r.canceled, path: r.canceled ? '' : r.filePaths[0] }
})
ipcMain.handle('image:read', async (_event, filePath: string) => {
  try {
    if (!filePath || typeof filePath !== 'string') return { ok: false, message: '无效路径' }
    const buf = await readFile(filePath)
    const ext = filePath.toLowerCase().split('.').pop() || ''
    const mime =
      ext === 'png' ? 'image/png' :
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'gif' ? 'image/gif' :
      ext === 'webp' ? 'image/webp' :
      ext === 'bmp' ? 'image/bmp' : 'image/png'
    const dataUrl = 'data:' + mime + ';base64,' + buf.toString('base64')
    return { ok: true, dataUrl, path: filePath }
  } catch (e) {
    return { ok: false, message: String((e as { message?: string }).message ?? e) }
  }
})
// 导出打印历史为 CSV（专业版）
ipcMain.handle('log:export', async () => {
  try {
    if (!existsSync(printLogPath())) return { ok: false, message: '暂无打印记录' }
    const raw = await readFile(printLogPath(), 'utf-8')
    const rows = raw
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => {
        try {
          return JSON.parse(l) as Record<string, unknown>
        } catch {
          return null
        }
      })
      .filter(Boolean)
    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
    }
    const head = ['时间', '模板', '打印方式', '数量', '单签拷贝', '测试打印', '打印机']
    const lines = rows.map((r) => {
      const x = r as Record<string, unknown>
      return [x.time, x.title, x.mode, x.count, x.copies, x.test ? '是' : '否', x.printer].map(esc).join(',')
    })
    const csv = [head.join(','), ...lines].join('\r\n')
    const opts = {
      title: '导出打印历史',
      defaultPath: join(app.getPath('documents'), `打印历史-${new Date().toISOString().slice(0, 10)}.csv`),
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    }
    const res = mainWindow ? await dialog.showSaveDialog(mainWindow, opts) : await dialog.showSaveDialog(opts)
    if (res.canceled || !res.filePath) return { ok: false, message: '已取消导出' }
    await writeFile(res.filePath, '\ufeff' + csv, 'utf-8')
    return { ok: true, path: res.filePath }
  } catch (e) {
    return { ok: false, message: String((e as { message?: string }).message ?? e) }
  }
})
// 删除单条打印历史（按时间戳匹配）
ipcMain.handle('log:delete', async (_e, time: string) => {
  try {
    const file = printLogPath()
    if (!existsSync(file)) return { ok: true }
    const raw = await readFile(file, 'utf-8')
    const lines = raw.split(/\r?\n/).filter((l) => l.trim())
    const keep = lines.filter((l) => {
      try {
        const o = JSON.parse(l)
        return o.time !== time
      } catch {
        return true
      }
    })
    await writeFile(file, keep.join('\n') + (keep.length ? '\n' : ''), 'utf-8')
    return { ok: true }
  } catch (e) {
    return { ok: false, message: String((e as { message?: string }).message ?? e) }
  }
})

// 清空打印历史（专业版）
ipcMain.handle('log:clear', async () => {
  try {
    if (existsSync(printLogPath())) await writeFile(printLogPath(), '', 'utf-8')
    return { ok: true }
  } catch (e) {
    return { ok: false, message: String((e as { message?: string }).message ?? e) }
  }
})

// 打开打印日志文件（用系统默认程序打开）
ipcMain.handle('log:open', async () => {
  try {
    const p = printLogPath()
    if (!existsSync(p)) await writeFile(p, '', 'utf-8')
    const err = await shell.openPath(p)
    return { ok: !err, message: err || undefined, path: p }
  } catch (e) {
    return { ok: false, message: String((e as { message?: string }).message ?? e) }
  }
})

// ---------- IPC：云端模板（本地模拟服务端） ----------
ipcMain.handle('cloud:register', async (_e, email: string, password: string) => cloudRegister(email, password))
ipcMain.handle('cloud:login', async (_e, email: string, password: string) => cloudLogin(email, password))
ipcMain.handle('cloud:save', async (_e, token: string, name: string, json: string) => cloudSave(token, name, json))
ipcMain.handle('cloud:list', async (_e, token: string) => cloudList(token))
ipcMain.handle('cloud:load', async (_e, token: string, id: string) => cloudLoad(token, id))
ipcMain.handle('cloud:delete', async (_e, token: string, id: string) => cloudDelete(token, id))
// ---------- 云服务（远程 FastAPI + Vue，地址由渲染层配置传入） ----------
ipcMain.handle('cloud:open', async (_e, serverUrl?: string) => openCloudWindow(serverUrl))

// ---------- IPC：授权 / 激活（在线鉴权，连接云服务器） ----------
ipcMain.handle('license:status', async () => {
  let state = await readLicenseState()
  if (!state.trialExpiresAt && !state.active) {
    state = await startTrial(15)
  }
  return { ok: true, state }
})
ipcMain.handle('license:activate', async (_e, key: string, serverUrl: string) => activateLicense(String(key ?? ''), String(serverUrl ?? '')))
ipcMain.handle('license:check', async (_e, serverUrl: string) => checkLicenseOnline(String(serverUrl ?? '')))
ipcMain.handle('license:sample', async () => ({ ok: true, key: randomLicenseSample(), machineId: machineId() }))

// ---------- IPC：数据库（ODBC / SQL） ----------
ipcMain.handle('db:test', async (_e, conn: DbConnectionConfig) => dbTestConnection(conn))
ipcMain.handle('db:query', async (_e, conn: DbConnectionConfig, sql: string) => dbQuery(conn, sql))

// ---------- IPC：企业版（模板管理 / 权限 / 日志聚合） ----------
ipcMain.handle('enterprise:status', async () => enterpriseStatus())
ipcMain.handle('enterprise:setRole', async (_e, role: EnterpriseRole, user: string) => enterpriseSetRole(role, user))
ipcMain.handle('enterprise:list', async () => enterpriseListTemplates())
ipcMain.handle('enterprise:publish', async (_e, name: string, json: string, author: string) => enterprisePublishTemplate(name, json, author))
ipcMain.handle('enterprise:load', async (_e, id: string) => enterpriseLoadTemplate(id))
ipcMain.handle('enterprise:delete', async (_e, id: string) => enterpriseDeleteTemplate(id))
ipcMain.handle('enterprise:logSummary', async () => enterpriseLogSummary())

// ---------- IPC：模板保存 / 打开 ----------
ipcMain.handle('template:save', async (_event, json: string, suggestedName: string) => {
  const base = suggestedName.replace(/\.(msdx|json|lsdx)$/i, '')
  const opts = {
    defaultPath: base + '.msdx',
    filters: [
      { name: 'MaxLabel 标签模板', extensions: ['msdx'] },
      { name: '兼容旧格式', extensions: ['json'] }
    ]
  }
  const res = mainWindow ? await dialog.showSaveDialog(mainWindow, opts) : await dialog.showSaveDialog(opts)
  if (res.canceled || !res.filePath) return { canceled: true }
  await writeFile(res.filePath, json, 'utf-8')
  return { canceled: false, filePath: res.filePath }
})

ipcMain.handle('template:open', async () => {
  const opts = {
    filters: [
      { name: '标签文件', extensions: ['msdx', 'lsdx', 'json'] },
      { name: 'MaxLabel 标签模板', extensions: ['msdx', 'json'] },
      { name: 'LabelShop 标签文件', extensions: ['lsdx'] }
    ],
    properties: ['openFile'] as Array<'openFile'>
  }
  const res = mainWindow ? await dialog.showOpenDialog(mainWindow, opts) : await dialog.showOpenDialog(opts)
  if (res.canceled || !res.filePaths.length) return { canceled: true }
  const content = await readFile(res.filePaths[0], 'utf-8')
  return { canceled: false, filePath: res.filePaths[0], content }
})

// ---------- IPC：按路径打开模板（最近的文件） ----------
ipcMain.handle('template:openPath', async (_event, filePath: string) => {
  try {
    const content = await readFile(String(filePath ?? ''), 'utf-8')
    return { ok: true, filePath: String(filePath), content }
  } catch (e) {
    return { ok: false, message: String((e as { message?: string }).message ?? e) }
  }
})

// ---------- IPC：静默保存到指定路径（序列号回写 / 模板库） ----------
ipcMain.handle('template:saveTo', async (_event, filePath: string, json: string) => {
  try {
    await writeFile(String(filePath), String(json), 'utf-8')
    return { ok: true, filePath: String(filePath) }
  } catch (e) {
    return { ok: false, message: String((e as { message?: string }).message ?? e) }
  }
})

// 模板库目录：%APPDATA%/MaxLabel/templates
function templatesDir(): string {
  return join(app.getPath('userData'), 'templates')
}

// ---------- IPC：模板库（本地模板目录扫描 / 保存 / 删除） ----------
ipcMain.handle('template:list', async () => {
  const dir = templatesDir()
  try {
    await mkdir(dir, { recursive: true })
    const files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.json'))
    const items: Array<{ name: string; path: string; mtime: number; size: number; widthMm?: number; heightMm?: number; remark?: string; thumb?: string }> = []
    for (const f of files) {
      const p = join(dir, f)
      try {
        const st = await stat(p)
        let widthMm: number | undefined
        let heightMm: number | undefined
        let remark: string | undefined
        let thumb: string | undefined
        try {
          const j = JSON.parse(await readFile(p, 'utf-8'))
          if (j && typeof j.widthMm === 'number') widthMm = j.widthMm
          if (j && typeof j.heightMm === 'number') heightMm = j.heightMm
          if (j && typeof j.remark === 'string') remark = j.remark
          if (j && typeof j.thumb === 'string' && j.thumb.length < 400000) thumb = j.thumb
        } catch {
          /* 忽略解析失败，仍列出 */
        }
        items.push({ name: f.replace(/\.json$/i, ''), path: p, mtime: st.mtimeMs, size: st.size, widthMm, heightMm, remark, thumb })
      } catch {
        /* 忽略单个文件错误 */
      }
    }
    items.sort((a, b) => b.mtime - a.mtime)
    return { ok: true, dir, items }
  } catch (e) {
    return { ok: false, message: String((e as { message?: string }).message ?? e) }
  }
})

// 把当前模板保存进模板库（文件名去重）
ipcMain.handle('template:saveToLib', async (_event, name: string, json: string) => {
  try {
    const dir = templatesDir()
    await mkdir(dir, { recursive: true })
    let safe = String(name ?? '未命名').replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名'
    let p = join(dir, safe + '.json')
    let i = 1
    while (existsSync(p)) {
      p = join(dir, `${safe} (${i++}).json`)
    }
    await writeFile(p, String(json), 'utf-8')
    return { ok: true, path: p }
  } catch (e) {
    return { ok: false, message: String((e as { message?: string }).message ?? e) }
  }
})

ipcMain.handle('template:delete', async (_event, filePath: string) => {
  try {
    const dir = templatesDir()
    const p = String(filePath ?? '')
    // 仅允许删除模板库目录内的文件，防止误删任意路径
    if (!p.startsWith(dir)) return { ok: false, message: '仅支持删除模板库中的模板' }
    await rm(p, { force: true })
    return { ok: true }
  } catch (e) {
    return { ok: false, message: String((e as { message?: string }).message ?? e) }
  }
})

// ---------- IPC：指令直连打印（文件 / TCP / 串口等） ----------
ipcMain.handle(
  'print:command',
  async (
    _event,
    payload: {
      segments?: Array<{ type: 'text'; str: string } | { type: 'bin'; data: Uint8Array }>
      text?: string
      encoding: 'utf8' | 'gbk'
      port: PortConfig
    }
  ) => {
    const { encoding, port } = payload
    // 二进制分段拼装（图片/位图嵌入），兼容旧 text 字段
    const buf = payload.segments
      ? Buffer.concat(
          payload.segments.map((s) =>
            s.type === 'text' ? (encoding === 'gbk' ? iconv.encode(s.str, 'gb18030') : Buffer.from(s.str, 'utf8')) : Buffer.from(s.data)
          )
        )
      : encoding === 'gbk'
        ? iconv.encode(payload.text ?? '', 'gb18030')
        : Buffer.from(payload.text ?? '', 'utf8')

    if (port.type === 'file') {
      const opts = {
        defaultPath: 'label.prn',
        filters: [
          { name: '打印指令文件', extensions: ['prn', 'txt', 'bin'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      }
      const res = mainWindow ? await dialog.showSaveDialog(mainWindow, opts) : await dialog.showSaveDialog(opts)
      if (res.canceled || !res.filePath) return { ok: false, canceled: true }
      await writeFile(res.filePath, buf)
      return { ok: true, message: '已写入指令文件：' + res.filePath }
    }

    if (port.type === 'tcp') {
      const host = port.tcpHost
      const portNum = port.tcpPort
      if (!host || !portNum) return { ok: false, message: 'TCP 端口未配置主机 / IP 或端口号' }
      return await new Promise<{ ok: boolean; message: string }>((resolve) => {
        const sock = createConnection({ host, port: portNum })
        let done = false
        const finish = (r: { ok: boolean; message: string }) => {
          if (done) return
          done = true
          resolve(r)
        }
        sock.setTimeout(8000, () => {
          sock.destroy()
          finish({ ok: false, message: '连接超时：' + host + ':' + portNum })
        })
        sock.on('connect', () => {
          sock.write(buf)
          sock.end()
        })
        sock.on('error', (err) => finish({ ok: false, message: '连接失败：' + err.message }))
        sock.on('close', () => finish({ ok: true, message: '已发送到 ' + host + ':' + portNum }))
      })
    }

    if (port.type === 'com' || port.type === 'bluetooth') {
      const portName = port.comPort
      if (!portName) return { ok: false, message: '未选择串口（COM 端口）' }
      const baud = port.baudRate ?? 115200
      if (process.platform === 'win32') {
        return await writeSerialWindows(portName, baud, buf)
      }
      return { ok: false, message: '非 Windows 平台的串口直写需接入 serialport 原生模块（P1.2 扩展）' }
    }

    if (port.type === 'usb') {
      return { ok: false, message: 'USB 直连请改用「Windows 驱动」端口（已自动识别）或 USB 虚拟串口（选择对应 COM 端口）' }
    }

    return { ok: false, message: 'driver 端口请使用图形驱动打印' }
  }
)

// ---------- IPC：复制条码图片到剪贴板 ----------
ipcMain.handle('barcode:copy', async (_event, dataUrl: string) => {
  try {
    if (!dataUrl || typeof dataUrl !== 'string') return { ok: false, message: '无图片数据' }
    const img = nativeImage.createFromDataURL(dataUrl)
    if (img.isEmpty()) return { ok: false, message: '图片数据无效' }
    clipboard.writeImage(img)
    return { ok: true }
  } catch (e) {
    return { ok: false, message: String((e as { message?: string }).message ?? e) }
  }
})

// ---------- IPC：批量导出条码图片 ----------
ipcMain.handle(
  'export:barcodes',
  async (_event, payload: { items: Array<{ name: string; dataUrl: string }> }) => {
    const opts = {
      title: '选择条码导出目录',
      properties: ['openDirectory'] as Array<'openDirectory'>
    }
    const res = mainWindow ? await dialog.showOpenDialog(mainWindow, opts) : await dialog.showOpenDialog(opts)
    if (res.canceled || !res.filePaths.length) return { canceled: true }
    const dir = res.filePaths[0]
    let count = 0
    for (const it of payload.items) {
      const base64 = it.dataUrl.split(',')[1]
      if (!base64) continue
      const safe = it.name.replace(/[\\/:*?"<>|]/g, '_')
      await writeFile(join(dir, safe), Buffer.from(base64, 'base64'))
      count++
    }
    return { canceled: false, ok: true, dir, count }
  }
)

// ---------- 应用生命周期 ----------
app.whenReady().then(async () => {
  // 云服务部署在用户服务器上，客户端不本地拉起后端；
  // 打开云服务窗口/在线激活时按配置的服务器地址直连。
  mainWindow = createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  closeCloudWindow()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  closeCloudWindow()
})
