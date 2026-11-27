/**
 * The "About" text and FAQs on a venue page, built only from facts we hold and show on
 * that page (AdSense / thin-content work, Phase 2C, 27 Nov 2026).
 *
 * Replaces the bulk-generated descriptions ("gives parents an indoor option…", "Well
 * reviewed…", paraphrased Google reviews), which put the same sentences on ~1,300 pages
 * and sometimes called an outdoor playground "indoor soft play". Rules:
 *   - one sentence per fact; no fact, no sentence. A false facility flag means "not
 *     confirmed", so it is never stated (neither as yes nor as no).
 *   - nothing the page doesn't display: no prices, ages, hours or reviews we don't hold.
 *   - no advice, no adjectives, no "check before you go" padding. A venue with few facts
 *     gets a short summary, not a longer one.
 * The hand-researched descriptions (description_source = 'researched') and an owner's own
 * text are shown as written instead (app/soft-play/[city]/[slug]/page.tsx).
 */

export interface SummaryNearby {
  name: string
  miles: number
  area?: string | null
}

export interface SummaryInput {
  name: string
  /** "soft play centre", "trampoline park", … */
  kind: string
  address?: string | null
  /** The town the venue is in (Hessle, not Hull). */
  town: string
  /** Its neighbourhood or village, when known and different from town. */
  area?: string | null
  cafe?: boolean | null
  parking?: boolean | null
  freeParking?: boolean | null
  parties?: boolean | null
  partyRooms?: boolean | null
  toddlerArea?: boolean | null
  babyArea?: boolean | null
  senFriendly?: boolean | null
  senSessions?: boolean | null
  wheelchairAccess?: boolean | null
  outdoorPlay?: boolean | null
  ageMin?: number | null
  ageMax?: number | null
  priceFrom?: number | string | null
  priceTo?: number | string | null
  /** Rating and count of Google reviews, as shown in the page header. */
  rating?: number | null
  reviewCount?: number | null
  /** Other soft play within the page's nearby radius, nearest first (as listed on the page). */
  nearby?: SummaryNearby[]
  nearbyMore?: boolean
  nearbyMiles?: number
}

const article = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a')

function list(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

const money = (v: number | string | null | undefined): string | null => {
  const n = Number(v)
  if (v == null || v === '' || !Number.isFinite(n) || n <= 0) return null
  return Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`
}

const miles = (m: number) => (m < 0.1 ? 'under 0.1 miles' : `${m.toFixed(1)} miles`)

/**
 * The street (or estate, retail park, farm) part of an address: the first part that
 * isn't a unit number, the town or the postcode. Null when there isn't one.
 */
export function streetOf(address: string | null | undefined, town: string): string | null {
  if (!address) return null
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  for (const p of parts) {
    if (/^(unit|units|suite|flat|block)\b/i.test(p)) continue
    if (/^\d+[a-z]?$/i.test(p)) continue
    if (/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i.test(p)) {
      const rest = p.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i, '').trim()
      if (!rest || rest.toLowerCase() === town.toLowerCase()) continue
      return rest.replace(/^\d+[a-z]?\s+/i, '')
    }
    if (p.toLowerCase() === town.toLowerCase()) continue
    return p.replace(/^\d+[a-z]?[-–]?\d*[a-z]?\s+/i, '')
  }
  return null
}

const ROAD = /\b(road|rd|street|st|lane|ln|way|avenue|ave|drive|dr|close|place|pl|crescent|cres|terrace|grove|hill|row|walk|parade|square|sq|gardens|gdns|mews|court|ct|boulevard|blvd|highway|bypass|green)\.?$/i

function lead(i: SummaryInput): string {
  const street = streetOf(i.address, i.town)
  const place = i.area && i.area.toLowerCase() !== i.town.toLowerCase() ? `${i.area}, ${i.town}` : i.town
  // "on Mill Lane", but "at Birkenshaw Community Hall" / "at Kingsway Retail Park"
  const where = street ? `${ROAD.test(street) ? 'on' : 'at'} ${street} in ${place}` : `in ${place}`
  return `${i.name} is ${article(i.kind)} ${i.kind} ${where}.`
}

function facilities(i: SummaryInput): string | null {
  const have: string[] = []
  if (i.toddlerArea && i.babyArea) have.push('a toddler area and a separate baby area')
  else if (i.toddlerArea) have.push('a dedicated toddler area')
  else if (i.babyArea) have.push('a baby area')
  if (i.outdoorPlay) have.push('outdoor play as well as indoor')
  if (i.cafe) have.push('a café')
  if (i.freeParking) have.push('free parking')
  else if (i.parking) have.push('parking')
  if (i.wheelchairAccess) have.push('wheelchair access')
  return have.length ? `It has ${list(have)}.` : null
}

function ages(i: SummaryInput): string | null {
  const { ageMin: lo, ageMax: hi } = i
  if (lo == null && hi == null) return null
  if (hi != null && (lo == null || lo === 0)) return `It is for children up to age ${hi}.`
  if (lo != null && hi != null) return `It is for children aged ${lo} to ${hi}.`
  return `It is for children aged ${lo} and over.`
}

function price(i: SummaryInput): string | null {
  const from = money(i.priceFrom), to = money(i.priceTo)
  if (from && to && to !== from) return `Entry is ${from} to ${to} per child.`
  if (from) return `Entry is from ${from} per child.`
  return null
}

function sessionsAndParties(i: SummaryInput): string | null {
  const parts: string[] = []
  if (i.senSessions) parts.push('runs sessions for children with SEN')
  else if (i.senFriendly) parts.push('is listed as SEN-friendly')
  if (i.parties && i.partyRooms) parts.push('hosts birthday parties in its own party rooms')
  else if (i.parties || i.partyRooms) parts.push('hosts birthday parties')
  return parts.length ? `It ${list(parts)}.` : null
}

export function ratingSentence(i: SummaryInput): string | null {
  const r = Number(i.rating), n = Number(i.reviewCount)
  if (!(r > 0) || !(n > 0)) return null
  return `Google reviewers rate it ${r.toFixed(1)} out of 5 from ${n.toLocaleString('en-GB')} review${n === 1 ? '' : 's'}.`
}

export function nearbySentence(i: SummaryInput): string | null {
  const list = i.nearby ?? []
  if (!list.length) return null
  const [first, ...rest] = list
  const where = first.area && first.area.toLowerCase() !== i.town.toLowerCase() ? ` in ${first.area}` : ''
  const others = rest.length
    ? ` ${i.nearbyMore ? `At least ${rest.length}` : rest.length === 1 ? 'One' : String(rest.length)} more ${rest.length === 1 ? 'is' : 'are'} within ${i.nearbyMiles ?? 5} miles.`
    : ''
  return `The closest other soft play is ${first.name}${where}, ${miles(first.miles)} away.${others}`
}

/**
 * The About paragraph: what and where, plus whatever the venue is confirmed to have.
 * Never empty: the lead sentence only needs a name and a town. `nearbySentence` is kept
 * for pages with no nearby list of their own.
 */
export function buildVenueSummary(i: SummaryInput): string[] {
  // The Google rating (header, Quick facts) and the nearest venues (the list below the
  // About section) are shown elsewhere on the page, so they aren't repeated here.
  return [[lead(i), facilities(i), ages(i), price(i), sessionsAndParties(i)].filter(Boolean).join(' ')]
}

/** How many facts beyond name/place the summary could state (0 = the short version). */
export function summaryFactCount(i: SummaryInput): number {
  return [facilities(i), ages(i), price(i), sessionsAndParties(i)].filter(Boolean).length
}

/**
 * FAQs that answer with a confirmed fact. No question is asked that we can only answer
 * with "not confirmed": that answer was on every page and told a parent nothing.
 */
export function buildVenueFaqs(i: SummaryInput): Array<{ question: string; answer: string }> {
  const out: Array<{ question: string; answer: string }> = []
  const a = ages(i)
  if (a) out.push({ question: `What ages is ${i.name} for?`, answer: a.replace(/^It is/, `${i.name} is`) })
  const p = price(i)
  if (p) out.push({ question: `How much does ${i.name} cost?`, answer: p })
  if (i.toddlerArea || i.babyArea) {
    out.push({
      question: `Does ${i.name} have an area for toddlers?`,
      answer: i.toddlerArea
        ? `Yes. ${i.name} has a dedicated toddler area${i.babyArea ? ' and a separate baby area' : ''}.`
        : `${i.name} has a baby area.`,
    })
  }
  if (i.parties || i.partyRooms) {
    out.push({ question: `Can you book a birthday party at ${i.name}?`, answer: `Yes. ${i.name} hosts birthday parties${i.partyRooms ? ' and has party rooms' : ''}.` })
  }
  if (i.senSessions || i.senFriendly) {
    out.push({ question: `Is ${i.name} suitable for children with SEN?`, answer: i.senSessions ? `${i.name} runs sessions for children with special educational needs and disabilities.` : `${i.name} is listed as SEN-friendly.` })
  }
  if (i.cafe) out.push({ question: `Is there a café at ${i.name}?`, answer: `Yes, ${i.name} has a café.` })
  if (i.parking || i.freeParking) out.push({ question: `Is there parking at ${i.name}?`, answer: `Yes, ${i.name} has ${i.freeParking ? 'free ' : ''}parking.` })
  return out.slice(0, 5)
}
