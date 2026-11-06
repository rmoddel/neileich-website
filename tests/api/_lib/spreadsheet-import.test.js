import test from 'node:test'
import assert from 'node:assert/strict'
import { detectMapping, findHeaderRow, mappedRows, mappingErrors, rowErrors } from '../../../src/pages/atcSpreadsheet.js'
import { importSpreadsheet } from '../../../server/api/_lib/newsletter-db.js'
import bulkHandler from '../../../server/api/newsletter/bulk-import.js'

test('maps an Excel-style sheet with 20 ads across Neon categories without writing', () => {
  const headers = ['Section', 'Announcement', 'Title', 'Contact', 'Price', 'Event Date', 'Notes']
  const mapping = detectMapping(headers)
  assert.equal(findHeaderRow([['Around the Commons advertisements'], headers, ['Events', 'Body']]), 1)
  assert.deepEqual(mappingErrors(mapping), [])
  const categories = ['Mazel Tov', 'Community Updates', 'Events & Shiurim', 'Classifieds & Services']
  const source = Array.from({ length: 20 }, (_, i) => [i % 2 ? 'Classifieds' : 'Events', `Original wording ${i + 1}`, `Ad ${i + 1}`, '555-0100', '$10', '', 'Review spelling'])
  const rows = mappedRows(source, mapping, categories)
  assert.equal(rows.length, 20)
  assert.equal(rows[0].category, 'Events & Shiurim')
  assert.equal(rows[1].category, 'Classifieds & Services')
  assert.equal(rows[0].original_text, 'Original wording 1')
  assert.equal(rows[0].review_status, 'NEEDS_REVIEW')
  assert.equal(rows.flatMap(row => rowErrors(row, categories)).length, 0)
})

test('missing mandatory columns and unknown categories require correction', () => {
  assert.match(mappingErrors(detectMapping(['Contact', 'Notes'])).join(' '), /Category.*wording/)
  assert.equal(detectMapping(['Category', 'Title']).body, 1)
  const [row] = mappedRows([['Unknown section', 'Text']], { category: 0, body: 1 }, ['Mazel Tov'])
  assert.match(rowErrors(row, ['Mazel Tov']).join(' '), /Unknown category/)
  row.category = 'Mazel Tov'
  assert.deepEqual(rowErrors(row, ['Mazel Tov']), [])
})

test('bulk service sends one transactional call with original wording', async () => {
  const entries = [{ category: 'Mazel Tov', body: 'Edited text', original_text: 'Original text', review_status: 'READY' }]
  let calls = 0
  const sql = (parts, ...values) => { calls++; assert.match(parts.join('?'), /import_newsletter_bulk/); assert.equal(JSON.parse(values[2])[0].original_text, 'Original text'); return [{ result: { week: '2026-11-06', imported: 1, alreadyImported: 0, failed: 0 } }] }
  const result = await importSpreadsheet('2026-11-06', '11111111-1111-4111-8111-111111111111', entries, sql)
  assert.equal(calls, 1)
  assert.equal(result.imported, 1)
  await assert.rejects(() => importSpreadsheet('2026-11-06', 'bad', entries, sql), /Invalid bulk import/)
})

test('bulk endpoint rejects anonymous requests', async () => {
  const res = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value }, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this }, end() { return this } }
  await bulkHandler({ method: 'POST', headers: {}, body: {} }, res)
  assert.equal(res.statusCode, 401)
})
