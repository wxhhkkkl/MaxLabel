import type { KeyboardSource } from '../../../../shared/domain'

/**
 * Switch a keyboard source to electronic-scale input and seed the label-level
 * weighing defaults (unit / decimals).
 *
 * ⚠️ 020：协议 / 端口 / 速率是**设备属性**，已改为全局一份（见 `options/电子称`）。
 * 这里仍会补上旧字段，只为兼容既有模板与序列化形状；读取链路不再使用它们。
 */
export function withWeighDefaults(source: KeyboardSource): KeyboardSource {
  return {
    ...source,
    inputDevice: 'weigh',
    weighProtocol: source.weighProtocol ?? 'kasda',
    weighPort: source.weighPort ?? 'COM1',
    weighBaud: source.weighBaud ?? '9600',
    weighUnit: source.weighUnit ?? 'kg',
    weighDecimals: source.weighDecimals ?? 2
  }
}
