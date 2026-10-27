const { execFileSync } = require('node:child_process')
const path = require('node:path')

const signingConfigured = Boolean(
  process.env.CSC_LINK ||
  process.env.CSC_NAME ||
  process.env.WIN_CSC_LINK
)

const builderCli = require.resolve('electron-builder/cli.js')
const args = ['--win', 'nsis', '--publish', 'never']

if (!signingConfigured) {
  // `signAndEditExecutable` 一个开关管两件事：给 exe 签名，以及用 rcedit 写入
  // 图标和版本信息。以前没证书时把它整个关掉，打出来的 MaxLabel.exe 属性页
  // 写着「Electron / GitHub, Inc. / 44.3.0」—— 比不签名还像可疑文件。
  // 现在保持开启：没有证书时 electron-builder 只是跳过签名，元数据照常写入。
  console.warn('未检测到 Windows 代码签名证书：安装包不签名（SmartScreen 会提示），exe 的图标与版本信息照常写入')
}

execFileSync(process.execPath, [builderCli, ...args], {
  cwd: path.resolve(__dirname, '..'),
  env: { ...process.env, ...(signingConfigured ? {} : { CSC_IDENTITY_AUTO_DISCOVERY: 'false' }) },
  stdio: 'inherit',
  windowsHide: true
})
