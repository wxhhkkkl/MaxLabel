import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  MallMember,
  PlatformContentItem,
  ShareContentItem,
  ShareFolderItem,
  ShareSpaceOverview
} from '../../../../shared/ipcContract'
import type { AppOptions } from '../../dialogs/OptionsDialog'
import Modal from '../../dialogs/Modal'
import ShareFolderMembersDialog from '../../dialogs/ShareFolderMembersDialog'
import { useI18n } from '../../features/i18n/useI18n'
import { fromDocJson } from '../../io/msdx'
import { renderLabelDataUrl } from '../../print/renderLabel'
import { cloudSectionState } from './profile'

export type StartSpace = 'platform' | 'personal' | 'enterprise'
type SpaceCategory = 'template' | 'image' | 'data'

const CATEGORY_TYPES: Record<SpaceCategory, number[]> = {
  template: [1],
  image: [5],
  data: [2, 3, 4]
}

const CATEGORY_EXTENSIONS: Record<SpaceCategory, string[]> = {
  template: ['msdx'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'],
  data: ['txt', 'xls', 'xlsx', 'csv']
}

/** 个人/企业空间没有后端小图时，最多生成这么多张本地预览，避免一次拉取/渲染过多。 */
const MAX_GENERATED_PREVIEWS = 24

function safePreviewUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  if (!text) return undefined
  if (text.startsWith('data:image/')) return text.length <= 1024 * 1024 ? text : undefined
  try {
    const url = new URL(text)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function sizeText(bytes?: number): string {
  if (!bytes) return '0 B'
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function contentTypeOf(filePath: string): number {
  const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.') + 1)
  if (ext === 'msdx') return 1
  if (ext === 'txt') return 2
  if (ext === 'xls' || ext === 'xlsx') return 3
  if (ext === 'csv') return 4
  return 5
}

function fileNameOf(filePath: string): string {
  const index = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'))
  return index >= 0 ? filePath.slice(index + 1) : filePath
}

const dialogButton = (primary = false): React.CSSProperties => ({
  padding: '7px 14px',
  borderRadius: 6,
  border: primary ? '1px solid #2E6E93' : '1px solid #D5D4CD',
  background: primary ? '#2E6E93' : '#fff',
  color: primary ? '#fff' : '#1A1B1C',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'inherit'
})

interface SpaceCardItem {
  id: number
  name: string
  contentType: number
  widthMm?: number
  heightMm?: number
  category?: string
  uploaderNickname?: string
  sizeBytes?: number
  thumb?: string | null
  canDelete?: boolean
}

function TypeIcon({ contentType }: { contentType: number }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true
  }
  if (contentType === 5) {
    return (
      <span className="start-cloud-type-icon is-image">
        <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="m5 17 5-5 4 4 2-2 3 3" /></svg>
      </span>
    )
  }
  if (contentType === 2) return <span className="start-cloud-type-icon is-text">TXT</span>
  if (contentType === 3) return <span className="start-cloud-type-icon is-excel">XLS</span>
  if (contentType === 4) return <span className="start-cloud-type-icon is-csv">CSV</span>
  return (
    <span className="start-cloud-type-icon is-template">
      <svg {...common}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 8h8M8 11h8M8 15h3M13 15h3M8 18h3" /></svg>
    </span>
  )
}

function FolderGlyph() {
  return (
    <svg className="start-space-folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  )
}

function UploadGlyph() {
  return (
    <svg className="start-space-folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  )
}

function PlusGlyph() {
  return (
    <svg className="start-space-folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function ContentThumb({ item }: { item: SpaceCardItem }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [item.thumb])
  const thumb = failed ? undefined : safePreviewUrl(item.thumb)
  if (thumb) {
    return <img src={thumb} alt={item.name} loading="lazy" onError={() => setFailed(true)} />
  }
  return <TypeIcon contentType={item.contentType} />
}

function SpaceCard({ item, deleteLabel, onOpen, onDelete }: {
  item: SpaceCardItem
  deleteLabel: string
  onOpen: () => void
  onDelete?: () => void
}) {
  const meta = [
    typeof item.sizeBytes === 'number' ? sizeText(item.sizeBytes) : '',
    typeof item.widthMm === 'number' && typeof item.heightMm === 'number' ? `${item.widthMm} × ${item.heightMm} mm` : '',
    item.category || '',
    item.uploaderNickname || ''
  ].filter(Boolean)
  return (
    <div
      className="start-cloud-card"
      role="button"
      tabIndex={0}
      data-testid="start-space-item"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onOpen()
      }}
    >
      <span className="start-cloud-thumb"><ContentThumb item={item} /></span>
      <span className="start-cloud-info">
        <span className="start-cloud-name">{item.name}</span>
        {meta.length > 0 && <span className="start-cloud-meta">{meta.join(' · ')}</span>}
      </span>
      {onDelete && (
        <button
          type="button"
          className="start-cloud-delete"
          data-testid="start-space-delete"
          aria-label={deleteLabel}
          title={deleteLabel}
          onClick={(event) => { event.stopPropagation(); onDelete() }}
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  )
}

interface Props {
  options: AppOptions
  member: MallMember | null
  space: StartSpace
  onLoad: (content: string) => void
  onLogin: () => void
}

/** 起始页右栏：平台 / 个人 / 企业共享空间的内容浏览与上传。 */
export default function StartSpacePanel({ options, member, space, onLoad, onLogin }: Props) {
  const { t } = useI18n()
  const context = useMemo(
    () => ({ baseUrl: options.mallBaseUrl, tenantId: options.mallTenantId }),
    [options.mallBaseUrl, options.mallTenantId]
  )
  const [category, setCategory] = useState<SpaceCategory>('template')
  const [search, setSearch] = useState('')
  const [platformCategory, setPlatformCategory] = useState('')
  const [overview, setOverview] = useState<ShareSpaceOverview | null>(null)
  const [items, setItems] = useState<ShareContentItem[]>([])
  const [platformAll, setPlatformAll] = useState<PlatformContentItem[]>([])
  const [platformItems, setPlatformItems] = useState<PlatformContentItem[]>([])
  const [folders, setFolders] = useState<ShareFolderItem[]>([])
  const [folderId, setFolderId] = useState<number | null>(null)
  const [mineView, setMineView] = useState(false)
  const [metaReady, setMetaReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [permissionsFolder, setPermissionsFolder] = useState<ShareFolderItem | null>(null)
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ShareContentItem | null>(null)
  const [previews, setPreviews] = useState<Record<number, string>>({})
  const previewAttempted = useRef<Set<number>>(new Set())

  // 切换空间时回到“模板”分类，并清掉上一个空间的状态。
  useEffect(() => {
    setCategory('template')
    setSearch('')
    setPlatformCategory('')
    setOverview(null)
    setItems([])
    setPlatformAll([])
    setPlatformItems([])
    setFolders([])
    setFolderId(null)
    setMineView(false)
    setMetaReady(false)
    setError('')
    setNotice('')
  }, [space])

  const loadMeta = useCallback(async () => {
    if (!options.mallBaseUrl || !member) {
      setMetaReady(false)
      return
    }
    setBusy(true)
    setError('')
    try {
      if (space === 'platform') {
        const all = await window.maxlabel.share.platform.page(context, { pageNo: 1, pageSize: 200 })
        if (!all.ok) {
          setError(all.error || t('start.spaceError'))
          return
        }
        setPlatformAll(all.items ?? [])
        setMetaReady(true)
        return
      }
      const summary = await window.maxlabel.share.overview(context)
      if (!summary.ok || !summary.overview) {
        setError(summary.error || t('start.spaceError'))
        return
      }
      setOverview(summary.overview)
      if (space === 'enterprise') {
        if (!summary.overview.enterprise?.seatActive) {
          setFolders([])
          setFolderId(null)
          setMineView(false)
          setMetaReady(true)
          return
        }
        const folderResult = await window.maxlabel.share.folders.list(context)
        if (!folderResult.ok) {
          setError(folderResult.error || t('start.spaceError'))
          return
        }
        const list = folderResult.items ?? []
        setFolders(list)
        if (list.length > 0) {
          setFolderId(list[0].id)
          setMineView(false)
        } else {
          setFolderId(null)
          setMineView(true)
        }
      }
      setMetaReady(true)
    } catch (reason) {
      setError((reason as { message?: string })?.message || t('start.spaceError'))
    } finally {
      setBusy(false)
    }
  }, [context, member, options.mallBaseUrl, space, t])

  const loadContent = useCallback(async () => {
    if (!member || !options.mallBaseUrl || !metaReady) return
    const types = CATEGORY_TYPES[category]
    setBusy(true)
    setError('')
    try {
      if (space === 'platform') {
        const results = await Promise.all(types.map((contentType) =>
          window.maxlabel.share.platform.page(context, {
            contentType,
            ...(platformCategory ? { category: platformCategory } : {}),
            pageNo: 1,
            pageSize: 200
          })))
        const failed = results.find((result) => !result.ok)
        if (failed) {
          setError(failed.error || t('start.spaceError'))
          return
        }
        setPlatformItems(results.flatMap((result) => result.items ?? []))
        return
      }
      if (space === 'personal') {
        const results = await Promise.all(types.map((contentType) =>
          window.maxlabel.share.content.page(context, { scope: 1, contentType, pageNo: 1, pageSize: 200 })))
        const failed = results.find((result) => !result.ok)
        if (failed) {
          setError(failed.error || t('start.spaceError'))
          return
        }
        setItems(results.flatMap((result) => result.items ?? []))
        return
      }
      // 企业空间
      if (!overview?.enterprise?.seatActive) {
        setItems([])
        return
      }
      if (mineView) {
        const mine = await window.maxlabel.share.content.mine(context, 1, 200)
        if (!mine.ok) {
          setError(mine.error || t('start.spaceError'))
          return
        }
        setItems((mine.items ?? []).filter((item) => types.includes(item.contentType)))
        return
      }
      if (folderId == null) {
        setItems([])
        return
      }
      const results = await Promise.all(types.map((contentType) =>
        window.maxlabel.share.content.page(context, {
          scope: 2, folderId, contentType, pageNo: 1, pageSize: 200
        })))
      const failed = results.find((result) => !result.ok)
      if (failed) {
        setError(failed.error || t('start.spaceError'))
        return
      }
      setItems(results.flatMap((result) => result.items ?? []))
    } catch (reason) {
      setError((reason as { message?: string })?.message || t('start.spaceError'))
    } finally {
      setBusy(false)
    }
  }, [category, context, folderId, member, metaReady, mineView, options.mallBaseUrl, overview?.enterprise?.seatActive, platformCategory, space, t])

  useEffect(() => { void loadMeta() }, [loadMeta])
  useEffect(() => { void loadContent() }, [loadContent])

  const refreshAll = async () => {
    await loadMeta()
    await loadContent()
  }

  const platformCategories = useMemo(() => {
    const values = new Set<string>()
    for (const item of platformAll) if (item.category) values.add(item.category)
    return [...values].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  }, [platformAll])

  const enterpriseSeatActive = overview?.enterprise?.seatActive === true
  const canUpload = space === 'personal'
    ? overview?.personal.canUpload === true
    : space === 'enterprise'
      ? enterpriseSeatActive
        && overview?.enterprise?.canUpload === true
        && overview.enterprise.readOnly !== true
        && !mineView
        && folderId != null
      : false

  const upload = async () => {
    if (!canUpload) return
    const picked = await window.maxlabel.pickFile({
      filters: [{ name: t('start.spaceUpload'), extensions: CATEGORY_EXTENSIONS[category] }]
    })
    if (!picked.ok || !picked.path) return
    const contentType = contentTypeOf(picked.path)
    if (!CATEGORY_TYPES[category].includes(contentType)) {
      setError(t('start.spaceUploadWrongType'))
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await window.maxlabel.share.content.upload(context, {
        scope: space === 'enterprise' ? 2 : 1,
        folderId: space === 'enterprise' ? folderId ?? undefined : undefined,
        contentType,
        name: fileNameOf(picked.path)
      }, picked.path)
      if (!result.ok) {
        setError(result.error || t('start.spaceUploadFailed'))
        return
      }
      setNotice(t('start.spaceUploaded'))
      const summary = await window.maxlabel.share.overview(context)
      if (summary.ok && summary.overview) setOverview(summary.overview)
      await loadContent()
    } catch (reason) {
      setError((reason as { message?: string })?.message || t('start.spaceUploadFailed'))
    } finally {
      setBusy(false)
    }
  }

  const loadFolder = async (id: number) => {
    setFolderId(id)
    setMineView(false)
    setNotice('')
  }

  const loadMine = async () => {
    setMineView(true)
    setNotice('')
  }

  const refreshFolders = async () => {
    const result = await window.maxlabel.share.folders.list(context)
    if (result.ok) setFolders(result.items ?? [])
  }

  const createFolder = async () => {
    const name = folderName.trim()
    if (!name) return
    setFolderDialogOpen(false)
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await window.maxlabel.share.folders.create(context, name)
      if (!result.ok) {
        setError(result.error || t('start.folderCreateFailed'))
        return
      }
      const listResult = await window.maxlabel.share.folders.list(context)
      if (listResult.ok) {
        const list = listResult.items ?? []
        setFolders(list)
        const createdId = result.id != null && result.id > 0
          ? result.id
          : list.find((folder) => folder.name === name)?.id ?? null
        if (createdId != null) {
          setFolderId(createdId)
          setMineView(false)
        }
      } else if (result.id != null && result.id > 0) {
        setFolderId(result.id)
        setMineView(false)
      }
      setNotice(t('start.folderCreated'))
    } catch (reason) {
      setError((reason as { message?: string })?.message || t('start.folderCreateFailed'))
    } finally {
      setBusy(false)
    }
  }

  const openContent = async (item: ShareContentItem) => {
    setBusy(true)
    setError('')
    try {
      const result = await window.maxlabel.share.content.get(context, item.id)
      if (!result.ok || !result.item) {
        setError(result.error || t('start.spaceError'))
        return
      }
      if (result.item.storageType === 1 && result.item.content) onLoad(result.item.content)
      else if (result.item.downloadUrl) window.open(result.item.downloadUrl, '_blank')
      else setError(t('start.spaceNoData'))
    } catch (reason) {
      setError((reason as { message?: string })?.message || t('start.spaceError'))
    } finally {
      setBusy(false)
    }
  }

  const openPlatform = async (item: PlatformContentItem) => {
    setBusy(true)
    setError('')
    try {
      const result = await window.maxlabel.share.platform.get(context, item.id)
      if (!result.ok || !result.item) {
        setError(result.error || t('start.spaceError'))
        return
      }
      if (result.item.storageType === 1 && result.item.content) onLoad(result.item.content)
      else if (result.item.downloadUrl) window.open(result.item.downloadUrl, '_blank')
      else setError(t('start.spaceNoData'))
    } catch (reason) {
      setError((reason as { message?: string })?.message || t('start.spaceError'))
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await window.maxlabel.share.content.delete(context, target.id)
      if (!result.ok) {
        setError(result.error || t('start.deleteFailed'))
        return
      }
      setNotice(t('start.deleted'))
      const summary = await window.maxlabel.share.overview(context)
      if (summary.ok && summary.overview) setOverview(summary.overview)
      await loadContent()
    } catch (reason) {
      setError((reason as { message?: string })?.message || t('start.deleteFailed'))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!member || !options.mallBaseUrl) return
    if (space === 'platform') return
    if (category !== 'template' && category !== 'image') return
    const relevant = items.filter((item) => category === 'template' ? item.contentType === 1 : item.contentType === 5)
    const remaining = MAX_GENERATED_PREVIEWS - relevant.filter((item) => previews[item.id]).length
    if (remaining <= 0) return
    const targets = relevant
      .filter((item) => !safePreviewUrl(item.thumb) && !previewAttempted.current.has(item.id))
      .slice(0, remaining)
    if (targets.length === 0) return
    let live = true
    const generate = async () => {
      for (const item of targets) {
        previewAttempted.current.add(item.id)
        try {
          const result = await window.maxlabel.share.content.get(context, item.id)
          if (!live || !result.ok || !result.item) continue
          if (category === 'template' && result.item.storageType === 1 && result.item.content) {
            const doc = fromDocJson(result.item.content)
            const url = await renderLabelDataUrl(doc, { dpi: 36 })
            if (live) setPreviews((current) => ({ ...current, [item.id]: url }))
          } else if (category === 'image') {
            const url = safePreviewUrl(result.item.downloadUrl) ?? safePreviewUrl(result.item.content)
            if (url && live) setPreviews((current) => ({ ...current, [item.id]: url }))
          }
        } catch {
          // 预览是增强信息；失败时保留类型图标。
        }
      }
    }
    void generate()
    return () => { live = false }
  }, [items, category, space, member, options.mallBaseUrl, context, previews])

  const cards: SpaceCardItem[] = space === 'platform'
    ? platformItems
    : items.map((item) => ({ ...item, thumb: item.thumb ?? previews[item.id] }))
  const visibleCards = cards.filter((item) => item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  const section = cloudSectionState(
    busy || (!metaReady && !error),
    error,
    cards.length
  )
  const title = space === 'platform' ? t('start.platformSpace') : space === 'personal' ? t('start.personalSpace') : t('start.enterpriseSpace')
  const enterpriseUnavailable = space === 'enterprise' && overview !== null && !enterpriseSeatActive

  return (
    <section className="start-space" data-testid="start-space" data-space={space}>
      <div className="start-space-heading">
        <div><h3>{title}</h3><p className="start-space-description">{t(space === 'enterprise' ? 'start.enterpriseDescription' : space === 'personal' ? 'start.personalDescription' : 'start.platformDescription')}</p></div>
        <div className="start-space-heading-actions">
          <button type="button" className={`start-space-refresh${busy ? ' is-refreshing' : ''}`} data-testid="start-space-refresh" aria-label={t('start.refreshFiles')} title={t('start.refreshFiles')} onClick={() => void refreshAll()} disabled={busy}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.34 6.66" /><path d="M20 4v7h-7" /></svg>
          </button>
        </div>
      </div>

      {!options.mallBaseUrl && (
        <div className="start-empty" data-testid="start-space-config">{t('start.spaceConfig')}</div>
      )}

      {options.mallBaseUrl && !member && (
        <div className="start-empty" data-testid="start-space-login">
          <div>{t('start.spaceLogin')}</div>
          <button type="button" className="start-link-button" onClick={onLogin}>{t('entitlement.login')}</button>
        </div>
      )}

      {options.mallBaseUrl && member && (
        <div className={`start-space-browser${space === 'enterprise' && enterpriseSeatActive ? ' has-folders' : ''}`}>
          {space === 'enterprise' && enterpriseSeatActive && (
            <aside className="start-folder-sidebar"><div className="start-folder-sidebar-title">{t('start.folders')}</div><div className="start-folder-grid" data-testid="start-space-folders">
              <div className="start-folder-tile-wrap">
                <button
                  type="button"
                  data-testid="start-space-folder-mine"
                  data-active={mineView ? 'true' : 'false'}
                  className="start-folder-tile"
                  onClick={() => void loadMine()}
                >
                  <span className="start-folder-tile-icon"><UploadGlyph /></span>
                  <span className="start-folder-name">{t('start.spaceMine')}</span>
                </button>
              </div>
              {folders.map((folder) => (
                <div key={folder.id} className="start-folder-tile-wrap">
                  <button
                    type="button"
                    data-testid="start-space-folder"
                    data-active={!mineView && folderId === folder.id ? 'true' : 'false'}
                    className="start-folder-tile"
                    title={folder.name}
                    onClick={() => void loadFolder(folder.id)}
                  >
                    <span className="start-folder-tile-icon"><FolderGlyph /></span>
                    <span className="start-folder-name">{folder.name}</span>
                  </button>
                  {(overview?.enterprise?.isAdmin || folder.canManage) && (
                    <button
                      type="button"
                      className="start-folder-perm"
                      data-testid="start-space-folder-permissions"
                      title={t('start.folderPermissions')}
                      onClick={() => setPermissionsFolder(folder)}
                    >
                      {t('start.folderPermissions')}
                    </button>
                  )}
                </div>
              ))}
              {overview?.enterprise?.isAdmin === true && overview.enterprise.readOnly !== true && (
                <div className="start-folder-tile-wrap">
                  <button
                    type="button"
                    className="start-folder-tile start-folder-add"
                    data-testid="start-space-new-folder"
                    onClick={() => { setFolderName(''); setFolderDialogOpen(true) }}
                    disabled={busy}
                  >
                    <span className="start-folder-tile-icon"><PlusGlyph /></span>
                    <span className="start-folder-name">{t('start.newFolder')}</span>
                  </button>
                </div>
              )}
            </div></aside>
          )}

          <div className="start-space-content">
          <div className="start-space-categories" data-testid="start-space-categories">
            {(['template', 'image', 'data'] as SpaceCategory[]).map((kind) => (
              <button
                key={kind}
                type="button"
                className="start-space-category"
                data-testid={`start-space-category-${kind}`}
                data-active={category === kind ? 'true' : 'false'}
                onClick={() => { setCategory(kind); setNotice('') }}
              >
                {kind === 'template' ? t('start.categoryTemplate') : kind === 'image' ? t('start.categoryImage') : t('start.categoryDataSource')}
              </button>
            ))}
          </div>

          {space === 'platform' && (
            <div className="start-space-platform-categories" data-testid="start-space-platform-category">
              <button
                type="button"
                className="start-space-platform-category"
                data-active={platformCategory === '' ? 'true' : 'false'}
                onClick={() => { setPlatformCategory(''); setNotice('') }}
              >
                {t('start.allCategories')}
              </button>
              {platformCategories.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="start-space-platform-category"
                  data-active={platformCategory === value ? 'true' : 'false'}
                  onClick={() => { setPlatformCategory(value); setNotice('') }}
                >
                  {value}
                </button>
              ))}
            </div>
          )}

          {space === 'enterprise' && overview?.enterprise && (
            <div className="start-space-meta">
              {overview.enterprise.orgName}
              {overview.enterprise.readOnly ? ` · ${t('entitlement.readOnlyShort')}` : ''}
            </div>
          )}

          {!enterpriseUnavailable && (
            <div className="start-file-toolbar">
              <div className="start-file-location"><FolderGlyph /><span>{space === 'enterprise' ? (mineView ? t('start.spaceMine') : folders.find((folder) => folder.id === folderId)?.name || title) : title}</span><span className="start-file-count">{t('start.fileCount', { count: visibleCards.length })}</span></div>
              <input type="search" className="start-file-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('start.searchFiles')} aria-label={t('start.searchFiles')} />
            </div>
          )}

          {enterpriseUnavailable && (
            <div className="start-empty" data-testid="start-space-empty">{t('start.enterpriseSeatRequired')}</div>
          )}

          {!enterpriseUnavailable && section === 'loading' && <div className="start-empty" data-testid="start-space-loading">{t('start.spaceLoading')}</div>}
          {!enterpriseUnavailable && section === 'error' && (
            <div className="start-empty" data-testid="start-space-error">
              <div>{error || t('start.spaceError')}</div>
              <button type="button" className="start-link-button" onClick={() => void refreshAll()}>{t('start.cloudRetry')}</button>
            </div>
          )}
          {!enterpriseUnavailable && section === 'empty' && !canUpload && (
            <div className="start-empty" data-testid="start-space-empty">
              {space === 'enterprise' && enterpriseSeatActive && folders.length === 0
                ? t('start.spaceFoldersEmpty')
                : t('start.spaceEmpty')}
            </div>
          )}

          {notice && <div className="start-space-notice" data-testid="start-space-notice">{notice}</div>}

          {!enterpriseUnavailable && section === 'list' && visibleCards.length === 0 && <div className="start-empty">{t('start.noSearchResults')}</div>}
          {!enterpriseUnavailable && ((section === 'list' && (visibleCards.length > 0 || canUpload)) || (section === 'empty' && canUpload)) && (
            <ul className="start-cloud-list" data-testid="start-space-list">
              {visibleCards.map((item) => {
                const deletable = space !== 'platform'
                  && (space === 'personal' ? item.canDelete !== false : item.canDelete === true)
                return (
                  <li key={item.id}>
                    <SpaceCard
                      item={item}
                      deleteLabel={t('start.spaceDelete')}
                      onOpen={() => {
                        if (space === 'platform') void openPlatform(item as PlatformContentItem)
                        else void openContent(item as ShareContentItem)
                      }}
                      {...(deletable ? { onDelete: () => setDeleteTarget(item as ShareContentItem) } : {})}
                    />
                  </li>
                )
              })}
              {canUpload && (
                <li className="start-upload-cell">
                  <button type="button" className="start-upload-tile" data-testid="start-space-upload" aria-label={t('start.spaceUpload')} title={t('start.spaceUpload')} onClick={() => void upload()} disabled={busy}>
                    <PlusGlyph />
                  </button>
                </li>
              )}
            </ul>
          )}
          </div>
        </div>
      )}

      {deleteTarget && (
        <Modal title={t('start.deleteContentTitle')} onClose={() => setDeleteTarget(null)} width={380} testId="start-delete-content-dialog">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>{t('start.deleteContentMessage', { name: deleteTarget.name })}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" style={dialogButton()} onClick={() => setDeleteTarget(null)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                data-testid="start-delete-content-confirm"
                style={{ ...dialogButton(true), background: '#B3261E', borderColor: '#B3261E' }}
                onClick={() => void confirmDelete()}
              >
                {t('start.spaceDelete')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {folderDialogOpen && (
        <Modal title={t('start.newFolder')} onClose={() => setFolderDialogOpen(false)} width={380} testId="start-new-folder-dialog">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input
              autoFocus
              data-testid="start-new-folder-name"
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && folderName.trim()) void createFolder()
              }}
              placeholder={t('start.folderName')}
              style={{
                padding: '8px 10px',
                border: '1px solid #D5D4CD',
                borderRadius: 6,
                fontSize: 13,
                fontFamily: 'inherit'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" style={dialogButton()} onClick={() => setFolderDialogOpen(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                data-testid="start-new-folder-confirm"
                style={dialogButton(true)}
                disabled={!folderName.trim()}
                onClick={() => void createFolder()}
              >
                {t('common.ok')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {permissionsFolder && (
        <ShareFolderMembersDialog
          options={options}
          folder={permissionsFolder}
          onClose={() => setPermissionsFolder(null)}
          onSaved={() => { setPermissionsFolder(null); void refreshFolders() }}
        />
      )}
    </section>
  )
}
