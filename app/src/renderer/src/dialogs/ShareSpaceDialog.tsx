import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type {
  PlatformContentItem,
  ShareContentItem,
  ShareFolderItem,
  ShareFolderMember,
  ShareSpaceOverview
} from '../../../shared/ipcContract'
import Modal from './Modal'
import type { AppOptions } from './OptionsDialog'
import { canDeleteFolder, canManageFolder, canWriteFolder } from '../../../shared/domain/shareFolderRules'
import { useI18n } from '../features/i18n/useI18n'
import { localizePropertyLabel } from '../../../shared/i18n/property.en-US'
import { cloudContentKind } from '../io/msdx'
import { textFilePayload } from '../io/saveText'
import type { CloudOrigin } from '../features/workspace/useDocumentWorkspace'

interface Props {
  options: AppOptions
  onClose: () => void
  onLoad: (content: string, name?: string, origin?: CloudOrigin) => void
  docName?: string
  docJson?: string
  docWidthMm?: number
  docHeightMm?: number
}

type Tab = 'personal' | 'enterprise' | 'platform'

const button = (primary = false): React.CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 6,
  border: primary ? '1px solid #2E6E93' : '1px solid #D5D4CD',
  background: primary ? '#2E6E93' : '#fff',
  color: primary ? '#fff' : '#1A1B1C',
  cursor: 'pointer',
  fontSize: 12.5,
  fontFamily: 'inherit'
})

const input: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #D5D4CD',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'inherit'
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  border: '1px solid #E4E3DD',
  borderRadius: 8,
  padding: '8px 10px',
  background: '#fff'
}

const thumbStyle: React.CSSProperties = {
  width: 56,
  height: 40,
  objectFit: 'contain',
  border: '1px solid #E8E7E2',
  borderRadius: 4,
  background: '#fff'
}

const contentTypes: Record<number, string> = { 1: '模板', 2: '纯文本', 3: 'Excel', 4: 'CSV', 5: '图片' }

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

function sizeText(bytes?: number): string {
  if (!bytes) return '0 B'
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

export default function ShareSpaceDialog({ options, onClose, onLoad, docName, docJson, docWidthMm, docHeightMm }: Props) {
  const { language } = useI18n()
  const L = (text: string) => localizePropertyLabel(text, language)
  const context = { baseUrl: options.mallBaseUrl, tenantId: options.mallTenantId }
  const [tab, setTab] = useState<Tab>('personal')
  const [overview, setOverview] = useState<ShareSpaceOverview | null>(null)
  const [items, setItems] = useState<ShareContentItem[]>([])
  const [folders, setFolders] = useState<ShareFolderItem[]>([])
  const [folderId, setFolderId] = useState<number | null>(null)
  const [personalFolders, setPersonalFolders] = useState<ShareFolderItem[]>([])
  const [personalFolderId, setPersonalFolderId] = useState<number | null>(null)
  const [movingPersonalFolder, setMovingPersonalFolder] = useState<ShareFolderItem | null>(null)
  const [movePersonalTarget, setMovePersonalTarget] = useState<number | null>(null)
  const [platformItems, setPlatformItems] = useState<PlatformContentItem[]>([])
  const [platformType, setPlatformType] = useState<number | undefined>(undefined)
  const [mineView, setMineView] = useState(false)
  const [members, setMembers] = useState<{ folderId: number; rows: ShareFolderMember[] } | null>(null)
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const enterprise = overview?.enterprise ?? null
  const enterpriseEnabled = !!enterprise && enterprise.seatActive
  const enterpriseReadOnly = enterprise?.readOnly === true
  const canWriteEnterprise = !!enterprise && enterprise.seatActive && enterprise.licenseActive

  const loadOverview = useCallback(async () => {
    if (!options.mallBaseUrl) {
      setMessage(L('请先在「系统设置 → 商城地址」配置商城地址。'))
      return
    }
    try {
      const result = await window.maxlabel.share.overview(context)
      if (result.ok && result.overview) setOverview(result.overview)
      else setMessage(result.error || L('读取共享空间失败'))
    } catch (error) {
      setMessage(L('读取共享空间失败：') + (error instanceof Error ? error.message : String(error)))
    }
  }, [options.mallBaseUrl, options.mallTenantId])

  const loadContent = useCallback(async (scope: number, folder: number | null) => {
    setMineView(false)
    if (scope === 2 && folder == null) {
      setItems([])
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const result = await window.maxlabel.share.content.page(context, {
        scope, folderId: folder, keyword: keyword.trim() || undefined, pageNo: 1, pageSize: 200
      })
      if (result.ok) setItems(result.items ?? [])
      else setMessage(result.error || L('读取共享内容失败'))
    } finally {
      setBusy(false)
    }
  }, [context.baseUrl, context.tenantId, keyword, category])

  const loadMine = useCallback(async () => {
    setBusy(true)
    setMessage('')
    try {
      const result = await window.maxlabel.share.content.mine(context, 1, 200)
      if (result.ok) {
        setItems(result.items ?? [])
        setMineView(true)
      } else setMessage(result.error || L('读取共享内容失败'))
    } finally {
      setBusy(false)
    }
  }, [context.baseUrl, context.tenantId])

  const loadFolders = useCallback(async () => {
    if (!enterpriseEnabled) return
    try {
      const result = await window.maxlabel.share.folders.list(context)
      if (result.ok) {
        const list = result.items ?? []
        setFolders(list)
        if (folderId == null && list.length > 0) setFolderId(list[0].id)
      } else setMessage(result.error || L('读取企业文件夹失败'))
    } catch (error) {
      setMessage(L('读取企业文件夹失败：') + (error instanceof Error ? error.message : String(error)))
    }
  }, [context.baseUrl, context.tenantId, enterpriseEnabled, folderId])

  const loadPersonalFolders = useCallback(async () => {
    try {
      const result = await window.maxlabel.share.personalFolders.list(context)
      if (result.ok) setPersonalFolders(result.items ?? [])
      else setMessage(result.error || L('读取个人文件夹失败'))
    } catch (error) {
      setMessage(L('读取个人文件夹失败：') + (error instanceof Error ? error.message : String(error)))
    }
  }, [context.baseUrl, context.tenantId])

  const selectPersonalFolder = (id: number | null) => {
    setPersonalFolderId(id)
    void loadContent(1, id)
  }

  const createPersonalFolder = async () => {
    const name = window.prompt(L('新建文件夹名称'))
    if (!name || !name.trim()) return
    setBusy(true)
    try {
      const parentId = personalFolderId != null && personalFolderId > 0 ? personalFolderId : null
      const result = await window.maxlabel.share.personalFolders.create(context, name.trim(), parentId)
      if (result.ok) { setMessage(L('已创建文件夹')); await loadPersonalFolders() }
      else setMessage(result.error || L('创建文件夹失败'))
    } finally {
      setBusy(false)
    }
  }

  const renamePersonalFolder = async (folder: ShareFolderItem) => {
    const name = window.prompt(L('文件夹新名称'), folder.name)
    if (!name || !name.trim() || name.trim() === folder.name) return
    setBusy(true)
    try {
      const result = await window.maxlabel.share.personalFolders.update(context, folder.id, name.trim())
      if (result.ok) { setMessage(L('已改名')); await loadPersonalFolders() }
      else setMessage(result.error || L('改名失败'))
    } finally {
      setBusy(false)
    }
  }

  const deletePersonalFolder = async (folder: ShareFolderItem) => {
    if (!window.confirm(L('确定删除空文件夹「') + folder.name + L('」？'))) return
    setBusy(true)
    try {
      const result = await window.maxlabel.share.personalFolders.delete(context, folder.id)
      if (result.ok) {
        setMessage(L('已删除'))
        if (personalFolderId === folder.id) selectPersonalFolder(null)
        await loadPersonalFolders()
      } else setMessage(result.error || L('删除失败'))
    } finally {
      setBusy(false)
    }
  }

  const startMovePersonalFolder = (folder: ShareFolderItem) => {
    setMovingPersonalFolder(folder)
    setMovePersonalTarget(folder.parentId ?? null)
  }

  const saveMovePersonalFolder = async () => {
    if (!movingPersonalFolder) return
    setBusy(true)
    try {
      const result = await window.maxlabel.share.personalFolders.move(
        context, movingPersonalFolder.id, movePersonalTarget)
      if (result.ok) {
        setMessage(L('已移动'))
        setMovingPersonalFolder(null)
        await loadPersonalFolders()
      } else setMessage(result.error || L('移动失败'))
    } finally {
      setBusy(false)
    }
  }

  const isPersonalDescendant = (candidateId: number, ancestorId: number): boolean => {
    const byId = new Map(personalFolders.map((folder) => [folder.id, folder]))
    const seen = new Set<number>()
    let current: number | null | undefined = candidateId
    while (current != null && !seen.has(current)) {
      if (current === ancestorId) return true
      seen.add(current)
      current = byId.get(current)?.parentId ?? null
    }
    return false
  }

  const renderPersonalTree = (parentId: number | null, depth: number): ReactNode[] =>
    personalFolders
      .filter((folder) => (folder.parentId ?? null) === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
      .flatMap((folder) => [
        <span key={folder.id} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', marginLeft: depth * 14 }}>
          <button type="button" style={{ ...button(personalFolderId === folder.id), background: personalFolderId === folder.id ? '#EAF1FF' : '#fff' }}
            onClick={() => selectPersonalFolder(folder.id)}>{folder.name}</button>
          <button type="button" style={button()} disabled={busy} onClick={() => void renamePersonalFolder(folder)}>{L('改名')}</button>
          <button type="button" style={button()} disabled={busy} onClick={() => startMovePersonalFolder(folder)}>{L('移动')}</button>
          <button type="button" style={button()} disabled={busy} onClick={() => void deletePersonalFolder(folder)}>{L('删除')}</button>
        </span>,
        ...renderPersonalTree(folder.id, depth + 1)
      ])

  const loadPlatform = useCallback(async () => {
    setBusy(true)
    setMessage('')
    try {
      const result = await window.maxlabel.share.platform.page(context, {
        keyword: keyword.trim() || undefined,
        contentType: platformType,
        category: category.trim() || undefined,
        pageNo: 1,
        pageSize: 200
      })
      if (result.ok) setPlatformItems(result.items ?? [])
      else setMessage(result.error || L('读取平台共享内容失败'))
    } finally {
      setBusy(false)
    }
  }, [context.baseUrl, context.tenantId, keyword, category, platformType])

  useEffect(() => { void loadOverview() }, [loadOverview])
  useEffect(() => {
    if (tab === 'personal') { void loadPersonalFolders(); void loadContent(1, personalFolderId) }
    if (tab === 'enterprise') { void loadFolders() }
    if (tab === 'platform') void loadPlatform()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])
  useEffect(() => {
    if (tab === 'enterprise' && folderId != null) void loadContent(2, folderId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId])

  const upload = async () => {
    const scope = tab === 'enterprise' ? 2 : 1
    const personalTarget = personalFolderId != null && personalFolderId > 0 ? personalFolderId : undefined
    if (scope === 1 && overview && !overview.personal.canUpload) {
      setMessage(L('个人空间容量已用尽，请先删除内容。'))
      return
    }
    if (scope === 2 && (!canWriteEnterprise || folderId == null)) {
      setMessage(!canWriteEnterprise ? L('企业授权已到期或没有席位，不能上传。') : L('请先选择文件夹。'))
      return
    }
    const picked = await window.maxlabel.pickFile({
      filters: [{ name: L('共享内容'), extensions: ['msdx', 'txt', 'xls', 'xlsx', 'csv', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] }]
    })
    if (!picked.ok || !picked.path) return
    setBusy(true)
    setMessage('')
    try {
      const result = await window.maxlabel.share.content.upload(context, {
        scope, folderId: scope === 2 ? folderId : personalTarget,
        contentType: contentTypeOf(picked.path), name: fileNameOf(picked.path),
        category: category.trim() || undefined
      }, picked.path)
      if (result.ok) {
        setMessage(L('已上传'))
        if (scope === 2) void loadContent(2, folderId)
        else void loadContent(1, personalFolderId)
        void loadOverview()
      } else setMessage(result.error || L('上传失败'))
    } finally {
      setBusy(false)
    }
  }

  const saveCurrent = async () => {
    if (!docName || !docJson) {
      setMessage(L('没有可保存的当前模板'))
      return
    }
    const scope = tab === 'enterprise' ? 2 : 1
    const personalTarget = personalFolderId != null && personalFolderId > 0 ? personalFolderId : undefined
    if (scope === 2 && (!canWriteEnterprise || folderId == null)) {
      setMessage(!canWriteEnterprise ? L('企业授权已到期或没有席位，不能上传。') : L('请先选择文件夹。'))
      return
    }
    setBusy(true)
    try {
      const result = await window.maxlabel.share.content.create(context, {
        scope, folderId: scope === 2 ? folderId : personalTarget,
        contentType: 1, name: docName.toLowerCase().endsWith('.msdx') ? docName : `${docName}.msdx`,
        content: docJson, widthMm: docWidthMm, heightMm: docHeightMm,
        category: category.trim() || undefined
      })
      if (result.ok) {
        setMessage(L('已保存到共享空间'))
        if (scope === 2) void loadContent(2, folderId)
        else void loadContent(1, personalFolderId)
        void loadOverview()
      } else setMessage(result.error || L('保存失败'))
    } finally {
      setBusy(false)
    }
  }

  const openItem = async (item: ShareContentItem) => {
    setBusy(true)
    try {
      const result = await window.maxlabel.share.content.get(context, item.id)
      if (!result.ok || !result.item) { setMessage(result.error || L('读取失败')); return }
      if (result.item.storageType === 1 && result.item.content) {
        const content = result.item.content
        const kind = cloudContentKind(content, result.item.name)
        if (kind === 'archive-json') {
          const saved = await window.maxlabel.saveTextFile(textFilePayload(result.item.name, content))
          if (saved.ok) setMessage(L('已另存为原文件'))
          else if (!saved.canceled) setMessage(saved.message || L('另存失败'))
          return
        }
        onLoad(content, result.item.name, {
          id: item.id, scope: item.scope, folderId: item.folderId ?? null, name: item.name
        })
      } else if (result.item.downloadUrl) window.open(result.item.downloadUrl, '_blank')
      else setMessage(L('该内容没有可打开的数据'))
    } finally {
      setBusy(false)
    }
  }

  /** 原样另存（.lsdx / 归档 JSON 保留源端正文，不经过编辑器序列化）。 */
  const saveItem = async (item: ShareContentItem) => {
    setBusy(true)
    try {
      const result = await window.maxlabel.share.content.get(context, item.id)
      if (!result.ok || !result.item || result.item.storageType !== 1 || !result.item.content) {
        setMessage(result.error || L('该内容没有可打开的数据'))
        return
      }
      const saved = await window.maxlabel.saveTextFile(
        textFilePayload(result.item.name, result.item.content)
      )
      if (saved.ok) setMessage(L('已另存为原文件'))
      else if (!saved.canceled) setMessage(saved.message || L('另存失败'))
    } finally {
      setBusy(false)
    }
  }

  const removeItem = async (item: ShareContentItem) => {
    if (!window.confirm(L('确定删除「') + item.name + L('」？'))) return
    setBusy(true)
    try {
      const result = await window.maxlabel.share.content.delete(context, item.id)
      if (result.ok) {
        setMessage(L('已删除'))
        if (mineView) void loadMine()
        else if (tab === 'enterprise') void loadContent(2, folderId)
        else void loadContent(1, null)
        void loadOverview()
      } else setMessage(result.error || L('删除失败'))
    } finally {
      setBusy(false)
    }
  }

  const openPlatform = async (item: PlatformContentItem) => {
    setBusy(true)
    try {
      const result = await window.maxlabel.share.platform.get(context, item.id)
      if (!result.ok || !result.item) { setMessage(result.error || L('读取失败')); return }
      if (result.item.storageType === 1 && result.item.content) {
        const content = result.item.content
        const kind = cloudContentKind(content, result.item.name)
        if (kind === 'archive-json') {
          const saved = await window.maxlabel.saveTextFile(textFilePayload(result.item.name, content))
          if (saved.ok) setMessage(L('已另存为原文件'))
          else if (!saved.canceled) setMessage(saved.message || L('另存失败'))
          return
        }
        onLoad(content, result.item.name)
      } else if (result.item.downloadUrl) window.open(result.item.downloadUrl, '_blank')
      else setMessage(L('该内容没有可打开的数据'))
    } finally {
      setBusy(false)
    }
  }

  const createFolder = async () => {
    if (enterpriseReadOnly) { setMessage(L('企业授权已到期或企业已停用，不能新增上传。')); return }
    const name = window.prompt(L('文件夹名称'))
    if (!name || !name.trim()) return
    setBusy(true)
    try {
      const result = await window.maxlabel.share.folders.create(context, name.trim())
      if (result.ok) { setMessage(L('已创建文件夹')); await loadFolders() }
      else setMessage(result.error || L('创建失败'))
    } finally {
      setBusy(false)
    }
  }

  const renameFolder = async (folder: ShareFolderItem) => {
    if (enterpriseReadOnly) { setMessage(L('企业授权已到期或企业已停用，不能新增上传。')); return }
    const name = window.prompt(L('文件夹新名称'), folder.name)
    if (!name || !name.trim() || name.trim() === folder.name) return
    setBusy(true)
    try {
      const result = await window.maxlabel.share.folders.update(context, folder.id, name.trim())
      if (result.ok) { setMessage(L('已改名')); await loadFolders() }
      else setMessage(result.error || L('改名失败'))
    } finally {
      setBusy(false)
    }
  }

  const deleteFolder = async (folder: ShareFolderItem) => {
    if (enterpriseReadOnly) { setMessage(L('企业授权已到期或企业已停用，不能新增上传。')); return }
    if (!window.confirm(L('确定删除空文件夹「') + folder.name + L('」？'))) return
    setBusy(true)
    try {
      const result = await window.maxlabel.share.folders.delete(context, folder.id)
      if (result.ok) { setMessage(L('已删除文件夹')); setFolderId(null); await loadFolders() }
      else setMessage(result.error || L('删除失败'))
    } finally {
      setBusy(false)
    }
  }

  const editMembers = async (folder: ShareFolderItem) => {
    if (enterpriseReadOnly) { setMessage(L('企业授权已到期或企业已停用，不能新增上传。')); return }
    const result = await window.maxlabel.share.folders.members(context, folder.id)
    if (!result.ok) { setMessage(result.error || L('读取可见成员失败')); return }
    setMembers({ folderId: folder.id, rows: result.members ?? [] })
  }

  const saveMembers = async () => {
    if (!members) return
    if (enterpriseReadOnly) { setMessage(L('企业授权已到期或企业已停用，不能新增上传。')); return }
    const permissions = members.rows.map((row) => ({
      memberId: row.memberId,
      visible: row.visible === true,
      canEdit: row.canEdit === true,
      canDelete: row.canDelete === true
    }))
    const result = await window.maxlabel.share.folders.updateMembers(context, members.folderId, permissions)
    if (result.ok) { setMessage(L('已保存可见成员')); setMembers(null) }
    else setMessage(result.error || L('保存失败'))
  }

  const editionLabel = (edition?: string) =>
    edition === 'professional' ? L('专业版') : edition === 'enterprise' ? L('企业版') : L('标准版')
  const personalLine = overview
    ? `${sizeText(overview.personal.usedBytes)} / ${sizeText(overview.personal.quotaBytes)}`
      + ` · ${L('剩余')} ${sizeText(overview.personal.remainingBytes)}`
      + ` · ${editionLabel(overview.personal.edition)}`
    : ''
  const enterpriseLine = enterprise
    ? `${sizeText(enterprise.usedBytes)} / ${sizeText(enterprise.quotaBytes)}`
      + ` · ${L('剩余')} ${sizeText(enterprise.remainingBytes)}`
      + ` · ${L('企业版')}${enterprise.readOnly ? ' · ' + L('只读') : ''}`
    : ''

  return (
    <Modal title={L('共享空间')} onClose={onClose} width={860}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!options.mallBaseUrl && <div style={{ color: '#B3261E' }}>{L('请先在「系统设置 → 商城地址」配置商城地址。')}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['personal', 'enterprise', 'platform'] as Tab[]).map((kind) => {
            if (kind === 'enterprise' && !enterpriseEnabled) return null
            const label = kind === 'personal' ? L('个人') : kind === 'enterprise' ? L('企业') : L('平台')
            return <button key={kind} type="button" style={{ ...button(tab === kind), background: tab === kind ? '#2E6E93' : '#fff', color: tab === kind ? '#fff' : '#1A1B1C' }} onClick={() => setTab(kind)}>{label}</button>
          })}
        </div>
        <div style={{ fontSize: 12, color: '#6B7280' }}>
          {tab === 'personal' && personalLine}
          {tab === 'enterprise' && enterpriseLine}
        </div>
        {enterprise && !enterprise.seatActive && (
          <div style={{ fontSize: 12, color: '#B3261E' }}>{L('需要企业席位才能使用企业空间。')}</div>
        )}
        {tab === 'personal' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" style={{ ...button(personalFolderId === null), background: personalFolderId === null ? '#EAF1FF' : '#fff' }}
              onClick={() => selectPersonalFolder(null)}>{L('全部内容')}</button>
            <button type="button" style={{ ...button(personalFolderId === 0), background: personalFolderId === 0 ? '#EAF1FF' : '#fff' }}
              onClick={() => selectPersonalFolder(0)}>{L('默认目录')}</button>
            {renderPersonalTree(null, 0)}
            <button type="button" style={button(true)} disabled={busy} onClick={() => void createPersonalFolder()}>
              {L('新建文件夹')}
            </button>
          </div>
        )}
        {movingPersonalFolder && (
          <div style={{ border: '1px solid #E4E3DD', borderRadius: 8, padding: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13 }}>{L('移动文件夹')}：{movingPersonalFolder.name}</span>
            <select value={movePersonalTarget ?? ''} style={{ ...input, width: 180 }}
              onChange={(e) => setMovePersonalTarget(e.target.value ? Number(e.target.value) : null)}>
              <option value="">{L('默认目录')}</option>
              {personalFolders
                .filter((folder) => folder.id !== movingPersonalFolder.id
                  && !isPersonalDescendant(folder.id, movingPersonalFolder.id))
                .map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
            </select>
            <button type="button" style={button(true)} disabled={busy} onClick={() => void saveMovePersonalFolder()}>{L('保存')}</button>
            <button type="button" style={button()} onClick={() => setMovingPersonalFolder(null)}>{L('取消')}</button>
          </div>
        )}
        {tab !== 'platform' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ ...input, width: 220 }} placeholder={L('名称/关键词')} />
            <input value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...input, width: 140 }} placeholder={L('上传分类（选填）')} />
            <button type="button" style={button()} onClick={() => { if (tab === 'enterprise') void loadContent(2, folderId); else void loadContent(1, null) }}>{L('搜索')}</button>
            <button type="button" style={button(true)} disabled={busy || (tab === 'personal' && !!overview && !overview.personal.canUpload)} onClick={() => void upload()}>{L('上传文件')}</button>
            <button type="button" style={button()} disabled={busy || !docJson} onClick={() => void saveCurrent()}>{L('保存当前模板')}</button>
          </div>
        )}
        {tab === 'platform' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ ...input, width: 220 }} placeholder={L('名称/分类/关键词')} />
            <select value={platformType ?? ''} onChange={(e) => setPlatformType(e.target.value ? Number(e.target.value) : undefined)} style={{ ...input, width: 120 }}>
              <option value="">{L('全部类型')}</option>
              <option value="1">{L('模板')}</option>
              <option value="2">{L('纯文本')}</option>
              <option value="3">Excel</option>
              <option value="4">CSV</option>
              <option value="5">{L('图片')}</option>
            </select>
            <input value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...input, width: 140 }} placeholder={L('分类')} />
            <button type="button" style={button(true)} onClick={() => void loadPlatform()}>{L('搜索')}</button>
          </div>
        )}
        {message && <div style={{ color: '#2E6E93' }}>{message}</div>}

        {tab === 'enterprise' && enterpriseEnabled && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" style={{ ...button(mineView), background: mineView ? '#EAF1FF' : '#fff' }} onClick={() => void loadMine()}>{L('我的上传')}</button>
            {folders.map((folder) => (
              <span key={folder.id} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                <button type="button" style={{ ...button(folderId === folder.id && !mineView), background: folderId === folder.id && !mineView ? '#EAF1FF' : '#fff' }} onClick={() => { setMineView(false); setFolderId(folder.id) }}>{folder.name}</button>
                {canManageFolder(folder) && (
                  <span style={{ fontSize: 11, color: '#6B7280' }}>
                    {folder.contentCount ?? 0} {L('项')} · {sizeText(folder.usedBytes ?? 0)}
                  </span>
                )}
                {canManageFolder(folder) && <button type="button" style={button()} disabled={!canWriteFolder(folder, enterpriseReadOnly)} onClick={() => void editMembers(folder)}>{L('可见成员')}</button>}
                {canManageFolder(folder) && <button type="button" style={button()} disabled={!canWriteFolder(folder, enterpriseReadOnly)} onClick={() => void renameFolder(folder)}>{L('改名')}</button>}
                {canManageFolder(folder) && <button type="button" style={button()} disabled={!canDeleteFolder(folder) || !canWriteFolder(folder, enterpriseReadOnly)} onClick={() => void deleteFolder(folder)}>{L('删除')}</button>}
              </span>
            ))}
            {enterprise?.isAdmin && <button type="button" style={button()} disabled={enterpriseReadOnly} onClick={() => void createFolder()}>{L('新建文件夹')}</button>}
            {folders.length === 0 && enterprise?.isAdmin && (
              <span style={{ fontSize: 12, color: '#6B7280' }}>
                {L('还没有文件夹，点击「新建文件夹」开始。')}
              </span>
            )}
          </div>
        )}

        {members && (
          <div style={{ border: '1px solid #E4E3DD', borderRadius: 8, padding: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{L('文件夹可见成员')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflow: 'auto' }}>
              {members.rows.map((row) => (
                <label key={row.memberId} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <input type="checkbox" checked={!!row.visible} onChange={(e) => setMembers({
                    ...members,
                    rows: members.rows.map((item) => item.memberId === row.memberId ? { ...item, visible: e.target.checked } : item)
                  })} />
                  {[row.nickname, row.mobile].filter(Boolean).join(' · ') || row.memberId}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" style={button(true)} onClick={() => void saveMembers()}>{L('保存')}</button>
              <button type="button" style={button()} onClick={() => setMembers(null)}>{L('取消')}</button>
            </div>
          </div>
        )}

        <div style={{ maxHeight: 380, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tab !== 'platform' && items.map((item) => (
            <div key={item.id} style={rowStyle}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                  {contentTypes[item.contentType] || L('未知')} · {sizeText(item.sizeBytes)}
                  {item.uploaderNickname ? ' · ' + item.uploaderNickname : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" style={button()} onClick={() => void openItem(item)}>{L('打开')}</button>
                <button type="button" style={button()} onClick={() => void saveItem(item)}>{L('另存为')}</button>
                {item.canDelete && <button type="button" style={{ ...button(), color: '#C0392B' }} onClick={() => void removeItem(item)}>{L('删除')}</button>}
              </div>
            </div>
          ))}
          {tab === 'platform' && platformItems.map((item) => (
            <div key={item.id} style={rowStyle}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                {item.thumb ? <img src={item.thumb} alt={item.name} style={thumbStyle} /> : <span style={{ width: 56, textAlign: 'center', color: '#9CA3AF' }}>—</span>}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                    {contentTypes[item.contentType] || L('未知')} · {sizeText(item.sizeBytes)} · {item.category || L('未分类')}
                  </div>
                </div>
              </div>
              <button type="button" style={button()} onClick={() => void openPlatform(item)}>{L('下载使用')}</button>
            </div>
          ))}
          {((tab !== 'platform' && items.length === 0) || (tab === 'platform' && platformItems.length === 0)) && (
            <div style={{ fontSize: 13, color: '#9CA3AF', padding: '28px 0', textAlign: 'center' }}>{L('暂无内容')}</div>
          )}
        </div>
      </div>
    </Modal>
  )
}
