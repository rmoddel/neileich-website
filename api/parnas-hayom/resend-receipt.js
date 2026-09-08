import { db, badRequest, finalizeSponsorshipPayment } from '../_lib/parnas.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return badRequest(res, 'Method not allowed', 405)
  const { sponsorshipId, paymentReference, overrideCode } = req.body || {}
  if (!process.env.PARNAS_OVERRIDE_CODE || overrideCode !== process.env.PARNAS_OVERRIDE_CODE) return badRequest(res, 'The override code is not valid.', 403)
  if (!sponsorshipId) return badRequest(res, 'Missing sponsorship ID.')

  try {
    const sql = db()
    const rows = await sql`select id, payment_reference from sponsorships where id = ${sponsorshipId}::uuid limit 1`
    const sponsorship = rows[0]
    if (!sponsorship) return badRequest(res, 'Sponsorship not found.', 404)

    const reference = sponsorship.payment_reference || String(paymentReference || '').trim()
    if (!reference) return badRequest(res, 'Missing Sola payment reference.')

    const result = await finalizeSponsorshipPayment({ sponsorshipId, reference, sql, forceEmail: true })
    return res.status(200).json({ ok: true, emailed: result.emailed })
  } catch (error) {
    console.error('Sponsorship receipt resend failed', error)
    return badRequest(res, 'Receipt email could not be resent.', 500)
  }
}
