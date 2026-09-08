import test from 'node:test'
import assert from 'node:assert/strict'
import { createApprovedDonationCheckout } from './checkout.js'

const donation = {
  id: '33333333-3333-4333-8333-333333333333',
  receipt_token: '44444444-4444-4444-8444-444444444444',
}

const checkoutData = {
  amount: '180',
  donorName: 'Test Donor',
  donorEmail: 'test@example.com',
  donorPhone: '732-555-0100',
  cardToken: 'ifields-card-token',
  cvvToken: 'ifields-cvv-token',
  cardExpiry: '1230',
}

function makeSql() {
  const queries = []
  const sql = async (strings, ...values) => {
    const text = strings.join('?')
    queries.push({ text, values })
    if (text.includes('create_pending_donation')) return [donation]
    if (text.includes('update donations set payment_provider')) return []
    if (text.includes("status = 'failed'")) return []
    throw new Error(`Unexpected SQL in test: ${text}`)
  }
  return { sql, queries }
}

test('createApprovedDonationCheckout uses a mocked gateway and returns redirect receipt tokens', async () => {
  const previousKey = process.env.SOLA_API_KEY
  process.env.SOLA_API_KEY = 'test_sola_key'
  const { sql } = makeSql()
  const gatewayCalls = []
  const finalized = []

  try {
    const payload = await createApprovedDonationCheckout({
      data: checkoutData,
      sql,
      gatewayFetch: async (url, options) => {
        gatewayCalls.push({ url, body: JSON.parse(options.body) })
        return { ok: true, json: async () => ({ xResult: 'A', xRefNum: 'TEST-REF-123' }) }
      },
      finalizeDonationPaymentFn: async (args) => finalized.push(args),
    })

    assert.deepEqual(payload, { pending: true, donationId: donation.id, receiptToken: donation.receipt_token, paymentReference: 'TEST-REF-123' })
    assert.equal(gatewayCalls.length, 1)
    assert.equal(gatewayCalls[0].url, 'https://x1.cardknox.com/gatewayjson')
    assert.equal(gatewayCalls[0].body.xAmount, '180.00')
    assert.equal(gatewayCalls[0].body.xCustom01, `donation:${donation.id}`)
    assert.equal(finalized.length, 1)
    assert.equal(finalized[0].donationId, donation.id)
    assert.equal(finalized[0].reference, 'TEST-REF-123')
  } finally {
    if (previousKey === undefined) delete process.env.SOLA_API_KEY
    else process.env.SOLA_API_KEY = previousKey
  }
})
