/**
 * Pure helpers for the London area sub-hubs (no data access, so node tests can import them).
 * See lib/londonAreaHubs.ts.
 */
export const MIN_AREA_VENUES = 5

export interface AreaVenueLike {
  name: string
  slug: string
  postcode?: string
  avg_rating?: number | null
  review_count?: number
  toddler_area?: boolean
  parties?: boolean
  sen_friendly?: boolean
}

export const londonAreaPath = (slug: string) => `/soft-play/london/area/${slug}`

/** "E, IG and RM": the postcode areas an area's venues are in, for the intro. */
export function postcodeAreasOf(venues: AreaVenueLike[]): string[] {
  const out = new Set<string>()
  for (const v of venues) {
    const m = String(v.postcode ?? '').toUpperCase().match(/^([A-Z]{1,2})\d/)
    if (m) out.add(m[1])
  }
  return [...out].sort()
}


function joinList(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Top venues by rating among those with at least 20 reviews (same rule as the hubs). */
export function topRatedOf(venues: AreaVenueLike[], n = 3): AreaVenueLike[] {
  return venues
    .filter((v) => (v.review_count ?? 0) >= 20 && (v.avg_rating ?? 0) > 0)
    .sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0) || (b.review_count ?? 0) - (a.review_count ?? 0))
    .slice(0, n)
}

/** Answer-first summary and FAQ for an area page, all from that area's listings. */
export function buildAreaContent(areaName: string, venues: AreaVenueLike[]) {
  const n = venues.length
  const top = topRatedOf(venues)
  const toddler = venues.filter((v) => v.toddler_area)
  const parties = venues.filter((v) => v.parties)
  const sen = venues.filter((v) => v.sen_friendly)
  const pcs = postcodeAreasOf(venues)
  const names = (vs: AreaVenueLike[], k = 4) => joinList(vs.slice(0, k).map((v) => v.name))
  const summary =
    `We list ${n} soft play centres in ${areaName} (${joinList(pcs)} postcodes)` +
    (top.length ? `. The highest rated with 20+ reviews is ${top[0].name}, at ${Number(top[0].avg_rating).toFixed(1)} from ${Number(top[0].review_count).toLocaleString('en-GB')} reviews` : '') +
    '.'
  const faqs = [
    { question: `How many soft play centres are there in ${areaName}?`, answer: `${n}, in ${joinList(pcs)} postcodes, including ${names(venues)}. Venues just outside London are on the main London page.` },
    ...(top.length
      ? [{ question: `What is the best-rated soft play in ${areaName}?`, answer: `Among venues with 20 or more reviews: ${top.map((v) => `${v.name} (${Number(v.avg_rating).toFixed(1)} from ${Number(v.review_count).toLocaleString('en-GB')} reviews)`).join(', ')}. Ratings change over time.` }]
      : []),
    {
      question: `Is there toddler soft play in ${areaName}?`,
      answer: toddler.length
        ? `${toddler.length} ${areaName} venue${toddler.length === 1 ? ' is' : 's are'} listed with a toddler area: ${names(toddler)}. Play cafés are usually calmer for under-3s; ask any venue about toddler sessions.`
        : `None of the ${areaName} venues we list are marked with a toddler area yet. Play cafés are usually calmer for under-3s; ask any venue about toddler sessions.`,
    },
    {
      question: `Where can I have a kids party in ${areaName}?`,
      answer: parties.length
        ? `${names(parties)} ${parties.length === 1 ? 'is' : 'are'} listed for parties. Packages and prices are set by each venue, so ask them directly.`
        : `None of the ${areaName} venues we list are marked for parties yet, though many take bookings; ask the venue.`,
    },
    ...(sen.length
      ? [{ question: `Is there SEN-friendly soft play in ${areaName}?`, answer: `${names(sen)} ${sen.length === 1 ? 'is' : 'are'} listed as SEN-friendly. Ask the venue which sessions are quieter.` }]
      : []),
  ]
  return { summary, faqs }
}
