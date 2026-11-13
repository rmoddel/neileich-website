// Fields offered on the column-mapping screen. The first group maps 1:1 onto stored announcement
// fields; the second group is combined into them when rows are built (see composeEntry).
export const importFields = [
  ['category', 'Category'], ['body', 'Announcement wording'], ['title', 'Title'], ['contact', 'Contact'], ['price', 'Price'], ['event_date', 'Event date'], ['notes', 'Notes'],
  ['type', 'Type (title if blank)'], ['phone', 'Phone (added to contact)'], ['when', 'Date / time (added to wording)'], ['location', 'Location (added to wording)'], ['status', 'Lost / Found status'],
]

export const FOOTER_CATEGORY = 'Publication Info'

// Header names recognised for each field, after normalize(). Combined headers such as
// "Title / Item" or "Phone / Text" are also tried with separators removed and part by part.
const aliases = {
  category: ['category', 'category name', 'section', 'classification'],
  body: ['body', 'content', 'description', 'details', 'description details', 'announcement', 'announcement wording', 'announcement text', 'wording', 'ad', 'ad copy', 'advertisement', 'message'],
  title: ['title', 'headline', 'heading', 'subject', 'item', 'title item'],
  contact: ['contact', 'contact info', 'contact name', 'contact person', 'person', 'name', 'email'],
  price: ['price', 'cost', 'amount', 'terms', 'price terms', 'fee'],
  event_date: ['event date', 'date of event', 'eventdate'],
  notes: ['notes', 'note', 'editorial notes'],
  type: ['type', 'kind'],
  phone: ['phone', 'telephone', 'phone number', 'cell', 'text', 'phone text'],
  when: ['date', 'time', 'date time', 'when', 'hours', 'schedule'],
  location: ['location', 'house', 'address', 'where', 'place', 'location house'],
  status: ['status', 'lost found status', 'found status', 'lost found'],
}
const categoryAliases = {
  'mazel tovs': 'Mazel Tov', 'mazal tov': 'Mazel Tov', 'mazal tovs': 'Mazel Tov',
  'classifieds': 'Classifieds & Services', 'services': 'Classifieds & Services', 'listings': 'Classifieds & Services', 'listings continued': 'Classifieds & Services', 'available': 'Classifieds & Services',
  'other community notices': 'Other Notices', 'events': 'Events & Shiurim', 'shiurim': 'Events & Shiurim',
  'libraries': 'Libraries & Kids', 'library': 'Libraries & Kids', 'bnos news': 'Neileich Updates', 'kids': 'Libraries & Kids', 'for sale': 'Selling / For Rent', 'selling': 'Selling / For Rent', 'updates': 'Community Updates',
  'rentals': 'Selling / For Rent', 'lost and found': 'Lost & Found',
  'publication info': FOOTER_CATEGORY, 'publication information': FOOTER_CATEGORY, 'footer': FOOTER_CATEGORY,
}
// Categories whose day/time text describes recurring hours or deadlines, not a one-time event date.
const recurringCategories = ['Classifieds & Services', 'Selling / For Rent', 'Libraries & Kids', 'Lost & Found', 'Looking For', 'Dedications', FOOTER_CATEGORY]

export const normalize = value => String(value ?? '').trim().toLowerCase().replace(/[!:]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
const withoutSeparators = key => key.replace(/[/&|,()]+/g, ' ').replace(/\s+/g, ' ').trim()
const headerParts = key => key.split(/[/&|,()]+/).map(part => part.trim()).filter(Boolean)

export function detectMapping(headers) {
  const found = {}
  const keys = headers.map(normalize)
  const used = new Set()
  const assign = (field, index) => { found[field] = index; used.add(index) }
  // Pass 1: whole header (as written, then with separators removed). Pass 2: each part of a combined header.
  for (const candidates of [key => [key, withoutSeparators(key)], headerParts]) {
    keys.forEach((key, index) => {
      if (used.has(index) || !key) return
      for (const name of candidates(key)) {
        const field = Object.keys(aliases).find(item => found[item] === undefined && aliases[item].includes(name))
        if (field) { assign(field, index); return }
      }
    })
  }
  // A sheet with only a "Type" column uses it as the category.
  if (found.category === undefined && found.type !== undefined) { found.category = found.type; delete found.type }
  if (found.body === undefined && found.title !== undefined) {
    found.body = found.title
    delete found.title
  }
  return found
}

export function findHeaderRow(table) {
  let best = -1, score = -1
  table.slice(0, 25).forEach((row, index) => {
    if (!row.some(cell => String(cell ?? '').trim())) return
    const mapping = detectMapping(row)
    const nextScore = Object.keys(mapping).length + (mapping.category !== undefined ? 2 : 0) + (mapping.body !== undefined ? 2 : 0)
    if (nextScore > score) { best = index; score = nextScore }
  })
  return best
}

export function mappingErrors(mapping) {
  const errors = []
  if (mapping.category === undefined) errors.push('Map a Category column.')
  if (mapping.body === undefined && mapping.title === undefined) errors.push('Map an announcement wording column (Body, Content, Description, Announcement, or Title).')
  const values = Object.values(mapping).filter(value => value !== undefined)
  if (new Set(values).size !== values.length) errors.push('Each spreadsheet column can map to only one field.')
  return errors
}

export function matchCategory(value, categories) {
  const key = normalize(value).replace(/&/g, 'and')
  const direct = categories.find(category => normalize(category).replace(/&/g, 'and') === key)
  if (direct) return direct
  const alias = categoryAliases[key] || categoryAliases[key.replace(/ and /g, ' & ')]
  return categories.find(category => category === alias) || ''
}

const iso = date => date.toISOString().slice(0, 10)
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
// Day offsets from the Friday issue week. Earlier patterns win when they start at the same place.
const dayPatterns = [
  [/\bmotz(?:a|o)?(?:e|a)?i?'?\s*(?:shabbos|shabbat)\b/, 1], [/\b(?:erev shabbos|friday)\b/, 0], [/\b(?:shabbos|shabbat|saturday)\b/, 1],
  [/\bsunday\b/, 2], [/\bmonday\b/, 3], [/\btuesday\b/, 4], [/\bwednesday\b/, 5], [/\bthursday\b/, 6],
]

// Turns free text such as "Motzaei Shabbos, 8:30 PM", "Sunday 12–1 PM", "11/15" or "Nov 15"
// into YYYY-MM-DD relative to the Friday issue week. Plural days ("Sundays") are recurring and ignored.
export function parseEventDate(text, week) {
  const value = String(text ?? '').trim().toLowerCase()
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(week || '')) return ''
  const explicit = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (explicit) return explicit[0]
  const friday = new Date(`${week}T00:00:00Z`)
  const resolve = (month, day, year) => {
    let date = new Date(Date.UTC(year ?? friday.getUTCFullYear(), month, day))
    if (year === undefined && date < friday - 180 * 864e5) date = new Date(Date.UTC(friday.getUTCFullYear() + 1, month, day))
    return date.getUTCMonth() === month && date.getUTCDate() === day ? iso(date) : ''
  }
  const numeric = value.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/)
  if (numeric) return resolve(Number(numeric[1]) - 1, Number(numeric[2]), numeric[3] ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]) : undefined)
  const named = value.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/)
  if (named) return resolve(months.indexOf(named[1]), Number(named[2]))
  let first = null
  for (const [pattern, offset] of dayPatterns) {
    const match = value.match(pattern)
    if (match && (!first || match.index < first.index)) first = { index: match.index, offset }
  }
  if (!first) return ''
  const date = new Date(friday)
  date.setUTCDate(date.getUTCDate() + first.offset)
  return iso(date)
}

const includes = (text, part) => text.toLowerCase().includes(part.toLowerCase())

// Builds one announcement from a spreadsheet row's raw values and its matched category.
// mergeTitle: in categorized listing sheets the title is the item itself ("Blue gown") and the
// newsletter prints only the wording, so the title leads the wording. In classic sheets the
// title is an internal label and stays out of the printed text.
export function composeEntry(raw, category, week, { mergeTitle = true } = {}) {
  const value = field => String(raw[field] ?? '').trim()
  const description = value('body')
  const title = value('title') || value('type')
  const status = /^lost$/i.test(value('status')) ? 'Lost' : /^found$/i.test(value('status')) ? 'Found' : ''
  const person = value('contact'), phone = value('phone')
  const isMazelTov = /^ma(?:z|ze)a?l tov/i.test(category)
  const isFooter = category === FOOTER_CATEGORY
  let body
  let contact = [person, phone].filter(Boolean).join(' · ')
  if (isMazelTov && person) { body = `${person} — ${description || title}`; contact = phone }
  else if (isFooter || !description) body = description || title
  else body = mergeTitle && title && !includes(description, title) ? `${title} — ${description}` : description
  if (status && body && !body.toLowerCase().startsWith(status.toLowerCase())) body = `${status}: ${body}`
  const extras = [value('when'), value('location')].filter(part => part && !includes(body, part))
  if (body && extras.length) body = `${body} (${extras.join(' · ')})`
  const explicitDate = value('event_date')
  const event_date = /^\d{4}-\d{2}-\d{2}$/.test(explicitDate) ? explicitDate
    : recurringCategories.includes(category) ? '' : parseEventDate(explicitDate || value('when'), week)
  return { title, body, contact, price: value('price'), event_date, notes: value('notes'), original_text: description || body }
}

export function mappedRows(rows, mapping, categories, week = '') {
  const mergeTitle = ['type', 'status', 'when', 'location'].some(field => mapping[field] !== undefined)
  return rows.filter(row => row.some(cell => String(cell ?? '').trim())).map((row, index) => {
    const raw = Object.fromEntries(Object.entries(mapping).map(([field, column]) => [field, String(row[column] ?? '').trim()]))
    const category = matchCategory(raw.category, categories)
    return {
      key: globalThis.crypto?.randomUUID?.() || `row-${index}-${Date.now()}`,
      sourceRow: index + 2,
      category,
      originalCategory: raw.category || '',
      ...composeEntry(raw, category, week, { mergeTitle }),
      review_status: 'NEEDS_REVIEW',
    }
  })
}

export function rowErrors(row, categories) {
  const errors = []
  if (!categories.includes(row.category)) errors.push(row.originalCategory ? `Unknown category: ${row.originalCategory}` : 'Choose a category')
  if (!row.body?.trim()) errors.push('Announcement wording is required')
  if (!['NEEDS_REVIEW', 'READY'].includes(row.review_status)) errors.push('Choose a review status')
  if (row.event_date) {
    const date = new Date(`${row.event_date}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.event_date) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== row.event_date) errors.push('Event date must be YYYY-MM-DD')
  }
  return errors
}
