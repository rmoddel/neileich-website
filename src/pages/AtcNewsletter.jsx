import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { assembleFooter, assembleSections, bannerOrder, packSections } from './atcLayout.js'
import './AtcNewsletter.css'

const fontSizes = [10.5, 10, 9.5, 9, 8.5]
const MAX_PAGES = 2
// Small per-column allowance for sub-pixel rounding between measurement and the printed page.
const SAFETY_PX = 3

function selectable(entry, onSelect) {
  if (!onSelect) return {}
  return { onClick: () => onSelect(entry), role: 'button', tabIndex: 0, onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(entry) } } }
}

function Announcement({ entry, selected, onSelect }) {
  return <div className={`atc-announcement ${selected === entry ? 'is-selected' : ''}`} {...selectable(entry, onSelect)}>
    <p dir="auto">{entry.body}</p>
    {(entry.event_date || entry.price || entry.contact) && <small dir="auto">{[entry.event_date, entry.price, entry.contact].filter(Boolean).join(' · ')}</small>}
  </div>
}

function ShabbosStrip({ shabbos }) {
  if (!shabbos) return null
  return <div className="atc-shabbos" dir="rtl">
    <strong>{shabbos.parsha_he} <bdi>· {shabbos.parsha_en}</bdi></strong>
    <div className="atc-zmanim-grid">{[
      ['הדלקת נרות', shabbos.candle_lighting], ['שקיעה', shabbos.friday_sunset], ['מנחה ערב שבת', shabbos.friday_mincha], ['שחרית', shabbos.shacharis], ['ס״ז ק״ש מ״א', shabbos.sof_zman_shema_mga], ['ס״ז ק״ש גר״א', shabbos.sof_zman_shema_gra], ['מנחה שבת', shabbos.shabbos_mincha], ['מעריב מוצאי שבת', shabbos.motzai_maariv], ['הבדלה', shabbos.shabbos_ends],
    ].filter(([, value]) => value).map(([label, value]) => <span key={label}><em>{label}</em> <bdi>{value}</bdi></span>)}</div>
  </div>
}

function Masthead({ first, shabbos, onLoad }) {
  return <header className={`atc-masthead ${first ? '' : 'atc-masthead-continued'}`}>
    <img src="/around-the-commons-logo.png" alt={first ? 'Around the Commons · Lakewood Commons' : ''} onLoad={onLoad} />
    {first ? <ShabbosStrip shabbos={shabbos} /> : <span>Continued</span>}
  </header>
}

// Full-width band across the top of page 1 with two columns inside (Neileich Updates, Mazel Tovs).
function BannerSection({ section, selected, onSelect }) {
  const kind = section.name === 'Neileich Updates' ? 'atc-banner-featured' : 'atc-banner-mazel'
  return <section className={`atc-banner ${kind}`} aria-label={section.name}>
    <h2>{section.name}</h2>
    {section.entries.length === 0
      ? <div className="atc-empty-section" aria-label={`No ${section.name} this week`} />
      : <div className="atc-banner-columns" dir="rtl">{section.entries.map((entry, index) => {
        const group = section.subgroups?.[index]
        const showGroup = group && (index === 0 || group !== section.subgroups[index - 1])
        return <div className="atc-banner-item" key={entry.id || index} dir="ltr">
          {showGroup && <h3 className="atc-subheading">{group}</h3>}
          <Announcement entry={entry} selected={selected} onSelect={onSelect} />
        </div>
      })}</div>}
  </section>
}

function Footer({ entries, selected, onSelect }) {
  if (!entries.length) return null
  return <footer className="atc-footer">{entries.map((entry, index) => <div key={entry.id || index} className={`atc-footer-item ${selected === entry ? 'is-selected' : ''}`} dir="auto" {...selectable(entry, onSelect)}>
    {entry.title && <strong>{entry.title}: </strong>}{entry.body}{[entry.price, entry.contact].filter(Boolean).map(value => ` · ${value}`).join('')}
  </div>)}</footer>
}

// Height of a measured block including its own margins (wrappers are display: flow-root).
const blockHeight = node => node?.getBoundingClientRect().height || 0

// Arrangements tried in order: both bands across the top, then Mazel Tovs moved into the columns
// (a band cannot split across columns or pages, so a very long Mazel Tovs list must flow instead).
function arrangements(sections) {
  const byName = name => sections.find(section => section.name === name)
  const rest = sections.filter(section => !bannerOrder.includes(section.name))
  const [lead, ...others] = bannerOrder.map(byName).filter(Boolean)
  return [
    { banners: [lead, ...others].filter(Boolean), regular: rest },
    ...(others.length ? [{ banners: [lead], regular: [...others, ...rest] }] : []),
  ]
}

export default function AtcNewsletter({ issue, entries, selected, onSelect }) {
  const sections = useMemo(() => assembleSections(entries, issue.categories), [entries, issue.categories])
  const footer = useMemo(() => assembleFooter(entries), [entries])
  const options = useMemo(() => arrangements(sections), [sections])
  // Every section that might print in a column; all are measured for each font size.
  const columnCandidates = options.at(-1).regular
  const shabbos = issue.shabbos
  const [layout, setLayout] = useState({ sections: null })
  // Extra height removed from every column after a rendered column was found running past its page.
  const [slack, setSlack] = useState({ sections: null, px: 0 })
  const [fontRevision, setFontRevision] = useState(0)
  const articleRef = useRef(null)
  const measureRef = useRef(null)
  const probeOneRef = useRef(null)
  const probeTwoRef = useRef(null)
  const refresh = () => setFontRevision(value => value + 1)
  useLayoutEffect(() => { document.fonts?.ready.then(refresh) }, [])

  useLayoutEffect(() => {
    const measure = measureRef.current
    if (!measure || !probeOneRef.current || !probeTwoRef.current) return
    const slackPx = slack.sections === sections ? slack.px : 0
    // Column area of an otherwise empty page 1 (masthead + Shabbos strip) and of a continuation page.
    const baseOne = probeOneRef.current.clientHeight
    const baseTwo = probeTwoRef.current.clientHeight
    const fits = (result, pageLimit = MAX_PAGES) => result.columns.length <= pageLimit * 2 && !result.unfit.length
    let best = null
    search: for (const option of options) {
      for (const size of fontSizes) {
        measure.style.setProperty('--atc-copy-size', `${size}pt`)
        const bannerHeight = option.banners.reduce((sum, section) => sum + blockHeight(measure.querySelector(`[data-measure-banner="${CSS.escape(section.name)}"]`)), 0)
        const footerHeight = blockHeight(measure.querySelector('[data-measure-footer]'))
        const heights = Object.fromEntries([...measure.querySelectorAll('[data-measure-key]')].map(node => [node.dataset.measureKey, Math.ceil(blockHeight(node))]))
        const pageOne = baseOne - bannerHeight - SAFETY_PX - slackPx
        const continuation = baseTwo - SAFETY_PX - slackPx
        // The footer prints on the last page: try a single page first, then two pages.
        let capacities = [pageOne - footerHeight]
        let packed = packSections(option.regular, heights, capacities)
        if (!fits(packed, 1)) {
          capacities = [pageOne, continuation - footerHeight]
          packed = packSections(option.regular, heights, capacities)
        }
        if (bannerHeight + footerHeight > baseOne - 40) packed.unfit.push(...option.banners.flatMap(section => section.entries))
        best = { ...option, fontSize: size, columns: packed.columns, unfit: packed.unfit, heights, capacities }
        if (fits(best)) break search
      }
    }
    // Balance page 2: use the smallest page-2 column height that still fits everything on two pages.
    if (best.capacities.length === 2 && best.columns.length > 2 && fits(best)) {
      let low = best.capacities[1] * .45, high = best.capacities[1]
      for (let attempt = 0; attempt < 8; attempt++) {
        const middle = (low + high) / 2
        const candidate = packSections(best.regular, best.heights, [best.capacities[0], middle])
        if (fits(candidate)) { best.columns = candidate.columns; high = middle }
        else low = middle
      }
    }
    // Layout is measured from the actual DOM and must update before the preview paints.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLayout({ sections, banners: best.banners, regular: best.regular, fontSize: best.fontSize, columns: best.columns, unfit: best.unfit })
  }, [sections, options, footer, fontRevision, shabbos, slack])

  // Page-break guard: after layout, verify no column runs past the bottom of its page.
  // If one does (font fallback, rounding, wrapped "continued" headings...), re-pack with less room.
  useLayoutEffect(() => {
    if (layout.sections !== sections || !articleRef.current) return
    let worst = 0
    for (const columnsNode of articleRef.current.querySelectorAll('.atc-page:not(.atc-probe) .atc-page-columns')) {
      const limit = columnsNode.getBoundingClientRect().bottom
      for (const column of columnsNode.children) {
        const last = column.lastElementChild
        if (last) worst = Math.max(worst, last.getBoundingClientRect().bottom + parseFloat(getComputedStyle(last).marginBottom || 0) - limit)
      }
    }
    const current = slack.sections === sections ? slack.px : 0
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (worst > .5 && current < 400) setSlack({ sections, px: current + Math.ceil(worst) + 2 })
  }, [layout, sections, slack])

  // A deletion can remove an entire section. Never render column indexes from a previous list.
  const current = layout.sections === sections ? layout : { banners: options[0].banners, regular: options[0].regular, fontSize: fontSizes[0], columns: [[]], unfit: [] }
  const { banners, regular, fontSize, columns, unfit } = current
  const overflow = columns.length > MAX_PAGES * 2 || unfit.length > 0
  const pages = Array.from({ length: Math.max(1, Math.ceil(columns.length / 2)) }, (_, index) => index)
  return <>
    {overflow && <p className="atc-overflow-warning" role="alert">This issue cannot fit within two Letter pages at the minimum readable 8.5 pt. Shorten or remove announcements before approval. Check: {[...new Set([...unfit, ...[...entries].sort((a, b) => (b.body?.length || 0) - (a.body?.length || 0)).slice(0, 3)])].slice(0, 3).map(entry => entry.title || entry.body?.slice(0, 35)).join('; ')}.</p>}
    {shabbos?.verification_status !== 'VERIFIED' && <p className="atc-overflow-warning" role="status">Shabbos times are awaiting administrator verification.</p>}
    <article className="atc-newsletter" ref={articleRef} aria-label="Printable newsletter" style={{ '--atc-copy-size': `${fontSize}pt` }}>
      {pages.map(page => <div className="atc-page" key={page}>
        <Masthead first={page === 0} shabbos={shabbos} onLoad={page === 0 ? refresh : undefined} />
        {page === 0 && banners.map(section => <BannerSection key={section.name} section={section} selected={selected} onSelect={onSelect} />)}
        <div className="atc-page-columns" dir="rtl">
          {[0, 1].map(side => <div className="atc-column" key={side} dir="ltr">{(columns[page * 2 + side] || []).map((block, index) => {
            const section = regular[block.sectionIndex]
            if (!section || (block.type === 'entry' && !section.entries[block.entryIndex])) return null
            if (block.type === 'heading') return <h2 className="atc-section-heading" key={`${index}-h`}>{section.name}{block.continued ? ' · continued' : ''}</h2>
            if (block.type === 'subheading') return <h3 className="atc-subheading" key={`${index}-s`}>{block.label}</h3>
            if (block.type === 'empty') return <div className="atc-empty-section" key={`${index}-empty`} aria-label={`No ${section.name} this week`} />
            return <Announcement key={`${index}-e`} entry={section.entries[block.entryIndex]} selected={selected} onSelect={onSelect} />
          })}</div>)}
        </div>
        {page === pages.length - 1 && <Footer entries={footer} selected={selected} onSelect={onSelect} />}
      </div>)}
      <div className="atc-page atc-probe" aria-hidden="true"><Masthead first shabbos={shabbos} onLoad={refresh} /><div className="atc-page-columns" ref={probeOneRef} /></div>
      <div className="atc-page atc-probe" aria-hidden="true"><Masthead first={false} onLoad={refresh} /><div className="atc-page-columns" ref={probeTwoRef} /></div>
      <div className="atc-measure" ref={measureRef} aria-hidden="true">
        {options[0].banners.map(section => <div key={section.name} data-measure-banner={section.name}><BannerSection section={section} /></div>)}
        {footer.length > 0 && <div data-measure-footer><Footer entries={footer} /></div>}
        {/* Measured in the narrower (left) column so every block's height is a safe upper bound. */}
        <div className="atc-page-columns"><div className="atc-column" /><div className="atc-column">
          {columnCandidates.map(section => <div key={section.name}>
            <div data-measure-key={`h-${section.name}`}><h2 className="atc-section-heading">{section.name}</h2></div>
            <div data-measure-key={`hc-${section.name}`}><h2 className="atc-section-heading">{section.name} · continued</h2></div>
            {section.entries.length === 0 && <div data-measure-key={`empty-${section.name}`}><div className="atc-empty-section" /></div>}
            {section.entries.map((entry, entryIndex) => <div key={entry.id || entryIndex}>
              {section.subgroups && <div data-measure-key={`s-${section.name}-${entryIndex}`}><h3 className="atc-subheading">{section.subgroups[entryIndex]}</h3></div>}
              <div data-measure-key={`e-${section.name}-${entryIndex}`}><Announcement entry={entry} /></div>
            </div>)}
          </div>)}
        </div></div>
      </div>
    </article>
  </>
}
