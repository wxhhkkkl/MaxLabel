import type { PortType } from '../../../../shared/domain/printer'

/**
 * 打印计划的起始槽位（1-based）。
 *
 * 起始标签只对 Windows 驱动打印有效；命令直连（USB/TCP/COM/文件）在对话框里
 * 明确不支持选择起始标签。此时必须忽略标签页里残留的 startLabel，否则会从
 * 第 N 枚开始排，表现为前面的标签空白。
 */
export function effectiveStartLabel(portType: PortType, startLabel: number): number {
  return portType === 'driver' ? startLabel : 1
}
