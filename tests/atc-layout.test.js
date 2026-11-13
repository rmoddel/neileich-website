import test from 'node:test'
import assert from 'node:assert/strict'
import { assembleFooter, assembleSections, bannerOrder, packSections, regularOrder } from '../src/pages/atcLayout.js'
import { matchCategory } from '../src/pages/atcSpreadsheet.js'

test('renderer enforces category priority regardless of incoming record order', () => {
  const categories = ['Lost & Found', 'Classifieds & Services', 'Other Notices', 'Selling / For Rent', 'Events & Shiurim', 'Community Updates', 'Looking For', 'Mazal Tov']
  const entries = categories.map((category, index) => ({ id: String(index), category, body: category, review_status: 'READY', sort_order: 100 - index }))
  const sections = assembleSections(entries)
  // Neileich Updates is always first (even when empty), then regular sections in fixed order
  assert.deepEqual(sections.map(section => section.name), ['Neileich Updates', ...regularOrder])
  // Mazel Tovs is first among regular sections (index 1 after Neileich Updates)
  assert.equal(sections[1].name, 'Mazel Tovs')
  assert.equal(sections[1].entries[0].category, 'Mazal Tov')
})

test('all fixed sections appear even when some have no entries', () => {
  // Only provide entries for a few categories
  const entries = [
    { id: '1', category: 'Mazel Tov', body: 'Congrats!', review_status: 'READY' },
    { id: '2', category: 'Lost & Found', body: 'Found keys', review_status: 'READY' },
  ]
  const sections = assembleSections(entries)
  // All 9 sections (Neileich + 8 regular) must appear
  assert.equal(sections.length, 9)
  assert.deepEqual(sections.map(section => section.name), ['Neileich Updates', ...regularOrder])
  // Empty sections have no entries
  assert.equal(sections[0].entries.length, 0) // Neileich Updates - empty
  assert.equal(sections[1].entries.length, 1) // Mazel Tovs - has entry
  assert.equal(sections[2].entries.length, 0) // Community Updates - empty
  assert.equal(sections[7].entries.length, 1) // Lost & Found - has entry
})

test('featured Neileich entries group compactly and important updates lead their category', () => {
  const entries = [
    { id: '1', category: 'Community Updates', body: 'Regular', review_status: 'READY', sort_order: 1 },
    { id: '2', category: 'Community Updates', body: 'Urgent', is_important: true, review_status: 'READY', sort_order: 90 },
    { id: '3', category: 'Libraries & Kids', title: 'Library hours', review_status: 'READY', sort_order: 3 },
    { id: '4', category: 'Neileich Updates', title: 'Youth program', review_status: 'READY', sort_order: 2 },
    { id: '5', category: 'Lost & Found', body: 'Hidden', review_status: 'EXCLUDE', sort_order: 1 },
  ]
  const sections = assembleSections(entries)
  // All fixed sections appear, Neileich first
  assert.equal(sections[0].name, 'Neileich Updates')
  assert.deepEqual(sections[0].subgroups, ["Libraries and children's programs", 'Youth activities'])
  // Community Updates has important entry first
  const communitySection = sections.find(s => s.name === 'Community Updates')
  assert.equal(communitySection.entries[0].body, 'Urgent')
})

test('legacy flyer headings map into the configured priority without duplicate Neileich sections', () => {
  const headings = ['Lost & Found', 'Available', 'Selling', 'Library', 'Listings continued', 'Updates', 'Mazel Tov!', 'Bnos News']
  const entries = headings.map((category, index) => ({ id: String(index), category, body: category, review_status: 'READY', sort_order: index }))
  const sections = assembleSections(entries)
  // All sections appear, populated ones have entries
  const populatedSections = sections.filter(s => s.entries.length > 0).map(s => s.name)
  assert.deepEqual(populatedSections, ['Neileich Updates', 'Mazel Tovs', 'Community Updates', 'Classifieds & Services', 'Selling / For Rent', 'Lost & Found'])
  const configured = ['Neileich Updates', 'Mazel Tov', 'Community Updates', 'Classifieds & Services', 'Selling / For Rent', 'Lost & Found', 'Libraries & Kids']
  assert.deepEqual(headings.map(heading => matchCategory(heading, configured)), ['Lost & Found', 'Classifieds & Services', 'Selling / For Rent', 'Libraries & Kids', 'Classifieds & Services', 'Community Updates', 'Mazel Tov', 'Neileich Updates'])
})

test('publication info prints as the footer, not as a section', () => {
  const entries = [
    { id: '1', category: 'Publication Info', title: 'Submissions', body: 'Text only', review_status: 'READY', sort_order: 2 },
    { id: '2', category: 'Publication Info', title: 'Advertising', body: '$10 per ad', review_status: 'READY', sort_order: 1 },
    { id: '3', category: 'Publication Info', title: 'Hidden', body: 'x', review_status: 'EXCLUDE' },
    { id: '4', category: 'Mazel Tov', body: 'Simcha', review_status: 'READY' },
  ]
  assert.deepEqual(assembleSections(entries).map(section => section.name), ['Neileich Updates', ...regularOrder])
  assert.equal(assembleSections(entries).flatMap(section => section.entries).length, 1)
  assert.deepEqual(assembleFooter(entries).map(entry => entry.title), ['Advertising', 'Submissions'])
})

test('Neileich Updates and Mazel Tovs are the full-width bands', () => {
  assert.deepEqual(bannerOrder, ['Neileich Updates', 'Mazel Tovs'])
})

const sectionsOf = counts => counts.map((count, index) => ({ name: `S${index}`, entries: Array.from({ length: count }, (_, entryIndex) => ({ id: `${index}-${entryIndex}` })) }))
const heightsOf = (sections, entryHeight) => Object.fromEntries(sections.flatMap(section => [[`h-${section.name}`, 20], [`hc-${section.name}`, 20], [`empty-${section.name}`, 16], ...section.entries.map((_, index) => [`e-${section.name}-${index}`, typeof entryHeight === 'function' ? entryHeight(section, index) : entryHeight])]))
const usedHeights = (columns, sections, heights) => columns.map(blocks => blocks.reduce((sum, block) => {
  const name = sections[block.sectionIndex].name
  if (block.type === 'heading') return sum + heights[`${block.continued ? 'hc' : 'h'}-${name}`]
  if (block.type === 'empty') return sum + heights[`empty-${name}`]
  return sum + heights[`e-${name}-${block.entryIndex}`]
}, 0))

test('packed columns never exceed the page capacity (page break respected)', () => {
  const sections = sectionsOf([3, 0, 7, 1, 0, 12, 4, 0])
  const heights = heightsOf(sections, (section, index) => 30 + ((index * 17 + section.name.length * 11) % 55))
  const capacities = [400, 600]
  const { columns, unfit } = packSections(sections, heights, capacities)
  assert.equal(unfit.length, 0)
  usedHeights(columns, sections, heights).forEach((height, index) => assert.ok(height <= capacities[Math.min(Math.floor(index / 2), 1)], `column ${index} is ${height}px`))
})

test('every heading appears in order, empty sections get an empty body, headings never orphaned', () => {
  const sections = sectionsOf([2, 0, 3, 0])
  const { columns } = packSections(sections, heightsOf(sections, 50), [200])
  const blocks = columns.flat()
  assert.deepEqual(blocks.filter(block => block.type === 'heading' && !block.continued).map(block => block.sectionIndex), [0, 1, 2, 3])
  assert.equal(blocks.filter(block => block.type === 'empty').length, 2)
  columns.forEach(column => assert.notEqual(column.at(-1)?.type, 'heading'))
})

test('an entry taller than a whole column is reported as unfit', () => {
  const sections = sectionsOf([1])
  assert.equal(packSections(sections, heightsOf(sections, 500), [300]).unfit.length, 1)
})

test('empty entries array still produces all fixed sections', () => {
  const sections = assembleSections([])
  assert.equal(sections.length, 9)
  assert.deepEqual(sections.map(section => section.name), ['Neileich Updates', ...regularOrder])
  sections.forEach(section => assert.equal(section.entries.length, 0))
})
