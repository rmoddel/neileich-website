export const newsletterConfig = {
  timezone: process.env.NEWSLETTER_TIMEZONE || 'America/New_York',
}

export function getCurrentIssueWeek(now = new Date(), timezone = newsletterConfig.timezone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(now).map(part => [part.type, part.value]))
  const date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)))
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)
  date.setUTCDate(date.getUTCDate() + ((5 - day + 7) % 7))
  return date.toISOString().slice(0, 10)
}

export function validIssueWeek(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 5
}
