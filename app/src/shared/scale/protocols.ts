import type { ParsedScaleFrame, ScaleProtocol, WeighUnit } from './types'
import { normalizeUnitToken } from './units'

export interface ScaleProtocolSpec {
  id: ScaleProtocol
  label: string
  defaultBaud: string
  terminator: '\r\n' | '\r' | '\x03'
  parse(frame: string | Buffer): ParsedScaleFrame | null
}

const NUMBER_UNIT = /^([+-]?\s*\d+(?:[.,]\d+)?)\s*([A-Za-z斤]+)?\s*(G|N|T|PT|\?)?\s*$/

function numeric(value: string): number {
  return Number.parseFloat(value.replace(/\s+/g, '').replace(',', '.'))
}

function classify(value: number, stable: boolean): ParsedScaleFrame['status'] {
  if (value === 0) return 'zero'
  if (value < 0) return 'negative'
  return stable ? 'stable' : 'unstable'
}

function parseValueUnit(rest: string, requireUnit = false): ParsedScaleFrame | null {
  const match = NUMBER_UNIT.exec(rest.trim())
  if (!match) return null
  const value = numeric(match[1])
  if (!Number.isFinite(value)) return null
  const unit: WeighUnit | undefined = match[2] ? normalizeUnitToken(match[2]) : undefined
  if (requireUnit && !unit) return null
  if (match[2] && !unit) return null
  return { value, unit, status: classify(value, match[4] !== '?') }
}

function asText(frame: string | Buffer): string {
  return typeof frame === 'string' ? frame : frame.toString('latin1')
}

function stripTerminator(frame: string | Buffer): string {
  return asText(frame).replace(/[\r\n]+$/, '').replace(/\x03$/, '').replace(/^\x02/, '')
}

function parseBinary(frame: string | Buffer): ParsedScaleFrame | null {
  const bytes = Buffer.isBuffer(frame) ? frame : Buffer.from(frame, 'latin1')
  if (bytes.length < 12 || bytes[0] !== 0x02 || bytes[bytes.length - 1] !== 0x03) return null
  const status = bytes[1]
  const digits: string[] = []
  for (let i = 2; i < 8; i += 1) {
    const ch = bytes[i]
    if (ch < 0x30 || ch > 0x39) return null
    digits.push(String.fromCharCode(ch))
  }
  const decimals = bytes[8] - 0x30
  if (decimals < 0 || decimals > 4) return null
  const xor = bytes.slice(1, 9).reduce((acc, byte) => acc ^ byte, 0)
  const expected = `${((xor >> 4) & 0xf).toString(16)}${(xor & 0xf).toString(16)}`.toUpperCase()
  const actual = String.fromCharCode(bytes[9], bytes[10]).toUpperCase()
  if (expected !== actual) return null
  const overload = (status & 0x02) !== 0
  const negative = (status & 0x04) !== 0
  const stable = (status & 0x01) !== 0
  let value = Number(digits.join('')) / 10 ** decimals
  if (negative) value = -value
  if (overload) return { value, status: 'overload' }
  return { value, status: classify(value, stable) }
}

function parseStandard(frame: string | Buffer): ParsedScaleFrame | null {
  const text = stripTerminator(frame)
  if (/^OL$/i.test(text.trim())) return { value: 0, status: 'overload' }
  if (/^UL$/i.test(text.trim())) return { value: 0, status: 'underload' }
  const header = /^(ST|US)\s*,\s*(GS|NT)\s*,\s*(.*)$/i.exec(text)
  if (header) {
    const parsed = parseValueUnit(header[3], false)
    if (parsed && header[1].toUpperCase() === 'US') parsed.status = 'unstable'
    return parsed
  }
  return parseValueUnit(text, false)
}

function parseAd(frame: string | Buffer): ParsedScaleFrame | null {
  const text = stripTerminator(frame).trim()
  if (/^OL$/i.test(text)) return { value: 0, status: 'overload' }
  if (/^UL$/i.test(text)) return { value: 0, status: 'underload' }
  const header = /^(ST|US|OL|UL)\s*,\s*(.*)$/i.exec(text)
  if (!header) return parseValueUnit(text, false)
  if (header[1].toUpperCase() === 'OL') return { value: 0, status: 'overload' }
  if (header[1].toUpperCase() === 'UL') return { value: 0, status: 'underload' }
  const parsed = parseValueUnit(header[2], false)
  if (!parsed) return null
  if (header[1].toUpperCase() === 'US') parsed.status = 'unstable'
  return parsed
}

function parseMettler(frame: string | Buffer): ParsedScaleFrame | null {
  const text = stripTerminator(frame)
  const sics = /^S\s+([SD])\s+(.*)$/.exec(text)
  if (sics) {
    const parsed = parseValueUnit(sics[2], false)
    if (!parsed) return null
    if (sics[1] === 'D') parsed.status = 'unstable'
    return parsed
  }
  return parseStandard(text)
}

function parseOhaus(frame: string | Buffer): ParsedScaleFrame | null {
  const text = stripTerminator(frame)
  const unstable = text.includes('?')
  const parsed = parseValueUnit(text.replace(/\?/g, ' '), false)
  if (!parsed) return null
  if (unstable) parsed.status = 'unstable'
  return parsed
}

function parseSartorius(frame: string | Buffer): ParsedScaleFrame | null {
  return parseValueUnit(stripTerminator(frame), false)
}

function parseKasdaText(frame: string | Buffer): ParsedScaleFrame | null {
  const text = stripTerminator(frame)
  const header = /^(ST|US)\s*,\s*(GS|NT)\s*,\s*(.*)$/i.exec(text)
  if (header) {
    const parsed = parseValueUnit(header[3], false)
    if (parsed && header[1].toUpperCase() === 'US') parsed.status = 'unstable'
    return parsed
  }
  const d2 = /^=([+-]?\d+(?:[.,]\d+)?)=$/.exec(text)
  if (d2) {
    const value = numeric(d2[1])
    return Number.isFinite(value) ? { value, status: classify(value, true) } : null
  }
  return parseStandard(text)
}

function parseKasda(frame: string | Buffer): ParsedScaleFrame | null {
  const bytes = Buffer.isBuffer(frame) ? frame : null
  if (bytes && bytes[0] === 0x02) return parseBinary(bytes)
  if (typeof frame === 'string' && frame.startsWith('\x02')) return parseBinary(frame)
  return parseKasdaText(typeof frame === 'string' ? frame : frame.toString('latin1'))
}

export const SCALE_PROTOCOLS: Record<ScaleProtocol, ScaleProtocolSpec> = {
  standard: { id: 'standard', label: 'Standard continuous', defaultBaud: '9600', terminator: '\r\n', parse: parseStandard },
  ad: { id: 'ad', label: 'A&D', defaultBaud: '9600', terminator: '\r\n', parse: parseAd },
  mettler: { id: 'mettler', label: 'Mettler Toledo', defaultBaud: '9600', terminator: '\r\n', parse: parseMettler },
  ohaus: { id: 'ohaus', label: 'Ohaus', defaultBaud: '9600', terminator: '\r\n', parse: parseOhaus },
  sartorius: { id: 'sartorius', label: 'Sartorius', defaultBaud: '9600', terminator: '\r\n', parse: parseSartorius },
  kasda: { id: 'kasda', label: 'KASDA', defaultBaud: '9600', terminator: '\x03', parse: parseKasda },
  tonde: { id: 'tonde', label: 'TONDE', defaultBaud: '9600', terminator: '\x03', parse: parseKasda },
  custom: {
    id: 'custom',
    label: 'Custom',
    defaultBaud: '9600',
    terminator: '\r\n',
    parse: (frame) => parseValueUnit(stripTerminator(typeof frame === 'string' ? frame : frame.toString('latin1')), true)
  }
}
