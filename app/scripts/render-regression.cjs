// Runs browser rendering tests in a hidden Electron window; never opens a printer.
const path = require('node:path')
if (!process.versions.electron) {
  const { spawn } = require('node:child_process')
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(require('electron'), [__filename], { env, stdio: 'inherit', windowsHide: true })
  const timeout = setTimeout(() => { child.kill(); process.exit(1) }, 60000)
  child.once('error', (error) => { clearTimeout(timeout); console.error(error.message); process.exit(1) })
  child.once('exit', (code) => { clearTimeout(timeout); process.exit(code ?? 1) })
} else {
  const { app, BrowserWindow } = require('electron')
  app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } })
    const finish = (status) => {
      // The regression runner is a short-lived Electron child.  Explicitly
      // terminate the main process so a renderer/utility handle cannot keep
      // the outer spawnSync alive.
      process.exit(status)
    }
    try {
      const code = require('esbuild').buildSync({
        entryPoints: [path.join(__dirname, 'render-regression.ts')], bundle: true,
        platform: 'browser', format: 'iife', globalName: 'renderTests', write: false,
        loader: { '.lsdx': 'text' }
      }).outputFiles[0].text
      await win.loadURL('about:blank')
      const result = await win.webContents.executeJavaScript(code + '\nrenderTests.run()')
      for (const line of result) console.log('PASS ' + line)
      console.log(result.length + ' rendering checks passed')
      finish(0)
    } catch (error) {
      console.error(error)
      finish(1)
    }
  })
}
