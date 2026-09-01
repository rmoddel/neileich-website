import { db, badRequest, validCheckout } from '../_lib/parnas.js'

const GATEWAY_URL = 'https://x1.cardknox.com/gatewayjson'

export default async function handler(req, res) {
  if (req.method !== 'POST') return badRequest(res, 'Method not allowed', 405)
  const error = validCheckout(req.body)
  if (error) return badRequest(res, error)
  if (!process.env.SOLA_API_KEY) return badRequest(res, 'Payments are temporarily unavailable.', 503)
  const data = req.body
  if (!data.cardToken || !data.cvvToken || !/^\d{4}$/.test(data.cardExpiry || '')) return badRequest(res, 'Please complete your card details.')
  const adjustedAmountText = String(data.adjustedAmount || '').trim()
  const adjustedAmountCents = adjustedAmountText ? Math.round(Number(adjustedAmountText) * 100) : null
  if (adjustedAmountText && (!/^\d{1,7}(\.\d{1,2})?$/.test(adjustedAmountText) || adjustedAmountCents < 100 || adjustedAmountCents > 100000000)) return badRequest(res, 'Enter a valid adjusted amount.')
  if (adjustedAmountCents !== null && (!process.env.PARNAS_OVERRIDE_CODE || data.overrideCode !== process.env.PARNAS_OVERRIDE_CODE)) return badRequest(res, 'The override code is not valid.', 403)
  try {
    const sql = db()
    const hold = await sql`select * from create_pending_sponsorship(${data.sponsorshipTypeId}::uuid, ${data.donorName.trim()}, ${data.donorEmail.trim()}, ${data.donorPhone?.trim() || ''}, ${data.dedicationType}, ${data.dedicationText.trim()}, ${Boolean(data.anonymous)}, ${data.date}::date, ${Number(data.hebrewYear)}, ${Number(data.hebrewMonth)}, ${Number(data.hebrewDay)}, ${Boolean(data.recurring)}, ${adjustedAmountCents})`
    const sponsorship = hold[0]
    if (adjustedAmountCents !== null) await sql`insert into audit_events (sponsorship_id, actor, action, metadata) values (${sponsorship.id}::uuid, 'amount_override', 'adjusted_amount_applied', ${JSON.stringify({ amountCents: adjustedAmountCents })}::jsonb)`
    const gatewayResponse = await fetch(GATEWAY_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xKey: process.env.SOLA_API_KEY, xVersion: '5.0.0', xCommand: 'cc:sale', xAmount: (sponsorship.amount_cents / 100).toFixed(2), xCardNum: data.cardToken, xCVV: data.cvvToken, xExp: data.cardExpiry, xBillFirstName: data.donorName.trim().split(/\s+/)[0], xBillLastName: data.donorName.trim().split(/\s+/).slice(1).join(' ') || '-', xEmail: data.donorEmail.trim(), xSoftwareName: 'Neileich', xSoftwareVersion: '1.0.0', xCustom01: sponsorship.id })
    })
    const result = await gatewayResponse.json().catch(() => ({}))
    if (!gatewayResponse.ok || result.xResult !== 'A') {
      await sql`update sponsorships set status = 'cancelled', payment_status = 'failed', updated_at = now() where id = ${sponsorship.id}::uuid`
      return badRequest(res, result.xError || 'Your payment was not approved. Please check your card and try again.', 402)
    }
    await sql`update sponsorships set payment_provider = 'sola', payment_reference = ${result.xRefNum}, updated_at = now() where id = ${sponsorship.id}::uuid`
    // The webhook (not this browser response) confirms the sponsorship and sends email.
    return res.status(200).json({ pending: true, sponsorshipId: sponsorship.id, receiptToken: sponsorship.receipt_token })
  } catch (caught) {
    console.error('Sola checkout failed', caught)
    return badRequest(res, caught.message?.includes('reserved') || caught.message?.includes('unavailable') ? caught.message : 'We could not process your payment. Please try again.', 409)
  }
}
