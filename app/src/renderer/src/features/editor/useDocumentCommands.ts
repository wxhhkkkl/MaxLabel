import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { LabelDoc, LabelObject } from '../../types'
import { findObjectById, removeObjectById, reorderObjectById, updateObjectById } from '../../../../shared/domain/objects'
import { cloneWithFreshIds, readObjectClipboard } from './objectClipboard'
import { readValidatedImageFile } from '../../print/imageValidation'
import { round2, uid } from '../../types'
import type { DocTab } from '../workspace/useDocumentWorkspace'
import { localizeErrorText } from '../../../../shared/i18n/errors.en-US'
import type { Language } from '../../../../shared/i18n/types'

interface Deps {
  active: string
  doc?: LabelDoc
  selectedObj: LabelObject | null
  selectedIds: () => string[]
  patchTab: (key: string, updater: (tab: DocTab) => DocTab) => void
  applyDocument: (updater: (doc: LabelDoc) => LabelDoc, options?: { coalesceKey?: string }) => void
  setStatus: (status: string) => void
  tr: (key: string, params?: Record<string, string | number>) => string
  language: Language
}

/** All interactive document/object mutations share this command surface. */
export function useDocumentCommands({ active, doc, selectedObj, selectedIds, patchTab, applyDocument, setStatus, tr, language }: Deps) {
  const clipboardRef = useRef<LabelObject[]>([])
  const clipboardReadVersion = useRef(0)
  const [canPaste, setCanPaste] = useState(false)

  const selectedObjects = (): LabelObject[] => {
    const ids = selectedIds()
    if (doc && ids.length) {
      const objects = ids.map((id) => findObjectById(doc.objects, id)).filter((object): object is LabelObject => Boolean(object))
      if (objects.length) return objects
    }
    return selectedObj ? [selectedObj] : []
  }

  const readSystemClipboard = (): Promise<LabelObject[]> => readObjectClipboard(
    navigator.clipboard?.readText ? () => navigator.clipboard.readText() : undefined, clipboardRef.current)

  // Keep Edit → Paste enabled when the user switches templates/windows after
  // copying in MaxLabel. Non-MaxLabel clipboard text is ignored safely.
  useEffect(() => {
    let disposed = false
    const refresh = () => {
      const version = ++clipboardReadVersion.current
      void readSystemClipboard().then((objects) => {
        if (disposed || version !== clipboardReadVersion.current) return
        clipboardRef.current = objects
        setCanPaste(objects.length > 0)
      })
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => { disposed = true; window.removeEventListener('focus', refresh) }
  }, [])

  const appendObject = useCallback((obj: LabelObject) => {
    applyDocument((doc) => ({ ...doc, objects: [...doc.objects, obj] }))
    patchTab(active, (tab) => ({ ...tab, selectedId: obj.id, tool: 'select' }))
    setStatus(tr('status.objectAdded'))
  }, [active, applyDocument, patchTab, setStatus, tr])

  const addImageFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    void readValidatedImageFile(file).then((src) => {
      const id = uid()
      const object: LabelObject = { id, type: 'image', x: 10, y: 10, w: 40, h: 30, rotation: 0, src }
      applyDocument((doc) => ({ ...doc, objects: [...doc.objects, object] }))
      patchTab(active, (tab) => ({ ...tab, selectedId: id }))
      setStatus(tr('status.imageAdded'))
    }).catch((error) => setStatus(tr('status.imageImportFailed', { message: localizeErrorText(language, error instanceof Error ? error.message : String(error)) })))
  }, [active, applyDocument, patchTab, setStatus, tr, language])

  const updateObject = useCallback((id: string, patch: Partial<LabelObject>) => {
    applyDocument((doc) => ({ ...doc, objects: updateObjectById(doc.objects, id, patch) }), { coalesceKey: `object:${id}` })
  }, [applyDocument])

  const handleSync = useCallback((objects: LabelObject[]) => {
    applyDocument((doc) => ({ ...doc, objects }))
  }, [applyDocument])

  const deleteObject = useCallback((id: string) => {
    applyDocument((doc) => ({ ...doc, objects: removeObjectById(doc.objects, id) }))
    patchTab(active, (tab) => tab.selectedId === id ? { ...tab, selectedId: null } : tab)
    setStatus(tr('status.objectDeleted'))
  }, [active, applyDocument, patchTab, setStatus, tr])

  const deleteObjects = useCallback((ids: string[]) => {
    if (!ids.length) {
      setStatus(tr('status.selectObjectFirst'))
      return
    }
    const idSet = new Set(ids)
    applyDocument((doc) => ({ ...doc, objects: ids.reduce((objects, id) => removeObjectById(objects, id), doc.objects) }))
    patchTab(active, (tab) => tab.selectedId && idSet.has(tab.selectedId) ? { ...tab, selectedId: null } : tab)
    setStatus(ids.length > 1 ? tr('status.objectsDeleted', { count: ids.length }) : tr('status.objectDeleted'))
  }, [active, applyDocument, patchTab, setStatus, tr])

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
    clipboardReadVersion.current++
    clipboardRef.current = structuredClone(objects)
    setCanPaste(true)
    // Keep an app-local copy for deterministic same-session pastes and mirror
    // it to the system clipboard so Ctrl+C/Ctrl+V also works across templates
    // and after switching windows, as in 原版.
    void navigator.clipboard?.writeText(JSON.stringify({ format: 'maxlabel-objects', version: 1, objects })).catch(() => {})
    setStatus(objects.length > 1 ? tr('status.objectsCopied', { count: objects.length }) : tr('status.objectCopied'))
  }, [doc, selectedObj, selectedIds, setStatus, tr])

  const pasteClipboard = useCallback(async () => {
    const version = ++clipboardReadVersion.current
    const sources = await readSystemClipboard()
    if (version !== clipboardReadVersion.current) return
    clipboardRef.current = structuredClone(sources)
    setCanPaste(sources.length > 0)
    if (!sources.length) return
    const copies = sources.map(cloneWithFreshIds)
    applyDocument((current) => ({ ...current, objects: [...current.objects, ...copies] }))
    patchTab(active, (tab) => ({ ...tab, selectedId: copies[copies.length - 1].id }))
    setStatus(copies.length > 1 ? tr('status.objectsPasted', { count: copies.length }) : tr('status.objectPasted'))
  }, [active, applyDocument, patchTab, setStatus, tr])

  /**
   * Ctrl+拖拽复制：调用方给出被拖动的对象 id 与它们**拖动前**的 mm 坐标，
   * 在这些坐标上补一份副本——被拖走的那个已经落在别处了。
   *
   * 选中态刻意不动：用户眼里「我拖出来的是副本」，副本就在光标下落的位置，
   * 把选中态挪回原处那份反而像是拖错了对象。
   */
  const duplicateAt = useCallback((ids: string[], positions: Record<string, { x: number; y: number }>) => {
    if (!doc || !ids.length) return
    const copies = ids
      .map((id) => findObjectById(doc.objects, id))
      .filter((object): object is LabelObject => Boolean(object))
      .map((object) => {
        const copy = cloneWithFreshIds(object)
        const at = positions[object.id]
        return at ? { ...copy, x: round2(at.x), y: round2(at.y) } : copy
      })
    if (!copies.length) return
    applyDocument((current) => ({ ...current, objects: [...current.objects, ...copies] }))
    setStatus(copies.length > 1 ? tr('status.objectsCopied', { count: copies.length }) : tr('status.objectCopied'))
  }, [applyDocument, doc, setStatus, tr])

  const handleCut = useCallback(() => {
    const objects = selectedObjects()
    if (!objects.length) return
    clipboardReadVersion.current++
    clipboardRef.current = structuredClone(objects)
    setCanPaste(true)
    void navigator.clipboard?.writeText(JSON.stringify({ format: 'maxlabel-objects', version: 1, objects })).catch(() => {})
    const ids = new Set(objects.map((object) => object.id))
    applyDocument((current) => ({ ...current, objects: [...ids].reduce((next, id) => removeObjectById(next, id), current.objects) }))
    patchTab(active, (tab) => ids.has(tab.selectedId ?? '') ? { ...tab, selectedId: null } : tab)
    setStatus(objects.length > 1 ? tr('status.objectsCut', { count: objects.length }) : tr('status.objectCut'))
  }, [active, applyDocument, doc, selectedObj, selectedIds, patchTab, setStatus, tr])

  const handleLockToggle = useCallback(() => {
    const ids = selectedIds()
    if (!ids.length) {
      setStatus(tr('status.selectObjectFirst'))
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
    setStatus(tr('status.lockToggled'))
  }, [applyDocument, selectedIds, setStatus, tr])

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
    duplicateAt,
    pasteClipboard,
    handleCut,
    handleLockToggle,
    moveSelectedBy,
    canPaste,
    setCanPaste
  }
}
