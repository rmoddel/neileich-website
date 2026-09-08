import { db, badRequest, finalizeDonationPayment } from '../_lib/parnas.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return badRequest(res, 'Method not allowed', 405)
  const { donationId, receiptToken } = req.query
  if (!donationId || !receiptToken) return badRequest(res, 'Missing donation receipt reference.')
  try {
    const sql = db()
    let rows = await sql`select id, status, payment_status, payment_reference, donor_name, donor_email, donor_phone, amount_cents, currency, created_at from donations where id = ${donationId}::uuid and receipt_token = ${receiptToken}::uuid`
    if (!rows.length) return badRequest(res, 'Donation not found.', 404)
    if (rows[0].payment_reference && ['pending_payment', 'confirmed'].includes(rows[0].status)) {
      try {
        await finalizeDonationPayment({ donationId: rows[0].id, reference: rows[0].payment_reference, sql })
      } catch (error) {
        console.error('Donation status finalization failed', error)
      }
      rows = await sql`select id, status, payment_status, payment_reference, donor_name, donor_email, donor_phone, amount_cents, currency, created_at from donations where id = ${donationId}::uuid and receipt_token = ${receiptToken}::uuid`
    }
    const donation = rows[0]
    return res.status(200).json({ status: donation.status, paymentStatus: donation.payment_status, receipt: { donorName: donation.donor_name, donorEmail: donation.donor_email, donorPhone: donation.donor_phone, amountCents: donation.amount_cents, currency: donation.currency, paymentReference: donation.payment_reference, createdAt: donation.created_at } })
  } catch (error) { console.error('Donation status lookup failed', error); return badRequest(res, 'Status is temporarily unavailable.', 503) }
}
