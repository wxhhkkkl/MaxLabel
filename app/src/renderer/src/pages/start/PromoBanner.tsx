import { useI18n } from '../../features/i18n/useI18n'
import type { StartSpace } from './StartSpacePanel'

type BannerView = 'recent' | StartSpace

/** Decorative artwork changes with the selected workspace; actions live in the rail. */
function BannerArt({ view }: { view: BannerView }) {
  return (
    <svg viewBox="0 0 300 220" fill="none" aria-hidden="true">
      <circle cx="155" cy="110" r="96" stroke="currentColor" opacity=".1" />
      <circle cx="155" cy="110" r="75" stroke="currentColor" opacity=".12" strokeDasharray="3 7" />
      {view === 'recent' && <>
        <g transform="rotate(12 205 110)"><rect x="159" y="39" width="109" height="145" rx="8" fill="#c8dcfc" /><rect x="180" y="65" width="64" height="7" rx="3" fill="#94b6ed" /><path d="M180 88h64M180 100h45" stroke="#94b6ed" strokeWidth="4" /></g>
        <g transform="rotate(-10 130 110)"><rect x="63" y="24" width="139" height="176" rx="8" fill="white" stroke="#ccdcf5" /><text x="81" y="50" fill="#4774b4" fontSize="9" letterSpacing="2">MAXLABEL</text><path d="M81 63h102" stroke="#dce7f7" /><text x="81" y="96" fill="#244c8c" fontSize="24" fontFamily="Georgia">Make your</text><text x="81" y="122" fill="#244c8c" fontSize="24" fontFamily="Georgia">mark.</text>{Array.from({ length: 25 }, (_, i) => <rect key={i} x={82 + i * 4} y="141" width={i % 3 === 0 ? 3 : 1.5} height="31" fill="#315b99" />)}<text x="81" y="186" fill="#7691b9" fontSize="6" letterSpacing="1.4">DESIGNED BY YOU / 001</text></g>
      </>}
      {view === 'personal' && <>
        <rect x="104" y="27" width="111" height="125" rx="10" fill="#fff" stroke="#c5d9f8" transform="rotate(9 160 90)" />
        <rect x="126" y="48" width="35" height="29" rx="5" fill="#d8e7ff" /><path d="M126 95h67M126 107h44" stroke="#abc6ee" strokeWidth="5" strokeLinecap="round" />
        <path d="M43 100a10 10 0 0 1 10-10h64l17 17h119a10 10 0 0 1 10 10v65a12 12 0 0 1-12 12H55a12 12 0 0 1-12-12z" fill="#75a6f0" />
        <path d="M43 124a10 10 0 0 1 10-10h200a10 10 0 0 1 10 10l-12 62a10 10 0 0 1-10 8H66a10 10 0 0 1-10-8z" fill="#a9cbff" stroke="#8ab6f8" />
        <circle cx="155" cy="153" r="21" fill="#eaf3ff" /><circle cx="155" cy="147" r="6" fill="#6093e0" /><path d="M145 164c0-12 20-12 20 0" fill="#6093e0" />
      </>}
      {view === 'enterprise' && <>
        <path d="M150 72v48M76 147v-27h149v27" stroke="#8db9f3" strokeWidth="2" strokeDasharray="5 5" />
        <rect x="113" y="21" width="75" height="65" rx="12" fill="#e3efff" /><path d="M135 68V37h31v31M143 45h4m7 0h4m-15 9h4m7 0h4m-10 14v-7" stroke="#4c7fc7" strokeWidth="3" />
        {[45, 119, 193].map((x) => <g key={x}><rect x={x} y="139" width="62" height="58" rx="11" fill="#c4ddff" /><circle cx={x + 31} cy="158" r="7" fill="#5388d1" /><path d={`M${x + 18} 182c0-17 26-17 26 0`} fill="#5388d1" /></g>)}
        <circle cx="234" cy="64" r="19" fill="#4687db" /><path d="m225 64 6 6 12-13" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </>}
      {view === 'platform' && <>
        <rect x="45" y="37" width="211" height="147" rx="12" fill="white" stroke="#b9d5f7" /><path d="M45 61h211" stroke="#d9e8fb" />
        {[59, 68, 77].map(x => <circle key={x} cx={x} cy="49" r="2.5" fill="#aac9f1" />)}
        <rect x="60" y="78" width="78" height="90" rx="7" fill="#e4efff" /><path d="M76 96h46M76 105h30" stroke="#90b6ea" strokeWidth="4" /><path d="M76 124h4v28h-4zm7 0h2v28h-2zm5 0h4v28h-4zm7 0h2v28h-2zm5 0h5v28h-5zm8 0h2v28h-2zm5 0h8v28h-8z" fill="#6495d6" />
        <rect x="149" y="78" width="90" height="40" rx="6" fill="#cce2fc" /><circle cx="170" cy="91" r="5" fill="#8db7eb" /><path d="m154 112 20-17 17 12 16-21 25 26" fill="#a6c9f2" />
        <rect x="149" y="129" width="90" height="39" rx="6" fill="#edf4ff" /><path d="M162 141h63M162 153h63M182 136v25M204 136v25" stroke="#a5c4ed" />
        <circle cx="250" cy="177" r="26" fill="#3e7cdb" /><path d="m238 177 8 8 16-17" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </>}
    </svg>
  )
}

export default function PromoBanner({ view }: { view: BannerView }) {
  const { t } = useI18n()
  return (
    <section className="start-banner" data-testid="start-banner" data-view={view}>
      <div>
        <span className="start-hero-eyebrow">{view === 'recent' ? 'DESIGN / YOUR NEXT GREAT LABEL' : t(`start.banner.${view}Eyebrow`)}</span>
        <h2>{t(view === 'recent' ? 'start.bannerTitle' : `start.banner.${view}Title`)}</h2>
        <p>{t(view === 'recent' ? 'start.bannerSubtitle' : `start.banner.${view}Subtitle`)}</p>
      </div>
      <div className="start-banner-art"><BannerArt view={view} /></div>
    </section>
  )
}
