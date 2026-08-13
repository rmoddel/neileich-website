import { neon } from '@neondatabase/serverless'

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

export async function sendEmail({ to, subject, text, sponsorshipId, template }) {
  const sql = db()
  try {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new Error('Email provider is not configured')
    const { Resend } = await import('resend')
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.EMAIL_FROM, to, subject, text })
    await sql`insert into email_events (sponsorship_id, recipient, template, status, provider_message_id, sent_at) values (${sponsorshipId}, ${to}, ${template}, 'sent', ${result.data?.id || null}, now())`
  } catch (error) {
    await sql`insert into email_events (sponsorship_id, recipient, template, status, error) values (${sponsorshipId}, ${to}, ${template}, 'failed', ${String(error.message).slice(0, 500)})`
    console.error('Parnas Hayom email failed', error)
  }
}
