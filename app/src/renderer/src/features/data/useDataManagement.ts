import { useCallback } from 'react'
import type { Dataset, DbConnectionConfig, LabelDoc } from '../../../../shared/domain'
import { normalizeDataset, uid } from '../../../../shared/domain'
import { renameDatasetFieldReferences, replaceDatasetReferences } from '../../../../shared/domain/objects'
import type { DocTab } from '../workspace/useDocumentWorkspace'

interface Deps {
  doc?: LabelDoc
  active: string
  tabsRef: { current: DocTab[] }
  dbSecretOperationsRef: { current: Map<string, Promise<void>> }
  patchDocument: (key: string, patch: (doc: LabelDoc) => LabelDoc) => void
  applyDocument: (patch: (doc: LabelDoc) => LabelDoc, options?: { coalesceKey?: string }) => void
  resetMutationGrouping: () => void
  saveDbSecret: (id: string, password?: string) => Promise<void>
  setStatus: (status: string) => void
}

export function useDataManagement({ doc, active, tabsRef, dbSecretOperationsRef, patchDocument, applyDocument, resetMutationGrouping, saveDbSecret, setStatus }: Deps) {
  const refreshAutoDb = useCallback(async (sourceDoc: LabelDoc | undefined = doc, tabKey: string = active, expectedRevision?: number, signal?: AbortSignal): Promise<{ doc: LabelDoc | undefined; error: string | null; revision?: number }> => {
    if (!sourceDoc) return { doc: sourceDoc, error: null }
    let nextDoc = sourceDoc
    for (const connection of Object.values(sourceDoc.connections ?? {})) {
      if (!connection.autoRefresh || !connection.sql) continue
      await dbSecretOperationsRef.current.get(connection.id)?.catch(() => {})
      const requestId = uid()
      const cancelRequest = () => { void window.maxlabel.db.cancel(requestId).catch(() => {}) }
      signal?.addEventListener('abort', cancelRequest, { once: true })
      let result: Awaited<ReturnType<typeof window.maxlabel.db.query>>
      try {
        if (signal?.aborted) return { doc: sourceDoc, error: '数据库刷新已取消' }
        result = await window.maxlabel.db.query({ ...connection }, connection.sql, requestId)
      } catch (error) {
        return { doc: sourceDoc, error: `数据库刷新失败（${connection.name}）：${error instanceof Error ? error.message : String(error)}` }
      } finally {
        signal?.removeEventListener('abort', cancelRequest)
      }
      if (signal?.aborted) return { doc: sourceDoc, error: '数据库刷新已取消' }
      if (expectedRevision !== undefined && tabsRef.current.find((tab) => tab.key === tabKey)?.revision !== expectedRevision) return { doc: sourceDoc, error: '模板在数据库刷新期间已发生变化，已取消打印' }
      if (!result.ok) return { doc: sourceDoc, error: `数据库刷新失败（${connection.name}）：${result.error ?? '未知错误'}` }
      const name = connection.datasetName ?? connection.name
      const previous = nextDoc.datasets?.[name]
      const columns = result.rows.length ? Object.keys(result.rows[0]) : (previous?.columns ?? [])
      const rows = result.rows.map((row) => columns.map((column) => row[column] ?? ''))
      try {
        const dataset = normalizeDataset({ name, columns, rows }, name)
        nextDoc = { ...nextDoc, datasets: { ...(nextDoc.datasets ?? {}), [name]: dataset } }
      } catch (error) {
        return { doc: sourceDoc, error: `数据库刷新失败（${connection.name}）：${error instanceof Error ? error.message : String(error)}` }
      }
    }
    if (nextDoc === sourceDoc) return { doc: nextDoc, error: null }
    if (expectedRevision !== undefined && tabsRef.current.find((tab) => tab.key === tabKey)?.revision !== expectedRevision) return { doc: sourceDoc, error: '模板在数据库刷新期间已发生变化，已取消打印' }
    const currentRevision = tabsRef.current.find((tab) => tab.key === tabKey)?.revision ?? expectedRevision ?? 0
    resetMutationGrouping()
    patchDocument(tabKey, (current) => ({ ...current, datasets: nextDoc.datasets }))
    return { doc: nextDoc, error: null, revision: currentRevision + 1 }
  }, [active, dbSecretOperationsRef, doc, patchDocument, resetMutationGrouping, tabsRef])

  const handleDbRefresh = useCallback(async () => {
    try {
      const result = await refreshAutoDb()
      setStatus(result.error ?? '数据库已更新')
    } catch (error) {
      setStatus('数据库刷新失败：' + (error instanceof Error ? error.message : String(error)))
    }
  }, [refreshAutoDb, setStatus])

  const handleDataImport = useCallback((data: Dataset) => {
    try {
      const normalized = normalizeDataset(data, data.name)
      applyDocument((previous) => {
        let name = normalized.name
        let suffix = 2
        while (previous.datasets?.[name]) name = `${normalized.name}(${suffix++})`
        return { ...previous, datasets: { ...(previous.datasets ?? {}), [name]: { ...normalized, name } } }
      })
      setStatus(`数据集已导入：${normalized.name}（${normalized.rows.length} 行）`)
    } catch (error) {
      setStatus('数据集导入失败：' + (error instanceof Error ? error.message : String(error)))
    }
  }, [applyDocument, setStatus])

  const handleDataDelete = useCallback((name: string) => {
    applyDocument((previous) => {
      const datasets = { ...(previous.datasets ?? {}) }
      delete datasets[name]
      return { ...previous, datasets, objects: replaceDatasetReferences(previous.objects, name) }
    })
    setStatus('已删除数据集：' + name)
  }, [applyDocument, setStatus])

  const handleImportReplace = useCallback((name: string, data: Dataset) => {
    try {
      const normalized = normalizeDataset({ ...data, name }, name)
      applyDocument((previous) => ({ ...previous, datasets: { ...(previous.datasets ?? {}), [name]: normalized } }))
    } catch (error) {
      setStatus('数据集更新失败：' + (error instanceof Error ? error.message : String(error)))
    }
  }, [applyDocument, setStatus])

  const handleConnectionSave = useCallback((connection: DbConnectionConfig) => {
    if (typeof connection.password === 'string') void saveDbSecret(connection.id, connection.password)
    const { password: _password, ...safeConnection } = connection
    applyDocument((previous) => ({ ...previous, connections: { ...(previous.connections ?? {}), [connection.id]: safeConnection } }), { coalesceKey: `connection:${connection.id}` })
  }, [applyDocument, saveDbSecret])

  const handleConnectionDelete = useCallback((id: string) => {
    void saveDbSecret(id)
    applyDocument((previous) => {
      const connections = { ...(previous.connections ?? {}) }
      delete connections[id]
      return { ...previous, connections }
    })
  }, [applyDocument, saveDbSecret])

  const handleRenameField = useCallback((name: string, field: string, newField: string) => {
    const dataset = doc?.datasets?.[name]
    if (!dataset) return
    const index = dataset.columns.indexOf(field)
    if (index < 0) return
    const columns = dataset.columns.slice()
    columns[index] = newField
    applyDocument((previous) => ({
      ...previous,
      datasets: { ...(previous.datasets ?? {}), [name]: { ...(previous.datasets?.[name] ?? dataset), columns } },
      objects: renameDatasetFieldReferences(previous.objects, name, field, newField)
    }), { coalesceKey: `dataset:${name}` })
  }, [applyDocument, doc])

  return { refreshAutoDb, handleDbRefresh, handleDataImport, handleDataDelete, handleImportReplace, handleConnectionSave, handleConnectionDelete, handleRenameField }
}
