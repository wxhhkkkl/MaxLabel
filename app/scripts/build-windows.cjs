const { execFileSync } = require('node:child_process')
const path = require('node:path')

const signingConfigured = Boolean(
  process.env.CSC_LINK ||
  process.env.CSC_NAME ||
  process.env.WIN_CSC_LINK
)

const builderCli = require.resolve('electron-builder/cli.js')
const args = ['--win', 'nsis']

if (!signingConfigured) {
  // An unsigned internal build must not download winCodeSign just to edit the
  // executable. The signed path keeps the package.json setting and uses the
  // certificate supplied by the release environment.
  console.warn('未检测到 Windows 代码签名证书，生成内部测试安装包（不签名）')
  args.push('--config.win.signAndEditExecutable=false')
}

execFileSync(process.execPath, [builderCli, ...args], {
  cwd: path.resolve(__dirname, '..'),
  env: { ...process.env, ...(signingConfigured ? {} : { CSC_IDENTITY_AUTO_DISCOVERY: 'false' }) },
  stdio: 'inherit',
  windowsHide: true
})
