import { useLayoutEffect, useRef, useState } from 'react'
import { HELP_SECTIONS, type HelpKey } from '../../../shared/i18n/help'
import { useI18n } from '../features/i18n/useI18n'
import HelpFigure from './HelpFigure'
import './help-dialog.css'

interface Props {
  onClose: () => void
  initialTopic?: HelpKey
}

export default function HelpDialog({ onClose, initialTopic = 'start' }: Props) {
  const { language, t } = useI18n()
  const sections = HELP_SECTIONS[language]
  const [key, setKey] = useState(initialTopic)
  const [query, setQuery] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const articleRef = useRef<HTMLDivElement>(null)
  const section = sections.find((item) => item.key === key) ?? sections[0]
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const results = terms.length ? sections.flatMap((topic) => topic.items.flatMap((item, index) => {
    const text = [topic.title, topic.intro, item.t, item.d].join(' ').toLocaleLowerCase()
    return terms.every((term) => text.includes(term)) ? [{ topic, item, index }] : []
  })) : []

  const openTopic = (topic: HelpKey) => {
    setKey(topic)
    setQuery('')
  }

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  useLayoutEffect(() => {
    if (articleRef.current) articleRef.current.scrollTop = 0
  }, [key, query])

  return (
    <dialog
      ref={dialogRef}
      className="help-dialog"
      data-testid="help-dialog"
      aria-labelledby="help-heading"
      onCancel={(event) => { event.preventDefault(); onClose() }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <header className="help-header">
        <h1 id="help-heading" data-testid="modal-title">{t('help.dialog.title')}</h1>
        <input
          autoFocus
          type="search"
          className="help-search"
          data-testid="help-search"
          aria-label={t('help.search')}
          placeholder={t('help.search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="help-close" type="button" aria-label={t('common.close')} onClick={onClose}>×</button>
      </header>
      <div className="help-layout">
        <nav className="help-nav" aria-label={t('help.contents')}>
          <h2>{t('help.contents')}</h2>
          {sections.map((topic) => (
            <button
              key={topic.key}
              type="button"
              data-testid="help-section"
              data-help-key={topic.key}
              aria-current={!terms.length && topic.key === section.key ? 'page' : undefined}
              onClick={() => openTopic(topic.key)}
            >
              {topic.title}
            </button>
          ))}
        </nav>
        <div className="help-article" ref={articleRef}>
          {terms.length ? (
            <section aria-labelledby="help-search-heading">
              <h2 id="help-search-heading">{t('help.results', { count: results.length })}</h2>
              {results.length === 0 && <p className="help-intro">{t('help.noResults')}</p>}
              <ul className="help-entries">
                {results.map(({ topic, item, index }) => (
                  <li key={`${topic.key}-${index}`}>
                    <button type="button" className="help-topic-label" onClick={() => openTopic(topic.key)}>{topic.title}</button>
                    <h3>{item.t}</h3>
                    <p>{item.d}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section aria-labelledby="help-topic-heading">
              <h2 id="help-topic-heading">{section.title}</h2>
              <p className="help-intro">{section.intro}</p>
              <HelpFigure topic={section.key} language={language} />
              <ol className="help-entries" data-steps={section.key === 'start'}>
                {section.items.map((item) => (
                  <li key={item.t}>
                    <h3>{item.t}</h3>
                    <p>{item.d}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>
    </dialog>
  )
}
