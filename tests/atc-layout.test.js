import test from 'node:test'
import assert from 'node:assert/strict'
import { assembleSections, regularOrder } from '../src/pages/atcLayout.js'

test('renderer enforces category priority regardless of incoming record order', () => {
  const categories = ['Lost & Found', 'Classifieds', 'Other community notices', 'Selling / For Rent', 'Events & Shiurim', 'Community Updates', 'Looking For', 'Mazal Tov']
  const entries = categories.map((category, index) => ({ id: String(index), category, body: category, review_status: 'READY', sort_order: 100 - index }))
  const sections = assembleSections(entries)
  assert.deepEqual(sections.map(section => section.name), regularOrder)
  assert.equal(sections[0].entries[0].category, 'Mazal Tov')
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
  assert.deepEqual(sections.map(section => section.name), ['Neileich Updates', 'Community Updates'])
  assert.deepEqual(sections[0].subgroups, ["Libraries and children's programs", 'Youth activities'])
  assert.equal(sections[1].entries[0].body, 'Urgent')
})
