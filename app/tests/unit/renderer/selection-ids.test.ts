import { describe, expect, it } from 'vitest'
import { activeSelectionIds, selectionIdsToRestore } from '@/features/canvas/selectionIds'

describe('画布重建后的选中恢复', () => {
  it('抓取整组选中，忽略画布辅助对象', () => {
    expect(activeSelectionIds([{ dataId: 'a' }, { dataId: '__bg__' }, { dataId: 'b' }, {}])).toEqual(['a', 'b'])
  })

  it('重建后恢复完整多选，而不是只留主对象', () => {
    expect(selectionIdsToRestore(['a', 'b', 'c'], 'a')).toEqual(['a', 'b', 'c'])
  })

  it('画布没有活动选中时退回模型里的单个主选中', () => {
    expect(selectionIdsToRestore([], 'a')).toEqual(['a'])
    expect(selectionIdsToRestore([], null)).toEqual([])
  })

  it('辅助对象不会被当成待恢复的选中', () => {
    expect(selectionIdsToRestore(['__grid__'], '__bg__')).toEqual([])
  })
})
