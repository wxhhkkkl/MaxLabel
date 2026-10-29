import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cancelDbQuery, dbQuery, dbTestConnection, isOdbcDriverMissing } from '@main/db'
import type { DbConnectionConfig } from '@shared/domain/printer'

let dir: string
let file: string

const sqlite = (over: Partial<DbConnectionConfig> = {}): DbConnectionConfig => ({
  id: 'sqlite-test',
  name: '本地库',
  driver: 'sqlite',
  filePath: file,
  ...over
})

/** 递归 CTE 造一个必定跑超 1 秒的查询，用来验证超时与取消。 */
const RUNAWAY_SQL = 'WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 10000000) SELECT count(*) AS n FROM c'

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'maxlabel-sqlite-'))
  file = join(dir, 'demo.sqlite')
  const db = new DatabaseSync(file)
  db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT, qty INTEGER, price REAL, note TEXT)')
  const insert = db.prepare('INSERT INTO items (name, qty, price, note) VALUES (?, ?, ?, ?)')
  insert.run('中文标签 A', 10, 1.5, null)
  insert.run('Hello Label B', 5, 9.9, '备注')
  db.close()
})

// 被 terminate 的 SQLite worker 要等当前语句返回后才真正退出，文件句柄释放也跟着延后
afterAll(async () => {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      rmSync(dir, { recursive: true, force: true })
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
})

describe('SQLite 走内置驱动（node:sqlite），不依赖 ODBC', () => {
  it('测试连接直接成功，无需任何 ODBC 驱动', async () => {
    const result = await dbTestConnection(sqlite())
    expect(result.ok, result.error).toBe(true)
  })

  it('文件不存在时明确报错，且不会顺手创建一个空库', async () => {
    const missing = join(dir, 'missing.sqlite')
    const result = await dbTestConnection(sqlite({ filePath: missing }))
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/不存在/)
    expect(existsSync(missing)).toBe(false)
  })

  it('查询结果按数据集约定返回：单元格一律为字符串，NULL 保留为 null', async () => {
    const result = await dbQuery(sqlite(), 'SELECT id, name, qty, price, note FROM items ORDER BY id')
    expect(result.ok, result.error).toBe(true)
    expect(result.rows).toEqual([
      { id: '1', name: '中文标签 A', qty: '10', price: '1.5', note: null },
      { id: '2', name: 'Hello Label B', qty: '5', price: '9.9', note: '备注' }
    ])
  })

  it('超长单元格被拒绝，与 ODBC 通路保持同一套规模限制', async () => {
    const db = new DatabaseSync(file)
    db.prepare('INSERT INTO items (name, note) VALUES (?, ?)').run('oversize', 'x'.repeat(1024 * 1024 + 1))
    db.close()
    const result = await dbQuery(sqlite(), 'SELECT note FROM items WHERE name = \'oversize\'')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/单元格/)
  })

  it('超时终止查询，不会把主进程卡住', async () => {
    const started = Date.now()
    const result = await dbQuery(sqlite({ timeoutSec: 1 }), RUNAWAY_SQL)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/超时/)
    expect(Date.now() - started).toBeLessThan(15_000)
  })

  it('可以取消在途查询', async () => {
    const requestId = 'cancel-sqlite'
    const pending = dbQuery(sqlite({ timeoutSec: 60 }), RUNAWAY_SQL, requestId)
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(cancelDbQuery(requestId)).toBe(true)
    const result = await pending
    expect(result.ok).toBe(false)
  })
})

describe('MySQL 走内置驱动（mysql2）', () => {
  it('ODBC 驱动缺失导致的报错被识别为可回退', () => {
    expect(isOdbcDriverMissing('[IM002] [Microsoft][ODBC 驱动程序管理器] 未发现数据源名称并且未指定默认驱动程序')).toBe(true)
    expect(isOdbcDriverMissing('ERROR [IM003] Specified driver could not be loaded')).toBe(true)
  })

  it('真正的连接/认证错误不触发回退', () => {
    expect(isOdbcDriverMissing('[28000] [MySQL][ODBC 8.0(w) Driver]Access denied for user')).toBe(false)
    expect(isOdbcDriverMissing('数据库查询超时')).toBe(false)
    expect(isOdbcDriverMissing(undefined)).toBe(false)
  })

  it('ODBC 不可用时会切到内置驱动，报出的是连接错误而不是「找不到驱动」', async () => {
    const config: DbConnectionConfig = {
      id: 'mysql-test',
      name: '远程库',
      driver: 'mysql',
      server: '127.0.0.1:1',
      database: 'demo',
      user: 'demo',
      password: 'demo',
      timeoutSec: 3
    }
    const result = await dbTestConnection(config)
    expect(result.ok).toBe(false)
    expect(result.error ?? '').not.toMatch(/IM002|IM003/)
    expect(result.error ?? '').not.toMatch(/未发现数据源名称/)
  }, 30_000)
})
