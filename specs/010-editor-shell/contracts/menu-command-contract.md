# Contract: Menu and Command Wiring

**Feature**: `010-editor-shell` | **Date**: 2026-10-20

## Builder

```ts
buildLabelShopMenus(deps: LabelShopMenuDeps): {
  sections: MenuSection[]
  contextItems: MenuItem[]
}
```

- `deps.isStart` selects the start-page menu set; otherwise the editor set is returned.
- The same builder returns the right-click context items.
- When `deps.language === 'en-US'`, titles/labels are localized through `menu.en-US`;
  otherwise the Chinese labels are returned unchanged.

## Section order (editor)

1. 文件(F)
2. 编辑(E)
3. 查看(V)
4. 工具(T)
5. 排列(A)
6. 数据库(D)
7. 账户(A)
8. 云服务(C)
9. 选项(O)
10. 窗口(W)
11. 帮助(H)
12. 建议与反馈

Start-page sections and context items are separate collections and may contain a different
subset; they must not be assumed to follow the editor order.

## Item shape

```ts
interface MenuItem {
  label: string
  shortcut?: string
  disabled?: boolean
  checked?: boolean
  radio?: boolean
  divider?: boolean
  children?: MenuItem[]
  action?: () => void
}
```

- `shortcut` is display-only. Execution is owned by `useLabelShopShortcuts` and the toolbar
  key bindings.
- `divider` items have an empty label and no action.
- `checked`/`radio` reflect current state (panel visibility, theme, active tab).
- Unknown or missing state must not throw; the menu renders disabled or unchecked.

## Availability

- Document-dependent items use `deps.isStart` and `EditorAvailability`:
  - Save/close/print/preview/template settings require a document.
  - Group requires ≥2 selected objects; ungroup requires one selected group.
  - Align/size require ≥2; distribute requires ≥3.
  - Database navigation requires a document with a database.
- Busy print jobs disable print/preview.
- A LabelShop built-in printer disables “打印预览(V)”.
- Items explicitly marked `disabled: true` (for example “导出打印机指令文件(E)” in the
  current build) stay non-interactive even if they have an action.

## Action ownership

Menu actions call the same callbacks used by the toolbar and shortcuts; they must not
implement a second copy of a command. The menu module receives callbacks through
`LabelShopMenuDeps` and never imports renderer components or the print executor.

## Non-goals

- Adding/removing commands or changing their semantics.
- Changing the localisation catalog.
- Reordering sections for non-LabelShop reasons.
