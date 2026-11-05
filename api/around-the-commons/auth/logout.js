import { revokeSession, requireOrigin } from '../../_lib/newsletter-auth.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).end()
  if (!requireOrigin(req, res)) return
  try { await revokeSession(req, res); return res.status(204).end() }
  catch (error) { console.error('ATC logout failed', error.message); return res.status(503).json({ error: 'Sign-out is temporarily unavailable.' }) }
}
