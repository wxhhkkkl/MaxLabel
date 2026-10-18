const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const { load } = require('./persistence-regression.cjs')

async function run() {
  if (process.platform !== 'win32') {
    console.log('SKIP real Windows PowerShell database bridge encoding checks')
    return
  }
  const scripts = new Set()
  let mode = 'echo'
  global.__dbBridgeTest = {
    async writeFile(path, content, encoding) {
      assert.ok(content.startsWith('\uFEFF'), 'Windows PowerShell source must have a UTF-8 BOM')
      const prelude = content.slice(0, content.indexOf('Add-Type'))
      assert.match(prelude, /InputEncoding/)
      assert.match(prelude, /OutputEncoding/)
      // Keep the real transport and encoding prelude, replacing only ODBC access.
      const body = mode === 'invalid'
        ? '[Console]::OpenStandardOutput().Write([byte[]]@(255), 0, 1)'
        : mode === 'error' ? "throw '中文错误：数据库不可用'"
          : "ConvertTo-Json -InputObject @(@{query=$p.query;connection=$p.connectionString;literal='中文列名与数据'}) -Depth 3 -Compress"
      scripts.add(path)
      await fs.writeFile(path, prelude + body, encoding)
    },
    async rm(path, options) { scripts.delete(path); await fs.rm(path, options) }
  }
  try {
    const { dbQuery } = await load('src/main/db.ts', {
      'fs/promises': 'export const writeFile=(...args)=>globalThis.__dbBridgeTest.writeFile(...args);export const rm=(...args)=>globalThis.__dbBridgeTest.rm(...args);',
      './connectionSecrets': 'export const readConnectionSecret=async()=>"";'
    })
    const connection = { id: 'encoding', driver: 'dsn', dsn: '中文数据源', user: '用户', password: '中文口令🙂' }
    const query = "SELECT '中文🙂' AS [名称]"
    const result = await dbQuery(connection, query)
    assert.equal(result.ok, true, result.error)
    assert.equal(result.rows[0].query, query, 'UTF-8 stdin round-trips SQL and non-BMP characters')
    assert.equal(result.rows[0].literal, '中文列名与数据', 'UTF-8 script literals and stdout round-trip')
    assert.match(result.rows[0].connection, /中文数据源/)
    assert.match(result.rows[0].connection, /中文口令🙂/)
    mode = 'error'
    const failed = await dbQuery(connection, query)
    assert.equal(failed.ok, false)
    assert.match(failed.error, /中文错误/)
    mode = 'invalid'
    const invalid = await dbQuery(connection, query)
    assert.equal(invalid.ok, false, 'invalid UTF-8 must fail instead of returning corrupted successful rows')
    assert.equal(scripts.size, 0, 'all generated bridge scripts are cleaned up')
    console.log('PASS real PowerShell UTF-8 stdin/stdout/source/errors, non-BMP text and invalid-byte rejection')
  } finally {
    delete global.__dbBridgeTest
    for (const path of scripts) await fs.rm(path, { force: true })
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1 })
