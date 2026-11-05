import { db, badRequest } from '../_lib/parnas.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return badRequest(res, 'Method not allowed', 405)
  try {
    const rows = await db()`select id, name, description, price_cents, max_per_date, recurring_enabled from sponsorship_types where active = true order by display_order, name`
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return res.status(200).json({ types: rows })
  } catch (error) { console.error(error); return badRequest(res, 'Sponsorship options are temporarily unavailable.', 503) }
}
