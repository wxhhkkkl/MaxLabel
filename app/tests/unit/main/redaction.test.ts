import { describe, expect, it } from 'vitest'
import { redactTemplateJson } from '@main/ipc/validation'
import { redactDocumentSecrets } from '@shared/domain/document'

const doc = {
  objects: [
    { id: 'r1', type: 'rfid', name: 'RFID', accessPwd: '1234', killPwd: '5678' },
    { id: 't1', type: 'text', name: '文字', accessPwd: 'keep-me' }
  ],
  connections: { db: { host: 'db.local', password: 'secret' } }
}

describe('template redaction', () => {
  it('strips database and RFID secrets before persistence', () => {
    const safe = redactDocumentSecrets(doc as never) as unknown as typeof doc
    expect(safe.connections.db).toEqual({ host: 'db.local' })
    expect(safe.objects[0]).toEqual({ id: 'r1', type: 'rfid', name: 'RFID' })
    expect(safe.objects[1]).toEqual({ id: 't1', type: 'text', name: '文字', accessPwd: 'keep-me' })
  })

  it('applies the same redaction to msdx envelopes', () => {
    const json = JSON.stringify({ format: 'maxlabel-msdx', version: 2, app: 'MaxLabel', doc })
    const parsed = JSON.parse(redactTemplateJson(json))
    expect(parsed.doc.connections.db).toEqual({ host: 'db.local' })
    expect(parsed.doc.objects[0]).toEqual({ id: 'r1', type: 'rfid', name: 'RFID' })
  })
})
