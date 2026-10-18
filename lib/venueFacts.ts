/**
 * Helpers that answer "do we actually hold this fact for this venue?" so that
 * cards, page copy, titles and schema only ever promise data we have. The
 * rule everywhere: absent data is shown as absent (or hidden), never guessed.
 */
import { ukNow, type DayKey } from './ukTime'

const DAY_ORDER: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export interface HoursPrice {
  /** Structured hours (DB `opening_hours` JSON): { monday: { open, close } | "09:00 - 17:00" | "closed", ... } */
  opening_hours?: unknown
  /** Free-text hours as scraped (`opening_hours_text`; the static export's `openingHoursText`). */
  opening_hours_text?: string | null
  price_from?: number | string | null
  price_to?: number | string | null
  /** Age suitability, when the DB holds it (the static JSON export does not carry these). */
  age_range_min?: number | string | null
  age_range_max?: number | string | null
  age_ranges?: string[] | null
}

/** Scraped text contains raw HTML entities and narrow/no-break spaces. */
export function cleanHoursText(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/&#8211;|&ndash;/gi, '–')
    .replace(/&#8212;|&mdash;/gi, '—')
    .replace(/&amp;/gi, '&')
    .replace(/&#?\w+;/g, ' ')
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** True when `opening_hours` is a non-empty object with at least one day set. */
export function hasStructuredHours(openingHours: unknown): boolean {
  if (!openingHours || typeof openingHours !== 'object') return false
  return Object.keys(openingHours as Record<string, unknown>).some((k) => DAY_ORDER.includes(k.toLowerCase() as DayKey))
}

/** Any usable hours data at all, structured or text. */
export function hasOpeningHours(v: HoursPrice): boolean {
  return hasStructuredHours(v.opening_hours) || cleanHoursText(v.opening_hours_text).length > 0
}

export function priceNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function hasPrice(v: HoursPrice): boolean {
  return priceNumber(v.price_from) !== null
}

/** "Ages 0–12" / "Ages 0–4, 5–8" from whatever age data the venue has, else null. */
export function formatAgeRange(v: HoursPrice): string | null {
  const min = v.age_range_min === null || v.age_range_min === undefined || v.age_range_min === '' ? null : Number(v.age_range_min)
  const max = v.age_range_max === null || v.age_range_max === undefined || v.age_range_max === '' ? null : Number(v.age_range_max)
  if (min !== null && max !== null && Number.isFinite(min) && Number.isFinite(max) && max >= min) {
    return `Ages ${min}–${max}`
  }
  const labels = (v.age_ranges ?? []).map((r) => String(r).trim()).filter(Boolean)
  return labels.length ? `Ages ${labels.join(', ')}` : null
}

export function hasAgeRange(v: HoursPrice): boolean {
  return formatAgeRange(v) !== null
}

export function formatPrice(n: number): string {
  return `£${Number.isInteger(n) ? n : n.toFixed(2)}`
}

function to12h(h: number, m: number): string {
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, '0')}${suffix}`
}

function rangeFromText(segment: string): string | null {
  const m = segment.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  if (!m) return null
  const toMinutes = (h: string, min: string | undefined, ap: string | undefined, fallbackAp: string | undefined) => {
    let hh = parseInt(h, 10)
    const period = (ap || fallbackAp || '').toLowerCase()
    if (period === 'pm' && hh < 12) hh += 12
    if (period === 'am' && hh === 12) hh = 0
    return [hh, parseInt(min || '0', 10)] as const
  }
  const closeAp = m[6]
  const [oh, om] = toMinutes(m[1], m[2], m[3], closeAp)
  const [ch, cm] = toMinutes(m[4], m[5], m[6], undefined)
  if (oh > 23 || ch > 24 || om > 59 || cm > 59) return null
  return `${to12h(oh, om)}–${to12h(ch % 24, cm)}`
}

/**
 * A short, honest hours line for a venue card.
 *   - structured hours  -> "Today 9:30am–5pm" / "Closed today"
 *   - text hours we can read for today -> same
 *   - text hours we can't parse -> "Opening hours listed" (details on venue page)
 *   - nothing -> null (caller renders "Hours not available")
 */
export function todayHoursLabel(v: HoursPrice, now = ukNow()): string | null {
  if (hasStructuredHours(v.opening_hours)) {
    const raw = (v.opening_hours as Record<string, unknown>)[now.dayKey]
    if (raw === undefined || raw === null) return 'Opening hours listed'
    if (typeof raw === 'string') {
      if (raw.toLowerCase().trim() === 'closed') return 'Closed today'
      const r = rangeFromText(raw)
      return r ? `Today ${r}` : 'Opening hours listed'
    }
    if (typeof raw === 'object' && 'open' in (raw as object) && 'close' in (raw as object)) {
      const { open, close } = raw as { open?: string; close?: string }
      if (!open || !close || open === 'closed' || close === 'closed') return 'Closed today'
      const r = rangeFromText(`${open} - ${close}`)
      return r ? `Today ${r}` : 'Opening hours listed'
    }
    return 'Opening hours listed'
  }

  const text = cleanHoursText(v.opening_hours_text)
  if (!text) return null

  // "Monday: 9:30 AM – 3:00 PM | Tuesday: …" — find today's segment if present.
  const dayName = now.dayKey
  const segments = text.split(/[|;]/).map((s) => s.trim())
  const seg = segments.find((s) => s.toLowerCase().startsWith(dayName))
  if (seg) {
    if (/closed/i.test(seg)) return 'Closed today'
    const r = rangeFromText(seg.slice(dayName.length))
    if (r) return `Today ${r}`
  }
  return 'Opening hours listed'
}
