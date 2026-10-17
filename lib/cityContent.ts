/**
 * City hub copy built from the hub's own venues: the intro under the heading and
 * the FAQ. Every number, name and rating comes from the data passed in; a
 * sentence the data cannot support is left out rather than filled with a typical
 * figure. (The previous FAQ pool quoted "£4 to £8 per child" for every city.)
 */
import { MIN_REVIEWS_FOR_TOP_RATED, computeCityStats, rankTopRated, type StatsVenue } from './cityStats'
import { hasOpeningHours, formatPrice } from './venueFacts'

export interface CityContentVenue extends StatsVenue {
  review_count?: number | string | null
}

export interface CityContentInput {
  name: string
  county: string
  slug: string
  /** The hub's own (main list) venues. */
  venues: CityContentVenue[]
  /** Venues in surrounding towns, listed in the Nearby section. */
  nearbyCount?: number
  nearbyTowns?: string[]
}

export interface Faq {
  question: string
  answer: string
}

function whereOf(name: string, county: string): string {
  return county && !county.toLowerCase().includes(name.toLowerCase()) ? `${name}, ${county}` : name
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

function reviewCount(v: CityContentVenue): number {
  const n = Number(v.review_count)
  return Number.isFinite(n) ? n : 0
}

/** Up to `limit` matching venues, most-reviewed first (a neutral, data-based pick — not a "best of"). */
function sampleNames(venues: CityContentVenue[], limit = 3): string[] {
  return [...venues].sort((a, b) => reviewCount(b) - reviewCount(a) || a.name.localeCompare(b.name)).slice(0, limit).map((v) => v.name)
}

export function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(`${iso}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function ratedLine(top: ReturnType<typeof rankTopRated>): string {
  return list(top.map((v) => `${v.name} ${v.rating.toFixed(1)} (${v.reviews.toLocaleString('en-GB')} reviews)`))
}

function priceSentence(stats: ReturnType<typeof computeCityStats>): string | null {
  if (!stats.priceRange) return null
  const { min, max } = stats.priceRange
  const range = min === max ? formatPrice(min) : `${formatPrice(min)} to ${formatPrice(max)}`
  const asOf = formatDate(stats.priceAsOf)
  return `Published prices ${min === max ? `are ${range}` : `run from ${range}`} at ${stats.withPrice} of ${stats.total} ${stats.total === 1 ? 'venue' : 'venues'}${asOf ? ` (checked ${asOf})` : ''}.`
}

/** The paragraph under the H1: counts, best-rated venues (20+ reviews) and any published prices. */
export function buildCityIntro(input: CityContentInput): string {
  const { name, county, venues } = input
  const stats = computeCityStats(venues)
  if (stats.total === 0) {
    return `We're still building our soft play listings for ${whereOf(name, county)}. Check nearby towns, or tell us about a venue we've missed.`
  }

  const parts: string[] = []
  const facts: string[] = []
  if (stats.toddler > 0) facts.push(`${stats.toddler} with a toddler area`)
  if (stats.parties > 0) facts.push(`${stats.parties} offering birthday parties`)
  if (stats.sen > 0) facts.push(`${stats.sen} SEN-friendly`)
  parts.push(
    `${name} has ${plural(stats.total, 'soft play centre')} in our directory${facts.length ? `: ${list(facts)}` : ''}.`
  )
  if (stats.topRated.length) {
    parts.push(`Highest rated (${MIN_REVIEWS_FOR_TOP_RATED}+ reviews): ${ratedLine(stats.topRated)}.`)
  }
  const price = priceSentence(stats)
  if (price) parts.push(price)
  return parts.join(' ')
}

/**
 * 4–6 questions, each answered from the venue data. Always present: how many, toddler,
 * parties, SEN, price; plus best-rated when a venue has enough reviews to rank, otherwise
 * opening hours. Returns [] for a hub with no venues.
 */
export function buildCityFaqs(input: CityContentInput): Faq[] {
  const { name, county, venues, nearbyCount = 0, nearbyTowns = [] } = input
  const stats = computeCityStats(venues)
  if (stats.total === 0) return []
  const where = whereOf(name, county)
  const n = stats.total
  const faqs: Faq[] = []

  const facts: string[] = []
  if (stats.toddler > 0) facts.push(`${stats.toddler} with a toddler area`)
  if (stats.parties > 0) facts.push(`${stats.parties} offering birthday parties`)
  if (stats.sen > 0) facts.push(`${stats.sen} SEN-friendly`)
  const nearby = nearbyCount > 0
    ? ` A further ${plural(nearbyCount, 'venue')} in nearby ${nearbyTowns.length ? `towns (${list(nearbyTowns)})` : 'towns'} ${nearbyCount === 1 ? 'is' : 'are'} listed separately on this page.`
    : ''
  faqs.push({
    question: `How many soft play centres are there in ${name}?`,
    answer: `We list ${plural(n, 'soft play centre')} in ${where}${facts.length ? `: ${list(facts)}` : ''}.${nearby}`,
  })

  if (stats.topRated.length) {
    faqs.push({
      question: `Which soft play centres in ${name} are the best rated?`,
      answer: `Among ${name} venues with ${MIN_REVIEWS_FOR_TOP_RATED} or more reviews, the highest rated are ${ratedLine(stats.topRated)}. Ratings come from visitor reviews and change over time; venues with fewer reviews aren't ranked.`,
    })
  }

  const toddlers = venues.filter((v) => v.toddler_area)
  faqs.push({
    question: `Is there soft play for toddlers in ${name}?`,
    answer: toddlers.length
      ? `${toddlers.length} of ${n} ${name} venues are listed with a dedicated toddler area, including ${list(sampleNames(toddlers))}. Browse them all on our ${name} toddler soft play page.`
      : `None of the ${n} venues we list in ${name} are currently marked as having a dedicated toddler area. Ask a venue directly about under-3s space and sessions.`,
  })

  const parties = venues.filter((v) => v.parties)
  faqs.push({
    question: `Can I book a birthday party at soft play in ${name}?`,
    answer: parties.length
      ? `${parties.length} of ${n} ${name} venues are listed as offering birthday parties, including ${list(sampleNames(parties))}. Party packages, prices and availability are set by each venue, so ask them directly.`
      : `None of the ${n} venues we list in ${name} are currently marked as offering birthday parties. Some may still take party bookings, so ask the venue.`,
  })

  const sen = venues.filter((v) => v.sen_friendly)
  faqs.push({
    question: `Is there SEN-friendly soft play in ${name}?`,
    answer: sen.length
      ? `${sen.length} of ${n} ${name} venues are listed as SEN-friendly, including ${list(sampleNames(sen))}. What that means varies — quiet sessions, sensory rooms, smaller groups — so ask the venue what they offer and when.`
      : `None of the ${n} venues we list in ${name} are currently marked as SEN-friendly. Some venues run quiet or sensory sessions without advertising them, so it is worth asking.`,
  })

  // TODO(owner): once enough venues publish prices (or you supply a sourced typical range
  // and date), this answer can quote a city-wide range. Until then it states only what the
  // listings hold and quotes no "typical" figure.
  const price = priceSentence(stats)
  faqs.push({
    question: `How much does soft play cost in ${name}?`,
    answer: price
      ? `${price} ${n > stats.withPrice ? `The other ${n - stats.withPrice} ${n - stats.withPrice === 1 ? 'venue has' : 'venues have'} no published price in our listings. ` : ''}Prices change, so check each venue's own website before you go.`
      : `We don't yet hold published prices for ${name} venues, so we don't quote a typical cost. Prices vary by venue, the child's age and the time of day — check each venue's own website before you go.`,
  })

  if (!stats.topRated.length && faqs.length < 6) {
    const withHours = venues.filter(hasOpeningHours).length
    faqs.push({
      question: `What are the opening hours of soft play centres in ${name}?`,
      answer: withHours
        ? `${withHours} of ${n} ${name} venues have opening hours listed on their page. Hours change in school holidays, so check with the venue before you travel.`
        : `We don't yet hold opening hours for ${name} venues. Check a venue's own website or call before you travel.`,
    })
  }

  return faqs.slice(0, 6)
}
