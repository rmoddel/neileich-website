// Fixed section order - these must always appear in this exact order, even when empty
export const regularOrder = ['Mazel Tovs', 'Community Updates', 'Events & Shiurim', 'Classifieds & Services', 'Looking For', 'Selling / For Rent', 'Lost & Found', 'Other Notices']

const aliases = new Map([
  ['mazel tov', 'Mazel Tovs'], ['mazal tov', 'Mazel Tovs'], ['mazel tovs', 'Mazel Tovs'], ['mazal tovs', 'Mazel Tovs'],
  ['community updates', 'Community Updates'], ['updates', 'Community Updates'], ['events & shiurim', 'Events & Shiurim'], ['events and shiurim', 'Events & Shiurim'],
  ['classifieds', 'Classifieds & Services'], ['classifieds & services', 'Classifieds & Services'], ['listings', 'Classifieds & Services'], ['listings continued', 'Classifieds & Services'], ['available', 'Classifieds & Services'], ['looking for', 'Looking For'],
  ['selling / for rent', 'Selling / For Rent'], ['selling', 'Selling / For Rent'], ['lost & found', 'Lost & Found'],
  ['other notices', 'Other Notices'], ['other community notices', 'Other Notices'],
  ['neileich updates', 'Neileich Updates'], ['neileich programs', 'Neileich Updates'], ['neileich initiatives', 'Neileich Updates'],
  ['libraries & kids', 'Neileich Updates'], ['libraries and kids', 'Neileich Updates'], ['library', 'Neileich Updates'], ['youth activities', 'Neileich Updates'], ['bnos news', 'Neileich Updates'],
])

export function displayCategory(value) {
  const name = String(value || '').trim().replace(/[!:]+$/, '').trim()
  return aliases.get(name.toLowerCase()) || name || 'Other Notices'
}

function neileichGroup(entry) {
  const text = `${entry.category || ''} ${entry.title || ''} ${entry.body || ''}`.toLowerCase()
  if (/librar|children|kids|storybook|reading program/.test(text)) return "Libraries and children's programs"
  if (/youth|teen|boys program|girls program/.test(text)) return 'Youth activities'
  if (/program|initiative|shiur|class|project/.test(text)) return 'Programs and initiatives'
  return 'Other Neileich updates'
}

export function assembleSections(entries, categories = []) {
  const configured = new Map(categories.map(item => [displayCategory(item.category), Number(item.print_order)]))
  const visible = entries.filter(entry => entry.review_status !== 'EXCLUDE' && !entry.deleted_at)
  const grouped = new Map()
  for (const entry of visible) {
    const name = /\bneileich\b/i.test(`${entry.title || ''} ${entry.body || ''}`) ? 'Neileich Updates' : displayCategory(entry.category)
    if (!grouped.has(name)) grouped.set(name, [])
    grouped.get(name).push(entry)
  }
  const sortEntries = items => [...items].sort((a, b) => Number(Boolean(b.is_important)) - Number(Boolean(a.is_important)) || Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.id || '').localeCompare(String(b.id || '')))

  // Featured section (Neileich Updates) - always present, even when empty
  const neileichEntries = grouped.get('Neileich Updates') || []
  const featured = { name: 'Neileich Updates', entries: sortEntries(neileichEntries) }
  if (featured.entries.length > 0) {
    featured.entries = [...featured.entries].sort((a, b) => {
      const order = ["Libraries and children's programs", 'Youth activities', 'Programs and initiatives', 'Other Neileich updates']
      return order.indexOf(neileichGroup(a)) - order.indexOf(neileichGroup(b)) || Number(a.sort_order || 0) - Number(b.sort_order || 0)
    })
    featured.subgroups = featured.entries.map(neileichGroup)
  }
  grouped.delete('Neileich Updates')

  // Regular sections - all fixed sections must always appear in exact order, even when empty
  const regular = regularOrder.map(name => {
    const items = grouped.get(name) || []
    grouped.delete(name)
    return { name, entries: sortEntries(items) }
  })

  // Append any extra categories not in the fixed order (sorted by configured print_order)
  const extra = [...grouped].map(([name, items]) => ({ name, entries: sortEntries(items) }))
    .sort((a, b) => (configured.get(a.name) ?? 999) - (configured.get(b.name) ?? 999))

  return [featured, ...regular, ...extra]
}
