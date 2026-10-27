const { execFileSync } = require('node:child_process')
const path = require('node:path')

const signingConfigured = Boolean(process.env.CSC_LINK || process.env.CSC_NAME)
const builderCli = require.resolve('electron-builder/cli.js')
const args = ['--mac', 'zip', 'dmg', '--publish', 'never']

if (!signingConfigured) {
  console.warn('未检测到 macOS 代码签名证书，生成内部测试包（不签名，不能用于正式自动更新）')
}

execFileSync(process.execPath, [builderCli, ...args], {
  cwd: path.resolve(__dirname, '..'),
  env: { ...process.env, ...(signingConfigured ? {} : { CSC_IDENTITY_AUTO_DISCOVERY: 'false' }) },
  stdio: 'inherit',
  windowsHide: true
})
