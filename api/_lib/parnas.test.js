import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDonationConfirmationEmail, finalizeDonationPayment } from './parnas.js'

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

function makeSql({ donation = pendingDonation, updateRows = null } = {}) {
  const queries = []
  const sql = async (strings, ...values) => {
    const text = strings.join('?')
    queries.push({ text, values })
    if (text.includes('select * from donations')) return [donation]
    if (text.includes('update donations set payment_provider')) {
      return updateRows ?? [{ ...donation, payment_provider: 'sola', payment_status: 'paid', payment_reference: values[0], status: 'confirmed' }]
    }
    if (text.includes('insert into payment_events')) return [{ id: 'event-1' }]
    throw new Error(`Unexpected SQL in test: ${text}`)
  }
  return { sql, queries }
}

test('buildDonationConfirmationEmail includes receipt and plaque attachments', () => {
  const email = buildDonationConfirmationEmail({ ...pendingDonation, payment_status: 'paid', status: 'confirmed' }, 'TEST-REF-123')

  assert.equal(email.subject, 'Thank you for your Neileich donation')
  assert.match(email.text, /Thank you, Test Donor/)
  assert.match(email.text, /Your receipt and donation plaque are attached/)
  assert.equal(email.attachments.length, 2)
  assert.equal(email.attachments[0].contentType, 'text/plain')
  assert.match(email.attachments[0].content, /Neileich Donation Receipt/)
  assert.match(email.attachments[0].content, /Payment reference: TEST-REF-123/)
  assert.equal(email.attachments[1].contentType, 'image/svg+xml')
  assert.match(email.attachments[1].content, /Thank you for your donation/)
  assert.match(email.attachments[1].content, /Test Donor/)
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
  assert.match(donorEmail.text, /receipt and donation plaque are attached/)

  const staffEmail = sent.find((message) => message.template === 'staff_donation_notification')
  assert.equal(staffEmail.to, process.env.NOTIFICATION_EMAIL || 'info@neileich.org')
  assert.match(staffEmail.text, /A new paid donation was received/)
  assert.equal(queries.some((query) => query.text.includes("status = 'confirmed'")), true)
})

test('finalizeDonationPayment does not resend email for an already confirmed donation', async () => {
  const confirmedDonation = { ...pendingDonation, payment_status: 'paid', payment_reference: 'TEST-REF-123', status: 'confirmed' }
  const { sql, queries } = makeSql({ donation: confirmedDonation })
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
