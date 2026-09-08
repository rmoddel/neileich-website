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

function dateOnly(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value || '').slice(0, 10)
}

function sponsorshipDate(value) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: TIMEZONE }).format(new Date(`${dateOnly(value)}T12:00:00.000Z`))
}

function sponsorshipHebrewDate(sponsorship) {
  return new HDate(new Date(`${dateOnly(sponsorship.gregorian_date)}T12:00:00.000Z`)).renderGematriya(true)
}

function sponsorshipPublicName(sponsorship) {
  return sponsorship.anonymous ? 'Anonymous' : sponsorship.donor_name
}

function buildSponsorshipFacts(sponsorship, reference = sponsorship.payment_reference) {
  return `Sponsorship: ${sponsorship.sponsorship_name}\nAmount paid: ${donationMoney(sponsorship.amount_cents, sponsorship.currency)}\nGregorian date: ${sponsorshipDate(sponsorship.gregorian_date)}\nHebrew date: ${sponsorshipHebrewDate(sponsorship)}\nDedication: ${sponsorship.dedication_type}\n${sponsorship.dedication_text}\nPublic acknowledgment: ${sponsorshipPublicName(sponsorship)}\nAnnual sponsorship: ${sponsorship.recurring ? 'Yes — annual Hebrew-date reminder requested.' : 'No'}\nPayment reference: ${reference || 'Unavailable'}`
}

export function buildSponsorshipReceiptText(sponsorship, reference = sponsorship.payment_reference) {
  return [
    'Neileich Sponsorship Receipt',
    '',
    'Thank you for your sponsorship of Neileich.',
    '',
    `Receipt ID: ${sponsorship.id}`,
    `Donor: ${sponsorship.donor_name}`,
    `Email: ${sponsorship.donor_email}`,
    sponsorship.donor_phone ? `Phone: ${sponsorship.donor_phone}` : null,
    buildSponsorshipFacts(sponsorship, reference),
    '',
    'Neileich is a project of Bais Medrash of Lakewood Commons, a registered 501(c)(3) organization.',
    `EIN: ${DONATION_EIN}`,
  ].filter(Boolean).join('\n')
}

export function buildSponsorshipPlaqueSvg(sponsorship, reference = sponsorship.payment_reference) {
  const dedicationType = escapeMarkup(clippedText(sponsorship.dedication_type, 52))
  const dedicationText = escapeMarkup(clippedText(sponsorship.dedication_text, 92))
  const donorName = escapeMarkup(clippedText(sponsorshipPublicName(sponsorship), 48))
  const gregorianDate = escapeMarkup(sponsorshipDate(sponsorship.gregorian_date))
  const hebrewDate = escapeMarkup(sponsorshipHebrewDate(sponsorship))
  const sponsorshipName = escapeMarkup(clippedText(sponsorship.sponsorship_name, 44))
  const amount = escapeMarkup(donationMoney(sponsorship.amount_cents, sponsorship.currency))
  const paymentReference = escapeMarkup(reference || 'Unavailable')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1275" height="1650" viewBox="0 0 1275 1650">
  <rect width="1275" height="1650" fill="#102d36"/>
  <rect x="52" y="52" width="1171" height="1546" rx="28" fill="none" stroke="#e7c77e" stroke-width="3"/>
  <rect x="92" y="92" width="1091" height="1466" fill="none" stroke="#d9e6e2" stroke-opacity=".26" stroke-width="2"/>
  <text x="637.5" y="162" text-anchor="middle" fill="#e7c77e" font-family="Arial, sans-serif" font-size="34" font-weight="700" letter-spacing="8">PARNAS HAYOM</text>
  <text x="637.5" y="318" text-anchor="middle" fill="#d9e6e2" font-family="Arial, sans-serif" font-size="26" font-weight="700">Building Belonging. Thriving children. Strong Kehila.</text>
  <line x1="145" y1="408" x2="1130" y2="408" stroke="#d9e6e2" stroke-opacity=".35" stroke-width="2"/>
  <line x1="578" y1="408" x2="697" y2="408" stroke="#e7c77e" stroke-width="5"/>
  <text x="637.5" y="704" text-anchor="middle" fill="#d9e6e2" font-family="Arial, sans-serif" font-size="31" font-weight="700" letter-spacing="3">${sponsorshipName}</text>
  <text x="637.5" y="792" text-anchor="middle" fill="#e7c77e" font-family="Arial, sans-serif" font-size="40" font-weight="700">${dedicationType}</text>
  <text x="637.5" y="916" text-anchor="middle" fill="#fff7e3" font-family="Georgia, serif" font-size="76" direction="rtl" unicode-bidi="plaintext">${dedicationText}</text>
  <line x1="145" y1="1220" x2="1130" y2="1220" stroke="#d9e6e2" stroke-opacity=".35" stroke-width="2"/>
  <line x1="578" y1="1220" x2="697" y2="1220" stroke="#e7c77e" stroke-width="5"/>
  <rect x="340" y="1272" width="595" height="70" rx="35" fill="#e7c77e"/>
  <text x="637.5" y="1318" text-anchor="middle" fill="#102d36" font-family="Arial, sans-serif" font-size="30" font-weight="700">${gregorianDate} · ${hebrewDate}</text>
  <text x="637.5" y="1402" text-anchor="middle" fill="#d9e6e2" font-family="Arial, sans-serif" font-size="32" font-weight="700">Sponsored by ${donorName}</text>
  <text x="637.5" y="1472" text-anchor="middle" fill="#d9e6e2" fill-opacity=".82" font-family="Arial, sans-serif" font-size="22">Amount: ${amount} · Payment reference: ${paymentReference}</text>
</svg>`
}

export function buildSponsorshipConfirmationEmail(sponsorship, reference = sponsorship.payment_reference) {
  const shortId = String(sponsorship.id).slice(0, 8)
  const receiptText = buildSponsorshipReceiptText(sponsorship, reference)
  const plaqueSvg = buildSponsorshipPlaqueSvg(sponsorship, reference)
  const facts = buildSponsorshipFacts(sponsorship, reference)
  const text = `Thank you, ${sponsorship.donor_name}.\n\nYour Neileich sponsorship is confirmed.\n\n${facts}\n\nYour receipt and dedication plaque are attached.`
  const html = `<p>Thank you, ${escapeMarkup(sponsorship.donor_name)}.</p><p>Your Neileich sponsorship is confirmed.</p><p><strong>Sponsorship:</strong> ${escapeMarkup(sponsorship.sponsorship_name)}<br><strong>Amount:</strong> ${escapeMarkup(donationMoney(sponsorship.amount_cents, sponsorship.currency))}<br><strong>Date:</strong> ${escapeMarkup(sponsorshipDate(sponsorship.gregorian_date))}<br><strong>Hebrew date:</strong> ${escapeMarkup(sponsorshipHebrewDate(sponsorship))}<br><strong>Payment reference:</strong> ${escapeMarkup(reference || 'Unavailable')}</p><p>Your receipt and dedication plaque are attached.</p>`
  return {
    subject: 'Your Neileich sponsorship is confirmed',
    text,
    html,
    attachments: [
      { filename: `neileich-sponsorship-receipt-${shortId}.txt`, content: receiptText, contentType: 'text/plain' },
      { filename: `neileich-sponsorship-plaque-${shortId}.svg`, content: plaqueSvg, contentType: 'image/svg+xml' },
    ],
  }
}

export function buildSponsorshipStaffNotificationEmail(sponsorship, reference = sponsorship.payment_reference) {
  return {
    subject: `New Neileich sponsorship: ${sponsorship.sponsorship_name}`,
    text: `A new paid sponsorship was received.\n\nDonor: ${sponsorship.donor_name}\nEmail: ${sponsorship.donor_email}\nPhone: ${sponsorship.donor_phone || '—'}\n\n${buildSponsorshipFacts(sponsorship, reference)}`,
  }
}

async function recordEmailEvent(sql, { to, template, sponsorshipId, donationId, status, providerMessageId, error }) {
  if (!sql) return
  try {
    if (status === 'sent') {
      if (donationId) {
        await sql`insert into email_events (sponsorship_id, donation_id, recipient, template, status, provider_message_id, sent_at) values (${sponsorshipId || null}, ${donationId}, ${to}, ${template}, 'sent', ${providerMessageId || null}, now())`
      } else {
        await sql`insert into email_events (sponsorship_id, recipient, template, status, provider_message_id, sent_at) values (${sponsorshipId || null}, ${to}, ${template}, 'sent', ${providerMessageId || null}, now())`
      }
      return
    }
    if (donationId) {
      await sql`insert into email_events (sponsorship_id, donation_id, recipient, template, status, error) values (${sponsorshipId || null}, ${donationId}, ${to}, ${template}, 'failed', ${String(error?.message || error).slice(0, 500)})`
    } else {
      await sql`insert into email_events (sponsorship_id, recipient, template, status, error) values (${sponsorshipId || null}, ${to}, ${template}, 'failed', ${String(error?.message || error).slice(0, 500)})`
    }
  } catch (eventError) {
    console.error('Email event logging failed', eventError)
  }
}

export async function sendEmail({ to, subject, text, html, attachments, sponsorshipId, donationId, template }) {
  let sql = null
  try {
    sql = db()
  } catch (error) {
    console.error('Email event database unavailable', error)
  }
  try {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new Error('Email provider is not configured')
    const { Resend } = await import('resend')
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.EMAIL_FROM, to, subject, text, html, attachments })
    if (result.error) throw new Error(result.error.message || 'Email provider rejected the message')
    await recordEmailEvent(sql, { to, template, sponsorshipId, donationId, status: 'sent', providerMessageId: result.data?.id || null })
  } catch (error) {
    await recordEmailEvent(sql, { to, template, sponsorshipId, donationId, status: 'failed', error })
    console.error('Parnas Hayom email failed', error)
  }
}

async function sentDonationEmailTemplates(sql, donationId) {
  try {
    const rows = await sql`select template from email_events where donation_id = ${donationId}::uuid and status = 'sent' and template in ('donor_donation_confirmation', 'staff_donation_notification')`
    return new Set(rows.map((row) => row.template))
  } catch (error) {
    console.error('Donation email status lookup failed', error)
    return new Set()
  }
}

async function sentSponsorshipEmailTemplates(sql, sponsorshipId) {
  try {
    const rows = await sql`select template from email_events where sponsorship_id = ${sponsorshipId}::uuid and status = 'sent' and template in ('donor_confirmation_with_attachments', 'staff_notification')`
    return new Set(rows.map((row) => row.template))
  } catch (error) {
    console.error('Sponsorship email status lookup failed', error)
    return new Set()
  }
}

async function sendDonationConfirmationMessages({ donation, reference, sql, sendEmailFn, checkExisting = false }) {
  const existingTemplates = checkExisting ? await sentDonationEmailTemplates(sql, donation.id) : new Set()
  const shouldSendDonor = !existingTemplates.has('donor_donation_confirmation')
  const shouldSendStaff = !existingTemplates.has('staff_donation_notification')
  if (!shouldSendDonor && !shouldSendStaff) return false
  const donorEmail = buildDonationConfirmationEmail(donation, reference)
  const staffEmail = buildDonationStaffNotificationEmail(donation, reference)
  await Promise.all([
    shouldSendDonor
      ? sendEmailFn({ to: donation.donor_email, ...donorEmail, donationId: donation.id, template: 'donor_donation_confirmation' })
      : null,
    shouldSendStaff
      ? sendEmailFn({ to: process.env.NOTIFICATION_EMAIL || 'info@neileich.org', ...staffEmail, donationId: donation.id, template: 'staff_donation_notification' })
      : null,
  ].filter(Boolean))
  return true
}

async function sendSponsorshipConfirmationMessages({ sponsorship, reference, sql, sendEmailFn, checkExisting = false }) {
  const existingTemplates = checkExisting ? await sentSponsorshipEmailTemplates(sql, sponsorship.id) : new Set()
  const shouldSendDonor = !existingTemplates.has('donor_confirmation_with_attachments')
  const shouldSendStaff = !existingTemplates.has('staff_notification')
  if (!shouldSendDonor && !shouldSendStaff) return false
  const donorEmail = buildSponsorshipConfirmationEmail(sponsorship, reference)
  const staffEmail = buildSponsorshipStaffNotificationEmail(sponsorship, reference)
  await Promise.all([
    shouldSendDonor
      ? sendEmailFn({ to: sponsorship.donor_email, ...donorEmail, sponsorshipId: sponsorship.id, template: 'donor_confirmation_with_attachments' })
      : null,
    shouldSendStaff
      ? sendEmailFn({ to: process.env.NOTIFICATION_EMAIL || 'info@neileich.org', ...staffEmail, sponsorshipId: sponsorship.id, template: 'staff_notification' })
      : null,
  ].filter(Boolean))
  return true
}

export async function finalizeDonationPayment({ donationId, reference, sql = db(), sendEmailFn = sendEmail }) {
  const rows = await sql`select * from donations where id = ${donationId}::uuid limit 1`
  const donation = rows[0]
  if (!donation) throw new Error(`No donation found for Sola reference ${reference}`)
  if (donation.status === 'confirmed' && donation.payment_status === 'paid') {
    if (donation.payment_reference && reference && donation.payment_reference !== reference) {
      console.error('Approved Sola reference does not match already paid donation', { donationId: donation.id, existingReference: donation.payment_reference, receivedReference: reference })
      return { finalized: false, emailed: false, donation }
    }
    const emailed = await sendDonationConfirmationMessages({ donation, reference: donation.payment_reference || reference, sql, sendEmailFn, checkExisting: true })
    return { finalized: false, emailed, donation }
  }

  const updated = await sql`update donations set payment_provider = 'sola', payment_status = 'paid', payment_reference = ${reference}, status = 'confirmed', updated_at = now() where id = ${donation.id}::uuid and status = 'pending_payment' returning *`
  const finalizedDonation = updated[0]
  if (!finalizedDonation) return { finalized: false, emailed: false, donation }

  try {
    await sql`insert into payment_events(provider_event_id, donation_id, event_type) values (${`sola:${reference}`}, ${finalizedDonation.id}::uuid, 'sola.donation.approved') on conflict (provider_event_id) do nothing`
  } catch (error) {
    console.error('Donation payment event logging failed', error)
  }
  await sendDonationConfirmationMessages({ donation: finalizedDonation, reference, sql, sendEmailFn })
  return { finalized: true, emailed: true, donation: finalizedDonation }
}

export async function finalizeSponsorshipPayment({ sponsorshipId, reference, sql = db(), sendEmailFn = sendEmail }) {
  let rows = await sql`select s.*, t.name as sponsorship_name from sponsorships s join sponsorship_types t on t.id = s.sponsorship_type_id where s.id = ${sponsorshipId}::uuid limit 1`
  let sponsorship = rows[0]
  if (!sponsorship) throw new Error(`No sponsorship found for Sola reference ${reference}`)
  if (sponsorship.payment_status === 'paid' && sponsorship.payment_reference && reference && sponsorship.payment_reference !== reference) {
    console.error('Approved Sola reference does not match already paid sponsorship', { sponsorshipId: sponsorship.id, existingReference: sponsorship.payment_reference, receivedReference: reference })
    return { finalized: false, emailed: false, sponsorship }
  }

  if (sponsorship.status !== 'confirmed' || sponsorship.payment_status !== 'paid' || sponsorship.payment_reference !== reference) {
    await sql`update sponsorships set payment_provider = 'sola', payment_status = 'paid', payment_reference = ${reference}, status = 'confirmed', reservation_expires_at = null, updated_at = now() where id = ${sponsorship.id}::uuid and (payment_reference is null or payment_reference = ${reference}) and (status <> 'confirmed' or payment_status <> 'paid' or payment_reference is distinct from ${reference}) returning id`
    try {
      await sql`insert into audit_events(sponsorship_id, actor, action) values (${sponsorship.id}::uuid, 'payment_gateway', 'payment_confirmed')`
    } catch (error) {
      console.error('Sponsorship audit logging failed', error)
    }
    rows = await sql`select s.*, t.name as sponsorship_name from sponsorships s join sponsorship_types t on t.id = s.sponsorship_type_id where s.id = ${sponsorship.id}::uuid limit 1`
    sponsorship = rows[0] || sponsorship
  }

  let shouldCheckExistingEmail = true
  try {
    const event = await sql`insert into payment_events(provider_event_id, sponsorship_id, event_type) values (${`sola:${reference}`}, ${sponsorship.id}::uuid, 'sola.sale.approved') on conflict (provider_event_id) do nothing returning id`
    shouldCheckExistingEmail = !event.length
  } catch (error) {
    console.error('Sponsorship payment event logging failed', error)
  }

  if (sponsorship.recurring) {
    try {
      const original = new Date(`${dateOnly(sponsorship.gregorian_date)}T12:00:00.000Z`)
      let year = new HDate().getFullYear() + 1
      let next = yahrzeit(year, original)
      while (next && next.greg() <= new Date()) next = yahrzeit(++year, original)
      if (next) await sql`insert into recurrence_rules (sponsorship_id, hebrew_month, hebrew_day, next_occurrence) values (${sponsorship.id}::uuid, ${sponsorship.hebrew_month}, ${sponsorship.hebrew_day}, ${next.greg().toISOString().slice(0, 10)}::date) on conflict (sponsorship_id) do nothing`
    } catch (error) {
      console.error('Sponsorship recurrence setup failed', error)
    }
  }

  const emailed = await sendSponsorshipConfirmationMessages({ sponsorship, reference, sql, sendEmailFn, checkExisting: shouldCheckExistingEmail })
  return { finalized: true, emailed, sponsorship }
}
