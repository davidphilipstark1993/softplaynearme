/**
 * Titles and meta descriptions for city hubs, generated from what the data
 * actually supports. The previous hand-written copy promised "Prices & Ages"
 * on every hub, but only 4 of ~1,070 venues have a price and the data has no
 * age-range field at all. A claim is only made once at least
 * MIN_COVERAGE_FOR_CLAIM of the city's venues carry the data behind it.
 */
import { MIN_COVERAGE_FOR_CLAIM, type CityStats } from './cityStats'

const BRAND_SUFFIX = ' | Soft Play Near Me'
/** Titles longer than this get truncated in results. */
const MAX_TITLE = 60
const MAX_DESCRIPTION = 155

export interface CityMeta {
  title: string
  description: string
}

/** What this city's data lets us say, most valuable first. */
export function supportedClaims(stats: CityStats): string[] {
  const claims: string[] = []
  if (stats.priceCoverage >= MIN_COVERAGE_FOR_CLAIM) claims.push('Prices')
  if (stats.ageCoverage >= MIN_COVERAGE_FOR_CLAIM) claims.push('Ages')
  if (stats.hoursCoverage >= MIN_COVERAGE_FOR_CLAIM) claims.push('Hours')
  if (stats.ratingCoverage >= MIN_COVERAGE_FOR_CLAIM) claims.push('Reviews')
  return claims
}

function joinClaims(claims: string[]): string {
  if (claims.length <= 1) return claims.join('')
  return `${claims.slice(0, -1).join(', ')} & ${claims[claims.length - 1]}`
}

/**
 * `Soft Play in London: 63 Centres, Hours & Reviews`. This is the complete
 * <title> (the page opts out of the site template): the brand is appended only
 * when there is room. Claims (Hours, Reviews, Prices, Ages) appear only when
 * enough of the city's venues carry that data.
 */
export function buildCityTitle(name: string, stats: CityStats): string {
  const centres = `${stats.total} ${stats.total === 1 ? 'Centre' : 'Centres'}`
  if (stats.total === 0) return `Soft Play in ${name}`
  const claims = supportedClaims(stats)
  // Richest title that fits: two claims, then one, then none. No year, so it never goes stale.
  for (const n of [2, 1, 0]) {
    const picked = claims.slice(0, n)
    const claimText = picked.length === 1 ? ` & ${picked[0]}` : picked.length ? `, ${joinClaims(picked)}` : ''
    const title = `Soft Play in ${name}: ${centres}${claimText}`
    if (title.length <= MAX_TITLE) return title.length + BRAND_SUFFIX.length <= MAX_TITLE ? title + BRAND_SUFFIX : title
  }
  return `Soft Play in ${name}`
}

function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`
}

export function buildCityDescription(name: string, county: string, stats: CityStats): string {
  // "London, Greater London" / "Hull, Hull" add nothing — skip a county that repeats the name.
  const where = county && !county.toLowerCase().includes(name.toLowerCase()) ? `${name}, ${county}` : name
  if (stats.total === 0) {
    return `Soft play in ${where}: we're still building our listings for this area. Browse nearby towns or add a venue we've missed.`
  }

  const facts: string[] = []
  if (stats.toddler > 0) facts.push(`${stats.toddler} with toddler areas`)
  if (stats.parties > 0) facts.push(`${stats.parties} offering parties`)
  if (stats.sen > 0) facts.push(`${stats.sen} SEN-friendly`)

  const lead = `Compare ${plural(stats.total, 'soft play centre')} in ${where}`
  const claims = supportedClaims(stats).map((c) => c.toLowerCase())
  const tail = claims.length
    ? ` Includes ${claims.join(', ')} and facilities.`
    : ' Includes facilities, ratings where available and contact details.'

  // A named, rated venue is the most clickable thing a snippet can carry — it
  // is real and different for every city. Only venues with enough reviews to
  // be a fair "top rated" are used (stats.topRated). Preferred when it fits
  // alongside at least one fact; otherwise fall back to the facts alone.
  const top = stats.topRated[0]
  const topSentence = top && top.name.length <= 40 ? ` Top rated: ${top.name} (${top.rating.toFixed(1)}\u2605).` : ''

  // Drop facts from the end until it fits — never truncate mid-phrase.
  for (const withTop of topSentence ? [true, false] : [false]) {
    for (let n = facts.length; n >= (withTop && facts.length ? 1 : 0); n--) {
      const body = n > 0 ? `${lead}: ${facts.slice(0, n).join(', ')}.` : `${lead}.`
      const text = `${body}${withTop ? topSentence : ''}${tail}`
      if (text.length <= MAX_DESCRIPTION) return text
    }
  }
  return `${lead}.`
}

export function buildCityMeta(name: string, county: string, stats: CityStats): CityMeta {
  return {
    title: buildCityTitle(name, stats),
    description: buildCityDescription(name, county, stats),
  }
}

// ── "Near me" overrides for the hubs flagged in the 12 Nov 2026 CTR audit ──────────────
//
// Search Console showed these hubs earning very few clicks for their impressions, and
// the generated title (`Soft Play in {City}: N Centres, Hours & Reviews`) never says
// "near me" — the way most parents search. Each override is a pattern filled from the
// hub's LIVE stats (never frozen numbers):
//
//   title        Soft Play Near Me in {City}: {N} Centres
//   description  Find {N} soft play centres near you in {place}, including {facts}. Compare …
//
// A fact is dropped when its live count is 0; "hours" appears in the closing sentence
// only where the config allows it AND enough of the hub's venues have hours
// (MIN_COVERAGE_FOR_CLAIM) — Birmingham, Manchester, Liverpool and Bristol never claim it.
// Anything over 155 characters loses facts from the end, never mid-phrase.
// Hubs not listed here keep buildCityTitle/buildCityDescription (benchmark hubs such as
// Sunderland, Leicester, Worthing and Dartford are deliberately untouched).

type Fact = 'parties' | 'toddler' | 'sen'
type Tail = 'hours' | 'reviews' | 'facilities'

interface OverrideConfig {
  /** How the facts are introduced: `, including A and B.` / `: A, B and C.` / `, with A and B.` */
  style: 'including' | 'colon' | 'with'
  facts: Fact[]
  /** Wording of the party fact: "13 with birthday parties" vs "6 that offer / offering birthday parties". */
  parties?: 'with' | 'offer'
  /** Closing "Compare …" sentence, in this order; `hours` is only said when the live data backs it. */
  tail: Tail[]
  /** Appended after the tail items, e.g. " in Staffordshire". */
  tailPlace?: string
  /** Place text if it isn't just the hub name, e.g. "Beverley, East Yorkshire". */
  place?: string
  /** Add " Top rated: {name} ({rating}★)." from the hub's best-rated venue (20+ reviews). */
  topRated?: boolean
}

const FOR_NORFOLK = ' for families across Norfolk'
const OVERRIDES: Record<string, OverrideConfig> = {
  london: { style: 'including', facts: ['parties', 'toddler'], parties: 'with', tail: ['facilities', 'reviews', 'hours'] },
  birmingham: { style: 'colon', facts: ['parties', 'toddler', 'sen'], tail: ['reviews', 'facilities'] },
  manchester: { style: 'including', facts: ['parties', 'toddler'], parties: 'offer', tail: ['reviews', 'facilities'] },
  edinburgh: { style: 'including', facts: ['parties', 'toddler'], parties: 'offer', tail: ['hours', 'reviews', 'facilities'] },
  hull: { style: 'colon', facts: ['toddler', 'parties', 'sen'], tail: ['hours', 'reviews', 'facilities'] },
  liverpool: { style: 'including', facts: ['parties', 'toddler'], parties: 'offer', tail: ['reviews', 'facilities'] },
  bristol: { style: 'including', facts: ['parties', 'toddler'], parties: 'offer', tail: ['reviews', 'facilities'] },
  leeds: { style: 'colon', facts: ['parties', 'toddler', 'sen'], tail: ['hours', 'reviews', 'facilities'] },
  norwich: { style: 'including', facts: ['toddler'], tail: ['hours', 'reviews', 'facilities'], tailPlace: FOR_NORFOLK },
  stoke: { style: 'including', facts: ['parties'], parties: 'offer', tail: ['hours', 'reviews', 'facilities'], tailPlace: ' in Staffordshire' },
  swansea: { style: 'including', facts: ['parties', 'toddler'], parties: 'offer', tail: ['hours', 'reviews', 'facilities'] },
  glasgow: { style: 'including', facts: ['parties'], parties: 'offer', tail: ['hours', 'reviews', 'facilities'], tailPlace: ' across the city' },
  nottingham: { style: 'with', facts: ['parties', 'toddler'], parties: 'offer', tail: ['hours', 'reviews', 'facilities'] },
  sheffield: { style: 'including', facts: ['parties', 'toddler'], parties: 'offer', tail: ['hours', 'reviews', 'facilities'] },
  blackpool: { style: 'including', facts: ['parties'], parties: 'offer', tail: ['hours', 'reviews', 'facilities'], tailPlace: ' on the Fylde coast' },
  beverley: { style: 'including', facts: ['parties'], parties: 'offer', place: 'Beverley, East Yorkshire', tail: ['hours', 'reviews', 'facilities'] },
  crewe: { style: 'including', facts: ['toddler'], place: 'Crewe, Cheshire', tail: ['hours', 'reviews'], topRated: true },
  halifax: { style: 'including', facts: ['parties', 'sen'], parties: 'offer', tail: ['hours', 'reviews', 'facilities'] },
}

export function hasMetaOverride(slug: string): boolean {
  return slug in OVERRIDES
}

function factPhrase(fact: Fact, n: number, cfg: OverrideConfig): string {
  if (fact === 'toddler') return n === 1 ? '1 with a toddler area' : `${n} with toddler areas`
  if (fact === 'sen') return `${n} SEN-friendly`
  // parties
  if (cfg.parties === 'with') return `${n} with birthday parties`
  if (cfg.style === 'colon' || cfg.style === 'with') return `${n} offering birthday parties`
  return n === 1 ? '1 that offers birthday parties' : `${n} that offer birthday parties`
}

function joinAnd(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/**
 * `Soft Play Near Me in Hull: 19 Centres` and its description, from live stats; null when the
 * slug has no override (or no venues), so callers fall back to the generated copy.
 */
export function buildOverrideMeta(slug: string, name: string, stats: CityStats): CityMeta | null {
  const cfg = OVERRIDES[slug]
  if (!cfg || stats.total === 0) return null

  const title = `Soft Play Near Me in ${name}: ${stats.total} ${stats.total === 1 ? 'Centre' : 'Centres'}`
  if (title.length > MAX_TITLE) return null

  const counts: Record<Fact, number> = { parties: stats.parties, toddler: stats.toddler, sen: stats.sen }
  const facts = cfg.facts.filter((f) => counts[f] > 0).map((f) => factPhrase(f, counts[f], cfg))

  const hoursOk = stats.hoursCoverage >= MIN_COVERAGE_FOR_CLAIM
  const words: Record<Tail, string> = { hours: 'hours', reviews: 'reviews', facilities: 'facilities' }
  const tailItems = cfg.tail.filter((t) => t !== 'hours' || hoursOk).map((t) => words[t])
  const compare = tailItems.length ? ` Compare ${joinAnd(tailItems)}${cfg.tailPlace ?? ''}.` : ''

  const place = cfg.place ?? name
  const top = cfg.topRated ? stats.topRated[0] : undefined
  const topSentence = top && top.name.length <= 40 ? ` Top rated: ${top.name} (${top.rating.toFixed(1)}★).` : ''
  const lead = `Find ${plural(stats.total, 'soft play centre')} near you in ${place}`

  for (let n = facts.length; n >= 0; n--) {
    const used = facts.slice(0, n)
    const clause =
      n === 0
        ? '.'
        : cfg.style === 'colon'
          ? `: ${joinAnd(used)}.`
          : cfg.style === 'with'
            ? `, with ${joinAnd(used)}.`
            : `, including ${joinAnd(used)}.`
    const text = `${lead}${clause}${topSentence}${compare}`
    if (text.length <= MAX_DESCRIPTION) return { title, description: text }
  }
  return { title, description: `${lead}.` }
}
