import { useEffect, useState } from 'react'
import AtcNewsletter from './AtcNewsletter.jsx'
import './AroundTheCommons.css'

const categoryOrder = ['Other community notices', 'Lost & Found', 'Selling / For Rent', 'Looking For', 'Classifieds', 'Events & Shiurim', 'Community Updates', 'Mazal Tov', 'Neileich Updates']
const examples = [
  'The community is invited to a practical evening shiur. Details and registration will be available at the shul office.',
  'Mazal tov to the family on their simcha. May they continue to see much nachas and joy.',
  'ספריית הילדים תהיה פתוחה אחרי התפילה. Families are welcome to stop by and borrow books.',
  'A community member is looking for a used stroller in good condition. Please call for details.',
]
const mode = new URLSearchParams(window.location.search).get('mode') || 'medium'
const perCategory = mode === 'short' ? 2 : mode === 'long' ? 14 : 4
const repeat = mode === 'long' ? 3 : mode === 'medium' ? 2 : 1
const entries = categoryOrder.flatMap((category, categoryIndex) => Array.from({ length: perCategory }, (_, index) => ({
  id: `${categoryIndex}-${index}`,
  category,
  title: category === 'Neileich Updates' && index === 0 ? 'Children’s library' : `${category} notice ${index + 1}`,
  body: Array(repeat).fill(examples[(categoryIndex + index) % examples.length]).join(' '),
  review_status: 'READY',
  is_important: category === 'Community Updates' && index === 1,
  sort_order: categoryIndex * 100 + index,
}))).concat([
  ['Submissions', 'Text message only; no voice messages.'],
  ['Advertising', 'Local businesses, services and sales. $10 per ad, due before Shabbos.'],
  ['Delivery', 'Delivery to every house every week is not guaranteed; this is a community project.'],
].map(([title, body], index) => ({ id: `footer-${index}`, category: 'Publication Info', title, body, review_status: 'READY', sort_order: index })))
  .reverse()
const issue = {
  week: '2026-11-06',
  categories: categoryOrder.map((category, print_order) => ({ category, print_order })),
  shabbos: { verification_status: 'VERIFIED', parsha_he: 'חיי שרה', parsha_en: 'Chayei Sara', candle_lighting: '4:30 PM', friday_sunset: '4:48 PM', friday_mincha: '4:33 PM', shacharis: '7:30 / 8:15 AM', sof_zman_shema_mga: '8:31 AM', sof_zman_shema_gra: '9:07 AM', shabbos_mincha: '1:20 / 4:03 / 4:18 PM', motzai_maariv: '5:48 / 6:00 PM' },
}

export default function AtcPreviewFixture() {
  const [visibleEntries, setVisibleEntries] = useState(() => mode === 'delete' ? entries.filter(entry => entry.category !== 'Other community notices' || entry.id === '0-0') : entries)
  useEffect(() => {
    if (mode !== 'delete') return
    const timer = setTimeout(() => setVisibleEntries(current => current.filter(entry => entry.id !== '0-0')), 100)
    return () => clearTimeout(timer)
  }, [])
  return <div className="atc-shell"><div className="atc-preview"><AtcNewsletter issue={issue} entries={visibleEntries} /></div></div>
}
