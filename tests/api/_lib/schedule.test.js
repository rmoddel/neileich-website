import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchScheduleWeek, mapScheduleWeek, SHUL_SCHEDULE_URL } from '../../../server/api/_lib/newsletter-schedule.js'

const schedule = { schemaVersion: 1, timeZone: 'America/New_York', generatedAt: '2026-11-06T01:22:57Z', days: [
  { date: '2026-11-06', weekday: 'Friday', status: 'available', parsha: 'חיי שרה', events: [
    { name: 'מנחה ערב שבת', category: 'mincha', displayTime: '12:30 PM' },
    { name: 'הדלקת נרות', category: 'other', displayTime: '4:30 PM' },
    { name: 'מנחה מעריב', category: 'mincha', displayTime: '4:33 PM' },
    { name: 'שקיעה', category: 'other', displayTime: '4:48 PM' },
    { name: 'מעריב', category: 'maariv', displayTime: '5:38 PM' },
  ] },
  { date: '2026-11-07', weekday: 'Shabbos', status: 'available', parsha: 'חיי שרה', events: [
    { name: 'שחרית', category: 'shacharis', displayTime: '7:30 AM' },
    { name: 'שחרית', category: 'shacharis', displayTime: '8:15 AM' },
    { name: 'ס"ז קר"ש', category: 'other', reckoning: 'מ״א', displayTime: '8:31 AM' },
    { name: 'ס"ז קר"ש', category: 'other', reckoning: 'גר״א', displayTime: '9:07 AM' },
    { name: 'מנחה', category: 'mincha', displayTime: '1:20 PM' },
    { name: 'מעריב', category: 'maariv', displayTime: '5:48 PM' },
    { name: 'מעריב', category: 'maariv', displayTime: '6:00 PM' },
  ] },
] }

test('official dated schedule maps Chayei Sara without inventing Havdalah', () => {
  const row = mapScheduleWeek(schedule, '2026-11-06')
  assert.equal(row.parsha_he, 'חיי שרה')
  assert.equal(row.parsha_en, 'Chayei Sara')
  assert.equal(row.candle_lighting, '4:30 PM')
  assert.equal(row.friday_sunset, '4:48 PM')
  assert.equal(row.shacharis, '7:30 AM / 8:15 AM')
  assert.equal(row.sof_zman_shema_mga, '8:31 AM')
  assert.equal(row.sof_zman_shema_gra, '9:07 AM')
  assert.equal(row.motzai_maariv, '5:48 PM / 6:00 PM')
  assert.equal(row.shabbos_ends, '')
  assert.equal(row.verification_status, 'NEEDS_REVIEW')
  assert.equal(row.original_values.friday.date, '2026-11-06')
  assert.equal(mapScheduleWeek(schedule, '2026-11-13'), null)
})

test('official feed is requested server-side for the selected Friday', async () => {
  const result = await fetchScheduleWeek('2026-11-06', async url => {
    assert.equal(url, SHUL_SCHEDULE_URL)
    return { ok: true, json: async () => schedule }
  })
  assert.equal(result.issue_week, '2026-11-06')
})
