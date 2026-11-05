import { db, badRequest, finalizeDonationPayment } from '../_lib/parnas.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return badRequest(res, 'Method not allowed', 405)
  const { donationId, paymentReference, overrideCode } = req.body || {}
  if (!process.env.PARNAS_OVERRIDE_CODE || overrideCode !== process.env.PARNAS_OVERRIDE_CODE) return badRequest(res, 'The override code is not valid.', 403)
  if (!donationId) return badRequest(res, 'Missing donation ID.')

  try {
    const sql = db()
    const rows = await sql`select id, payment_reference from donations where id = ${donationId}::uuid limit 1`
    const donation = rows[0]
    if (!donation) return badRequest(res, 'Donation not found.', 404)

    const reference = donation.payment_reference || String(paymentReference || '').trim()
    if (!reference) return badRequest(res, 'Missing Sola payment reference.')

    const result = await finalizeDonationPayment({ donationId, reference, sql, forceEmail: true })
    return res.status(200).json({ ok: true, emailed: result.emailed })
  } catch (error) {
    console.error('Donation receipt resend failed', error)
    return badRequest(res, 'Receipt email could not be resent.', 500)
  }
}
