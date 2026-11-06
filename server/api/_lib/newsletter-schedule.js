import { HDate, getSedra } from '@hebcal/core'
import { newsletterConfig, validIssueWeek } from './newsletter-config.js'

export const SHUL_SCHEDULE_URL = newsletterConfig.scheduleUrl

function nextDay(date) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)
}

function times(day, predicate) {
  return day.events.filter(predicate).map(event => event.displayTime).filter(value => typeof value === 'string' && value.trim()).join(' / ')
}

export function mapScheduleWeek(schedule, week) {
  if (!validIssueWeek(week) || schedule?.schemaVersion !== 1 || schedule.timeZone !== newsletterConfig.timezone || !Array.isArray(schedule.days)) throw new Error('Unsupported official schedule')
  const friday = schedule.days.find(day => day.date === week && day.weekday === 'Friday' && day.status === 'available')
  const saturdayDate = nextDay(week)
  const shabbos = schedule.days.find(day => day.date === saturdayDate && day.weekday === 'Shabbos' && day.status === 'available')
  if (!friday || !shabbos || !Array.isArray(friday.events) || !Array.isArray(shabbos.events)) return null
  if (!friday.parsha || friday.parsha !== shabbos.parsha) throw new Error('Parsha differs between Friday and Shabbos in the official schedule')
  const hdate = new HDate(new Date(`${saturdayDate}T12:00:00Z`))
  const parshaEnglish = getSedra(hdate.getFullYear(), false).lookup(hdate).parsha.join('-')
  const shema = event => /קר["״]?ש/.test(event.name || '')
  const mga = event => shema(event) && /מ["״]?א/.test(event.reckoning || '')
  const gra = event => shema(event) && /גר["״]?א/.test(event.reckoning || '')
  const result = {
    issue_week: week,
    friday_date: week,
    shabbos_date: saturdayDate,
    parsha_he: friday.parsha,
    parsha_en: parshaEnglish,
    candle_lighting: times(friday, event => event.name === 'הדלקת נרות'),
    friday_sunset: times(friday, event => event.name === 'שקיעה'),
    erev_shabbos_mincha: times(friday, event => event.name === 'מנחה ערב שבת'),
    friday_mincha: times(friday, event => event.name === 'מנחה מעריב'),
    friday_maariv: times(friday, event => event.category === 'maariv'),
    shacharis: times(shabbos, event => event.category === 'shacharis'),
    sof_zman_shema_mga: times(shabbos, mga),
    sof_zman_shema_gra: times(shabbos, gra),
    shabbos_mincha: times(shabbos, event => event.category === 'mincha'),
    motzai_maariv: times(shabbos, event => event.category === 'maariv'),
    shabbos_ends: '',
    source: SHUL_SCHEDULE_URL,
    notes: '',
    verification_status: 'NEEDS_REVIEW',
    original_values: { generatedAt: schedule.generatedAt, friday, shabbos },
  }
  return result
}

export async function fetchScheduleWeek(week, fetcher = fetch) {
  if (!validIssueWeek(week)) throw new Error('Choose a Friday issue date')
  const response = await fetcher(SHUL_SCHEDULE_URL, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error(`Official schedule returned ${response.status}`)
  return mapScheduleWeek(await response.json(), week)
}
