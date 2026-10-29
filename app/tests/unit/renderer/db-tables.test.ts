import { describe, expect, it } from 'vitest'
import { quoteIdentifier, selectAllFromTable, tableNames, tablesQuery } from '@/dialogs/dbTables'

describe('列出可使用的表', () => {
  it('SQLite 读 sqlite_master，并排除 SQLite 自己的内部表', () => {
    const sql = tablesQuery('sqlite')
    expect(sql).toContain('sqlite_master')
    expect(sql).toContain("NOT LIKE 'sqlite_%'")
  })

  it('MySQL 用 SHOW TABLES，SQL Server 用 INFORMATION_SCHEMA', () => {
    expect(tablesQuery('mysql')).toBe('SHOW TABLES')
    expect(tablesQuery('sqlserver')).toContain('INFORMATION_SCHEMA.TABLES')
  })

  it('DSN 无法预知底层数据库，不支持枚举', () => {
    expect(tablesQuery('dsn')).toBeNull()
  })

  it('从单列结果里取表名，丢掉空值', () => {
    expect(tableNames([{ name: 'orders' }, { name: 'items' }, { name: null }])).toEqual(['orders', 'items'])
  })
})

describe('按驱动引用标识符', () => {
  it('SQL Server 用方括号，MySQL 用反引号，SQLite 用双引号', () => {
    expect(quoteIdentifier('sqlserver', 'orders')).toBe('[orders]')
    expect(quoteIdentifier('mysql', 'orders')).toBe('`orders`')
    expect(quoteIdentifier('sqlite', 'orders')).toBe('"orders"')
  })

  it('去掉表名里的引号字符，避免拼出非法 SQL', () => {
    expect(quoteIdentifier('sqlite', 'a"b`c]d[e')).toBe('"abcde"')
  })

  it('选表后生成整表查询', () => {
    expect(selectAllFromTable('sqlite', '中文表')).toBe('SELECT * FROM "中文表"')
    expect(selectAllFromTable('mysql', 'items')).toBe('SELECT * FROM `items`')
  })
})
