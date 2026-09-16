import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as fabric from 'fabric'
import { defaultPrinterConfig, round2, uid } from './types'
import type { LabelDoc, ObjType, PrinterConfig } from './types'
import { printerNameOf } from '../../shared/print/engine'
import { renderLabelDataUrl } from './print/renderLabel'
import { blankTemplate } from './editor/demoTemplate'
import Toolbar from './editor/Toolbar'
import FormatBar from './editor/FormatBar'
import AlignBar from './editor/AlignBar'
import PropertyPanel from './editor/PropertyPanel'
import MenuBar from './editor/MenuBar'
import ContextMenu from './editor/ContextMenu'
import TabStrip, { type TabInfo } from './editor/TabStrip'
import LayerPanel from './editor/LayerPanel'
import WorkArea, { ZOOM_LEVELS } from './editor/WorkArea'
import PrintDock from './editor/PrintDock'
import StatusBar from './editor/StatusBar'
import StartPage, { type LibItem } from './pages/StartPage'
import ObjectInfoPopup from './dialogs/ObjectInfoPopup'
import { loadOptions, saveOptions, type AppOptions, type ToolbarGroupKey } from './dialogs/OptionsDialog'
import { collectKeyboardLabels as collectKeyboardOrdered } from './dialogs/KeyInputOrderDialog'
import { importLsdx } from './io/lsdxImport'
import { fromDocJson, looksLikeLsdx, toMsdx } from './io/msdx'
import { useDocumentWorkspace, WORKSPACE_START_KEY as START, type DocTab } from './features/workspace/useDocumentWorkspace'
import { useDocumentHistory } from './features/workspace/useDocumentHistory'
import { useRecentTemplates } from './features/workspace/useRecentTemplates'
import { useViewPreferences } from './features/shell/useViewPreferences'
import { useAsyncOperation } from './features/shell/useAsyncOperation'
import { useLicenseStartup } from './features/shell/useLicenseStartup'
import { useWindowTitle } from './features/shell/useWindowTitle'
import { useUpdateStartup } from './features/shell/useUpdateStartup'
import type { UpdateCheckResultDto } from '../../shared/ipcContract'
import { createLabelObject } from './features/editor/objectFactory'
import { useDocumentCommands } from './features/editor/useDocumentCommands'
import { useEditorTransformCommands } from './features/editor/useEditorTransformCommands'
import { editorAvailability } from './features/editor/editorAvailability'
import { advanceDocumentSerials, createPrintContext } from './features/printing/printJob'
import { useLabelShopShortcuts } from './features/commands/useLabelShopShortcuts'
import { buildLabelShopMenus, type EditorTool } from './features/commands/labelShopMenus'
import { normalizeDocument, redactDocumentSecrets } from '../../shared/domain'
import { findObjectById } from '../../shared/domain/objects'
import { shouldProceedClose } from '../../shared/domain/closeGuard'
import { usePrintWorkflow } from './features/printing/usePrintWorkflow'
import { usePreviewWorkflow } from './features/printing/usePreviewWorkflow'
import { useCommandExportWorkflow } from './features/printing/useCommandExportWorkflow'
import type { ModalKind } from './features/shell/modalTypes'
import ModalHost from './features/shell/ModalHost'
import { KeyboardInputModal, PreviewModal } from './features/shell/TransientModals'
import { hasDefaultPrinterPreference, readDefaultPrinter } from './features/shell/printerPreferences'
import { printJobJournal } from './features/printing/printJobJournal'
import { useDataManagement } from './features/data/useDataManagement'
import { labelSpecOf } from './features/workspace/labelSpec'
import type { LabelFormatSelection } from './dialogs/NewLabelDialog'
import type { WizardChoice } from './dialogs/TemplateWizardDialog'
import type { PrintAdvancedOptions } from './dialogs/PrintDialog'

const serverUrlKey = 'maxlabel_server_url'

function printerPositionOf(printer: PrinterConfig): string {
  const port = printer.port
  if (port.type === 'tcp') return `${port.tcpHost ?? '127.0.0.1'}:${port.tcpPort ?? 9100}`
  if (port.type === 'com') return port.comPort ?? 'COM1'
  if (port.type === 'lpt') return port.lptPort ?? 'LPT1:'
  if (port.type === 'file') return '打印到文件'
  if (port.type === 'bluetooth') return port.comPort ?? '蓝牙（SPP）'
  if (port.type === 'usb') return 'USB'
  return 'Windows 打印机驱动端口'
}

/** 打开云服务窗口：使用系统选项/授权页配置的服务器地址。 */
function openCloud(onError?: (message: string) => void): void {
  let url = 'http://127.0.0.1:8420'
  try { url = (localStorage.getItem(serverUrlKey) ?? url).trim().replace(/\/+$/, '') } catch { /* 使用本机默认地址。 */ }
  void window.maxlabel.cloudService.open(url).then((result) => {
    if (!result.ok) onError?.(result.error ?? '无法打开云服务窗口')
  }).catch((error) => onError?.('无法打开云服务窗口：' + (error instanceof Error ? error.message : String(error))))
}

export default function App() {
  const { tabs, setTabs, tabsRef, active, setActive, activeTab: activeDocumentTab, isStart, patchTab, patchDocument, setActiveDoc } = useDocumentWorkspace()
  const [status, setStatus] = useState('就绪')
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState<ModalKind>(null)
  const [importWarnings, setImportWarnings] = useState<string[]>([])
  const [propsTab, setPropsTab] = useState('general')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [keyboardDraft, setKeyboardDraft] = useState<{ labels: string[]; isTest: boolean; count?: number } | null>(null)
  const [keyboardValues, setKeyboardValues] = useState<Record<string, string>>({})
  /** 打印对话框-数据库高级选项（对标原版 print_dlg_dbs） */
  const [dbAdv, setDbAdv] = useState<PrintAdvancedOptions>({ autoCount: false, copyField: false, copyFieldName: '', firstCopyAsk: false, dupcheck: false, currentOnly: false, updateSerial: true, rotate180: false, printBorder: false, trackStartLabel: false, headerFooter: false, headerFooterTemplate: '&D &T &F - &P', headerFooterOffsetMm: 0, cropMarks: true, cropMarkOffsetMm: -5 })
  const [cursor, setCursor] = useState('')
  const { recents, addRecent } = useRecentTemplates()
  const [options, setOptions] = useState<AppOptions>(() => loadOptions())
  const [cloudSignedIn, setCloudSignedIn] = useState(false)
  /** 云端登录账号；用于程序标题栏的「登录状态」分段（帮助 interface_interface.html 元素 1）。 */
  const [cloudEmail, setCloudEmail] = useState<string | null>(null)
  const [skipNewWizard, setSkipNewWizard] = useState(false)
  /** 「查找更新版本」/启动自动检查的结果；null 表示尚未检查（对话框显示"正在检查更新…"）。 */
  const [updateResult, setUpdateResult] = useState<UpdateCheckResultDto | null>(null)

  useEffect(() => {
    let live = true
    void window.maxlabel.cloudCredentials.load(options.serverUrl).then((result) => {
      if (!live) return
      setCloudSignedIn(Boolean(result.ok && result.token))
      setCloudEmail(result.ok && result.token ? (result.email ?? null) : null)
    }).catch(() => { if (live) { setCloudSignedIn(false); setCloudEmail(null) } })
    return () => { live = false }
  }, [options.serverUrl])
  const {
    showToolbar, setShowToolbar, showFormatBar, setShowFormatBar,
    showAlignBar, setShowAlignBar, showStatusBar, setShowStatusBar,
    showPrintPanel, setShowPrintPanel, showLayerPanel, setShowLayerPanel,
    showObjectInfo, setShowObjectInfo, appTheme, setAppTheme, themeVars
  } = useViewPreferences()
  const canvasRef = useRef<fabric.Canvas | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dbSecretOperationsRef = useRef(new Map<string, Promise<void>>())
  const saveQueuesRef = useRef(new Map<string, Promise<boolean>>())
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; hasSelection: boolean; selectionCount: number } | null>(null)
  const beginAsyncOperation = useAsyncOperation()
  const activeOperationRef = useRef<{ id: number; isCurrent: () => boolean; cancel: () => void } | null>(null)
  const { run: runPrint, cancel: cancelPrintWorkflow } = usePrintWorkflow(beginAsyncOperation)
  const { run: runPreview, cancel: cancelPreview } = usePreviewWorkflow(beginAsyncOperation)
  const { run: runCommandExport, cancel: cancelCommandExport } = useCommandExportWorkflow(beginAsyncOperation)
  const licenseState = useLicenseStartup(serverUrlKey)

  /** 主工具栏「添加或删除按钮」：按组显示/隐藏按钮，结果随即写入系统选项（下次启动仍生效）。 */
  const handleToggleToolbarGroup = useCallback((key: ToolbarGroupKey, visible: boolean) => {
    setOptions((prev) => {
      const next = { ...prev, toolbarGroups: { ...prev.toolbarGroups, [key]: visible } }
      saveOptions(next)
      return next
    })
  }, [])

  /** 帮助 → 查找更新版本：与启动自动检查共用同一实现，如实回报结果（帮助 install_upgrade.html）。 */
  const handleCheckUpdate = useCallback(() => {
    // 服务器地址取持久化的单一来源（与 openCloud/useLicenseStartup 一致），
    // 保证刚在「系统选项」里改过地址就点本项时用的是新地址。
    let serverUrl = ''
    try { serverUrl = localStorage.getItem(serverUrlKey)?.trim() ?? '' } catch { /* 本地存储不可用时按未配置处理。 */ }
    setUpdateResult(null)
    setModal('update')
    setStatus('正在检查更新…')
    void window.maxlabel.checkForUpdate(serverUrl).then((result) => {
      setUpdateResult(result)
      setStatus(result.status === 'update' ? `发现新版本 ${result.latest}` : result.status === 'latest' ? `当前已是最新版本 ${result.current}` : (result.message ?? '未能检查到更新版本'))
    }).catch(() => {
      setUpdateResult({ status: 'unavailable', current: '', message: '无法连接更新服务器，请检查网络或云服务器地址' })
      setStatus('未能检查到更新版本')
    })
  }, [])

  const openUpdateDialog = useCallback((result: UpdateCheckResultDto) => {
    setUpdateResult(result)
    setModal('update')
  }, [])
  // 启动时自动检查更新：只在确有新版本时弹提示，失败静默（帮助 install_upgrade.html）。
  useUpdateStartup(serverUrlKey, openUpdateDialog)

  const requestNew = useCallback(() => {
    setModal(skipNewWizard ? 'new' : 'wizard')
  }, [skipNewWizard])

  useEffect(() => {
    void window.maxlabel.appConfig.load().then((result) => {
      if (result.ok) setSkipNewWizard(result.skipNewWizard === true)
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    const pending = printJobJournal.pending()
    if (pending.length) setStatus(`检测到 ${pending.length} 个上次未确认的打印任务，请核对打印机状态后再重试`)
  }, [])

  const hasRunningOperation = () => busy || Boolean(activeOperationRef.current?.isCurrent?.())

  const cancelCurrentOperation = useCallback(() => {
    activeOperationRef.current?.cancel()
    cancelPrintWorkflow()
    cancelPreview()
    cancelCommandExport()
    setBusy(false)
    setStatus('正在取消当前操作…')
  }, [cancelCommandExport, cancelPreview, cancelPrintWorkflow])

  // 起始页不是文档页，不能把回退用的标签页当作当前文档使用。
  const activeTab = activeDocumentTab ?? tabs[0]
  const doc = !isStart && activeDocumentTab ? activeDocumentTab.doc : undefined
  const selectedObj = !isStart && doc ? findObjectById(doc.objects, activeTab.selectedId) ?? null : null
  // 程序标题栏：产品名 + 激活状态 + 版本 + 登录状态 + 当前文档（帮助 interface_interface.html 元素 1）。
  useWindowTitle({
    activated: Boolean(licenseState?.active),
    loginEmail: cloudEmail,
    documentTitle: isStart || !activeDocumentTab ? null : activeDocumentTab.title
  })
  const defaultPrinter = useMemo(() => readDefaultPrinter(), [])
  const printer = doc?.printer ?? defaultPrinter
  const labelRotation = doc?.orientation ?? 0
  const { canUndo, canRedo, applyDocument, resetMutationGrouping, forgetDocument, undo, redo } = useDocumentHistory(activeTab?.key ?? START, doc, setActiveDoc, setStatus)
  const setLabelRotation = useCallback((rotation: 0 | 90 | 180 | 270) => {
    if (isStart) return
    applyDocument((current) => current.orientation === rotation ? current : { ...current, orientation: rotation }, { coalesceKey: 'orientation' })
  }, [applyDocument, isStart])

  const { selectedIds, handleAlign, handleRotate, handleSame, handleCenter, handleDist, handleOrder, handleSnap, handleGroup, handleUngroup } = useEditorTransformCommands({
    active,
    activeTab,
    doc,
    canvasRef,
    patchTab,
    applyDocument,
    setStatus
  })
  const selectedObjectIds = selectedIds()
  const editorState = editorAvailability({
    isStart,
    hasDatabase: Boolean(doc && Object.keys(doc.datasets ?? {}).length > 0),
    selectionCount: selectedObjectIds.length,
    selectedGroup: selectedObj?.type === 'group' && selectedObjectIds.length === 1
  })

  const {
    addImageFile,
    appendObject,
    updateObject,
    handleSync,
    deleteObject,
    deleteObjects,
    toggleVisible,
    reorderObject,
    copySelected,
    pasteClipboard,
    handleCut,
    handleLockToggle,
    moveSelectedBy,
    canPaste
  } = useDocumentCommands({ active, doc, selectedObj, selectedIds, patchTab, applyDocument, setStatus })

  // 帮助 config_general.html：「不选中非打印对象」开启时具有非打印输出属性的对象不能被选中，
  // 仅作为背景显示。返回值是最终生效的选中对象 id，供画布层决定是否继续（如双击开属性页）。
  const handleSelectObject = useCallback((id: string | null): string | null => {
    const candidate = id && doc ? findObjectById(doc.objects, id) : undefined
    const nextId = options.deselectNonPrintable && candidate?.suppressPrint ? null : id
    patchTab(active, (tab) => tab.selectedId === nextId ? tab : { ...tab, selectedId: nextId })
    return nextId
  }, [active, doc, options.deselectNonPrintable, patchTab])

  // ---------- 文档操作 ----------
  const handleTool = useCallback(
    (t: string) => {
      if (t === 'data') {
        patchTab(active, (tab) => ({ ...tab, tool: 'data' }))
        setStatus('数据工具：点击画布上的文字/条码/RFID 对象以修改其数据')
        return
      }
      if (t === 'image') {
        patchTab(active, (tab) => ({ ...tab, tool: 'image' }))
        setStatus('请在画布上拖拽以创建图片对象')
        return
      }
      patchTab(active, (tab) => ({ ...tab, tool: t }))
      setStatus(t === 'select' ? '选择工具' : '请在画布上点击以放置对象（' + t + '）')
    },
    [active, patchTab]
  )

  const handleCreateAt = useCallback(
    (type: string, mmX: number, mmY: number) => {
      const obj = createLabelObject(type as ObjType | 'diagonal', mmX, mmY)
      if (obj) {
        appendObject(obj)
        if (type === 'data') {
          setPropsTab('datasource')
          setModal('changedata')
        }
      }
    },
    [appendObject]
  )

  /** 拖拽绘制：以指定 mm 坐标和尺寸创建对象 */
  const handleCreateRect = useCallback(
    (type: string, mmX: number, mmY: number, mmW: number, mmH: number) => {
      const obj = createLabelObject(type as ObjType | 'diagonal', mmX, mmY)
      if (obj) {
        obj.w = round2(mmW)
        obj.h = round2(mmH)
        // 文字/条码最小高度约束
        if (obj.type === 'text' && obj.h < 3) obj.h = 3
        if (obj.type === 'barcode' && obj.h < 5) obj.h = 5
        // 帮助 label_object_create_drag.html：直线工具只能创建水平或垂直的线条，
        // 「通过向不同的方向拖动鼠标指针，可以创建水平或垂直的线条」——按拖动主轴吸附；
        // 斜线工具保留拖拽出的包围盒，渲染为任意角度斜线（label_object_line.html）。
        if (type === 'line') {
          if (mmH > mmW) obj.w = 0
          else obj.h = 0
        }
        appendObject(obj)
      }
    },
    [appendObject]
  )

  /** 画布右键菜单回调 */
  const handleContextMenu = useCallback(
    (x: number, y: number, hasSelection: boolean, selectionCount: number) => {
      setContextMenu({ visible: true, x, y, hasSelection, selectionCount })
    },
    []
  )

  /** 双击对象 → 打开与 Alt+Enter 共用的模态属性对话框 */
  const handleDoubleClick = useCallback(
    (objId: string) => {
      patchTab(active, (t) => ({ ...t, selectedId: objId }))
      setModal('props')
    },
    [active, patchTab]
  )

  const handleAddImage = useCallback(() => fileInputRef.current?.click(), [])

  // 启动行为（帮助 config_general.html A-182/A-262）：「启动时运行模板向导」勾选时每次启动都
  // 打开模板向导；未勾选时仅在首次启动打开一次「新手入门」引导。
  useEffect(() => {
    try {
      const firstRun = !localStorage.getItem('maxlabel.firstRun')
      if (firstRun) localStorage.setItem('maxlabel.firstRun', '1')
      if (options.startWithWizard) requestNew()
      else if (firstRun) setModal('getstarted')
    } catch {
      /* 忽略 */
    }
  }, [options.startWithWizard, requestNew])

  const selectAll = useCallback(() => {
    const fc = canvasRef.current
    if (!fc) return
    const objs = fc.getObjects().filter((x: any) => !String(x.dataId).startsWith('__'))
    if (!objs.length) return
    fc.discardActiveObject()
    fc.setActiveObject(new fabric.ActiveSelection(objs, { canvas: fc }))
    fc.requestRenderAll()
  }, [])

  // ---------- 数据库记录导航 ----------
  const dbRecordCount = useMemo(() => {
    const name = activeTab?.datasetName && doc?.datasets?.[activeTab.datasetName] ? activeTab.datasetName : Object.keys(doc?.datasets ?? {})[0]
    return name ? (doc?.datasets?.[name]?.rows.length ?? 0) : 0
  }, [activeTab?.datasetName, doc])

  const dbCols = useMemo(() => {
    const name = activeTab?.datasetName && doc?.datasets?.[activeTab.datasetName] ? activeTab.datasetName : Object.keys(doc?.datasets ?? {})[0]
    return name ? (doc?.datasets?.[name]?.columns ?? []) : []
  }, [activeTab?.datasetName, doc])
  const dbRows = useMemo(() => {
    const name = activeTab?.datasetName && doc?.datasets?.[activeTab.datasetName] ? activeTab.datasetName : Object.keys(doc?.datasets ?? {})[0]
    return name ? (doc?.datasets?.[name]?.rows ?? []) : []
  }, [activeTab?.datasetName, doc])

  const setRecord = useCallback(
    (idx: number) => {
      const n = Math.max(0, Math.min(dbRecordCount - 1, idx))
      patchTab(active, (t) => ({ ...t, recordIdx: n }))
      setStatus(`数据库记录：${dbRecordCount ? n + 1 : 0} / ${dbRecordCount}`)
    },
    [dbRecordCount, active, patchTab]
  )

  // ---------- 显示 / 缩放 ----------
  const setZoomBy = useCallback(
    (z: number) => {
      patchTab(active, (t) => ({ ...t, zoom: Math.max(0.5, Math.min(4, z)), zoomMode: 'manual' }))
    },
    [active, patchTab]
  )
  const handleZoomIn = useCallback(() => {
    const z = activeTab?.zoom ?? 1
    const next = ZOOM_LEVELS.find((x) => x > z + 0.001) ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1]
    setZoomBy(next)
  }, [activeTab?.zoom, setZoomBy])
  const handleZoomOut = useCallback(() => {
    const z = activeTab?.zoom ?? 1
    const next = [...ZOOM_LEVELS].reverse().find((x) => x < z - 0.001) ?? ZOOM_LEVELS[0]
    setZoomBy(next)
  }, [activeTab?.zoom, setZoomBy])
  const handleFit = useCallback(
    (mode: 'w' | 'h' | 'win') => {
      if (!doc) return
      patchTab(active, (t) => ({ ...t, zoomMode: mode }))
      setStatus(mode === 'win' ? '已撑满窗口' : mode === 'w' ? '已适应宽度' : '已适应高度')
    },
    [doc, active, patchTab]
  )

  // ---------- 模板 ----------
  const saveDbSecret = useCallback(async (id: string, password?: string) => {
    const previous = dbSecretOperationsRef.current.get(id) ?? Promise.resolve()
    const operation = previous.catch(() => {}).then(async () => {
      try {
        const result = await window.maxlabel.db.saveSecret(id, password) as { ok?: boolean; error?: string }
        if (!result?.ok) setStatus('数据库凭据保存失败：' + (result?.error ?? '系统安全存储不可用'))
      } catch (error) {
        setStatus('数据库凭据保存失败：' + (error instanceof Error ? error.message : String(error)))
      }
    })
    const settled: Promise<void> = operation.finally(() => {
      if (dbSecretOperationsRef.current.get(id) === settled) dbSecretOperationsRef.current.delete(id)
    })
    dbSecretOperationsRef.current.set(id, settled)
    await settled
  }, [])

  const openDoc = useCallback((d: LabelDoc, title?: string, path?: string) => {
    const normalized = normalizeDocument(d)
    for (const connection of Object.values(normalized.connections ?? {})) {
      if (typeof connection.password === 'string' && connection.password) void saveDbSecret(connection.id, connection.password)
    }
    const safeDocument = redactDocumentSecrets(normalized)
    const key = uid()
    const name = title ?? safeDocument.name ?? '未命名标签'
    // 打印对话框的「打印数量」默认一页的枚数（真机 8 = A4 2×4），停靠面板的「打印数量」默认 1，两处独立。
    const pageLabels = Math.max(1, (safeDocument.layout?.rows ?? 1) * (safeDocument.layout?.cols ?? 1))
    setTabs((ts) => [...ts, { key, title: name, doc: safeDocument, selectedId: null, count: 1, printCount: pageLabels, copies: 1, datasetName: '', zoom: 1, tool: 'select', recordIdx: 0, startLabel: 1, path, dirty: false, revision: 0 }])
    setActive(key)
    setSelectedIn(key, null)
    // LabelShop 的“最近的文件”只记录已打开/保存的文件；新建的未命名文档不进入该列表。
    if (path) addRecent(name, path)
  }, [addRecent, saveDbSecret])

  function setSelectedIn(key: string, sel: string | null) {
    patchTab(key, (t) => t.selectedId === sel ? t : { ...t, selectedId: sel })
  }

  const handleNewFromDialog = (w: number, h: number, paper?: import('../../shared/domain/paper').PaperGeometry, printerName?: string, format?: LabelFormatSelection) => {
    const b = blankTemplate()
    b.widthMm = w
    b.heightMm = h
    b.formatKind = format?.formatKind ?? 'custom'
    const basePrinter = readDefaultPrinter()
    const hasSavedPrinter = hasDefaultPrinterPreference()
    b.printer = {
      ...basePrinter,
      driver: hasSavedPrinter ? basePrinter.driver : options.defaultCommandSet,
      dpi: hasSavedPrinter ? basePrinter.dpi : options.defaultDpi,
      port: { ...basePrinter.port, type: hasSavedPrinter ? basePrinter.port.type : options.defaultPrintMode === 'driver' ? 'driver' : 'file' },
      ...(printerName ? { printerName } : {})
    }
    b.layout = {
      rows: format?.rows ?? options.labelRows,
      cols: format?.cols ?? options.labelCols,
      rowGapMm: options.rowGapMm,
      colGapMm: options.colGapMm,
      ...paper,
      shape: paper?.shape ?? options.labelShape,
      ...(format?.pageWidthMm && format.pageHeightMm ? { pageWidthMm: format.pageWidthMm, pageHeightMm: format.pageHeightMm } : {}),
      ...(format?.pagesPerBox ? { pagesPerBox: format.pagesPerBox } : {})
    }
    const n = tabs.length
    openDoc(b, `新标签模板${n + 1}`)
    setModal(null)
    setStatus(`已新建标签：${w} × ${h} mm`)
  }

  const handleOpen = async () => {
    try {
      const r = await window.maxlabel.openTemplate()
      if (r.canceled) return
      if (!r.content) throw new Error(r.message ?? '模板文件读取失败')
      const filePath = r.filePath ?? ''
      const isLsdx = filePath.toLowerCase().endsWith('.lsdx') || looksLikeLsdx(r.content)
      let d: LabelDoc
      let warnings: string[] = []
      if (isLsdx) {
        const imp = await importLsdx(r.content, filePath.split(/[\\/]/).pop() ?? '标签文件', { sourcePath: filePath })
        d = imp.doc
        warnings = imp.warnings
      } else {
        d = fromDocJson(r.content)
      }
      if (!d || typeof d.widthMm !== 'number' || !Array.isArray(d.objects)) throw new Error('模板格式不正确')
      openDoc(
        d,
        d.name,
        isLsdx ? undefined : filePath
      )
      if (isLsdx && filePath) addRecent(d.name ?? '未命名标签', filePath)
      setStatus('已打开：' + filePath + (warnings.length ? '（' + warnings.length + ' 项提示，见底部详情）' : ''))
      if (warnings.length) {
        setImportWarnings(warnings)
        setModal('importwarn')
      }
    } catch (err) {
      setStatus('打开失败：' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const handleWizardNext = useCallback(async (choice: WizardChoice, skip: boolean) => {
    setSkipNewWizard(skip)
    try {
      const result = await window.maxlabel.appConfig.save({ skipNewWizard: skip })
      if (!result.ok) setStatus('向导设置保存失败：' + (result.message ?? '未知错误'))
    } catch (error) {
      setStatus('向导设置保存失败：' + (error instanceof Error ? error.message : String(error)))
    }
    if (choice === 'new') setModal('new')
    else if (choice === 'open') {
      setModal(null)
      await handleOpen()
    } else setModal('help')
  }, [handleOpen])

  const saveTab = useCallback(async (tab: DocTab, forceDialog = false): Promise<boolean> => {
    const previous = saveQueuesRef.current.get(tab.key) ?? Promise.resolve(false)
    const task = previous.catch(() => false).then(async () => {
      const current = tabsRef.current.find((item) => item.key === tab.key) ?? tab
      try {
        // 同一标签页的保存严格串行，并在队列真正执行时读取最新快照，
        // 防止连续 Ctrl+S 让旧快照晚到并覆盖新内容。
        const r = current.path && !forceDialog
          ? await window.maxlabel.saveTemplateTo(current.path, toMsdx(current.doc))
          : await window.maxlabel.saveTemplate(toMsdx(current.doc), current.doc.name)
        if ('canceled' in r && r.canceled) return false
        if ('ok' in r && !r.ok) throw new Error(r.message ?? '保存失败')
        const fp = (r as { filePath?: string }).filePath ?? current.path
        if (fp) {
          addRecent(current.doc.name, fp)
          patchTab(current.key, (latest) => latest.revision === current.revision
            ? { ...latest, path: fp, dirty: false }
            : { ...latest, path: fp })
          setStatus('已保存：' + fp)
          return true
        }
        return false
      } catch (err) {
        setStatus('保存失败：' + (err instanceof Error ? err.message : String(err)))
        return false
      }
    })
    saveQueuesRef.current.set(tab.key, task)
    try {
      return await task
    } finally {
      if (saveQueuesRef.current.get(tab.key) === task) saveQueuesRef.current.delete(tab.key)
    }
  }, [addRecent, patchTab, tabsRef])

  const handleSave = async () => {
    if (activeTab) await saveTab(activeTab)
  }

  /** 另存为：总是弹出保存对话框（与原版一致） */
  const handleSaveAs = async () => {
    if (activeTab) await saveTab(activeTab, true)
  }

  /** 打开最近的文件（按路径直接读取） */
  /** 标签页拖拽排序 */
  const handleReorderTabs = useCallback((newKeys: string[]) => {
    setTabs((ts) => {
      const byKey = new Map(ts.map((t) => [t.key, t]))
      return newKeys.map((k) => byKey.get(k)).filter((t): t is DocTab => !!t)
    })
  }, [])

  const handleOpenRecent = async (item: { name: string; path?: string }) => {
    if (!item.path) {
      setStatus('「' + item.name + '」无保存路径，请通过「打开」重新选择文件')
      return
    }
    try {
      const r = await window.maxlabel.openTemplatePath(item.path)
      if (!r.ok || !r.content) {
        setStatus('打开最近文件失败：' + (r.message ?? '文件不存在'))
        return
      }
      const filePath = r.filePath ?? item.path ?? ''
      const isLsdx = filePath.toLowerCase().endsWith('.lsdx') || looksLikeLsdx(r.content)
      let d: LabelDoc
      let warnings: string[] = []
      if (isLsdx) {
        const imp = await importLsdx(r.content, filePath.split(/[\\/]/).pop() ?? '标签文件', { sourcePath: filePath })
        d = imp.doc
        warnings = imp.warnings
      } else {
        d = fromDocJson(r.content)
      }
      if (!d || typeof d.widthMm !== 'number' || !Array.isArray(d.objects)) throw new Error('模板格式不正确')
      openDoc(
        d,
        d.name ?? item.name,
        isLsdx ? undefined : filePath
      )
      if (isLsdx && filePath) addRecent(d.name ?? item.name, filePath)
      setStatus('已打开最近文件：' + filePath + (warnings.length ? '（' + warnings.length + ' 项提示）' : ''))
      if (warnings.length) {
        setImportWarnings(warnings)
        setModal('importwarn')
      }
    } catch (err) {
      setStatus('打开最近文件失败：' + (err instanceof Error ? err.message : String(err)))
    }
  }

  /** 打开模板库/开始页模板库卡片中的模板 */
  const openLibItem = useCallback(
    async (item: LibItem) => {
      try {
        const r = await window.maxlabel.openTemplatePath(item.path)
        if (!r.ok || !r.content) {
          setStatus('打开模板失败：' + (r.message ?? ''))
          return
        }
        const d = fromDocJson(r.content)
        if (!d || typeof d.widthMm !== 'number' || !Array.isArray(d.objects)) throw new Error('模板格式不正确')
        openDoc(
          d,
          d.name ?? item.name,
          item.path
        )
        setModal(null)
        setStatus('已从模板库打开：' + (d.name ?? item.name))
      } catch (err) {
        setStatus('模板库模板无效：' + (err instanceof Error ? err.message : String(err)))
      }
    },
    [openDoc]
  )

  const mayCloseTab = useCallback(async (tab: DocTab): Promise<boolean> => {
    if (!tab.dirty) return true
    try {
      const choice = await window.maxlabel.confirmClose(tab.title || tab.doc.name)
      if (!shouldProceedClose(choice)) return false
      if (choice === 'save') return saveTab(tab)
      return true
    } catch (error) {
      setStatus('关闭操作失败：' + (error instanceof Error ? error.message : String(error)))
      return false
    }
  }, [saveTab, setStatus])

  const closeTab = useCallback(async (key: string) => {
    const cur = tabsRef.current
    const target = cur.find((tab) => tab.key === key)
    if (!target || !(await mayCloseTab(target))) return
    const next = cur.filter((t) => t.key !== key)
    if (next.length === cur.length) return // key 不存在
    forgetDocument(key)
    setTabs(next)
    setActive((a) => {
      return a === key ? (next[0]?.key ?? START) : a
    })
  }, [forgetDocument, mayCloseTab])

  /** 关闭其他标签（保留 keep） */
  const closeOthers = useCallback(async (keep: string) => {
    const current = tabsRef.current
    for (const tab of current) {
      if (tab.key !== keep && !(await mayCloseTab(tab))) return
    }
    const next = current.filter((t) => t.key === keep)
    for (const tab of current) if (tab.key !== keep) forgetDocument(tab.key)
    if (next.length === 0) { const blank = blankTemplate(); next.push({ key: uid(), title: '新标签模板1', doc: blank, selectedId: null, count: 1, printCount: Math.max(1, (blank.layout?.rows ?? 1) * (blank.layout?.cols ?? 1)), copies: 1, datasetName: '', zoom: 1, tool: 'select', recordIdx: 0, startLabel: 1, dirty: false, revision: 0 }) }
    setTabs(next)
    setActive(keep)
  }, [forgetDocument, mayCloseTab])

  /** 关闭所有标签（保留起始页） */
  const closeAll = useCallback(async (): Promise<boolean> => {
    for (const tab of tabsRef.current) {
      if (!(await mayCloseTab(tab))) return false
    }
    for (const tab of tabsRef.current) forgetDocument(tab.key)
    setTabs([])
    setActive(START)
    return true
  }, [forgetDocument, mayCloseTab])

  const closeAllRef = useRef(closeAll)
  closeAllRef.current = closeAll
  useEffect(() => {
    const unsubscribe = window.maxlabel.onCloseRequested(() => {
    void closeAllRef.current().then((closed) => {
      if (closed) void window.maxlabel.closeWindow()
    })
    })
    return unsubscribe
  }, [])

  // ---------- 打印 ----------
  /** @param countOverride 打印对话框「预览」传自己的打印数量；停靠面板「预览」不传，沿用面板的打印数量。 */
  const handlePreview = async (countOverride?: number) => {
    if (!doc || !activeTab) return
    const previewTab: DocTab = countOverride === undefined ? activeTab : { ...activeTab, count: Math.max(1, countOverride) }
    if (hasRunningOperation()) {
      setStatus('当前已有打印、预览或导出任务正在执行')
      return
    }
    let firstCopies: number | undefined
    if (dbAdv.firstCopyAsk) {
      const value = window.prompt('请输入第一个标签的拷贝数量：', String(activeTab.copies))
      if (value === null) {
        setStatus('已取消预览')
        return
      }
      firstCopies = Math.max(1, parseInt(value.trim() || '1', 10) || 1)
    }
    const operation = runPreview({
      doc,
      tab: previewTab,
      printer,
      autoCount: dbAdv.autoCount,
      advanced: dbAdv,
      firstCopies,
      keyboardValues,
      allowScript: options.allowScript,
      includeSuppressed: options.printNonPrintable,
      autoRotateOutput: options.autoRotateOutput,
      tabsRef,
      setPreviewUrl,
      setBusy,
      setStatus
    })
    activeOperationRef.current = operation
    if (!operation.isCurrent()) {
      activeOperationRef.current = null
    }
  }

  const bumpSerial = useCallback(
    async (tabKey: string, cnt: number, expectedRevision: number, savePath?: string): Promise<{ ok: boolean; message?: string }> => {
      const target = tabsRef.current.find((tab) => tab.key === tabKey)
      if (!target || target.revision !== expectedRevision) {
        return { ok: false, message: '模板在打印期间已被修改' }
      }
      const next = advanceDocumentSerials(target.doc, cnt)
      patchDocument(tabKey, () => next)
      // 序列号回写：模板已有保存路径时，打印后自动静默保存（不弹对话框）
      if (!savePath) return { ok: true }
      try {
        const result = await window.maxlabel.saveTemplateTo(savePath, toMsdx(next))
        if (!result.ok) return { ok: false, message: result.message ?? '磁盘保存失败' }
        patchTab(tabKey, (tab) => tab.doc === next ? { ...tab, dirty: false } : tab)
        return { ok: true }
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }
    },
    [patchDocument, patchTab, tabsRef]
  )

  const logPrint = useCallback(
    async (mode: string, test: boolean, dataSnapshot: string[] | undefined, targetDoc: LabelDoc, summary: { logicalCount: number; physicalCount: number; copies: number; status: 'completed' | 'submitted' | 'partial' | 'failed' | 'canceled' | 'unknown'; sentCount: number }) => {
      try {
        await window.maxlabel.logPrint({ time: new Date().toISOString(), title: targetDoc.name, mode, count: summary.logicalCount, copies: summary.copies, physicalCount: summary.physicalCount, status: summary.status, sentCount: summary.sentCount, test, printer: printerNameOf(printer), dataSnapshot })
      } catch {
        // 日志失败不影响打印
      }
    },
    [printer]
  )

  const {
    refreshAutoDb,
    handleDbRefresh,
    handleDataImport,
    handleDataDelete,
    handleImportReplace,
    handleConnectionSave,
    handleConnectionDelete,
    handleRenameField
  } = useDataManagement({
    doc,
    active,
    tabsRef,
    dbSecretOperationsRef,
    patchDocument,
    applyDocument,
    resetMutationGrouping,
    saveDbSecret,
    setStatus
  })

  const collectKeyboardLabels = (d: LabelDoc): string[] => {
    const all = collectKeyboardOrdered(d)
    const saved = d.keyboardOrder ?? []
    const rest = all.filter((l) => !saved.includes(l))
    return [...saved.filter((l) => all.includes(l)), ...rest]
  }

  const doPrint = (test: boolean, kv: Record<string, string>, countOverride?: number) => {
    if (!doc || !activeTab) return
    const printTab = countOverride === undefined ? activeTab : { ...activeTab, count: Math.max(1, countOverride) }
    const operation = runPrint(test, {
      sourceDoc: doc,
      printTab,
      printer,
      options: {
        allowScript: options.allowScript,
        printNonPrintable: options.printNonPrintable,
        autoRotateOutput: options.autoRotateOutput,
        advanced: dbAdv,
        keyboardValues: kv
      },
      refreshAutoDb,
      bumpSerial,
      logPrint,
      setBusy,
      setStatus
    }, kv)
    activeOperationRef.current = operation
  }

  const handlePrintNow = (test: boolean, countOverride?: number) => {
    if (!doc || hasRunningOperation()) {
      if (hasRunningOperation()) setStatus('当前已有打印、预览或导出任务正在执行')
      return
    }
    const labels = collectKeyboardLabels(doc)
    if (labels.length) {
      setKeyboardDraft({ labels, isTest: test, count: countOverride })
      return
    }
    void doPrint(test, keyboardValues, countOverride)
  }

  const openPrintDialog = () => {
    if (!doc || hasRunningOperation()) {
      if (hasRunningOperation()) setStatus('当前已有打印、预览或导出任务正在执行')
      return
    }
    setModal('print')
  }

  // 菜单、工具栏和 Ctrl+P 对标原版进入打印对话框；停靠面板按钮保留直接打印。
  const handlePrint = (test: boolean) => {
    if (test) return handlePrintNow(true)
    openPrintDialog()
  }

  const handleKeyboardSubmit = (vals: Record<string, string>) => {
    const t = keyboardDraft?.isTest ?? false
    setKeyboardValues(vals)
    setKeyboardDraft(null)
    void doPrint(t, vals, keyboardDraft?.count)
  }

  const handlePrinterSave = (p: PrinterConfig) => {
    applyDocument((d) => ({ ...d, printer: p }), { coalesceKey: 'printer' })
    setStatus('打印机设置已保存（随模板保存）')
  }

  /** 导出打印机指令文件（文件 → 导出打印机指令文件） */
  const handleExportCommand = async () => {
    if (!doc || !activeTab) return
    if (hasRunningOperation()) {
      setStatus('当前已有打印、预览或导出任务正在执行')
      return
    }
    const operation = runCommandExport({
      doc,
      tab: activeTab,
      printer,
      keyboardValues,
      allowScript: options.allowScript,
      includeSuppressed: options.printNonPrintable,
      autoRotateOutput: options.autoRotateOutput,
      tabsRef,
      setBusy,
      setStatus
    })
    activeOperationRef.current = operation
  }

  /** 新建条幅飘带（文件 → 新建 → 新建条幅飘带） */
  const handleBannerNew = () => {
    const b = blankTemplate()
    b.widthMm = 100
    b.heightMm = 15
    const n = tabs.length
    openDoc(b, `条幅飘带${n + 1}`)
    setModal(null)
    setStatus('已新建条幅飘带标签：100 × 15 mm')
  }

  /** 删除数据库（数据库 → 删除数据库） */
  const handleDeleteDb = () => {
    if (!doc) return
    const names = Object.keys(doc.datasets ?? {})
    if (!names.length) {
      setStatus('当前模板没有数据库')
      return
    }
    for (const connection of Object.values(doc.connections ?? {})) void saveDbSecret(connection.id)
    applyDocument((d) => ({ ...d, datasets: {}, connections: {} }))
    setStatus('已删除当前模板的全部数据库')
  }

  /** 注销（账户 → 注销） */
  const handleLogout = async () => {
    let serverUrl = ''
    try { serverUrl = localStorage.getItem(serverUrlKey) ?? '' } catch { /* 本地存储不可用时仍清理默认离线会话。 */ }
    let cleanupError = ''
    try {
      const credential = await window.maxlabel.cloudCredentials.load(serverUrl)
      if (credential.ok && credential.token) await window.maxlabel.cloud.logout(serverUrl, credential.token)
    } catch {
      // 本地注销仍应完成；网络不可用时服务端 token 会自然过期。
    }
    try {
      const result = await window.maxlabel.cloudCredentials.clear(serverUrl)
      if (!result.ok) cleanupError = '本地登录凭据清理失败：' + (result.error ?? '未知错误')
    } catch (error) {
      cleanupError = '本地登录凭据清理失败：' + (error instanceof Error ? error.message : String(error))
    }
    localStorage.removeItem('maxlabel_cloud_token')
    localStorage.removeItem('maxlabel_cloud_email')
    localStorage.removeItem('maxlabel_cloud_server')
    setCloudSignedIn(false)
    setStatus(cleanupError || '已注销登录')
  }

  // ---------- 菜单与右键命令模型 ----------
  const menuModel = useMemo(() => buildLabelShopMenus({
    isStart,
    active,
    startKey: START,
    activeTab,
    selectedObj: Boolean(selectedObj),
    selectionCount: selectedObjectIds.length,
    selectedGroup: selectedObj?.type === 'group' && selectedObjectIds.length === 1,
    canUndo,
    canRedo,
    activeTool: isStart ? 'select' : (activeTab?.tool as EditorTool),
    canPaste,
    doc,
    busy,
    tabs,
    recents,
    dbRecordCount,
    labelRotation,
    appTheme,
    showToolbar,
    showFormatBar,
    showAlignBar,
    showStatusBar,
    showPrintPanel,
    showLayerPanel,
    showObjectInfo,
    contextMenu,
    setModal,
    checkUpdate: handleCheckUpdate,
    requestNew,
    setActive,
    setStatus,
    setLabelRotation,
    toggleToolbar: () => setShowToolbar((value) => !value),
    toggleFormatBar: () => setShowFormatBar((value) => !value),
    toggleAlignBar: () => setShowAlignBar((value) => !value),
    toggleStatusBar: () => setShowStatusBar((value) => !value),
    togglePrintPanel: () => setShowPrintPanel((value) => !value),
    toggleLayerPanel: () => setShowLayerPanel((value) => !value),
    toggleObjectInfo: () => setShowObjectInfo((value) => !value),
    setAppTheme,
    handleAlign,
    handleCenter,
    handleSnap,
    handleSame,
    handleDist,
    handleRotate,
    handleOrder,
    handleTool: (tool) => handleTool(tool as EditorTool),
    handleOpen,
    handleOpenRecent,
    handleSave,
    handleSaveAs,
    handlePreview,
    handlePrint,
    handleExportCommand,
    handleBannerNew,
    handleDeleteDb,
    handleLogout,
    handleDbRefresh,
    closeTab,
    closeOthers,
    closeAll,
    setRecord,
    undo,
    redo,
    handleCut,
    copySelected,
    pasteClipboard,
    selectAll,
    deleteSelected: () => {
      const ids = selectedIds()
      if (ids.length) deleteObjects(ids)
    },
    handleGroup,
    handleUngroup,
    handleLockToggle,
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    fit: handleFit,
    openCloud,
    cloudSignedIn
  }), [
    isStart, active, activeTab, selectedObj, selectedObjectIds, canUndo, canRedo, canPaste, doc, busy, tabs, recents, dbRecordCount,
    labelRotation, appTheme, showToolbar, showFormatBar, showAlignBar, showStatusBar,
    showPrintPanel, showLayerPanel, showObjectInfo, contextMenu, setModal, setActive, setStatus,
    setLabelRotation, setShowToolbar, setShowFormatBar, setShowAlignBar, setShowStatusBar,
    setShowPrintPanel, setShowLayerPanel, setShowObjectInfo, setAppTheme, handleAlign,
    handleCenter, handleSnap, handleSame, handleDist, handleRotate, handleOrder, handleTool,
    handleOpen, handleOpenRecent, handleSave, handleSaveAs, handlePreview, handlePrint,
    handleExportCommand, handleBannerNew, handleDeleteDb, handleLogout, handleDbRefresh,
    closeTab, closeOthers, closeAll, setRecord, undo, redo, handleCut, copySelected,
    pasteClipboard, selectAll, selectedIds, deleteObjects, handleGroup, handleUngroup,
    handleLockToggle, handleZoomIn, handleZoomOut, handleFit, requestNew, cloudSignedIn
  ])
  const menuSections = menuModel.sections
  const contextMenuItems = menuModel.contextItems

  const selectNextObject = useCallback(() => {
    if (!activeTab?.doc) return
    const objects = activeTab.doc.objects.filter((object) => object.visible !== false)
    if (!objects.length) return
    const index = selectedObj ? objects.findIndex((object) => object.id === selectedObj.id) : -1
    patchTab(active, (tab) => ({ ...tab, selectedId: objects[(index + 1) % objects.length].id }))
  }, [active, activeTab?.doc, patchTab, selectedObj])

  useLabelShopShortcuts({
    hasDocument: !isStart,
    hasSelection: !!selectedObj,
    save: () => { void handleSave() },
    create: requestNew,
    open: () => { void handleOpen() },
    print: () => openPrintDialog(),
    locate: () => setModal('locate'),
    help: () => setModal('help'),
    undo,
    redo,
    cut: handleCut,
    copy: copySelected,
    paste: pasteClipboard,
    selectAll,
    remove: () => { const ids = selectedIds(); if (ids.length) deleteObjects(ids) },
    close: () => { void closeTab(active) },
    group: handleGroup,
    ungroup: handleUngroup,
    lock: handleLockToggle,
    sendBack: () => handleOrder('back'),
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    fitWindow: () => handleFit('win'),
    toggleObjectInfo: () => setShowObjectInfo((visible) => !visible),
    // Modal dialogs own Escape. Do not let the global editor shortcut clear
    // the selected object before the modal closes; LabelShop keeps the object
    // selected after cancelling/closing its property dialog.
    clearSelection: () => { if (!isStart && modal === null) patchTab(active, (tab) => ({ ...tab, selectedId: null })) },
    properties: () => selectedObj ? setModal('props') : setStatus('请先选中对象'),
    exportImage: () => setModal('export'),
    selectNext: selectNextObject,
    tool: handleTool,
    move: moveSelectedBy
  })

  // ---------- 渲染 ----------
  const startHint = () => setStatus('请先新建或打开标签模板')
  const tabInfos: TabInfo[] = [{ key: START, title: '起始页', isStart: true }, ...tabs.map((t) => ({ key: t.key, title: t.dirty ? `${t.title} *` : t.title }))]
  const activeDoc = !isStart && activeTab ? activeTab.doc : undefined
  const datasetNames = activeDoc ? Object.keys(activeDoc.datasets ?? {}) : []
  const datasetName = activeTab?.datasetName && activeDoc?.datasets?.[activeTab.datasetName] ? activeTab.datasetName : (datasetNames[0] ?? '')
  const currentDbRecord = dbRecordCount > 0
    ? Math.min(Math.max(activeTab?.recordIdx ?? 0, 0), dbRecordCount - 1) + 1
    : 0
  const currentDbCopies = Math.max(1, activeTab?.copies ?? 1)
  const dbStatus = activeDoc && datasetNames.length
    ? `${currentDbRecord}/${dbRecordCount}（${currentDbCopies}）`
    : '未使用数据库'
  const objectInfo = selectedObj
    ? `X: ${selectedObj.x.toFixed(2)}, Y: ${selectedObj.y.toFixed(2)}, W: ${selectedObj.w.toFixed(2)}, H: ${selectedObj.h.toFixed(2)} ${options.unit === 'inch' ? 'in' : '毫米'}`
    : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', fontFamily: "'Segoe UI','Microsoft YaHei',sans-serif", ...themeVars } as React.CSSProperties}>
      <MenuBar sections={menuSections} />

      {showToolbar && (
        <Toolbar
          busy={busy}
          canDelete={!!selectedObj}
          canUndo={canUndo}
          canRedo={canRedo}
          canCopy={!!selectedObj}
          canGroup={editorState.canGroup}
          canUngroup={editorState.canUngroup}
          canDatabaseNavigate={editorState.canDatabaseNavigate}
          canPaste={canPaste}
          tool={isStart ? 'select' : activeTab.tool}
          onTool={isStart ? startHint : handleTool}
          onNew={requestNew}
          onOpen={() => void handleOpen()}
          onSave={isStart ? startHint : () => void handleSave()}
          onCut={isStart ? startHint : handleCut}
          onCopy={isStart ? startHint : copySelected}
          onPaste={isStart ? startHint : pasteClipboard}
          onDelete={() => { const ids = selectedIds(); if (ids.length) deleteObjects(ids) }}
          onUndo={isStart ? startHint : undo}
          onRedo={isStart ? startHint : redo}
          onLabelFormat={isStart ? startHint : () => setModal('tplprops')}
          onPreview={isStart ? startHint : () => void handlePreview()}
          onPrint={isStart ? startHint : () => handlePrint(false)}
          onAddImage={isStart ? startHint : handleAddImage}
          onData={isStart ? startHint : () => handleTool('data')}
          onDbConfig={isStart ? startHint : () => setModal('data')}
          onDbLocate={isStart ? startHint : () => setModal('locate')}
          onDbRefresh={isStart ? startHint : () => void handleDbRefresh()}
          onDbFirst={isStart ? startHint : () => setRecord(0)}
          onDbPrev={isStart ? startHint : () => setRecord(activeTab.recordIdx - 1)}
          onDbNext={isStart ? startHint : () => setRecord(activeTab.recordIdx + 1)}
          onDbLast={isStart ? startHint : () => setRecord(dbRecordCount - 1)}
          onZoomIn={isStart ? startHint : handleZoomIn}
          onZoomOut={isStart ? startHint : handleZoomOut}
          onFitWidth={isStart ? startHint : () => handleFit('w')}
          onFitHeight={isStart ? startHint : () => handleFit('h')}
          onFitWindow={isStart ? startHint : () => handleFit('win')}
          onHelp={() => setModal('help')}
          groups={options.toolbarGroups}
          onToggleGroup={handleToggleToolbarGroup}
          layout={options.toolbarLayout}
          onCustomize={() => setModal('customizeToolbar')}
        />
      )}
      {showFormatBar && (
        <FormatBar
          obj={isStart ? null : selectedObj}
          onPatch={(p) => selectedObj && updateObject(selectedObj.id, p)}
          onGroup={isStart ? startHint : handleGroup}
          onUngroup={isStart ? startHint : handleUngroup}
          onProps={isStart ? startHint : () => (selectedObj ? setModal('props') : setStatus('请先选中对象'))}
          canGroup={editorState.canGroup}
          canUngroup={editorState.canUngroup}
        />
      )}
      {showAlignBar && (
        <AlignBar
          disabled={isStart || !selectedObj}
          onAlign={handleAlign}
          onRotate={handleRotate}
          onSame={handleSame}
          onCenter={handleCenter}
          onDist={handleDist}
          onOrder={handleOrder}
          onSnap={handleSnap}
        />
      )}

      {isStart || !activeDoc ? (
        <>
          <div style={{ flex: 1, minHeight: 0 }}>
            <StartPage
            onNew={requestNew}
            onOpenDocument={() => setModal('tpllib')}
            onOpenLocal={() => void handleOpen()}
            onOpenRecent={(item) => void handleOpenRecent(item)}
            onLogin={() => void openCloud(setStatus)}
            onCloudHome={() => void openCloud(setStatus)}
            onOpenUrl={(url) => { window.open(url, '_blank', 'noopener,noreferrer') }}
            recentTemplates={recents}
            onGetStarted={() => setModal('getstarted')}
            tabs={tabInfos}
            activeTab={active}
            onTabSelect={setActive}
            onTabClose={closeTab}
            onTabReorder={handleReorderTabs}
            onTabNew={requestNew}
            onTabCloseOthers={closeOthers}
            onTabCloseAll={closeAll}
          />
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            {showLayerPanel && (
              <LayerPanel
                objects={activeDoc.objects}
                selectedId={activeTab.selectedId}
                onSelect={handleSelectObject}
                onDelete={deleteObject}
                onToggleVisible={toggleVisible}
                onReorder={reorderObject}
                onClose={() => setShowLayerPanel(false)}
                onHide={() => setShowLayerPanel(false)}
                onRowContextMenu={(objId, x, y) => {
                  patchTab(active, (t) => ({ ...t, selectedId: objId }))
                  handleContextMenu(x, y, true, 1)
                }}
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <TabStrip tabs={tabInfos} active={active} onSelect={setActive} onClose={closeTab} onReorder={handleReorderTabs} onNew={requestNew} onCloseOthers={closeOthers} onCloseAll={closeAll} />
              <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                <WorkArea
                  doc={activeDoc}
                  docKey={active}
                  selectedId={activeTab.selectedId}
                   onSelect={handleSelectObject}
                  onSync={handleSync}
                  zoom={activeTab.zoom}
                  zoomMode={activeTab.zoomMode ?? 'win'}
                  setZoom={(z, automatic) => patchTab(active, (t) => ({ ...t, zoom: Math.max(0.5, Math.min(4, z)), zoomMode: automatic ? t.zoomMode : 'manual' }))}
                  recordIndex={activeTab.recordIdx}
                  datasetName={datasetName}
                  keyboardValues={keyboardValues}
                  onMouseMove={(x, y) => {
                    if (options.unit === 'inch') setCursor(`${(x / 25.4).toFixed(3)}, ${(y / 25.4).toFixed(3)} in`)
                    else setCursor(`${x.toFixed(2)}, ${y.toFixed(2)} 毫米`)
                  }}
                  onMouseLeave={() => setCursor('')}
                  showRulers={options.showRulers}
                   showGrid={options.showGrid}
                   allowScript={options.allowScript}
                  workspaceBg={options.workspaceBg}
                  unit={options.unit}
                  onCanvasReady={(c) => (canvasRef.current = c)}
                  tool={activeTab.tool}
                  onCreateAt={handleCreateAt}
                  onCreateRect={handleCreateRect}
                  onContextMenu={handleContextMenu}
                  onDoubleClick={handleDoubleClick}
                  onToolObjClick={(id) => {
                    patchTab(active, (tab) => ({ ...tab, selectedId: id, tool: 'select' }))
                    setModal('changedata')
                  }}
                  labelRotation={labelRotation}
                  onRotate={() => setLabelRotation(((labelRotation + 90) % 360) as 0 | 90 | 180 | 270)}
                />
                {(selectedObj || showPrintPanel) && (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0, overflow: 'hidden' }}>
                    {selectedObj && <PropertyPanel obj={selectedObj} datasets={activeDoc.datasets ?? {}} connections={activeDoc.connections ?? {}} allowMultipleDatabaseConnections={options.useMultipleDatabaseConnections} onPatch={(p) => updateObject(selectedObj.id, p)} />}
                    {showPrintPanel && (
                      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                        <PrintDock
                          doc={activeDoc}
                          title={activeTab.title}
                          busy={busy}
                          count={activeTab.count}
                          setCount={(n) => patchTab(active, (t) => ({ ...t, count: n }))}
                          copies={activeTab.copies}
                          setCopies={(n) => patchTab(active, (t) => ({ ...t, copies: n }))}
                          datasetNames={datasetNames}
                          datasetName={datasetName}
                          onDatasetChange={(name) => patchTab(active, (t) => ({ ...t, datasetName: name }))}
                          onPrinterSettings={() => setModal('printer')}
                          onPrinterNameChange={(name) => applyDocument((d) => ({ ...d, printer: { ...(d.printer ?? defaultPrinterConfig()), printerName: name || undefined } }), { coalesceKey: 'printer' })}
                          onData={() => setModal('data')}
                          onPrint={() => handlePrintNow(false)}
                          onCancel={cancelCurrentOperation}
                          onHistory={() => setModal('history')}
                          onHide={() => setShowPrintPanel(false)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {showStatusBar && (
        <StatusBar
          status={status}
          printerLabel={isStart ? '打印机' : printer?.printerName?.trim() || '打印机'}
          labelSpec={isStart || !activeDoc ? '纸张' : labelSpecOf(activeDoc)}
          dbStatus={isStart ? '数据库' : dbStatus}
          cursor={cursor}
          objectInfo={isStart ? '' : objectInfo}
          zoom={isStart ? 1 : activeTab.zoom}
          onZoom={(z) => !isStart && setZoomBy(z)}
          unit={options.unit}
        />
      )}

      {/* 显示对象信息浮窗（查看 → 显示对象信息 / Ctrl+R） */}
      {showObjectInfo && !isStart && selectedObj && <ObjectInfoPopup obj={selectedObj} onClose={() => setShowObjectInfo(false)} />}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={addImageFile} />
      {previewUrl && <PreviewModal url={previewUrl} label={`${activeDoc?.widthMm ?? 0} × ${activeDoc?.heightMm ?? 0} mm`} onClose={() => setPreviewUrl(null)} />}
      {keyboardDraft && <KeyboardInputModal labels={keyboardDraft.labels} initial={keyboardValues} isTest={keyboardDraft.isTest} onClose={() => setKeyboardDraft(null)} onSubmit={handleKeyboardSubmit} />}
      <ModalHost
        modal={modal}
        setModal={setModal}
        activeDoc={activeDoc}
        selectedObj={selectedObj}
        propsTab={propsTab}
        options={options}
        printer={printer}
        serverUrl={options.serverUrl}
        updateResult={updateResult}
        importWarnings={importWarnings}
        dbRecordCount={dbRecordCount}
        dbCols={dbCols}
        dbRows={dbRows}
        dbCurrentIndex={activeTab?.recordIdx ?? 0}
        tabs={tabs}
        active={active}
        startKey={START}
        onNew={handleNewFromDialog}
        onRequestNew={requestNew}
        onWizardNext={handleWizardNext}
        onPrinterSave={handlePrinterSave}
        onPrinterInstall={(driver, dpi, portType) => {
          applyDocument((d) => ({ ...d, printer: { ...defaultPrinterConfig(), driver, dpi, port: { ...defaultPrinterConfig().port, type: portType as import('./types').PrinterConfig['port']['type'] } } }), { coalesceKey: 'printer' })
          setStatus('已安装打印机：' + driver.toUpperCase() + ' · ' + dpi + 'dpi · ' + portType + '（随模板保存）')
          setModal(null)
        }}
        onPrinterRemove={() => { applyDocument((d) => ({ ...d, printer: undefined }), { coalesceKey: 'printer' }); setStatus('已移除打印机'); setModal(null) }}
        onDataImport={handleDataImport}
        onImportReplace={handleImportReplace}
        onDataDelete={handleDataDelete}
        onConnectionSave={handleConnectionSave}
        onConnectionDelete={handleConnectionDelete}
        onRenameField={handleRenameField}
        onCloudLoad={(json) => {
          try { const loaded = fromDocJson(json); openDoc(loaded, loaded.name); setModal(null); setStatus('已加载云端模板：' + loaded.name) }
          catch (err) { setStatus('云端模板无效：' + (err instanceof Error ? err.message : String(err))) }
        }}
        onOpenLib={openLibItem}
        onOpenJson={(json, name) => {
          try { const d = fromDocJson(json); openDoc(d, d.name ?? name); setModal(null); setStatus('已加载共享模板：' + (d.name ?? name)) }
          catch { setStatus('共享模板无效') }
        }}
        onSaveCurrent={async () => {
          if (!activeDoc || !activeTab) return { ok: false, message: '无当前模板' }
          let thumb = ''
          try { thumb = await renderLabelDataUrl(activeDoc, { dpi: 60, ctx: createPrintContext({ doc: activeDoc, printer, copies: activeTab.copies, count: activeTab.count, keyboardValues, recordIndex: activeTab.recordIdx, datasetName: activeTab.datasetName }) }) } catch { /* 缩略图失败不阻塞保存 */ }
           const r = await window.maxlabel.saveTemplateToLib(activeDoc.name, JSON.stringify(redactDocumentSecrets({ ...activeDoc, thumb }), null, 2))
           return r
        }}
        onMsg={setStatus}
        onOptionsSave={setOptions}
        onPatchDoc={(patch) => applyDocument((doc) => ({ ...doc, ...patch }), { coalesceKey: 'document-properties' })}
        onUpdateObject={(patch) => { if (selectedObj) updateObject(selectedObj.id, patch) }}
        onKeyOrderSave={(order) => applyDocument((doc) => ({ ...doc, keyboardOrder: order }), { coalesceKey: 'keyboard-order' })}
        onLocate={setRecord}
        onPreview={() => { if (!isStart && activeTab) void handlePreview(activeTab.printCount) }}
        onTestPrint={() => { if (!isStart && activeTab) handlePrintNow(true) }}
        printTitle={activeTab?.title ?? activeDoc?.name ?? '未命名标签'}
        printPrinterLabel={isStart ? '打印机' : printer?.printerName?.trim() || '打印机'}
        printPrinterPosition={isStart ? '—' : printerPositionOf(printer)}
        printCount={isStart ? 1 : Math.max(1, activeTab?.printCount ?? 1)}
        setPrintCount={(value) => { if (activeTab) patchTab(active, (tab) => ({ ...tab, printCount: value })) }}
        printCopies={activeTab?.copies ?? 1}
        setPrintCopies={(value) => { if (activeTab) patchTab(active, (tab) => ({ ...tab, copies: value })) }}
        printStartRecord={(activeTab?.recordIdx ?? 0) + 1}
        setPrintStartRecord={(value) => { if (activeTab) setRecord(value - 1) }}
        printStartLabel={activeTab?.startLabel ?? 1}
        setPrintStartLabel={(value) => { if (activeTab) patchTab(active, (tab) => ({ ...tab, startLabel: Math.max(1, value) })) }}
        printPageLabelCount={Math.max(1, (activeDoc?.layout?.rows ?? 1) * (activeDoc?.layout?.cols ?? 1))}
        printAdvanced={dbAdv}
        setPrintAdvanced={(patch) => setDbAdv((current) => ({ ...current, ...patch }))}
        onPrint={(count) => { setModal(null); handlePrintNow(false, count) }}
        onSetActive={setActive}
        onRefreshLibrary={() => {}}
      />

      {/* 画布右键上下文菜单 */}
      {contextMenu?.visible && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
