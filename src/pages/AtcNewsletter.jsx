import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { assembleSections } from './atcLayout.js'
import './AtcNewsletter.css'

const fontSizes = [10.5, 10, 9.5, 9, 8.5]

function Announcement({ entry, selected, onSelect }) {
  return <div className={`atc-announcement ${selected === entry ? 'is-selected' : ''}`} onClick={() => onSelect?.(entry)} role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} onKeyDown={event => { if (onSelect && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect(entry) } }}>
    <p dir="auto">{entry.title && <strong>{entry.title}{entry.body ? ' · ' : ''}</strong>}{entry.body}</p>
    {(entry.event_date || entry.price || entry.contact) && <small dir="auto">{[entry.event_date, entry.price, entry.contact].filter(Boolean).join(' · ')}</small>}
  </div>
}

function ShabbosStrip({ shabbos }) {
  if (!shabbos) return null
  return <div className="atc-shabbos" dir="rtl">
    <strong>{shabbos.parsha_he} <bdi>· {shabbos.parsha_en}</bdi></strong>
    {[
      ['הדלקת נרות', shabbos.candle_lighting], ['שקיעה', shabbos.friday_sunset], ['מנחה ערב שבת', shabbos.friday_mincha], ['שחרית', shabbos.shacharis], ['ס״ז ק״ש מ״א', shabbos.sof_zman_shema_mga], ['ס״ז ק״ש גר״א', shabbos.sof_zman_shema_gra], ['מנחה שבת', shabbos.shabbos_mincha], ['מעריב מוצאי שבת', shabbos.motzai_maariv], ['הבדלה', shabbos.shabbos_ends],
    ].filter(([, value]) => value).map(([label, value]) => <span key={label}><em>{label}</em> <bdi>{value}</bdi></span>)}
  </div>
}

function packSections(sections, heights, capacities) {
  const columns = [[]]
  const unfit = []
  let column = 0, used = 0, currentSection = -1, currentGroup = ''
  function capacity(index) { return capacities[Math.min(Math.floor(index / 2), capacities.length - 1)] }
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex]
    for (let entryIndex = 0; entryIndex < section.entries.length; entryIndex++) {
      const group = section.subgroups?.[entryIndex] || ''
      let headingNeeded = currentSection !== sectionIndex
      let groupNeeded = Boolean(group) && (headingNeeded || currentGroup !== group)
      let needed = (headingNeeded ? heights[`h-${sectionIndex}`] || 0 : 0) + (groupNeeded ? heights[`s-${sectionIndex}-${entryIndex}`] || 0 : 0) + (heights[`e-${sectionIndex}-${entryIndex}`] || 0)
      if (used && used + needed > capacity(column)) {
        column += 1; columns.push([]); used = 0; currentSection = -1; currentGroup = ''
        headingNeeded = true; groupNeeded = Boolean(group)
        needed = (heights[`h-${sectionIndex}`] || 0) + (groupNeeded ? heights[`s-${sectionIndex}-${entryIndex}`] || 0 : 0) + (heights[`e-${sectionIndex}-${entryIndex}`] || 0)
      }
      if (needed > capacity(column)) unfit.push(section.entries[entryIndex])
      if (headingNeeded) columns[column].push({ type: 'heading', sectionIndex, continued: entryIndex > 0 })
      if (groupNeeded) columns[column].push({ type: 'subheading', sectionIndex, entryIndex, label: group })
      columns[column].push({ type: 'entry', sectionIndex, entryIndex })
      used += needed
      currentSection = sectionIndex; currentGroup = group
    }
  }
  return { columns, unfit }
}

export default function AtcNewsletter({ issue, entries, selected, onSelect }) {
  const sections = useMemo(() => assembleSections(entries, issue.categories), [entries, issue.categories])
  const shabbos = issue.shabbos
  const [layout, setLayout] = useState({ sections: null, fontSize: fontSizes[0], columns: [[]], unfit: [] })
  const [fontRevision, setFontRevision] = useState(0)
  const measureRef = useRef(null)
  const pageOneRef = useRef(null)
  const pageTwoRef = useRef(null)
  useLayoutEffect(() => { document.fonts?.ready.then(() => setFontRevision(value => value + 1)) }, [])
  useLayoutEffect(() => {
    if (!measureRef.current || !pageOneRef.current || !pageTwoRef.current) return
    const capacities = [pageOneRef.current.clientHeight, pageTwoRef.current.clientHeight]
    let packed = { columns: [[]], unfit: [] }, selectedSize = fontSizes.at(-1), selectedHeights = {}
    for (const size of fontSizes) {
      measureRef.current.style.setProperty('--atc-copy-size', `${size}pt`)
      const heights = Object.fromEntries([...measureRef.current.querySelectorAll('[data-measure-key]')].map(node => [node.dataset.measureKey, node.getBoundingClientRect().height]))
      packed = packSections(sections, heights, capacities)
      selectedSize = size
      selectedHeights = heights
      if (packed.columns.length <= 4 && !packed.unfit.length) break
    }
    if (packed.columns.length > 2 && packed.columns.length <= 4 && !packed.unfit.length) {
      let low = capacities[1] * .45, high = capacities[1]
      for (let attemptIndex = 0; attemptIndex < 8; attemptIndex++) {
        const middle = (low + high) / 2
        const candidate = packSections(sections, selectedHeights, [capacities[0], middle])
        if (candidate.columns.length <= 4 && !candidate.unfit.length) { packed = candidate; high = middle }
        else low = middle
      }
    }
    // Layout is measured from the actual DOM and must update before the preview paints.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLayout({ sections, fontSize: selectedSize, columns: packed.columns, unfit: packed.unfit })
  }, [sections, fontRevision, shabbos])
  // A deletion can remove an entire section. Never render column indexes from the previous list.
  const { fontSize, columns, unfit } = layout.sections === sections ? layout : { fontSize: fontSizes[0], columns: [[]], unfit: [] }
  const overflow = (columns.length > 4 || unfit.length > 0) && fontSize === fontSizes.at(-1)
  const pages = Array.from({ length: Math.max(2, Math.ceil(columns.length / 2)) }, (_, index) => index)
  return <>
    {overflow && <p className="atc-overflow-warning" role="alert">This issue cannot fit within two Letter pages at the minimum readable 8.5 pt. Shorten or remove announcements before approval. Check: {[...new Set([...unfit, ...[...entries].sort((a, b) => (b.body?.length || 0) - (a.body?.length || 0)).slice(0, 3)])].slice(0, 3).map(entry => entry.title || entry.body?.slice(0, 35)).join('; ')}.</p>}
    {shabbos?.verification_status !== 'VERIFIED' && <p className="atc-overflow-warning" role="status">Shabbos times are awaiting administrator verification.</p>}
    <article className="atc-paper" aria-label="Printable newsletter" style={{ '--atc-copy-size': `${fontSize}pt` }}>
      {pages.map(page => <div className={`atc-page ${page > 0 && !columns[page * 2]?.length && !columns[page * 2 + 1]?.length ? 'atc-page-empty' : ''}`} key={page}>
        <header className={`atc-masthead ${page ? 'atc-masthead-continued' : ''}`}><img src="/around-the-commons-logo.png" alt="Around the Commons · Lakewood Commons" onLoad={page === 0 ? () => setFontRevision(value => value + 1) : undefined} />{page > 0 && <span>Continued</span>}</header>
        {page === 0 && <ShabbosStrip shabbos={shabbos} />}
        <div className="atc-page-columns" ref={page === 0 ? pageOneRef : page === 1 ? pageTwoRef : undefined} dir="rtl">
          {[0, 1].map(side => <div className="atc-column" key={side} dir="ltr">{(columns[page * 2 + side] || []).map((block, index) => {
            const section = sections[block.sectionIndex]
            if (!section || (block.type === 'entry' && !section.entries[block.entryIndex])) return null
            if (block.type === 'heading') return <h2 className={section.name === 'Neileich Updates' ? 'atc-section-heading atc-feature-heading' : 'atc-section-heading'} key={`${index}-h`}>{section.name}{block.continued ? ' · continued' : ''}</h2>
            if (block.type === 'subheading') return <h3 className="atc-subheading" key={`${index}-s`}>{block.label}</h3>
            return <Announcement key={`${index}-e`} entry={section.entries[block.entryIndex]} selected={selected} onSelect={onSelect} />
          })}</div>)}
        </div>
      </div>)}
      <div className="atc-measure" ref={measureRef} aria-hidden="true">
        {sections.map((section, sectionIndex) => <div key={section.name}>
          <h2 className={section.name === 'Neileich Updates' ? 'atc-section-heading atc-feature-heading' : 'atc-section-heading'} data-measure-key={`h-${sectionIndex}`}>{section.name}</h2>
          {section.entries.map((entry, entryIndex) => <div key={entry.id || entryIndex}>
            {section.subgroups && <h3 className="atc-subheading" data-measure-key={`s-${sectionIndex}-${entryIndex}`}>{section.subgroups[entryIndex]}</h3>}
            <div data-measure-key={`e-${sectionIndex}-${entryIndex}`}><Announcement entry={entry} /></div>
          </div>)}
        </div>)}
      </div>
    </article>
  </>
}
