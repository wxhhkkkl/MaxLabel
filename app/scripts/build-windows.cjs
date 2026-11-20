const { execFileSync } = require('node:child_process')
const path = require('node:path')

const builderCli = require.resolve('electron-builder/cli.js')
const args = ['--win', 'nsis', '--publish', 'never', '--config.forceCodeSigning=true']

execFileSync(process.execPath, [builderCli, ...args], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  windowsHide: true
})
