import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_EMAIL_FROM, buildDonationConfirmationEmail, buildSponsorshipConfirmationEmail, finalizeDonationPayment, finalizeSponsorshipPayment, notificationRecipients, resolveEmailFrom, senderDomain } from '../../../api/_lib/parnas.js'

const pendingDonation = {
  id: '11111111-1111-4111-8111-111111111111',
  receipt_token: '22222222-2222-4222-8222-222222222222',
  donor_name: 'Test Donor',
  donor_email: 'test@example.com',
  donor_phone: '732-555-0100',
  amount_cents: 18000,
  currency: 'usd',
  payment_provider: null,
  payment_status: 'pending',
  payment_reference: null,
  status: 'pending_payment',
  created_at: '2026-09-07T16:00:00.000Z',
}

const pendingSponsorship = {
  id: '55555555-5555-4555-8555-555555555555',
  donor_name: 'Sponsor Donor',
  donor_email: 'sponsor@example.com',
  donor_phone: '732-555-0123',
  dedication_type: 'לעילוי נשמת / In memory of',
  dedication_text: 'Our Dear Parents',
  anonymous: false,
  gregorian_date: '2026-09-08',
  hebrew_year: 5786,
  hebrew_month: 13,
  hebrew_day: 25,
  amount_cents: 18000,
  currency: 'usd',
  payment_provider: null,
  payment_status: 'pending',
  payment_reference: null,
  status: 'reserved_pending_payment',
  recurring: false,
  sponsorship_name: 'Sponsor a Day',
}

function makeSql({ donation = pendingDonation, updateRows = null, emailRows = [] } = {}) {
  const queries = []
  const sql = async (strings, ...values) => {
    const text = strings.join('?')
    queries.push({ text, values })
    if (text.includes('select * from donations')) return [donation]
    if (text.includes('update donations set payment_provider')) {
      return updateRows ?? [{ ...donation, payment_provider: 'sola', payment_status: 'paid', payment_reference: values[0], status: 'confirmed' }]
    }
    if (text.includes('insert into payment_events')) return [{ id: 'event-1' }]
    if (text.includes('select template from email_events')) return emailRows
    throw new Error(`Unexpected SQL in test: ${text}`)
  }
  return { sql, queries }
}

function makeSponsorshipSql({
  sponsorship = pendingSponsorship,
  finalizedSponsorship = { ...pendingSponsorship, payment_provider: 'sola', payment_status: 'paid', payment_reference: 'TEST-SPONSOR-REF', status: 'confirmed' },
  emailRows = [],
  eventRows = [{ id: 'event-2' }],
} = {}) {
  const queries = []
  let selectCount = 0
  const sql = async (strings, ...values) => {
    const text = strings.join('?')
    queries.push({ text, values })
    if (text.includes('select s.*, t.name as sponsorship_name')) return [selectCount++ === 0 ? sponsorship : finalizedSponsorship]
    if (text.includes('update sponsorships set payment_provider')) return [{ id: sponsorship.id }]
    if (text.includes('insert into audit_events')) return []
    if (text.includes('insert into payment_events')) return eventRows
    if (text.includes('select template from email_events')) return emailRows
    throw new Error(`Unexpected SQL in sponsorship test: ${text}`)
  }
  return { sql, queries }
}

function assertPdfAttachment(attachment, filenamePattern) {
  assert.match(attachment.filename, filenamePattern)
  assert.equal(attachment.contentType, 'application/pdf')
  assert.equal(Buffer.from(attachment.content, 'base64').slice(0, 4).toString(), '%PDF')
}

test('buildDonationConfirmationEmail includes receipt and plaque attachments', () => {
  const email = buildDonationConfirmationEmail({ ...pendingDonation, payment_status: 'paid', status: 'confirmed' }, 'TEST-REF-123')

  assert.equal(email.subject, 'Thank you for your Neileich donation')
  assert.match(email.text, /Thank you, Test Donor/)
  assert.match(email.text, /Your PDF receipt and donation plaque are attached/)
  assert.equal(email.attachments.length, 2)
  assertPdfAttachment(email.attachments[0], /neileich-donation-receipt-.*\.pdf/)
  assertPdfAttachment(email.attachments[1], /neileich-donation-plaque-.*\.pdf/)
})

test('resolveEmailFrom keeps a neileich.org sender', () => {
  const original = process.env.EMAIL_FROM
  try {
    process.env.EMAIL_FROM = 'Neileich Receipts <info@neileich.org>'
    assert.equal(resolveEmailFrom(), 'Neileich Receipts <info@neileich.org>')
    assert.equal(senderDomain(process.env.EMAIL_FROM), 'neileich.org')
  } finally {
    if (original === undefined) delete process.env.EMAIL_FROM
    else process.env.EMAIL_FROM = original
  }
})

test('resolveEmailFrom falls back when EMAIL_FROM uses another domain', () => {
  const original = process.env.EMAIL_FROM
  const originalWarn = console.warn
  try {
    console.warn = () => {}
    process.env.EMAIL_FROM = 'Old Sender <receipts@example.com>'
    assert.equal(resolveEmailFrom(), DEFAULT_EMAIL_FROM)
  } finally {
    console.warn = originalWarn
    if (original === undefined) delete process.env.EMAIL_FROM
    else process.env.EMAIL_FROM = original
  }
})

test('notificationRecipients supports one or more admin addresses', () => {
  const original = process.env.NOTIFICATION_EMAIL
  try {
    process.env.NOTIFICATION_EMAIL = 'one@example.com, two@example.com'
    assert.deepEqual(notificationRecipients(), ['one@example.com', 'two@example.com'])
    process.env.NOTIFICATION_EMAIL = 'one@example.com'
    assert.equal(notificationRecipients(), 'one@example.com')
  } finally {
    if (original === undefined) delete process.env.NOTIFICATION_EMAIL
    else process.env.NOTIFICATION_EMAIL = original
  }
})

test('finalizeDonationPayment marks the donation paid and emails donor attachments once', async () => {
  const sent = []
  const { sql, queries } = makeSql()

  const result = await finalizeDonationPayment({
    donationId: pendingDonation.id,
    reference: 'TEST-REF-123',
    sql,
    sendEmailFn: async (message) => sent.push(message),
  })

  assert.equal(result.finalized, true)
  assert.equal(result.donation.status, 'confirmed')
  assert.equal(sent.length, 2)

  const donorEmail = sent.find((message) => message.template === 'donor_donation_confirmation')
  assert.equal(donorEmail.to, pendingDonation.donor_email)
  assert.equal(donorEmail.attachments.length, 2)
  assert.match(donorEmail.text, /PDF receipt and donation plaque are attached/)

  const staffEmail = sent.find((message) => message.template === 'staff_donation_notification')
  assert.deepEqual(staffEmail.to, notificationRecipients())
  assert.match(staffEmail.text, /A new paid donation was received/)
  assert.equal(queries.some((query) => query.text.includes("status = 'confirmed'")), true)
})

test('finalizeDonationPayment does not resend email for an already confirmed donation with sent emails', async () => {
  const confirmedDonation = { ...pendingDonation, payment_status: 'paid', payment_reference: 'TEST-REF-123', status: 'confirmed' }
  const { sql, queries } = makeSql({
    donation: confirmedDonation,
    emailRows: [{ template: 'donor_donation_confirmation' }, { template: 'staff_donation_notification' }],
  })
  const sent = []

  const result = await finalizeDonationPayment({
    donationId: confirmedDonation.id,
    reference: 'TEST-REF-123',
    sql,
    sendEmailFn: async (message) => sent.push(message),
  })

  assert.equal(result.finalized, false)
  assert.equal(sent.length, 0)
  assert.equal(queries.some((query) => query.text.includes('update donations set payment_provider')), false)
})

test('buildSponsorshipConfirmationEmail includes receipt and plaque attachments', () => {
  const email = buildSponsorshipConfirmationEmail({ ...pendingSponsorship, payment_status: 'paid', status: 'confirmed' }, 'TEST-SPONSOR-REF')

  assert.equal(email.subject, 'Your Neileich sponsorship is confirmed')
  assert.match(email.text, /Your PDF receipt and dedication plaque are attached/)
  assert.equal(email.attachments.length, 2)
  assertPdfAttachment(email.attachments[0], /neileich-sponsorship-receipt-.*\.pdf/)
  assertPdfAttachment(email.attachments[1], /neileich-sponsorship-plaque-.*\.pdf/)
})

test('finalizeSponsorshipPayment marks paid and emails donor receipt attachments', async () => {
  const sent = []
  const { sql, queries } = makeSponsorshipSql()

  const result = await finalizeSponsorshipPayment({
    sponsorshipId: pendingSponsorship.id,
    reference: 'TEST-SPONSOR-REF',
    sql,
    sendEmailFn: async (message) => sent.push(message),
  })

  assert.equal(result.finalized, true)
  assert.equal(result.emailed, true)
  assert.equal(sent.length, 2)

  const donorEmail = sent.find((message) => message.template === 'donor_confirmation_with_attachments')
  assert.equal(donorEmail.to, pendingSponsorship.donor_email)
  assert.equal(donorEmail.attachments.length, 2)
  assertPdfAttachment(donorEmail.attachments[0], /neileich-sponsorship-receipt-.*\.pdf/)
  assertPdfAttachment(donorEmail.attachments[1], /neileich-sponsorship-plaque-.*\.pdf/)

  const staffEmail = sent.find((message) => message.template === 'staff_notification')
  assert.deepEqual(staffEmail.to, notificationRecipients())
  assert.match(staffEmail.text, /A new paid sponsorship was received/)
  assert.equal(queries.some((query) => query.text.includes('update sponsorships set payment_provider')), true)
})
