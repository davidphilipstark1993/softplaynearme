/**
 * Facts about a city's venues, computed from the venues themselves. Used for
 * the data-driven intro, FAQ answers, and for deciding which things a title or
 * meta description is allowed to promise (see lib/cityMeta.ts).
 *
 * Nothing here estimates or fills gaps: a stat that the data can't support is
 * null / 0 and the caller leaves the sentence out.
 */
import { hasAgeRange, hasOpeningHours, hasPrice, priceNumber, type HoursPrice } from './venueFacts'

/** A rating is only quoted in "top rated" lists with at least this many reviews. */
export const MIN_REVIEWS_FOR_TOP_RATED = 20

/** A claim ("prices", "opening times") may appear in a title/description once this share of venues has the data. */
export const MIN_COVERAGE_FOR_CLAIM = 0.5

export interface StatsVenue extends HoursPrice {
  name: string
  slug: string
  avg_rating?: number | string | null
  review_count?: number | string | null
  toddler_area?: boolean
  baby_area?: boolean
  sen_friendly?: boolean
  parties?: boolean
  cafe?: boolean
  parking?: boolean
  last_verified_at?: string | Date | null
}

export interface RatedVenue {
  name: string
  slug: string
  rating: number
  reviews: number
}

export interface CityStats {
  total: number
  toddler: number
  baby: number
  sen: number
  parties: number
  withPrice: number
  withHours: number
  withAge: number
  withRating: number
  priceCoverage: number
  hoursCoverage: number
  ageCoverage: number
  ratingCoverage: number
  /** Lowest `price_from` and highest `price_to` (or price_from) across venues that publish one. */
  priceRange: { min: number; max: number } | null
  /** Most recent last_verified_at among venues, ISO date, or null. */
  latestVerified: string | null
  /** Most recent last_verified_at among the venues that publish a price — the date to quote beside a price range. */
  priceAsOf: string | null
  /** Best-rated venues with at least MIN_REVIEWS_FOR_TOP_RATED reviews, best first. */
  topRated: RatedVenue[]
}

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Venues ranked for "top rated": rating desc, then review count desc, then
 * name — so ties are deterministic. Venues below the review floor never appear,
 * however high their score (a 5.0 from 2 reviews is noise, not a ranking).
 */
export function rankTopRated(venues: StatsVenue[], limit = 3, minReviews = MIN_REVIEWS_FOR_TOP_RATED): RatedVenue[] {
  return venues
    .map((v) => ({ name: v.name, slug: v.slug, rating: num(v.avg_rating) ?? 0, reviews: num(v.review_count) ?? 0 }))
    .filter((v) => v.rating > 0 && v.reviews >= minReviews)
    .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews || a.name.localeCompare(b.name))
    .slice(0, limit)
}

export function computeCityStats(venues: StatsVenue[]): CityStats {
  const total = venues.length
  const share = (n: number) => (total === 0 ? 0 : n / total)

  const withPrice = venues.filter(hasPrice).length
  const withHours = venues.filter(hasOpeningHours).length
  const withAge = venues.filter(hasAgeRange).length
  const withRating = venues.filter((v) => (num(v.avg_rating) ?? 0) > 0).length

  const prices = venues.flatMap((v) => {
    const from = priceNumber(v.price_from)
    if (from === null) return []
    return [from, priceNumber(v.price_to) ?? from]
  })

  const latest = (list: StatsVenue[]): string | null => {
    const dates = list
      .map((v) => (v.last_verified_at ? new Date(v.last_verified_at) : null))
      .filter((d): d is Date => !!d && !Number.isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())
    return dates.length ? dates[0].toISOString().slice(0, 10) : null
  }

  return {
    total,
    toddler: venues.filter((v) => v.toddler_area).length,
    baby: venues.filter((v) => v.baby_area).length,
    sen: venues.filter((v) => v.sen_friendly).length,
    parties: venues.filter((v) => v.parties).length,
    withPrice,
    withHours,
    withAge,
    withRating,
    priceCoverage: share(withPrice),
    hoursCoverage: share(withHours),
    ageCoverage: share(withAge),
    ratingCoverage: share(withRating),
    priceRange: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
    latestVerified: latest(venues),
    priceAsOf: latest(venues.filter(hasPrice)),
    topRated: rankTopRated(venues),
  }
}

/**
 * Rating used to ORDER venues "by rating". A raw average lets a 5.0 from two
 * reviews outrank a 4.6 from 300; this pulls small samples toward a typical
 * score (a Bayesian average with a prior worth MIN_REVIEWS_FOR_TOP_RATED reviews),
 * so a venue needs real volume to reach the top. Unrated venues return null and
 * sort last. Only used for ordering — displayed ratings are always the real ones.
 */
export const RATING_PRIOR_MEAN = 4.2

export function smoothedRating(rating: number | string | null | undefined, reviews: number | string | null | undefined): number | null {
  const r = num(rating)
  const n = num(reviews) ?? 0
  if (r === null || r <= 0 || n <= 0) return null
  const m = MIN_REVIEWS_FOR_TOP_RATED
  return (r * n + RATING_PRIOR_MEAN * m) / (n + m)
}
