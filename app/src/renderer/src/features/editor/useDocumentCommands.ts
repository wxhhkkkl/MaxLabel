import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { LabelDoc, LabelObject } from '../../types'
import { findObjectById, removeObjectById, reorderObjectById, updateObjectById } from '../../../../shared/domain/objects'
import { normalizeDocument } from '../../../../shared/domain/document'
import { readValidatedImageFile } from '../../print/imageValidation'
import { round2, uid } from '../../types'
import type { DocTab } from '../workspace/useDocumentWorkspace'

interface Deps {
  active: string
  doc?: LabelDoc
  selectedObj: LabelObject | null
  selectedIds: () => string[]
  patchTab: (key: string, updater: (tab: DocTab) => DocTab) => void
  applyDocument: (updater: (doc: LabelDoc) => LabelDoc, options?: { coalesceKey?: string }) => void
  setStatus: (status: string) => void
}

/** All interactive document/object mutations share this command surface. */
export function useDocumentCommands({ active, doc, selectedObj, selectedIds, patchTab, applyDocument, setStatus }: Deps) {
  const clipboardRef = useRef<LabelObject[]>([])
  const [canPaste, setCanPaste] = useState(false)

  const selectedObjects = (): LabelObject[] => {
    const ids = selectedIds()
    if (doc && ids.length) {
      const objects = ids.map((id) => findObjectById(doc.objects, id)).filter((object): object is LabelObject => Boolean(object))
      if (objects.length) return objects
    }
    return selectedObj ? [selectedObj] : []
  }

  const cloneWithFreshIds = (object: LabelObject): LabelObject => {
    const copy = structuredClone(object)
    const offset = (value: LabelObject): LabelObject => {
      const next = { ...value, id: uid(), x: round2(value.x + 1), y: round2(value.y + 1) }
      return next.type === 'group' ? { ...next, children: next.children.map(cloneWithFreshIds) } : next
    }
    return offset(copy)
  }

  const readSystemClipboard = async (): Promise<LabelObject[]> => {
    if (!navigator.clipboard?.readText) return []
    try {
      const raw = await navigator.clipboard.readText()
      const parsed = JSON.parse(raw) as unknown
      const value = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as { format?: unknown; objects?: unknown }).objects
        : parsed
      if (!Array.isArray(value) || !value.length) return []
      // Clipboard content is an external document boundary. Reuse the same
      // normalizer as file import so malformed/hostile object trees never
      // enter the editor model.
      return normalizeDocument({ version: 2, name: '剪贴板对象', widthMm: 10000, heightMm: 10000, objects: value }).objects
    } catch {
      return []
    }
  }

  // Keep Edit → Paste enabled when the user switches templates/windows after
  // copying in MaxLabel. Non-MaxLabel clipboard text is ignored safely.
  useEffect(() => {
    void readSystemClipboard().then((objects) => {
      if (!objects.length) return
      clipboardRef.current = objects
      setCanPaste(true)
    })
  }, [])

  const appendObject = useCallback((obj: LabelObject) => {
    applyDocument((doc) => ({ ...doc, objects: [...doc.objects, obj] }))
    patchTab(active, (tab) => ({ ...tab, selectedId: obj.id, tool: 'select' }))
    setStatus('已添加对象')
  }, [active, applyDocument, patchTab, setStatus])

  const addImageFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    void readValidatedImageFile(file).then((src) => {
      const id = uid()
      const object: LabelObject = { id, type: 'image', x: 10, y: 10, w: 40, h: 30, rotation: 0, src }
      applyDocument((doc) => ({ ...doc, objects: [...doc.objects, object] }))
      patchTab(active, (tab) => ({ ...tab, selectedId: id }))
      setStatus('图片已添加')
    }).catch((error) => setStatus('图片导入失败：' + (error instanceof Error ? error.message : String(error))))
  }, [active, applyDocument, patchTab, setStatus])

  const updateObject = useCallback((id: string, patch: Partial<LabelObject>) => {
    applyDocument((doc) => ({ ...doc, objects: updateObjectById(doc.objects, id, patch) }), { coalesceKey: `object:${id}` })
  }, [applyDocument])

  const handleSync = useCallback((objects: LabelObject[]) => {
    applyDocument((doc) => ({ ...doc, objects }))
  }, [applyDocument])

  const deleteObject = useCallback((id: string) => {
    applyDocument((doc) => ({ ...doc, objects: removeObjectById(doc.objects, id) }))
    patchTab(active, (tab) => tab.selectedId === id ? { ...tab, selectedId: null } : tab)
    setStatus('已删除对象')
  }, [active, applyDocument, patchTab, setStatus])

  const deleteObjects = useCallback((ids: string[]) => {
    if (!ids.length) {
      setStatus('请先选中对象')
      return
    }
    const idSet = new Set(ids)
    applyDocument((doc) => ({ ...doc, objects: ids.reduce((objects, id) => removeObjectById(objects, id), doc.objects) }))
    patchTab(active, (tab) => tab.selectedId && idSet.has(tab.selectedId) ? { ...tab, selectedId: null } : tab)
    setStatus(ids.length > 1 ? `已删除 ${ids.length} 个对象` : '已删除对象')
  }, [active, applyDocument, patchTab, setStatus])

  const toggleVisible = useCallback((id: string) => {
    applyDocument((doc) => {
      const object = findObjectById(doc.objects, id)
      return object ? { ...doc, objects: updateObjectById(doc.objects, id, { visible: object.visible === false }) } : doc
    })
  }, [applyDocument])

  const reorderObject = useCallback((id: string, direction: -1 | 1) => {
    applyDocument((doc) => {
      const objects = reorderObjectById(doc.objects, id, direction)
      return objects === doc.objects ? doc : { ...doc, objects }
    })
  }, [applyDocument])

  const copySelected = useCallback(() => {
    const objects = selectedObjects()
    if (!objects.length) return
    clipboardRef.current = structuredClone(objects)
    setCanPaste(true)
    // Keep an app-local copy for deterministic same-session pastes and mirror
    // it to the system clipboard so Ctrl+C/Ctrl+V also works across templates
    // and after switching windows, as in LabelShop.
    void navigator.clipboard?.writeText(JSON.stringify({ format: 'maxlabel-objects', version: 1, objects })).catch(() => {})
    setStatus(objects.length > 1 ? `已复制 ${objects.length} 个对象` : '已复制对象')
  }, [doc, selectedObj, selectedIds, setStatus])

  const pasteClipboard = useCallback(async () => {
    let sources = clipboardRef.current
    if (!sources.length) {
      sources = await readSystemClipboard()
      if (sources.length) {
        clipboardRef.current = structuredClone(sources)
        setCanPaste(true)
      }
    }
    if (!sources.length) return
    const copies = sources.map(cloneWithFreshIds)
    applyDocument((current) => ({ ...current, objects: [...current.objects, ...copies] }))
    patchTab(active, (tab) => ({ ...tab, selectedId: copies[copies.length - 1].id }))
    setStatus(copies.length > 1 ? `已粘贴 ${copies.length} 个对象` : '已粘贴对象')
  }, [active, applyDocument, patchTab, setStatus])

  const handleCut = useCallback(() => {
    const objects = selectedObjects()
    if (!objects.length) return
    clipboardRef.current = structuredClone(objects)
    setCanPaste(true)
    void navigator.clipboard?.writeText(JSON.stringify({ format: 'maxlabel-objects', version: 1, objects })).catch(() => {})
    const ids = new Set(objects.map((object) => object.id))
    applyDocument((current) => ({ ...current, objects: [...ids].reduce((next, id) => removeObjectById(next, id), current.objects) }))
    patchTab(active, (tab) => ids.has(tab.selectedId ?? '') ? { ...tab, selectedId: null } : tab)
    setStatus(objects.length > 1 ? `已剪切 ${objects.length} 个对象` : '已剪切对象')
  }, [active, applyDocument, doc, selectedObj, selectedIds, patchTab, setStatus])

  const handleLockToggle = useCallback(() => {
    const ids = selectedIds()
    if (!ids.length) {
      setStatus('请先选中对象')
      return
    }
    applyDocument((doc) => {
      let objects = doc.objects
      for (const id of ids) {
        const object = findObjectById(objects, id)
        if (object) objects = updateObjectById(objects, id, { locked: object.locked !== true })
      }
      return objects === doc.objects ? doc : { ...doc, objects }
    })
    setStatus('已切换位置锁定')
  }, [applyDocument, selectedIds, setStatus])

  const moveSelectedBy = useCallback((dx: number, dy: number) => {
    const ids = selectedIds()
    if (!ids.length) return
    applyDocument((doc) => {
      let objects = doc.objects
      for (const id of ids) {
        const object = findObjectById(objects, id)
        // 帮助 label_object_move_key.html + label_object_align_pos.html：方向键移动
        // 同样受位置锁定约束，锁定的对象不能被移动。
        if (object && object.locked !== true) objects = updateObjectById(objects, id, { x: round2(object.x + dx), y: round2(object.y + dy) })
      }
      return objects === doc.objects ? doc : { ...doc, objects }
    })
  }, [applyDocument, selectedIds])

  return {
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
    canPaste,
    setCanPaste
  }
}
