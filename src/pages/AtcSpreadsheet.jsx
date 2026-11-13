import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { readSheet } from 'read-excel-file/browser'
import Papa from 'papaparse'
import { detectMapping, findHeaderRow, importFields, mappedRows, mappingErrors, rowErrors } from './atcSpreadsheet.js'
import './AroundTheCommons.css'

async function api(path, options) {
  const response = await fetch(`/api/newsletter/${path}`, { credentials: 'same-origin', cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Request failed')
  return body
}

export default function AtcSpreadsheet() {
  const navigate = useNavigate()
  const input = useRef(null)
  const submitting = useRef(false)
  const [auth, setAuth] = useState('loading')
  const [categories, setCategories] = useState([])
  const [week, setWeek] = useState('')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState([])
  const [sourceRows, setSourceRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [rows, setRows] = useState(null)
  const [batchId, setBatchId] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    api('issue').then(data => { setAuth('ok'); setCategories(data.categories.map(item => item.category)); setWeek(data.week) })
      .catch(async error => {
        const response = await fetch('/api/newsletter/session', { credentials: 'same-origin' }).catch(() => null)
        setAuth(response?.ok ? 'error' : 'anonymous'); setMessage(error.message)
      })
  }, [])
  const errors = useMemo(() => rows?.flatMap((row, index) => rowErrors(row, categories).map(error => `Row ${index + 1}: ${error}`)) || [], [rows, categories])
  const mapErrors = mappingErrors(mapping)
  async function selectFile(file) {
    if (!file) return
    setMessage(''); setRows(null); setBatchId(''); setHeaders([]); setSourceRows([]); setMapping({}); setFileName('')
    if (!/\.(xlsx|csv)$/i.test(file.name)) { setMessage('Choose an .xlsx or .csv spreadsheet.'); return }
    try {
      let table
      if (/\.csv$/i.test(file.name)) {
        const parsed = Papa.parse(await file.text(), { skipEmptyLines: 'greedy' })
        if (parsed.errors.length) throw new Error(`CSV row ${parsed.errors[0].row + 1}: ${parsed.errors[0].message}`)
        table = parsed.data
      } else table = await readSheet(file)
      if (!table?.length) throw new Error('The spreadsheet has no rows.')
      table = table.map(row => row.map(value => value instanceof Date ? value.toISOString().slice(0, 10) : value ?? ''))
      const headerIndex = findHeaderRow(table)
      if (headerIndex < 0) throw new Error('The spreadsheet is empty.')
      const foundHeaders = table[headerIndex].map(String)
      setFileName(file.name); setHeaders(foundHeaders); setSourceRows(table.slice(headerIndex + 1)); setMapping(detectMapping(foundHeaders))
    } catch (error) { setMessage(`Could not read spreadsheet: ${error.message}`) }
    if (input.current) input.current.value = ''
  }
  function updateMapping(field, value) {
    setMapping(old => {
      const next = { ...old }; if (value === '') delete next[field]; else next[field] = Number(value)
      return next
    })
  }
  function reviewRows() {
    if (mapErrors.length) { setMessage(mapErrors.join(' ')); return }
    const next = mappedRows(sourceRows, mapping, categories, week)
    if (!next.length) { setMessage('No announcement rows were found.'); return }
    setRows(next); setBatchId(crypto.randomUUID()); setMessage('Review and correct every row before submitting. Nothing has been saved to Neon.')
  }
  function updateRow(key, field, value) { setRows(old => old.map(row => row.key === key ? { ...row, [field]: value } : row)) }
  async function submit() {
    if (submitting.current || busy || !rows?.length) return
    if (errors.length) { setMessage(`Fix ${errors.length} validation error${errors.length === 1 ? '' : 's'} before submitting.`); return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || new Date(`${week}T00:00:00Z`).getUTCDay() !== 5) { setMessage('Choose a Friday issue week.'); return }
    if (!window.confirm(`Submit ${rows.length} announcements to the ${week} newsletter? Existing announcements will remain.`)) return
    submitting.current = true; setBusy(true); setMessage('Submitting announcements…')
    try {
      const result = await api('bulk-import', { method: 'POST', body: JSON.stringify({ week, batchId, entries: rows.map(({ category, title, body, contact, price, event_date, notes, review_status, original_text }) => ({ category, title, body, contact, price, event_date, notes, review_status, original_text })) }) })
      navigate(`/around-the-commons?week=${encodeURIComponent(week)}&imported=${result.imported}&alreadyImported=${result.alreadyImported}&failed=${result.failed}`)
    } catch (error) { setMessage(`Import failed: ${error.message}. You can retry this same batch safely.`) }
    finally { submitting.current = false; setBusy(false) }
  }
  if (auth === 'loading') return <div className="atc-shell"><p>Loading spreadsheet importer…</p></div>
  if (auth === 'anonymous') return <Navigate to="/around-the-commons/login" replace />
  return <div className="atc-shell atc-import-page">
    <div className="atc-toolbar"><div><p>AROUND THE COMMONS · ADMIN</p><h1>Import Spreadsheet</h1><span>Review announcements before saving them to Neon</span></div><div className="atc-actions"><Link className="atc-button" to="/around-the-commons">Newsletter editor</Link></div></div>
    {message && <p className="atc-message" role="status">{message}</p>}
    {auth === 'error' ? null : <>
      <div className="atc-import-controls"><label>Issue week <input type="date" value={week} onChange={event => setWeek(event.target.value)} disabled={busy} /></label><label className="atc-upload">Choose .xlsx or .csv <input ref={input} type="file" accept=".xlsx,.csv" onChange={event => selectFile(event.target.files?.[0])} disabled={busy} /></label></div>
      {headers.length > 0 && rows === null && <section className="atc-review"><h2>Map columns · {fileName}</h2><p>{sourceRows.filter(row => row.some(cell => String(cell ?? '').trim())).length} spreadsheet rows found. Map required fields, then continue.</p>
        <div className="atc-mapping">{importFields.map(([field, label]) => <label key={field}>{label}{field === 'body' || field === 'category' ? ' *' : ''}<select value={mapping[field] ?? ''} onChange={event => updateMapping(field, event.target.value)}><option value="">Unmapped</option>{headers.map((header, index) => <option key={index} value={index}>{header || `Column ${index + 1}`}</option>)}</select></label>)}</div>
        {mapErrors.map(error => <p className="atc-warning" key={error}>{error}</p>)}<button className="atc-primary" onClick={reviewRows} disabled={mapErrors.length > 0}>Review announcements</button>
      </section>}
      {rows !== null && <section className="atc-review"><div className="atc-review-head"><div><h2>Bulk entry · {rows.length} announcements</h2><p>{fileName} · Issue {week} · Changes here stay in this browser until Submit.</p></div><button onClick={() => setRows(old => [...old, { key: crypto.randomUUID(), sourceRow: null, originalCategory: '', category: '', title: '', body: '', original_text: '', contact: '', price: '', event_date: '', notes: '', review_status: 'NEEDS_REVIEW' }])} disabled={busy}>Add row</button></div>
        {errors.length > 0 && <div className="atc-import-errors" role="alert"><strong>{errors.length} validation errors</strong>{errors.map((error, index) => <p key={index}>{error}</p>)}</div>}
        <div className="atc-table-scroll"><table className="atc-bulk-table"><thead><tr><th>#</th><th>Category *</th><th>Title</th><th>Body / announcement text *</th><th>Contact</th><th>Price</th><th>Event date</th><th>Notes</th><th>Review status</th><th>Remove</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.key}><td>{index + 1}</td><td><select aria-label={`Row ${index + 1} category`} value={row.category} onChange={event => updateRow(row.key, 'category', event.target.value)}><option value="">Choose category</option>{categories.map(category => <option key={category}>{category}</option>)}</select>{!row.category && row.originalCategory && <small>Unknown: {row.originalCategory}</small>}</td><td><input aria-label={`Row ${index + 1} title`} dir="auto" value={row.title} onChange={event => updateRow(row.key, 'title', event.target.value)} /></td><td><textarea aria-label={`Row ${index + 1} body`} dir="auto" rows="3" value={row.body} onChange={event => updateRow(row.key, 'body', event.target.value)} /></td><td><input aria-label={`Row ${index + 1} contact`} dir="auto" value={row.contact} onChange={event => updateRow(row.key, 'contact', event.target.value)} /></td><td><input aria-label={`Row ${index + 1} price`} value={row.price} onChange={event => updateRow(row.key, 'price', event.target.value)} /></td><td><input aria-label={`Row ${index + 1} event date`} type="text" placeholder="YYYY-MM-DD" value={row.event_date} onChange={event => updateRow(row.key, 'event_date', event.target.value)} /></td><td><textarea aria-label={`Row ${index + 1} notes`} rows="2" value={row.notes} onChange={event => updateRow(row.key, 'notes', event.target.value)} /></td><td><select aria-label={`Row ${index + 1} review status`} value={row.review_status} onChange={event => updateRow(row.key, 'review_status', event.target.value)}><option value="NEEDS_REVIEW">Needs review</option><option value="READY">Ready</option></select></td><td><button aria-label={`Remove row ${index + 1}`} onClick={() => setRows(old => old.filter(item => item.key !== row.key))} disabled={busy}>Remove</button></td></tr>)}</tbody></table></div>
        <button className="atc-primary atc-submit" onClick={submit} disabled={busy || !rows.length || errors.length > 0}>Submit {rows.length} Announcements to Newsletter</button>
      </section>}
    </>}
  </div>
}
