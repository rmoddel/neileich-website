import { requireOrigin, requireSession } from '../_lib/newsletter-auth.js'
import { saveDraft } from '../_lib/newsletter-db.js'
import { validIssueWeek } from '../_lib/newsletter-config.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).end()
  if (!await requireSession(req, res) || !requireOrigin(req, res)) return
  const week = req.body?.week
  if (!validIssueWeek(week)) return res.status(400).json({ error: 'Choose a Friday issue date.' })
  try {
    return res.status(200).json(await saveDraft(week, req.body?.changes))
  }
  catch (error) { console.error('Newsletter draft failed', error); return res.status(409).json({ error: error.message }) }
}
