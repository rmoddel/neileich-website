import { neon } from '@neondatabase/serverless'
import { validIssueWeek } from './newsletter-config.js'

export function newsletterDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured')
  return neon(process.env.DATABASE_URL)
}

export async function getIssue(week, sql = newsletterDb()) {
  if (!validIssueWeek(week)) throw new Error('Invalid Friday issue date')
  const [issueRows, entries, publishedRows, shabbosRows, categories] = await Promise.all([
    sql`select issue_week::text as issue_week,status,date_line,intro,approved_at,approved_by,sent_at,pdf_url,error from newsletter_issues where issue_week=${week}::date`,
    sql`select id::text as id,issue_week::text as issue_week,category,title,body,contact,event_date,price,flags,original_text,review_status,sort_order,processed_at,notes,version as revision from newsletter_announcements where issue_week=${week}::date order by sort_order,id`,
    sql`select snapshot,approved_at,approved_by from newsletter_published where issue_week=${week}::date`,
    sql`select issue_week::text as issue_week,parsha_he,parsha_en,friday_date,shabbos_date,candle_lighting,friday_sunset,sof_zman_shema_gra,shabbos_ends,source,verification_status,notes,shacharis,sof_zman_shema_mga,shabbos_mincha,motzai_maariv,friday_mincha,friday_maariv,erev_shabbos_mincha from newsletter_shabbos where issue_week=${week}::date`,
    sql`select category,print_order,usage from newsletter_categories where active=true order by print_order,category`,
  ])
  const snapshot = publishedRows[0]?.snapshot || null
  return {
    week,
    issue: issueRows[0] || { issue_week: week, status: 'DRAFT' },
    entries,
    published: snapshot?.entries || [],
    publishedMeta: snapshot ? { shabbos: snapshot.shabbos, categories: snapshot.categories } : null,
    shabbos: shabbosRows[0] || null,
    categories,
  }
}

export async function listWeeks(sql = newsletterDb()) {
  const rows = await sql`select distinct issue_week::text as issue_week from (select issue_week from newsletter_issues union select issue_week from newsletter_announcements union select issue_week from newsletter_shabbos union select issue_week from newsletter_incoming) weeks order by issue_week desc`
  return rows.map(row => row.issue_week).filter(validIssueWeek)
}

export async function saveDraft(week, changes, sql = newsletterDb()) {
  if (!validIssueWeek(week) || !Array.isArray(changes) || changes.length > 300) throw new Error('Invalid draft')
  await sql`select save_newsletter_draft(${week}::date,${JSON.stringify(changes)}::jsonb)`
  return getIssue(week, sql)
}

export function validateApproval(issue) {
  const errors = []
  if (!issue.shabbos) errors.push('Shabbos information is missing')
  else if (issue.shabbos.verification_status !== 'VERIFIED') errors.push('Shabbos times are not verified')
  for (const entry of issue.entries) {
    if (entry.review_status === 'NEEDS_REVIEW') errors.push(`${entry.title || entry.id}: needs review`)
    if (entry.review_status === 'READY' && !entry.body && !entry.title) errors.push(`${entry.id}: missing wording`)
    if (entry.review_status === 'READY' && entry.flags?.trim()) errors.push(`${entry.title || entry.id}: has editorial flags`)
    if (entry.review_status === 'READY' && entry.event_date) {
      const date = new Date(`${entry.event_date}T00:00:00Z`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.event_date) || Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== entry.event_date || entry.event_date < issue.week) errors.push(`${entry.title || entry.id}: check event date`)
    }
  }
  return errors
}

export async function approveIssue(week, actor, sql = newsletterDb()) {
  const issue = await getIssue(week, sql)
  if (issue.issue.status === 'APPROVED' || issue.published.length) throw new Error('Issue is already approved')
  const errors = validateApproval(issue)
  if (errors.length) { const error = new Error('Resolve blocking issues before approval'); error.details = errors; throw error }
  await sql`select approve_newsletter(${week}::date,${actor})`
  return getIssue(week, sql)
}

export async function ingestSubmission(submission, sql = newsletterDb()) {
  const { source, sourceId, receivedAt, issueWeek, sender, rawText, cleaned } = submission
  const rows = await sql`select ingest_newsletter(${source},${sourceId},${receivedAt}::timestamptz,${issueWeek}::date,${sender},${rawText},${cleaned ? JSON.stringify(cleaned) : null}::jsonb) as id`
  return rows[0].id
}

export async function saveShabbos(week, data, sql = newsletterDb()) {
  if (!validIssueWeek(week) || !data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid Shabbos data')
  if (!data.parsha_he?.trim() || !data.parsha_en?.trim() || !data.source?.trim() || !['NEEDS_REVIEW', 'VERIFIED'].includes(data.verification_status)) throw new Error('Parsha, source, and verification status are required')
  await sql`select save_newsletter_shabbos(${week}::date,${JSON.stringify(data)}::jsonb)`
  return getIssue(week, sql)
}
