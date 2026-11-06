import { requireOrigin, requireSession } from '../_lib/newsletter-auth.js'
import { saveShabbos } from '../_lib/newsletter-db.js'
import { fetchScheduleWeek } from '../_lib/newsletter-schedule.js'
import { getCurrentIssueWeek, validIssueWeek } from '../_lib/newsletter-config.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).end()
  const user = await requireSession(req, res)
  if (!user) return
  if (req.method === 'GET') {
    const week = req.query?.week || getCurrentIssueWeek()
    if (!validIssueWeek(week)) return res.status(400).json({ error: 'Choose a Friday issue date.' })
    try {
      const shabbos = await fetchScheduleWeek(week)
      return shabbos ? res.status(200).json({ shabbos }) : res.status(404).json({ error: 'The official schedule does not cover this Friday yet.' })
    } catch (error) {
      console.error('Official Shabbos schedule read failed', error.message)
      return res.status(503).json({ error: 'The official schedule is temporarily unavailable.' })
    }
  }
  if (!requireOrigin(req, res)) return
  try { return res.status(200).json(await saveShabbos(req.body?.week, { ...req.body?.shabbos, verified_by: user.username })) }
  catch (error) { console.error('Newsletter Shabbos save failed', error.message); return res.status(409).json({ error: error.message }) }
}
