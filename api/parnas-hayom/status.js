import { db, badRequest } from '../_lib/parnas.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return badRequest(res, 'Method not allowed', 405)
  const { sponsorshipId, receiptToken } = req.query
  if (!sponsorshipId || !receiptToken) return badRequest(res, 'Missing sponsorship receipt reference.')
  try {
    const rows = await db()`select s.status, s.payment_status, s.payment_reference, s.donor_name, s.donor_email, s.donor_phone, s.dedication_type, s.dedication_text, s.anonymous, s.gregorian_date::text as gregorian_date, s.hebrew_year, s.hebrew_month, s.hebrew_day, s.amount_cents, s.currency, s.recurring, t.name as sponsorship_name from sponsorships s join sponsorship_types t on t.id = s.sponsorship_type_id where s.id = ${sponsorshipId}::uuid and s.receipt_token = ${receiptToken}::uuid`
    if (!rows.length) return badRequest(res, 'Sponsorship not found.', 404)
    const sponsorship = rows[0]
    return res.status(200).json({
      status: sponsorship.status,
      paymentStatus: sponsorship.payment_status,
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
      },
    })
  } catch (error) { console.error('Sponsorship status lookup failed', error); return badRequest(res, 'Status is temporarily unavailable.', 503) }
}
