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
  tr: (key: string, params?: Record<string, string | number>) => string
}

export function useDataManagement({ doc, active, tabsRef, dbSecretOperationsRef, patchDocument, applyDocument, resetMutationGrouping, saveDbSecret, setStatus, tr }: Deps) {
  const refreshAutoDb = useCallback(async (sourceDoc: LabelDoc | undefined = doc, tabKey: string = active, expectedRevision?: number, signal?: AbortSignal): Promise<{ doc: LabelDoc | undefined; error: string | null; revision?: number }> => {
    if (!sourceDoc) return { doc: sourceDoc, error: null }
    const sourceTab = tabsRef.current.find((tab) => tab.key === tabKey)
    const revision = expectedRevision ?? sourceTab?.revision
    const changed = () => revision === undefined || tabsRef.current.find((tab) => tab.key === tabKey)?.revision !== revision
    const changeError = expectedRevision === undefined ? tr('status.dbChangedRefresh') : tr('status.dbChangedPrint')
    if (changed() || (expectedRevision === undefined && sourceTab?.doc !== sourceDoc)) return { doc: sourceDoc, error: changeError }
    let nextDoc = sourceDoc
    for (const connection of Object.values(sourceDoc.connections ?? {})) {
      if (!connection.autoRefresh || !connection.sql) continue
      await dbSecretOperationsRef.current.get(connection.id)?.catch(() => {})
      const requestId = uid()
      const cancelRequest = () => { void window.maxlabel.db.cancel(requestId).catch(() => {}) }
      signal?.addEventListener('abort', cancelRequest, { once: true })
      let result: Awaited<ReturnType<typeof window.maxlabel.db.query>>
      try {
        if (signal?.aborted) return { doc: sourceDoc, error: tr('status.dbRefreshCanceled') }
        result = await window.maxlabel.db.query({ ...connection }, connection.sql, requestId)
      } catch (error) {
        return { doc: sourceDoc, error: tr('status.dbRefreshFailedNamed', { name: connection.name, message: error instanceof Error ? error.message : String(error) }) }
      } finally {
        signal?.removeEventListener('abort', cancelRequest)
      }
      if (signal?.aborted) return { doc: sourceDoc, error: tr('status.dbRefreshCanceled') }
      if (changed()) return { doc: sourceDoc, error: changeError }
      if (!result.ok) return { doc: sourceDoc, error: tr('status.dbRefreshFailedNamed', { name: connection.name, message: result.error ?? tr('common.unknownError') }) }
      const name = connection.datasetName ?? connection.name
      const previous = nextDoc.datasets?.[name]
      const columns = result.rows.length ? Object.keys(result.rows[0]) : (previous?.columns ?? [])
      const rows = result.rows.map((row) => columns.map((column) => row[column] ?? ''))
      try {
        const dataset = normalizeDataset({ name, columns, rows }, name)
        nextDoc = { ...nextDoc, datasets: { ...(nextDoc.datasets ?? {}), [name]: dataset } }
      } catch (error) {
        return { doc: sourceDoc, error: tr('status.dbRefreshFailedNamed', { name: connection.name, message: error instanceof Error ? error.message : String(error) }) }
      }
    }
    if (nextDoc === sourceDoc) return { doc: nextDoc, error: null }
    if (changed()) return { doc: sourceDoc, error: changeError }
    const currentRevision = tabsRef.current.find((tab) => tab.key === tabKey)?.revision ?? expectedRevision ?? 0
    resetMutationGrouping()
    patchDocument(tabKey, (current) => ({ ...current, datasets: nextDoc.datasets }))
    return { doc: nextDoc, error: null, revision: currentRevision + 1 }
  }, [active, dbSecretOperationsRef, doc, patchDocument, resetMutationGrouping, tabsRef, tr])

  const handleDbRefresh = useCallback(async () => {
    try {
      const result = await refreshAutoDb()
      setStatus(result.error ?? tr('status.dbUpdated'))
    } catch (error) {
      setStatus(tr('status.dbRefreshFailed', { message: error instanceof Error ? error.message : String(error) }))
    }
  }, [refreshAutoDb, setStatus, tr])

  const handleDataImport = useCallback((data: Dataset) => {
    try {
      const normalized = normalizeDataset(data, data.name)
      applyDocument((previous) => {
        let name = normalized.name
        let suffix = 2
        while (previous.datasets?.[name]) name = `${normalized.name}(${suffix++})`
        return { ...previous, datasets: { ...(previous.datasets ?? {}), [name]: { ...normalized, name } } }
      })
      setStatus(tr('status.datasetImported', { name: normalized.name, rows: normalized.rows.length }))
    } catch (error) {
      setStatus(tr('status.datasetImportFailed', { message: error instanceof Error ? error.message : String(error) }))
    }
  }, [applyDocument, setStatus, tr])

  const handleDataDelete = useCallback((name: string) => {
    applyDocument((previous) => {
      const datasets = { ...(previous.datasets ?? {}) }
      delete datasets[name]
      return { ...previous, datasets, objects: replaceDatasetReferences(previous.objects, name) }
    })
    setStatus(tr('status.datasetDeleted', { name }))
  }, [applyDocument, setStatus, tr])

  const handleImportReplace = useCallback((name: string, data: Dataset) => {
    try {
      const normalized = normalizeDataset({ ...data, name }, name)
      applyDocument((previous) => ({ ...previous, datasets: { ...(previous.datasets ?? {}), [name]: normalized } }))
    } catch (error) {
      setStatus(tr('status.datasetUpdateFailed', { message: error instanceof Error ? error.message : String(error) }))
    }
  }, [applyDocument, setStatus, tr])

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
    const nextField = newField.trim()
    if (!nextField || nextField.length > 4096) {
      setStatus(tr('status.fieldRenameEmpty'))
      return
    }
    applyDocument((previous) => {
      const dataset = previous.datasets?.[name]
      const index = dataset?.columns.indexOf(field) ?? -1
      if (!dataset || index < 0 || nextField === field) return previous
      if (dataset.columns.some((column, columnIndex) => columnIndex !== index && column === nextField)) {
        setStatus(tr('status.fieldRenameExists', { name: nextField }))
        return previous
      }
      const columns = dataset.columns.slice()
      columns[index] = nextField
      return {
        ...previous,
        datasets: { ...previous.datasets, [name]: { ...dataset, columns } },
        objects: renameDatasetFieldReferences(previous.objects, name, field, nextField)
      }
    }, { coalesceKey: `dataset:${name}` })
  }, [applyDocument, setStatus])

  return { refreshAutoDb, handleDbRefresh, handleDataImport, handleDataDelete, handleImportReplace, handleConnectionSave, handleConnectionDelete, handleRenameField }
}
