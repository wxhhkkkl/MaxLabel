const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const checks = [
  [!read('src/renderer/src/editor/LabelEditor.tsx').match(/alignSelected|rotateSelected/), 'Fabric 不得保留第二套对齐/旋转实现'],
  [read('src/renderer/src/features/data/useDataManagement.ts').includes('replaceDatasetReferences'), '数据集删除必须走领域递归操作'],
  [read('src/renderer/src/dialogs/DataPanel.tsx').includes('db.cancel'), '数据库面板必须支持取消请求'],
  [read('src/renderer/src/features/printing/printExecutor.ts').includes('printJobJournal'), '打印执行必须写任务账本'],
  [read('src/shared/ipcContract.ts').includes('IPC_CHANNELS'), 'IPC 通道必须有共享注册表'],
  [read('src/preload/index.ts').includes('IPC_CHANNELS.'), 'preload 不得硬编码 IPC 通道'],
  [read('src/shared/print/scene.ts').includes('compilePrintTemplate'), '拼版打印必须复用编译后的模板']
]
for (const [ok, message] of checks) {
  if (!ok) throw new Error(message)
}

/**
 * DIFF-83：MFC 控件标题里的 `&` 是**加速键标记**，真机屏幕上看不到它
 * （并排图 `parity/review/cmp-propsbarcode-1741523.png`：真机 `条码符号类型(码制)(B):`，
 * 复刻版曾渲染成字面量 `(&B)`）。源码里再出现字面量 `(&X)` 就说明有人又把 dump 原文
 * 直接搬进了 label —— 渲染时必须经 `displayMfcCaption`（`src/shared/mfcCaption.ts`）。
 */
function literalAccelerators() {
  const roots = [path.join(root, 'src')]
  const offenders = []
  const skip = path.join('src', 'shared', 'mfcCaption.ts')
  while (roots.length) {
    const dir = roots.pop()
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) { roots.push(full); continue }
      if (!/\.tsx?$/.test(entry.name)) continue
      const rel = path.relative(root, full)
      if (rel === skip) continue
      // 注释里的 `(&X)` 是**真机控件树 dump 原文**，要保留（它是取证依据），不算违规。
      const stripped = fs.readFileSync(full, 'utf8')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split(/\r?\n/)
        .map((line) => line.replace(/\/\/.*$/, ''))
      stripped.forEach((line, i) => {
        if (!/\(&[A-Za-z0-9]\)/.test(line)) return
        // 允许的两种形态：① 字段标签原文（交给 FormField 渲染，内部走 displayMfcCaption）
        //                    ② 显式调用 displayMfcCaption(...)
        if (line.includes('label=') || line.includes('displayMfcCaption(')) return
        offenders.push(`${rel}:${i + 1}`)
      })
    }
  }
  return offenders
}

const literalOffenders = literalAccelerators()
if (literalOffenders.length) {
  throw new Error(
    `标签里出现字面量加速键 (&X)（应经 displayMfcCaption 去掉，DIFF-83）：\n  ${literalOffenders.join('\n  ')}`
  )
}

console.log(`${checks.length + 1} architecture checks passed（含 DIFF-83 无字面量加速键）`)
