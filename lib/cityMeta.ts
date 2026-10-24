/**
 * Titles and meta descriptions for city hubs, generated from what the data
 * actually supports. The previous hand-written copy promised "Prices & Ages"
 * on every hub, but only 4 of ~1,070 venues have a price and the data has no
 * age-range field at all. A claim is only made once at least
 * MIN_COVERAGE_FOR_CLAIM of the city's venues carry the data behind it.
 */
import { MIN_COVERAGE_FOR_CLAIM, type CityStats } from './cityStats'

const TITLE_SUFFIX = ' | Soft Play Near Me'
/** Titles longer than this (including the suffix) get truncated in results. */
const MAX_TITLE = 70
const MAX_DESCRIPTION = 160

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

export function buildCityTitle(name: string, stats: CityStats): string {
  const centres = `${stats.total} ${stats.total === 1 ? 'Centre' : 'Centres'}`
  const claims = supportedClaims(stats)
  // Richest title that fits: up to two claims, then one, then none.
  for (const n of [2, 1, 0]) {
    const picked = claims.slice(0, n)
    const title =
      stats.total > 0
        ? `Soft Play in ${name}: ${centres}${picked.length === 1 ? ` & ${picked[0]}` : picked.length ? `, ${joinClaims(picked)}` : ''}`
        : `Soft Play in ${name}`
    if (title.length + TITLE_SUFFIX.length <= MAX_TITLE) return title
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
