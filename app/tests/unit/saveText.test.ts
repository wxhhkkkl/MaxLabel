import { describe, expect, it } from 'vitest'
import { textFilePayload } from '../../src/renderer/src/io/saveText'

describe('textFilePayload', () => {
  it('preserves raw lsdx content byte-for-byte', () => {
    const content = '<?xml version="1.0"?>\r\n<labelshopdocument>\n  <label/>\r\n</labelshopdocument>'
    const payload = textFilePayload('面单.lsdx', content)

    expect(payload.name).toBe('面单.lsdx')
    expect(payload.content).toBe(content)
    expect(new TextEncoder().encode(payload.content)).toEqual(new TextEncoder().encode(content))
  })
})
