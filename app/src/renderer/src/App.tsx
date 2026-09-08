import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as fabric from 'fabric'
import { advanceSerial, defaultPrinterConfig, resolveObjectText, round2, uid } from './types'
import type { DataCtx, Dataset, DbConnectionConfig, GroupObj, LabelDoc, LabelObject, ObjType, PrinterConfig } from './types'
import { buildCommands, printerNameOf } from '../../shared/print/engine'
import { pageSizeMm, renderLabelDataUrl } from './print/renderLabel'
import { prepareImagesByLabel } from './print/bitmapSource'
import { demoTemplate, blankTemplate } from './editor/demoTemplate'
import LabelEditor, { type EditorApi } from './editor/LabelEditor'
import Toolbar from './editor/Toolbar'
import FormatBar from './editor/FormatBar'
import AlignBar, { type AlignMode, type CenterMode, type DistMode, type OrderMode, type RotateMode, type SameMode, type SnapEdge } from './editor/AlignBar'
import PropertyPanel from './editor/PropertyPanel'
import MenuBar, { type MenuItem, type MenuSection } from './editor/MenuBar'
import ContextMenu from './editor/ContextMenu'
import TabStrip, { type TabInfo } from './editor/TabStrip'
import LayerPanel from './editor/LayerPanel'
import WorkArea, { ZOOM_LEVELS } from './editor/WorkArea'
import PrintDock from './editor/PrintDock'
import StatusBar from './editor/StatusBar'
import StartPage, { type LibItem } from './pages/StartPage'
import NewLabelDialog from './dialogs/NewLabelDialog'
import ObjectInfoPopup from './dialogs/ObjectInfoPopup'
import PrinterSettings from './dialogs/PrinterSettings'
import PrintersInstallDialog from './dialogs/PrintersInstallDialog'
import DataPanel from './dialogs/DataPanel'
import ExportModal from './dialogs/ExportModal'
import LicenseDialog from './dialogs/LicenseDialog'
import EnterpriseDialog from './dialogs/EnterpriseDialog'
import OptionsDialog, { loadOptions, type AppOptions } from './dialogs/OptionsDialog'
import AboutDialog from './dialogs/AboutDialog'
import HelpDialog from './dialogs/HelpDialog'
import ObjectPropsDialog from './dialogs/ObjectPropsDialog'
import ChangeDataDialog from './dialogs/ChangeDataDialog'
import GetStartedDialog from './dialogs/GetStartedDialog'
import FeedbackDialog from './dialogs/FeedbackDialog'
import TemplatePropsDialog from './dialogs/TemplatePropsDialog'
import PrintHistoryDialog from './dialogs/PrintHistoryDialog'
import KeyInputOrderDialog from './dialogs/KeyInputOrderDialog'
import TemplateLibDialog from './dialogs/TemplateLibDialog'
import { LocateRecordDialog, TrialDialog, DemoDialog, WeighDialog, UpdateDialog } from './dialogs/MoreDialogs'
import { collectKeyboardLabels as collectKeyboardOrdered } from './dialogs/KeyInputOrderDialog'
import { importLsdx } from './io/lsdxImport'
import { fromDocJson, looksLikeLsdx, toMsdx } from './io/msdx'

interface DocTab {
  key: string
  title: string
  doc: LabelDoc
  selectedId: string | null
  count: number
  copies: number
  datasetName: string
  zoom: number
  tool: string
  recordIdx: number
  /** 起始标签（页式机从第 N 张开始，默认 1） */
  startLabel: number
}

type ModalKind =
  | 'new'
  | 'printer'
  | 'data'
  | 'export'
  | 'cloud'
  | 'license'
  | 'enterprise'
  | 'options'
  | 'about'
  | 'props'
  | 'tplprops'
  | 'tpllib'
  | 'history'
  | 'locate'
  | 'keyorder'
  | 'trial'
  | 'demo'
  | 'weigh'
  | 'printers'
  | 'update'
  | 'help'
  | 'changedata'
  | 'getstarted'
  | 'feedback'
  | 'importwarn'
  | null

const recentsKey = 'maxlabel.recent'
const START = 'start'
const serverUrlKey = 'maxlabel_server_url'

function readRecents(): Array<{ name: string; path?: string }> {
  try {
    const raw = localStorage.getItem(recentsKey)
    return raw ? (JSON.parse(raw) as Array<{ name: string; path?: string }>) : []
  } catch {
    return []
  }
}

/** 打开云服务窗口：使用系统选项/授权页配置的服务器地址（默认本机开发占位） */
function openCloud(): void {
  const url = (localStorage.getItem(serverUrlKey) ?? 'http://127.0.0.1:8420').trim().replace(/\/+$/, '')
  void window.maxlabel.cloudService.open(url)
}

export default function App() {
  const [tabs, setTabs] = useState<DocTab[]>(() => [
    { key: uid(), title: '新标签模板1', doc: demoTemplate(), selectedId: null, count: 1, copies: 1, datasetName: '', zoom: 1, tool: 'select', recordIdx: 0, startLabel: 1 }
  ])
  /** tabs 的 ref 镜像：供 closeTab 等回调在批量更新中读取最新值（避免闭包旧值错位） */
  const tabsRef = useRef(tabs)
  useEffect(() => { tabsRef.current = tabs }, [tabs])
  const [active, setActive] = useState<string>(START)
  const [status, setStatus] = useState('就绪')
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState<ModalKind>(null)
  const [importWarnings, setImportWarnings] = useState<string[]>([])
  const [propsTab, setPropsTab] = useState('general')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [keyboardDraft, setKeyboardDraft] = useState<{ labels: string[]; isTest: boolean } | null>(null)
  const [keyboardValues, setKeyboardValues] = useState<Record<string, string>>({})
  /** 打印对话框-数据库高级选项（对标原版 print_dlg_dbs） */
  const [dbAdv, setDbAdv] = useState<{ autoCount: boolean; copyField: boolean; copyFieldName: string; firstCopyAsk: boolean; dupcheck: boolean }>({ autoCount: false, copyField: false, copyFieldName: '', firstCopyAsk: false, dupcheck: false })
  /** 当前模板的磁盘保存路径（用于序列号回写 / 模板库静默保存） */
  const [docPath, setDocPath] = useState<string | null>(null)
  const [cursor, setCursor] = useState('0.00, 0.00 毫米')
  const [recents, setRecents] = useState<Array<{ name: string; path?: string }>>(() => readRecents())
  /** 本机模板库（开始页模板库卡片区） */
  const [libTemplates, setLibTemplates] = useState<LibItem[]>([])
  const [options, setOptions] = useState<AppOptions>(() => loadOptions())
  const [showToolbar, setShowToolbar] = useState(true)
  const [showFormatBar, setShowFormatBar] = useState(true)
  const [showAlignBar, setShowAlignBar] = useState(true)
  const [showStatusBar, setShowStatusBar] = useState(true)
  const apiRef = useRef<EditorApi | null>(null)
  const canvasRef = useRef<fabric.Canvas | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const clipboardRef = useRef<LabelObject | null>(null)
  const historyRef = useRef<LabelDoc[]>([])
  const futureRef = useRef<LabelDoc[]>([])
  const [labelRotation, setLabelRotation] = useState<0 | 90 | 180 | 270>(0)
  const [showPrintPanel, setShowPrintPanel] = useState(true)
  const [showLayerPanel, setShowLayerPanel] = useState(true)
  const [showObjectInfo, setShowObjectInfo] = useState(true)
  const [appTheme, setAppTheme] = useState<'blue' | 'black' | 'silver' | 'aqua'>('blue')
  /** 应用程序外观（蓝色/黑色/银色/水绿色）——CSS 变量注入到根容器，各栏引用生效 */
  const themeVars = useMemo(() => {
    const themes: Record<string, Record<string, string>> = {
      blue: { '--app-accent': '#2E6E93', '--app-bar-bg': '#F6F5F2', '--app-page-bg': '#F4F3EE', '--app-bar-text': '#1A1B1C' },
      black: { '--app-accent': '#5B8DB8', '--app-bar-bg': '#3A3A3A', '--app-page-bg': '#2A2A2A', '--app-bar-text': '#E8E8E8' },
      silver: { '--app-accent': '#5A6B7A', '--app-bar-bg': '#DCDCE0', '--app-page-bg': '#ECECEE', '--app-bar-text': '#1A1B1C' },
      aqua: { '--app-accent': '#1D8E8B', '--app-bar-bg': '#D6EAE8', '--app-page-bg': '#EEF6F5', '--app-bar-text': '#1A1B1C' }
    }
    return themes[appTheme]
  }, [appTheme])
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; hasSelection: boolean; selectionCount: number } | null>(null)

  const activeTab = useMemo(() => tabs.find((t) => t.key === active) ?? tabs[0], [tabs, active])
  const isStart = active === START

  const patchTab = useCallback((key: string, patch: (t: DocTab) => DocTab) => {
    setTabs((ts) => ts.map((t) => (t.key === key ? patch(t) : t)))
  }, [])

  const setActiveDoc = useCallback(
    (fn: (d: LabelDoc) => LabelDoc) => {
      patchTab(active, (t) => ({ ...t, doc: fn(t.doc) }))
    },
    [active, patchTab]
  )

  const doc = activeTab?.doc
  const selectedObj = !isStart && doc ? doc.objects.find((o) => o.id === activeTab.selectedId) ?? null : null
  const printer = doc?.printer ?? defaultPrinterConfig()

  const pushHistory = useCallback(
    (before: LabelDoc) => {
      historyRef.current = [...historyRef.current.slice(-49), JSON.parse(JSON.stringify(before)) as LabelDoc]
      futureRef.current = []
    },
    []
  )

  // ---------- 文档操作 ----------
  const buildObject = useCallback((type: ObjType | 'diagonal' | 'data', x: number, y: number): LabelObject | null => {
    const id = uid()
    const base = { id, type, x, y, w: 40, h: 8, rotation: 0 }
    switch (type) {
      case 'text':
        return { ...base, type: 'text', fontFamily: '微软雅黑', fontSize: 4, bold: false, align: 'center', color: '#000000', source: { kind: 'constant', value: '文字内容' } }
      case 'data':
        return { ...base, type: 'text', w: 44, h: 8, fontFamily: '微软雅黑', fontSize: 4, bold: false, align: 'center', color: '#000000', source: { kind: 'constant', value: '数据字段' } }
      case 'barcode':
        return { ...base, type: 'barcode', w: 44, h: 12, symbology: 'code128', showText: true, source: { kind: 'constant', value: '1234567890' } }
      case 'rfid':
        return { ...base, type: 'rfid', w: 44, h: 10, bank: 'EPC', source: { kind: 'serial', prefix: 'E2', start: 1, step: 1, digits: 8, current: 1 }, lock: false, accessPwd: '00000000', killPwd: '00000000' }
      case 'rect':
        return { ...base, type: 'rect', fill: '#ffffff', stroke: '#000000', strokeWidth: 0.3 }
      case 'ellipse':
        return { ...base, type: 'ellipse', fill: '#ffffff', stroke: '#000000', strokeWidth: 0.3 }
      case 'table':
        return { ...base, type: 'table', w: 44, h: 24, rows: 3, cols: 2, borderWidth: 0.3, borderColor: '#000000' }
      case 'line':
        return { ...base, type: 'line', w: 30, h: 0, stroke: '#000000', strokeWidth: 0.3 }
      case 'diagonal':
        return { ...base, type: 'line', w: 30, h: 8, stroke: '#000000', strokeWidth: 0.3 }
      case 'image':
        return null
    }
    return null
  }, [])

  const appendObject = useCallback(
    (obj: LabelObject) => {
      setActiveDoc((d) => {
        pushHistory(d)
        return { ...d, objects: [...d.objects, obj] }
      })
      patchTab(active, (t) => ({ ...t, selectedId: obj.id, tool: 'select' }))
      setStatus('已添加对象')
    },
    [active, setActiveDoc, patchTab, pushHistory]
  )

  const addObject = useCallback(
    (type: ObjType | 'diagonal') => {
      if (type === 'image') {
        fileInputRef.current?.click()
        return
      }
      const obj = buildObject(type, 8, 8)
      if (obj) appendObject(obj)
    },
    [buildObject, appendObject]
  )

  const handleTool = useCallback(
    (t: string) => {
      if (t === 'data') {
        patchTab(active, (tab) => ({ ...tab, tool: 'data' }))
        setStatus('数据工具：点击画布上的文字/条码/RFID 对象以修改其数据')
        return
      }
      if (t === 'image') {
        patchTab(active, (tab) => ({ ...tab, tool: 'select' }))
        fileInputRef.current?.click()
        return
      }
      patchTab(active, (tab) => ({ ...tab, tool: t }))
      setStatus(t === 'select' ? '选择工具' : '请在画布上点击以放置对象（' + t + '）')
    },
    [active, patchTab]
  )

  const handleCreateAt = useCallback(
    (type: string, mmX: number, mmY: number) => {
      const obj = buildObject(type as ObjType | 'diagonal', mmX, mmY)
      if (obj) {
        appendObject(obj)
        if (type === 'data') {
          setPropsTab('datasource')
          setModal('changedata')
        }
      } else if (type === 'image') fileInputRef.current?.click()
    },
    [buildObject, appendObject]
  )

  /** 拖拽绘制：以指定 mm 坐标和尺寸创建对象 */
  const handleCreateRect = useCallback(
    (type: string, mmX: number, mmY: number, mmW: number, mmH: number) => {
      const obj = buildObject(type as ObjType | 'diagonal', mmX, mmY)
      if (obj) {
        obj.w = round2(mmW)
        obj.h = round2(mmH)
        // 文字/条码最小高度约束
        if (obj.type === 'text' && obj.h < 3) obj.h = 3
        if (obj.type === 'barcode' && obj.h < 5) obj.h = 5
        if (obj.type === 'line') obj.h = 0
        appendObject(obj)
      } else if (type === 'image') {
        fileInputRef.current?.click()
      }
    },
    [buildObject, appendObject]
  )

  /** 画布右键菜单回调 */
  const handleContextMenu = useCallback(
    (x: number, y: number, hasSelection: boolean, selectionCount: number) => {
      setContextMenu({ visible: true, x, y, hasSelection, selectionCount })
    },
    []
  )

  /** 双击对象 → 确保属性面板可见并聚焦 */
  const handleDoubleClick = useCallback(
    (objId: string) => {
      patchTab(active, (t) => ({ ...t, selectedId: objId }))
      setModal('props')
    },
    [active, patchTab]
  )

  const handleAddImage = useCallback(() => fileInputRef.current?.click(), [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const id = uid()
      const obj: LabelObject = { id, type: 'image', x: 10, y: 10, w: 40, h: 30, rotation: 0, src: String(reader.result) }
      setActiveDoc((d) => ({ ...d, objects: [...d.objects, obj] }))
      patchTab(active, (t) => ({ ...t, selectedId: id }))
      setStatus('图片已添加')
    }
    reader.readAsDataURL(f)
    e.target.value = ''
  }

  const updateObject = useCallback(
    (id: string, patch: Partial<LabelObject>) => {
      setActiveDoc((d) => ({
        ...d,
        objects: d.objects.map((o) => {
          if (o.id !== id) return o
          let merged = { ...o, ...patch } as LabelObject
          // 组合对象位置移动时同步平移子对象
          if (o.type === 'group' && 'x' in patch && typeof patch.x === 'number') {
            const dx = patch.x - o.x
            merged = { ...merged, children: (merged as GroupObj).children.map((c) => ({ ...c, x: round2(c.x + dx) })) } as LabelObject
          }
          if (o.type === 'group' && 'y' in patch && typeof patch.y === 'number') {
            const dy = patch.y - o.y
            merged = { ...merged, children: (merged as GroupObj).children.map((c) => ({ ...c, y: round2(c.y + dy) })) } as LabelObject
          }
          return merged
        })
      }))
    },
    [setActiveDoc]
  )

  const handleSync = useCallback(
    (objs: LabelObject[]) => {
      setActiveDoc((d) => {
        pushHistory(d)
        return { ...d, objects: objs }
      })
    },
    [setActiveDoc, pushHistory]
  )

  const enterpriseRoleRef = useRef('admin')
  const [enterpriseRole, setEnterpriseRole] = useState<string>('admin')
  useEffect(() => {
    void (async () => {
      try {
        const s = await window.maxlabel.enterprise.status()
        if (s.ok && s.role) {
          enterpriseRoleRef.current = s.role
          setEnterpriseRole(s.role)
        }
      } catch {
        /* 忽略 */
      }
    })()
  }, [])
  // 首启引导：第一次启动自动打开「新手入门」向导
  useEffect(() => {
    try {
      if (!localStorage.getItem('maxlabel.firstRun')) {
        localStorage.setItem('maxlabel.firstRun', '1')
        setModal('getstarted')
      }
    } catch {
      /* 忽略 */
    }
  }, [])
  const canEdit = enterpriseRole !== 'viewer'
  void canEdit

  const deleteObject = useCallback(
    (id: string) => {
      if (enterpriseRoleRef.current === 'viewer') {
        setStatus('企业版查看者：无编辑权限')
        return
      }
      setActiveDoc((d) => {
        pushHistory(d)
        return { ...d, objects: d.objects.filter((o) => o.id !== id) }
      })
      patchTab(active, (t) => (t.selectedId === id ? { ...t, selectedId: null } : t))
      setStatus('已删除对象')
    },
    [active, setActiveDoc, patchTab, pushHistory]
  )

  /** 删除多个选中对象（Delete 键/右键删除在框选或多选时删除全部选中，对齐原版） */
  const deleteObjects = useCallback(
    (ids: string[]) => {
      if (enterpriseRoleRef.current === 'viewer') {
        setStatus('企业版查看者：无编辑权限')
        return
      }
      if (!ids.length) {
        setStatus('请先选中对象')
        return
      }
      const idSet = new Set(ids)
      setActiveDoc((d) => {
        pushHistory(d)
        return { ...d, objects: d.objects.filter((o) => !idSet.has(o.id)) }
      })
      patchTab(active, (t) => (t.selectedId && idSet.has(t.selectedId) ? { ...t, selectedId: null } : t))
      setStatus(ids.length > 1 ? `已删除 ${ids.length} 个对象` : '已删除对象')
    },
    [active, setActiveDoc, patchTab, pushHistory]
  )

  const toggleVisible = useCallback(
    (id: string) => {
      setActiveDoc((d) => {
        pushHistory(d)
        return { ...d, objects: d.objects.map((o) => (o.id === id ? { ...o, visible: o.visible === false ? true : false } : o)) }
      })
    },
    [setActiveDoc, pushHistory]
  )

  const reorderObject = useCallback(
    (id: string, dir: -1 | 1) => {
      setActiveDoc((d) => {
        const arr = [...d.objects]
        const i = arr.findIndex((o) => o.id === id)
        const j = dir === 1 ? i + 1 : i - 1
        if (i < 0 || j < 0 || j >= arr.length) return d
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
        return { ...d, objects: arr }
      })
    },
    [setActiveDoc]
  )

  const toFrontBack = useCallback(
    (id: string, front: boolean) => {
      setActiveDoc((d) => {
        const arr = [...d.objects]
        const i = arr.findIndex((o) => o.id === id)
        if (i < 0) return d
        const [o] = arr.splice(i, 1)
        if (front) arr.push(o)
        else arr.unshift(o)
        return { ...d, objects: arr }
      })
    },
    [setActiveDoc]
  )

  const undo = useCallback(() => {
    const prev = historyRef.current.pop()
    if (!prev) return
    futureRef.current.push(JSON.parse(JSON.stringify(doc)) as LabelDoc)
    setActiveDoc(() => prev)
    setStatus('已撤销')
  }, [setActiveDoc, doc])

  const redo = useCallback(() => {
    const next = futureRef.current.pop()
    if (!next) return
    historyRef.current.push(JSON.parse(JSON.stringify(doc)) as LabelDoc)
    setActiveDoc(() => next)
    setStatus('已重做')
  }, [setActiveDoc, doc])

  const selectAll = useCallback(() => {
    const fc = canvasRef.current
    if (!fc) return
    const objs = fc.getObjects().filter((x: any) => !String(x.dataId).startsWith('__'))
    if (!objs.length) return
    fc.discardActiveObject()
    fc.setActiveObject(new fabric.ActiveSelection(objs, { canvas: fc }))
    fc.requestRenderAll()
  }, [])

  const clearSelection = useCallback(() => {
    const fc = canvasRef.current
    if (fc) {
      fc.discardActiveObject()
      fc.requestRenderAll()
    }
    patchTab(active, (t) => ({ ...t, selectedId: null }))
  }, [active, patchTab])

  const copySelected = useCallback(() => {
    if (!selectedObj) return
    clipboardRef.current = JSON.parse(JSON.stringify(selectedObj)) as LabelObject
    setStatus('已复制对象')
  }, [selectedObj])

  const pasteClipboard = useCallback(() => {
    const src = clipboardRef.current
    if (!src) return
    const copy = JSON.parse(JSON.stringify(src)) as LabelObject
    copy.id = uid()
    copy.x += 1
    copy.y += 1
    setActiveDoc((d) => ({ ...d, objects: [...d.objects, copy] }))
    patchTab(active, (t) => ({ ...t, selectedId: copy.id }))
    setStatus('已粘贴对象')
  }, [active, setActiveDoc, patchTab])

  const handleCut = useCallback(() => {
    if (!selectedObj) return
    clipboardRef.current = JSON.parse(JSON.stringify(selectedObj)) as LabelObject
    deleteObject(selectedObj.id)
    setStatus('已剪切对象')
  }, [selectedObj, deleteObject])

  // ---------- 对齐栏：选中对象变换 ----------
  /** 读取画布上当前选中的（非背景/网格）对象 id */
  const selectedIds = useCallback((): string[] => {
    const fc = canvasRef.current
    if (fc) {
      const ids = fc
        .getActiveObjects()
        .filter((x: any) => !String(x.dataId).startsWith('__'))
        .map((x: any) => x.dataId)
      if (ids.length) return ids
    }
    // 回退：React 侧单选（图层面板 / 双击 / 右键自动选中 不同步 fabric 时）
    const sid = activeTab?.selectedId
    return sid ? [sid] : []
  }, [activeTab?.selectedId])

  /** 对选中的对象应用变换（mm 坐标），并写回模型 */
  const transformSelected = useCallback(
    (fn: (objs: LabelObject[]) => LabelObject[]) => {
      const ids = new Set(selectedIds())
      if (!ids.size) {
        setStatus('请先选中对象')
        return
      }
      setActiveDoc((d) => {
        pushHistory(d)
        const sel = d.objects.filter((o) => ids.has(o.id))
        if (!sel.length) return d
        const mapped = fn(sel)
        const byId = new Map(mapped.map((o) => [o.id, o]))
        return { ...d, objects: d.objects.map((o) => byId.get(o.id) ?? o) }
      })
    },
    [selectedIds, setActiveDoc, pushHistory]
  )

  const handleAlign = useCallback(
    (mode: AlignMode) => {
      // 优先在 fabric 画布上按实际选择框对齐（保证文字/条码等内容在框内居中时也能精确对齐）
      if (apiRef.current?.alignSelected) {
        apiRef.current.alignSelected(mode)
        setStatus('已对齐')
        return
      }
      transformSelected((sel) => {
        const minX = Math.min(...sel.map((o) => o.x))
        const minY = Math.min(...sel.map((o) => o.y))
        const maxX = Math.max(...sel.map((o) => o.x + o.w))
        const maxY = Math.max(...sel.map((o) => o.y + o.h))
        const cx = (minX + maxX) / 2
        const cy = (minY + maxY) / 2
        return sel.map((o) => {
          const n = { ...o }
          if (mode === 'left') n.x = minX
          else if (mode === 'top') n.y = minY
          else if (mode === 'right') n.x = maxX - o.w
          else if (mode === 'bottom') n.y = maxY - o.h
          else if (mode === 'midV') n.x = cx - o.w / 2
          else if (mode === 'midH') n.y = cy - o.h / 2
          return n
        })
      })
      setStatus('已对齐')
    },
    [transformSelected]
  )

  const handleRotate = useCallback(
    (deg: RotateMode) => {
      // 优先通过 fabric 画布编程式旋转：自动维护锚点位置、防全量重建、保持选中
      if (apiRef.current?.rotateSelected) {
        apiRef.current.rotateSelected(deg)
        setStatus(`已旋转 ${deg}°`)
        return
      }
      transformSelected((sel) => sel.map((o) => ({ ...o, rotation: round2(((o.rotation ?? 0) + deg) % 360) })))
      setStatus(`已旋转 ${deg}°`)
    },
    [transformSelected]
  )

  const handleSame = useCallback(
    (mode: SameMode) => {
      transformSelected((sel) => {
        const maxW = Math.max(...sel.map((o) => o.w))
        const maxH = Math.max(...sel.map((o) => o.h))
        return sel.map((o) => {
          const n = { ...o }
          if (mode === 'w' || mode === 'wh') n.w = maxW
          if (mode === 'h' || mode === 'wh') n.h = maxH
          return n
        })
      })
      setStatus('已统一尺寸')
    },
    [transformSelected]
  )

  const handleCenter = useCallback(
    (mode: CenterMode) => {
      if (!doc) return
      transformSelected((sel) =>
        sel.map((o) => {
          const n = { ...o }
          if (mode === 'h') n.x = (doc.widthMm - o.w) / 2
          else n.y = (doc.heightMm - o.h) / 2
          return n
        })
      )
      setStatus(mode === 'h' ? '水平居中（相对标签）' : '垂直居中（相对标签）')
    },
    [transformSelected, doc]
  )

  const handleDist = useCallback(
    (mode: DistMode) => {
      transformSelected((sel) => {
        if (sel.length < 3) return sel
        const centers = sel.map((o) => ({ x: o.x + o.w / 2, y: o.y + o.h / 2 }))
        const axis = mode === 'h'
        const sorted = [...centers].sort((a, b) => (axis ? a.x - b.x : a.y - b.y))
        const first = sorted[0]
        const last = sorted[sorted.length - 1]
        const step = (axis ? last.x - first.x : last.y - first.y) / (sel.length - 1)
        const byCenterKey = new Map(sel.map((o) => [(o.x + o.w / 2).toFixed(3) + '|' + (o.y + o.h / 2).toFixed(3), o]))
        return sel.map((o) => {
          const key = (o.x + o.w / 2).toFixed(3) + '|' + (o.y + o.h / 2).toFixed(3)
          const idx = sorted.findIndex((c) => (c.x.toFixed(3) + '|' + c.y.toFixed(3)) === key)
          if (idx < 0) return o
          const n = { ...o }
          if (axis) n.x = first.x + step * idx - o.w / 2
          else n.y = first.y + step * idx - o.h / 2
          return n
        })
      })
      setStatus(mode === 'h' ? '水平间距相同' : '垂直间距相同')
    },
    [transformSelected]
  )

  const handleOrder = useCallback(
    (mode: OrderMode) => {
      const ids = new Set(selectedIds())
      if (!ids.size) {
        setStatus('请先选中对象')
        return
      }
      setActiveDoc((d) => {
        pushHistory(d)
        const sel = d.objects.filter((o) => ids.has(o.id))
        const rest = d.objects.filter((o) => !ids.has(o.id))
        let arr: LabelObject[]
        if (mode === 'front') arr = [...rest, ...sel]
        else if (mode === 'back') arr = [...sel, ...rest]
        else if (mode === 'forward') {
          // 上移一层：与上方的非选中对象交换
          const withIdx = d.objects.map((o, i) => ({ o, i }))
          const selIdx = new Set(withIdx.filter((x) => ids.has(x.o.id)).map((x) => x.i))
          const next = [...d.objects]
          for (let i = next.length - 2; i >= 0; i--) {
            if (selIdx.has(i) && !selIdx.has(i + 1)) {
              ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
            }
          }
          arr = next
        } else {
          const withIdx = d.objects.map((o, i) => ({ o, i }))
          const selIdx = new Set(withIdx.filter((x) => ids.has(x.o.id)).map((x) => x.i))
          const next = [...d.objects]
          for (let i = 1; i < next.length; i++) {
            if (selIdx.has(i) && !selIdx.has(i - 1)) {
              ;[next[i], next[i - 1]] = [next[i - 1], next[i]]
            }
          }
          arr = next
        }
        return { ...d, objects: arr }
      })
      setStatus('已调整对象顺序')
    },
    [selectedIds, setActiveDoc, pushHistory]
  )

  const handleSnap = useCallback(
    (edge: SnapEdge) => {
      if (!doc) return
      transformSelected((sel) =>
        sel.map((o) => {
          const n = { ...o }
          if (edge === 'top') n.y = 0
          else if (edge === 'left') n.x = 0
          else if (edge === 'right') n.x = doc.widthMm - o.w
          else if (edge === 'bottom') n.y = doc.heightMm - o.h
          return n
        })
      )
      setStatus('已移动到标签边缘')
    },
    [transformSelected, doc]
  )

  // ---------- 组合 / 取消组合 ----------
  const handleGroup = useCallback(() => {
    const ids = selectedIds()
    if (ids.length < 2) {
      setStatus('组合需要选中至少 2 个对象（按住 Ctrl 多选或全选）')
      return
    }
    const gid = uid()
    setActiveDoc((d) => {
      pushHistory(d)
      const sel = d.objects.filter((o) => ids.includes(o.id))
      if (sel.length < 2) return d
      if (sel.some((o) => o.type === 'group')) {
        setStatus('暂不支持嵌套组合')
        return d
      }
      const minX = Math.min(...sel.map((o) => o.x))
      const minY = Math.min(...sel.map((o) => o.y))
      const maxX = Math.max(...sel.map((o) => o.x + o.w))
      const maxY = Math.max(...sel.map((o) => o.y + o.h))
      const group: GroupObj = {
        id: gid,
        type: 'group',
        x: round2((minX + maxX) / 2),
        y: round2((minY + maxY) / 2),
        w: round2(maxX - minX),
        h: round2(maxY - minY),
        rotation: 0,
        children: sel.map((o) => ({ ...o }))
      }
      const rest = d.objects.filter((o) => !ids.includes(o.id))
      return { ...d, objects: [...rest, group] }
    })
    patchTab(active, (t) => ({ ...t, selectedId: gid }))
    setStatus('已组合 ' + ids.length + ' 个对象')
  }, [selectedIds, setActiveDoc, patchTab, active, pushHistory])

  const handleUngroup = useCallback(() => {
    const ids = selectedIds()
    if (!ids.length) {
      setStatus('请先选中组合对象')
      return
    }
    setActiveDoc((d) => {
      pushHistory(d)
      let changed = false
      const out: LabelObject[] = []
      for (const o of d.objects) {
        if (ids.includes(o.id) && o.type === 'group') {
          out.push(...o.children)
          changed = true
        } else out.push(o)
      }
      return changed ? { ...d, objects: out } : d
    })
    patchTab(active, (t) => ({ ...t, selectedId: null }))
    setStatus('已取消组合')
  }, [selectedIds, setActiveDoc, patchTab, active, pushHistory])

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
      patchTab(active, (t) => ({ ...t, zoom: Math.max(0.25, Math.min(4, z)) }))
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
      const PX = 10
      const availW = Math.max(120, window.innerWidth - 200 - 260 - 96)
      const availH = Math.max(120, window.innerHeight - 260)
      const zw = availW / (doc.widthMm * PX)
      const zh = availH / (doc.heightMm * PX)
      const z = mode === 'w' ? zw : mode === 'h' ? zh : Math.min(zw, zh)
      setZoomBy(Math.round(z * 100) / 100)
      setStatus(mode === 'win' ? '已撑满窗口' : mode === 'w' ? '已适应宽度' : '已适应高度')
    },
    [doc, setZoomBy]
  )

  // ---------- 模板 ----------
  const addRecent = useCallback((name: string, path?: string) => {
    setRecents((r) => {
      const next = [{ name, path }, ...r.filter((x) => x.name !== name)].slice(0, 10)
      localStorage.setItem(recentsKey, JSON.stringify(next))
      return next
    })
  }, [])

  const openDoc = useCallback((d: LabelDoc, title?: string) => {
    const key = uid()
    const name = title ?? d.name ?? '未命名标签'
    setTabs((ts) => [...ts, { key, title: name, doc: d, selectedId: null, count: 1, copies: 1, datasetName: '', zoom: 1, tool: 'select', recordIdx: 0, startLabel: 1 }])
    setActive(key)
    setSelectedIn(key, null)
    addRecent(name)
  }, [addRecent])

  function setSelectedIn(key: string, sel: string | null) {
    patchTab(key, (t) => ({ ...t, selectedId: sel }))
  }

  const handleNewFromDialog = (w: number, h: number) => {
    const b = blankTemplate()
    b.widthMm = w
    b.heightMm = h
    const n = tabs.length
    openDoc(b, `新标签模板${n + 1}`)
    setModal(null)
    setDocPath(null)
    setStatus(`已新建标签：${w} × ${h} mm`)
  }

  const handleOpen = async () => {
    try {
      const r = await window.maxlabel.openTemplate()
      if (r.canceled || !r.content) return
      const filePath = r.filePath ?? ''
      let d: LabelDoc
      let warnings: string[] = []
      if (filePath.toLowerCase().endsWith('.lsdx') || looksLikeLsdx(r.content)) {
        const imp = await importLsdx(r.content, filePath.split(/[\\/]/).pop() ?? '标签文件')
        d = imp.doc
        warnings = imp.warnings
      } else {
        d = fromDocJson(r.content)
      }
      if (!d || typeof d.widthMm !== 'number' || !Array.isArray(d.objects)) throw new Error('模板格式不正确')
      openDoc(
        {
          version: d.version ?? 1,
          name: d.name ?? '未命名标签',
          widthMm: d.widthMm,
          heightMm: d.heightMm,
          objects: d.objects,
          printer: d.printer ?? defaultPrinterConfig(),
          datasets: d.datasets ?? {},
          connections: d.connections,
          layout: d.layout
        },
        d.name
      )
      setStatus('已打开：' + filePath + (warnings.length ? '（' + warnings.length + ' 项提示，见底部详情）' : ''))
      if (warnings.length) {
        setImportWarnings(warnings)
        setModal('importwarn')
      }
      // LabelShop 文件不可覆盖回写：docPath 置空，保存时弹出另存为（默认 .msdx）
      setDocPath(filePath.toLowerCase().endsWith('.lsdx') || looksLikeLsdx(r.content) ? null : (filePath ?? null))
    } catch (err) {
      setStatus('打开失败：' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const handleSave = async () => {
    if (!doc) return
    if (enterpriseRoleRef.current === 'viewer') {
      setStatus('企业版查看者：无保存/编辑权限')
      return
    }
    try {
      // 已有保存路径 → 直接覆盖保存；无路径 → 弹另存对话框（与原版一致）
      const r = docPath
        ? await window.maxlabel.saveTemplateTo(docPath, toMsdx(doc))
        : await window.maxlabel.saveTemplate(toMsdx(doc), doc.name)
      if ('canceled' in r && r.canceled) return
      const fp = (r as { filePath?: string }).filePath ?? docPath
      if (fp) {
        addRecent(doc.name, fp)
        setDocPath(fp)
        setStatus('已保存：' + fp)
      }
    } catch (err) {
      setStatus('保存失败：' + (err instanceof Error ? err.message : String(err)))
    }
  }

  /** 另存为：总是弹出保存对话框（与原版一致） */
  const handleSaveAs = async () => {
    if (!doc) return
    if (enterpriseRoleRef.current === 'viewer') {
      setStatus('企业版查看者：无保存/编辑权限')
      return
    }
    try {
      const r = await window.maxlabel.saveTemplate(toMsdx(doc), doc.name)
      if (r.canceled) return
      addRecent(doc.name, r.filePath)
      setDocPath(r.filePath ?? null)
      setStatus('已另存为：' + (r.filePath ?? ''))
    } catch (err) {
      setStatus('另存为失败：' + (err instanceof Error ? err.message : String(err)))
    }
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
      let d: LabelDoc
      let warnings: string[] = []
      if (filePath.toLowerCase().endsWith('.lsdx') || looksLikeLsdx(r.content)) {
        const imp = await importLsdx(r.content, filePath.split(/[\\/]/).pop() ?? '标签文件')
        d = imp.doc
        warnings = imp.warnings
      } else {
        d = fromDocJson(r.content)
      }
      if (!d || typeof d.widthMm !== 'number' || !Array.isArray(d.objects)) throw new Error('模板格式不正确')
      openDoc(
        {
          version: d.version ?? 1,
          name: d.name ?? item.name,
          widthMm: d.widthMm,
          heightMm: d.heightMm,
          objects: d.objects,
          printer: d.printer ?? defaultPrinterConfig(),
          datasets: d.datasets ?? {},
          connections: d.connections,
          remark: d.remark,
          keyboardOrder: d.keyboardOrder,
          layout: d.layout
        },
        d.name ?? item.name
      )
      setStatus('已打开最近文件：' + filePath + (warnings.length ? '（' + warnings.length + ' 项提示）' : ''))
      if (warnings.length) {
        setImportWarnings(warnings)
        setModal('importwarn')
      }
      setDocPath(filePath.toLowerCase().endsWith('.lsdx') || looksLikeLsdx(r.content) ? null : (filePath ?? null))
    } catch (err) {
      setStatus('打开最近文件失败：' + (err instanceof Error ? err.message : String(err)))
    }
  }

  /** 刷新本机模板库列表（开始页模板库卡片区） */
  const refreshLib = useCallback(async () => {
    try {
      const r = await window.maxlabel.listTemplates()
      if (r.ok) setLibTemplates(r.items ?? [])
    } catch {
      /* 忽略模板库读取失败 */
    }
  }, [])

  /** 打开模板库/开始页模板库卡片中的模板 */
  const openLibItem = useCallback(
    async (item: LibItem) => {
      const r = await window.maxlabel.openTemplatePath(item.path)
      if (!r.ok || !r.content) {
        setStatus('打开模板失败：' + (r.message ?? ''))
        return
      }
      try {
        const d = JSON.parse(r.content) as LabelDoc
        if (!d || typeof d.widthMm !== 'number' || !Array.isArray(d.objects)) throw new Error('模板格式不正确')
        openDoc(
          {
            version: d.version ?? 1,
            name: d.name ?? item.name,
            widthMm: d.widthMm,
            heightMm: d.heightMm,
            objects: d.objects,
            printer: d.printer ?? defaultPrinterConfig(),
            datasets: d.datasets ?? {},
            connections: d.connections,
            remark: d.remark,
            keyboardOrder: d.keyboardOrder,
            layout: d.layout,
            orientation: d.orientation
          },
          d.name ?? item.name
        )
        setDocPath(item.path)
        setModal(null)
        setStatus('已从模板库打开：' + (d.name ?? item.name))
      } catch (err) {
        setStatus('模板库模板无效：' + (err instanceof Error ? err.message : String(err)))
      }
    },
    [openDoc]
  )

  const closeTab = useCallback((key: string) => {
    const cur = tabsRef.current
    const next = cur.filter((t) => t.key !== key)
    const clog = (window as unknown as { __clog?: string[] }).__clog ?? []
    clog.push('closeTab key=' + key + ' cur=' + cur.map((t) => t.key).join(',') + ' next=' + next.map((t) => t.key).join(','))
    ;(window as unknown as { __clog?: string[] }).__clog = clog
    if (next.length === cur.length) return // key 不存在
    setTabs(next)
    setActive((a) => {
      const r = a === key ? (next[0]?.key ?? START) : a
      clog.push('active ' + a + ' -> ' + r)
      ;(window as unknown as { __clog?: string[] }).__clog = clog
      return r
    })
  }, [])

  /** 关闭其他标签（保留 keep） */
  const closeOthers = useCallback((keep: string) => {
    setTabs((ts) => {
      const next = ts.filter((t) => t.key === keep)
      if (next.length === 0) {
        next.push({ key: uid(), title: '新标签模板1', doc: blankTemplate(), selectedId: null, count: 1, copies: 1, datasetName: '', zoom: 1, tool: 'select', recordIdx: 0, startLabel: 1 })
      }
      return next
    })
    setActive(keep)
  }, [])

  /** 关闭所有标签（保留起始页） */
  const closeAll = useCallback(() => {
    setTabs([])
    setActive(START)
  }, [])

  // ---------- 打印 ----------
  const handlePreview = async () => {
    if (!doc) return
    setBusy(true)
    try {
      const layout = doc.layout && (doc.layout.rows > 1 || doc.layout.cols > 1) ? doc.layout : undefined
      const hasDb = dbRecordCount > 0
      const pages = hasDb ? dbRecordCount : Math.max(1, activeTab.count)
      const urls: string[] = []
      // 单记录（无数据库且份数=1）：直接从 fabric 画布导出，保证 100% 所见即所得
      const singleRecord = !hasDb && activeTab.count <= 1
      if (singleRecord && apiRef.current?.getPreviewDataUrl) {
        const u = await apiRef.current.getPreviewDataUrl()
        if (u) urls.push(u)
      }
      if (!urls.length) {
        // 多记录/数据库：用独立渲染器（可变数据需要逐记录替换）
        for (let i = 0; i < pages; i++) {
          const ctx = graphicsCtx(doc, printer, activeTab.copies, activeTab.count, keyboardValues, hasDb ? i : activeTab.recordIdx)
          const u = await renderLabelDataUrl(doc, { dpi: printer.dpi, ctx, layout })
          if (u) urls.push(u)
        }
      }
      if (!urls.length) {
        setStatus('预览失败：未生成预览图')
        return
      }
      try {
        const ps = pageSizeMm(doc, layout)
        const r = await window.maxlabel.previewOpen({ pages: urls, widthMm: ps.widthMm, heightMm: ps.heightMm })
        if (!r.ok) setPreviewUrl(urls[0]) // 主进程失败时降级为应用内预览
      } catch {
        setPreviewUrl(urls[0]) // 异常时降级为应用内预览
      }
    } catch (err) {
      setStatus('预览失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }

  const bumpSerial = useCallback(
    (cnt: number) => {
      setActiveDoc((d) => {
        const next = { ...d, objects: d.objects.map((o) => {
          if (!('source' in o) || !o.source) return o
          const base = { ...o, source: advanceSerial(o.source, cnt) }
          const subs = 'subSources' in o && Array.isArray((o as { subSources?: Array<import('./types').DataSource> }).subSources)
            ? (o as { subSources?: Array<import('./types').DataSource> }).subSources!.map((s) => advanceSerial(s, cnt))
            : undefined
          return subs ? { ...base, subSources: subs } : base
        }) }
        // 序列号回写：模板已有保存路径时，打印后自动静默保存（不弹对话框）
        if (docPath) {
          void window.maxlabel
            .saveTemplateTo(docPath, JSON.stringify(next, null, 2))
            .then((r) => {
              if (!r.ok) console.warn('序列号回写失败', r.message)
            })
            .catch(() => {})
        }
        return next
      })
    },
    [docPath, setActiveDoc]
  )

  const logPrint = useCallback(
    async (mode: string, test: boolean, dataSnapshot?: string[]) => {
      if (!doc) return
      try {
        await window.maxlabel.logPrint({ time: new Date().toISOString(), title: doc.name, mode, count: activeTab.count, copies: activeTab.copies, test, printer: printerNameOf(printer), dataSnapshot })
      } catch {
        // 日志失败不影响打印
      }
    },
    [doc, printer, activeTab?.count, activeTab?.copies]
  )

  const collectKeyboardLabels = (d: LabelDoc): string[] => {
    const all = collectKeyboardOrdered(d)
    const saved = d.keyboardOrder ?? []
    const rest = all.filter((l) => !saved.includes(l))
    return [...saved.filter((l) => all.includes(l)), ...rest]
  }

  const refreshAutoDb = async (): Promise<string | null> => {
    if (!doc) return null
    const conns = Object.values(doc.connections ?? {})
    for (const c of conns) {
      if (!c.autoRefresh || !c.sql) continue
      const r = await window.maxlabel.db.query({ ...c, password: c.password ?? '' }, c.sql)
      if (!r.ok) return `数据库刷新失败（${c.name}）：${r.error ?? '未知错误'}`
      const name = c.datasetName ?? c.name
      if (r.rows.length) {
        const columns = Object.keys(r.rows[0])
        const rows = r.rows.map((row) => columns.map((col) => row[col] ?? ''))
        setActiveDoc((prev) => ({ ...prev, datasets: { ...(prev.datasets ?? {}), [name]: { name, columns, rows } } }))
      }
    }
    return null
  }

  const handleDbRefresh = useCallback(async () => {
    const err = await refreshAutoDb()
    setStatus(err ?? '数据库已更新')
  }, [refreshAutoDb])

  const doPrint = async (test: boolean, kv: Record<string, string>) => {
    if (!doc) return
    setBusy(true)
    setStatus(test ? '正在测试打印…' : '正在打印…')
    try {
      // —— 打印对话框数据库高级选项（对标原版 print_dlg_dbs）——
      const dsRows = (() => {
        const nm = activeTab.datasetName && doc.datasets?.[activeTab.datasetName] ? activeTab.datasetName : Object.keys(doc.datasets ?? {})[0]
        return nm ? (doc.datasets?.[nm]?.rows ?? []) : []
      })()
      const dsCols = (() => {
        const nm = activeTab.datasetName && doc.datasets?.[activeTab.datasetName] ? activeTab.datasetName : Object.keys(doc.datasets ?? {})[0]
        return nm ? (doc.datasets?.[nm]?.columns ?? []) : []
      })()
      // 打印数据快照：每张标签全部对象内容（写入打印日志，专业版"打印数据项目"）
      const snapDs = activeTab.datasetName && doc.datasets?.[activeTab.datasetName] ? activeTab.datasetName : Object.keys(doc.datasets ?? {})[0]
      const snapData = (n: number): string[] => {
        const arr: string[] = []
        for (let i = 0; i < n; i++) {
          const c = {
            labelIndex: i + 1, recordIndex: i, copy: pcopies, count: pcount, totalLabels: pcount * pcopies,
            title: doc.name, printerName: printerNameOf(printer), datasets: doc.datasets ?? {}, sharedVars: {},
            keyboardValues: kv, recordRow: dsRows[i], activeDataset: snapDs
          }
          arr.push(doc.objects.map((o) => resolveObjectText(o as never, c as never)).join(' | '))
        }
        return arr
      }
      // 自动设置数据库记录数量：打印数量 = 当前记录起到末尾的记录数
      const pcount = test ? 1 : (dbAdv.autoCount && dbRecordCount > 0 ? Math.max(1, dbRecordCount - activeTab.recordIdx) : activeTab.count)
      // 允许打印时输入第一个标签的拷贝数量（取消则中止打印）
      let firstCopies: number | null = null
      if (!test && dbAdv.firstCopyAsk) {
        const v = window.prompt('请输入第一个标签的拷贝数量：', String(activeTab.copies))
        if (v === null) {
          setStatus('已取消打印')
          return
        }
        firstCopies = Math.max(1, parseInt(v.trim() || '1', 10) || 1)
      }
      // 拷贝数量从数据库字段引入（driver 逐记录时各记录取各自字段值）
      let pcopies = test ? 1 : activeTab.copies
      if (!test && dbAdv.copyField && dbAdv.copyFieldName && dsRows[activeTab.recordIdx] != null) {
        const colIdx = dsCols.indexOf(dbAdv.copyFieldName)
        const fv = colIdx >= 0 ? Number(dsRows[activeTab.recordIdx][colIdx]) : NaN
        if (!Number.isNaN(fv) && fv >= 1) pcopies = Math.floor(fv)
      }
      if (firstCopies) pcopies = firstCopies
      if (!test) {
        const dbErr = await refreshAutoDb()
        if (dbErr) {
          setStatus(dbErr)
          return
        }
      }
      const ctx: DataCtx = {
        labelIndex: 1,
        recordIndex: activeTab.recordIdx,
        copy: pcopies,
        count: pcount,
        totalLabels: pcount * pcopies,
        title: doc.name,
        printerName: printerNameOf(printer),
        datasets: doc.datasets ?? {},
        sharedVars: {},
        keyboardValues: kv,
        recordRow: dsRows[activeTab.recordIdx],
        activeDataset: activeTab.datasetName && doc.datasets?.[activeTab.datasetName] ? activeTab.datasetName : Object.keys(doc.datasets ?? {})[0]
      }
      if (printer.port.type === 'driver') {
        const layout = doc.layout && (doc.layout.rows > 1 || doc.layout.cols > 1) ? doc.layout : undefined
        const ps = pageSizeMm(doc, layout)
        // 数据库多记录：逐记录出图并依次发送（每张弹系统打印对话框）；否则单页输出
        const recCount = dbRecordCount > 0 ? dbRecordCount : 1
        const driverTimes = test ? 1 : (dbRecordCount > 0 ? Math.min(pcount, recCount) : pcount)
        const seenSet = new Set<string>()
        for (let i = 0; i < driverTimes; i++) {
          // 字段引入拷贝：逐记录取各自字段值
          let perCopy = pcopies
          if (dbRecordCount > 0 && dbAdv.copyField && dbAdv.copyFieldName && dsRows[activeTab.recordIdx + i] != null) {
            const colIdx = dsCols.indexOf(dbAdv.copyFieldName)
            const fv = colIdx >= 0 ? Number(dsRows[activeTab.recordIdx + i][colIdx]) : NaN
            if (!Number.isNaN(fv) && fv >= 1) perCopy = Math.floor(fv)
          }
          if (!test && dbAdv.firstCopyAsk && i === 0 && firstCopies) perCopy = firstCopies
          const dctx = dbRecordCount > 0
            ? { ...ctx, recordIndex: activeTab.recordIdx + i, labelIndex: i + 1, copy: perCopy, totalLabels: pcount * perCopy }
            : { ...ctx, labelIndex: i + 1, copy: perCopy, totalLabels: pcount * perCopy }
          // 打印时数据查重：相同内容跳过（仅数据库逐记录时生效）
          if (!test && dbAdv.dupcheck && dbRecordCount > 0) {
            let fp = ''
            try {
              fp = doc.objects.map((o) => resolveObjectText(o as never, dctx)).join('|')
            } catch {
              fp = String(i)
            }
            if (seenSet.has(fp)) continue
            seenSet.add(fp)
          }
          // 单记录驱动打印：直接从 fabric 画布导出，保证 100% 所见即所得
          let url = ''
          if (dbRecordCount === 0 && apiRef.current?.getPrintDataUrl) {
            url = await apiRef.current.getPrintDataUrl()
          }
          if (!url) {
            url = await renderLabelDataUrl(doc, { dpi: printer.dpi, ctx: dctx, layout })
          }
          if (!url) {
            setStatus('打印失败：无法渲染标签')
            return
          }
          const r = await window.maxlabel.printLabel({ dataUrl: url, widthMm: ps.widthMm, heightMm: ps.heightMm })
          if (!r.ok) {
            setStatus(`驱动打印未完成（第 ${i + 1}/${driverTimes} 张）`)
            return
          }
        }
        if (!test) bumpSerial(driverTimes)
        if (!test) await logPrint('driver', test, snapData(driverTimes))
        setStatus(`驱动打印已发送（${driverTimes} 张 × ${pcopies}）${dbRecordCount > 0 ? '· 数据库逐记录' : ''}${test ? '· 测试打印不计日志、不推进序列号' : ''}`)
      } else {
        const imagesByLabel = await prepareImagesByLabel(doc, printer, pcount, pcopies, kv)
        const cmdLayout = doc.layout && doc.layout.rows > 1 && doc.layout.cols > 1 ? { rows: doc.layout.rows, cols: doc.layout.cols } : undefined
        const res = buildCommands(doc, printer, {
          count: pcount,
          copy: pcopies,
          title: doc.name,
          datasets: doc.datasets ?? {},
          sharedVars: {},
          keyboardValues: kv,
          imagesByLabel,
          layout: cmdLayout
        })
        if (!res.segments.length) {
          setStatus('打印失败：生成的指令为空')
          return
        }
        const r = await window.maxlabel.printCommand({ segments: res.segments, encoding: printer.port.encoding, port: printer.port })
        if (!r.ok) {
          setStatus('打印失败：' + (r.message ?? '未知错误'))
          return
        }
        if (!test) bumpSerial(pcount)
        if (!test) await logPrint('command', test, snapData(pcount))
        const warn = res.warnings.length ? '（提示：' + res.warnings[0] + '）' : ''
        setStatus((r.message ?? '已发送') + ' · ' + res.labelCount + ' 张' + warn + (test ? '· 测试打印不计日志、不推进序列号' : ''))
      }
    } catch (err) {
      setStatus('打印失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }

  const handlePrint = (test: boolean) => {
    if (!doc) return
    const labels = collectKeyboardLabels(doc)
    if (labels.length) {
      setKeyboardDraft({ labels, isTest: test })
      return
    }
    void doPrint(test, keyboardValues)
  }

  const handleKeyboardSubmit = (vals: Record<string, string>) => {
    const t = keyboardDraft?.isTest ?? false
    setKeyboardValues(vals)
    setKeyboardDraft(null)
    void doPrint(t, vals)
  }

  const handleLabelSize = (w: number, h: number) => {
    setActiveDoc((d) => ({ ...d, widthMm: w, heightMm: h }))
    setStatus(`标签尺寸：${w} × ${h} mm`)
  }

  const handlePrinterSave = (p: PrinterConfig) => {
    setActiveDoc((d) => ({ ...d, printer: p }))
    setStatus('打印机设置已保存（随模板保存）')
  }

  /** 导出打印机指令文件（文件 → 导出打印机指令文件） */
  const handleExportCommand = async () => {
    if (!doc) return
    setBusy(true)
    try {
      const imagesByLabel = await prepareImagesByLabel(doc, printer, 1, 1, keyboardValues)
      const res = buildCommands(doc, printer, {
        count: 1,
        copy: 1,
        title: doc.name,
        datasets: doc.datasets ?? {},
        sharedVars: {},
        keyboardValues,
        imagesByLabel
      })
      if (!res.segments.length) {
        setStatus('导出失败：生成的指令为空')
        return
      }
      const r = await window.maxlabel.printCommand({
        segments: res.segments,
        encoding: printer.port.encoding,
        port: { type: 'file', encoding: printer.port.encoding }
      })
      setStatus(r.ok ? (r.message ?? '指令文件已导出') : '导出失败：' + (r.message ?? '未知错误'))
    } catch (err) {
      setStatus('导出失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
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
    setActiveDoc((d) => ({ ...d, datasets: {}, connections: {} }))
    setStatus('已删除当前模板的全部数据库')
  }

  /** 注销（账户 → 注销） */
  const handleLogout = () => {
    const had = !!localStorage.getItem('maxlabel_cloud_token')
    localStorage.removeItem('maxlabel_cloud_token')
    localStorage.removeItem('maxlabel_cloud_email')
    setStatus(had ? '已注销登录' : '当前未登录')
  }

  const handleDataImport = (d: Dataset) => {
    setActiveDoc((prev) => {
      let name = d.name
      let k = 2
      while (prev.datasets?.[name]) name = `${d.name}(${k++})`
      return { ...prev, datasets: { ...(prev.datasets ?? {}), [name]: d } }
    })
    setStatus('数据集已导入：' + d.name + '（' + d.rows.length + ' 行）')
  }

  const handleDataDelete = (name: string) => {
    setActiveDoc((prev) => {
      const datasets = { ...(prev.datasets ?? {}) }
      delete datasets[name]
      const objects = prev.objects.map((o) => {
        if ('source' in o && o.source && o.source.kind === 'database' && o.source.dataset === name) {
          return { ...o, source: { kind: 'constant' as const, value: '' } } as LabelObject
        }
        return o
      })
      return { ...prev, datasets, objects }
    })
    setStatus('已删除数据集：' + name)
  }

  const handleImportReplace = (name: string, d: Dataset) => {
    setActiveDoc((prev) => ({ ...prev, datasets: { ...(prev.datasets ?? {}), [name]: d } }))
  }

  const handleConnectionSave = (conn: DbConnectionConfig) => {
    setActiveDoc((prev) => ({ ...prev, connections: { ...(prev.connections ?? {}), [conn.id]: conn } }))
  }

  const handleConnectionDelete = (id: string) => {
    setActiveDoc((prev) => {
      const connections = { ...(prev.connections ?? {}) }
      delete connections[id]
      return { ...prev, connections }
    })
  }

  // ---------- 位置锁定 ----------
  const handleLockToggle = useCallback(() => {
    const ids = selectedIds()
    if (!ids.length) {
      setStatus('请先选中对象')
      return
    }
    setActiveDoc((d) => {
      pushHistory(d)
      return {
        ...d,
        objects: d.objects.map((o) => {
          if (!ids.includes(o.id)) return o
          const locked = (o as any).locked === true
          return { ...o, locked: !locked } as unknown as LabelObject
        })
      }
    })
    setStatus('已切换位置锁定')
  }, [selectedIds, setActiveDoc, pushHistory])

  // ---------- 键盘移动选中对象 ----------
  const moveSelectedBy = useCallback(
    (dx: number, dy: number) => {
      const ids = selectedIds()
      if (!ids.length) return
      setActiveDoc((d) => {
        pushHistory(d)
        return {
          ...d,
          objects: d.objects.map((o) => {
            if (!ids.includes(o.id)) return o
            return { ...o, x: round2(o.x + dx), y: round2(o.y + dy) }
          })
        }
      })
    },
    [selectedIds, setActiveDoc, pushHistory]
  )

  // ---------- 菜单 ----------
  const menuSections: MenuSection[] = useMemo(() => {
    const noObj = isStart || !selectedObj
    const hasDb = !isStart && !!doc && Object.keys(doc.datasets ?? {}).length > 0

    // 排列 → 对齐子菜单（12项+分隔线）
    const alignChildren: MenuItem[] = [
      { label: '左对齐', action: () => handleAlign('left'), disabled: noObj },
      { label: '右对齐', action: () => handleAlign('right'), disabled: noObj },
      { label: '上对齐', action: () => handleAlign('top'), disabled: noObj },
      { label: '下对齐', action: () => handleAlign('bottom'), disabled: noObj },
      { label: '垂直中齐', action: () => handleAlign('midV'), disabled: noObj },
      { label: '水平中齐', action: () => handleAlign('midH'), disabled: noObj },
      { divider: true, label: '' },
      { label: '水平居中', action: () => handleCenter('h'), disabled: noObj },
      { label: '垂直居中', action: () => handleCenter('v'), disabled: noObj },
      { label: '标签顶部', action: () => handleSnap('top'), disabled: noObj },
      { label: '标签左侧', action: () => handleSnap('left'), disabled: noObj },
      { label: '标签右侧', action: () => handleSnap('right'), disabled: noObj },
      { label: '标签底部', action: () => handleSnap('bottom'), disabled: noObj }
    ]

    // 排列 → 尺寸子菜单
    const sizeChildren: MenuItem[] = [
      { label: '宽度相同', action: () => handleSame('w'), disabled: noObj },
      { label: '高度相同', action: () => handleSame('h'), disabled: noObj },
      { label: '宽度高度相同', action: () => handleSame('wh'), disabled: noObj }
    ]

    // 排列 → 间距子菜单
    const distChildren: MenuItem[] = [
      { label: '水平间距相同', action: () => handleDist('h'), disabled: noObj },
      { label: '垂直间距相同', action: () => handleDist('v'), disabled: noObj }
    ]

    // 排列 → 旋转子菜单
    const rotateChildren: MenuItem[] = [
      { label: '左旋90度', action: () => handleRotate(90), disabled: noObj },
      { label: '旋转180度', action: () => handleRotate(180), disabled: noObj },
      { label: '右旋90度', action: () => handleRotate(270), disabled: noObj }
    ]

    // 查看 → 标签旋转子菜单
    const labelRotChildren: MenuItem[] = [
      { label: '正常显示', radio: labelRotation === 0, action: () => setLabelRotation(0) },
      { label: '左旋90度', radio: labelRotation === 90, action: () => setLabelRotation(90 as 0 | 90 | 180 | 270) },
      { label: '右旋90度', radio: labelRotation === 270, action: () => setLabelRotation(270 as 0 | 90 | 180 | 270) },
      { label: '旋转180度', radio: labelRotation === 180, action: () => setLabelRotation(180 as 0 | 90 | 180 | 270) }
    ]

    // 选项 → 应用程序外观子菜单
    const themeChildren: MenuItem[] = [
      { label: '蓝色样式(B)', radio: appTheme === 'blue', action: () => setAppTheme('blue') },
      { label: '黑色样式(L)', radio: appTheme === 'black', action: () => setAppTheme('black') },
      { label: '银色样式(S)', radio: appTheme === 'silver', action: () => setAppTheme('silver') },
      { label: '水绿色样式(A)', radio: appTheme === 'aqua', action: () => setAppTheme('aqua') }
    ]

    // 窗口 → 文档列表
    const winDocItems: MenuItem[] = [
      { label: '1 启始页', checked: active === START, action: () => setActive(START) }
    ]
    tabs.forEach((t, i) => {
      winDocItems.push({ label: `${i + 2} ${t.title}`, checked: active === t.key, action: () => setActive(t.key) })
    })

    return [
      // ========== 文件(F) ==========
      {
        title: '文件(F)',
        items: [
          { label: '新建(N)', shortcut: 'Ctrl+N', children: [
            { label: '新建条幅飘带', action: handleBannerNew }
          ] },
          { label: '打开(O)...', shortcut: 'Ctrl+O', action: () => void handleOpen() },
          { label: '关闭(C)', shortcut: 'Ctrl+W', action: () => !isStart && closeTab(active), disabled: isStart },
          { label: '保存(S)', shortcut: 'Ctrl+S', action: () => void handleSave(), disabled: isStart },
          { label: '另存为(A)...', action: () => void handleSaveAs(), disabled: isStart },
          { label: '分享(T)...', disabled: true },
          { divider: true, label: '' },
          { label: '打印(P)...', shortcut: 'Ctrl+P', action: () => handlePrint(false), disabled: isStart || busy },
          { label: '打印预览(V)', action: () => void handlePreview(), disabled: isStart },
          { label: '导出打印机指令文件(E)', action: () => void handleExportCommand(), disabled: isStart || busy },
          { divider: true, label: '' },
          { label: '标签格式设置(L)...', action: () => setModal('new'), disabled: isStart },
          { label: '模板属性设置(M)', action: () => setModal('tplprops'), disabled: isStart },
          { label: '模板库(L)...', action: () => setModal('tpllib'), disabled: isStart },
          { divider: true, label: '' },
          { label: '最近的文件', children: recents.length ? recents.map((r) => ({ label: r.name, action: () => void handleOpenRecent(r) })) : [{ label: '（无最近文件）', disabled: true }] },
          { divider: true, label: '' },
          { label: '退出(X)', action: () => window.close() }
        ]
      },
      // ========== 编辑(E) ==========
      {
        title: '编辑(E)',
        items: [
          { label: '撤销(U)', shortcut: 'Ctrl+Z', action: undo, disabled: isStart },
          { label: '恢复(R)', shortcut: 'Ctrl+Y', action: redo, disabled: isStart },
          { divider: true, label: '' },
          { label: '剪切(T)', shortcut: 'Shift+Delete', action: handleCut, disabled: noObj },
          { label: '复制(C)', shortcut: 'Ctrl+C', action: copySelected, disabled: noObj },
          { label: '粘贴(P)', shortcut: 'Ctrl+V', action: pasteClipboard, disabled: isStart || !clipboardRef.current },
          { divider: true, label: '' },
          { label: '全选(A)', shortcut: 'Ctrl+A', action: selectAll, disabled: isStart },
          { label: '删除(D)', shortcut: 'Delete', action: () => { const ids = selectedIds(); if (ids.length) deleteObjects(ids) }, disabled: noObj },
          { divider: true, label: '' },
          { label: '键盘输入变量顺序(O)', action: () => setModal('keyorder'), disabled: isStart },
          { label: '属性', shortcut: 'Alt+Enter', action: () => (selectedObj ? setModal('props') : setStatus('请先选中对象')), disabled: isStart }
        ]
      },
      // ========== 查看(V) ==========
      {
        title: '查看(V)',
        items: [
          { label: '工具栏(T)', checked: showToolbar, action: () => setShowToolbar((v) => !v) },
          { label: '格式栏(F)', checked: showFormatBar, action: () => setShowFormatBar((v) => !v) },
          { label: '对齐栏(A)', checked: showAlignBar, action: () => setShowAlignBar((v) => !v) },
          { label: '状态栏(S)', checked: showStatusBar, action: () => setShowStatusBar((v) => !v) },
          { divider: true, label: '' },
          { label: '显示启始页(M)', action: () => setActive(START) },
          { label: '打印历史记录', action: () => setModal('history') },
          { divider: true, label: '' },
          { label: '显示打印窗体(P)', checked: showPrintPanel, action: () => setShowPrintPanel((v) => !v) },
          { label: '显示图层窗体(L)', checked: showLayerPanel, action: () => setShowLayerPanel((v) => !v) },
          { divider: true, label: '' },
          { label: '显示对象信息(R)', shortcut: 'Ctrl+R', checked: showObjectInfo, action: () => setShowObjectInfo((v) => !v) },
          { divider: true, label: '' },
          { label: '适应宽度', action: () => handleFit('w'), disabled: isStart },
          { label: '适应高度', action: () => handleFit('h'), disabled: isStart },
          { label: '撑满窗口(W)', shortcut: 'Ctrl+Alt+0', action: () => handleFit('win'), disabled: isStart },
          { label: '放大(I)', shortcut: 'Ctrl+=', action: handleZoomIn, disabled: isStart },
          { label: '缩小(O)', shortcut: 'Ctrl+-', action: handleZoomOut, disabled: isStart },
          { divider: true, label: '' },
          { label: '标签旋转', children: labelRotChildren }
        ]
      },
      // ========== 工具(T) ==========
      {
        title: '工具(T)',
        items: [
          { label: '选取(S)', action: () => handleTool('select'), disabled: isStart },
          { label: '条码(B)', action: () => handleTool('barcode'), disabled: isStart },
          { label: '文字(T)', action: () => handleTool('text'), disabled: isStart },
          { label: '线条(L)', action: () => handleTool('line'), disabled: isStart },
          { label: '斜线(U)', action: () => handleTool('diagonal'), disabled: isStart },
          { divider: true, label: '' },
          { label: '矩形(R)', action: () => handleTool('rect'), disabled: isStart },
          { label: '图片(P)', action: () => handleTool('image'), disabled: isStart },
          { divider: true, label: '' },
          { label: '数据(D)', action: () => handleTool('data'), disabled: isStart },
          { label: '表格(G)', action: () => handleTool('table'), disabled: isStart },
          { divider: true, label: '' },
          { label: '放大(I)', action: handleZoomIn, disabled: isStart },
          { label: '缩小(O)', shortcut: 'Ctrl+-', action: handleZoomOut, disabled: isStart },
          { label: '适应宽度', action: () => handleFit('w'), disabled: isStart },
          { label: '适应高度', action: () => handleFit('h'), disabled: isStart },
          { label: '适合窗口(W)', shortcut: 'Ctrl+Alt+0', action: () => handleFit('win'), disabled: isStart }
        ]
      },
      // ========== 排列(A) ==========
      {
        title: '排列(A)',
        items: [
          { label: '组合(G)', shortcut: 'Ctrl+G', action: handleGroup, disabled: noObj },
          { label: '取消组合(U)', shortcut: 'Ctrl+U', action: handleUngroup, disabled: noObj },
          { divider: true, label: '' },
          { label: '对齐', children: alignChildren, disabled: noObj },
          { label: '尺寸', children: sizeChildren, disabled: noObj },
          { label: '间距', children: distChildren, disabled: noObj },
          { label: '旋转', children: rotateChildren, disabled: noObj },
          { divider: true, label: '' },
          { label: '位置锁定', shortcut: 'Ctrl+L', action: handleLockToggle, disabled: noObj },
          { divider: true, label: '' },
          { label: '移到最前', action: () => handleOrder('front'), disabled: noObj },
          { label: '前移', action: () => handleOrder('forward'), disabled: noObj },
          { label: '后移', action: () => handleOrder('backward'), disabled: noObj },
          { label: '移到最后', shortcut: 'Ctrl+B', action: () => handleOrder('back'), disabled: noObj }
        ]
      },
      // ========== 数据库(D) ==========
      {
        title: '数据库(D)',
        items: [
          { label: '设置数据库(D)...', action: () => setModal('data'), disabled: isStart },
          { divider: true, label: '' },
          { label: '定位记录(S)', shortcut: 'Ctrl+F', action: () => setModal('locate'), disabled: !hasDb },
          { label: '更新数据库', action: () => void handleDbRefresh(), disabled: !hasDb },
          { divider: true, label: '' },
          { label: '第一条记录', action: () => setRecord(0), disabled: !hasDb },
          { label: '上一条记录', action: () => setRecord(activeTab.recordIdx - 1), disabled: !hasDb },
          { label: '下一条记录', action: () => setRecord(activeTab.recordIdx + 1), disabled: !hasDb },
          { label: '最后一条记录', action: () => setRecord(dbRecordCount - 1), disabled: !hasDb },
          { divider: true, label: '' },
          { label: '删除数据库(E)', action: handleDeleteDb, disabled: !hasDb }
        ]
      },
      // ========== 账户(A) ==========
      {
        title: '账户(A)',
        items: [
          { label: '登录...', action: () => void openCloud() },
          { label: '注销...', action: handleLogout },
          { label: '账号和授权管理...', action: () => setModal('license') },
          { label: '试用管理...', action: () => setModal('trial') },
          { label: '演示和体验...', action: () => setModal('demo') }
        ]
      },
      // ========== 云服务(C) ==========
      {
        title: '云服务(C)',
        items: [
          { label: '首页', action: () => void openCloud() },
          { label: '云标签模板库', action: () => void openCloud() },
          { label: '云数据库', disabled: true },
          { label: '云图片库', disabled: true },
          { label: '云网页库', disabled: true }
        ]
      },
      // ========== 选项(O) ==========
      {
        title: '选项(O)',
        items: [
          { label: '系统选项(O)...', action: () => setModal('options') },
          { label: '打印机设置(P)...', action: () => setModal('printer') },
          { label: '安装打印机(I)...', action: () => setModal('printers') },
          { label: '应用程序外观(A)', children: themeChildren },
          { label: '电子称', action: () => setModal('weigh') }
        ]
      },
      // ========== 窗口(W) ==========
      {
        title: '窗口(W)',
        items: [
          { label: '新建窗口(N)', disabled: true },
          { label: '层叠(C)', disabled: true },
          { label: '平铺(T)', disabled: true },
          { label: '排列图标(A)', disabled: true },
          { divider: true, label: '' },
          ...winDocItems
        ]
      },
      // ========== 帮助(H) ==========
      {
        title: '帮助(H)',
        items: [
          { label: '帮助主题(H)', shortcut: 'F1', action: () => setModal('help') },
          { label: '在线网站(W)', action: () => window.open('https://www.360code.com/') },
          { label: '查找更新版本', action: () => setModal('update') },
          { label: '关于(A)...', action: () => setModal('about') }
        ]
      },
      // ========== 建议与反馈 ==========
      { title: '建议与反馈', items: [{ label: '建议与反馈', action: () => setModal('feedback') }] }
    ]
  }, [isStart, active, selectedObj, busy, doc, dbRecordCount, tabs, activeTab?.recordIdx, labelRotation, appTheme, showToolbar, showFormatBar, showAlignBar, showStatusBar, showPrintPanel, showLayerPanel, showObjectInfo, undo, redo, handleCut, copySelected, pasteClipboard, deleteObject, selectAll, handleGroup, handleUngroup, handleLockToggle, handleOrder, handleAlign, handleRotate, handleSame, handleCenter, handleDist, handleSnap, handleZoomIn, handleZoomOut, handleFit, handleOpen, handleOpenRecent, handleSave, handleSaveAs, handlePreview, handlePrint, handleExportCommand, handleBannerNew, handleDeleteDb, handleLogout, handleDbRefresh, closeTab, setRecord, handleTool, setModal, setActive, setShowToolbar, setShowFormatBar, setShowAlignBar, setShowStatusBar, setShowPrintPanel, setShowLayerPanel, setShowObjectInfo, setLabelRotation, setAppTheme, recents])

  // ---------- 画布右键菜单 ----------
  const contextMenuItems: MenuItem[] = useMemo(() => {
    const hasSel = contextMenu?.hasSelection ?? false
    const selCount = contextMenu?.selectionCount ?? 0
    const multi = selCount >= 2
    const noObj = !hasSel

    // 对齐子菜单（12项）
    const alignChildren: MenuItem[] = [
      { label: '左对齐', action: () => handleAlign('left'), disabled: noObj },
      { label: '右对齐', action: () => handleAlign('right'), disabled: noObj },
      { label: '上对齐', action: () => handleAlign('top'), disabled: noObj },
      { label: '下对齐', action: () => handleAlign('bottom'), disabled: noObj },
      { label: '垂直中齐', action: () => handleAlign('midV'), disabled: noObj },
      { label: '水平中齐', action: () => handleAlign('midH'), disabled: noObj },
      { divider: true, label: '' },
      { label: '水平居中', action: () => handleCenter('h'), disabled: noObj },
      { label: '垂直居中', action: () => handleCenter('v'), disabled: noObj },
      { label: '标签顶部', action: () => handleSnap('top'), disabled: noObj },
      { label: '标签左侧', action: () => handleSnap('left'), disabled: noObj },
      { label: '标签右侧', action: () => handleSnap('right'), disabled: noObj },
      { label: '标签底部', action: () => handleSnap('bottom'), disabled: noObj }
    ]

    // 尺寸与间距子菜单（5项）
    const sizeDistChildren: MenuItem[] = [
      { label: '宽度相同', action: () => handleSame('w'), disabled: !multi },
      { label: '高度相同', action: () => handleSame('h'), disabled: !multi },
      { label: '宽度高度相同', action: () => handleSame('wh'), disabled: !multi },
      { divider: true, label: '' },
      { label: '水平间距相同', action: () => handleDist('h'), disabled: !multi },
      { label: '垂直间距相同', action: () => handleDist('v'), disabled: !multi }
    ]

    // 旋转与层次子菜单（7项）
    const rotateOrderChildren: MenuItem[] = [
      { label: '左旋90度', action: () => handleRotate(90), disabled: noObj },
      { label: '旋转180度', action: () => handleRotate(180), disabled: noObj },
      { label: '右旋90度', action: () => handleRotate(270), disabled: noObj },
      { divider: true, label: '' },
      { label: '移到最前', action: () => handleOrder('front'), disabled: noObj },
      { label: '前移', action: () => handleOrder('forward'), disabled: noObj },
      { label: '后移', action: () => handleOrder('backward'), disabled: noObj },
      { label: '移到最后', shortcut: 'Ctrl+B', action: () => handleOrder('back'), disabled: noObj }
    ]

    // 标签旋转子菜单（4项）
    const labelRotChildren: MenuItem[] = [
      { label: '正常显示', radio: labelRotation === 0, action: () => setLabelRotation(0) },
      { label: '左旋90度', radio: labelRotation === 90, action: () => setLabelRotation(90 as 0 | 90 | 180 | 270) },
      { label: '右旋90度', radio: labelRotation === 270, action: () => setLabelRotation(270 as 0 | 90 | 180 | 270) },
      { label: '旋转180度', radio: labelRotation === 180, action: () => setLabelRotation(180 as 0 | 90 | 180 | 270) }
    ]

    return [
      { label: '属性', shortcut: 'Alt+Enter', action: () => setModal('props'), disabled: noObj },
      { divider: true, label: '' },
      { label: '组合(G)', shortcut: 'Ctrl+G', action: handleGroup, disabled: noObj },
      { label: '取消组合(U)', shortcut: 'Ctrl+U', action: handleUngroup, disabled: noObj },
      { label: '位置锁定', shortcut: 'Ctrl+L', action: handleLockToggle, disabled: noObj },
      { divider: true, label: '' },
      { label: '对齐', children: alignChildren, disabled: noObj },
      { label: '尺寸与间距', children: sizeDistChildren, disabled: noObj },
      { label: '旋转与层次', children: rotateOrderChildren, disabled: noObj },
      { divider: true, label: '' },
      { label: '剪切', shortcut: 'Shift+Delete', action: handleCut, disabled: noObj },
      { label: '复制', shortcut: 'Ctrl+C', action: copySelected, disabled: noObj },
      { label: '粘贴', shortcut: 'Ctrl+V', action: pasteClipboard },
      { label: '删除', shortcut: 'Delete', action: () => { const ids = selectedIds(); if (ids.length) deleteObjects(ids) }, disabled: noObj },
      { label: '全选', shortcut: 'Ctrl+A', action: selectAll },
      { label: '导出(E)...', shortcut: 'Ctrl+E', action: () => setModal('export'), disabled: noObj },
      { divider: true, label: '' },
      { label: '标签格式设置(L)...', action: () => setModal('new') },
      { label: '模板属性设置(M)', action: () => setModal('tplprops') },
      { divider: true, label: '' },
      { label: '放大(I)', action: handleZoomIn },
      { label: '缩小(O)', shortcut: 'Ctrl+-', action: handleZoomOut },
      { label: '适应宽度', action: () => handleFit('w') },
      { label: '适应高度', action: () => handleFit('h') },
      { label: '撑满窗口(W)', shortcut: 'Ctrl+Alt+0', action: () => handleFit('win') },
      { divider: true, label: '' },
      { label: '标签旋转', children: labelRotChildren }
    ]
  }, [contextMenu, selectedObj, labelRotation, handleGroup, handleUngroup, handleLockToggle, handleAlign, handleCenter, handleSnap, handleSame, handleDist, handleRotate, handleOrder, handleCut, copySelected, pasteClipboard, deleteObject, selectAll, handleZoomIn, handleZoomOut, handleFit, setModal, setStatus, setLabelRotation])

  // ---------- 全局快捷键 ----------
  const keydownRef = useRef<(e: KeyboardEvent) => void>(() => {})
  keydownRef.current = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    const isEditable =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable === true

    const ctrl = e.ctrlKey || e.metaKey
    const shift = e.shiftKey
    const alt = e.altKey
    const key = e.key

    // ---- 全局快捷键（输入框中也生效）----
    if (ctrl && key.toLowerCase() === 's') { e.preventDefault(); void handleSave(); return }
    if (ctrl && key.toLowerCase() === 'n') { e.preventDefault(); setModal('new'); return }
    if (ctrl && key.toLowerCase() === 'o') { e.preventDefault(); void handleOpen(); return }
    if (ctrl && key.toLowerCase() === 'p') { e.preventDefault(); if (!isStart) handlePrint(false); return }
    if (ctrl && key.toLowerCase() === 'f') { e.preventDefault(); if (!isStart) setModal('locate'); return }
    if (key === 'F1') { e.preventDefault(); setModal('help'); return }

    // ---- 以下快捷键在可编辑元素中不拦截 ----
    if (isEditable) return

    // 编辑操作
    if (ctrl && key.toLowerCase() === 'z') { e.preventDefault(); undo(); return }
    if (ctrl && key.toLowerCase() === 'y') { e.preventDefault(); redo(); return }
    if (ctrl && key.toLowerCase() === 'x') { e.preventDefault(); handleCut(); return }
    if (ctrl && key.toLowerCase() === 'c') { e.preventDefault(); copySelected(); return }
    if (ctrl && key.toLowerCase() === 'v') { e.preventDefault(); pasteClipboard(); return }
    if (ctrl && key.toLowerCase() === 'a') { e.preventDefault(); selectAll(); return }
    if (shift && key === 'Delete' && selectedObj) {
      e.preventDefault()
      handleCut()
      return
    }
    if ((key === 'Delete' || key === 'Backspace') && selectedObj) {
      e.preventDefault()
      const ids = selectedIds()
      if (ids.length) deleteObjects(ids)
      return
    }

    // 文件操作
    if (ctrl && key.toLowerCase() === 'w') { e.preventDefault(); if (!isStart) closeTab(active); return }

    // 排列操作
    if (ctrl && key.toLowerCase() === 'g') { e.preventDefault(); handleGroup(); return }
    if (ctrl && key.toLowerCase() === 'u') { e.preventDefault(); handleUngroup(); return }
    if (ctrl && key.toLowerCase() === 'l') { e.preventDefault(); handleLockToggle(); return }
    if (ctrl && key.toLowerCase() === 'b') { e.preventDefault(); handleOrder('back'); return }

    // 视图操作
    if (ctrl && key === '=') { e.preventDefault(); handleZoomIn(); return }
    if (ctrl && key === '-') { e.preventDefault(); handleZoomOut(); return }
    if (ctrl && alt && key === '0') { e.preventDefault(); handleFit('win'); return }
    if (ctrl && key.toLowerCase() === 'r') { e.preventDefault(); setShowObjectInfo((v) => !v); return }

    // Esc：取消选中（Windows/编辑器习惯）
    if (key === 'Escape') {
      if (!isStart && activeTab?.selectedId) patchTab(active, (t) => ({ ...t, selectedId: null }))
      return
    }

    // 其他
    if (alt && key === 'Enter') {
      e.preventDefault()
      if (selectedObj) setModal('props')
      else setStatus('请先选中对象')
      return
    }
    if (ctrl && key.toLowerCase() === 'f') { e.preventDefault(); setStatus('定位记录：请使用工具栏数据库导航'); return }
    if (ctrl && key.toLowerCase() === 'e') { e.preventDefault(); if (!isStart) setModal('export'); return }

    // TAB / Ctrl+T 依次选中对象（LabelShop 支持循环切换选中对象）
    if ((key === 'Tab' || (ctrl && key.toLowerCase() === 't')) && !isStart && activeTab?.doc) {
      e.preventDefault()
      const objs = activeTab.doc.objects.filter((o) => o.visible !== false)
      if (objs.length) {
        const idx = selectedObj ? objs.findIndex((o) => o.id === selectedObj.id) : -1
        const next = objs[(idx + 1) % objs.length]
        patchTab(active, (t) => ({ ...t, selectedId: next.id }))
      }
      return
    }

    // 方向键移动选中对象（0.5mm，Shift=5mm）
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      const step = shift ? 5 : 0.5
      e.preventDefault()
      if (key === 'ArrowUp') moveSelectedBy(0, -step)
      else if (key === 'ArrowDown') moveSelectedBy(0, step)
      else if (key === 'ArrowLeft') moveSelectedBy(-step, 0)
      else if (key === 'ArrowRight') moveSelectedBy(step, 0)
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => keydownRef.current(e)
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    void refreshLib()
  }, [refreshLib])

  // ---------- 渲染 ----------
  const startHint = () => setStatus('请先新建或打开标签模板')
  const tabInfos: TabInfo[] = [{ key: START, title: '起始页', isStart: true }, ...tabs.map((t) => ({ key: t.key, title: t.title }))]
  const activeDoc = activeTab?.doc
  const datasetNames = activeDoc ? Object.keys(activeDoc.datasets ?? {}) : []
  const datasetName = activeTab?.datasetName && activeDoc?.datasets?.[activeTab.datasetName] ? activeTab.datasetName : (datasetNames[0] ?? '')
  const dbStatus = activeDoc && datasetNames.length ? `数据库：${datasetNames.length} 个数据集` : '未使用数据库'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', fontFamily: "'Segoe UI','Microsoft YaHei',sans-serif", ...themeVars } as React.CSSProperties}>
      <MenuBar sections={menuSections} />

      {showToolbar && (
        <Toolbar
          busy={busy}
          canDelete={!!selectedObj}
          canUndo={historyRef.current.length > 0}
          canRedo={futureRef.current.length > 0}
          canCopy={!!selectedObj}
          canPaste={!!clipboardRef.current}
          tool={isStart ? 'select' : activeTab.tool}
          onTool={isStart ? startHint : handleTool}
          onNew={() => setModal('new')}
          onOpen={() => void handleOpen()}
          onSave={isStart ? startHint : () => void handleSave()}
          onCut={isStart ? startHint : handleCut}
          onCopy={isStart ? startHint : copySelected}
          onPaste={isStart ? startHint : pasteClipboard}
          onDelete={() => { const ids = selectedIds(); if (ids.length) deleteObjects(ids) }}
          onUndo={isStart ? startHint : undo}
          onRedo={isStart ? startHint : redo}
          onLabelFormat={isStart ? startHint : () => setModal('new')}
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
        />
      )}
      {showFormatBar && (
        <FormatBar
          obj={isStart ? null : selectedObj}
          onPatch={(p) => selectedObj && updateObject(selectedObj.id, p)}
          onGroup={isStart ? startHint : handleGroup}
          onUngroup={isStart ? startHint : handleUngroup}
          onProps={isStart ? startHint : () => (selectedObj ? setModal('props') : setStatus('请先选中对象'))}
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
            onNew={() => setModal('new')}
            onOpen={() => void handleOpen()}
            onOpenRecent={(item) => void handleOpenRecent(item)}
            onLogin={() => void openCloud()}
            onCloudHome={() => void openCloud()}
            onLicense={() => setModal('license')}
            recentTemplates={recents}
            libTemplates={libTemplates}
            onOpenLib={(item) => void openLibItem(item)}
            onOpenLibDialog={() => setModal('tpllib')}
            onGetStarted={() => setModal('getstarted')}
            tabs={tabInfos}
            activeTab={active}
            onTabSelect={setActive}
            onTabClose={closeTab}
            onTabReorder={handleReorderTabs}
            onTabNew={() => setModal('new')}
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
                onSelect={(id) => patchTab(active, (t) => ({ ...t, selectedId: id }))}
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
              <TabStrip tabs={tabInfos} active={active} onSelect={setActive} onClose={closeTab} onReorder={handleReorderTabs} onNew={() => setModal("new")} onCloseOthers={closeOthers} onCloseAll={closeAll} />
              <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                <WorkArea
                  doc={activeDoc}
                  docKey={active}
                  selectedId={activeTab.selectedId}
                  onSelect={(id) => patchTab(active, (t) => ({ ...t, selectedId: id }))}
                  onSync={handleSync}
                  apiRef={apiRef}
                  zoom={activeTab.zoom}
                  setZoom={(z) => patchTab(active, (t) => ({ ...t, zoom: z }))}
                  onMouseMove={(x, y) => {
                    if (options.unit === 'inch') setCursor(`${(x / 25.4).toFixed(3)}, ${(y / 25.4).toFixed(3)} in`)
                    else setCursor(`${x.toFixed(2)}, ${y.toFixed(2)} 毫米`)
                  }}
                  showRulers={options.showRulers}
                  showGrid={options.showGrid}
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
                    {selectedObj && <PropertyPanel obj={selectedObj} datasets={activeDoc.datasets ?? {}} onPatch={(p) => updateObject(selectedObj.id, p)} />}
                    {showPrintPanel && (
                      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
                        <PrintDock
                          doc={activeDoc}
                          busy={busy}
                          count={activeTab.count}
                          setCount={(n) => patchTab(active, (t) => ({ ...t, count: n }))}
                          copies={activeTab.copies}
                          setCopies={(n) => patchTab(active, (t) => ({ ...t, copies: n }))}
                          startLabel={activeTab.startLabel}
                          setStartLabel={(n) => patchTab(active, (t) => ({ ...t, startLabel: Math.max(1, n) }))}
                          datasetNames={datasetNames}
                          datasetName={datasetName}
                          onDatasetChange={(name) => patchTab(active, (t) => ({ ...t, datasetName: name }))}
                          onPrinterSettings={() => setModal('printer')}
                          onData={() => setModal('data')}
                          onPreview={() => void handlePreview()}
                          onTestPrint={() => handlePrint(true)}
                          onPrint={() => handlePrint(false)}
                          onEnterprise={() => setModal('enterprise')}
                          dbAdv={dbAdv}
                          setDbAdv={(patch) => setDbAdv((d) => ({ ...d, ...patch }))}
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
          printerLabel={isStart ? '未连接打印机' : printer ? printerNameOf(printer) : ''}
          labelSpec={isStart || !activeDoc ? '未打开标签模板' : `${activeDoc.widthMm}mm × ${activeDoc.heightMm}mm`}
          dbStatus={isStart ? '未使用数据库' : dbStatus}
          cursor={cursor}
          zoom={isStart ? 1 : activeTab.zoom}
          onZoom={(z) => !isStart && patchTab(active, (t) => ({ ...t, zoom: z }))}
          objInfo={selectedObj ? { x: selectedObj.x, y: selectedObj.y, w: selectedObj.w, h: selectedObj.h } : null}
          unit={options.unit}
        />
      )}

      {/* 显示对象信息浮窗（查看 → 显示对象信息 / Ctrl+R） */}
      {showObjectInfo && !isStart && selectedObj && <ObjectInfoPopup obj={selectedObj} onClose={() => setShowObjectInfo(false)} />}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
      {previewUrl && <PreviewModal url={previewUrl} label={`${activeDoc?.widthMm ?? 0} × ${activeDoc?.heightMm ?? 0} mm`} onClose={() => setPreviewUrl(null)} />}
      {keyboardDraft && <KeyboardInputModal labels={keyboardDraft.labels} initial={keyboardValues} isTest={keyboardDraft.isTest} onClose={() => setKeyboardDraft(null)} onSubmit={handleKeyboardSubmit} />}
      {modal === 'new' && <NewLabelDialog defaultW={options.defaultLabelW} defaultH={options.defaultLabelH} onSelect={handleNewFromDialog} onClose={() => setModal(null)} />}
      {modal === 'printer' && <PrinterSettings printer={printer} onClose={() => setModal(null)} onSave={handlePrinterSave} />}
      {modal === 'data' && (
        <DataPanel
          datasets={activeDoc?.datasets ?? {}}
          connections={activeDoc?.connections ?? {}}
          onClose={() => setModal(null)}
          onImport={handleDataImport}
          onImportReplace={handleImportReplace}
          onDelete={handleDataDelete}
          onConnectionSave={handleConnectionSave}
          onConnectionDelete={handleConnectionDelete}
          onRenameField={(name, field, newField) => {
            const cur = activeDoc?.datasets ?? {}
            const ds = cur[name]
            if (!ds) return
            const idx = ds.columns.indexOf(field)
            if (idx < 0) return
            const columns = ds.columns.slice()
            columns[idx] = newField
            // 同步更新数据集内所有引用该字段的文本/条码对象的数据源
            setActiveDoc((prev) => ({
              ...prev,
              datasets: { ...(prev.datasets ?? {}), [name]: { ...ds, columns } },
              objects: prev.objects.map((o) => {
                if (!('source' in o) || !o.source || o.source.kind !== 'database' || o.source.dataset !== name || o.source.field !== field) return o
                return { ...o, source: { ...o.source, field: newField } }
              })
            }))
          }}
        />
      )}
      {modal === 'export' && activeDoc && <ExportModal doc={activeDoc} onClose={() => setModal(null)} />}
      {modal === 'license' && <LicenseDialog onClose={() => setModal(null)} />}
      {modal === 'tpllib' && activeDoc && (
        <TemplateLibDialog
          onClose={() => { setModal(null); void refreshLib() }}
          onOpen={openLibItem}
          docName={activeDoc.name}
          docJson={JSON.stringify(activeDoc)}
          onOpenJson={(json, name) => {
            try {
              const d = JSON.parse(json) as LabelDoc
              openDoc(d, d.name ?? name)
              setModal(null)
              setStatus('已加载企业共享模板：' + (d.name ?? name))
            } catch {
              setStatus('企业共享模板无效')
            }
          }}
          onSaveCurrent={async () => {
            if (!activeDoc) return { ok: false, message: '无当前模板' }
            let thumb = ''
            try {
              thumb = await renderLabelDataUrl(activeDoc, { dpi: 60, ctx: graphicsCtx(activeDoc, printer, activeTab.copies, activeTab.count, keyboardValues, activeTab.recordIdx) })
            } catch {
              /* 缩略图失败不阻塞保存 */
            }
            const r = await window.maxlabel.saveTemplateToLib(activeDoc.name, JSON.stringify({ ...activeDoc, thumb }, null, 2))
            if (r.ok) {
              setDocPath(r.path ?? null)
              void refreshLib()
            }
            return r
          }}
          onMsg={(s) => setStatus(s)}
        />
      )}
      {modal === 'enterprise' && activeDoc && (
        <EnterpriseDialog
          docName={activeDoc.name}
          docJson={JSON.stringify(activeDoc)}
          onClose={() => setModal(null)}
          onLoad={(json) => {
            try {
              const d = JSON.parse(json) as LabelDoc
              openDoc(d, d.name)
              setStatus('已加载企业共享模板：' + d.name)
            } catch {
              setStatus('企业模板数据无效')
            }
          }}
        />
      )}
      {modal === 'options' && <OptionsDialog options={options} onSave={setOptions} onClose={() => setModal(null)} />}
      {modal === 'props' && selectedObj && <ObjectPropsDialog obj={selectedObj} datasets={activeDoc.datasets ?? {}} onPatch={(p) => updateObject(selectedObj.id, p)} onClose={() => setModal(null)} initialTab={propsTab} colorIndexTable={activeDoc.colorIndexTable} onPatchDoc={(p) => setActiveDoc((d) => ({ ...d, ...p }))} labelWidthMm={activeDoc.widthMm} labelHeightMm={activeDoc.heightMm} />}
      {modal === 'changedata' && selectedObj && <ChangeDataDialog obj={selectedObj} onPatch={(p) => updateObject(selectedObj.id, p)} onClose={() => setModal(null)} />}
      {modal === 'feedback' && <FeedbackDialog onClose={() => setModal(null)} />}
      {modal === 'importwarn' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
          <div style={{ background: '#fff', borderRadius: 8, width: 520, maxHeight: 420, display: 'flex', flexDirection: 'column', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e8e8', fontWeight: 600, fontSize: 14 }}>LabelShop 文件导入提示</div>
            <div style={{ padding: '12px 16px', overflow: 'auto', flex: 1, fontSize: 13, lineHeight: 1.7, color: '#333' }}>
              <div style={{ marginBottom: 8, color: '#888' }}>已按 LabelShop 格式打开该文件，以下元素未能完整转换，请在画布中检查并手动补建：</div>
              {importWarnings.map((w, i) => (
                <div key={i} style={{ padding: '4px 8px', marginBottom: 4, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4 }}>
                  {w}
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid #e8e8e8', textAlign: 'right' }}>
              <button onClick={() => setModal(null)} style={{ padding: '6px 18px', background: '#22BDED', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>知道了</button>
            </div>
          </div>
        </div>
      )}
      {modal === 'getstarted' && (
        <GetStartedDialog
          onClose={() => setModal(null)}
          onNew={() => setModal('new')}
          onPrinter={() => setModal('printer')}
          onEdit={() => { const first = tabs.find((t) => t.key !== START); setActive(first ? first.key : active); }}
          onPreview={() => { if (!isStart && activeTab) void handlePreview() }}
        />
      )}
      {modal === 'tplprops' && activeDoc && (
        <TemplatePropsDialog
          doc={activeDoc}
          onPatch={(p) => setActiveDoc((d) => ({ ...d, ...p }))}
          onClose={() => setModal(null)}
          onPrinterSettings={() => setModal('printer')}
        />
      )}
      {modal === 'history' && <PrintHistoryDialog onClose={() => setModal(null)} />}
      {modal === 'keyorder' && activeDoc && (
        <KeyInputOrderDialog
          doc={activeDoc}
          onSave={(order) => setActiveDoc((d) => ({ ...d, keyboardOrder: order }))}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'locate' && <LocateRecordDialog total={dbRecordCount} dsCols={dbCols} dsRows={dbRows} onLocate={(idx) => setRecord(idx)} onClose={() => setModal(null)} />}
      {modal === 'trial' && <TrialDialog onClose={() => setModal(null)} />}
      {modal === 'demo' && <DemoDialog onClose={() => setModal(null)} />}
      {modal === 'weigh' && <WeighDialog onClose={() => setModal(null)} />}
      {modal === 'printers' && (
        <PrintersInstallDialog
          printer={printer}
          onInstall={(driver, dpi, portType) => {
            setActiveDoc((d) => ({ ...d, printer: { ...defaultPrinterConfig(), driver, dpi, port: { ...defaultPrinterConfig().port, type: portType as import('./types').PrinterConfig['port']['type'] } } }))
            setStatus('已安装打印机：' + driver.toUpperCase() + ' · ' + dpi + 'dpi · ' + portType + '（随模板保存）')
            setModal(null)
          }}
          onRemove={() => {
            setActiveDoc((d) => ({ ...d, printer: undefined }))
            setStatus('已移除打印机')
            setModal(null)
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'update' && <UpdateDialog onClose={() => setModal(null)} />}
      {modal === 'about' && <AboutDialog onClose={() => setModal(null)} />}
      {modal === 'help' && <HelpDialog onClose={() => setModal(null)} />}

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

/** 图形打印 / 预览的 DataCtx（第一张标签） */
function graphicsCtx(doc: LabelDoc, printer: PrinterConfig, copy: number, count: number, keyboardValues: Record<string, string>, recordIdx = 0): DataCtx {
  return {
    labelIndex: 1,
    recordIndex: recordIdx,
    copy,
    count,
    totalLabels: count * copy,
    title: doc.name,
    printerName: printerNameOf(printer),
    datasets: doc.datasets ?? {},
    sharedVars: {},
    keyboardValues
  }
}

function PreviewModal({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div style={{ background: '#fff', padding: 20, borderRadius: 12, maxWidth: '92vw', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>打印预览 · {label}</div>
          <button type="button" onClick={onClose} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            关闭
          </button>
        </div>
        <img src={url} alt="标签预览" style={{ display: 'block', maxWidth: '100%', maxHeight: '78vh', border: '1px solid #E4E3DD' }} />
      </div>
    </div>
  )
}

function KeyboardInputModal({ labels, initial, onClose, onSubmit, isTest }: { labels: string[]; initial: Record<string, string>; onClose: () => void; onSubmit: (vals: Record<string, string>) => void; isTest: boolean }) {
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {}
    for (const l of labels) v[l] = initial[l] ?? ''
    return v
  })
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }} onClick={onClose}>
      <div style={{ background: '#fff', padding: 20, borderRadius: 12, width: 380, maxWidth: '92vw', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{isTest ? '测试打印 · 打印前输入' : '打印 · 打印前输入'}</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>以下 {labels.length} 个数据源需要您手动输入（键盘输入）{isTest ? '· 测试打印不推进序列号' : ''}</div>
        {labels.map((l) => (
          <div key={l} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{l}</div>
            <input value={vals[l] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [l]: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} autoFocus={labels.length === 1} />
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            取消
          </button>
          <button type="button" onClick={() => onSubmit(vals)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            开始打印
          </button>
        </div>
      </div>
    </div>
  )
}
