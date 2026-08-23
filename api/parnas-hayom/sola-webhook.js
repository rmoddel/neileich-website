import crypto from 'node:crypto'
import { HDate, yahrzeit } from '@hebcal/hdate'
import { db, sendEmail } from '../_lib/parnas.js'

export const config = { api: { bodyParser: false } }

async function rawBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

function validSignature(raw, signature, pin) {
  if (!signature || !pin) return false
  const values = [...new URLSearchParams(raw).entries()]
    .map(([key, value]) => [key.toLowerCase(), value])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value).join('') + pin
  const expected = crypto.createHash('md5').update(values).digest('hex')
  return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const raw = await rawBody(req)
  if (!validSignature(raw, req.headers['ck-signature'], process.env.SOLA_WEBHOOK_PIN)) return res.status(401).send('Invalid webhook signature')
  try {
    const data = Object.fromEntries(new URLSearchParams(raw))
    const reference = data.xRefNum
    if (!reference || data.xResponseResult?.toLowerCase() !== 'approved') return res.status(200).json({ received: true })
    const sql = db()
    const rows = await sql`select s.*, t.name as sponsorship_name from sponsorships s join sponsorship_types t on t.id = s.sponsorship_type_id where s.payment_reference = ${reference} or s.id::text = ${data.xCustom01 || ''} limit 1`
    const s = rows[0]
    if (!s) throw new Error(`No sponsorship found for Sola reference ${reference}`)
    const event = await sql`insert into payment_events(provider_event_id, sponsorship_id, event_type) values (${`sola:${reference}`}, ${s.id}::uuid, 'sola.sale.approved') on conflict (provider_event_id) do nothing returning id`
    if (!event.length) return res.status(200).json({ received: true })
    await sql`select confirm_paid_sponsorship(${s.id}::uuid, ${reference})`
    if (s.recurring) {
      const original = new Date(`${s.gregorian_date}T12:00:00.000Z`)
      let year = new HDate().getFullYear() + 1
      let next = yahrzeit(year, original)
      while (next && next.greg() <= new Date()) next = yahrzeit(++year, original)
      if (next) await sql`insert into recurrence_rules (sponsorship_id, hebrew_month, hebrew_day, next_occurrence) values (${s.id}::uuid, ${s.hebrew_month}, ${s.hebrew_day}, ${next.greg().toISOString().slice(0, 10)}::date) on conflict (sponsorship_id) do nothing`
    }
    const hebrewDate = new HDate(new Date(`${s.gregorian_date}T12:00:00.000Z`)).renderGematriya(true)
    const facts = `Sponsorship: ${s.sponsorship_name}\nAmount paid: $${(s.amount_cents / 100).toFixed(2)}\nGregorian date: ${s.gregorian_date}\nHebrew date: ${hebrewDate}\nDedication: ${s.dedication_type}\n${s.dedication_text}\nPublic acknowledgment: ${s.anonymous ? 'Anonymous' : s.donor_name}\nAnnual sponsorship: ${s.recurring ? 'Yes — annual Hebrew-date reminder requested.' : 'No'}\nPayment reference: ${reference}`
    await Promise.all([sendEmail({ to: s.donor_email, subject: 'Your Neileich sponsorship is confirmed', text: `Thank you, ${s.donor_name}.\n\nYour sponsorship is confirmed.\n\n${facts}\n\nDonor email: ${s.donor_email}${s.donor_phone ? `\nDonor phone: ${s.donor_phone}` : ''}`, sponsorshipId: s.id, template: 'donor_confirmation' }), sendEmail({ to: process.env.NOTIFICATION_EMAIL || 'neileich.org@gmail.com', subject: `New Neileich sponsorship: ${s.sponsorship_name}`, text: `A new paid sponsorship was received.\n\nDonor: ${s.donor_name}\nEmail: ${s.donor_email}\nPhone: ${s.donor_phone || '—'}\n\n${facts}`, sponsorshipId: s.id, template: 'staff_notification' })])
    return res.status(200).json({ received: true })
  } catch (error) { console.error('Sola webhook error', error); return res.status(500).send('Webhook processing failed') }
}
