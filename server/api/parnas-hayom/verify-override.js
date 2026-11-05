import { badRequest } from '../_lib/parnas.js'

export default function handler(req, res) {
  if (req.method !== 'POST') return badRequest(res, 'Method not allowed', 405)
  const code = String(req.body?.overrideCode || '')
  if (!process.env.PARNAS_OVERRIDE_CODE || code !== process.env.PARNAS_OVERRIDE_CODE) {
    return badRequest(res, 'The authorization code is not valid.', 403)
  }
  return res.status(200).json({ valid: true })
}
