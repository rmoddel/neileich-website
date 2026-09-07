import { neon } from '@neondatabase/serverless'
import { HDate, yahrzeit } from '@hebcal/hdate'

export const TIMEZONE = 'America/New_York'

export function db() {
  if (!process.env.DATABASE_URL) throw new Error('Database is not configured')
  return neon(process.env.DATABASE_URL)
}

export function appUrl(req) {
  return process.env.APP_URL || `https://${req.headers.host}`
}

export function badRequest(res, message, status = 400) {
  return res.status(status).json({ error: message })
}

export function validCheckout(body) {
  const required = ['sponsorshipTypeId', 'date', 'donorName', 'donorEmail', 'dedicationType', 'dedicationText', 'hebrewYear', 'hebrewMonth', 'hebrewDay']
  if (!body || required.some((field) => !body[field])) return 'Please complete all required fields.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return 'Please select a valid date.'
  if (!/^\S+@\S+\.\S+$/.test(body.donorEmail) || body.donorEmail.length > 254) return 'Please enter a valid email address.'
  if (body.donorName.length > 120 || body.dedicationText.length > 500) return 'Please shorten the information entered.'
  return null
}

export async function sendEmail({ to, subject, text, sponsorshipId, donationId, template }) {
  const sql = db()
  try {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new Error('Email provider is not configured')
    const { Resend } = await import('resend')
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.EMAIL_FROM, to, subject, text })
    if (result.error) throw new Error(result.error.message || 'Email provider rejected the message')
    if (donationId) {
      await sql`insert into email_events (sponsorship_id, donation_id, recipient, template, status, provider_message_id, sent_at) values (${sponsorshipId || null}, ${donationId}, ${to}, ${template}, 'sent', ${result.data?.id || null}, now())`
    } else {
      await sql`insert into email_events (sponsorship_id, recipient, template, status, provider_message_id, sent_at) values (${sponsorshipId || null}, ${to}, ${template}, 'sent', ${result.data?.id || null}, now())`
    }
  } catch (error) {
    if (donationId) {
      await sql`insert into email_events (sponsorship_id, donation_id, recipient, template, status, error) values (${sponsorshipId || null}, ${donationId}, ${to}, ${template}, 'failed', ${String(error.message).slice(0, 500)})`
    } else {
      await sql`insert into email_events (sponsorship_id, recipient, template, status, error) values (${sponsorshipId || null}, ${to}, ${template}, 'failed', ${String(error.message).slice(0, 500)})`
    }
    console.error('Parnas Hayom email failed', error)
  }
}

export async function finalizeSponsorshipPayment({ sponsorshipId, reference }) {
  const sql = db()
  const rows = await sql`select s.*, t.name as sponsorship_name from sponsorships s join sponsorship_types t on t.id = s.sponsorship_type_id where s.id = ${sponsorshipId}::uuid limit 1`
  const sponsorship = rows[0]
  if (!sponsorship) throw new Error(`No sponsorship found for Sola reference ${reference}`)

  // Whichever path arrives first (checkout or webhook) owns finalization and mail.
  const event = await sql`insert into payment_events(provider_event_id, sponsorship_id, event_type) values (${`sola:${reference}`}, ${sponsorship.id}::uuid, 'sola.sale.approved') on conflict (provider_event_id) do nothing returning id`
  if (!event.length) return { finalized: false, sponsorship }

  await sql`select confirm_paid_sponsorship(${sponsorship.id}::uuid, ${reference})`
  if (sponsorship.recurring) {
    const original = new Date(`${sponsorship.gregorian_date}T12:00:00.000Z`)
    let year = new HDate().getFullYear() + 1
    let next = yahrzeit(year, original)
    while (next && next.greg() <= new Date()) next = yahrzeit(++year, original)
    if (next) await sql`insert into recurrence_rules (sponsorship_id, hebrew_month, hebrew_day, next_occurrence) values (${sponsorship.id}::uuid, ${sponsorship.hebrew_month}, ${sponsorship.hebrew_day}, ${next.greg().toISOString().slice(0, 10)}::date) on conflict (sponsorship_id) do nothing`
  }

  const hebrewDate = new HDate(new Date(`${sponsorship.gregorian_date}T12:00:00.000Z`)).renderGematriya(true)
  const facts = `Sponsorship: ${sponsorship.sponsorship_name}\nAmount paid: $${(sponsorship.amount_cents / 100).toFixed(2)}\nGregorian date: ${sponsorship.gregorian_date}\nHebrew date: ${hebrewDate}\nDedication: ${sponsorship.dedication_type}\n${sponsorship.dedication_text}\nPublic acknowledgment: ${sponsorship.anonymous ? 'Anonymous' : sponsorship.donor_name}\nAnnual sponsorship: ${sponsorship.recurring ? 'Yes — annual Hebrew-date reminder requested.' : 'No'}\nPayment reference: ${reference}`
  await Promise.all([
    sendEmail({ to: sponsorship.donor_email, subject: 'Your Neileich sponsorship is confirmed', text: `Thank you, ${sponsorship.donor_name}.\n\nYour sponsorship is confirmed.\n\n${facts}\n\nDonor email: ${sponsorship.donor_email}${sponsorship.donor_phone ? `\nDonor phone: ${sponsorship.donor_phone}` : ''}`, sponsorshipId: sponsorship.id, template: 'donor_confirmation' }),
    sendEmail({ to: process.env.NOTIFICATION_EMAIL || 'info@neileich.org', subject: `New Neileich sponsorship: ${sponsorship.sponsorship_name}`, text: `A new paid sponsorship was received.\n\nDonor: ${sponsorship.donor_name}\nEmail: ${sponsorship.donor_email}\nPhone: ${sponsorship.donor_phone || '—'}\n\n${facts}`, sponsorshipId: sponsorship.id, template: 'staff_notification' }),
  ])
  return { finalized: true, sponsorship }
}
