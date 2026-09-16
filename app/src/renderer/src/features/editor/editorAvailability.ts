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
}

export function editorAvailability(input: EditorAvailabilityInput): EditorAvailability {
  const hasDocument = !input.isStart
  const hasSelection = hasDocument && input.selectionCount > 0
  return {
    hasDocument,
    hasDatabase: hasDocument && input.hasDatabase,
    hasSelection,
    canGroup: hasSelection && input.selectionCount >= 2,
    canUngroup: hasSelection && input.selectionCount === 1 && input.selectedGroup,
    canDatabaseNavigate: hasDocument && input.hasDatabase
  }
}
