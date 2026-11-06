export const importFields = [
  ['category', 'Category'], ['body', 'Announcement wording'], ['title', 'Title'],
  ['contact', 'Contact'], ['price', 'Price'], ['event_date', 'Event date'], ['notes', 'Notes'],
]

const aliases = {
  category: ['category', 'category name', 'section', 'type', 'classification'],
  body: ['body', 'content', 'description', 'announcement', 'announcement wording', 'announcement text', 'wording', 'ad', 'ad copy', 'advertisement', 'message'],
  title: ['title', 'headline', 'heading', 'subject'],
  contact: ['contact', 'contact info', 'phone', 'email', 'telephone'],
  price: ['price', 'cost', 'amount'],
  event_date: ['event date', 'date of event', 'eventdate'],
  notes: ['notes', 'note', 'editorial notes'],
}
const categoryAliases = {
  'mazel tovs': 'Mazel Tov', 'mazal tov': 'Mazel Tov', 'mazal tovs': 'Mazel Tov',
  'classifieds': 'Classifieds & Services', 'services': 'Classifieds & Services', 'listings': 'Classifieds & Services', 'listings continued': 'Classifieds & Services', 'available': 'Classifieds & Services',
  'other community notices': 'Other Notices', 'events': 'Events & Shiurim', 'shiurim': 'Events & Shiurim',
  'libraries': 'Libraries & Kids', 'library': 'Libraries & Kids', 'bnos news': 'Neileich Updates', 'kids': 'Libraries & Kids', 'for sale': 'Selling / For Rent', 'selling': 'Selling / For Rent', 'updates': 'Community Updates',
  'rentals': 'Selling / For Rent', 'lost and found': 'Lost & Found',
}
export const normalize = value => String(value ?? '').trim().toLowerCase().replace(/[!:]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()

export function detectMapping(headers) {
  const found = {}
  headers.forEach((header, index) => {
    const key = normalize(header)
    for (const [field, names] of Object.entries(aliases)) {
      if (names.includes(key) && found[field] === undefined) { found[field] = index; break }
    }
  })
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
  if (mapping.body === undefined) errors.push('Map an announcement wording column (Body, Content, Description, Announcement, or Title).')
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

export function mappedRows(rows, mapping, categories) {
  return rows.filter(row => row.some(cell => String(cell ?? '').trim())).map((row, index) => {
    const value = field => String(row[mapping[field]] ?? '').trim()
    const body = value('body')
    return {
      key: globalThis.crypto?.randomUUID?.() || `row-${index}-${Date.now()}`,
      sourceRow: index + 2,
      category: matchCategory(value('category'), categories),
      originalCategory: value('category'),
      title: mapping.title === undefined ? '' : value('title'),
      body, original_text: body,
      contact: mapping.contact === undefined ? '' : value('contact'),
      price: mapping.price === undefined ? '' : value('price'),
      event_date: mapping.event_date === undefined ? '' : value('event_date'),
      notes: mapping.notes === undefined ? '' : value('notes'),
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
