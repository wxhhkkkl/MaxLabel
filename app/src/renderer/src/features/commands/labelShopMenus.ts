import type { LabelDoc } from '../../../../shared/domain'
import type { ModalKind } from '../shell/modalTypes'
import type { DocTab } from '../workspace/useDocumentWorkspace'
import type { MenuItem, MenuSection } from '../../editor/MenuBar'

export type LabelRotation = 0 | 90 | 180 | 270
export type EditorTool = 'select' | 'barcode' | 'text' | 'line' | 'diagonal' | 'rect' | 'image' | 'data' | 'table'

export interface LabelShopMenuContext {
  visible: boolean
  x: number
  y: number
  hasSelection: boolean
  selectionCount: number
}

export interface LabelShopMenuDeps {
  isStart: boolean
  active: string
  startKey: string
  activeTab?: DocTab
  selectedObj: boolean
  canUndo: boolean
  canRedo: boolean
  activeTool: EditorTool
  canPaste: boolean
  doc?: LabelDoc
  busy: boolean
  tabs: DocTab[]
  recents: Array<{ name: string; path?: string }>
  dbRecordCount: number
  labelRotation: LabelRotation
  appTheme: 'blue' | 'black' | 'silver' | 'aqua'
  showToolbar: boolean
  showFormatBar: boolean
  showAlignBar: boolean
  showStatusBar: boolean
  showPrintPanel: boolean
  showLayerPanel: boolean
  showObjectInfo: boolean
  contextMenu: LabelShopMenuContext | null
  setModal: (modal: ModalKind) => void
  requestNew: () => void
  setActive: (key: string) => void
  setStatus: (message: string) => void
  setLabelRotation: (rotation: LabelRotation) => void
  toggleToolbar: () => void
  toggleFormatBar: () => void
  toggleAlignBar: () => void
  toggleStatusBar: () => void
  togglePrintPanel: () => void
  toggleLayerPanel: () => void
  toggleObjectInfo: () => void
  setAppTheme: (theme: LabelShopMenuDeps['appTheme']) => void
  handleAlign: (mode: 'left' | 'right' | 'top' | 'bottom' | 'midV' | 'midH') => void
  handleCenter: (mode: 'h' | 'v') => void
  handleSnap: (mode: 'top' | 'left' | 'right' | 'bottom') => void
  handleSame: (mode: 'w' | 'h' | 'wh') => void
  handleDist: (mode: 'h' | 'v') => void
  handleRotate: (degree: 90 | 180 | 270) => void
  handleOrder: (mode: 'front' | 'forward' | 'backward' | 'back') => void
  handleTool: (tool: EditorTool) => void
  handleOpen: () => Promise<void>
  handleOpenRecent: (item: { name: string; path?: string }) => Promise<void>
  handleSave: () => Promise<void>
  handleSaveAs: () => Promise<void>
  handlePreview: () => Promise<void>
  handlePrint: (test: boolean) => void
  handleExportCommand: () => Promise<void>
  handleBannerNew: () => void
  handleDeleteDb: () => void
  handleLogout: () => void
  handleDbRefresh: () => Promise<void>
  closeTab: (key: string) => Promise<void>
  closeOthers: (key: string) => Promise<void>
  closeAll: () => Promise<boolean>
  setRecord: (index: number) => void
  undo: () => void
  redo: () => void
  handleCut: () => void
  copySelected: () => void
  pasteClipboard: () => void
  selectAll: () => void
  deleteSelected: () => void
  handleGroup: () => void
  handleUngroup: () => void
  handleLockToggle: () => void
  zoomIn: () => void
  zoomOut: () => void
  fit: (mode: 'w' | 'h' | 'win') => void
  openCloud: () => void
}

function rotationItems(deps: LabelShopMenuDeps): MenuItem[] {
  return [
    { label: '正常显示', radio: deps.labelRotation === 0, action: () => deps.setLabelRotation(0) },
    { label: '左旋90度', radio: deps.labelRotation === 90, action: () => deps.setLabelRotation(90) },
    { label: '右旋90度', radio: deps.labelRotation === 270, action: () => deps.setLabelRotation(270) },
    { label: '旋转180度', radio: deps.labelRotation === 180, action: () => deps.setLabelRotation(180) }
  ]
}

function alignmentItems(deps: LabelShopMenuDeps, disabled: boolean): MenuItem[] {
  return [
    { label: '左对齐', action: () => deps.handleAlign('left'), disabled },
    { label: '右对齐', action: () => deps.handleAlign('right'), disabled },
    { label: '上对齐', action: () => deps.handleAlign('top'), disabled },
    { label: '下对齐', action: () => deps.handleAlign('bottom'), disabled },
    { label: '垂直中齐', action: () => deps.handleAlign('midV'), disabled },
    { label: '水平中齐', action: () => deps.handleAlign('midH'), disabled },
    { divider: true, label: '' },
    { label: '水平居中', action: () => deps.handleCenter('h'), disabled },
    { label: '垂直居中', action: () => deps.handleCenter('v'), disabled },
    { label: '标签顶部', action: () => deps.handleSnap('top'), disabled },
    { label: '标签左侧', action: () => deps.handleSnap('left'), disabled },
    { label: '标签右侧', action: () => deps.handleSnap('right'), disabled },
    { label: '标签底部', action: () => deps.handleSnap('bottom'), disabled }
  ]
}

function editorMenus(deps: LabelShopMenuDeps): MenuSection[] {
  const noObj = deps.isStart || !deps.selectedObj
  const hasDb = !deps.isStart && !!deps.doc && Object.keys(deps.doc.datasets ?? {}).length > 0
  const alignChildren = alignmentItems(deps, noObj)
  const sizeChildren: MenuItem[] = [
    { label: '宽度相同', action: () => deps.handleSame('w'), disabled: noObj },
    { label: '高度相同', action: () => deps.handleSame('h'), disabled: noObj },
    { label: '宽度高度相同', action: () => deps.handleSame('wh'), disabled: noObj }
  ]
  const distChildren: MenuItem[] = [
    { label: '水平间距相同', action: () => deps.handleDist('h'), disabled: noObj },
    { label: '垂直间距相同', action: () => deps.handleDist('v'), disabled: noObj }
  ]
  const rotateChildren: MenuItem[] = [
    { label: '左旋90度', action: () => deps.handleRotate(90), disabled: noObj },
    { label: '旋转180度', action: () => deps.handleRotate(180), disabled: noObj },
    { label: '右旋90度', action: () => deps.handleRotate(270), disabled: noObj }
  ]
  const themeChildren: MenuItem[] = [
    { label: '蓝色样式(B)', radio: deps.appTheme === 'blue', action: () => deps.setAppTheme('blue') },
    { label: '黑色样式(L)', radio: deps.appTheme === 'black', action: () => deps.setAppTheme('black') },
    { label: '银色样式(S)', radio: deps.appTheme === 'silver', action: () => deps.setAppTheme('silver') },
    { label: '水绿色样式(A)', radio: deps.appTheme === 'aqua', action: () => deps.setAppTheme('aqua') }
  ]
  const windowItems: MenuItem[] = [
    { label: '1 启始页', checked: deps.active === deps.startKey, action: () => deps.setActive(deps.startKey) },
    ...deps.tabs.map((tab, index) => ({ label: `${index + 2} ${tab.title}`, checked: deps.active === tab.key, action: () => deps.setActive(tab.key) }))
  ]
  return [
    { title: '文件(F)', items: [
      { label: '新建(N)', shortcut: 'Ctrl+N', action: deps.requestNew },
      { label: '新建条幅飘带', action: deps.handleBannerNew },
      { label: '打开(O)...', shortcut: 'Ctrl+O', action: () => void deps.handleOpen() },
      { label: '关闭(C)', shortcut: 'Ctrl+W', action: () => { if (!deps.isStart) void deps.closeTab(deps.active) }, disabled: deps.isStart },
      { label: '保存(S)', shortcut: 'Ctrl+S', action: () => void deps.handleSave(), disabled: deps.isStart || !deps.activeTab?.dirty },
      { label: '另存为(A)...', action: () => void deps.handleSaveAs(), disabled: deps.isStart },
      { label: '分享(I)...', action: () => deps.setModal('cloud'), disabled: true },
      { divider: true, label: '' },
      { label: '打印(P)...', shortcut: 'Ctrl+P', action: () => deps.handlePrint(false), disabled: deps.isStart || deps.busy },
      { label: '打印预览(V)', action: () => void deps.handlePreview(), disabled: deps.isStart || deps.busy },
      { label: '导出打印机指令文件(E)', action: () => void deps.handleExportCommand(), disabled: true },
      { divider: true, label: '' },
      { label: '标签格式设置(L)...', action: () => deps.setModal('new'), disabled: deps.isStart },
      { label: '模板属性设置(M)...', action: () => deps.setModal('tplprops'), disabled: deps.isStart },
      { divider: true, label: '' },
      ...(deps.recents.length
        ? [{ label: '最近的文件', children: deps.recents.map((item) => ({ label: item.name, action: () => void deps.handleOpenRecent(item) })) }]
        : [{ label: '最近的文件', disabled: true }]),
      { divider: true, label: '' },
      { label: '退出(X)', action: () => { void deps.closeAll().then((closed) => { if (closed) void window.maxlabel.closeWindow() }) } }
    ] },
    { title: '编辑(E)', items: [
      { label: '撤销(U)', shortcut: 'Ctrl+Z', action: deps.undo, disabled: deps.isStart || !deps.canUndo },
      { label: '恢复(R)', shortcut: 'Ctrl+Y', action: deps.redo, disabled: deps.isStart || !deps.canRedo },
      { divider: true, label: '' },
      { label: '剪切(T)', shortcut: 'Shift+Delete', action: deps.handleCut, disabled: noObj },
      { label: '复制(C)', shortcut: 'Ctrl+C', action: deps.copySelected, disabled: noObj },
      { label: '粘贴(P)', shortcut: 'Ctrl+V', action: deps.pasteClipboard, disabled: deps.isStart || !deps.canPaste },
      { label: '全选(A)', shortcut: 'Ctrl+A', action: deps.selectAll, disabled: deps.isStart },
      { label: '删除(D)', shortcut: 'Delete', action: deps.deleteSelected, disabled: noObj },
      { divider: true, label: '' },
      { label: '键盘输入变量顺序(Q)', action: () => deps.setModal('keyorder'), disabled: deps.isStart },
      { label: '属性', shortcut: 'Alt+Enter', action: () => (deps.selectedObj ? deps.setModal('props') : deps.setStatus('请先选中对象')), disabled: deps.isStart }
    ] },
    { title: '查看(V)', items: [
      { label: '工具栏(T)', checked: deps.showToolbar, action: deps.toggleToolbar },
      { label: '格式栏(F)', checked: deps.showFormatBar, action: deps.toggleFormatBar },
      { label: '对齐栏(A)', checked: deps.showAlignBar, action: deps.toggleAlignBar },
      { label: '状态栏(S)', checked: deps.showStatusBar, action: deps.toggleStatusBar },
      { divider: true, label: '' },
      { label: '显示启始页(M)', action: () => deps.setActive(deps.startKey) },
      { label: '打印历史记录', action: () => deps.setModal('history') },
      { divider: true, label: '' },
      { label: '显示打印窗体(P)', checked: deps.showPrintPanel, action: deps.togglePrintPanel },
      { label: '显示图层窗体(L)', checked: deps.showLayerPanel, action: deps.toggleLayerPanel },
      { divider: true, label: '' },
      { label: '显示对象信息(R)', shortcut: 'Ctrl+R', checked: deps.showObjectInfo, action: deps.toggleObjectInfo },
      { divider: true, label: '' },
      { label: '适应宽度', action: () => deps.fit('w'), disabled: deps.isStart },
      { label: '适应高度', action: () => deps.fit('h'), disabled: deps.isStart },
      { label: '撑满窗口(W)', shortcut: 'Ctrl+Alt+0', action: () => deps.fit('win'), disabled: deps.isStart },
      { label: '放大(I)', shortcut: 'Ctrl+=', action: deps.zoomIn, disabled: deps.isStart },
      { label: '缩小(O)', shortcut: 'Ctrl+-', action: deps.zoomOut, disabled: deps.isStart },
      { divider: true, label: '' },
      { label: '标签旋转', children: rotationItems(deps) }
    ] },
    { title: '工具(T)', items: [
      ...([
        ['select', '选取(S)'], ['barcode', '条码(B)'], ['text', '文字(T)'], ['line', '线条(L)'],
        ['diagonal', '斜线(L)'], ['rect', '矩形(R)'], ['image', '图片(P)'], ['data', '数据(D)'], ['table', '表格(G)']
      ] as Array<[EditorTool, string]>).map(([tool, label]) => ({ label, action: () => deps.handleTool(tool), active: deps.activeTool === tool, disabled: deps.isStart })),
      { divider: true, label: '' },
      { label: '放大(I)', action: deps.zoomIn, disabled: deps.isStart },
      { label: '缩小(O)', shortcut: 'Ctrl+-', action: deps.zoomOut, disabled: deps.isStart },
      { label: '适应宽度', action: () => deps.fit('w'), disabled: deps.isStart },
      { label: '适应高度', action: () => deps.fit('h'), disabled: deps.isStart },
      { label: '适合窗口(W)', shortcut: 'Ctrl+Alt+0', action: () => deps.fit('win'), disabled: deps.isStart }
    ] },
    { title: '排列(A)', items: [
      { label: '组合(G)', shortcut: 'Ctrl+G', action: deps.handleGroup, disabled: noObj },
      { label: '取消组合(U)', shortcut: 'Ctrl+U', action: deps.handleUngroup, disabled: noObj },
      { divider: true, label: '' },
      { label: '对齐', children: alignChildren, disabled: noObj },
      { label: '尺寸', children: sizeChildren, disabled: noObj },
      { label: '间距', children: distChildren, disabled: noObj },
      { label: '旋转', children: rotateChildren, disabled: noObj },
      { divider: true, label: '' },
      { label: '位置锁定', shortcut: 'Ctrl+L', action: deps.handleLockToggle, disabled: noObj },
      { divider: true, label: '' },
      { label: '移到最前', action: () => deps.handleOrder('front'), disabled: noObj },
      { label: '前移', action: () => deps.handleOrder('forward'), disabled: noObj },
      { label: '后移', action: () => deps.handleOrder('backward'), disabled: noObj },
      { label: '移到最后', shortcut: 'Ctrl+B', action: () => deps.handleOrder('back'), disabled: noObj }
    ] },
    { title: '数据库(D)', items: [
      { label: '设置数据库(D)...', action: () => deps.setModal('data'), disabled: deps.isStart },
      { divider: true, label: '' },
      { label: '定位记录(S)', shortcut: 'Ctrl+F', action: () => deps.setModal('locate'), disabled: !hasDb },
      { label: '更新数据库', action: () => void deps.handleDbRefresh(), disabled: !hasDb },
      { divider: true, label: '' },
      { label: '第一条记录', action: () => deps.setRecord(0), disabled: !hasDb },
      { label: '上一条记录', action: () => deps.setRecord((deps.activeTab?.recordIdx ?? 0) - 1), disabled: !hasDb },
      { label: '下一条记录', action: () => deps.setRecord((deps.activeTab?.recordIdx ?? 0) + 1), disabled: !hasDb },
      { label: '最后一条记录', action: () => deps.setRecord(deps.dbRecordCount - 1), disabled: !hasDb },
      { divider: true, label: '' },
      { label: '删除数据库(E)', action: deps.handleDeleteDb, disabled: !hasDb }
    ] },
    { title: '账户(A)', items: [
      { label: '登录...', action: deps.openCloud },
      { label: '注销...', action: deps.handleLogout, disabled: true },
      { divider: true, label: '' },
      { label: '账号和授权管理...', action: deps.openCloud, disabled: true },
      { label: '试用管理...', action: () => deps.setModal('license'), disabled: true },
      { divider: true, label: '' },
      { label: '演示和体验...', action: () => deps.setModal('getstarted') }
    ] },
    { title: '云马通(C)', items: [
      { label: '首页', action: deps.openCloud },
      { label: '云标签模板库', action: deps.openCloud, disabled: true },
      { label: '云数据库', action: deps.openCloud, disabled: true },
      { label: '云图片库', action: deps.openCloud, disabled: true },
      { label: '云网页库', action: deps.openCloud, disabled: true }
    ] },
    { title: '选项(O)', items: [
      { label: '系统选项(C)...', action: () => deps.setModal('options') },
      { label: '应用程序外观(A)', children: themeChildren },
      { label: '电子称', action: () => deps.setModal('weigh') }
    ] },
    { title: '窗口(W)', items: [
      { label: '新建窗口(N)', disabled: true },
      { label: '层叠(C)', disabled: true },
      { label: '平铺(T)', disabled: true },
      { label: '排列图标(A)', disabled: true },
      { divider: true, label: '' },
      ...windowItems
    ] },
    { title: '帮助(H)', items: [
      { label: '帮助主题(H)', shortcut: 'F1', action: () => deps.setModal('help') },
      { label: '在线网站(W)', action: () => window.open('https://www.360code.com/') },
      { label: '查找更新版本', action: () => deps.setModal('update') },
      { label: '关于(A)...', action: () => deps.setModal('about') }
    ] },
    { title: '建议与反馈', items: [{ label: '建议与反馈', action: () => deps.setModal('feedback') }] }
  ]
}

function startMenus(deps: LabelShopMenuDeps): MenuSection[] {
  const full = editorMenus(deps)
  const view = full.find((section) => section.title === '查看(V)')
  const account = full.find((section) => section.title === '账户(A)')
  const cloud = full.find((section) => section.title === '云马通(C)')
  const options = full.find((section) => section.title === '选项(O)')
  const help = full.find((section) => section.title === '帮助(H)')
  const feedback = full.find((section) => section.title === '建议与反馈')
  return [
    {
      title: '文件(F)',
      items: [
        { label: '新建(N)', shortcut: 'Ctrl+N', action: deps.requestNew },
        { label: '新建条幅飘带', action: deps.handleBannerNew },
        { label: '打开(Q)...', shortcut: 'Ctrl+O', action: () => void deps.handleOpen() },
        { label: '关闭(C)', disabled: true },
        { label: '打印设置(R)...', action: () => deps.setModal('printer') },
        ...(deps.recents.length
          ? [{ label: '最近的文件', children: deps.recents.map((item) => ({ label: item.name, action: () => void deps.handleOpenRecent(item) })) }]
          : [{ label: '最近的文件', disabled: true }]),
        { divider: true, label: '' },
        { label: '退出(X)', action: () => { void deps.closeAll().then((closed) => { if (closed) void window.maxlabel.closeWindow() }) } }
      ]
    },
    ...(view ? [view] : []),
    ...(account ? [account] : []),
    ...(cloud ? [cloud] : []),
    ...(options ? [options] : []),
    ...(help ? [help] : []),
    ...(feedback ? [feedback] : [])
  ]
}

function contextMenu(deps: LabelShopMenuDeps): MenuItem[] {
  const hasSelection = deps.contextMenu?.hasSelection ?? false
  const multi = (deps.contextMenu?.selectionCount ?? 0) >= 2
  const noObj = !hasSelection
  const sizeDist: MenuItem[] = [
    { label: '宽度相同', action: () => deps.handleSame('w'), disabled: !multi },
    { label: '高度相同', action: () => deps.handleSame('h'), disabled: !multi },
    { label: '宽度高度相同', action: () => deps.handleSame('wh'), disabled: !multi },
    { divider: true, label: '' },
    { label: '水平间距相同', action: () => deps.handleDist('h'), disabled: !multi },
    { label: '垂直间距相同', action: () => deps.handleDist('v'), disabled: !multi }
  ]
  const rotateOrder: MenuItem[] = [
    { label: '左旋90度', action: () => deps.handleRotate(90), disabled: noObj },
    { label: '旋转180度', action: () => deps.handleRotate(180), disabled: noObj },
    { label: '右旋90度', action: () => deps.handleRotate(270), disabled: noObj },
    { divider: true, label: '' },
    { label: '移到最前', action: () => deps.handleOrder('front'), disabled: noObj },
    { label: '前移', action: () => deps.handleOrder('forward'), disabled: noObj },
    { label: '后移', action: () => deps.handleOrder('backward'), disabled: noObj },
    { label: '移到最后', shortcut: 'Ctrl+B', action: () => deps.handleOrder('back'), disabled: noObj }
  ]
  return [
    { label: '属性', shortcut: 'Alt+Enter', action: () => deps.setModal('props'), disabled: noObj },
    { divider: true, label: '' },
    { label: '组合(G)', shortcut: 'Ctrl+G', action: deps.handleGroup, disabled: noObj },
    { label: '取消组合(U)', shortcut: 'Ctrl+U', action: deps.handleUngroup, disabled: noObj },
    { label: '位置锁定', shortcut: 'Ctrl+L', action: deps.handleLockToggle, disabled: noObj },
    { divider: true, label: '' },
    { label: '对齐', children: alignmentItems(deps, noObj), disabled: noObj },
    { label: '尺寸与间距', children: sizeDist, disabled: noObj },
    { label: '旋转与层次', children: rotateOrder, disabled: noObj },
    { divider: true, label: '' },
    { label: '剪切', shortcut: 'Shift+Delete', action: deps.handleCut, disabled: noObj },
    { label: '复制', shortcut: 'Ctrl+C', action: deps.copySelected, disabled: noObj },
    { label: '粘贴', shortcut: 'Ctrl+V', action: deps.pasteClipboard },
    { label: '删除', shortcut: 'Delete', action: deps.deleteSelected, disabled: noObj },
    { label: '全选', shortcut: 'Ctrl+A', action: deps.selectAll },
    { label: '导出(E)...', shortcut: 'Ctrl+E', action: () => deps.setModal('export'), disabled: noObj },
    { divider: true, label: '' },
    { label: '标签格式设置(L)...', action: () => deps.setModal('new') },
    { label: '模板属性设置(M)...', action: () => deps.setModal('tplprops') },
    { divider: true, label: '' },
    { label: '放大(I)', action: deps.zoomIn },
    { label: '缩小(O)', shortcut: 'Ctrl+-', action: deps.zoomOut },
    { label: '适应宽度', action: () => deps.fit('w') },
    { label: '适应高度', action: () => deps.fit('h') },
    { label: '撑满窗口(W)', shortcut: 'Ctrl+Alt+0', action: () => deps.fit('win') },
    { divider: true, label: '' },
    { label: '标签旋转', children: rotationItems(deps) }
  ]
}

export function buildLabelShopMenus(deps: LabelShopMenuDeps): { sections: MenuSection[]; contextItems: MenuItem[] } {
  return { sections: deps.isStart ? startMenus(deps) : editorMenus(deps), contextItems: contextMenu(deps) }
}
