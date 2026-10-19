import { useI18n } from './useI18n'
import { localizePropertyLabel } from '../../../../shared/i18n/property.en-US'

/**
 * Localize a plain JSX text node without adding a hook to the component.
 * Useful inside small helper components that render Chinese labels/options.
 */
export default function LText({ text }: { text: string }) {
  const { language } = useI18n()
  return <>{localizePropertyLabel(text, language)}</>
}
