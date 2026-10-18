/**
 * "Now" in the UK. Opening hours are local times, but the server clock is UTC
 * (Vercel), so reading getDay()/getHours() directly made "Open Now" wrong by an
 * hour for half the year (BST) and wrong about the day for the first hour after
 * midnight. Everything that compares opening hours with the current time must go
 * through here.
 */
export type DayKey = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'

export interface UkNow {
  dayKey: DayKey
  /** Minutes since local midnight (0–1439). */
  minutes: number
}

export function ukNow(date: Date = new Date()): UkNow {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const hour = parseInt(get('hour'), 10) % 24
  const minute = parseInt(get('minute'), 10)
  return {
    dayKey: get('weekday').toLowerCase() as DayKey,
    minutes: hour * 60 + minute,
  }
}
