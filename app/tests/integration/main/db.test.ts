import { rmSync, writeFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type { DbConnectionConfig } from '@shared/domain/printer'

interface BridgeHarness {
  mode: 'echo' | 'error' | 'invalid' | 'no-stderr'
  scripts: Set<string>
  writeFile(path: string, content: string, encoding: string): Promise<void>
  rm(path: string, options?: { force?: boolean }): Promise<void>
}

vi.mock('fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...original,
    writeFile: (...args: Parameters<typeof original.writeFile>) =>
      (globalThis as { __dbBridgeTest?: BridgeHarness }).__dbBridgeTest!.writeFile(args[0] as string, args[1] as string, args[2] as string),
    rm: (...args: Parameters<typeof original.rm>) =>
      (globalThis as { __dbBridgeTest?: BridgeHarness }).__dbBridgeTest!.rm(args[0] as string, args[1] as { force?: boolean })
  }
})

vi.mock('@main/connectionSecrets', () => ({
  readConnectionSecret: vi.fn(async () => ''),
  isAutomaticQueryApproved: vi.fn(async () => false)
}))

import { isAutomaticQueryApproved, readConnectionSecret } from '@main/connectionSecrets'
import { buildConnectionString, cancelDbQuery, dbQuery } from '@main/db'

const dsn: DbConnectionConfig = { id: 'pending', name: '测试库', driver: 'dsn', dsn: 'test' }

it('cancels an automatic query while its approval is being checked', async () => {
  let finishApproval!: (approved: boolean) => void
  vi.mocked(isAutomaticQueryApproved).mockReturnValueOnce(new Promise((resolve) => { finishApproval = resolve }))
  const query = dbQuery(dsn, 'SELECT 1', 'pending-approval', true)
  expect(cancelDbQuery('pending-approval')).toBe(true)
  await expect(query).resolves.toMatchObject({ ok: false, rows: [], error: '查询已取消' })
  finishApproval(true)
  await Promise.resolve()
  expect(readConnectionSecret).not.toHaveBeenCalled()
})

describe('database connection strings', () => {
  it('builds SQL Server, MySQL and DSN strings with brace escaping', () => {
    const base: DbConnectionConfig = { id: 'db', name: '库', driver: 'sqlserver', authMode: 'sql', server: 'srv', database: 'data', user: 'u', password: 'p;w}d' }
    expect(buildConnectionString(base)).toContain('Uid={u}')
    expect(buildConnectionString(base)).toContain('Pwd={p;w}}d}')
    expect(buildConnectionString({ ...base, authMode: 'windows' })).toContain('Trusted_Connection=yes')
    expect(buildConnectionString({ ...base, driver: 'mysql' })).toContain('Driver={MySQL ODBC 8.0 Unicode Driver}')
    // SQLite 改走内置驱动（node:sqlite），不再经过 ODBC 连接串
    expect(() => buildConnectionString({ ...base, driver: 'sqlite', filePath: 'C:\\data\\db.sqlite' })).toThrow(/SQLite/)
    expect(buildConnectionString({ ...base, driver: 'dsn', dsn: 'MyDSN' })).toContain('DSN={MyDSN}')
    expect(() => buildConnectionString({ ...base, server: 'bad\nserver' })).toThrow(/非法控制字符/)
  })
})

describe.skipIf(process.platform !== 'win32')('PowerShell ODBC bridge (Windows)', () => {
  it('cancels while loading credentials without preparing a bridge script', async () => {
    const writeFile = vi.fn()
    const holder = globalThis as { __dbBridgeTest?: BridgeHarness }
    holder.__dbBridgeTest = { mode: 'echo', scripts: new Set(), writeFile, rm: vi.fn() }
    let finishCredential!: (password: string) => void
    vi.mocked(readConnectionSecret).mockReturnValueOnce(new Promise((resolve) => { finishCredential = resolve }))
    try {
      const query = dbQuery(dsn, 'SELECT 1', 'pending-credential')
      expect(cancelDbQuery('pending-credential')).toBe(true)
      await expect(query).resolves.toMatchObject({ ok: false, rows: [], error: '查询已取消' })
      finishCredential('test')
      await Promise.resolve()
      expect(writeFile).not.toHaveBeenCalled()
    } finally {
      finishCredential('')
      delete holder.__dbBridgeTest
    }
  })

  it('round-trips UTF-8 stdin/stdout, reports Chinese errors and rejects invalid UTF-8', async () => {
    const harness: BridgeHarness = {
      mode: 'echo',
      scripts: new Set(),
      async writeFile(path, content, encoding) {
        expect(content.startsWith('\uFEFF')).toBe(true)
        const prelude = content.slice(0, content.indexOf('Add-Type'))
        expect(prelude).toMatch(/InputEncoding/)
        expect(prelude).toMatch(/OutputEncoding/)
        const body =
          harness.mode === 'invalid'
            ? '[Console]::OpenStandardOutput().Write([byte[]]@(255), 0, 1)'
            : harness.mode === 'error'
              ? "throw '中文错误：数据库不可用'"
              : harness.mode === 'no-stderr'
                ? 'exit 7'
                : "ConvertTo-Json -InputObject @(@{query=$p.query;connection=$p.connectionString;literal='中文列名与数据'}) -Depth 3 -Compress"
        harness.scripts.add(path)
        writeFileSync(path, prelude + body, encoding as BufferEncoding)
      },
      async rm(path, options) {
        harness.scripts.delete(path)
        rmSync(path, options)
      }
    }
    ;(globalThis as { __dbBridgeTest?: BridgeHarness }).__dbBridgeTest = harness

    try {
      const connection: DbConnectionConfig = { id: 'encoding', name: '库', driver: 'dsn', dsn: '中文数据源', user: '用户', password: '中文口令🙂' }
      const query = "SELECT '中文🙂' AS [名称]"
      const result = await dbQuery(connection, query)
      expect(result.ok, result.error).toBe(true)
      expect(result.rows[0].query).toBe(query)
      expect(result.rows[0].literal).toBe('中文列名与数据')
      expect(result.rows[0].connection).toMatch(/中文数据源/)
      expect(result.rows[0].connection).toMatch(/中文口令🙂/)

      harness.mode = 'error'
      const failed = await dbQuery(connection, query)
      expect(failed.ok).toBe(false)
      expect(failed.error).toMatch(/中文错误/)

      harness.mode = 'invalid'
      const invalid = await dbQuery(connection, query)
      expect(invalid.ok).toBe(false)

      harness.mode = 'no-stderr'
      await expect(dbQuery(connection, query)).resolves.toMatchObject({ ok: false, error: expect.stringContaining('7') })
      expect(harness.scripts.size).toBe(0)
    } finally {
      delete (globalThis as { __dbBridgeTest?: BridgeHarness }).__dbBridgeTest
      for (const path of harness.scripts) rmSync(path, { force: true })
    }
  }, 30_000)
})
