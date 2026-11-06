import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import './AroundTheCommons.css'
import './AtcNewsletter.css'

const fields = [
  ['parsha_he', 'פרשה'], ['parsha_en', 'Parsha'], ['candle_lighting', 'Candle lighting'], ['friday_sunset', 'Friday sunset'],
  ['erev_shabbos_mincha', 'Erev Shabbos Mincha'], ['friday_mincha', 'Friday Mincha/Maariv'], ['friday_maariv', 'Friday Maariv'],
  ['shacharis', 'Shabbos Shacharis'], ['sof_zman_shema_mga', 'Shema M״A'], ['sof_zman_shema_gra', 'Shema GR״A'],
  ['shabbos_mincha', 'Shabbos Mincha'], ['motzai_maariv', 'Motzai Shabbos Maariv'],
]

async function get(path) {
  const response = await fetch(`/api/newsletter/${path}`, { credentials: 'same-origin', cache: 'no-store' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Request failed')
  return body
}

export default function AtcZmanim() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [week, setWeek] = useState('')
  const [schedule, setSchedule] = useState(null)
  const [message, setMessage] = useState('')
  useEffect(() => { get('session').then(body => setUser(body.user)).catch(() => {}).finally(() => setAuthLoading(false)) }, [])
  useEffect(() => { if (user) get('issue').then(body => setWeek(body.week)).catch(error => setMessage(error.message)) }, [user])
  useEffect(() => {
    if (!week || !user) return
    let active = true
    get(`shabbos?week=${encodeURIComponent(week)}`).then(body => { if (active) setSchedule(body.shabbos) }).catch(error => { if (active) setMessage(error.message) })
    return () => { active = false }
  }, [week, user])
  if (authLoading) return <div className="atc-shell"><p>Checking sign-in…</p></div>
  if (!user) return <Navigate to="/around-the-commons/login" replace />
  return <div className="atc-shell atc-zmanim-page">
    <div className="atc-toolbar"><div><p>AROUND THE COMMONS · ADMIN</p><h1>Official shul schedule</h1><span>Bais Medrash of Lakewood Commons</span></div><div className="atc-actions"><Link className="atc-button" to={`/around-the-commons${week ? `?week=${week}` : ''}`}>Newsletter editor</Link></div></div>
    <p>Times come directly from the <a href="https://baismedrashoflakewoodcommons.org/api/schedule.json" target="_blank" rel="noreferrer">official schedule feed</a>. Select a Friday to review. The editor lets you correct and verify times before publication; existing verified weeks and approved editions are not replaced automatically.</p>
    <label className="atc-schedule-week">Friday issue date <input type="date" value={week} onChange={event => { setWeek(event.target.value); setSchedule(null); setMessage('') }} /></label>
    {week && !schedule && !message && <p role="status">Loading official schedule…</p>}
    {message && <p className="atc-message" role="status">{message}</p>}
    {schedule && <><table className="atc-schedule-table"><tbody>{fields.map(([field, label]) => <tr key={field}><th>{label}</th><td dir="auto">{schedule[field] || '—'}</td></tr>)}</tbody></table><p>Motzai Shabbos Maariv is separate from Havdalah. The feed does not provide a Havdalah time.</p><Link className="atc-button" to={`/around-the-commons?week=${week}`}>Review and verify in editor</Link></>}
  </div>
}
