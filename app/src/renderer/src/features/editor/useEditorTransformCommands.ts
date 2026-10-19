import { useCallback } from 'react'
import type * as fabric from 'fabric'
import type { LabelDoc, LabelObject } from '../../../../shared/domain'
import type { DocTab } from '../workspace/useDocumentWorkspace'
import type { AlignMode, CenterMode, DistMode, OrderMode, RotateMode, SameMode, SnapEdge } from '../../editor/AlignBar'
import { alignObjects, centerObjects, distributeObjects, groupObjects, isPositionLocked, reorderObjectsDeep, resizeObjects, rotateObjects, snapObjects, ungroupObjects } from './operations'
import { findObjectById, updateObjectById } from '../../../../shared/domain/objects'
import { uid } from '../../types'
import { localizeErrorText } from '../../../../shared/i18n/errors.en-US'
import type { Language } from '../../../../shared/i18n/types'

interface Deps {
  active: string
  activeTab?: DocTab
  doc?: LabelDoc
  canvasRef: { current: fabric.Canvas | null }
  patchTab: (key: string, updater: (tab: DocTab) => DocTab) => void
  applyDocument: (updater: (doc: LabelDoc) => LabelDoc, options?: { coalesceKey?: string }) => void
  setStatus: (status: string) => void
  tr: (key: string, params?: Record<string, string | number>) => string
  language: Language
}

/** Editor transforms are kept outside App so menu, toolbar and context-menu actions share one implementation. */
export function useEditorTransformCommands({ active, activeTab, doc, canvasRef, patchTab, applyDocument, setStatus, tr, language }: Deps) {
  const selectedIds = useCallback((): string[] => {
    const fc = canvasRef.current
    if (fc) {
      const ids = fc.getActiveObjects()
        .filter((object: any) => !String(object.dataId).startsWith('__'))
        .map((object: any) => object.dataId)
      const requestedId = activeTab?.selectedId
      if (requestedId && doc && ids.length === 1 && ids[0] !== requestedId) {
        const activeObject = findObjectById(doc.objects, ids[0])
        // A layer-panel click on a child may leave its parent group as the
        // Fabric active object. Preserve the model selection in that case.
        if (activeObject?.type === 'group' && findObjectById(activeObject.children, requestedId)) return [requestedId]
      }
      if (ids.length) return ids
    }
    return activeTab?.selectedId ? [activeTab.selectedId] : []
  }, [activeTab?.selectedId, canvasRef, doc])

  const transformSelected = useCallback((fn: (objects: LabelObject[]) => LabelObject[], lockedHint?: string) => {
    const ids = new Set(selectedIds())
    if (!ids.size) {
      setStatus(tr('status.selectObjectFirst'))
      return
    }
    applyDocument((current) => {
      const selected = [...ids].map((id) => findObjectById(current.objects, id)).filter((object): object is LabelObject => !!object)
      if (!selected.length) return current
      // 帮助 label_object_align_pos.html：「位置被锁定的对象不能被移动」，
      // label_object_align_align.html 补充「所有的对齐命令对于具有位置锁定属性的对象不起作用」。
      const movable = selected.filter((object) => !isPositionLocked(object))
      if (!movable.length) {
        setStatus(lockedHint ?? tr('status.lockedMove'))
        return current
      }
      const mapped = fn(movable)
      let objects = current.objects
      for (const object of mapped) objects = updateObjectById(objects, object.id, object)
      return { ...current, objects }
    })
  }, [selectedIds, applyDocument, setStatus, tr])

  const handleAlign = useCallback((mode: AlignMode) => {
    transformSelected((selected) => alignObjects(selected, mode))
    setStatus(tr('status.aligned'))
  }, [transformSelected, setStatus, tr])

  // 帮助 menu_align.html / menu_context.html：「左旋90度」= 逆时针旋转 90°，「右旋90度」= 顺时针旋转 90°。
  // 屏幕坐标 y 轴向下，rotateObjects 的正角度在视觉上是顺时针，故左旋传 270、右旋传 90（各调用点同此口径）。
  const handleRotate = useCallback((deg: RotateMode) => {
    transformSelected((selected) => rotateObjects(selected, deg))
    setStatus(deg === 270 ? tr('status.rotatedLeft') : deg === 90 ? tr('status.rotatedRight') : tr('status.rotated', { deg }))
  }, [transformSelected, setStatus, tr])

  const handleSame = useCallback((mode: SameMode) => {
    try {
      transformSelected((selected) => resizeObjects(selected, mode))
      setStatus(tr('status.sizeUnified'))
    } catch (error) {
      setStatus(tr('status.sizeUnifyFailed', { message: localizeErrorText(language, error instanceof Error ? error.message : String(error)) }))
    }
  }, [transformSelected, setStatus, tr, language])

  const handleCenter = useCallback((mode: CenterMode) => {
    if (!doc) return
    transformSelected((selected) => centerObjects(selected, mode, doc))
    setStatus(mode === 'h' ? tr('status.centeredH') : tr('status.centeredV'))
  }, [doc, transformSelected, setStatus, tr])

  const handleDist = useCallback((mode: DistMode) => {
    transformSelected((selected) => distributeObjects(selected, mode))
    setStatus(mode === 'h' ? tr('status.distributedH') : tr('status.distributedV'))
  }, [transformSelected, setStatus, tr])

  const handleOrder = useCallback((mode: OrderMode) => {
    const ids = new Set(selectedIds())
    if (!ids.size) {
      setStatus(tr('status.selectObjectFirst'))
      return
    }
    applyDocument((current) => {
      return { ...current, objects: reorderObjectsDeep(current.objects, ids, mode) }
    })
    setStatus(tr('status.orderAdjusted'))
  }, [selectedIds, applyDocument, setStatus, tr])

  const handleSnap = useCallback((edge: SnapEdge) => {
    if (!doc) return
    transformSelected((selected) => snapObjects(selected, edge, doc))
    setStatus(tr('status.snapped'))
  }, [doc, transformSelected, setStatus, tr])

  const handleGroup = useCallback(() => {
    const ids = selectedIds()
    if (ids.length < 2) {
      setStatus(tr('status.groupNeedsTwo'))
      return
    }
    const groupId = uid()
    applyDocument((current) => {
      return { ...current, objects: groupObjects(current.objects, new Set(ids), groupId).objects }
    })
    patchTab(active, (tab) => ({ ...tab, selectedId: groupId }))
    setStatus(tr('status.objectsGrouped', { count: ids.length }))
  }, [selectedIds, applyDocument, patchTab, active, setStatus, tr])

  const handleUngroup = useCallback(() => {
    const ids = selectedIds()
    if (!ids.length) {
      setStatus(tr('status.selectGroupFirst'))
      return
    }
    applyDocument((current) => {
      const objects = ungroupObjects(current.objects, new Set(ids))
      return objects === current.objects ? current : { ...current, objects }
    })
    patchTab(active, (tab) => ({ ...tab, selectedId: null }))
    setStatus(tr('status.ungrouped'))
  }, [selectedIds, applyDocument, patchTab, active, setStatus, tr])

  return { selectedIds, transformSelected, handleAlign, handleRotate, handleSame, handleCenter, handleDist, handleOrder, handleSnap, handleGroup, handleUngroup }
}
