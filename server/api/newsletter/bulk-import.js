import { requireOrigin, requireSession } from '../_lib/newsletter-auth.js'
import { importSpreadsheet } from '../_lib/newsletter-db.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).end()
  if (!await requireSession(req, res) || !requireOrigin(req, res)) return
  try { return res.status(200).json(await importSpreadsheet(req.body?.week, req.body?.batchId, req.body?.entries)) }
  catch (error) { console.error('Newsletter bulk import failed', error); return res.status(409).json({ error: error.message }) }
}
