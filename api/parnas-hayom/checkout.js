import Stripe from 'stripe'
import { db, appUrl, badRequest, validCheckout } from '../_lib/parnas.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return badRequest(res, 'Method not allowed', 405)
  const error = validCheckout(req.body)
  if (error) return badRequest(res, error)
  if (!process.env.STRIPE_SECRET_KEY) return badRequest(res, 'Payments are temporarily unavailable.', 503)
  const data = req.body
  try {
    const sql = db()
    const hold = await sql`select * from create_pending_sponsorship(${data.sponsorshipTypeId}::uuid, ${data.donorName.trim()}, ${data.donorEmail.trim()}, ${data.donorPhone?.trim() || ''}, ${data.dedicationType}, ${data.dedicationText.trim()}, ${Boolean(data.anonymous)}, ${data.date}::date, ${Number(data.hebrewYear)}, ${Number(data.hebrewMonth)}, ${Number(data.hebrewDay)}, ${Boolean(data.recurring)})`
    const sponsorship = hold[0]
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', payment_method_types: ['card'], customer_email: data.donorEmail.trim(),
      line_items: [{ price_data: { currency: 'usd', product_data: { name: data.sponsorshipName || 'Neileich sponsorship' }, unit_amount: sponsorship.amount_cents }, quantity: 1 }],
      metadata: { sponsorship_id: sponsorship.id },
      success_url: `${appUrl(req)}/parnas-hayom?payment=processing`,
      cancel_url: `${appUrl(req)}/parnas-hayom?payment=cancelled`
    })
    await sql`update sponsorships set payment_provider = 'stripe', payment_reference = ${session.id}, updated_at = now() where id = ${sponsorship.id}::uuid`
    return res.status(200).json({ checkoutUrl: session.url })
  } catch (caught) {
    console.error('Parnas Hayom checkout failed', caught)
    return badRequest(res, caught.message?.includes('reserved') || caught.message?.includes('unavailable') ? caught.message : 'We could not begin checkout. Please try again.', 409)
  }
}
