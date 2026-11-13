import test from 'node:test'
import assert from 'node:assert/strict'
import { composeEntry, detectMapping, mappedRows, mappingErrors, parseEventDate, rowErrors } from '../src/pages/atcSpreadsheet.js'

const categories = ['Neileich Updates', 'Mazel Tov', 'Community Updates', 'Events & Shiurim', 'Lost & Found', 'Looking For', 'Libraries & Kids', 'Selling / For Rent', 'Classifieds & Services', 'Dedications', 'Other Notices', 'Publication Info']
const headers = ['Category', 'Type', 'Title / Item', 'Description / Details', 'Contact / Person', 'Phone / Text', 'Location / House', 'Date / Time', 'Price / Terms', 'Lost / Found Status', 'Source']

test('combined "A / B" headers map onto existing fields automatically', () => {
  const mapping = detectMapping(headers)
  assert.deepEqual(mapping, { category: 0, type: 1, title: 2, body: 3, contact: 4, phone: 5, location: 6, when: 7, price: 8, status: 9 })
  assert.deepEqual(mappingErrors(mapping), [])
})

test('legacy single-word headers still map as before', () => {
  assert.deepEqual(detectMapping(['Section', 'Announcement', 'Phone']), { category: 0, body: 1, phone: 2 })
  assert.deepEqual(detectMapping(['Type', 'Content']), { category: 0, body: 1 })
  assert.deepEqual(detectMapping(['Category', 'Title']), { category: 0, body: 1 })
})

test('free-text day and time become a date in the issue week', () => {
  assert.equal(parseEventDate('Motzaei Shabbos, 8:30 PM', '2026-11-20'), '2026-11-21')
  assert.equal(parseEventDate('Sunday 12-1 PM', '2026-11-20'), '2026-11-22')
  assert.equal(parseEventDate('Friday/Shabbos', '2026-11-20'), '2026-11-20')
  assert.equal(parseEventDate('Thursday 6:15 PM', '2026-11-20'), '2026-11-26')
  assert.equal(parseEventDate('11/29', '2026-11-20'), '2026-11-29')
  assert.equal(parseEventDate('Jan 4', '2026-11-20'), '2027-01-04')
  assert.equal(parseEventDate('2026-12-01', '2026-11-20'), '2026-12-01')
  assert.equal(parseEventDate('Open Sundays', '2026-11-20'), '')
  assert.equal(parseEventDate('2:20 PM', '2026-11-20'), '')
})

test('rows combine contact + phone and keep time and location in the wording', () => {
  const entry = composeEntry({ title: 'Melava Malka', body: 'Music and raffle.', contact: 'Office', phone: '555-0100', when: 'Motzaei Shabbos 8 PM', location: 'Main hall' }, 'Community Updates', '2026-11-20')
  assert.equal(entry.body, 'Melava Malka — Music and raffle. (Motzaei Shabbos 8 PM · Main hall)')
  assert.equal(entry.contact, 'Office · 555-0100')
  assert.equal(entry.event_date, '2026-11-21')
})

test('lost & found status, empty descriptions, recurring hours and footer rows', () => {
  assert.equal(composeEntry({ title: 'Blue scarf', status: 'Found' }, 'Lost & Found', '2026-11-20').body, 'Found: Blue scarf')
  assert.equal(composeEntry({ type: 'Hats', body: 'Size 8.', status: 'lost' }, 'Lost & Found', '2026-11-20').body, 'Lost: Hats — Size 8.')
  assert.equal(composeEntry({ title: 'Library', body: 'Open.', when: 'Tuesday 5 PM' }, 'Libraries & Kids', '2026-11-20').event_date, '')
  const footer = composeEntry({ title: 'Advertising', body: '$10 per ad.', when: 'Before Shabbos' }, 'Publication Info', '2026-11-20')
  assert.equal(footer.title, 'Advertising')
  assert.equal(footer.body, '$10 per ad. (Before Shabbos)')
  assert.equal(footer.event_date, '')
  assert.equal(composeEntry({ title: 'Son', body: 'Bar mitzvah of their son', contact: 'The Family', phone: '555-0101' }, 'Mazel Tov', '2026-11-20').body, 'The Family — Bar mitzvah of their son')
})

test('a full categorized sheet imports with no validation errors', () => {
  const rows = [
    ['Mazel Tov', 'Wedding', 'Son', 'Wedding of their son', 'The Family', '', '', '', '', '', 'Page 1'],
    ['Library', 'Library', 'Reading library', 'Membership includes 4 books.', '', '555-0102', '#31', '6:30-7 PM', '$20/year', '', 'Page 2'],
    ['Lost & Found', 'Found', 'Toy camera', '', '', '555-0103', '', '', '', 'Found', 'Page 2'],
    ['Publication Info', 'Submission', 'Submissions', 'Text message only.', '', '555-0104', '', '', '', '', 'Page 2'],
    ['Bnos News', 'Meetup', 'Bnos meetup', 'Looking forward to meeting up.', '', '', 'Parking lot', '2:20 PM', '', '', 'Page 1'],
  ]
  const result = mappedRows(rows, detectMapping(headers), categories, '2026-11-20')
  assert.deepEqual(result.map(row => row.category), ['Mazel Tov', 'Libraries & Kids', 'Lost & Found', 'Publication Info', 'Neileich Updates'])
  assert.deepEqual(result.flatMap(row => rowErrors(row, categories)), [])
  assert.equal(result[1].body, 'Reading library — Membership includes 4 books. (6:30-7 PM · #31)')
})

test('classic sheets keep the title out of the printed wording', () => {
  const [row] = mappedRows([['Events', 'Shiur tonight', 'Ad 1', '555-0100']], detectMapping(['Section', 'Announcement', 'Title', 'Phone']), categories)
  assert.equal(row.body, 'Shiur tonight')
  assert.equal(row.title, 'Ad 1')
  assert.equal(row.contact, '555-0100')
  assert.equal(row.original_text, 'Shiur tonight')
})
