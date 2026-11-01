import type * as fabric from 'fabric'

/**
 * 在 Fabric 对象树（含组合子对象）里按 dataId 查对象。
 * `root` 是顶层对象/所属组合，用于选中、包围盒等只能作用于顶层对象的场景。
 */
export function findFabricObjectById(objects: fabric.Object[], id: string, root?: fabric.Object): { object: fabric.Object; root: fabric.Object } | undefined {
  for (const object of objects) {
    if ((object as fabric.Object & { dataId?: string }).dataId === id) return { object, root: root ?? object }
    if (object.type === 'group') {
      const nested = findFabricObjectById((object as fabric.Group).getObjects(), id, root ?? object)
      if (nested) return nested
    }
  }
  return undefined
}
