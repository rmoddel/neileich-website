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

const DONATION_EIN = '26-4527675'

function donationMoney(cents, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
}

function donationDate(value) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: TIMEZONE }).format(value ? new Date(value) : new Date())
}

function escapeMarkup(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}

function clippedText(value, maxLength) {
  const text = String(value || '').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text
}

export function buildDonationReceiptText(donation, reference = donation.payment_reference) {
  const amount = donationMoney(donation.amount_cents, donation.currency)
  const date = donationDate(donation.created_at)
  return [
    'Neileich Donation Receipt',
    '',
    'Thank you for your donation to Neileich.',
    '',
    `Receipt ID: ${donation.id}`,
    `Date: ${date}`,
    `Donor: ${donation.donor_name}`,
    `Email: ${donation.donor_email}`,
    donation.donor_phone ? `Phone: ${donation.donor_phone}` : null,
    `Amount: ${amount}`,
    `Payment reference: ${reference || 'Unavailable'}`,
    '',
    'Neileich is a project of Bais Medrash of Lakewood Commons, a registered 501(c)(3) organization.',
    `EIN: ${DONATION_EIN}`,
  ].filter(Boolean).join('\n')
}

export function buildDonationPlaqueSvg(donation) {
  const donorName = escapeMarkup(clippedText(donation.donor_name, 42))
  const amount = escapeMarkup(donationMoney(donation.amount_cents, donation.currency))
  const date = escapeMarkup(donationDate(donation.created_at))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <rect width="1200" height="800" fill="#102d36"/>
  <rect x="64" y="64" width="1072" height="672" rx="28" fill="none" stroke="#e7c77e" stroke-width="6"/>
  <rect x="95" y="95" width="1010" height="610" rx="18" fill="none" stroke="#d9e6e2" stroke-opacity=".28" stroke-width="2"/>
  <text x="600" y="166" text-anchor="middle" fill="#e7c77e" font-family="Georgia, serif" font-size="74">Neileich</text>
  <text x="600" y="234" text-anchor="middle" fill="#d9e6e2" font-family="Arial, sans-serif" font-size="26" letter-spacing="4">BUILDING BELONGING</text>
  <line x1="250" y1="304" x2="950" y2="304" stroke="#d9e6e2" stroke-opacity=".35" stroke-width="2"/>
  <text x="600" y="388" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="40">Thank you for your donation</text>
  <text x="600" y="474" text-anchor="middle" fill="#fff7e3" font-family="Georgia, serif" font-size="62">${donorName}</text>
  <text x="600" y="558" text-anchor="middle" fill="#e7c77e" font-family="Arial, sans-serif" font-size="34">${amount}</text>
  <text x="600" y="620" text-anchor="middle" fill="#d9e6e2" font-family="Arial, sans-serif" font-size="26">${date}</text>
  <text x="600" y="680" text-anchor="middle" fill="#d9e6e2" fill-opacity=".86" font-family="Arial, sans-serif" font-size="24">Your support helps children and families thrive.</text>
</svg>`
}

export function buildDonationConfirmationEmail(donation, reference = donation.payment_reference) {
  const amount = donationMoney(donation.amount_cents, donation.currency)
  const date = donationDate(donation.created_at)
  const shortId = String(donation.id).slice(0, 8)
  const receiptText = buildDonationReceiptText(donation, reference)
  const plaqueSvg = buildDonationPlaqueSvg(donation)
  const text = `Thank you, ${donation.donor_name}.\n\nYour donation to Neileich has been received.\n\nAmount: ${amount}\nDate: ${date}\nPayment reference: ${reference || 'Unavailable'}\n\nYour receipt and donation plaque are attached.`
  const html = `<p>Thank you, ${escapeMarkup(donation.donor_name)}.</p><p>Your donation to Neileich has been received.</p><p><strong>Amount:</strong> ${escapeMarkup(amount)}<br><strong>Date:</strong> ${escapeMarkup(date)}<br><strong>Payment reference:</strong> ${escapeMarkup(reference || 'Unavailable')}</p><p>Your receipt and donation plaque are attached.</p>`
  return {
    subject: 'Thank you for your Neileich donation',
    text,
    html,
    attachments: [
      { filename: `neileich-donation-receipt-${shortId}.txt`, content: receiptText, contentType: 'text/plain' },
      { filename: `neileich-donation-plaque-${shortId}.svg`, content: plaqueSvg, contentType: 'image/svg+xml' },
    ],
  }
}

export function buildDonationStaffNotificationEmail(donation, reference = donation.payment_reference) {
  const facts = `Amount paid: ${donationMoney(donation.amount_cents, donation.currency)}\nPayment reference: ${reference || 'Unavailable'}`
  return {
    subject: 'New Neileich donation',
    text: `A new paid donation was received.\n\nDonor: ${donation.donor_name}\nEmail: ${donation.donor_email}\nPhone: ${donation.donor_phone || '-'}\n${facts}`,
  }
}

export async function sendEmail({ to, subject, text, html, attachments, sponsorshipId, donationId, template }) {
  const sql = db()
  try {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new Error('Email provider is not configured')
    const { Resend } = await import('resend')
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.EMAIL_FROM, to, subject, text, html, attachments })
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

export async function finalizeDonationPayment({ donationId, reference, sql = db(), sendEmailFn = sendEmail }) {
  const rows = await sql`select * from donations where id = ${donationId}::uuid limit 1`
  const donation = rows[0]
  if (!donation) throw new Error(`No donation found for Sola reference ${reference}`)
  if (donation.status === 'confirmed' && donation.payment_status === 'paid') return { finalized: false, donation }

  const updated = await sql`update donations set payment_provider = 'sola', payment_status = 'paid', payment_reference = ${reference}, status = 'confirmed', updated_at = now() where id = ${donation.id}::uuid and status = 'pending_payment' returning *`
  const finalizedDonation = updated[0]
  if (!finalizedDonation) return { finalized: false, donation }

  await sql`insert into payment_events(provider_event_id, donation_id, event_type) values (${`sola:${reference}`}, ${finalizedDonation.id}::uuid, 'sola.donation.approved') on conflict (provider_event_id) do nothing`
  const donorEmail = buildDonationConfirmationEmail(finalizedDonation, reference)
  const staffEmail = buildDonationStaffNotificationEmail(finalizedDonation, reference)
  await Promise.all([
    sendEmailFn({ to: finalizedDonation.donor_email, ...donorEmail, donationId: finalizedDonation.id, template: 'donor_donation_confirmation' }),
    sendEmailFn({ to: process.env.NOTIFICATION_EMAIL || 'info@neileich.org', ...staffEmail, donationId: finalizedDonation.id, template: 'staff_donation_notification' }),
  ])
  return { finalized: true, donation: finalizedDonation }
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
