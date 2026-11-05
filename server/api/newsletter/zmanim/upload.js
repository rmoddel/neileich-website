import { requireOrigin, requireSession } from '../../_lib/newsletter-auth.js'
import { uploadChart } from '../../_lib/newsletter-zmanim.js'

export const config = { maxDuration: 120 }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireSession(req, res)
  if (!user || !requireOrigin(req, res)) return
  try {
    const result = await uploadChart({ filename: req.body?.filename, base64: req.body?.base64, actor: user.username })
    const { blob_path: _path, ...safeImport } = result.import
    return res.status(200).json({ import: { ...safeImport, sourceAvailable: Boolean(_path) }, duplicate: result.duplicate })
  } catch (error) {
    console.error('Zmanim chart processing failed', error.message)
    return res.status(422).json({ error: error.message })
  }
}
