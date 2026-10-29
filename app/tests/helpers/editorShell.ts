import { vi } from 'vitest'
import type { DocTab } from '@/features/workspace/useDocumentWorkspace'
import type { AppMenuDeps } from '@/features/commands/appMenus'
import type { AppShortcutActions } from '@/features/commands/shortcutHandler'
import { ABSENT_DONGLE, FEATURE_MATRIX, type EntitlementState } from '@shared/domain/entitlement'
import { sampleDoc } from './factories'

/** 测试默认给一个可编辑的企业版授权；需要只读/版本限制的用例自行覆盖。 */
export function editableEntitlement(overrides: Partial<EntitlementState> = {}): EntitlementState {
  return {
    editable: true,
    edition: 'enterprise',
    editionLabel: '企业版',
    source: 'member',
    features: { ...FEATURE_MATRIX.enterprise },
    subscriptionActive: true,
    expiresAt: null,
    offline: false,
    dongle: ABSENT_DONGLE,
    checkedAt: '',
    ...overrides
  }
}

export function docTab(overrides: Partial<DocTab> = {}): DocTab {
  const doc = overrides.doc ?? sampleDoc()
  return {
    key: 'tab-1',
    title: '测试',
    doc,
    selectedId: null,
    count: 1,
    printCount: 1,
    copies: 1,
    datasetName: '',
    zoom: 1,
    tool: 'select',
    recordIdx: 0,
    startLabel: 0,
    dirty: false,
    revision: 1,
    ...overrides
  }
}

export function menuDeps(overrides: Partial<AppMenuDeps> = {}): AppMenuDeps {
  const noop = () => undefined
  return {
    language: 'zh-CN',
    isStart: false,
    active: 'tab-1',
    startKey: 'start',
    activeTab: docTab(),
    selectedObj: false,
    selectionCount: 0,
    selectedGroup: false,
    canUndo: false,
    canRedo: false,
    activeTool: 'select',
    canPaste: false,
    doc: sampleDoc(),
    busy: false,
    entitlement: editableEntitlement(),
    onUpgrade: noop,
    onReadOnlyHelp: noop,
    tabs: [docTab()],
    recents: [],
    dbRecordCount: 0,
    labelRotation: 0,
    appTheme: 'blue',
    showToolbar: true,
    showFormatBar: true,
    showAlignBar: true,
    showStatusBar: true,
    showPrintPanel: true,
    showLayerPanel: true,
    showObjectInfo: true,
    contextMenu: null,
    setModal: vi.fn(),
    checkUpdate: vi.fn(),
    requestNew: vi.fn(),
    setActive: vi.fn(),
    setStatus: vi.fn(),
    setLabelRotation: vi.fn(),
    toggleToolbar: vi.fn(),
    toggleFormatBar: vi.fn(),
    toggleAlignBar: vi.fn(),
    toggleStatusBar: vi.fn(),
    togglePrintPanel: vi.fn(),
    toggleLayerPanel: vi.fn(),
    toggleObjectInfo: vi.fn(),
    setAppTheme: vi.fn(),
    handleAlign: vi.fn(),
    handleCenter: vi.fn(),
    handleSnap: vi.fn(),
    handleSame: vi.fn(),
    handleDist: vi.fn(),
    handleRotate: vi.fn(),
    handleOrder: vi.fn(),
    handleTool: vi.fn(),
    handleOpen: async () => noop(),
    handleOpenRecent: async () => noop(),
    handleSave: async () => noop(),
    handleSaveAs: async () => noop(),
    handlePreview: async () => noop(),
    handlePrint: vi.fn(),
    handleExportCommand: async () => noop(),
    handleBannerNew: vi.fn(),
    handleDeleteDb: vi.fn(),
    handleLogout: vi.fn(),
    handleDbRefresh: async () => noop(),
    closeTab: async () => noop(),
    closeOthers: async () => noop(),
    closeAll: async () => true,
    setRecord: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    handleCut: vi.fn(),
    copySelected: vi.fn(),
    pasteClipboard: vi.fn(),
    selectAll: vi.fn(),
    deleteSelected: vi.fn(),
    handleGroup: vi.fn(),
    handleUngroup: vi.fn(),
    handleLockToggle: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fit: vi.fn(),
    openCloud: vi.fn(),
    cloudSignedIn: false,
    ...overrides
  }
}

export function shortcutActions(overrides: Partial<AppShortcutActions> = {}): AppShortcutActions {
  const noop = () => undefined
  return {
    hasDocument: true,
    hasSelection: false,
    save: vi.fn(noop),
    create: vi.fn(noop),
    open: vi.fn(noop),
    print: vi.fn(noop),
    locate: vi.fn(noop),
    help: vi.fn(noop),
    undo: vi.fn(noop),
    redo: vi.fn(noop),
    cut: vi.fn(noop),
    copy: vi.fn(noop),
    paste: vi.fn(noop),
    selectAll: vi.fn(noop),
    remove: vi.fn(noop),
    close: vi.fn(noop),
    group: vi.fn(noop),
    ungroup: vi.fn(noop),
    lock: vi.fn(noop),
    sendBack: vi.fn(noop),
    zoomIn: vi.fn(noop),
    zoomOut: vi.fn(noop),
    fitWindow: vi.fn(noop),
    toggleObjectInfo: vi.fn(noop),
    clearSelection: vi.fn(noop),
    properties: vi.fn(noop),
    exportImage: vi.fn(noop),
    selectNext: vi.fn(noop),
    tool: vi.fn(noop),
    move: vi.fn(noop),
    ...overrides
  }
}

export interface ShortcutEventLike {
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
  target?: unknown
  preventDefault?: () => void
}

export function shortcutEvent(overrides: Partial<ShortcutEventLike> = {}): Required<ShortcutEventLike> {
  return {
    key: '',
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    target: null,
    preventDefault: vi.fn(),
    ...overrides
  }
}

export const INPUT_TARGET = { tagName: 'INPUT', isContentEditable: false }
