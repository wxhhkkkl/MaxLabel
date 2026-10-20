import type { KeyboardSource } from '../../../../shared/domain'

/**
 * Switch a keyboard source to electronic-scale input and seed every serial
 * setting the editor displays, so the visible port is the one the reader opens.
 * An explicitly cleared port stays empty (the read then reports `error.scalePort`).
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
