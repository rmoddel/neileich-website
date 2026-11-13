// Fixed section order - these must always appear in this exact order, even when empty
export const regularOrder = ['Mazel Tovs', 'Community Updates', 'Events & Shiurim', 'Classifieds & Services', 'Looking For', 'Selling / For Rent', 'Lost & Found', 'Other Notices']

// Sections printed as full-width bands across the top of page 1 (two columns inside), in this order.
export const bannerOrder = ['Neileich Updates', 'Mazel Tovs']

// Category whose entries print as the newsletter footer instead of a section.
export const FOOTER_CATEGORY = 'Publication Info'

const aliases = new Map([
  ['mazel tov', 'Mazel Tovs'], ['mazal tov', 'Mazel Tovs'], ['mazel tovs', 'Mazel Tovs'], ['mazal tovs', 'Mazel Tovs'],
  ['community updates', 'Community Updates'], ['updates', 'Community Updates'], ['events & shiurim', 'Events & Shiurim'], ['events and shiurim', 'Events & Shiurim'],
  ['classifieds', 'Classifieds & Services'], ['classifieds & services', 'Classifieds & Services'], ['listings', 'Classifieds & Services'], ['listings continued', 'Classifieds & Services'], ['available', 'Classifieds & Services'], ['looking for', 'Looking For'],
  ['selling / for rent', 'Selling / For Rent'], ['selling', 'Selling / For Rent'], ['lost & found', 'Lost & Found'],
  ['other notices', 'Other Notices'], ['other community notices', 'Other Notices'],
  ['neileich updates', 'Neileich Updates'], ['neileich programs', 'Neileich Updates'], ['neileich initiatives', 'Neileich Updates'],
  ['libraries & kids', 'Neileich Updates'], ['libraries and kids', 'Neileich Updates'], ['library', 'Neileich Updates'], ['youth activities', 'Neileich Updates'], ['bnos news', 'Neileich Updates'],
  ['publication info', FOOTER_CATEGORY], ['publication information', FOOTER_CATEGORY], ['footer', FOOTER_CATEGORY],
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

const isVisible = entry => entry.review_status !== 'EXCLUDE' && !entry.deleted_at
const isFooter = entry => displayCategory(entry.category) === FOOTER_CATEGORY
const sortEntries = items => [...items].sort((a, b) => Number(Boolean(b.is_important)) - Number(Boolean(a.is_important)) || Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.id || '').localeCompare(String(b.id || '')))

export function assembleFooter(entries) {
  return sortEntries(entries.filter(entry => isVisible(entry) && isFooter(entry)))
}

export function assembleSections(entries, categories = []) {
  const configured = new Map(categories.map(item => [displayCategory(item.category), Number(item.print_order)]))
  const visible = entries.filter(entry => isVisible(entry) && !isFooter(entry))
  const grouped = new Map()
  for (const entry of visible) {
    const name = /\bneileich\b/i.test(`${entry.title || ''} ${entry.body || ''}`) ? 'Neileich Updates' : displayCategory(entry.category)
    if (!grouped.has(name)) grouped.set(name, [])
    grouped.get(name).push(entry)
  }

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

// Greedy column packer. Columns fill in order: page 1 right, page 1 left, page 2 right, ...
// capacities[p] is the usable column height on page p (the last value repeats for later pages).
// heights are keyed by section name: h-<name>, hc-<name> (continued heading), empty-<name>,
// s-<name>-<entry> (subheading) and e-<name>-<entry>.
// A block is placed only if it fits in what is left of the column, so a column never runs past
// the bottom of its page unless a single entry is taller than a whole column (reported as unfit).
export function packSections(sections, heights, capacities) {
  const columns = [[]]
  const unfit = []
  let column = 0, used = 0, currentSection = -1, currentGroup = ''
  const capacity = index => capacities[Math.min(Math.floor(index / 2), capacities.length - 1)]
  const nextColumn = () => { column += 1; columns.push([]); used = 0; currentSection = -1; currentGroup = '' }
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex]
    const key = section.name
    const headingHeight = heights[`h-${key}`] || 0
    // Empty sections still render their heading with an empty body
    if (section.entries.length === 0) {
      const needed = headingHeight + (heights[`empty-${key}`] || 0)
      if (used && used + needed > capacity(column)) nextColumn()
      columns[column].push({ type: 'heading', sectionIndex, continued: false })
      columns[column].push({ type: 'empty', sectionIndex })
      used += needed
      currentSection = sectionIndex
      continue
    }
    for (let entryIndex = 0; entryIndex < section.entries.length; entryIndex++) {
      const group = section.subgroups?.[entryIndex] || ''
      const entryHeight = heights[`e-${key}-${entryIndex}`] || 0
      const groupHeight = heights[`s-${key}-${entryIndex}`] || 0
      const continuedHeight = heights[`hc-${key}`] || headingHeight
      let headingNeeded = currentSection !== sectionIndex
      let groupNeeded = Boolean(group) && (headingNeeded || currentGroup !== group)
      // A heading never sits alone at the bottom of a column: it moves with its first entry.
      let needed = (headingNeeded ? (entryIndex > 0 ? continuedHeight : headingHeight) : 0) + (groupNeeded ? groupHeight : 0) + entryHeight
      if (used && used + needed > capacity(column)) {
        nextColumn()
        headingNeeded = true; groupNeeded = Boolean(group)
        needed = (entryIndex > 0 ? continuedHeight : headingHeight) + (groupNeeded ? groupHeight : 0) + entryHeight
      }
      if (needed > capacity(column)) unfit.push(section.entries[entryIndex])
      if (headingNeeded) columns[column].push({ type: 'heading', sectionIndex, continued: entryIndex > 0 })
      if (groupNeeded) columns[column].push({ type: 'subheading', sectionIndex, entryIndex, label: group })
      columns[column].push({ type: 'entry', sectionIndex, entryIndex })
      used += needed
      currentSection = sectionIndex; currentGroup = group
    }
  }
  return { columns, unfit }
}
