import { requireOrigin, requireSession } from '../_lib/newsletter-auth.js'
import { saveShabbos } from '../_lib/newsletter-db.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireSession(req, res)
  if (!user || !requireOrigin(req, res)) return
  try { return res.status(200).json(await saveShabbos(req.body?.week, { ...req.body?.shabbos, verified_by: user.username })) }
  catch (error) { console.error('Newsletter Shabbos save failed', error.message); return res.status(409).json({ error: error.message }) }
}
