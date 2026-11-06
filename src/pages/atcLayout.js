export const regularOrder = ['Mazel Tovs', 'Community Updates', 'Events & Shiurim', 'Classifieds', 'Looking For', 'Selling / For Rent', 'Lost & Found', 'Other community notices']

const aliases = new Map([
  ['mazel tov', 'Mazel Tovs'], ['mazal tov', 'Mazel Tovs'], ['mazel tovs', 'Mazel Tovs'], ['mazal tovs', 'Mazel Tovs'],
  ['community updates', 'Community Updates'], ['events & shiurim', 'Events & Shiurim'], ['events and shiurim', 'Events & Shiurim'],
  ['classifieds', 'Classifieds'], ['classifieds & services', 'Classifieds'], ['looking for', 'Looking For'],
  ['selling / for rent', 'Selling / For Rent'], ['lost & found', 'Lost & Found'],
  ['other notices', 'Other community notices'], ['other community notices', 'Other community notices'],
  ['neileich updates', 'Neileich Updates'], ['libraries & kids', 'Neileich Updates'],
])

export function displayCategory(value) {
  const name = String(value || '').trim()
  return aliases.get(name.toLowerCase()) || name || 'Other community notices'
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
    const name = displayCategory(entry.category)
    if (!grouped.has(name)) grouped.set(name, [])
    grouped.get(name).push(entry)
  }
  const sorted = ([name, items]) => ({
    name,
    entries: [...items].sort((a, b) => Number(Boolean(b.is_important)) - Number(Boolean(a.is_important)) || Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.id || '').localeCompare(String(b.id || ''))),
  })
  const featured = grouped.has('Neileich Updates') ? sorted(['Neileich Updates', grouped.get('Neileich Updates')]) : null
  if (featured) {
    featured.entries = [...featured.entries].sort((a, b) => {
      const order = ["Libraries and children's programs", 'Youth activities', 'Programs and initiatives', 'Other Neileich updates']
      return order.indexOf(neileichGroup(a)) - order.indexOf(neileichGroup(b)) || Number(a.sort_order || 0) - Number(b.sort_order || 0)
    })
    featured.subgroups = featured.entries.map(neileichGroup)
  }
  grouped.delete('Neileich Updates')
  const regular = [...grouped].map(sorted).sort((a, b) => {
    const ai = regularOrder.indexOf(a.name), bi = regularOrder.indexOf(b.name)
    return (ai < 0 ? 100 + (configured.get(a.name) ?? 999) : ai) - (bi < 0 ? 100 + (configured.get(b.name) ?? 999) : bi)
  })
  return [...(featured ? [featured] : []), ...regular]
}
