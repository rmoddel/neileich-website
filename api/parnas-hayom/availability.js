import { db, badRequest } from '../_lib/parnas.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return badRequest(res, 'Method not allowed', 405)
  const { sponsorshipTypeId, start, end } = req.query
  if (!sponsorshipTypeId || !/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(end || '')) return badRequest(res, 'Invalid calendar request.')
  try {
    const rows = await db()`
      select d::text as date, (
        not exists (select 1 from blocked_dates b where b.date = d and (b.sponsorship_type_id is null or b.sponsorship_type_id = ${sponsorshipTypeId}::uuid))
        and (select count(*) from sponsorships s where s.sponsorship_type_id = ${sponsorshipTypeId}::uuid and s.gregorian_date = d and (s.status = 'confirmed' or (s.status = 'reserved_pending_payment' and s.reservation_expires_at > now())))
          < (select max_per_date from sponsorship_types where id = ${sponsorshipTypeId}::uuid and active = true)
      ) as available
      from generate_series(${start}::date, ${end}::date, interval '1 day') d
    `
    return res.status(200).json({ days: rows })
  } catch (error) { console.error(error); return badRequest(res, 'Calendar is temporarily unavailable.', 503) }
}
