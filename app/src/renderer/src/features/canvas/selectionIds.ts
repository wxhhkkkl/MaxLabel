/**
 * 画布全量重建会换掉全部 fabric 对象。重建前按 id 抓整组选中，
 * 重建后原样装回去；只恢复主对象会把多选降成单选，
 * 对齐/尺寸/间距命令用一次就掉选，无法连续操作。
 */
export function activeSelectionIds(objects: ReadonlyArray<unknown>): string[] {
  return objects
    .map((object) => {
      const dataId = (object as { dataId?: unknown } | null | undefined)?.dataId
      return dataId == null ? '' : String(dataId)
    })
    .filter((id) => id !== '' && !id.startsWith('__'))
}

/** 重建后要恢复的选中集：完整多选优先，画布没有活动选中时退回模型里的单个主选中。 */
export function selectionIdsToRestore(
  activeIds: readonly string[],
  primaryId: string | null | undefined
): string[] {
  const ids = [...new Set(activeIds.filter((id) => id !== '' && !id.startsWith('__')))]
  if (ids.length) return ids
  return primaryId && !primaryId.startsWith('__') ? [primaryId] : []
}
