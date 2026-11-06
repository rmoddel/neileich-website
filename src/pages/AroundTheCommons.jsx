import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import AtcNewsletter from './AtcNewsletter.jsx'
import { displayCategory } from './atcLayout.js'
import './AroundTheCommons.css'

const defaults = ['Neileich Updates', 'Mazel Tov', 'Community Updates', 'Events & Shiurim', 'Classifieds', 'Looking For', 'Selling / For Rent', 'Lost & Found', 'Other community notices']
const shabbosFields = [['parsha_he', 'Parsha (Hebrew)'], ['parsha_en', 'Parsha (English)'], ['candle_lighting', 'Candle lighting'], ['friday_mincha', 'Friday Mincha'], ['friday_maariv', 'Friday Maariv'], ['shacharis', 'Shacharis'], ['sof_zman_shema_gra', 'Sof zman Shema (GRA)'], ['sof_zman_shema_mga', 'Sof zman Shema (MGA)'], ['shabbos_mincha', 'Shabbos Mincha'], ['motzai_maariv', 'Motzai Shabbos Maariv'], ['friday_sunset', 'Friday sunset'], ['shabbos_ends', 'Shabbos ends'], ['source', 'Official source'], ['notes', 'Notes']]
const emptyEntry = (category, order) => ({ id: '', category, title: '', body: '', contact: '', event_date: '', price: '', flags: '', notes: '', review_status: 'NEEDS_REVIEW', sort_order: String(order), is_important: false, is_test: false })
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
  const deleteInFlight = useRef(false)
  useEffect(() => { api('session').then(data => setUser(data.user)).catch(() => {}).finally(() => setAuthLoading(false)) }, [])
  const load = useCallback(async chosen => {
    setBusy(true); setMessage('')
    try { const data = await api(`issue${chosen ? `?week=${encodeURIComponent(chosen)}` : ''}`); setIssue(data); setWeek(data.week); setEntries(data.entries); setSelected(null); setDirty(false); setShabbosDraft(data.shabbos || { verification_status: 'NEEDS_REVIEW' }); setShabbosDirty(false); setPublishedView(data.issue.status === 'APPROVED'); if (data.scheduleWarning) setMessage(data.scheduleWarning); return true }
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
    const same = [...entries].filter(item => displayCategory(item.category) === displayCategory(selected.category) && Boolean(item.is_important) === Boolean(selected.is_important)).sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
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
  async function loadOfficialSchedule() {
    if (shabbosDirty && !window.confirm('Discard unsaved Shabbos changes and load the official schedule?')) return
    setBusy(true); setMessage('')
    try {
      const data = await api(`shabbos?week=${encodeURIComponent(week)}`)
      setShabbosDraft(data.shabbos)
      setShabbosDirty(true)
      setMessage('Official shul schedule loaded. Review and verify it before saving.')
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }
  async function deleteEntry(entry) {
    if (deleteInFlight.current || busy || publishedView || issue?.issue?.status === 'APPROVED' || !window.confirm('Delete this announcement?')) return
    deleteInFlight.current = true; setBusy(true); setMessage('')
    try {
      if (entry.id) await api('announcement', { method: 'DELETE', body: JSON.stringify({ mode: 'single', week, id: entry.id }) })
      setEntries(old => old.filter(item => item !== entry))
      if (selected === entry) setSelected(null)
      setMessage('Announcement deleted.')
    } catch (error) { setMessage(error.message) }
    finally { deleteInFlight.current = false; setBusy(false) }
  }
  async function deleteAllTestEntries() {
    const count = entries.filter(entry => entry.id && entry.is_test).length
    if (!count || dirty || deleteInFlight.current || busy || publishedView || issue?.issue?.status === 'APPROVED') return
    if (!window.confirm(`Delete all ${count} explicitly marked test announcements for ${week}?`)) return
    deleteInFlight.current = true; setBusy(true); setMessage('')
    try {
      const result = await api('announcement', { method: 'DELETE', body: JSON.stringify({ mode: 'tests', week, expectedCount: count }) })
      setEntries(old => old.filter(entry => !entry.is_test))
      if (selected?.is_test) setSelected(null)
      setMessage(`${result.deleted} test announcements deleted.`)
    } catch (error) { setMessage(error.message) }
    finally { deleteInFlight.current = false; setBusy(false) }
  }
  if (authLoading) return <div className="atc-shell"><p>Checking sign-in…</p></div>
  if (!user) return <Navigate to="/around-the-commons/login" replace />
  const display = publishedView && issue?.published?.length ? issue.published : entries
  const displayIssue = publishedView && issue?.publishedMeta ? { ...issue, shabbos: issue.publishedMeta.shabbos, categories: issue.publishedMeta.categories } : issue
  const locked = issue?.issue?.status === 'APPROVED'
  return <div className="atc-shell">
    <div className="atc-toolbar"><div><p>AROUND THE COMMONS · EDITOR</p><h1>{week || 'Newsletter'}</h1><span>{issue?.issue?.status || 'DRAFT'} · {user.username}</span></div>
      <div className="atc-actions"><label>Issue <select value={week} disabled={busy} onChange={event => { if ((dirty || shabbosDirty) && !window.confirm('Discard unsaved changes?')) return; load(event.target.value) }}>{[...new Set([week, ...(issue?.weeks || [])])].filter(Boolean).map(value => <option key={value}>{value}</option>)}</select></label>
      <Link className="atc-button" to="/around-the-commons/import">Import Spreadsheet</Link><Link className="atc-button" to="/around-the-commons/zmanim">Zmanim</Link><button onClick={add} disabled={busy || publishedView || locked}>Add announcement</button><button onClick={save} disabled={busy || !dirty || publishedView || locked}>Save Draft</button><button onClick={approve} disabled={busy || dirty || !user.approver || locked}>Approve Newsletter</button><button onClick={() => window.print()} disabled={!issue}>Print / Save PDF</button>
      {entries.some(entry => entry.id && entry.is_test) && !publishedView && !locked && <button onClick={deleteAllTestEntries} disabled={busy || dirty}>Delete All Test Announcements ({entries.filter(entry => entry.id && entry.is_test).length})</button>}
      {issue?.published?.length > 0 && <button onClick={() => setPublishedView(value => !value)}>{publishedView ? 'View working sheet' : 'View approved edition'}</button>}
      <button onClick={async () => { try { const response = await fetch('/api/around-the-commons/auth/logout', { method: 'POST', credentials: 'same-origin' }); if (!response.ok) throw new Error('Sign-out is temporarily unavailable.'); navigate('/around-the-commons/login', { replace: true }) } catch (error) { setMessage(error.message) } }}>Sign out</button></div></div>
    {message && <p className="atc-message" role="status">{message}</p>}
    <div className="atc-workspace"><div className="atc-preview">{displayIssue && <AtcNewsletter issue={displayIssue} entries={display} selected={selected} onSelect={publishedView ? null : setSelected} />}</div>
      {!publishedView && !locked && <aside className="atc-editor"><details className="atc-shabbos-editor"><summary>Shabbos details {shabbosDirty ? '· Unsaved' : ''}</summary><button className="atc-save-shabbos" onClick={loadOfficialSchedule} disabled={busy}>Load official shul schedule</button>{shabbosFields.map(([field, label]) => <label key={field}>{label}<input value={shabbosDraft[field] || ''} dir="auto" onChange={event => { setShabbosDraft(old => ({ ...old, [field]: event.target.value })); setShabbosDirty(true) }} disabled={locked} /></label>)}<label>Verification<select value={shabbosDraft.verification_status || 'NEEDS_REVIEW'} onChange={event => { setShabbosDraft(old => ({ ...old, verification_status: event.target.value })); setShabbosDirty(true) }}><option>NEEDS_REVIEW</option><option>VERIFIED</option></select></label><button className="atc-save-shabbos" onClick={saveShabbosDetails} disabled={!shabbosDirty || busy || locked}>Save Shabbos details</button></details><h2>Announcement editor</h2><div className="atc-entry-list" aria-label="All announcements">{entries.map((entry, index) => <div className="atc-entry-row" key={entry.id || `new-${index}`}><button className={entry === selected ? 'active' : ''} onClick={() => setSelected(entry)}>{entry.review_status === 'EXCLUDE' ? 'Excluded · ' : ''}{entry.title || entry.body?.slice(0, 48) || 'New announcement'}</button><button className="atc-trash" aria-label={`Delete ${entry.title || 'announcement'}`} title="Delete announcement" onClick={() => deleteEntry(entry)} disabled={busy}><Trash2 size={15} aria-hidden="true" /></button></div>)}</div>{current ? <>
        <label>Category<select value={current.category} onChange={event => update('category', event.target.value)}>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
        <label>Title<input value={current.title || ''} onChange={event => update('title', event.target.value)} dir="auto" /></label>
        <label>Wording<textarea value={current.body || ''} onChange={event => update('body', event.target.value)} dir="auto" rows="8" /></label>
        <label>Contact<input value={current.contact || ''} onChange={event => update('contact', event.target.value)} dir="auto" /></label>
        <label>Event date<input value={current.event_date || ''} onChange={event => update('event_date', event.target.value)} placeholder="YYYY-MM-DD" /></label>
        <label>Price<input value={current.price || ''} onChange={event => update('price', event.target.value)} /></label>
        <label>Review status<select value={current.review_status} onChange={event => update('review_status', event.target.value)}><option>NEEDS_REVIEW</option><option>READY</option><option>EXCLUDE</option></select></label>
        <label className="atc-check"><input type="checkbox" checked={Boolean(current.is_important)} onChange={event => update('is_important', event.target.checked)} /> Important community update</label>
        <label className="atc-check"><input type="checkbox" checked={Boolean(current.is_test)} onChange={event => update('is_test', event.target.checked)} /> Explicitly mark as test data</label>
        <label>Editorial notes<textarea value={current.notes || ''} onChange={event => update('notes', event.target.value)} rows="3" /></label>
        <div className="atc-order"><button onClick={() => move(-1)}>Move up</button><button onClick={() => move(1)}>Move down</button></div>
        {warning(current, week).map(value => <p className="atc-warning" key={value}>{value}</p>)}
        {current.original_text && <details><summary>Original submission</summary><p dir="auto">{current.original_text}</p></details>}
      </> : <p>Select an announcement in the page to edit it.</p>}</aside>}</div>
  </div>
}
