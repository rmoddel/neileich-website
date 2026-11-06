import test from 'node:test'
import assert from 'node:assert/strict'
import { deleteAnnouncement, deleteTestAnnouncements } from '../../../server/api/_lib/newsletter-db.js'
import handler from '../../../server/api/newsletter/announcement.js'

const week = '2026-11-06'
const id = '11111111-1111-4111-8111-111111111111'
function response() { return { statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this }, setHeader() { return this }, end() { return this } } }

test('anonymous callers cannot delete announcements', async () => {
  const res = response()
  await handler({ method: 'DELETE', headers: {}, body: { mode: 'single', week, id } }, res)
  assert.equal(res.statusCode, 401)
})

test('single delete and explicit test cleanup call separate locked Neon functions', async () => {
  const queries = []
  const sql = (parts, ...values) => { queries.push({ sql: parts.join('?'), values }); return [{ count: 1 }] }
  assert.equal(await deleteAnnouncement(week, id, 'editor', sql), 1)
  assert.match(queries[0].sql, /delete_newsletter_announcement/)
  assert.equal(queries[0].values[1], id)
  assert.equal(await deleteTestAnnouncements(week, 3, 'editor', sql), 1)
  assert.match(queries[1].sql, /delete_newsletter_test_announcements/)
  assert.equal(queries[1].values[2], 3)
  await assert.rejects(() => deleteTestAnnouncements(week, 0, 'editor', sql), /Invalid test cleanup request/)
  await assert.rejects(() => deleteAnnouncement(week, 'bad-id', 'editor', sql), /Invalid announcement/)
})
