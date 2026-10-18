import { describe, expect, it } from 'vitest'
import type { LabelDoc } from '@shared/domain/document'
import { fromDocJson, MSDX_FORMAT, MSDX_VERSION, toMsdx } from '@/io/msdx'
import { redactTemplateJson, validateTemplateJson, validateTemplatePath } from '@main/ipc/validation'
import { sampleDoc } from '../helpers/factories'

function withPassword(): LabelDoc {
  return {
    ...sampleDoc(),
    connections: { main: { id: 'main', name: '主库', driver: 'sqlserver', password: 'secret', server: 'db' } }
  }
}

describe('.msdx envelope', () => {
  it('writes the expected format, version and document', () => {
    const envelope = JSON.parse(toMsdx(sampleDoc()))
    expect(envelope.format).toBe(MSDX_FORMAT)
    expect(envelope.version).toBe(MSDX_VERSION)
    expect(envelope.app).toBe('MaxLabel')
    expect(envelope.doc.version).toBe(sampleDoc().version)
  })

  it('reads both the envelope and legacy bare JSON', () => {
    expect(fromDocJson(toMsdx(sampleDoc())).name).toBe(sampleDoc().name)
    expect(fromDocJson(JSON.stringify(sampleDoc())).name).toBe(sampleDoc().name)
  })

  it('rejects future envelope versions and malformed JSON', () => {
    expect(() => fromDocJson(JSON.stringify({ format: MSDX_FORMAT, version: 99, app: 'MaxLabel', doc: sampleDoc() }))).toThrow(/版本不受支持/)
    expect(() => fromDocJson('{bad json')).toThrow()
  })

  it('redacts connection passwords on serialization', () => {
    const text = toMsdx(withPassword())
    expect(text).not.toContain('secret')
    expect(JSON.parse(text).doc.connections.main.password).toBeUndefined()
    expect(JSON.parse(text).doc.connections.main.name).toBe('主库')
  })
})

describe('main-process template validation', () => {
  it('accepts msdx/json/lsdx paths and rejects other extensions', () => {
    expect(validateTemplatePath('C:/labels/a.msdx')).toBe('C:/labels/a.msdx')
    expect(validateTemplatePath('C:/labels/a.json')).toBe('C:/labels/a.json')
    expect(validateTemplatePath('C:/labels/a.lsdx')).toBe('C:/labels/a.lsdx')
    expect(() => validateTemplatePath('C:/labels/a.txt')).toThrow(/扩展名无效/)
    expect(() => validateTemplatePath('')).toThrow()
  })

  it('requires valid JSON and redacts passwords at the persistence boundary', () => {
    expect(() => validateTemplateJson('{bad')).toThrow(/不是有效 JSON/)
    expect(() => validateTemplateJson(42)).toThrow()

    const redacted = JSON.parse(redactTemplateJson(JSON.stringify({ format: MSDX_FORMAT, doc: withPassword() })))
    expect(redacted.doc.connections.main.password).toBeUndefined()
    expect(redacted.doc.connections.main.name).toBe('主库')
  })
})
