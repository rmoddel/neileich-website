import { authenticate, requireOrigin } from '../../_lib/newsletter-auth.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).end()
  if (!requireOrigin(req, res)) return
  try {
    const result = await authenticate(req, res, req.body?.username, req.body?.password)
    if (!result.ok) return res.status(result.status).json({ error: result.error })
    return res.status(200).json({ redirect: '/around-the-commons', user: result.user })
  } catch (error) {
    console.error('ATC login failed', error.message)
    return res.status(503).json({ error: 'Sign-in is temporarily unavailable.' })
  }
}
