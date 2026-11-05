import { createHash } from 'node:crypto'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { put, get } from '@vercel/blob'
import { newsletterDb } from './newsletter-db.js'
import { validIssueWeek } from './newsletter-config.js'

export const MAX_CHART_BYTES = 2_800_000 // JSON/base64 stays below Vercel's 4.5 MB request limit.
export const timeFields = ['candle_lighting', 'friday_sunset', 'friday_mincha', 'friday_maariv', 'erev_shabbos_mincha', 'shacharis', 'sof_zman_shema_mga', 'sof_zman_shema_gra', 'shabbos_mincha', 'motzai_maariv', 'shabbos_ends']
const requiredTimes = ['candle_lighting', 'friday_sunset', 'shacharis', 'sof_zman_shema_mga', 'sof_zman_shema_gra', 'motzai_maariv']
const fields = ['issue_week', 'friday_date', 'shabbos_date', 'parsha_he', 'parsha_en', ...timeFields, 'notes']

function group(items, min, max) {
  return items.filter(item => item.x >= min && item.x < max).sort((a, b) => b.y - a.y || a.x - b.x).map(item => item.text).filter(text => text !== '/' && text !== 'שקיעה').join(' / ')
}

// PDF.js text positions preserve the table's columns even when plain text extraction loses them.
export async function extractEmbeddedChart(pdfBytes) {
  const task = getDocument({ data: new Uint8Array(pdfBytes), useSystemFonts: true, disableFontFace: true })
  const document = await task.promise
  if (document.numPages > 30) throw new Error('Chart has too many pages')
  const pages = [], tableRows = []
  try {
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number)
      const content = await page.getTextContent()
      const items = content.items.filter(item => item.str?.trim()).map(item => ({ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }))
      pages.push(items.sort((a, b) => b.y - a.y || b.x - a.x).map(item => item.text).join(' '))
      for (const label of items.filter(item => item.x > page.view[2] * .84 && /[א-ת]/.test(item.text) && item.y < page.view[3] * .85)) {
        const row = items.filter(item => Math.abs(item.y - label.y) < 15.2)
        const values = {
          parsha_he: label.text,
          erev_shabbos_mincha: group(row, 530, 650),
          candle_lighting: group(row.filter(item => item.y >= label.y), 440, 510),
          friday_sunset: group(row.filter(item => item.y < label.y), 440, 510),
          friday_mincha: group(row, 390, 440),
          friday_maariv: group(row, 330, 390),
          shacharis: group(row, 260, 330),
          sof_zman_shema: group(row, 185, 255),
          shabbos_mincha: group(row, 110, 185),
          motzai_maariv: group(row, 0, 105),
        }
        if (values.candle_lighting && values.shacharis) tableRows.push({ page: number, ...values })
      }
    }
  } finally { await task.destroy() }
  return { embeddedText: pages.join('\n\n').slice(0, 150_000), tableRows }
}

function normalizeRecord(raw, index) {
  const record = Object.fromEntries(fields.map(field => [field, typeof raw?.[field] === 'string' ? raw[field].trim().slice(0, field === 'notes' ? 1500 : 300) : '']))
  record.source_index = index
  record.warnings = Array.isArray(raw?.warnings) ? raw.warnings.slice(0, 15).map(value => String(value).slice(0, 300)) : []
  if (!validIssueWeek(record.issue_week) || record.friday_date !== record.issue_week) { record.issue_week = ''; record.friday_date = ''; record.warnings.push('Friday date or chart year is missing or uncertain; enter the actual date.') }
  if (record.shabbos_ends && !raw?.explicit_havdalah) { record.shabbos_ends = ''; record.warnings.push('Havdalah is not explicitly labeled; Motzai Maariv is separate.') }
  for (const field of requiredTimes) if (!record[field]) record.warnings.push(`Missing or unreadable ${field.replaceAll('_', ' ')}.`)
  if (!record.parsha_he) record.warnings.push('Parsha is missing or unreadable.')
  return record
}

export function normalizeExtraction(payload) {
  const records = Array.isArray(payload?.records) ? payload.records : []
  if (!records.length || records.length > 100) throw new Error('No usable weekly records were extracted')
  return records.map(normalizeRecord)
}

export function validateReviewedRecords(records, originalCount) {
  if (!Array.isArray(records) || !records.length || records.length > 100) throw new Error('Choose 1 to 100 reviewed weeks')
  const seen = new Set()
  const seenSources = new Set()
  const kept = records.filter(record => !record.skip)
  if (!kept.length) throw new Error('Select at least one week to confirm')
  return kept.map(record => {
    if (!Number.isInteger(record.source_index) || record.source_index < 0 || record.source_index >= originalCount) throw new Error('Invalid source record')
    if (seenSources.has(record.source_index)) throw new Error('The same source row appears twice')
    seenSources.add(record.source_index)
    if (!record.reviewed) throw new Error('Review and confirm each week before saving')
    if (!validIssueWeek(record.issue_week) || record.friday_date !== record.issue_week) throw new Error('Enter the correct Friday date for each week')
    const expectedShabbos = new Date(Date.parse(`${record.issue_week}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)
    if (record.shabbos_date && record.shabbos_date !== expectedShabbos) throw new Error(`Check the Shabbos date for ${record.issue_week}`)
    if (seen.has(record.issue_week)) throw new Error('The same Friday appears twice')
    seen.add(record.issue_week)
    if (!record.parsha_he?.trim()) throw new Error('Enter every parsha name')
    for (const field of requiredTimes) if (!record[field]?.trim()) throw new Error(`Enter ${field.replaceAll('_', ' ')} for ${record.issue_week}`)
    const cleaned = Object.fromEntries(fields.map(field => [field, typeof record[field] === 'string' ? record[field].trim() : '']))
    return { ...cleaned, shabbos_date: expectedShabbos, source_index: record.source_index }
  })
}

export async function interpretChart(pdfBytes, extracted, apiKey = process.env.GEMINI_API_KEY, fetcher = fetch) {
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')
  const prompt = `Extract every weekly row from this official Bais Medrash of Lakewood Commons zmanim chart. Return JSON {"records":[...]}. Use the embedded table rows as a cross-check, but inspect the PDF visually too. Return each time as a string, preserving multiple minyan times and Hebrew labels in notes. Fields: issue_week, friday_date, shabbos_date, parsha_he, parsha_en, candle_lighting, friday_sunset, friday_mincha, friday_maariv, erev_shabbos_mincha, shacharis, sof_zman_shema_mga, sof_zman_shema_gra, shabbos_mincha, motzai_maariv, shabbos_ends, notes, warnings, explicit_havdalah. The chart's Shema pair is M״A then GR״A. Motzai Shabbos Maariv is NOT Havdalah; leave shabbos_ends empty unless an explicit Havdalah time is printed. Never invent a time or a date. A parsha alone does not identify a Jewish calendar year. If this PDF does not print a full date or year that establishes the Gregorian Friday, leave issue_week/friday_date/shabbos_date empty and add a warning for manual review. An empty string means unknown. Embedded table rows: ${JSON.stringify(extracted.tableRows)}. Embedded text: ${extracted.embeddedText.slice(0, 60_000)}`
  const model = process.env.ATC_GEMINI_MODEL || 'gemini-3.8-flash'
  const responseSchema = { type: 'object', properties: { records: { type: 'array', items: { type: 'object', properties: { ...Object.fromEntries(fields.map(field => [field, { type: 'string' }])), warnings: { type: 'array', items: { type: 'string' } }, explicit_havdalah: { type: 'boolean' } }, required: ['parsha_he', 'warnings'] } } }, required: ['records'] }
  const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, signal: AbortSignal.timeout(85_000),
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'application/pdf', data: Buffer.from(pdfBytes).toString('base64') } }] }], generationConfig: { responseMimeType: 'application/json', responseSchema, temperature: 0, maxOutputTokens: 8192 } }),
  })
  if (!response.ok) throw new Error(`Gemini could not process the chart (${response.status})`)
  const result = await response.json()
  const text = result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('')
  if (!text) throw new Error('Gemini returned no chart records')
  const parsed = JSON.parse(text)
  const records = normalizeExtraction(parsed)
  // A parsha repeats every year. Require an explicit calendar anchor before accepting model dates.
  if (!/\b20\d{2}\b|תש[פ-צ][א-ת]/.test(extracted.embeddedText)) {
    for (const record of records) {
      record.issue_week = ''; record.friday_date = ''; record.shabbos_date = ''
      if (!record.warnings.some(warning => /date|year/i.test(warning))) record.warnings.push('The chart does not establish a calendar year; enter the actual Friday date.')
    }
  }
  for (const row of extracted.tableRows) if (!records.some(record => record.parsha_he.replace(/^פרשת\s*/, '') === row.parsha_he.replace(/^פרשת\s*/, ''))) {
    records.push(normalizeRecord({ parsha_he: row.parsha_he, candle_lighting: row.candle_lighting, friday_sunset: row.friday_sunset, shacharis: row.shacharis, motzai_maariv: row.motzai_maariv, warnings: ['Gemini missed this embedded table row; check every value against the source PDF.'], notes: JSON.stringify(row) }, records.length))
  }
  return { records, rawModelRecords: parsed.records }
}

export async function getImport(id, sql = newsletterDb()) {
  const rows = await sql`select id::text as id,filename,byte_size,status,extracted_records,warnings,error,created_at,uploaded_by,blob_path from newsletter_zmanim_imports where id=${id}::uuid`
  return rows[0] || null
}

export async function listImports(sql = newsletterDb()) {
  return sql`select id::text as id,filename,byte_size,status,error,created_at,uploaded_by from newsletter_zmanim_imports order by created_at desc limit 30`
}

export async function uploadChart({ filename, base64, actor }, { sql = newsletterDb(), store = put, interpret = interpretChart } = {}) {
  if (typeof filename !== 'string' || !/\.pdf$/i.test(filename) || filename.length > 180 || typeof base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('Choose a PDF chart')
  const bytes = Buffer.from(base64, 'base64')
  if (!bytes.length || bytes.length > MAX_CHART_BYTES || bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('PDF chart must be under 2.8 MB')
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const existing = await sql`select id::text as id,status from newsletter_zmanim_imports where sha256=${sha256}`
  if (existing.length && existing[0].status !== 'FAILED') return { import: await getImport(existing[0].id, sql), duplicate: true }
  const rows = existing.length
    ? await sql`update newsletter_zmanim_imports set status='PROCESSING',error='',updated_at=now() where sha256=${sha256} returning id::text as id`
    : await sql`insert into newsletter_zmanim_imports(sha256,filename,byte_size,uploaded_by) values(${sha256},${filename},${bytes.length},${actor}) on conflict(sha256) do nothing returning id::text as id`
  if (!rows.length) { const found = await sql`select id::text as id from newsletter_zmanim_imports where sha256=${sha256}`; return { import: await getImport(found[0].id, sql), duplicate: true } }
  const id = rows[0].id
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Private PDF storage is not configured')
    const blob = await store(`atc-zmanim/${sha256}.pdf`, bytes, { access: 'private', contentType: 'application/pdf', allowOverwrite: true })
    await sql`update newsletter_zmanim_imports set blob_path=${blob.pathname},updated_at=now() where id=${id}::uuid`
    const extracted = await extractEmbeddedChart(bytes)
    const { records, rawModelRecords } = await interpret(bytes, extracted)
    await sql`update newsletter_zmanim_imports set status='READY_FOR_REVIEW',embedded_text=${extracted.embeddedText},embedded_rows=${JSON.stringify(extracted.tableRows)}::jsonb,raw_model_records=${JSON.stringify(rawModelRecords)}::jsonb,extracted_records=${JSON.stringify(records)}::jsonb,warnings=${JSON.stringify(records.flatMap(record => record.warnings))}::jsonb,updated_at=now() where id=${id}::uuid`
    return { import: await getImport(id, sql), duplicate: false }
  } catch (error) {
    await sql`update newsletter_zmanim_imports set status='FAILED',error=${error.message.slice(0, 500)},updated_at=now() where id=${id}::uuid`
    throw error
  }
}

export async function confirmChart(id, records, actor, sql = newsletterDb()) {
  const imported = await getImport(id, sql)
  if (!imported || imported.status !== 'READY_FOR_REVIEW') throw new Error('Import is unavailable or already confirmed')
  const reviewed = validateReviewedRecords(records, imported.extracted_records.length)
  await sql`select confirm_newsletter_zmanim(${id}::uuid,${actor},${JSON.stringify(reviewed)}::jsonb)`
  return getImport(id, sql)
}

export async function getPrivateChart(id, sql = newsletterDb(), retrieve = get) {
  const imported = await getImport(id, sql)
  if (!imported?.blob_path) return null
  return retrieve(imported.blob_path, { access: 'private' })
}
