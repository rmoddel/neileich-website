import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import './AroundTheCommons.css'

const MAX_CHART_BYTES = 2_800_000

const columns = [
  ['issue_week', 'Friday date'], ['shabbos_date', 'Shabbos date'], ['parsha_he', 'פרשה'], ['parsha_en', 'Parsha (English)'],
  ['candle_lighting', 'Candle lighting'], ['friday_sunset', 'Sunset'], ['erev_shabbos_mincha', 'Erev Shabbos Mincha'], ['friday_mincha', 'Friday Mincha'], ['friday_maariv', 'Friday Maariv'],
  ['shacharis', 'Shacharis'], ['sof_zman_shema_mga', 'Shema M״A'], ['sof_zman_shema_gra', 'Shema GR״A'], ['shabbos_mincha', 'Shabbos Mincha'], ['motzai_maariv', 'Motzai Shabbos Maariv'], ['shabbos_ends', 'Havdalah, only if printed'], ['notes', 'Notes / Hebrew labels'],
]

async function api(path, options) {
  const response = await fetch(`/api/newsletter/zmanim/${path}`, { credentials: 'same-origin', cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Request failed')
  return body
}

export default function AtcZmanim() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [imports, setImports] = useState([])
  const [selected, setSelected] = useState(null)
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    fetch('/api/newsletter/session', { credentials: 'same-origin', cache: 'no-store' }).then(response => response.json()).then(body => setUser(body.user || null)).catch(() => {}).finally(() => setAuthLoading(false))
  }, [])
  useEffect(() => { if (user) api('import').then(body => setImports(body.imports)).catch(error => setMessage(error.message)) }, [user])
  function showImport(imported) {
    setSelected(imported)
    setRows((imported.extracted_records || []).map(row => ({ ...row, reviewed: false, skip: false })))
  }
  async function openImport(id) {
    setBusy(true); setMessage('')
    try { const body = await api(`import?id=${encodeURIComponent(id)}`); showImport(body.import) }
    catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }
  function update(index, field, value) {
    const saturday = value && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? new Date(Date.parse(`${value}T00:00:00Z`) + 86400000).toISOString().slice(0, 10) : ''
    setRows(old => old.map((row, i) => i === index ? { ...row, [field]: value, ...(field === 'issue_week' ? { friday_date: value, shabbos_date: saturday } : {}) } : row))
  }
  async function upload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > MAX_CHART_BYTES) { setMessage('Choose a PDF smaller than 2.8 MB.'); return }
    setBusy(true); setMessage('Reading and interpreting the chart…')
    try {
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file) })
      const result = await api('upload', { method: 'POST', body: JSON.stringify({ filename: file.name, base64: String(dataUrl).split(',')[1] }) })
      showImport(result.import)
      const list = await api('import')
      setImports(list.imports)
      setMessage(result.duplicate ? 'This chart was uploaded before. Its previous extraction is shown.' : 'Extraction complete. Review each week before confirming.')
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false); event.target.value = '' }
  }
  async function confirm() {
    const count = rows.filter(row => !row.skip).length
    if (!window.confirm(`Confirm ${count} reviewed week${count === 1 ? '' : 's'} from this official chart? Existing verified weeks will not be replaced.`)) return
    setBusy(true); setMessage('')
    try {
      await api('confirm', { method: 'POST', body: JSON.stringify({ importId: selected.id, records: rows, confirm: true }) })
      const result = await api(`import?id=${encodeURIComponent(selected.id)}`)
      showImport(result.import)
      const list = await api('import'); setImports(list.imports)
      setMessage('Reviewed zmanim saved and verified. They will appear in their Friday issues.')
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }
  if (authLoading) return <div className="atc-shell"><p>Checking sign-in…</p></div>
  if (!user) return <Navigate to="/around-the-commons/login" replace />
  return <div className="atc-shell atc-zmanim-page">
    <div className="atc-toolbar"><div><p>AROUND THE COMMONS · ADMIN</p><h1>Zmanim charts</h1><span>Official Bais Medrash of Lakewood Commons times</span></div><div className="atc-actions"><Link className="atc-button" to="/around-the-commons">Newsletter editor</Link></div></div>
    <p>Upload the seasonal chart, review every extracted week, and confirm the official times. The chart may omit the year: enter each actual Friday date before saving. Motzai Shabbos Maariv is separate from Havdalah.</p>
    <label className="atc-upload">Upload PDF chart <input type="file" accept="application/pdf,.pdf" onChange={upload} disabled={busy} /></label>
    {busy && <p role="status">Processing…</p>}{message && <p className="atc-message" role="status">{message}</p>}
    <div className="atc-import-list"><h2>Recent imports</h2>{imports.length ? imports.map(item => <button key={item.id} onClick={() => openImport(item.id)} disabled={busy}>{item.filename} · {item.status.replaceAll('_', ' ')} · {new Date(item.created_at).toLocaleString()}</button>) : <p>No charts uploaded yet.</p>}</div>
    {selected && <section className="atc-review"><div className="atc-review-head"><div><h2>{selected.filename}</h2><p>{selected.status.replaceAll('_', ' ')} · {rows.length} extracted weeks</p></div>{selected.sourceAvailable && <a className="atc-button" href={`/api/newsletter/zmanim/source?id=${encodeURIComponent(selected.id)}`} target="_blank" rel="noreferrer">View source PDF</a>}</div>
      {selected.error && <p className="atc-warning">{selected.error}</p>}
      <div className="atc-table-scroll"><table className="atc-zmanim-table"><thead><tr><th>Review</th>{columns.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.source_index} className={row.skip ? 'atc-skipped' : ''}><td><label><input type="checkbox" checked={row.reviewed} disabled={row.skip || selected.status !== 'READY_FOR_REVIEW'} onChange={event => update(index, 'reviewed', event.target.checked)} /> Reviewed</label><label><input type="checkbox" checked={row.skip} disabled={selected.status !== 'READY_FOR_REVIEW'} onChange={event => update(index, 'skip', event.target.checked)} /> Skip</label>{row.warnings?.map((warning, i) => <small className="atc-warning" key={i}>{warning}</small>)}</td>{columns.map(([field, label]) => <td key={field}><input aria-label={`${label}, week ${index + 1}`} type={field === 'issue_week' || field === 'shabbos_date' ? 'date' : 'text'} value={row[field] || ''} dir={field === 'parsha_he' ? 'rtl' : 'auto'} disabled={row.skip || selected.status !== 'READY_FOR_REVIEW'} onChange={event => update(index, field, event.target.value)} /></td>)}</tr>)}</tbody></table></div>
      {selected.status === 'READY_FOR_REVIEW' && <button className="atc-button atc-confirm" onClick={confirm} disabled={busy || !rows.some(row => !row.skip)}>Confirm reviewed zmanim</button>}
    </section>}
  </div>
}
