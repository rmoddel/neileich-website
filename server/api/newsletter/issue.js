import { requireSession } from '../_lib/newsletter-auth.js'
import { getCurrentIssueWeek, validIssueWeek } from '../_lib/newsletter-config.js'
import { getIssue, listWeeks } from '../_lib/newsletter-db.js'
import { fetchScheduleWeek } from '../_lib/newsletter-schedule.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'GET') return res.status(405).end()
  if (!await requireSession(req, res)) return
  const week = req.query.week || getCurrentIssueWeek()
  if (!validIssueWeek(week)) return res.status(400).json({ error: 'Choose a Friday issue date.' })
  try {
    const [issue, weeks] = await Promise.all([getIssue(week), listWeeks()])
    if (!issue.shabbos && issue.issue.status !== 'APPROVED') {
      try {
        issue.shabbos = await fetchScheduleWeek(week)
        if (!issue.shabbos) issue.scheduleWarning = 'The official shul schedule does not cover this Friday yet.'
      } catch (error) {
        console.error('Official Shabbos schedule read failed', error.message)
        issue.scheduleWarning = 'The official shul schedule is temporarily unavailable.'
      }
    }
    return res.status(200).json({ ...issue, weeks })
  }
  catch (error) { console.error('Newsletter read failed', error); return res.status(503).json({ error: 'Newsletter data is temporarily unavailable.' }) }
}
