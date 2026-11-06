import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import './AroundTheCommons.css'

const defaults = ['Neileich Updates', 'Mazel Tov', 'Community Updates', 'Events & Shiurim', 'Classifieds', 'Looking For', 'Selling / For Rent', 'Lost & Found', 'Other community notices']
const sectionPriority = ['Neileich Updates', 'Mazel Tovs', 'Community Updates', 'Events & Shiurim', 'Classifieds', 'Looking For', 'Selling / For Rent', 'Lost & Found', 'Other community notices']
const sectionAlias = { 'Mazel Tov': 'Mazel Tovs', 'Libraries & Kids': 'Neileich Updates', 'Classifieds & Services': 'Classifieds', 'Other Notices': 'Other community notices' }
const shabbosFields = [['parsha_he', 'Parsha (Hebrew)'], ['parsha_en', 'Parsha (English)'], ['candle_lighting', 'Candle lighting'], ['friday_mincha', 'Friday Mincha'], ['friday_maariv', 'Friday Maariv'], ['shacharis', 'Shacharis'], ['sof_zman_shema_gra', 'Sof zman Shema (GRA)'], ['sof_zman_shema_mga', 'Sof zman Shema (MGA)'], ['shabbos_mincha', 'Shabbos Mincha'], ['motzai_maariv', 'Motzai Shabbos Maariv'], ['friday_sunset', 'Friday sunset'], ['shabbos_ends', 'Shabbos ends'], ['source', 'Official source'], ['notes', 'Notes']]
const emptyEntry = (category, order) => ({ id: '', category, title: '', body: '', contact: '', event_date: '', price: '', flags: '', notes: '', review_status: 'NEEDS_REVIEW', sort_order: String(order) })
async function api(path, options) {
  const response = await fetch(`/api/newsletter/${path}`, { credentials: 'same-origin', cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.details?.length ? `${body.error}: ${body.details.join('; ')}` : body.error || 'Request failed')
  return body
}
function warning(entry, week) {
  const result = []
  if (entry.review_status === 'NEEDS_REVIEW') result.push('Needs review')
  if (entry.flags) result.push(entry.flags)
  if (!entry.title && !entry.body) result.push('Missing wording')
  if (entry.event_date && (!/^\d{4}-\d{2}-\d{2}$/.test(entry.event_date) || entry.event_date < week)) result.push('Check event date')
  return result
}
function Newsletter({ issue, entries, selected, onSelect }) {
  const categories = issue.categories?.length ? issue.categories : defaults.map((category, print_order) => ({ category, print_order }))
  const ordered = [...entries].filter(entry => entry.review_status !== 'EXCLUDE').sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
  const names = [...new Set([...categories.map(item => item.category), ...ordered.map(item => item.category)].map(name => sectionAlias[name] || name))]
  const sections = names.map(name => ({ name, entries: ordered.filter(entry => (sectionAlias[entry.category] || entry.category) === name) })).filter(item => item.entries.length).sort((a, b) => {
    const ai = sectionPriority.indexOf(a.name), bi = sectionPriority.indexOf(b.name)
    return (ai < 0 ? 100 + names.indexOf(a.name) : ai) - (bi < 0 ? 100 + names.indexOf(b.name) : bi)
  })
  const shabbos = issue.shabbos?.verification_status === 'VERIFIED' ? issue.shabbos : null
  return <article className="atc-paper" aria-label="Printable newsletter">
    <header className="atc-masthead">
      <img src="/logo-english.png" alt="Neileich" />
      <div><p className="atc-kicker">The Lakewood Commons community newsletter</p><h1>Around the Commons</h1></div>
    </header>
    {shabbos && <div className="atc-shabbos" dir="rtl">
      <strong>{shabbos.parsha_he} <bdi>· {shabbos.parsha_en}</bdi></strong>
      {[
        ['הדלקת נרות', shabbos.candle_lighting], ['שקיעה', shabbos.friday_sunset], ['מנחה ערב שבת', shabbos.friday_mincha], ['שחרית', shabbos.shacharis], ['ס״ז ק״ש מ״א', shabbos.sof_zman_shema_mga], ['ס״ז ק״ש גר״א', shabbos.sof_zman_shema_gra], ['מנחה שבת', shabbos.shabbos_mincha], ['מעריב מוצאי שבת', shabbos.motzai_maariv], ['הבדלה', shabbos.shabbos_ends],
      ].filter(([, value]) => value).map(([label, value]) => <span key={label}><em>{label}</em> <bdi>{value}</bdi></span>)}
    </div>}
    <div className="atc-columns" dir="rtl">
      {sections.map(section => <section className={section.name === 'Neileich Updates' ? 'atc-section atc-feature' : 'atc-section'} key={section.name} dir="auto">
        <h2>{section.name}</h2>
        {section.entries.map(entry => <div key={entry.id || `new-${entries.indexOf(entry)}`} className={`atc-announcement ${selected === entry ? 'is-selected' : ''}`} onClick={() => onSelect?.(entry)} role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} onKeyDown={event => { if (onSelect && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelect(entry) } }}>
          {entry.title && <h3 dir="auto">{entry.title}</h3>}
          {entry.body && <p dir="auto">{entry.body}</p>}
          {(entry.event_date || entry.price || entry.contact) && <small dir="auto">{[entry.event_date, entry.price, entry.contact].filter(Boolean).join(' · ')}</small>}
        </div>)}
      </section>)}
    </div>
  </article>
}

export default function AroundTheCommons() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [issue, setIssue] = useState(null)
  const [week, setWeek] = useState('')
  const [entries, setEntries] = useState([])
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [publishedView, setPublishedView] = useState(false)
  const [shabbosDraft, setShabbosDraft] = useState({ verification_status: 'NEEDS_REVIEW' })
  const [shabbosDirty, setShabbosDirty] = useState(false)
  useEffect(() => { api('session').then(data => setUser(data.user)).catch(() => {}).finally(() => setAuthLoading(false)) }, [])
  const load = useCallback(async chosen => {
    setBusy(true); setMessage('')
    try { const data = await api(`issue${chosen ? `?week=${encodeURIComponent(chosen)}` : ''}`); setIssue(data); setWeek(data.week); setEntries(data.entries); setSelected(null); setDirty(false); setShabbosDraft(data.shabbos || { verification_status: 'NEEDS_REVIEW' }); setShabbosDirty(false); setPublishedView(data.issue.status === 'APPROVED'); return true }
    catch (error) { setMessage(error.message); return false }
    finally { setBusy(false) }
  }, [])
  useEffect(() => { if (user) { const params = new URLSearchParams(location.search); load(params.get('week') || undefined).then(loaded => { if (loaded && params.has('imported')) setMessage(`${params.get('imported')} announcements imported to ${params.get('week')}. ${Number(params.get('alreadyImported')) ? `${params.get('alreadyImported')} were already imported. ` : ''}${Number(params.get('failed')) ? `${params.get('failed')} failed.` : 'Review and approve the newsletter when ready.'}`) }) } }, [user, load, location.search])
  const categories = useMemo(() => issue?.categories?.map(item => item.category) || defaults, [issue])
  const current = selected && entries.find(item => item === selected)
  function update(field, value) { const next = { ...selected, [field]: value }; setEntries(old => old.map(item => item === selected ? next : item)); setSelected(next); setDirty(true) }
  function add() { const entry = emptyEntry(categories[0], entries.length + 1); setEntries(old => [...old, entry]); setSelected(entry); setDirty(true) }
  function move(direction) {
    if (!selected) return
    const same = [...entries].filter(item => item.category === selected.category).sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    const index = same.findIndex(item => item === selected)
    const other = same[index + direction]
    if (!other) return
    const a = selected.sort_order, b = other.sort_order
    const next = { ...selected, sort_order: b }
    setEntries(old => old.map(item => item === selected ? next : item === other ? { ...item, sort_order: a } : item))
    setSelected(next); setDirty(true)
  }
  async function save() {
    setBusy(true); setMessage('')
    try { const data = await api('draft', { method: 'POST', body: JSON.stringify({ week, changes: entries }) }); setIssue(old => ({ ...old, ...data })); setEntries(data.entries); setSelected(null); setDirty(false); setMessage('Draft saved to Neon.') }
    catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }
  async function approve() {
    if (dirty) { setMessage('Save the draft before approval.'); return }
    if (shabbosDirty) { setMessage('Save Shabbos details before approval.'); return }
    if (!window.confirm(`Approve the ${week} newsletter? This freezes the published edition.`)) return
    setBusy(true); setMessage('')
    try { const data = await api('approve', { method: 'POST', body: JSON.stringify({ week, confirm: true }) }); setIssue(old => ({ ...old, ...data })); setEntries(data.entries); setPublishedView(true); setMessage('Newsletter approved and frozen for printing.') }
    catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }
  async function saveShabbosDetails() {
    const replaceVerified = issue?.shabbos?.verification_status === 'VERIFIED'
    if (replaceVerified && !window.confirm(`Replace verified zmanim for ${week}? This changes the working issue but not an approved snapshot.`)) return
    setBusy(true); setMessage('')
    try { const data = await api('shabbos', { method: 'POST', body: JSON.stringify({ week, shabbos: { ...shabbosDraft, replace_verified: replaceVerified } }) }); setIssue(old => ({ ...old, shabbos: data.shabbos })); setShabbosDraft(data.shabbos); setShabbosDirty(false); setMessage('Shabbos details saved.') }
    catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }
  if (authLoading) return <div className="atc-shell"><p>Checking sign-in…</p></div>
  if (!user) return <Navigate to="/around-the-commons/login" replace />
  const display = publishedView && issue?.published?.length ? issue.published : entries
  const displayIssue = publishedView && issue?.publishedMeta ? { ...issue, shabbos: issue.publishedMeta.shabbos, categories: issue.publishedMeta.categories } : issue
  return <div className="atc-shell">
    <div className="atc-toolbar"><div><p>AROUND THE COMMONS · EDITOR</p><h1>{week || 'Newsletter'}</h1><span>{issue?.issue?.status || 'DRAFT'} · {user.username}</span></div>
      <div className="atc-actions"><label>Issue <select value={week} disabled={busy} onChange={event => { if ((dirty || shabbosDirty) && !window.confirm('Discard unsaved changes?')) return; load(event.target.value) }}>{[...new Set([week, ...(issue?.weeks || [])])].filter(Boolean).map(value => <option key={value}>{value}</option>)}</select></label>
      <Link className="atc-button" to="/around-the-commons/import">Import Spreadsheet</Link><Link className="atc-button" to="/around-the-commons/zmanim">Zmanim</Link><button onClick={add} disabled={busy || publishedView}>Add announcement</button><button onClick={save} disabled={busy || !dirty || publishedView}>Save Draft</button><button onClick={approve} disabled={busy || dirty || !user.approver || issue?.issue?.status === 'APPROVED'}>Approve Newsletter</button><button onClick={() => window.print()} disabled={!issue}>Print / Save PDF</button>
      {issue?.published?.length > 0 && <button onClick={() => setPublishedView(value => !value)}>{publishedView ? 'View working sheet' : 'View approved edition'}</button>}
      <button onClick={async () => { try { const response = await fetch('/api/around-the-commons/auth/logout', { method: 'POST', credentials: 'same-origin' }); if (!response.ok) throw new Error('Sign-out is temporarily unavailable.'); navigate('/around-the-commons/login', { replace: true }) } catch (error) { setMessage(error.message) } }}>Sign out</button></div></div>
    {message && <p className="atc-message" role="status">{message}</p>}
    <div className="atc-workspace"><div className="atc-preview">{displayIssue && <Newsletter issue={displayIssue} entries={display} selected={selected} onSelect={publishedView ? null : setSelected} />}</div>
      {!publishedView && <aside className="atc-editor"><details className="atc-shabbos-editor"><summary>Shabbos details {shabbosDirty ? '· Unsaved' : ''}</summary>{shabbosFields.map(([field, label]) => <label key={field}>{label}<input value={shabbosDraft[field] || ''} dir="auto" onChange={event => { setShabbosDraft(old => ({ ...old, [field]: event.target.value })); setShabbosDirty(true) }} disabled={issue?.issue?.status === 'APPROVED'} /></label>)}<label>Verification<select value={shabbosDraft.verification_status || 'NEEDS_REVIEW'} onChange={event => { setShabbosDraft(old => ({ ...old, verification_status: event.target.value })); setShabbosDirty(true) }}><option>NEEDS_REVIEW</option><option>VERIFIED</option></select></label><button className="atc-save-shabbos" onClick={saveShabbosDetails} disabled={!shabbosDirty || busy || issue?.issue?.status === 'APPROVED'}>Save Shabbos details</button></details><h2>Announcement editor</h2><div className="atc-entry-list" aria-label="All announcements">{entries.map((entry, index) => <button key={entry.id || `new-${index}`} className={entry === selected ? 'active' : ''} onClick={() => setSelected(entry)}>{entry.review_status === 'EXCLUDE' ? 'Excluded · ' : ''}{entry.title || entry.body?.slice(0, 48) || 'New announcement'}</button>)}</div>{current ? <>
        <label>Category<select value={current.category} onChange={event => update('category', event.target.value)}>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
        <label>Title<input value={current.title || ''} onChange={event => update('title', event.target.value)} dir="auto" /></label>
        <label>Wording<textarea value={current.body || ''} onChange={event => update('body', event.target.value)} dir="auto" rows="8" /></label>
        <label>Contact<input value={current.contact || ''} onChange={event => update('contact', event.target.value)} dir="auto" /></label>
        <label>Event date<input value={current.event_date || ''} onChange={event => update('event_date', event.target.value)} placeholder="YYYY-MM-DD" /></label>
        <label>Price<input value={current.price || ''} onChange={event => update('price', event.target.value)} /></label>
        <label>Review status<select value={current.review_status} onChange={event => update('review_status', event.target.value)}><option>NEEDS_REVIEW</option><option>READY</option><option>EXCLUDE</option></select></label>
        <label>Editorial notes<textarea value={current.notes || ''} onChange={event => update('notes', event.target.value)} rows="3" /></label>
        <div className="atc-order"><button onClick={() => move(-1)}>Move up</button><button onClick={() => move(1)}>Move down</button></div>
        {warning(current, week).map(value => <p className="atc-warning" key={value}>{value}</p>)}
        {current.original_text && <details><summary>Original submission</summary><p dir="auto">{current.original_text}</p></details>}
      </> : <p>Select an announcement in the page to edit it.</p>}</aside>}</div>
  </div>
}
