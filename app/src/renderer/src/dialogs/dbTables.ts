// ---------- 数据库连接的「可使用的表」 ----------
// 连接成功后把表名列出来让用户直接选，省得手写表名 / SQL。
import type { DbDriver } from '../types'

/** 各驱动列出用户表的查询；DSN 无法预知底层是什么库，返回 null 表示不支持枚举。 */
export function tablesQuery(driver: DbDriver): string | null {
  switch (driver) {
    case 'sqlite':
      return "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    case 'mysql':
      return 'SHOW TABLES'
    case 'sqlserver':
      return "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
    case 'dsn':
      return null
  }
}

/** 标识符引号按驱动走：SQL Server 用 []，MySQL 用反引号，SQLite 用双引号。表名里的引号字符直接剔掉。 */
export function quoteIdentifier(driver: DbDriver, name: string): string {
  const bare = name.replace(/[`"[\]]/g, '')
  if (driver === 'mysql') return '`' + bare + '`'
  if (driver === 'sqlite') return '"' + bare + '"'
  return '[' + bare + ']'
}

export function selectAllFromTable(driver: DbDriver, table: string): string {
  return `SELECT * FROM ${quoteIdentifier(driver, table)}`
}

/** 枚举查询都是单列结果，取第一列即可。 */
export function tableNames(rows: Array<Record<string, string | null>>): string[] {
  return rows
    .map((row) => Object.values(row)[0])
    .filter((name): name is string => typeof name === 'string' && name.length > 0)
}
