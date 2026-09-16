import { useCallback } from 'react'
import type * as fabric from 'fabric'
import type { LabelDoc, LabelObject } from '../../../../shared/domain'
import type { DocTab } from '../workspace/useDocumentWorkspace'
import type { AlignMode, CenterMode, DistMode, OrderMode, RotateMode, SameMode, SnapEdge } from '../../editor/AlignBar'
import { alignObjects, centerObjects, distributeObjects, groupObjects, reorderObjectsDeep, resizeObjects, rotateObjects, snapObjects, ungroupObjects } from './operations'
import { findObjectById, updateObjectById } from '../../../../shared/domain/objects'
import { uid } from '../../types'

interface Deps {
  active: string
  activeTab?: DocTab
  doc?: LabelDoc
  canvasRef: { current: fabric.Canvas | null }
  patchTab: (key: string, updater: (tab: DocTab) => DocTab) => void
  applyDocument: (updater: (doc: LabelDoc) => LabelDoc, options?: { coalesceKey?: string }) => void
  setStatus: (status: string) => void
}

/** Editor transforms are kept outside App so menu, toolbar and context-menu actions share one implementation. */
export function useEditorTransformCommands({ active, activeTab, doc, canvasRef, patchTab, applyDocument, setStatus }: Deps) {
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

  const transformSelected = useCallback((fn: (objects: LabelObject[]) => LabelObject[]) => {
    const ids = new Set(selectedIds())
    if (!ids.size) {
      setStatus('请先选中对象')
      return
    }
    applyDocument((current) => {
      const selected = [...ids].map((id) => findObjectById(current.objects, id)).filter((object): object is LabelObject => !!object)
      if (!selected.length) return current
      const mapped = fn(selected)
      let objects = current.objects
      for (const object of mapped) objects = updateObjectById(objects, object.id, object)
      return { ...current, objects }
    })
  }, [selectedIds, applyDocument, setStatus])

  const handleAlign = useCallback((mode: AlignMode) => {
    transformSelected((selected) => alignObjects(selected, mode))
    setStatus('已对齐')
  }, [transformSelected, setStatus])

  // 帮助 menu_align.html / menu_context.html：「左旋90度」= 逆时针旋转 90°，「右旋90度」= 顺时针旋转 90°。
  // 屏幕坐标 y 轴向下，rotateObjects 的正角度在视觉上是顺时针，故左旋传 270、右旋传 90（各调用点同此口径）。
  const handleRotate = useCallback((deg: RotateMode) => {
    transformSelected((selected) => rotateObjects(selected, deg))
    setStatus(deg === 270 ? '已左旋 90°' : deg === 90 ? '已右旋 90°' : `已旋转 ${deg}°`)
  }, [transformSelected, setStatus])

  const handleSame = useCallback((mode: SameMode) => {
    transformSelected((selected) => resizeObjects(selected, mode))
    setStatus('已统一尺寸')
  }, [transformSelected, setStatus])

  const handleCenter = useCallback((mode: CenterMode) => {
    if (!doc) return
    transformSelected((selected) => centerObjects(selected, mode, doc))
    setStatus(mode === 'h' ? '水平居中（相对标签）' : '垂直居中（相对标签）')
  }, [doc, transformSelected, setStatus])

  const handleDist = useCallback((mode: DistMode) => {
    transformSelected((selected) => distributeObjects(selected, mode))
    setStatus(mode === 'h' ? '水平间距相同' : '垂直间距相同')
  }, [transformSelected, setStatus])

  const handleOrder = useCallback((mode: OrderMode) => {
    const ids = new Set(selectedIds())
    if (!ids.size) {
      setStatus('请先选中对象')
      return
    }
    applyDocument((current) => {
      return { ...current, objects: reorderObjectsDeep(current.objects, ids, mode) }
    })
    setStatus('已调整对象顺序')
  }, [selectedIds, applyDocument, setStatus])

  const handleSnap = useCallback((edge: SnapEdge) => {
    if (!doc) return
    transformSelected((selected) => snapObjects(selected, edge, doc))
    setStatus('已移动到标签边缘')
  }, [doc, transformSelected, setStatus])

  const handleGroup = useCallback(() => {
    const ids = selectedIds()
    if (ids.length < 2) {
      setStatus('组合需要选中至少 2 个对象（按住 Ctrl 多选或全选）')
      return
    }
    const groupId = uid()
    applyDocument((current) => {
      return { ...current, objects: groupObjects(current.objects, new Set(ids), groupId).objects }
    })
    patchTab(active, (tab) => ({ ...tab, selectedId: groupId }))
    setStatus('已组合 ' + ids.length + ' 个对象')
  }, [selectedIds, applyDocument, patchTab, active, setStatus])

  const handleUngroup = useCallback(() => {
    const ids = selectedIds()
    if (!ids.length) {
      setStatus('请先选中组合对象')
      return
    }
    applyDocument((current) => {
      const objects = ungroupObjects(current.objects, new Set(ids))
      return objects === current.objects ? current : { ...current, objects }
    })
    patchTab(active, (tab) => ({ ...tab, selectedId: null }))
    setStatus('已取消组合')
  }, [selectedIds, applyDocument, patchTab, active, setStatus])

  return { selectedIds, transformSelected, handleAlign, handleRotate, handleSame, handleCenter, handleDist, handleOrder, handleSnap, handleGroup, handleUngroup }
}
