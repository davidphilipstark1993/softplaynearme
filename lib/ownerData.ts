/**
 * What a verified owner can add to their listing (venue_owner_data), how it is validated,
 * how complete a listing is, and how it is merged over the Google / generated base row when
 * the venue page renders. Owner data always wins; a field the owner hasn't filled leaves the
 * base value alone. Pure functions only (no DB), so they can be unit-tested.
 */

export const OWNER_DESCRIPTION_MAX = 600
const TEXT_MAX = 400
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
type Day = (typeof DAYS)[number]

export interface OwnerPrices {
  under_1s?: number | null
  under_5s?: number | null
  over_5s?: number | null
  adults?: number | null
  notes?: string | null
}
export interface OwnerFacilities {
  cafe?: boolean | null
  parking?: boolean | null
  baby_change?: boolean | null
  accessible?: boolean | null
}
export interface OwnerEvent {
  title: string
  date: string // YYYY-MM-DD
  description?: string | null
}
export type OwnerHours = Partial<Record<Day, { open: string; close: string } | 'closed'>>

export interface OwnerData {
  prices?: OwnerPrices | null
  age_min?: number | null
  age_max?: number | null
  toddler_sessions?: string | null
  sen_sessions?: string | null
  party_packages?: string | null
  opening_hours_override?: OwnerHours | null
  photos?: string[] | null
  events?: OwnerEvent[] | null
  owner_description?: string | null
  facilities?: OwnerFacilities | null
}

/** The editable fields, in form order. Also the venue_edit_log field names. */
export const OWNER_FIELDS = [
  'owner_description', 'prices', 'age_min', 'age_max', 'opening_hours_override', 'toddler_sessions',
  'sen_sessions', 'party_packages', 'facilities', 'photos', 'events',
] as const
export type OwnerField = (typeof OWNER_FIELDS)[number]

// ── Validation ─────────────────────────────────────────────────────────────────────

const money = (x: unknown): number | null => {
  if (x === null || x === undefined || x === '') return null
  const n = Number(x)
  return Number.isFinite(n) && n >= 0 && n <= 200 ? Math.round(n * 100) / 100 : NaN
}
const text = (x: unknown, max = TEXT_MAX): string | null => {
  if (x === null || x === undefined) return null
  const s = String(x).replace(/\s+/g, ' ').trim()
  return s ? s.slice(0, max) : null
}
const age = (x: unknown): number | null => {
  if (x === null || x === undefined || x === '') return null
  const n = Number(x)
  return Number.isInteger(n) && n >= 0 && n <= 18 ? n : NaN
}
const time = (x: unknown) => typeof x === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x)

/**
 * Clean an owner's submission. Returns the cleaned data (only the fields that were sent)
 * or a list of human-readable errors. Unknown fields are ignored.
 */
export function validateOwnerData(input: Record<string, unknown>): { data: OwnerData; errors: string[] } {
  const data: OwnerData = {}
  const errors: string[] = []
  const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k)

  if (has('owner_description')) {
    const d = input.owner_description == null ? null : String(input.owner_description).trim()
    if (d && d.length > OWNER_DESCRIPTION_MAX) errors.push(`Description must be ${OWNER_DESCRIPTION_MAX} characters or fewer`)
    else data.owner_description = d || null
  }
  if (has('prices')) {
    const p = (input.prices ?? {}) as Record<string, unknown>
    const out: OwnerPrices = {}
    for (const k of ['under_1s', 'under_5s', 'over_5s', 'adults'] as const) {
      const v = money(p[k])
      if (Number.isNaN(v)) errors.push(`Price (${k.replace('_', ' ')}) must be a number between 0 and 200`)
      else if (v !== null) out[k] = v
    }
    const notes = text(p.notes, 200)
    if (notes) out.notes = notes
    data.prices = Object.keys(out).length ? out : null
  }
  for (const k of ['age_min', 'age_max'] as const) {
    if (has(k)) {
      const v = age(input[k])
      if (Number.isNaN(v)) errors.push('Ages must be whole numbers from 0 to 18')
      else data[k] = v
    }
  }
  if (data.age_min != null && data.age_max != null && data.age_min > data.age_max) errors.push('Minimum age must not be above maximum age')
  for (const k of ['toddler_sessions', 'sen_sessions', 'party_packages'] as const) {
    if (has(k)) data[k] = text(input[k], k === 'party_packages' ? 600 : TEXT_MAX)
  }
  if (has('opening_hours_override')) {
    const h = input.opening_hours_override
    if (h == null) data.opening_hours_override = null
    else if (typeof h !== 'object' || Array.isArray(h)) errors.push('Opening hours are not in the right format')
    else {
      const out: OwnerHours = {}
      for (const d of DAYS) {
        const v = (h as Record<string, unknown>)[d]
        if (v === undefined || v === null || v === '') continue
        if (v === 'closed') { out[d] = 'closed'; continue }
        const { open, close } = (v ?? {}) as Record<string, unknown>
        if (!time(open) || !time(close) || String(open) >= String(close)) errors.push(`Opening hours for ${d}: use HH:MM, opening before closing`)
        else out[d] = { open: String(open), close: String(close) }
      }
      data.opening_hours_override = Object.keys(out).length ? out : null
    }
  }
  if (has('facilities')) {
    const f = (input.facilities ?? {}) as Record<string, unknown>
    const out: OwnerFacilities = {}
    for (const k of ['cafe', 'parking', 'baby_change', 'accessible'] as const) if (typeof f[k] === 'boolean') out[k] = f[k] as boolean
    data.facilities = Object.keys(out).length ? out : null
  }
  if (has('photos')) {
    const list = Array.isArray(input.photos) ? input.photos : []
    const ok = list.filter((u): u is string => typeof u === 'string' && /^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\//i.test(u))
    if (ok.length !== list.length) errors.push('Photos must be uploaded through the dashboard')
    data.photos = ok.slice(0, 12)
  }
  if (has('events')) {
    const list = Array.isArray(input.events) ? input.events : []
    const out: OwnerEvent[] = []
    for (const e of list.slice(0, 12)) {
      const r = (e ?? {}) as Record<string, unknown>
      const title = text(r.title, 100)
      const date = typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null
      if (!title && !date) continue
      if (!title || !date) { errors.push('Each event needs a title and a date'); continue }
      out.push({ title, date, description: text(r.description, 300) })
    }
    data.events = out.length ? out : null
  }
  return { data, errors }
}

// ── Completeness ───────────────────────────────────────────────────────────────────

/** 0–100: how much of the owner form is filled in. Drives the progress bar and a small ranking boost. */
export function ownerCompleteness(d: OwnerData | null | undefined): number {
  if (!d) return 0
  const checks = [
    !!d.owner_description,
    !!d.prices && ['under_1s', 'under_5s', 'over_5s', 'adults'].some((k) => d.prices?.[k as keyof OwnerPrices] != null),
    d.age_min != null || d.age_max != null,
    !!d.opening_hours_override && Object.keys(d.opening_hours_override).length > 0,
    !!d.toddler_sessions,
    !!d.sen_sessions,
    !!d.party_packages,
    !!d.facilities && Object.keys(d.facilities).length > 0,
    !!d.photos && d.photos.length > 0,
    !!d.events && d.events.length > 0,
  ]
  return Math.round((100 * checks.filter(Boolean).length) / checks.length)
}

/** Ranking tie-breaker in smoothed-rating stars: at most 0.2, so a clearly better venue still wins. */
export function listingBoost(v: { claimed_by_owner?: boolean | null; owner_completeness?: number | null }): number {
  return (v.claimed_by_owner ? 0.1 : 0) + Math.min(100, Math.max(0, Number(v.owner_completeness ?? 0))) / 1000
}

// ── Merge for rendering ────────────────────────────────────────────────────────────

export interface MergeableVenue {
  description?: string | null
  price_from?: number | string | null
  price_to?: number | string | null
  age_range_min?: number | string | null
  age_range_max?: number | string | null
  opening_hours?: unknown
  cafe?: boolean | null
  parking?: boolean | null
  wheelchair_access?: boolean | null
  changing_facilities?: boolean | null
  baby_change?: boolean | null
  has_sen_sessions?: boolean | null
  parties?: boolean | null
}

/**
 * The venue row with the owner's data laid over it. Prices become price_from/price_to
 * (children's prices only), the hours override replaces the hours, and facilities the
 * owner has set (true or false) replace the base flags.
 */
export function mergeOwnerData<T extends MergeableVenue>(venue: T, owner: OwnerData | null | undefined): T {
  if (!owner) return venue
  const out: T = { ...venue }
  if (owner.owner_description) out.description = owner.owner_description
  const child = [owner.prices?.under_1s, owner.prices?.under_5s, owner.prices?.over_5s].filter((n): n is number => typeof n === 'number' && n > 0)
  if (child.length) {
    out.price_from = Math.min(...child)
    out.price_to = Math.max(...child) > Math.min(...child) ? Math.max(...child) : null
  }
  if (owner.age_min != null || owner.age_max != null) {
    out.age_range_min = owner.age_min ?? 0
    out.age_range_max = owner.age_max ?? null
  }
  if (owner.opening_hours_override && Object.keys(owner.opening_hours_override).length) {
    // A partial override is merged day by day over structured base hours if there are any.
    const base = venue.opening_hours && typeof venue.opening_hours === 'object' && !('weekday_text' in (venue.opening_hours as object))
      ? (venue.opening_hours as Record<string, unknown>)
      : {}
    out.opening_hours = { ...base, ...owner.opening_hours_override }
  }
  const f = owner.facilities ?? {}
  if (typeof f.cafe === 'boolean') out.cafe = f.cafe
  if (typeof f.parking === 'boolean') out.parking = f.parking
  if (typeof f.accessible === 'boolean') out.wheelchair_access = f.accessible
  if (typeof f.baby_change === 'boolean') { out.changing_facilities = f.baby_change; out.baby_change = f.baby_change }
  if (owner.sen_sessions) out.has_sen_sessions = true
  if (owner.party_packages) out.parties = true
  return out
}

/** Upcoming events only (today or later), soonest first. */
export function upcomingEvents(events: OwnerEvent[] | null | undefined, today = new Date().toISOString().slice(0, 10)): OwnerEvent[] {
  return (events ?? []).filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date))
}

/** "Under 1s £2.50 · Under 5s £6 · Over 5s £8 · Adults free" for display. */
export function priceLines(p: OwnerPrices | null | undefined): string[] {
  if (!p) return []
  const fmt = (n: number) => (n === 0 ? 'free' : `£${Number.isInteger(n) ? n : n.toFixed(2)}`)
  const out: string[] = []
  if (p.under_1s != null) out.push(`Under 1s: ${fmt(p.under_1s)}`)
  if (p.under_5s != null) out.push(`Under 5s: ${fmt(p.under_5s)}`)
  if (p.over_5s != null) out.push(`Over 5s: ${fmt(p.over_5s)}`)
  if (p.adults != null) out.push(`Adults: ${fmt(p.adults)}`)
  return out
}
