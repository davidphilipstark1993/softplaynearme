/**
 * Venue page <title>, meta description and the visible "Quick facts" block, built from
 * one list of facts so the snippet never claims anything the page doesn't show.
 *
 * Most venue traffic is a branded search ("rascal ranch leicester"), where Google also
 * shows the venue's own site and map pack. The snippet leads with the venue name (title)
 * and concrete facts (meta), then the one thing those results don't offer: a comparison
 * with the other soft plays nearby.
 *
 * Rules:
 *   - A fact appears only when the record holds it. Facility booleans default to false,
 *     so false means "unknown" and only true is ever stated.
 *   - Hours are summarised as the weekly pattern ("Open daily 9:30am–6pm"), never
 *     "open today": Google keeps a snippet for days, so "today" would go stale.
 *   - The rating is Google's and is labelled as such. It is not put in structured data.
 */
import { isSoftPlayVenueType, NON_SOFT_PLAY_VENUE_TYPE_LABELS, type NonSoftPlayVenueType } from './venueTypes'
import { cleanHoursText, formatAgeRange, formatPrice, hasStructuredHours, priceNumber, type HoursPrice } from './venueFacts'
import type { DayKey } from './ukTime'
import { formatAddressLine } from './sanitize'

export const MAX_TITLE = 60
export const MAX_META = 155
/** Radius for "Compare N other soft plays near {Town}". */
export const NEARBY_MILES = 5
/** Most venues listed in the nearby section (and so the most the meta will count). */
export const NEARBY_LIST_MAX = 20

const WEEK: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const SHORT: Record<DayKey, string> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' }

// ── Names ────────────────────────────────────────────────────────────────────────────

// Words that make a dash-tail a description ("- Indoor Softplay", "- Farmhouse Inns"), not a branch name.
const GENERIC_TAIL = /\b(play|soft|softplay|centre|center|cafe|café|fun|park|inns?|pub|wetherspoon|leisure|hire|inflatables?|indoor|outdoor|parties|party|venue|classes|room|club|city)\b/i
const SMALL_WORDS = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with', 'de'])
const NOTE_IN_BRACKETS = /\s*\((?=[^)]*\b(see|website|hours|open|opening|call|book|booking|closed|temporarily|now)\b)[^)]*\)?/gi

/**
 * The venue name as a person would type it, for the title: no "(SEE WEBSITE FOR
 * OPERATING HOURS)", no "/ INDOOR FOOTBALL" or ": Role-play Village, Sensory Room"
 * strapline, and not shouted. The H1 keeps the full stored name.
 */
export function cleanVenueName(raw: string): string {
  let n = String(raw ?? '').replace(/\s+/g, ' ').trim()
  // judged on the whole stored name: "5 ALIVE BRADFORD … / INDOOR FOOTBALL (SEE WEBSITE…)"
  const letters = n.replace(/[^A-Za-z]/g, '')
  const upper = n.replace(/[^A-Z]/g, '')
  const shouted = letters.length >= 8 && upper.length / letters.length > 0.6
  n = n.replace(NOTE_IN_BRACKETS, '').trim()
  // A strapline after "/", "|", ":" or a spaced dash. Keep the first part if it is a name.
  // A short tail after a spaced dash is a branch ("The Eden Centre - Blackwood"): keep it,
  // or two branches get the same title. A longer or comma'd tail is a strapline.
  const dash = n.match(/^(.*?)\s[-–—]\s(.+)$/)
  const branchTail = !!dash && !dash[2].includes(',') && dash[2].split(/\s+/).length <= 2 && !GENERIC_TAIL.test(dash[2])
  const head = (branchTail ? n.split(/\s*[/|]\s*|:\s+/) : n.split(/\s*[/|]\s*|:\s+|\s[-–—]\s/))[0].trim()
  if (head.length >= 3 && head !== n) n = head
  n = n
    .split(' ')
    .map((w, i) => {
      const bare = w.replace(/[^A-Za-z]/g, '')
      if (shouted && bare.length >= 4 && bare === bare.toUpperCase()) w = w.charAt(0) + w.slice(1).toLowerCase()
      // all-lowercase words ("Jungle boogie walsall") get a capital; joining words and
      // single letters ("i FUN") don't
      if (/^[a-z]{2}/.test(w) && (i === 0 || !SMALL_WORDS.has(w.toLowerCase()))) w = w.charAt(0).toUpperCase() + w.slice(1)
      return w
    })
    .join(' ')
  return n.replace(/[\s,;:.\-–—]+$/, '')
}

const includesWord = (hay: string, needle: string) =>
  new RegExp(`(^|[^a-z])${needle.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(hay.toLowerCase())

// ── Hours ────────────────────────────────────────────────────────────────────────────

type DayHours = 'closed' | { open: number; close: number } | { open: true }
export type WeekHours = Record<DayKey, DayHours>

function toMinutes(h: string, m: string | undefined, ap: string | undefined): number | null {
  let hh = parseInt(h, 10)
  const mm = parseInt(m || '0', 10)
  const p = (ap || '').toLowerCase()
  if (p === 'pm' && hh < 12) hh += 12
  if (p === 'am' && hh === 12) hh = 0
  if (hh > 24 || mm > 59) return null
  return hh * 60 + mm
}

/** One day's text ("9:30 AM – 6:00 PM", "Closed", "9 AM–12 PM, 1–5 PM") -> DayHours. */
function parseDay(text: string): DayHours | null {
  const t = text.trim()
  if (/^closed\b/i.test(t)) return 'closed'
  if (/open 24 hours/i.test(t)) return { open: true }
  const ranges = [...t.matchAll(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*[-–—]\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/gi)]
  if (ranges.length === 0) return null
  if (ranges.length > 1) return { open: true } // split day: open, but no single time range
  const r = ranges[0]
  const close = toMinutes(r[4], r[5], r[6])
  // "9–5:30 PM": the opening time takes the closing am/pm unless that makes it later
  let open = toMinutes(r[1], r[2], r[3] || r[6])
  if (open !== null && close !== null && !r[3] && open >= close) open = toMinutes(r[1], r[2], 'am')
  if (open === null || close === null || close <= open) return null
  return { open, close }
}

/**
 * All seven days, or null if the record doesn't cover the whole week in a form we can
 * read (structured per-day JSON, or Google's "Monday: 9:30 AM – 6:00 PM; Tuesday: …").
 */
export function parseWeekHours(v: HoursPrice): WeekHours | null {
  const oh = v.opening_hours as Record<string, unknown> | null | undefined
  const full = (w: Partial<WeekHours>) => (WEEK.every((d) => w[d]) ? (w as WeekHours) : null)
  // 1. structured per-day JSON
  if (hasStructuredHours(oh)) {
    const out: Partial<WeekHours> = {}
    for (const [k, raw] of Object.entries(oh as Record<string, unknown>)) {
      const day = k.toLowerCase() as DayKey
      if (!WEEK.includes(day)) continue
      if (typeof raw === 'string') {
        const d = parseDay(raw)
        if (d) out[day] = d
      } else if (raw && typeof raw === 'object' && 'open' in raw && 'close' in raw) {
        const { open, close } = raw as { open?: string; close?: string }
        if (!open || !close || open === 'closed' || close === 'closed') out[day] = 'closed'
        else {
          const d = parseDay(`${open} - ${close}`)
          if (d) out[day] = d
        }
      }
    }
    if (full(out)) return full(out)
  }
  // 2. Google's day-by-day wording. Places stores { source, weekday_text: [...] } in
  //    opening_hours; website scrapes store { text }; opening_hours_text holds the same.
  const texts = [
    Array.isArray(oh?.weekday_text) ? (oh.weekday_text as unknown[]).map(String).join('; ') : '',
    typeof oh?.text === 'string' ? oh.text : '',
    v.opening_hours_text ?? '',
  ]
  for (const raw of texts) {
    const out: Partial<WeekHours> = {}
    for (const seg of cleanHoursText(raw).split(/\s*[|;]\s*/)) {
      const m = seg.match(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*:\s*(.+)$/i)
      if (!m) continue
      const d = parseDay(m[2])
      if (d) out[m[1].toLowerCase() as DayKey] = d
    }
    if (full(out)) return full(out)
  }
  return null
}

function clock(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, '0')}${suffix}`
}

/** "Open daily 9:30am–6pm" / "Open 7 days" / "Open Tue–Sun 10am–4pm" / "Open 5 days a week". */
export function summariseHours(week: WeekHours | null): string | null {
  if (!week) return null
  const open = WEEK.filter((d) => week[d] !== 'closed')
  if (open.length === 0) return null
  const timed = open.map((d) => week[d]).filter((h): h is { open: number; close: number } => typeof h === 'object' && typeof h.open === 'number')
  const same = timed.length === open.length && timed.every((h) => h.open === timed[0].open && h.close === timed[0].close)
  const times = same ? ` ${clock(timed[0].open)}–${clock(timed[0].close)}` : ''
  // Times differ by day, but they may share an opening or a closing time.
  const allTimed = timed.length === open.length
  const partly = !same && allTimed
    ? timed.every((h) => h.open === timed[0].open)
      ? ` from ${clock(timed[0].open)}`
      : timed.every((h) => h.close === timed[0].close)
        ? ` until ${clock(timed[0].close)}`
        : ''
    : ''
  if (open.length === 7) return same ? `Open daily${times}` : `Open 7 days${partly}`
  if (open.length === 6) {
    const shut = WEEK.find((d) => week[d] === 'closed')!
    const day = `${shut.charAt(0).toUpperCase()}${shut.slice(1)}s`
    return same ? `Open${times}, closed ${day}` : `Open 6 days${partly}, closed ${day}`
  }
  // A run of consecutive days, allowing it to wrap round the week (Tue–Sun, Fri–Mon).
  const idx = open.map((d) => WEEK.indexOf(d))
  for (let start = 0; start < 7; start++) {
    const run = Array.from({ length: open.length }, (_, i) => (start + i) % 7)
    if (run.every((i) => idx.includes(i))) {
      const first = WEEK[run[0]]
      const last = WEEK[run[run.length - 1]]
      const days = run.length === 1 ? `${SHORT[first]} only` : `${SHORT[first]}–${SHORT[last]}`
      return `Open ${days}${times}`
    }
  }
  return `Open ${open.length} days a week${times}`
}

// ── Facts ────────────────────────────────────────────────────────────────────────────

export interface SnippetVenue extends HoursPrice {
  name: string
  venue_type?: string | null
  rating?: number | string | null
  google_rating?: number | string | null
  reviews_count?: number | string | null
  review_count?: number | string | null
  cafe?: boolean | null
  food_served?: boolean | null
  parking?: boolean | null
  free_parking?: boolean | null
  parties?: boolean | null
  has_party_rooms?: boolean | null
  sen_friendly?: boolean | null
  has_sen_sessions?: boolean | null
  toddler_area?: boolean | null
  baby_area?: boolean | null
  price_range?: string | null
  address?: string | null
  postcode?: string | null
  phone?: string | null
  google_place_id?: string | null
  lat?: number | string | null
  lng?: number | string | null
}

export interface VenueFacts {
  name: string
  /** Name for the title (see cleanVenueName). */
  shortName: string
  /** The town the venue is in, as the H1 shows it. */
  town: string | null
  isSoftPlay: boolean
  rating: { value: number; count: number } | null
  hours: string | null
  ages: string | null
  price: string | null
  /** Confirmed facilities only, most useful first ("Café", "Party bookings", ...). */
  features: string[]
  /** Other soft plays within NEARBY_MILES, as listed on the page. */
  nearbyCount: number
  /** True when more exist than the list shows (the meta then says "20+"). */
  nearbyMore: boolean
  /**
   * What the page lets a parent do to reach the venue, in the words the meta uses:
   * "address" (a usable address line is shown), "phone number" (a tel: link),
   * "directions" (the Get Directions button, same rule as components/venue/CTAButtons).
   */
  contact: string[]
}

const positive = (x: unknown) => {
  const n = Number(x)
  return x !== null && x !== undefined && x !== '' && Number.isFinite(n) && n > 0 ? n : null
}

export function venueFacts(v: SnippetVenue, opts: { town: string | null; nearbyCount: number; nearbyMore?: boolean }): VenueFacts {
  const value = positive(v.rating) ?? positive(v.google_rating)
  const count = positive(v.reviews_count) ?? positive(v.review_count)
  const features: string[] = []
  if (v.cafe || v.food_served) features.push('Café')
  if (v.parties || v.has_party_rooms) features.push('Party bookings')
  // the page lists sen_friendly as "SEN / Sensory Sessions" too
  if (v.has_sen_sessions || v.sen_friendly) features.push('SEN sessions')
  if (v.toddler_area) features.push('Toddler area')
  if (v.free_parking) features.push('Free parking')
  else if (v.parking) features.push('Parking')
  if (v.baby_area) features.push('Baby area')
  const from = priceNumber(v.price_from)
  const to = priceNumber(v.price_to)
  const price = from ? (to && to > from ? `${formatPrice(from)}–${formatPrice(to)}` : `From ${formatPrice(from)}`) : null
  const addressLine = formatAddressLine(v.address, v.postcode)
  const contact: string[] = []
  if (addressLine) contact.push('address')
  if (v.phone && String(v.phone).replace(/\D/g, '').length >= 10) contact.push('phone number')
  if (v.google_place_id || (Number(v.lat) && Number(v.lng)) || addressLine) contact.push('directions')
  return {
    name: v.name,
    shortName: cleanVenueName(v.name),
    town: opts.town,
    isSoftPlay: isSoftPlayVenueType(v.venue_type),
    rating: value && count && value <= 5 ? { value, count } : null,
    hours: summariseHours(parseWeekHours(v)),
    ages: formatAgeRange(v),
    price,
    features,
    nearbyCount: opts.nearbyCount,
    nearbyMore: !!opts.nearbyMore,
    contact,
  }
}

// ── Title ────────────────────────────────────────────────────────────────────────────

function kindLabel(venueType: string | null | undefined): string {
  if (isSoftPlayVenueType(venueType)) return 'Soft Play'
  const label = NON_SOFT_PLAY_VENUE_TYPE_LABELS[venueType as NonSoftPlayVenueType]
  return label ? label.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Soft Play'
}

/**
 * "{Name}, {Town}: Soft Play Info & Reviews", shortened to fit 60 characters:
 * drop "& Reviews", then "Info", then the town, then the suffix. The name always
 * comes first (these are branded searches) and is never cut mid-word.
 */
export function buildVenueSeoTitle(f: VenueFacts, venueType?: string | null): string {
  const name = f.shortName
  const where = f.town && !includesWord(name, f.town) ? `${name}, ${f.town}` : name
  const kind = kindLabel(venueType)
  const reviews = f.rating ? ' & Reviews' : ''
  const candidates = [
    `${where}: ${kind} Info${reviews}`,
    `${where}: ${kind} Info`,
    `${where}: ${kind}`,
    `${name}: ${kind} Info${reviews}`,
    `${name}: ${kind} Info`,
    `${name}: ${kind}`,
    where,
    name,
  ]
  for (const t of candidates) if (t.length <= MAX_TITLE) return t
  const words = name.split(' ')
  let out = ''
  for (const w of words) {
    if ((out ? `${out} ${w}` : w).length > MAX_TITLE) break
    out = out ? `${out} ${w}` : w
  }
  return out || name.slice(0, MAX_TITLE)
}

// ── Meta description ─────────────────────────────────────────────────────────────────

const capitalise = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

export function ratingText(r: NonNullable<VenueFacts['rating']>): string {
  return `Rated ${r.value.toFixed(1)}★ on Google (${r.count.toLocaleString('en-GB')} review${r.count === 1 ? '' : 's'})`
}

export function nearbyText(f: VenueFacts): string | null {
  if (f.nearbyCount <= 0) return null
  const n = f.nearbyMore ? `${f.nearbyCount}+` : String(f.nearbyCount)
  const other = f.isSoftPlay ? 'other ' : ''
  const noun = f.nearbyCount === 1 && !f.nearbyMore ? 'soft play' : 'soft plays'
  return `Compare ${n} ${other}${noun} near ${f.town ?? f.shortName}`
}

/**
 * Concrete facts first, then the comparison: "Rated 4.6★ on Google (210 reviews).
 * Open daily 9:30am–6pm. Café, parties and SEN sessions. Compare 7 other soft plays
 * near Shipley." Facts that don't fit are dropped whole (never cut mid-sentence), in
 * reverse order of usefulness.
 */
export function buildVenueMetaDescription(f: VenueFacts): string {
  const tail = nearbyText(f)
  const facts: string[] = []
  if (f.rating) facts.push(ratingText(f.rating))
  if (f.hours) facts.push(f.hours)
  const features = f.features.slice(0, 3)
  // "Facilities: café, party bookings and SEN sessions" (acronyms keep their capitals)
  const lower = (x: string) => (/^[A-Z]{2}/.test(x) ? x : x.charAt(0).toLowerCase() + x.slice(1))
  if (features.length) facts.push(`Facilities: ${joinList(features.map(lower))}`)
  if (f.ages) facts.push(f.ages)
  if (f.price) facts.push(`${f.price} per child`)
  // Most venue searches are the bare name: people want to find and reach the venue. When
  // there is room, say the page has the ways to do that, naming only what it shows.
  // Needs an address or phone (directions alone is not worth a sentence); dropped first.
  const reach = tail && f.contact.some((c) => c !== 'directions') ? capitalise(joinList(f.contact)) : null

  const ending = tail ?? 'Address, directions and contact details'
  // With nothing concrete to lead on, say what and where it is.
  const lead = facts.length === 0
    ? [`${f.shortName}${f.town && !includesWord(f.shortName, f.town) ? ` in ${f.town}` : ''}: ${f.isSoftPlay ? 'soft play' : 'family activity'} info`]
    : []
  const sentences = [...lead, ...facts, ...(reach ? [reach] : []), ending]
  const build = (s: string[]) => s.map((x) => `${x}.`).join(' ')
  let text = build(sentences)
  // Drop the lowest-priority sentence (never the lead or the comparison) until it fits:
  // the contact line first, then facts from the end.
  const optional = [...facts, ...(reach ? [reach] : [])]
  while (text.length > MAX_META && optional.length > 0) {
    const drop = optional.pop()!
    sentences.splice(sentences.indexOf(drop), 1)
    text = build(sentences)
  }
  if (text.length > MAX_META && features.length > 1) {
    // Still long (a long town name): fall back to the single most useful feature.
    return buildVenueMetaDescription({ ...f, features: f.features.slice(0, 1) })
  }
  return text.length <= MAX_META ? text : build([ending]).slice(0, MAX_META)
}

/** Rows for the visible Quick facts block: exactly the facts the meta can draw on. */
export function quickFactRows(f: VenueFacts): Array<{ key: string; label: string; value: string }> {
  const rows: Array<{ key: string; label: string; value: string }> = []
  if (f.rating) rows.push({ key: 'rating', label: 'Google rating', value: `${f.rating.value.toFixed(1)}★ from ${f.rating.count.toLocaleString('en-GB')} review${f.rating.count === 1 ? '' : 's'}` })
  if (f.hours) rows.push({ key: 'hours', label: 'Opening hours', value: f.hours })
  if (f.ages) rows.push({ key: 'ages', label: 'Ages', value: f.ages })
  if (f.price) rows.push({ key: 'price', label: 'Price', value: `${f.price} per child` })
  if (f.features.length) rows.push({ key: 'features', label: 'Facilities', value: f.features.join(', ') })
  return rows
}

/**
 * The week as the schema builder's openingHours map ({ monday: { open: '09:30',
 * close: '18:00' }, tuesday: 'closed' }), or null. A day with split hours can't be one
 * OpeningHoursSpecification, and a missing day reads as "closed", so then nothing is
 * emitted rather than a wrong week.
 */
export function weekHoursForSchema(week: WeekHours | null): Record<string, { open: string; close: string } | 'closed'> | null {
  if (!week) return null
  const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const out: Record<string, { open: string; close: string } | 'closed'> = {}
  for (const d of WEEK) {
    const h = week[d]
    if (h === 'closed') out[d] = 'closed'
    else if (typeof h.open === 'number' && 'close' in h) out[d] = { open: hhmm(h.open), close: h.close >= 1440 ? '23:59' : hhmm(h.close) }
    else return null
  }
  return out
}
