const { execFileSync } = require('node:child_process')
const path = require('node:path')

const builderCli = require.resolve('electron-builder/cli.js')
const args = ['--linux', 'AppImage', 'deb', '--publish', 'never']

execFileSync(process.execPath, [builderCli, ...args], {
  cwd: path.resolve(__dirname, '..'),
  env: process.env,
  stdio: 'inherit',
  windowsHide: true
})
