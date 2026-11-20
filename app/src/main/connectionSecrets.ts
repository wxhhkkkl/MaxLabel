import { createHash } from 'node:crypto'
import type { DbConnectionConfig } from '../shared/domain/printer'
import { decryptSecureText, encryptSecureText, readSecureJson, updateSecureJson } from './secureJsonStore'

interface ConnectionGrant {
  password?: string
  approvedQuery?: string
}

interface SecretStore { connections?: Record<string, ConnectionGrant> }

const FILE = 'connection-secrets.json'
const CORRUPT = '数据库凭据存储损坏'

function connectionKey(connection: DbConnectionConfig): string {
  return createHash('sha256').update(JSON.stringify([
    connection.id, connection.driver, connection.authMode ?? '', connection.server ?? '',
    connection.database ?? '', connection.user ?? '', connection.dsn ?? '', connection.filePath ?? ''
  ])).digest('hex')
}

function queryKey(sql: string): string {
  return createHash('sha256').update(sql).digest('hex')
}

export async function saveConnectionSecret(connection: DbConnectionConfig, password?: string, remove = false): Promise<void> {
  await updateSecureJson<SecretStore>(FILE, {}, CORRUPT, (store) => {
    const connections = store.connections ??= {}
    const key = connectionKey(connection)
    if (remove) {
      delete connections[key]
      return
    }
    const grant = { ...connections[key] }
    if (password !== undefined) {
      if (password) grant.password = encryptSecureText(password)
      else delete grant.password
    }
    if (connection.autoRefresh && connection.sql) grant.approvedQuery = queryKey(connection.sql)
    else delete grant.approvedQuery
    if (grant.password || grant.approvedQuery) connections[key] = grant
    else delete connections[key]
  })
}

async function readConnectionGrant(connection: DbConnectionConfig): Promise<ConnectionGrant | undefined> {
  return (await readSecureJson<SecretStore>(FILE, {}, CORRUPT)).connections?.[connectionKey(connection)]
}

export async function readConnectionSecret(connection: DbConnectionConfig): Promise<string> {
  const password = (await readConnectionGrant(connection))?.password
  return password ? decryptSecureText(password) : ''
}

export async function isAutomaticQueryApproved(connection: DbConnectionConfig, sql: string): Promise<boolean> {
  return (await readConnectionGrant(connection))?.approvedQuery === queryKey(sql)
}
