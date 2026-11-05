import { timingSafeEqual } from 'node:crypto'
import { getCurrentIssueWeek, validIssueWeek } from '../_lib/newsletter-config.js'
import { ingestSubmission } from '../_lib/newsletter-db.js'

function authorized(req) {
  const configured = process.env.ATC_INGEST_TOKEN
  const provided = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1]
  if (!configured || configured.length < 32 || !provided) return false
  const a = Buffer.from(configured), b = Buffer.from(provided)
  return a.length === b.length && timingSafeEqual(a, b)
}

function parseSubmission(body) {
  const source = String(body?.source || '')
  const sourceId = String(body?.sourceId || '')
  const sender = String(body?.sender || '')
  const rawText = String(body?.rawText || '')
  const receivedAt = body?.receivedAt || new Date().toISOString()
  const receivedDate = new Date(receivedAt)
  const issueWeek = body?.issueWeek || getCurrentIssueWeek(receivedDate)
  const cleaned = body?.cleaned || null
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(source) || sourceId.length < 1 || sourceId.length > 200 || sender.length > 300 || !rawText.trim() || rawText.length > 20_000 || Number.isNaN(receivedDate.getTime()) || !validIssueWeek(issueWeek)) throw new Error('Invalid submission metadata')
  if (cleaned && (typeof cleaned !== 'object' || Array.isArray(cleaned) || JSON.stringify(cleaned).length > 20_000 || (!String(cleaned.title || '').trim() && !String(cleaned.body || '').trim()))) throw new Error('Invalid cleaned announcement')
  return { source, sourceId, sender, rawText, receivedAt: receivedDate.toISOString(), issueWeek, cleaned }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).end()
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' })
  let submission
  try { submission = parseSubmission(req.body) }
  catch { return res.status(400).json({ error: 'Invalid submission.' }) }
  try { const id = await ingestSubmission(submission); return res.status(202).json({ id, issueWeek: submission.issueWeek }) }
  catch (error) { console.error('Newsletter ingestion failed', error.message); return res.status(503).json({ error: 'Submission could not be stored.' }) }
}
