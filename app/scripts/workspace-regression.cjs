const path = require('node:path')
if (!process.versions.electron) {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE
  const result = require('node:child_process').spawnSync(require('electron'), [__filename], { env, stdio: 'inherit', windowsHide: true, timeout: 60000 })
  if (result.error) console.error(result.error)
  process.exit(result.status ?? 1)
} else {
  const { app, BrowserWindow } = require('electron')
  app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, width: 1000, height: 800, webPreferences: { backgroundThrottling: false, sandbox: true } })
    win.webContents.on('console-message', (event) => console.log('renderer:', event.message))
    try {
      const code = require('esbuild').buildSync({ entryPoints: [path.join(__dirname, 'workspace-regression.tsx')], bundle: true, platform: 'browser', format: 'iife', globalName: 'workspace', write: false, jsx: 'automatic' }).outputFiles[0].text
      await win.loadURL('about:blank')
      await win.webContents.executeJavaScript(code + '\nworkspace.mount()')
      const run = (js) => win.webContents.executeJavaScript(js)
      const large = await run('workspace.geometry()')
      win.setContentSize(640, 480)
      await run('workspace.settle()')
      const small = await run('workspace.geometry()')
      if (small.width >= large.width) throw new Error('shrinking the native window must shrink the paper')
      console.log('PASS native window resize keeps paper fitted', { large, small })
      await run('workspace.redraw()')
      console.log('PASS document redraw, dimensions, rotation, rulers preserve fit and origin')
      await run('workspace.fitModes()')
      console.log('PASS fit width/height center the short axis and keep long-axis gutter')
      const manual = await run('workspace.manual()')
      win.setContentSize(900, 700); await run('workspace.settle()')
      if (await run('workspace.zoom()') !== manual) throw new Error('manual zoom must survive window resize')
      await run('workspace.fit()'); await run('workspace.paper()')
      console.log('PASS wheel modes, centered zoom, negative rulers, manual resize, restore fit, disc clipping, editor-only hairline')
      app.exit(0)
    } catch (e) { console.error(e); app.exit(1) }
  })
}
