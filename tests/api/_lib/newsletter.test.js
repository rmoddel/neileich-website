import test from 'node:test'
import assert from 'node:assert/strict'
import { getCurrentIssueWeek, validIssueWeek } from '../../../api/_lib/newsletter-config.js'
import { authenticate, requireOrigin, revokeSession, session, verifyCredentials } from '../../../api/_lib/newsletter-auth.js'
import bcrypt from 'bcryptjs'
import { approveIssue, getIssue, ingestSubmission, saveDraft, validateApproval } from '../../../api/_lib/newsletter-db.js'
import issueHandler from '../../../api/newsletter/issue.js'
import draftHandler from '../../../api/newsletter/draft.js'
import approveHandler from '../../../api/newsletter/approve.js'

function response() {
  return { statusCode: 200, headers: {}, setHeader(name, value) { this.headers[name] = value; return this }, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this }, end() { return this } }
}

test('Friday identifier uses New York boundaries', () => {
  assert.equal(getCurrentIssueWeek(new Date('2026-11-05T23:00:00Z')), '2026-11-06')
  assert.equal(getCurrentIssueWeek(new Date('2026-11-06T04:30:00Z')), '2026-11-06')
  assert.equal(getCurrentIssueWeek(new Date('2026-11-07T05:30:00Z')), '2026-11-13')
  assert.equal(getCurrentIssueWeek(new Date('2026-03-08T06:30:00Z')), '2026-03-13')
  assert.equal(validIssueWeek('2026-11-06'), true)
  assert.equal(validIssueWeek('2026-11-07'), false)
  assert.equal(validIssueWeek('2026-02-30'), false)
})

test('bcrypt credentials, rate limit, session persistence, and logout', async t => {
  const names = ['ATC_AUTH_USERNAME', 'ATC_AUTH_PASSWORD_HASH', 'ATC_AUTH_SESSION_SECRET', 'ATC_LOCAL_DEV']
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]))
  t.after(() => { for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name] } })
  process.env.ATC_AUTH_USERNAME = 'editor'
  process.env.ATC_AUTH_PASSWORD_HASH = await bcrypt.hash('correct horse', 12)
  process.env.ATC_AUTH_SESSION_SECRET = 'a'.repeat(48)
  process.env.ATC_LOCAL_DEV = '1'
  assert.equal(await verifyCredentials('editor', 'correct horse'), true)
  assert.equal(await verifyCredentials('other', 'correct horse'), false)
  assert.equal(await verifyCredentials('editor', 'wrong'), false)
  const attempts = new Map(), sessions = new Set()
  const sql = (strings, ...values) => {
    const query = strings.join('?')
    if (query.startsWith('insert into newsletter_login_attempts')) { const count = (attempts.get(values[0]) || 0) + 1; attempts.set(values[0], count); return [{ attempts: count }] }
    if (query.startsWith('insert into newsletter_sessions')) { sessions.add(values[0]); return [] }
    if (query.startsWith('select session_id from newsletter_sessions')) return sessions.has(values[0]) ? [{ session_id: values[0] }] : []
    if (query.startsWith('delete from newsletter_sessions')) { sessions.delete(values[0]); return [] }
    throw new Error(`Unexpected query: ${query}`)
  }
  const req = { headers: { host: 'localhost:5173', 'x-forwarded-for': '192.0.2.10' } }
  const invalid = await authenticate(req, response(), 'editor', 'wrong', sql)
  assert.deepEqual(invalid, { ok: false, status: 401, error: 'Invalid username or password.' })
  const res = response()
  const valid = await authenticate(req, res, 'editor', 'correct horse', sql)
  assert.equal(valid.ok, true)
  assert.match(res.headers['Set-Cookie'], /HttpOnly/)
  assert.match(res.headers['Set-Cookie'], /SameSite=Strict/)
  const cookie = res.headers['Set-Cookie'].split(';')[0]
  assert.deepEqual(await session({ headers: { cookie } }, sql), { username: 'editor', approver: true })
  const [cookieName, token] = cookie.split('=')
  const tokenParts = token.split('.')
  tokenParts[2] = `${tokenParts[2][0] === 'a' ? 'b' : 'a'}${tokenParts[2].slice(1)}`
  const tampered = `${cookieName}=${tokenParts.join('.')}`
  assert.equal(await session({ headers: { cookie: tampered } }, sql), null)
  const csrf = response()
  assert.equal(requireOrigin({ headers: { host: 'localhost:5173', origin: 'https://attacker.example' } }, csrf), false)
  assert.equal(csrf.statusCode, 403)
  const out = response()
  await revokeSession({ headers: { cookie, host: 'localhost:5173' } }, out, sql)
  assert.equal(await session({ headers: { cookie } }, sql), null)
  assert.match(out.headers['Set-Cookie'], /Max-Age=0/)
  for (let i = 0; i < 4; i++) await authenticate(req, response(), 'editor', 'wrong', sql)
  const limited = await authenticate(req, response(), 'editor', 'wrong', sql)
  assert.equal(limited.status, 429)
})

test('approval blocks unresolved editorial flags and unverified Shabbos data', () => {
  const issue = { week: '2026-11-06', shabbos: { verification_status: 'VERIFIED', parsha_he: 'חיי שרה', candle_lighting: '4:30 PM', friday_sunset: '4:48 PM', shacharis: '7:30 / 8:15 AM', sof_zman_shema_mga: '8:31 AM', sof_zman_shema_gra: '9:07 AM', motzai_maariv: '5:48 / 6:00 PM' }, entries: [{ id: '1', title: 'שלום', body: 'Community note', review_status: 'READY', flags: '' }] }
  assert.deepEqual(validateApproval(issue), [])
  issue.entries[0].flags = 'Check date'
  assert.equal(validateApproval(issue).length, 1)
  issue.entries[0].review_status = 'NEEDS_REVIEW'
  assert.equal(validateApproval(issue).length, 1)
  issue.shabbos.verification_status = 'DRAFT'
  assert.equal(validateApproval(issue).length, 2)
  issue.entries[0].review_status = 'READY'
  issue.entries[0].flags = ''
  issue.entries[0].event_date = '2026-11-05'
  assert.equal(validateApproval(issue).length, 2)
})

test('all newsletter data and mutation endpoints reject anonymous requests', async () => {
  for (const [handler, method] of [[issueHandler, 'GET'], [draftHandler, 'POST'], [approveHandler, 'POST']]) {
    const res = response()
    await handler({ method, headers: {}, query: {}, body: {} }, res)
    assert.equal(res.statusCode, 401)
  }
})

test('Neon data layer saves drafts and returns immutable approved snapshots', async () => {
  let approved = false
  let entry = { id: '11111111-1111-4111-8111-111111111111', issue_week: '2026-11-06', category: 'Neileich Updates', title: 'שלום', body: 'Initial', contact: '', event_date: '', price: '', flags: '', original_text: 'Raw', review_status: 'READY', sort_order: 1, notes: '', revision: 1 }
  let snapshot = null
  const shabbos = { issue_week: '2026-11-06', parsha_he: 'חיי שרה', parsha_en: 'Chayei Sara', verification_status: 'VERIFIED', candle_lighting: '4:30 PM', friday_sunset: '4:48 PM', shacharis: '7:30 / 8:15 AM', sof_zman_shema_mga: '8:31 AM', sof_zman_shema_gra: '9:07 AM', motzai_maariv: '5:48 / 6:00 PM' }
  const categories = [{ category: 'Neileich Updates', print_order: 1 }]
  const sql = (strings, ...values) => {
    const query = strings.join('?')
    if (query.startsWith('select issue_week::text as issue_week,status')) return [{ issue_week: '2026-11-06', status: approved ? 'APPROVED' : 'DRAFT' }]
    if (query.startsWith('select id::text as id')) return [{ ...entry }]
    if (query.startsWith('select snapshot')) return snapshot ? [{ snapshot }] : []
    if (query.startsWith('select issue_week::text as issue_week,parsha_he')) return [shabbos]
    if (query.startsWith('select category,print_order,usage')) return categories
    if (query.startsWith('select save_newsletter_draft')) { const changes = JSON.parse(values[1]); entry = { ...entry, ...changes[0], revision: 2 }; return [] }
    if (query.startsWith('select approve_newsletter')) { snapshot = { week: '2026-11-06', entries: [{ ...entry }], shabbos: { ...shabbos }, categories: [...categories] }; approved = true; return [{ approve_newsletter: snapshot }] }
    throw new Error(`Unexpected query: ${query}`)
  }
  const draft = await saveDraft('2026-11-06', [{ ...entry, title: 'Edited' }], sql)
  assert.equal(draft.entries[0].title, 'Edited')
  assert.equal(draft.entries[0].revision, 2)
  const published = await approveIssue('2026-11-06', 'editor', sql)
  assert.equal(published.issue.status, 'APPROVED')
  assert.equal(published.published[0].title, 'Edited')
  entry = { ...entry, title: 'Changed after approval' }
  assert.equal((await getIssue('2026-11-06', sql)).published[0].title, 'Edited')
  await assert.rejects(() => approveIssue('2026-11-06', 'editor', sql), /already approved/)
})

test('Apps Script ingestion passes the source identity and cleaned payload to Neon', async () => {
  let captured
  const sql = (strings, ...values) => { captured = { query: strings.join('?'), values }; return [{ id: '22222222-2222-4222-8222-222222222222' }] }
  const id = await ingestSubmission({ source: 'gmail', sourceId: 'message-1', receivedAt: '2026-11-05T17:00:00Z', issueWeek: '2026-11-06', sender: 'sender', rawText: 'Raw', cleaned: { category: 'Community Updates', body: 'Gemini wording' } }, sql)
  assert.equal(id, '22222222-2222-4222-8222-222222222222')
  assert.match(captured.query, /ingest_newsletter/)
  assert.equal(captured.values[1], 'message-1')
  assert.match(captured.values[6], /Gemini wording/)
})
