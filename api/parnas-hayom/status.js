import { db, badRequest, finalizeSponsorshipPayment } from '../_lib/parnas.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return badRequest(res, 'Method not allowed', 405)
  const { sponsorshipId, receiptToken } = req.query
  if (!sponsorshipId || !receiptToken) return badRequest(res, 'Missing sponsorship receipt reference.')
  try {
    const sql = db()
    let rows = await sql`select s.id, s.status, s.payment_status, s.payment_reference, s.donor_name, s.donor_email, s.donor_phone, s.dedication_type, s.dedication_text, s.anonymous, s.gregorian_date::text as gregorian_date, s.hebrew_year, s.hebrew_month, s.hebrew_day, s.amount_cents, s.currency, s.recurring, t.name as sponsorship_name from sponsorships s join sponsorship_types t on t.id = s.sponsorship_type_id where s.id = ${sponsorshipId}::uuid and s.receipt_token = ${receiptToken}::uuid`
    if (!rows.length) return badRequest(res, 'Sponsorship not found.', 404)
    if (rows[0].payment_reference && ['reserved_pending_payment', 'confirmed'].includes(rows[0].status)) {
      try {
        await finalizeSponsorshipPayment({ sponsorshipId: rows[0].id, reference: rows[0].payment_reference, sql })
      } catch (error) {
        console.error('Sponsorship status finalization failed', error)
      }
      rows = await sql`select s.id, s.status, s.payment_status, s.payment_reference, s.donor_name, s.donor_email, s.donor_phone, s.dedication_type, s.dedication_text, s.anonymous, s.gregorian_date::text as gregorian_date, s.hebrew_year, s.hebrew_month, s.hebrew_day, s.amount_cents, s.currency, s.recurring, t.name as sponsorship_name from sponsorships s join sponsorship_types t on t.id = s.sponsorship_type_id where s.id = ${sponsorshipId}::uuid and s.receipt_token = ${receiptToken}::uuid`
    }
    const sponsorship = rows[0]
    let donorEmailStatus = { status: 'not_attempted', error: null }
    try {
      const emailRows = await sql`select status, error from email_events where sponsorship_id = ${sponsorship.id}::uuid and recipient = ${sponsorship.donor_email} and template = 'donor_confirmation_with_attachments' order by sent_at desc nulls last, id desc limit 1`
      if (emailRows[0]) donorEmailStatus = { status: emailRows[0].status, error: emailRows[0].error || null }
    } catch (error) {
      console.error('Sponsorship email status lookup failed', error)
    }
    return res.status(200).json({
      status: sponsorship.status,
      paymentStatus: sponsorship.payment_status,
      emailStatus: donorEmailStatus.status,
      emailError: donorEmailStatus.error,
      receipt: {
        sponsorshipName: sponsorship.sponsorship_name,
        donorName: sponsorship.donor_name,
        donorEmail: sponsorship.donor_email,
        donorPhone: sponsorship.donor_phone,
        dedicationType: sponsorship.dedication_type,
        dedicationText: sponsorship.dedication_text,
        anonymous: sponsorship.anonymous,
        gregorianDate: sponsorship.gregorian_date,
        hebrewYear: sponsorship.hebrew_year,
        hebrewMonth: sponsorship.hebrew_month,
        hebrewDay: sponsorship.hebrew_day,
        amountCents: sponsorship.amount_cents,
        currency: sponsorship.currency,
        recurring: sponsorship.recurring,
        paymentReference: sponsorship.payment_reference,
        emailStatus: donorEmailStatus.status,
        emailError: donorEmailStatus.error,
      },
    })
  } catch (error) { console.error('Sponsorship status lookup failed', error); return badRequest(res, 'Status is temporarily unavailable.', 503) }
}
