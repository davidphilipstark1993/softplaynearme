/**
 * Title, description and short intro for the path-based filter pages
 * (/soft-play/{city}/toddler, /birthday-parties, /sen-friendly). Built from the
 * city's own matching venues so each page is unique — "8 toddler-friendly
 * centres in Hull, including X, Y and Z" — instead of one template with the city
 * name swapped in. Only counts, names and ratings the data holds are used; the
 * names quoted are the best-rated matching venues with enough reviews to mean
 * something (see MIN_REVIEWS_FOR_TOP_RATED).
 */
import { rankTopRated, MIN_REVIEWS_FOR_TOP_RATED, type StatsVenue } from './cityStats'

export type DataFilterSlug = 'toddler' | 'birthday-parties' | 'sen-friendly'

interface FilterPhrases {
  /** Page title stem, e.g. "Toddler Soft Play" */
  titleStem: string
  /** "8 soft play centres in Hull {with a toddler area}" */
  descriptor: string
  /** "{8} of Hull's {33} soft play centres {have a dedicated toddler area}" */
  introPredicate: string
}

const PHRASES: Record<DataFilterSlug, FilterPhrases> = {
  toddler: {
    titleStem: 'Toddler Soft Play',
    descriptor: 'with a toddler area',
    introPredicate: 'have a dedicated toddler area',
  },
  'birthday-parties': {
    titleStem: 'Soft Play Birthday Parties',
    descriptor: 'that host birthday parties',
    introPredicate: 'host birthday parties',
  },
  'sen-friendly': {
    titleStem: 'SEN-Friendly Soft Play',
    descriptor: 'listed as SEN-friendly',
    introPredicate: 'are listed as SEN-friendly',
  },
}

export function isDataFilter(slug: string): slug is DataFilterSlug {
  return slug in PHRASES
}

function list(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

export interface FilterMeta {
  title: string
  description: string
  intro: string
}

export function buildFilterMeta(
  slug: DataFilterSlug,
  cityName: string,
  county: string,
  matching: StatsVenue[],
  cityTotal: number
): FilterMeta {
  const p = PHRASES[slug]
  const n = matching.length
  const top = rankTopRated(matching, 3)
  const names = top.map((v) => v.name)
  const where = county && !county.toLowerCase().includes(cityName.toLowerCase()) ? `${cityName}, ${county}` : cityName

  // A complete <title> (the page opts out of the site template); the brand goes on only if it still fits in 60.
  const stem = n > 0 ? `${p.titleStem} in ${cityName}: ${plural(n, 'Venue')}` : `${p.titleStem} in ${cityName}`
  const title = stem.length + ' | Soft Play Near Me'.length <= 60 ? `${stem} | Soft Play Near Me` : stem

  if (n === 0) {
    return {
      title,
      description: `No ${cityName} soft play centres are currently listed ${p.descriptor}. Browse every soft play centre in ${where}.`,
      intro: `None of the soft play centres we list in ${cityName} are currently marked ${p.descriptor.replace(/^(with|that host|listed as)\s*/, '')}.`,
    }
  }

  const lead = `${plural(n, 'soft play centre')} in ${where} ${p.descriptor}`
  const including = names.length ? `, including ${list(names)}` : ''
  const tail = slug === 'birthday-parties' ? ' Compare ratings and contact details, then ask for a party quote.' : ' See ratings, facilities and contact details.'
  // Richest description that fits 160 characters: names + tail, names, tail, bare.
  const description =
    [`${lead}${including}.${tail}`, `${lead}${including}.`, `${lead}.${tail}`, `${lead}.`].find((d) => d.length <= 155) ?? `${lead}.`

  const rated = top.length
    ? ` Best rated (${MIN_REVIEWS_FOR_TOP_RATED}+ reviews): ${list(top.map((v) => `${v.name} (${v.rating.toFixed(1)}, ${v.reviews.toLocaleString('en-GB')} reviews)`))}.`
    : ''
  const intro = `${n} of ${cityName}'s ${cityTotal} soft play ${cityTotal === 1 ? 'centre' : 'centres'} ${n === 1 ? p.introPredicate.replace(/^have\b/, 'has').replace(/^host\b/, 'hosts').replace(/^are\b/, 'is') : p.introPredicate}.${rated}`

  return { title, description, intro }
}
