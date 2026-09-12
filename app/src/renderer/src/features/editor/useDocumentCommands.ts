import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import type { LabelDoc, LabelObject } from '../../types'
import { findObjectById, removeObjectById, reorderObjectById, updateObjectById } from '../../../../shared/domain/objects'
import { readValidatedImageFile } from '../../print/imageValidation'
import { round2, uid } from '../../types'
import type { DocTab } from '../workspace/useDocumentWorkspace'

interface Deps {
  active: string
  selectedObj: LabelObject | null
  selectedIds: () => string[]
  patchTab: (key: string, updater: (tab: DocTab) => DocTab) => void
  applyDocument: (updater: (doc: LabelDoc) => LabelDoc, options?: { coalesceKey?: string }) => void
  setStatus: (status: string) => void
}

/** All interactive document/object mutations share this command surface. */
export function useDocumentCommands({ active, selectedObj, selectedIds, patchTab, applyDocument, setStatus }: Deps) {
  const clipboardRef = useRef<LabelObject | null>(null)
  const [canPaste, setCanPaste] = useState(false)

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
    if (!selectedObj) return
    clipboardRef.current = structuredClone(selectedObj)
    setCanPaste(true)
    setStatus('已复制对象')
  }, [selectedObj, setStatus])

  const pasteClipboard = useCallback(() => {
    const source = clipboardRef.current
    if (!source) return
    const copy = structuredClone(source)
    copy.id = uid()
    copy.x += 1
    copy.y += 1
    applyDocument((doc) => ({ ...doc, objects: [...doc.objects, copy] }))
    patchTab(active, (tab) => ({ ...tab, selectedId: copy.id }))
    setStatus('已粘贴对象')
  }, [active, applyDocument, patchTab, setStatus])

  const handleCut = useCallback(() => {
    if (!selectedObj) return
    clipboardRef.current = structuredClone(selectedObj)
    setCanPaste(true)
    deleteObject(selectedObj.id)
    setStatus('已剪切对象')
  }, [deleteObject, selectedObj, setStatus])

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
        if (object) objects = updateObjectById(objects, id, { x: round2(object.x + dx), y: round2(object.y + dy) })
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
