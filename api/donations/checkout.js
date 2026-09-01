import { db, badRequest } from '../_lib/parnas.js'

const GATEWAY_URL = 'https://x1.cardknox.com/gatewayjson'

export default async function handler(req, res) {
  if (req.method !== 'POST') return badRequest(res, 'Method not allowed', 405)
  const data = req.body || {}
  const amountText = String(data.amount || '').trim()
  const amountCents = Math.round(Number(data.amount) * 100)
  if (!data.donorName?.trim() || data.donorName.trim().length > 120 || !/^\S+@\S+\.\S+$/.test(data.donorEmail || '') || data.donorEmail.length > 254 || (data.donorPhone || '').length > 40 || !/^\d{1,7}(\.\d{1,2})?$/.test(amountText) || !Number.isInteger(amountCents) || amountCents < 100 || amountCents > 100000000) return badRequest(res, 'Please enter your name, a valid email, and an amount of at least $1.00.')
  if (!data.cardToken || !data.cvvToken || !/^\d{4}$/.test(data.cardExpiry || '')) return badRequest(res, 'Please complete your card details.')
  if (!process.env.SOLA_API_KEY) return badRequest(res, 'Payments are temporarily unavailable.', 503)
  try {
    const sql = db()
    const rows = await sql`select * from create_pending_donation(${data.donorName.trim()}, ${data.donorEmail.trim()}, ${data.donorPhone?.trim() || ''}, ${amountCents})`
    const donation = rows[0]
    const result = await fetch(GATEWAY_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xKey: process.env.SOLA_API_KEY, xVersion: '5.0.0', xCommand: 'cc:sale', xAmount: (amountCents / 100).toFixed(2), xCardNum: data.cardToken, xCVV: data.cvvToken, xExp: data.cardExpiry, xBillFirstName: data.donorName.trim().split(/\s+/)[0], xBillLastName: data.donorName.trim().split(/\s+/).slice(1).join(' ') || '-', xEmail: data.donorEmail.trim(), xSoftwareName: 'Neileich', xSoftwareVersion: '1.0.0', xCustom01: `donation:${donation.id}` })
    }).then(async (response) => ({ ok: response.ok, data: await response.json().catch(() => ({})) }))
    if (!result.ok || result.data.xResult !== 'A') {
      await sql`update donations set status = 'failed', payment_status = 'failed', updated_at = now() where id = ${donation.id}::uuid`
      return badRequest(res, result.data.xError || 'Your payment was not approved. Please check your card and try again.', 402)
    }
    await sql`update donations set payment_provider = 'sola', payment_reference = ${result.data.xRefNum}, updated_at = now() where id = ${donation.id}::uuid`
    return res.status(200).json({ pending: true, donationId: donation.id, receiptToken: donation.receipt_token })
  } catch (error) { console.error('General donation checkout failed', error); return badRequest(res, 'We could not process your donation. Please try again.', 500) }
}
