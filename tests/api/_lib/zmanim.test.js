import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { extractEmbeddedChart, interpretChart, normalizeExtraction, uploadChart, validateReviewedRecords } from '../../../server/api/_lib/newsletter-zmanim.js'
import uploadHandler from '../../../server/api/newsletter/zmanim/upload.js'
import importHandler from '../../../server/api/newsletter/zmanim/import.js'
import confirmHandler from '../../../server/api/newsletter/zmanim/confirm.js'
import sourceHandler from '../../../server/api/newsletter/zmanim/source.js'

const chart = '/Users/rmoddel/Desktop/Zmanim Chart · Bais Medrash of Lakewood Commons.pdf'
const chartAvailable = await access(chart).then(() => true, () => false)

test('the supplied official PDF has ten rows and preserves Chayei Sara times', { skip: !chartAvailable && 'The private chart is not on this computer' }, async () => {
  const embedded = await extractEmbeddedChart(await readFile(chart))
  assert.equal(embedded.tableRows.length, 10)
  const chayei = embedded.tableRows.find(row => row.parsha_he === 'חיי שרה')
  assert.deepEqual({ candle: chayei.candle_lighting, sunset: chayei.friday_sunset, shacharis: chayei.shacharis, shema: chayei.sof_zman_shema, motzai: chayei.motzai_maariv }, {
    candle: '4:30', sunset: '4:48', shacharis: '7:30 / 8:15', shema: '8:31 / 9:07', motzai: '5:48 / 6:00',
  })
  assert.doesNotMatch(embedded.embeddedText, /\b2026\b/)
})

test('Gemini response is treated as unverified and dates need a printed calendar anchor', async () => {
  const result = await interpretChart(Buffer.from('%PDF-fake'), { embeddedText: 'חיי שרה 4:30', tableRows: [] }, 'test-key', async (_url, options) => {
    const body = JSON.parse(options.body)
    assert.equal(body.contents[0].parts[1].inline_data.mime_type, 'application/pdf')
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ records: [{ issue_week: '2026-11-06', friday_date: '2026-11-06', parsha_he: 'פרשת חיי שרה', candle_lighting: '4:30 PM', friday_sunset: '4:48 PM', shacharis: '7:30 / 8:15 AM', sof_zman_shema_mga: '8:31 AM', sof_zman_shema_gra: '9:07 AM', motzai_maariv: '5:48 / 6:00 PM', shabbos_ends: '5:48 PM' }] }) }] } }] }) }
  })
  assert.equal(result.records[0].issue_week, '')
  assert.equal(result.records[0].shabbos_ends, '')
  assert.equal(result.records[0].motzai_maariv, '5:48 / 6:00 PM')
  assert.ok(result.records[0].warnings.length)
  assert.equal(result.rawModelRecords[0].issue_week, '2026-11-06')
})

test('review requires explicit confirmation, correct Friday, and all essential times', () => {
  const [record] = normalizeExtraction({ records: [{ issue_week: '', parsha_he: 'חיי שרה', candle_lighting: '4:30 PM', friday_sunset: '4:48 PM', shacharis: '7:30 / 8:15 AM', sof_zman_shema_mga: '8:31 AM', sof_zman_shema_gra: '9:07 AM', motzai_maariv: '5:48 / 6:00 PM' }] })
  assert.throws(() => validateReviewedRecords([record], 1), /Review and confirm/)
  assert.throws(() => validateReviewedRecords([{ ...record, reviewed: true, issue_week: '2026-11-07', friday_date: '2026-11-07' }], 1), /correct Friday/)
  const saved = validateReviewedRecords([{ ...record, reviewed: true, issue_week: '2026-11-06', friday_date: '2026-11-06' }], 1)
  assert.equal(saved[0].parsha_he, 'חיי שרה')
  assert.equal(saved[0].shabbos_ends, '')
})

test('upload stores the PDF privately, retains its original values, and deduplicates by SHA-256', { skip: !chartAvailable && 'The private chart is not on this computer' }, async t => {
  const previous = process.env.BLOB_READ_WRITE_TOKEN
  process.env.BLOB_READ_WRITE_TOKEN = 'test-only-token'
  t.after(() => { if (previous === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = previous })
  let entry, stores = 0
  const sql = (strings, ...values) => {
    const query = strings.join('?').trim()
    if (query.startsWith('select id::text as id,status')) return entry ? [{ id: entry.id, status: entry.status }] : []
    if (query.startsWith('insert into newsletter_zmanim_imports')) {
      entry = { id: '33333333-3333-4333-8333-333333333333', filename: values[1], byte_size: values[2], status: 'PROCESSING', extracted_records: [], warnings: [], error: '', uploaded_by: values[3] }
      return [{ id: entry.id }]
    }
    if (query.startsWith('update newsletter_zmanim_imports set blob_path')) { entry.blob_path = values[0]; return [] }
    if (query.startsWith("update newsletter_zmanim_imports set status='READY_FOR_REVIEW'")) { entry.status = 'READY_FOR_REVIEW'; entry.extracted_records = JSON.parse(values[3]); entry.raw_model_records = JSON.parse(values[2]); return [] }
    if (query.startsWith('select id::text as id,filename')) return [entry]
    throw new Error(`Unexpected SQL: ${query}`)
  }
  const bytes = await readFile(chart)
  const args = { filename: 'official-chart.pdf', base64: bytes.toString('base64'), actor: 'editor' }
  const first = await uploadChart(args, { sql, store: async (_path, content, options) => { stores++; assert.equal(options.access, 'private'); assert.deepEqual(content, bytes); return { pathname: 'atc-zmanim/private.pdf' } }, interpret: async (_pdf, extracted) => {
    assert.equal(extracted.tableRows.length, 10)
    return { records: normalizeExtraction({ records: [{ parsha_he: 'חיי שרה', candle_lighting: '4:30 PM', friday_sunset: '4:48 PM', shacharis: '7:30 / 8:15 AM', sof_zman_shema_mga: '8:31 AM', sof_zman_shema_gra: '9:07 AM', motzai_maariv: '5:48 / 6:00 PM' }] }), rawModelRecords: [{ parsha_he: 'חיי שרה' }] }
  } })
  assert.equal(first.import.status, 'READY_FOR_REVIEW')
  assert.equal(first.import.extracted_records[0].issue_week, '')
  assert.equal(entry.raw_model_records[0].parsha_he, 'חיי שרה')
  const duplicate = await uploadChart(args, { sql, store: () => { throw new Error('Duplicate stored again') } })
  assert.equal(duplicate.duplicate, true)
  assert.equal(stores, 1)
})

test('all chart APIs reject unauthenticated requests', async () => {
  for (const [handler, method] of [[uploadHandler, 'POST'], [importHandler, 'GET'], [confirmHandler, 'POST'], [sourceHandler, 'GET']]) {
    const res = { statusCode: 200, setHeader() { return this }, status(code) { this.statusCode = code; return this }, json() { return this }, end() { return this } }
    await handler({ method, headers: {}, query: {}, body: {} }, res)
    assert.equal(res.statusCode, 401)
  }
})
