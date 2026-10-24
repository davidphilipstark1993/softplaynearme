/**
 * Venue-level content generation helpers.
 *
 * All functions generate text purely from available structured data.
 * They NEVER invent exact prices, times, phone numbers, or facilities.
 * Copy is written for parents, not search engines.
 *
 * Design rules:
 *  - Return useful text even with minimal data (name + city only)
 *  - Become progressively more specific as more fields are available
 *  - All outputs are stable/deterministic for the same input
 */

import type { FAQItem } from './schema'

// ── Input type (mirrors the Venue interface used in the page) ────────────

export interface VenueContentInput {
  name: string
  slug?: string
  city: string
  county?: string
  address?: string
  postcode?: string

  // Facilities
  cafe?: boolean
  parking?: boolean
  free_parking?: boolean
  parties?: boolean
  party_rooms?: boolean
  toddler_area?: boolean
  baby_area?: boolean
  sensory_area?: boolean
  role_play_area?: boolean
  sen_friendly?: boolean
  wheelchair_access?: boolean
  disabled_access?: boolean
  free_wifi?: boolean
  toilets?: boolean
  baby_change?: boolean
  facilities?: Record<string, boolean | undefined> | null

  // Booking
  accepts_walk_ins?: boolean
  prebooking_required?: boolean
  membership_available?: boolean

  // Age
  age_range_min?: number
  age_range_max?: number
  age_ranges?: string[]

  // Classification
  venue_type?: string
  indoor_or_outdoor?: string

  // Pricing
  price_from?: number
  price_to?: number

  // Opening
  opening_hours?: Record<string, unknown> | null

  // Narrative (manually supplied)
  what_to_expect?: string
  tips_before_visiting?: string
  description?: string

  // Trust
  google_rating?: number
  last_verified_at?: string

  // Images
  images?: string[]
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Return an Oxford-comma list from an array of strings. */
function listItems(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

/** Derive confirmed facility labels from a venue. */
function confirmedFacilities(v: VenueContentInput): string[] {
  const merged: Record<string, boolean | undefined> = {
    ...v.facilities,
    cafe: v.facilities?.cafe ?? v.cafe,
    parking: v.facilities?.parking ?? v.parking,
    parties: v.facilities?.parties ?? v.parties,
    toddler_area: v.facilities?.toddler_area ?? v.toddler_area,
    baby_area: v.facilities?.baby_area ?? v.baby_area,
    sen_friendly: v.facilities?.sen_friendly ?? v.sen_friendly,
    wheelchair_access: v.facilities?.wheelchair_access ?? v.wheelchair_access,
    free_wifi: v.facilities?.free_wifi ?? v.free_wifi,
  }

  const LABELS: Record<string, string> = {
    cafe: 'an on-site café',
    parking: 'parking nearby',
    parties: 'birthday party facilities',
    party_rooms: 'dedicated party rooms',
    toddler_area: 'a dedicated toddler area',
    baby_area: 'a baby play area',
    sensory_area: 'a sensory play area',
    role_play_area: 'a role-play area',
    sen_friendly: 'SEN-friendly sessions',
    wheelchair_access: 'wheelchair-accessible facilities',
    disabled_access: 'disabled access',
    free_wifi: 'free WiFi',
  }

  // Also check top-level props for new fields
  const extended: Record<string, boolean | undefined> = {
    ...merged,
    party_rooms: v.party_rooms,
    sensory_area: v.sensory_area,
    role_play_area: v.role_play_area,
    disabled_access: v.disabled_access,
  }

  return Object.entries(LABELS)
    .filter(([key]) => extended[key] === true)
    .map(([, label]) => label)
}

/** Build a human-readable age suitability string. */
function ageText(v: VenueContentInput): string | null {
  if (v.age_range_min !== undefined && v.age_range_max !== undefined) {
    if (v.age_range_min === 0) return `suitable for babies up to age ${v.age_range_max}`
    return `suitable for children aged ${v.age_range_min}–${v.age_range_max}`
  }
  if (v.age_ranges && v.age_ranges.length > 0) {
    return `suitable for ${v.age_ranges.join(', ')}`
  }
  return null
}

/** Determine the booking requirement summary. */
function bookingText(v: VenueContentInput): string | null {
  if (v.prebooking_required) return 'Booking is required in advance.'
  if (v.accepts_walk_ins === true) return 'Walk-ins are welcome, though booking ahead is always advisable during busy periods.'
  return null
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Generate a short description (~80–120 words) from available structured data.
 * Used when `venue.description` is null.
 */
export function generateVenueDescription(v: VenueContentInput): string {
  const locationStr = v.county ? `${v.city}, ${v.county}` : v.city
  const facilities = confirmedFacilities(v)
  const age = ageText(v)
  const booking = bookingText(v)

  const parts: string[] = []

  // Opening sentence
  parts.push(
    `${v.name} is a soft play centre located in ${locationStr}.`
  )

  // Age suitability
  if (age) {
    parts.push(`The venue is ${age}.`)
  }

  // Facilities
  if (facilities.length > 0) {
    parts.push(
      `Families visiting can expect ${listItems(facilities)}.`
    )
  } else {
    parts.push(
      `The venue provides children's indoor play facilities in a convenient ${v.city} location.`
    )
  }

  // Booking
  if (booking) {
    parts.push(booking)
  }

  // Always end with a contact advisory
  parts.push(
    `Contact ${v.name} directly to confirm current opening times, admission prices, and any session requirements before your visit.`
  )

  return parts.join(' ')
}

/**
 * Generate a meta description (~145–160 chars) for use in <head>.
 * Prefers factual specifics when available, stays generic when not.
 */
export function generateVenueMetaDescription(v: VenueContentInput): string {
  const facilities = confirmedFacilities(v)
  const age = ageText(v)

  let desc = `${v.name} – soft play centre in ${v.city}.`

  if (age) desc += ` ${capitalise(age)}.`

  if (facilities.length > 0) {
    // Keep it short — just the first two highlights
    const highlights = facilities.slice(0, 2).join(' and ')
    desc += ` Includes ${highlights}.`
  }

  // Only promise what the page will actually show.
  const shown = [
    v.opening_hours && Object.keys(v.opening_hours).length > 0 ? 'opening hours' : null,
    v.price_from ? 'prices' : null,
    'directions',
  ].filter(Boolean) as string[]
  desc += ` Find ${listItems(shown)} and contact details.`

  // Trim to 160 chars max
  if (desc.length > 160) {
    desc = desc.slice(0, 157) + '…'
  }

  return desc
}

function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Generate FAQ entries for a venue listing.
 * Returns only questions we can give a meaningful answer to —
 * either a confirmed fact or a clear "not yet confirmed" statement.
 *
 * Answers are deterministically varied per venue (seeded on slug/name, same
 * approach as scripts/enrich-seo-all.mjs's description templates) rather
 * than a single fixed string per branch. Without this, the majority of
 * venues — most facility booleans are unconfirmed sitewide — rendered
 * byte-identical FAQ answers differing only in the venue name. Still
 * deterministic for the same input, per this file's design rules.
 */

// FNV-1a style hash, matching scripts/enrich-seo-all.mjs's slugHash so the
// same seeding approach is used sitewide.
function contentHash(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return h
}
function lcgNext(seed: number): number {
  return (seed * 1664525 + 1013904223) >>> 0
}
function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}

export function generateVenueFAQs(v: VenueContentInput): FAQItem[] {
  const faqs: FAQItem[] = []
  const baseSeed = contentHash(v.slug || v.name)
  const seeds = [baseSeed, lcgNext(baseSeed), lcgNext(lcgNext(baseSeed)), lcgNext(lcgNext(lcgNext(baseSeed)))]

  // 1. Toddler suitability
  if (v.toddler_area || v.baby_area || v.age_range_min !== undefined) {
    if (v.toddler_area) {
      faqs.push({
        question: `Is ${v.name} suitable for toddlers?`,
        answer: pick([
          `Yes. ${v.name} has a dedicated toddler area designed for younger children. We recommend contacting the venue to check age limits and session times before visiting.`,
          `Yes — ${v.name} has a toddler-specific area separate from the main play frame. Session times and age limits are best confirmed directly with the venue.`,
          `${v.name} caters for toddlers with a dedicated area for younger children. Contact the venue ahead of your visit to confirm current age guidance.`,
        ], seeds[0]),
      })
    } else if (v.baby_area) {
      faqs.push({
        question: `Is ${v.name} suitable for babies and toddlers?`,
        answer: pick([
          `${v.name} has a baby play area. Contact the venue to confirm current session availability and age requirements for younger visitors.`,
          `Yes, there's a baby area at ${v.name}. It's worth checking with the venue directly for age limits and session availability before visiting.`,
        ], seeds[0]),
      })
    } else if (v.age_range_min !== undefined && v.age_range_min === 0) {
      faqs.push({
        question: `Is ${v.name} suitable for babies and young children?`,
        answer: `${v.name} is listed as catering to very young children. Contact the venue directly to confirm specific age requirements and available sessions.`,
      })
    }
  } else {
    faqs.push({
      question: `Is ${v.name} suitable for toddlers?`,
      answer: pick([
        `We do not yet have confirmed details about toddler-specific areas at ${v.name}. We recommend contacting the venue directly to check age suitability, session times, and available areas.`,
        `We haven't confirmed whether ${v.name} has a dedicated toddler area. The venue is the best source for current age suitability and session details.`,
        `Toddler-specific facilities at ${v.name} aren't confirmed on our listing yet — worth a quick check with the venue before you visit, especially if you have a younger child in tow.`,
        `Our listing doesn't yet confirm toddler-area details for ${v.name}. Contact the venue directly if age suitability is important for your visit.`,
      ], seeds[0]),
    })
  }

  // 2. Café
  const hasCafe = v.facilities?.cafe ?? v.cafe
  if (hasCafe === true) {
    faqs.push({
      question: `Does ${v.name} have a café or refreshments?`,
      answer: pick([
        `Yes, ${v.name} has an on-site café. Contact the venue for details on opening times and the menu.`,
        `Yes — there's an on-site café at ${v.name}. Menu and opening times are best confirmed directly with the venue.`,
        `${v.name} has a café on site, so there's no need to bring your own food. Check with the venue for current menu and hours.`,
      ], seeds[1]),
    })
  } else if (hasCafe === false) {
    faqs.push({
      question: `Does ${v.name} have a café or refreshments?`,
      answer: `${v.name} does not appear to have an on-site café. We recommend checking directly with the venue about any refreshment options available.`,
    })
  } else {
    faqs.push({
      question: `Does ${v.name} have food and drinks available?`,
      answer: pick([
        `We do not yet have confirmed information about catering at ${v.name}. Contact the venue directly to ask about refreshments.`,
        `Catering options at ${v.name} aren't confirmed on our listing. It's worth checking with the venue directly, or bringing your own snacks just in case.`,
        `We haven't confirmed whether ${v.name} has food or drink available on site — contact the venue ahead of your visit if this matters to you.`,
        `Refreshment options at ${v.name} are unconfirmed on our end. The venue's own website or social media is the most reliable source.`,
      ], seeds[1]),
    })
  }

  // 3. Parking
  const hasParking = v.facilities?.parking ?? v.parking
  if (hasParking === true) {
    const freeNote = v.free_parking ? ' Free parking is available.' : ' Check with the venue regarding parking charges.'
    faqs.push({
      question: `Is parking available at ${v.name}?`,
      answer: `Yes, parking is available at or near ${v.name}.${freeNote}`,
    })
  } else if (hasParking === false) {
    faqs.push({
      question: `Is parking available at ${v.name}?`,
      answer: `${v.name} does not appear to have dedicated parking. We suggest using local public parking and checking with the venue for the nearest options.`,
    })
  } else {
    faqs.push({
      question: `Is parking available near ${v.name}?`,
      answer: pick([
        `Parking availability has not yet been confirmed for ${v.name}. We recommend contacting the venue or checking local parking options near ${v.address || v.city}.`,
        `We don't have confirmed parking details for ${v.name} yet. Local parking near ${v.address || v.city} is worth checking in advance if you're driving.`,
        `Parking at ${v.name} isn't confirmed on our listing — the venue or a quick map search of ${v.address || v.city} should help before you set off.`,
      ], seeds[2]),
    })
  }

  // 4. Booking requirement
  if (v.prebooking_required === true) {
    faqs.push({
      question: `Do I need to book in advance to visit ${v.name}?`,
      answer: `Yes, advance booking is required at ${v.name}. Contact the venue or visit their website to check availability and book your session.`,
    })
  } else if (v.accepts_walk_ins === true) {
    faqs.push({
      question: `Do I need to book in advance to visit ${v.name}?`,
      answer: `Walk-ins are accepted at ${v.name}. However, booking ahead is advisable during weekends and school holidays when sessions can fill up quickly.`,
    })
  } else {
    faqs.push({
      question: `Do I need to book in advance to visit ${v.name}?`,
      answer: pick([
        `Booking requirements for ${v.name} have not yet been confirmed on our listing. We recommend checking with the venue directly before your visit.`,
        `We haven't confirmed whether ${v.name} requires advance booking. It's worth checking their website or calling ahead, particularly for weekends.`,
        `Whether ${v.name} takes walk-ins or requires booking isn't confirmed on our end — a quick check with the venue before you travel is the safest bet.`,
      ], seeds[3]),
    })
  }

  // 5. SEN sessions (only show if positive signal)
  const isSen = v.facilities?.sen_friendly ?? v.sen_friendly
  if (isSen === true) {
    faqs.push({
      question: `Does ${v.name} offer SEN-friendly sessions?`,
      answer: `Yes, ${v.name} is listed as SEN friendly. Please contact the venue directly to confirm session times, any specific accommodations, and booking requirements.`,
    })
  }

  // 6. Birthday parties (only show if positive signal)
  const hasParties = v.facilities?.parties ?? v.parties
  if (hasParties === true) {
    faqs.push({
      question: `Can I book a birthday party at ${v.name}?`,
      answer: `Yes, ${v.name} offers birthday party packages. Contact the venue directly for details on party room availability, pricing, and how to book.`,
    })
  }

  // 7. Accessibility
  const isAccessible = v.wheelchair_access === true || v.disabled_access === true
  if (isAccessible) {
    faqs.push({
      question: `Is ${v.name} wheelchair accessible?`,
      answer: `${v.name} is listed as wheelchair/disabled accessible. Contact the venue to confirm the specific accessibility features available.`,
    })
  }

  // 8. Sensory area (only show if positive)
  if (v.sensory_area === true) {
    faqs.push({
      question: `Does ${v.name} have a sensory play area?`,
      answer: `Yes, ${v.name} is listed as having a sensory area. Contact the venue to confirm current availability and any session requirements.`,
    })
  }

  // 9. Role play area (only show if positive)
  if (v.role_play_area === true) {
    faqs.push({
      question: `Does ${v.name} have a role-play area?`,
      answer: `Yes, ${v.name} includes a role-play area. Contact the venue for further details.`,
    })
  }

  return faqs
}

/**
 * Compute a completeness score (0–100) from available venue data.
 *
 * Scoring:
 *   name        10   (always present)
 *   address     10
 *   phone       10
 *   website     10
 *   description 15
 *   hours       10
 *   pricing     10
 *   facilities  10   (at least one confirmed boolean)
 *   images       5   (any images stored)
 *   email        5
 *   lat/lng      5
 *  ─────────────
 *  Max         100
 */
export function computeCompletenessScore(v: VenueContentInput & {
  phone?: string
  website?: string
  email?: string
  lat?: number
  lng?: number
}): number {
  let score = 0

  if (v.name) score += 10
  if (v.address) score += 10
  if (v.phone) score += 10
  if (v.website) score += 10
  if (v.description) score += 15
  if (v.opening_hours) score += 10
  if (v.price_from) score += 10

  const hasFacilities =
    v.cafe || v.parking || v.parties || v.toddler_area ||
    v.baby_area || v.sen_friendly || v.wheelchair_access ||
    (v.facilities && Object.values(v.facilities).some(Boolean))
  if (hasFacilities) score += 10

  if (v.images && v.images.length > 0) score += 5
  if (v.email) score += 5
  if (v.lat && v.lng) score += 5

  return Math.min(score, 100)
}

/** Minimum score required for a page to be indexed by search engines. */
export const NOINDEX_THRESHOLD = 20

/**
 * venue_types that are real, visitable places but not soft play: public park
 * playgrounds, leisure centres, mobile/equipment hire, retail. They stay
 * reachable (the "Other family activities" tab, direct links) but are never
 * indexed or listed in the sitemap: they are not what anyone searching "soft
 * play near me" wants, and as a group they are thin (park playgrounds average
 * a completeness score of 45). Hundreds of low-value indexable URLs is what
 * Search Console files under "Crawled / Discovered – currently not indexed".
 */
const NOINDEX_VENUE_TYPES = ['park-playground', 'leisure-centre', 'mobile-hire', 'retail']

/**
 * The single indexability rule for a venue page. The page's robots meta and the
 * sitemap both call this, so the sitemap can never list a noindex URL.
 */
export function isVenueIndexable(score: number, venueType?: string | null): boolean {
  if (venueType && NOINDEX_VENUE_TYPES.includes(venueType)) return false
  return score >= NOINDEX_THRESHOLD
}
