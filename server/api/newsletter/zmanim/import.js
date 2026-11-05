import { requireSession } from '../../_lib/newsletter-auth.js'
import { getImport, listImports } from '../../_lib/newsletter-zmanim.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'GET') return res.status(405).end()
  if (!await requireSession(req, res)) return
  try {
    if (!req.query?.id) return res.status(200).json({ imports: await listImports() })
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(req.query.id)) return res.status(400).json({ error: 'Invalid import ID' })
    const imported = await getImport(req.query.id)
    if (!imported) return res.status(404).json({ error: 'Import not found' })
    const { blob_path: _path, ...safeImport } = imported
    return res.status(200).json({ import: { ...safeImport, sourceAvailable: Boolean(_path) } })
  } catch (error) {
    console.error('Zmanim import lookup failed', error.message)
    return res.status(503).json({ error: 'Import is temporarily unavailable.' })
  }
}
