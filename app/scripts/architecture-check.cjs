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
console.log(`${checks.length} architecture checks passed`)
