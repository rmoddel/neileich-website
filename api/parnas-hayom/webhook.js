import Stripe from 'stripe'
import { HDate, yahrzeit } from '@hebcal/hdate'
import { db, sendEmail } from '../_lib/parnas.js'

export const config = { api: { bodyParser: false } }

async function rawBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).end()
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const event = stripe.webhooks.constructEvent(await rawBody(req), req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)
    const sql = db()
    const alreadyProcessed = await sql`insert into payment_events(provider_event_id, event_type) values (${event.id}, ${event.type}) on conflict (provider_event_id) do nothing returning id`
    if (!alreadyProcessed.length) return res.status(200).json({ received: true })
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const sponsorshipId = session.metadata?.sponsorship_id
      if (!sponsorshipId || session.payment_status !== 'paid') throw new Error('Incomplete sponsorship payment metadata')
      await sql`select confirm_paid_sponsorship(${sponsorshipId}::uuid, ${session.payment_intent?.toString() || session.id})`
      await sql`update payment_events set sponsorship_id = ${sponsorshipId}::uuid where provider_event_id = ${event.id}`
      const rows = await sql`select s.*, t.name as sponsorship_name from sponsorships s join sponsorship_types t on t.id = s.sponsorship_type_id where s.id = ${sponsorshipId}::uuid`
      const s = rows[0]
      if (s) {
        if (s.recurring) {
          const original = new Date(`${s.gregorian_date}T12:00:00.000Z`)
          let targetYear = new HDate().getFullYear() + 1
          let next = yahrzeit(targetYear, original)
          while (next && next.greg() <= new Date()) next = yahrzeit(++targetYear, original)
          if (next) await sql`insert into recurrence_rules (sponsorship_id, hebrew_month, hebrew_day, next_occurrence) values (${s.id}::uuid, ${s.hebrew_month}, ${s.hebrew_day}, ${next.greg().toISOString().slice(0, 10)}::date) on conflict (sponsorship_id) do nothing`
        }
        const facts = `${s.sponsorship_name}\n$${(s.amount_cents / 100).toFixed(2)}\n${s.gregorian_date}\n${s.dedication_type}: ${s.dedication_text}${s.recurring ? '\nAnnual Hebrew-date reminder requested.' : ''}`
        await Promise.all([sendEmail({ to: s.donor_email, subject: 'Your Neileich sponsorship is confirmed', text: `Thank you, ${s.donor_name}.\n\nYour sponsorship is confirmed.\n\n${facts}\n\nPayment reference: ${session.payment_intent || session.id}`, sponsorshipId, template: 'donor_confirmation' }), sendEmail({ to: process.env.NOTIFICATION_EMAIL || 'neileichorg@gmail.com', subject: `New Neileich sponsorship: ${s.sponsorship_name}`, text: `A new paid sponsorship was received.\n\nDonor: ${s.donor_name}\nEmail: ${s.donor_email}\nPhone: ${s.donor_phone || '—'}\n\n${facts}\n\nAdmin record: ${process.env.APP_URL || ''}/admin/parnas-hayom`, sponsorshipId, template: 'staff_notification' })])
      }
    }
    return res.status(200).json({ received: true })
  } catch (error) { console.error('Stripe webhook error', error.message); return res.status(400).send('Webhook error') }
}
