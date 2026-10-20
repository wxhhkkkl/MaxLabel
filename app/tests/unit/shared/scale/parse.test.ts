import { describe, expect, it } from 'vitest'
import { parseScaleFrame } from '@shared/scale/parse'
import { kasdaBinaryFrame } from '../../../helpers/scale'

describe('scale protocol parsing', () => {
  it('parses standard continuous frames', () => {
    expect(parseScaleFrame('standard', 'ST,GS,+001.234kg\r\n')).toMatchObject({ value: 1.234, unit: 'kg', status: 'stable' })
    expect(parseScaleFrame('standard', 'US,GS,+001.234kg')).toMatchObject({ value: 1.234, status: 'unstable' })
    expect(parseScaleFrame('standard', 'ST,GS,+000.000kg')).toMatchObject({ value: 0, status: 'zero' })
    expect(parseScaleFrame('standard', 'ST,GS,-001.234kg')).toMatchObject({ value: -1.234, status: 'negative' })
    expect(parseScaleFrame('standard', 'ST,GS,+00x.234kg')).toBeNull()
  })

  it('parses A&D frames', () => {
    expect(parseScaleFrame('ad', 'ST,+001.234 g\r\n')).toMatchObject({ value: 1.234, unit: 'g', status: 'stable' })
    expect(parseScaleFrame('ad', 'US,+001.234 g')).toMatchObject({ status: 'unstable' })
    expect(parseScaleFrame('ad', 'OL')).toMatchObject({ status: 'overload' })
  })

  it('parses Mettler SICS frames', () => {
    expect(parseScaleFrame('mettler', 'S S  1.234 kg\r\n')).toMatchObject({ value: 1.234, unit: 'kg', status: 'stable' })
    expect(parseScaleFrame('mettler', 'S D  1.234 kg')).toMatchObject({ status: 'unstable' })
  })

  it('parses Ohaus frames and treats ? as unstable', () => {
    expect(parseScaleFrame('ohaus', '   1.234 kg G\r\n')).toMatchObject({ value: 1.234, unit: 'kg', status: 'stable' })
    expect(parseScaleFrame('ohaus', '   1.234 kg ? G\r\n')).toMatchObject({ status: 'unstable' })
  })

  it('parses Sartorius frames', () => {
    expect(parseScaleFrame('sartorius', '+  1.234 kg\r\n')).toMatchObject({ value: 1.234, unit: 'kg', status: 'stable' })
    expect(parseScaleFrame('sartorius', '-  1.234 kg')).toMatchObject({ status: 'negative' })
  })

  it('parses KASDA/TONDE text and binary frames', () => {
    expect(parseScaleFrame('kasda', 'ST,GS,+001.234kg\r\n')).toMatchObject({ value: 1.234, status: 'stable' })
    expect(parseScaleFrame('tonde', '=1.234=')).toMatchObject({ value: 1.234 })
    expect(parseScaleFrame('kasda', kasdaBinaryFrame(1.234, 3, true))).toMatchObject({ value: 1.234, status: 'stable' })
    expect(parseScaleFrame('tonde', kasdaBinaryFrame(1.234, 3, false))).toMatchObject({ status: 'unstable' })
    expect(parseScaleFrame('kasda', kasdaBinaryFrame(2, 3, true, false, true))).toMatchObject({ status: 'overload' })
  })

  it('parses custom frames strictly and rejects ambiguity', () => {
    expect(parseScaleFrame('custom', '  1.234 kg\r\n')).toMatchObject({ value: 1.234, unit: 'kg', status: 'stable' })
    expect(parseScaleFrame('custom', '1.234')).toBeNull()
    expect(parseScaleFrame('custom', 'no weight here')).toBeNull()
  })
})
