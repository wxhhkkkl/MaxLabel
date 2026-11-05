import { useEffect, useMemo, useState } from 'react'
import type { ShareFolderItem, ShareFolderMember, ShareFolderMemberPermission } from '../../../shared/ipcContract'
import {
  folderPermissionsConfigured,
  normalizeFolderMemberPermissions
} from '../../../shared/domain/shareFolderRules'
import type { AppOptions } from './OptionsDialog'
import Modal from './Modal'
import { useI18n } from '../features/i18n/useI18n'

interface Props {
  options: AppOptions
  folder: ShareFolderItem
  onClose: () => void
  onSaved: () => void
}

const button = (primary = false): React.CSSProperties => ({
  padding: '7px 14px',
  borderRadius: 6,
  border: primary ? '1px solid #2E6E93' : '1px solid #D5D4CD',
  background: primary ? '#2E6E93' : '#fff',
  color: primary ? '#fff' : '#1A1B1C',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'inherit'
})

/** 企业文件夹的逐人权限：默认全部成员可访问且只读，管理员可对单人放开编辑/删除。 */
export default function ShareFolderMembersDialog({ options, folder, onClose, onSaved }: Props) {
  const { t } = useI18n()
  const context = useMemo(
    () => ({ baseUrl: options.mallBaseUrl, tenantId: options.mallTenantId }),
    [options.mallBaseUrl, options.mallTenantId]
  )
  const [rows, setRows] = useState<ShareFolderMemberPermission[]>([])
  const [memberInfo, setMemberInfo] = useState<Record<number, ShareFolderMember>>({})
  const [configured, setConfigured] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    setBusy(true)
    setError('')
    void window.maxlabel.share.folders.members(context, folder.id)
      .then((result) => {
        if (!live) return
        if (!result.ok) {
          setError(result.error || t('start.permissionsLoadFailed'))
          return
        }
        const members = result.members ?? []
        const explicit = folderPermissionsConfigured(folder.memberCount, members)
        setConfigured(explicit)
        setRows(normalizeFolderMemberPermissions(members, explicit))
        setMemberInfo(Object.fromEntries(members.map((member) => [member.memberId, member])))
      })
      .catch((reason) => {
        if (live) setError((reason as { message?: string })?.message || t('start.permissionsLoadFailed'))
      })
      .finally(() => { if (live) setBusy(false) })
    return () => { live = false }
  }, [context, folder.id, folder.memberCount, t])

  const patch = (memberId: number, next: Partial<ShareFolderMemberPermission>) => {
    setRows((current) => current.map((row) => {
      if (row.memberId !== memberId) return row
      const merged = { ...row, ...next }
      // 不可访问自然也不能编辑/删除。
      if (!merged.visible) return { ...merged, canEdit: false, canDelete: false }
      return merged
    }))
  }

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await window.maxlabel.share.folders.updateMembers(context, folder.id, rows)
      if (result.ok) onSaved()
      else setError(result.error || t('start.permissionsSaveFailed'))
    } catch (reason) {
      setError((reason as { message?: string })?.message || t('start.permissionsSaveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('start.folderPermissionsTitle')} onClose={onClose} width={620} testId="share-folder-permissions-dialog">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
        <div style={{ color: '#6B7280', fontSize: 12.5 }}>
          {configured ? t('start.folderPermissionConfiguredHint') : t('start.folderPermissionHint')}
        </div>
        {busy && <div className="start-empty" data-testid="start-permissions-loading">{t('start.spaceLoading')}</div>}
        {error && <div style={{ color: '#B3261E' }} data-testid="start-permissions-error">{error}</div>}
        {!busy && !error && rows.length === 0 && (
          <div className="start-empty" data-testid="start-permissions-empty">{t('start.permissionsEmpty')}</div>
        )}
        {!busy && rows.length > 0 && (
          <div className="start-permission-table" data-testid="start-permissions-list">
            <div className="start-permission-head">
              <span>{t('start.permissionMember')}</span>
              <span>{t('start.permissionVisible')}</span>
              <span>{t('start.permissionEdit')}</span>
              <span>{t('start.permissionDelete')}</span>
            </div>
            {rows.map((row) => {
              const info = memberInfo[row.memberId]
              return (
                <div key={row.memberId} className="start-permission-row" data-testid="start-permission-row">
                  <span className="start-permission-member">
                    {[info?.nickname, info?.mobile].filter(Boolean).join(' · ') || `#${row.memberId}`}
                  </span>
                  <label className="start-permission-check">
                    <input
                      type="checkbox"
                      data-testid="start-permission-visible"
                      checked={row.visible}
                      onChange={(event) => patch(row.memberId, { visible: event.target.checked })}
                    />
                  </label>
                  <label className="start-permission-check">
                    <input
                      type="checkbox"
                      data-testid="start-permission-edit"
                      checked={row.canEdit}
                      disabled={!row.visible}
                      onChange={(event) => patch(row.memberId, { canEdit: event.target.checked })}
                    />
                  </label>
                  <label className="start-permission-check">
                    <input
                      type="checkbox"
                      data-testid="start-permission-delete"
                      checked={row.canDelete}
                      disabled={!row.visible}
                      onChange={(event) => patch(row.memberId, { canDelete: event.target.checked })}
                    />
                  </label>
                </div>
              )
            })}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" style={button()} disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" data-testid="start-permissions-save" style={button(true)} disabled={busy || rows.length === 0} onClick={() => void save()}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
