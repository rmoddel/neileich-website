import { db, badRequest } from '../_lib/parnas.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return badRequest(res, 'Method not allowed', 405)
  const { sponsorshipId } = req.query
  if (!sponsorshipId) return badRequest(res, 'Missing sponsorship reference.')
  try {
    const rows = await db()`select status, payment_status from sponsorships where id = ${sponsorshipId}::uuid`
    if (!rows.length) return badRequest(res, 'Sponsorship not found.', 404)
    return res.status(200).json({ status: rows[0].status, paymentStatus: rows[0].payment_status })
  } catch (error) { console.error('Sponsorship status lookup failed', error); return badRequest(res, 'Status is temporarily unavailable.', 503) }
}
