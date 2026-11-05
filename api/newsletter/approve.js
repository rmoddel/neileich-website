import { requireOrigin, requireSession } from '../_lib/newsletter-auth.js'
import { validIssueWeek } from '../_lib/newsletter-config.js'
import { approveIssue } from '../_lib/newsletter-db.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireSession(req, res)
  if (!user || !requireOrigin(req, res)) return
  if (!user.approver) return res.status(403).json({ error: 'Approval permission is required.' })
  const week = req.body?.week
  if (!validIssueWeek(week) || req.body?.confirm !== true) return res.status(400).json({ error: 'Confirm a valid issue week.' })
  try {
    return res.status(200).json(await approveIssue(week, user.username))
  } catch (error) {
    console.error('Newsletter approval failed', error)
    return res.status(409).json({ error: error.message, details: error.details || [] })
  }
}
