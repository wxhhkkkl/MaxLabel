import type { MallMember } from '../../../shared/ipcContract'
import { localizePropertyLabel } from '../../../shared/i18n/property.en-US'
import { useI18n } from '../features/i18n/useI18n'
import Modal from './Modal'
import MallLoginPanel from './MallLoginPanel'
import type { AppOptions } from './OptionsDialog'

interface Props {
  options: AppOptions
  onClose: () => void
  onMember: (member: MallMember) => void
}

export default function MallLoginDialog({ options, onClose, onMember }: Props) {
  const { language } = useI18n()
  return (
    <Modal title={localizePropertyLabel('登录赋签', language)} onClose={onClose} width={420} testId="mall-login-dialog">
      <MallLoginPanel options={options} onMember={onMember} />
    </Modal>
  )
}
