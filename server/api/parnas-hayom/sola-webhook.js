import crypto from 'node:crypto'
import { db, finalizeDonationPayment, finalizeSponsorshipPayment } from '../_lib/parnas.js'

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
    const donationId = data.xCustom01?.startsWith('donation:') ? data.xCustom01.slice('donation:'.length) : null
    if (donationId) {
      await finalizeDonationPayment({ donationId, reference, sql })
      return res.status(200).json({ received: true })
    }
    const rows = await sql`select s.id from sponsorships s where s.payment_reference = ${reference} or s.id::text = ${data.xCustom01 || ''} limit 1`
    const s = rows[0]
    if (!s) throw new Error(`No sponsorship found for Sola reference ${reference}`)
    await finalizeSponsorshipPayment({ sponsorshipId: s.id, reference, sql })
    return res.status(200).json({ received: true })
  } catch (error) { console.error('Sola webhook error', error); return res.status(500).send('Webhook processing failed') }
}
