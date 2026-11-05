import { requireOrigin, requireSession } from '../../_lib/newsletter-auth.js'
import { confirmChart } from '../../_lib/newsletter-zmanim.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireSession(req, res)
  if (!user || !requireOrigin(req, res)) return
  if (req.body?.confirm !== true || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(req.body?.importId || '')) return res.status(400).json({ error: 'Review and confirm this chart first.' })
  try {
    const imported = await confirmChart(req.body.importId, req.body.records, user.username)
    return res.status(200).json({ id: imported.id, status: imported.status })
  } catch (error) {
    console.error('Zmanim confirmation failed', error.message)
    return res.status(409).json({ error: error.message })
  }
}
