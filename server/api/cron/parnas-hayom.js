import { db } from '../_lib/parnas.js'

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).end()
  try {
    const sql = db()
    await sql`update sponsorships set status = 'expired', payment_status = 'failed', updated_at = now() where status = 'reserved_pending_payment' and reservation_expires_at <= now()`
    // Reminder creation is intentionally server-side. A future deployment should calculate Hebrew occurrences
    // with @hebcal/core and send a hosted payment link when next_occurrence reaches the reminder window.
    return res.status(200).json({ ok: true })
  } catch (error) { console.error('Parnas Hayom cron failed', error); return res.status(500).json({ ok: false }) }
}
