/**
 * LabelShop editor command availability is shared by menus and toolbars.
 * Keeping the document/selection rules here prevents a visible command from
 * being enabled in one surface while disabled in another.
 */
export interface EditorAvailabilityInput {
  isStart: boolean
  hasDatabase: boolean
  selectionCount: number
  selectedGroup: boolean
}

export interface EditorAvailability {
  hasDocument: boolean
  hasDatabase: boolean
  hasSelection: boolean
  canGroup: boolean
  canUngroup: boolean
  canDatabaseNavigate: boolean
  /**
   * 帮助 `label_object_align_align.html`：「多数对齐选项是用于排列两个或多个标签对象彼此
   * 之间的位置。因此，除非在标签中选择了两个或多个对象，否则这些选项多数是不可用的（灰色）」。
   * 只作用于左/顶/右/底/垂直中齐/水平中齐这六项；「相对于标签的位置」与居中命令一个对象即可。
   */
  canAlignObjects: boolean
  /**
   * 帮助 `label_object_align_size.html`：「多数尺寸选项是用于更改两个或多个标签对象彼此
   * 之间的尺寸关系。因此，除非在标签中选择了两个或多个对象，否则这些选项多数是不可用的（灰色）」。
   */
  canSizeObjects: boolean
  /**
   * 帮助 `label_object_align_pos.html`：「这个命令与对齐命令不同，对齐命令需要选定两个或多个
   * 对象，而这个命令至少需要选定三个对象」——间距命令的门槛比对齐更高。
   */
  canDistribute: boolean
}

export function editorAvailability(input: EditorAvailabilityInput): EditorAvailability {
  const hasDocument = !input.isStart
  const hasSelection = hasDocument && input.selectionCount > 0
  const two = hasSelection && input.selectionCount >= 2
  return {
    hasDocument,
    hasDatabase: hasDocument && input.hasDatabase,
    hasSelection,
    canGroup: two,
    canUngroup: hasSelection && input.selectionCount === 1 && input.selectedGroup,
    canDatabaseNavigate: hasDocument && input.hasDatabase,
    canAlignObjects: two,
    canSizeObjects: two,
    canDistribute: hasSelection && input.selectionCount >= 3
  }
}
