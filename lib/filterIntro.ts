/**
 * Intro, "what these venues confirm" paragraphs and FAQs for the indexable category pages
 * (/toddler, /birthday-parties, /sen-friendly), built from the matching venues' own data
 * (AdSense / thin-content work, Phase 2E, 27 Nov 2026).
 *
 * Replaces one tips block and one FAQ set per filter that were identical on every city
 * (city name swapped). Every sentence here names venues on the page or counts them; a
 * sentence with nothing to say is left out, never padded.
 */

export type DataFilter = 'toddler' | 'birthday-parties' | 'sen-friendly'

export interface FilterIntroVenue {
  name: string
  cafe?: boolean | null
  parking?: boolean | null
  parties?: boolean | null
  has_party_rooms?: boolean | null
  toddler_area?: boolean | null
  baby_area?: boolean | null
  sen_friendly?: boolean | null
  has_sen_sessions?: boolean | null
  wheelchair_access?: boolean | null
  price_from?: number | string | null
  age_range_min?: number | null
  age_range_max?: number | null
  avg_rating?: number | string | null
  review_count?: number | string | null
  /** Town or neighbourhood, when known (lib/localities.ts). */
  area?: string | null
}

export interface FilterSections {
  intro: string
  /** Paragraphs for a "What these venues confirm" section. */
  details: string[]
  faqs: Array<{ question: string; answer: string }>
}

const WHAT: Record<DataFilter, { has: string; one: string; noun: string }> = {
  toddler: { has: 'have a dedicated toddler area', one: 'has a dedicated toddler area', noun: 'toddler soft play' },
  'birthday-parties': { has: 'host birthday parties', one: 'hosts birthday parties', noun: 'soft play for parties' },
  'sen-friendly': { has: 'are listed as SEN-friendly', one: 'is listed as SEN-friendly', noun: 'SEN-friendly soft play' },
}

export function names(list: FilterIntroVenue[], max = 4): string {
  const n = list.map((v) => v.name)
  if (n.length <= max) return n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`
  return `${n.slice(0, max).join(', ')} and ${n.length - max} more`
}

const money = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? (Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`) : null
}

function ageLabel(v: FilterIntroVenue): string | null {
  const lo = v.age_range_min, hi = v.age_range_max
  if (hi != null && (lo == null || lo === 0)) return `up to ${hi}`
  if (lo != null && hi != null) return `${lo}–${hi}`
  return null
}

/** Best rated with enough reviews to mean something (same bar as the hub's top-rated list). */
function bestRated(list: FilterIntroVenue[], minReviews = 20): FilterIntroVenue[] {
  return list
    .filter((v) => Number(v.avg_rating) > 0 && Number(v.review_count) >= minReviews)
    .sort((a, b) => Number(b.avg_rating) - Number(a.avg_rating) || Number(b.review_count) - Number(a.review_count))
    .slice(0, 3)
}

export function buildFilterSections(filter: DataFilter, city: string, venues: FilterIntroVenue[], cityTotal: number): FilterSections {
  const w = WHAT[filter]
  const n = venues.length
  const intro = n === 0
    ? `None of the soft play venues we list in ${city} ${w.has} yet.`
    : n === 1
      ? `${venues[0].name} is the one soft play venue we list in ${city} that ${w.one}.`
      : `${n} of the ${cityTotal} soft play venues we list in ${city} ${w.has}: ${names(venues, 5)}.`

  const details: string[] = []
  const faqs: FilterSections['faqs'] = []
  const sub = (f: (v: FilterIntroVenue) => unknown) => venues.filter((v) => !!f(v))
  const cafe = sub((v) => v.cafe)
  const parking = sub((v) => v.parking)

  if (filter === 'toddler') {
    const baby = sub((v) => v.baby_area)
    if (baby.length) details.push(`${baby.length === 1 ? `${baby[0].name} also has` : `${names(baby)} also have`} a separate baby area.`)
    const aged = venues.map((v) => [v, ageLabel(v)] as const).filter(([, a]) => a)
    if (aged.length) details.push(`Ages listed: ${aged.slice(0, 5).map(([v, a]) => `${v.name} ${a}`).join('; ')}.`)
    if (baby.length) faqs.push({ question: `Which toddler soft play in ${city} also has a baby area?`, answer: `${names(baby, 6)}.` })
    if (aged.length) faqs.push({ question: `What ages are the toddler soft play venues in ${city} for?`, answer: `Where the venue publishes it: ${aged.slice(0, 6).map(([v, a]) => `${v.name}, ${a}`).join('; ')}.` })
  }
  if (filter === 'birthday-parties') {
    const rooms = sub((v) => v.has_party_rooms)
    if (rooms.length) details.push(`${rooms.length === 1 ? `${rooms[0].name} has` : `${names(rooms)} have`} ${rooms.length === 1 ? 'its' : 'their'} own party rooms.`)
    if (rooms.length) faqs.push({ question: `Which soft play venues in ${city} have party rooms?`, answer: `${names(rooms, 6)}.` })
  }
  if (filter === 'sen-friendly') {
    const sessions = sub((v) => v.has_sen_sessions)
    const access = sub((v) => v.wheelchair_access)
    if (sessions.length) details.push(`${sessions.length === 1 ? `${sessions[0].name} runs` : `${names(sessions)} run`} dedicated SEN sessions.`)
    if (access.length) details.push(`Wheelchair access is confirmed at ${names(access)}.`)
    if (sessions.length) faqs.push({ question: `Which soft play in ${city} runs dedicated SEN sessions?`, answer: `${names(sessions, 6)}. Session days and times are on each venue's page where we hold them.` })
    if (access.length) faqs.push({ question: `Which SEN-friendly soft play in ${city} has wheelchair access?`, answer: `${names(access, 6)}.` })
  }

  if (n >= 2 && cafe.length) details.push(cafe.length === n ? `All of them have a café.` : `${cafe.length === 1 ? `${cafe[0].name} has` : `${names(cafe)} have`} a café.`)
  if (n >= 2 && parking.length) details.push(parking.length === n ? `All of them have parking.` : `Parking is confirmed at ${names(parking)}.`)
  const priced = venues.filter((v) => money(v.price_from))
  if (priced.length) details.push(`Entry prices we hold: ${priced.slice(0, 4).map((v) => `${v.name} from ${money(v.price_from)}`).join(', ')}.`)

  const areas = new Map<string, number>()
  for (const v of venues) if (v.area) areas.set(v.area, (areas.get(v.area) ?? 0) + 1)
  if (areas.size >= 2) {
    const parts = [...areas.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([a, c]) => `${c} in ${a}`)
    details.push(`By area: ${parts.join(', ')}.`)
  }

  const top = bestRated(venues)
  if (top.length >= 2) {
    const t = top.map((v) => `${v.name} (${Number(v.avg_rating).toFixed(1)} from ${Number(v.review_count).toLocaleString('en-GB')} Google reviews)`).join(', ')
    details.push(`Best rated by Google reviewers: ${t}.`)
    faqs.push({ question: `Which is the best-rated ${w.noun} in ${city}?`, answer: `Among venues with 20 or more Google reviews: ${t}.` })
  }
  if (n >= 2 && cafe.length) faqs.push({ question: `Which ${w.noun} in ${city} has a café?`, answer: cafe.length === n ? `All ${n} venues on this page.` : `${names(cafe, 6)}.` })

  return { intro, details, faqs: faqs.slice(0, 5) }
}
