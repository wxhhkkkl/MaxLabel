/**
 * 点选「起始标签」：点已选中的那一格＝取消（回到第 1 个标签），否则选中它。
 * 起始标签之前的格子会被置灰禁用，没有这个回到 1 的入口就再也退不回来。
 */
export function nextStartLabel(current: number, position: number): number {
  return position === current ? 1 : position
}
