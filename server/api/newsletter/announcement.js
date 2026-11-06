import { requireOrigin, requireSession } from '../_lib/newsletter-auth.js'
import { deleteAnnouncement, deleteTestAnnouncements } from '../_lib/newsletter-db.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'DELETE') return res.status(405).end()
  const user = await requireSession(req, res)
  if (!user || !requireOrigin(req, res)) return
  if (!['single', 'tests'].includes(req.body?.mode)) return res.status(400).json({ error: 'Choose a deletion mode.' })
  try {
    const count = req.body?.mode === 'tests'
      ? await deleteTestAnnouncements(req.body?.week, req.body?.expectedCount, user.username)
      : await deleteAnnouncement(req.body?.week, req.body?.id, user.username)
    if (!count) return res.status(404).json({ error: 'Announcement was already deleted or is unavailable.' })
    return res.status(200).json({ deleted: count })
  } catch (error) {
    console.error('Newsletter announcement deletion failed', error.message)
    return res.status(409).json({ error: error.message })
  }
}
