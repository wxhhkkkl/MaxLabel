import type { LabelDoc } from '../../../../shared/domain'
import type { ModalKind } from '../shell/modalTypes'
import type { DocTab } from '../workspace/useDocumentWorkspace'
import type { MenuItem, MenuSection } from '../../editor/MenuBar'
import { editorAvailability } from '../editor/editorAvailability'

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
  selectionCount: number
  selectedGroup: boolean
  canUndo: boolean
  canRedo: boolean
  activeTool: EditorTool
  canPaste: boolean
  doc?: LabelDoc
  busy: boolean
  /** 当前文档绑定的是「签赋LabelShop 打印机」（内置驱动）→ 原版禁用「打印预览(V)」（真机 probe-19/20）。 */
  internalPrinter?: boolean
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
  /** 帮助 → 查找更新版本：联网检查并如实回报结果（帮助 install_upgrade.html）。 */
  checkUpdate: () => void
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
  cloudSignedIn: boolean
}

/**
 * 查看 → 标签旋转。帮助 `menu_view.html`：「左旋90度 —— 向**左**旋转90度显示标签板面」、
 * 「右旋90度 —— 向**右**旋转90度显示标签板面」，即左旋为逆时针、右旋为顺时针。
 * 板面用 CSS `rotate(${labelRotation}deg)` 渲染，正角度在屏幕上就是顺时针
 * （`canvasCoordinates.clientToCanvasPoint` 用同一约定做逆变换），因此
 * 左旋 = 270、右旋 = 90。这与 `AlignBar` 对象旋转的口径一致（round-90 收口）。
 */
function rotationItems(deps: LabelShopMenuDeps): MenuItem[] {
  return [
    { label: '正常显示', radio: deps.labelRotation === 0, action: () => deps.setLabelRotation(0) },
    { label: '左旋90度', radio: deps.labelRotation === 270, action: () => deps.setLabelRotation(270) },
    { label: '右旋90度', radio: deps.labelRotation === 90, action: () => deps.setLabelRotation(90) },
    { label: '旋转180度', radio: deps.labelRotation === 180, action: () => deps.setLabelRotation(180) }
  ]
}

/**
 * 对齐子菜单分成两段：
 * - 左/右/顶/底/垂直中齐/水平中齐 是「对象彼此之间」的对齐，帮助 `label_object_align_align.html`
 *   要求选中两个及以上对象，否则灰色；
 * - 居中与「相对于标签的位置」针对整个选区，一个对象即可。
 */
function alignmentItems(deps: LabelShopMenuDeps, disabled: boolean, disabledAlign: boolean): MenuItem[] {
  return [
    { label: '左对齐', action: () => deps.handleAlign('left'), disabled: disabledAlign },
    { label: '右对齐', action: () => deps.handleAlign('right'), disabled: disabledAlign },
    { label: '顶对齐', action: () => deps.handleAlign('top'), disabled: disabledAlign },
    { label: '底对齐', action: () => deps.handleAlign('bottom'), disabled: disabledAlign },
    { label: '垂直中齐', action: () => deps.handleAlign('midV'), disabled: disabledAlign },
    { label: '水平中齐', action: () => deps.handleAlign('midH'), disabled: disabledAlign },
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
  const availability = editorAvailability({
    isStart: deps.isStart,
    hasDatabase: Boolean(deps.doc && Object.keys(deps.doc.datasets ?? {}).length > 0),
    selectionCount: deps.selectionCount,
    selectedGroup: deps.selectedGroup
  })
  const noObj = !availability.hasSelection
  const hasDb = availability.hasDatabase
  const alignChildren = alignmentItems(deps, noObj, !availability.canAlignObjects)
  // 帮助 label_object_align_size.html：命令名为「水平同宽 / 垂直同宽 / 水平垂直相同」，
  // 且「除非在标签中选择了两个或多个对象，否则这些选项多数是不可用的（灰色）」。
  const tooFewForSize = !availability.canSizeObjects
  const sizeChildren: MenuItem[] = [
    { label: '水平同宽', action: () => deps.handleSame('w'), disabled: tooFewForSize },
    { label: '垂直同宽', action: () => deps.handleSame('h'), disabled: tooFewForSize },
    { label: '水平垂直相同', action: () => deps.handleSame('wh'), disabled: tooFewForSize }
  ]
  // 帮助 label_object_align_pos.html：「这个命令与对齐命令不同，对齐命令需要选定两个或多个
  // 对象，而这个命令至少需要选定三个对象」。
  const tooFewForDist = !availability.canDistribute
  const distChildren: MenuItem[] = [
    { label: '水平间距相同', action: () => deps.handleDist('h'), disabled: tooFewForDist },
    { label: '垂直间距相同', action: () => deps.handleDist('v'), disabled: tooFewForDist }
  ]
  const rotateChildren: MenuItem[] = [
    { label: '左旋90度', action: () => deps.handleRotate(270), disabled: noObj },
    { label: '旋转180度', action: () => deps.handleRotate(180), disabled: noObj },
    { label: '右旋90度', action: () => deps.handleRotate(90), disabled: noObj }
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
      { label: '分享(I)...', action: () => deps.setModal('cloud'), disabled: deps.isStart || !deps.cloudSignedIn },
      { divider: true, label: '' },
      { label: '打印(P)...', shortcut: 'Ctrl+P', action: () => deps.handlePrint(false), disabled: deps.isStart || deps.busy },
      { label: '打印预览(V)', action: () => void deps.handlePreview(), disabled: deps.isStart || deps.busy || deps.internalPrinter },
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
      { divider: true, label: '' },
      // 菜单项与顺序照抄 menu_view.html：显示启始页 / 显示打印窗体 / 打印历史记录 / 显示对象信息。
      // 「显示图层窗体」是复刻版自造项，原版菜单没有，故不在此列出（图层窗体本身保留为等价替代）。
      { label: '显示启始页(M)', action: () => deps.setActive(deps.startKey) },
      { label: '显示打印窗体(P)', checked: deps.showPrintPanel, action: deps.togglePrintPanel },
      { label: '打印历史记录', action: () => deps.setModal('history') },
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
        ['diagonal', '斜线(L)'], ['rect', '矩形(R)'], ['image', '图片(P)'], ['table', '表格(G)'],
        ['rfid', 'RFID'], ['data', '数据(D)']
      ] as Array<[EditorTool, string]>).map(([tool, label]) => ({ label, action: () => deps.handleTool(tool), active: deps.activeTool === tool, disabled: deps.isStart })),
      { divider: true, label: '' },
      { label: '放大(I)', action: deps.zoomIn, disabled: deps.isStart },
      { label: '缩小(O)', shortcut: 'Ctrl+-', action: deps.zoomOut, disabled: deps.isStart },
      { label: '适应宽度', action: () => deps.fit('w'), disabled: deps.isStart },
      { label: '适应高度', action: () => deps.fit('h'), disabled: deps.isStart },
      { label: '适合窗口(W)', shortcut: 'Ctrl+Alt+0', action: () => deps.fit('win'), disabled: deps.isStart }
    ] },
    { title: '排列(A)', items: [
      { label: '组合(G)', shortcut: 'Ctrl+G', action: deps.handleGroup, disabled: !availability.canGroup },
      { label: '取消组合(U)', shortcut: 'Ctrl+U', action: deps.handleUngroup, disabled: !availability.canUngroup },
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
    // 菜单项与顺序照抄真机 `57-editor-menu-window.png`：新建窗口(N) / 分隔线 / 已打开文档列表。
    // 真机该版本没有「层叠/平铺/排列图标」三项，复刻版同步不列出（帮助 menu_windows.html 的对应段落已过时）。
    { title: '窗口(W)', items: [
      { label: '新建窗口(N)', disabled: true },
      { divider: true, label: '' },
      ...windowItems
    ] },
    // 分组照抄真机 `58-editor-menu-help.png`：帮助主题 / 分隔线 / 在线网站 + 查找更新版本 / 分隔线 / 关于。
    // 该图未给「帮助主题(H)」标注快捷键，故此处不显示 F1（F1 键位仍有效，见 shortcut_main.html）。
    { title: '帮助(H)', items: [
      { label: '帮助主题(H)', action: () => deps.setModal('help') },
      { divider: true, label: '' },
      { label: '在线网站(W)', action: () => window.open('https://www.360code.com/') },
      // 帮助 install_upgrade.html：查找到更新的版本后按提示下载更新；与启动自动检查共用同一实现。
      { label: '查找更新版本', action: () => deps.checkUpdate() },
      { divider: true, label: '' },
      { label: '关于(A)...', action: () => deps.setModal('about') }
    ] },
    { title: '建议与反馈', items: [{ label: '建议与反馈', action: () => deps.setModal('feedback') }] }
  ]
}

function startMenus(deps: LabelShopMenuDeps): MenuSection[] {
  // 真机启始页菜单栏与编辑态**同为 12 个顶层菜单**（`parity/reference/labelshop/probe-01-newlabel.png`
  // 显示 文件(F) 编辑(E) 查看(V) 工具(T) 排列(A) 数据库(D) 账户(A) 云马通(C) 选项(O) 窗口(W) 帮助(H) 建议与反馈，
  // 与 `40-editor.png` 的编辑态一致），差别只在「文件(F)」换成了启始页专用条目、其余菜单里的文档相关项变灰。
  // 复刻版原先在启始页只列 7 个菜单（文件/查看/账户/云马通/选项/帮助/建议与反馈），少列 编辑(E)、工具(T)、
  // 排列(A)、数据库(D)、窗口(W) 五项，与真机不符；`app/scripts/ui-v118.cjs` 断言两态菜单标题序列完全一致。
  const full = editorMenus(deps)
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
    ...full.filter((section) => section.title !== '文件(F)')
  ]
}

function contextMenu(deps: LabelShopMenuDeps): MenuItem[] {
  const ctxCount = deps.contextMenu?.selectionCount ?? 0
  const hasSelection = deps.contextMenu?.hasSelection ?? false
  // 右键菜单与对齐栏、排列菜单共用同一套阈值来源，避免同一命令在三处可用性不一致。
  const multi = hasSelection && ctxCount >= 2
  const three = hasSelection && ctxCount >= 3
  const noObj = !hasSelection
  const sizeDist: MenuItem[] = [
    { label: '宽度相同', action: () => deps.handleSame('w'), disabled: !multi },
    { label: '高度相同', action: () => deps.handleSame('h'), disabled: !multi },
    { label: '宽度高度相同', action: () => deps.handleSame('wh'), disabled: !multi },
    { divider: true, label: '' },
    // 帮助 label_object_align_pos.html：间距至少要选中三个对象。
    { label: '水平间距相同', action: () => deps.handleDist('h'), disabled: !three },
    { label: '垂直间距相同', action: () => deps.handleDist('v'), disabled: !three }
  ]
  const rotateOrder: MenuItem[] = [
    { label: '左旋90度', action: () => deps.handleRotate(270), disabled: noObj },
    { label: '旋转180度', action: () => deps.handleRotate(180), disabled: noObj },
    { label: '右旋90度', action: () => deps.handleRotate(90), disabled: noObj },
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
    { label: '对齐', children: alignmentItems(deps, noObj, !multi), disabled: noObj },
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
