// Runs browser rendering tests in a hidden Electron window; never opens a printer.
const path = require('node:path')
if (!process.versions.electron) {
  const { spawnSync } = require('node:child_process')
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const result = spawnSync(require('electron'), [__filename], { env, stdio: 'inherit', windowsHide: true, timeout: 60000 })
  if (result.error) console.error(result.error.message)
  process.exit(result.status ?? 1)
} else {
  const { app, BrowserWindow } = require('electron')
  app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } })
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
      app.exit(0)
    } catch (error) {
      console.error(error)
      app.exit(1)
    }
  })
}
