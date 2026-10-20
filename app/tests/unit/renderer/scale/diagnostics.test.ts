import { describe, expect, it } from 'vitest'
import { diagnosticFrames } from '@/features/scale/diagnostics'

describe('scale connection diagnostics', () => {
  it('keeps at most ten frames for display', () => {
    const frames = Array.from({ length: 14 }, (_, index) => `frame-${index}`)
    expect(diagnosticFrames(frames)).toHaveLength(10)
    expect(diagnosticFrames(frames)[9]).toBe('frame-9')
  })

  it('renders control characters visibly without dropping the frame text', () => {
    expect(diagnosticFrames(['ST,GS,+001.234kg\r\n'])).toEqual(['ST,GS,+001.234kg··'])
    expect(diagnosticFrames(['\x02\x03'])).toEqual(['··'])
  })
})
