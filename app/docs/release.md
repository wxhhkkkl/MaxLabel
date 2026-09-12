# MaxLabel 发布检查

## 构建环境

- Node.js `>=22.12.0`
- 使用 `npm ci` 安装锁定依赖
- 发布前执行 `npm audit --audit-level=moderate`、`npm test`（包含架构门禁）、`npm run build`，服务端执行 `python -m pytest -q`
- Windows 安装包使用 `npm run dist`；检测到 `CSC_LINK` / `CSC_NAME` / `WIN_CSC_LINK` 时走签名链，否则明确生成内部测试包并跳过签名工具下载

## Windows 签名

electron-builder 已开启可执行文件签名流程。正式发布时在构建机配置证书环境变量：

- `CSC_LINK`：PFX/代码签名证书路径或受支持的安全存储地址
- `CSC_KEY_PASSWORD`：证书密码

没有证书时可以生成内部测试包，但不应把未签名安装包作为正式发布版本；正式发布流水线应额外检查安装包签名和 SHA-256 校验值。
