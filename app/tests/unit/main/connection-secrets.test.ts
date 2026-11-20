import { describe, expect, it, vi } from 'vitest'
import type { DbConnectionConfig } from '@shared/domain/printer'

vi.mock('@main/secureJsonStore', () => {
  const store = { secrets: { 'connection-1': 'legacy-password' } }
  return {
    readSecureJson: async () => store,
    updateSecureJson: async (_file: string, _fallback: object, _message: string, mutate: (data: object) => void) => mutate(store),
    encryptSecureText: (value: string) => 'enc:' + value,
    decryptSecureText: (value: string) => value.slice(4)
  }
})

import { isAutomaticQueryApproved, readConnectionSecret, saveConnectionSecret } from '@main/connectionSecrets'

describe('database connection grants', () => {
  it('binds the stored password to the complete connection and approval to the saved SQL', async () => {
    const connection: DbConnectionConfig = {
      id: 'connection-1', name: 'test', driver: 'mysql', server: 'inventory.test', database: 'inventory',
      user: 'labels', sql: 'SELECT name FROM labels', autoRefresh: true
    }
    const other = { ...connection, server: 'other.test' }
    expect(await readConnectionSecret(connection)).toBe('')
    expect(await isAutomaticQueryApproved(connection, connection.sql!)).toBe(false)
    await saveConnectionSecret(connection, 'confirmed')
    expect(await readConnectionSecret(connection)).toBe('confirmed')
    expect(await readConnectionSecret(other)).toBe('')
    expect(await isAutomaticQueryApproved(connection, connection.sql!)).toBe(true)
    expect(await isAutomaticQueryApproved(connection, 'SELECT other FROM labels')).toBe(false)
    expect(await isAutomaticQueryApproved(other, connection.sql!)).toBe(false)
    await saveConnectionSecret({ ...connection, autoRefresh: false })
    expect(await readConnectionSecret(connection)).toBe('confirmed')
    expect(await isAutomaticQueryApproved(connection, connection.sql!)).toBe(false)
  })
})
