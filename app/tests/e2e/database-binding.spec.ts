import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { launchApp, openFixture } from './fixtures/electron-app'

/** 只是一个「绑定悬空」的数据库文字对象：数据集 Database1 不在文档里。 */
function danglingDoc(name: string) {
  return {
    format: 'maxlabel-msdx',
    version: 2,
    app: 'MaxLabel',
    doc: {
      version: 2,
      name,
      widthMm: 60,
      heightMm: 40,
      objects: [{
        id: 'text-1', type: 'text', x: 4, y: 4, w: 40, h: 6, rotation: 0,
        fontFamily: 'Arial', fontSize: 4, bold: false, align: 'left', color: '#000000',
        source: { kind: 'database', dataset: 'Database1', field: '商品名称', recordOffset: 0, sampleValue: '占位值' }
      }]
    }
  }
}

test('数据集没引入时保留原名，选数据集后字段自动对上', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'maxlabel-db-bind-'))
  const path = join(dir, 'db-bind.msdx')
  // 模拟 lsdx 导入后的状态：数据源绑在 Database1 / 商品名称 上，但文档里没有这个数据集。
  await writeFile(path, JSON.stringify({
    format: 'maxlabel-msdx',
    version: 2,
    app: 'MaxLabel',
    doc: {
      version: 2,
      name: 'DB 绑定',
      widthMm: 60,
      heightMm: 40,
      datasets: { 数据: { name: '数据', columns: ['商品名称'], rows: [['多头仙子之吻'], ['母齐娅小姐']] } },
      objects: [{
        id: 'text-1', type: 'text', x: 4, y: 4, w: 40, h: 6, rotation: 0,
        fontFamily: 'Arial', fontSize: 4, bold: false, align: 'left', color: '#000000',
        source: { kind: 'database', dataset: 'Database1', field: '商品名称', recordOffset: 0 }
      }]
    }
  }), 'utf8')

  const launched = await launchApp({ MAXLABEL_OPEN_PATH: path })
  const w = launched.window
  try {
    await openFixture(w)
    await w.locator('[data-testid="template-edit-area"]').click({ position: { x: 60, y: 40 } })
    await w.keyboard.press('Control+A')
    await w.locator('[data-testid="format-props"]').click()
    await w.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="object-props-tab-datasource"]').click()

    const datasetSelect = w.locator('[data-testid="database-dataset"]')
    const fieldSelect = w.locator('[data-testid="database-field"]')
    // 缺席的数据集也要显示出来，否则下拉是空白、用户看不出原来绑的是什么。
    await expect(datasetSelect).toHaveValue('Database1')
    await expect(datasetSelect.locator('option[value="Database1"]')).toHaveText(/Database1（未导入）/)
    await expect(fieldSelect).toHaveValue('商品名称')

    // 引入数据后只要选数据集：字段名相同就自动保留绑定。
    await datasetSelect.selectOption('数据')
    await expect(datasetSelect).toHaveValue('数据')
    await expect(fieldSelect).toHaveValue('商品名称')
  } finally {
    await launched.close()
  }
})

test('新导入数据集时，悬空的字段绑定自动接上', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'maxlabel-db-auto-'))
  const path = join(dir, 'auto-link.msdx')
  const csv = join(dir, '价格表.csv')
  await writeFile(path, JSON.stringify(danglingDoc('自动接线')), 'utf8')
  await writeFile(csv, '商品名称,等级\n多头仙子之吻,B\n母齐娅小姐,C\n', 'utf8')

  const launched = await launchApp({ MAXLABEL_OPEN_PATH: path })
  const w = launched.window
  try {
    await openFixture(w)
    await w.locator('[data-menu-title="数据库(D)"]').click()
    await w.locator('[data-menu-item="设置数据库(D)..."]').click()
    await w.locator('[data-testid="database-import-types"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="database-import-select"]').click()
    await w.locator('input[type="file"][accept*=".csv"]').setInputFiles(csv)
    await w.locator('[data-testid="database-import-confirmation"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="database-import-confirm"]').click()
    await w.getByRole('button', { name: '关闭' }).last().click()

    await w.locator('[data-testid="template-edit-area"]').click({ position: { x: 60, y: 40 } })
    await w.keyboard.press('Control+A')
    await w.locator('[data-testid="format-props"]').click()
    await w.locator('[data-testid="object-props-dialog"]').waitFor({ timeout: 10_000 })
    await w.locator('[data-testid="object-props-tab-datasource"]').click()
    const datasetSelect = w.locator('[data-testid="database-dataset"]')
    // 新数据集里有同名字段 → 自动从 Database1 改绑过去，不用逐个对象重选。
    await expect(datasetSelect).not.toHaveValue('Database1')
    await expect(w.locator('[data-testid="database-field"]')).toHaveValue('商品名称')
  } finally {
    await launched.close()
  }
})
