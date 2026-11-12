/**
 * Editorial guides for hubs that have one (Brighton, Worthing). Everything here
 * was read from a venue's own website or from Google Places on `VERIFIED_ON`;
 * nothing is estimated. Where a fact could not be confirmed (parking, floor
 * area, most prices) it is left out rather than hedged. Re-check against the
 * venues' sites before changing `VERIFIED_ON`.
 *
 * Text may contain `[label](/path)` links; components/location/HubGuide.tsx renders them.
 */
import type { Faq } from './cityContent'
import { rankTopRated, MIN_REVIEWS_FOR_TOP_RATED, type StatsVenue } from './cityStats'
import { getLondonAreaSlug, LONDON_AREAS } from './londonAreas'

export const VERIFIED_ON = '25 October 2026'

export interface GuideSection {
  heading: string
  paragraphs: string[]
}

export interface HubGuide {
  /**
   * 'verified' (default): hand-written from each venue's own website on VERIFIED_ON (Worthing, Brighton).
   * 'listings': built at render time from the hub's own listing data (see buildDataGuide) — no claim of
   * having read venue websites, and it is always as current as the listings.
   */
  kind?: 'verified' | 'listings'
  sections: GuideSection[]
  /** Appended to the data-driven FAQ (capped at MAX_FAQS in total by the page). */
  faqs: Faq[]
  /** Hubs shown in the "Nearby" block, in order. */
  nearbyHubs: { slug: string; label: string }[]
  /**
   * Towns people search for that have no soft play of their own and no hub page. The hub gets a
   * "Soft play near <town>" section listing the closest real venues by distance (approximate
   * town-centre coordinates), instead of thin or invented town pages.
   */
  nearTowns?: { name: string; lat: number; lng: number }[]
}

export const MAX_FAQS = 7

const GUIDES: Record<string, HubGuide> = {
  worthing: {
    nearbyHubs: [
      { slug: 'brighton', label: 'Brighton & Hove' },
    ],
    sections: [
      {
        heading: 'Soft play in Worthing: a local guide',
        paragraphs: [
          "Worthing's soft play is mostly independent and community-run rather than big chains. Space Station is in Lancing, and three larger activity venues sit just outside the town, in Angmering, Ford and Littlehampton. We list those separately under nearby towns.",
        ],
      },
      {
        heading: 'Babies and toddlers',
        paragraphs: [
          "[Space Station](/soft-play/worthing/space-station-soft-play-ltd) in Lancing describes its play centre as for ages 0–12 and runs timed sessions; it takes walk-ins but can't guarantee a space when full, so ring ahead. [Harbour Park](/soft-play/worthing/harbour-park-indoor-soft-play) in Littlehampton has a separate baby soft play for 0–18 months and says you can pay on arrival without booking. [Out of Bounds](/soft-play/worthing/out-of-bounds) in Angmering runs a pre-school Climb 'n' Soft Play session. [The Lighthouse](/soft-play/worthing/the-lighthouse-soft-play-and-cafe) lists entry prices for babies from birth.",
        ],
      },
      {
        heading: 'Older children',
        paragraphs: [
          "Out of Bounds combines soft play with ten-pin bowling, laser tag, high ropes and adventure golf, so it suits a mixed-age group. [Flying Fortress](/soft-play/worthing/flying-fortress) in Ford prices children up to age 13. Harbour Park's soft play is for children up to 9.",
        ],
      },
      {
        heading: 'Birthday parties',
        paragraphs: [
          "Space Station has two party rooms and a private hire option. The Lighthouse lists party bookings on its site, and Out of Bounds, Flying Fortress and Harbour Park each publish party information. [The Little Play Village](/soft-play/worthing/the-little-play-village), a role-play village based in Goring, also runs parties. Packages and prices change, so check the venue's own page before you book.",
        ],
      },
      {
        heading: 'Rainy days and opening days',
        paragraphs: [
          "All of these are indoors. Opening days differ: The Lighthouse's website lists Wednesday to Friday only, and Flying Fortress is closed on Mondays. Check before you set off.",
          "The Little Play Village is a role-play experience rather than a conventional soft play centre, and it runs on ticketed event dates, so book ahead.",
        ],
      },
    ],
    faqs: [
      {
        question: 'Where can I have a kids party in Worthing?',
        answer:
          "Space Station in Lancing has two party rooms and a private hire option, and The Lighthouse in Worthing lists party bookings on its website. Out of Bounds (Angmering), Flying Fortress (Ford), Harbour Park (Littlehampton) and The Little Play Village (Goring) also publish party information. Packages and prices are set by each venue, so check their pages for current details.",
      },
      {
        question: 'Do I need to book soft play in Worthing?',
        answer:
          "It depends on the venue. Space Station says it accepts walk-ins but cannot guarantee a space if it is at capacity. Harbour Park says there is no need to book and you can pay on arrival, though peak times may limit play to a one-hour session. For weekends and school holidays, ring first.",
      },
    ],
  },

  brighton: {
    nearTowns: [{ name: 'Peacehaven', lat: 50.7934, lng: -0.0045 }],
    nearbyHubs: [
      { slug: 'worthing', label: 'Worthing' },
      { slug: 'hastings', label: 'Hastings & Eastbourne' },
    ],
    sections: [
      {
        heading: 'Soft play in Brighton and Hove: a local guide',
        paragraphs: [
          "Brighton and Hove has few traditional indoor soft play centres. Inside the city we list [Level Up](/soft-play/brighton/level-up-soft-play) at Withdean Sports Complex, Funplex (BN2) and Palace Play on Brighton Palace Pier, plus weekly soft play sessions at community venues: Hangleton Community Centre, Old Boat Corner in Hollingbury and King Alfred Leisure Centre in Hove. Most larger venues are a drive away in Peacehaven, Lewes, Henfield, Burgess Hill, Uckfield and Lindfield, and are listed under nearby towns. Playcafé, a term-time toddler café at St Matthias Church, and FunPlay Leisure at Brighton Marina are listed under other family activities.",
        ],
      },
      {
        heading: 'Toddlers and babies',
        paragraphs: [
          "[Level Up](/soft-play/brighton/level-up-soft-play) at Withdean describes a sensory toddler zone for ages 0–3, and [Meridian Mayhem](/soft-play/brighton/meridian-mayhem) in Peacehaven has a baby and toddler zone for children aged 5 and under. [The Doves Play Barn](/soft-play/brighton/the-doves-play-barn) at Furner's Green, near Uckfield, describes a toddler-safe area alongside hidden spaces, rope bridges and slides, with a café, and says it is open seven days a week, 9am to 5pm.",
        ],
      },
      {
        heading: 'SEN-friendly sessions',
        paragraphs: [
          "[Sharky's](/soft-play/brighton/sharkys), at Henfield Leisure Centre, lists SEN sessions on the first and third Thursday of each month, and is a nut-free site with a café. Its website says sessions are often fully booked, so book ahead.",
        ],
      },
      {
        heading: 'Birthday parties',
        paragraphs: [
          "[Monkey Bizness in Lewes](/soft-play/brighton/monkey-bizness-lewes) publishes three party packages (Funky Monkey, Mega Monkey and Pizza Party), each for a minimum of 12 children and 2 hours, with 90 minutes of play. Sharky's, The Doves Play Barn and [Jumpin Fun in Burgess Hill](/soft-play/brighton/jumpin-fun-inflatable-park-burgess-hill) also have party pages. Check the venue's site for current prices.",
        ],
      },
      {
        heading: 'Trampoline and inflatable parks',
        paragraphs: [
          "We don't list an open trampoline park in Brighton and Hove: Google shows Sky High Trampoline Park in Peacehaven as permanently closed, and the indoor play centre [Meridian Mayhem](/soft-play/brighton/meridian-mayhem) now operates in Peacehaven. The nearest bounce-style venue we list is Jumpin Fun in Burgess Hill, an inflatable park with a mega slide, ball pit and ninja course, which is not a trampoline park.",
        ],
      },
    ],
    faqs: [
      {
        question: 'Are there trampoline parks in Brighton?',
        answer:
          "Not one we can confirm as open. Sky High Trampoline Park in Peacehaven is shown by Google as permanently closed. Jumpin Fun in Burgess Hill is an inflatable park, not a trampoline park, and is the nearest bounce-style venue we list.",
      },
      {
        question: "What's the biggest soft play in Brighton?",
        answer:
          "We don't hold floor areas for the venues in Brighton and Hove, so we can't rank them by size. Jumpin Fun in Burgess Hill describes itself as a 25,000 sq ft inflatable theme park; it is an inflatable park rather than soft play. Check each venue's website for its own figures.",
      },
      {
        question: 'Where can I have a kids party near Brighton?',
        answer:
          "Monkey Bizness in Lewes publishes three party packages for a minimum of 12 children. Sharky's in Henfield, The Doves Play Barn near Uckfield and Jumpin Fun in Burgess Hill also have party pages. Prices and availability are set by each venue.",
      },
    ],
  },
}

/**
 * A category page (/toddler, /birthday-parties, /sen-friendly) is only indexable with this many
 * matching venues. Guide hubs are small, so a one-venue category is a thin duplicate of the hub.
 */
export function minFilterVenues(citySlug: string): number {
  return GUIDES[citySlug] ? 2 : 1 // data guides (below) are for large hubs and don't change this
}

export function getHubGuide(citySlug: string): HubGuide | undefined {
  return GUIDES[citySlug]
}

/** `Soft Play in Worthing – 4 Indoor Play Centres (2026 Guide)` — N is the live main-list count. */
export function buildGuideTitle(name: string, total: number, year: number): string {
  if (total <= 0) return `Soft Play in ${name}`
  return `Soft Play in ${name} – ${total} Indoor Play ${total === 1 ? 'Centre' : 'Centres'} (${year} Guide)`
}

function joinList(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/**
 * Two sentences that answer "where is the best soft play in X?" from the hub's own data:
 * the highest-rated venues (20+ reviews) with their town, then the live counts. Null when
 * no venue has enough reviews to rank, so nothing is claimed.
 */
export function buildAnswerFirst(input: {
  name: string
  venues: (StatsVenue & { area: string | null })[]
  nearbyCount: number
  nearbyTowns: string[]
}): string | null {
  const { name, venues, nearbyCount, nearbyTowns } = input
  const top = rankTopRated(venues, 3)
  if (top.length === 0) return null
  const areaOf = (slug: string) => venues.find((v) => v.slug === slug)?.area
  const first = top[0]
  const where = areaOf(first.slug)
  const rest = top.slice(1).map((t) => (areaOf(t.slug) ? `${t.name} (${areaOf(t.slug)})` : t.name))
  const nearby = nearbyCount > 0 ? ` and ${nearbyCount} more in nearby ${nearbyTowns.length ? `towns (${joinList(nearbyTowns)})` : 'towns'}` : ''
  return (
    `The highest-rated soft play in ${name} is ${first.name}${where ? ` in ${where}` : ''}, ` +
    `rated ${first.rating.toFixed(1)} from ${first.reviews.toLocaleString('en-GB')} reviews` +
    `${rest.length ? `, followed by ${joinList(rest)}` : ''}. ` +
    `We list ${venues.length} soft play ${venues.length === 1 ? 'centre' : 'centres'} in ${name}${nearby}.`
  )
}


// ── Data-driven guides ────────────────────────────────────────────────────────────────────
//
// For big hubs, a guide built entirely from the hub's own listing data at render time: counts,
// which venues list a toddler area / parties / SEN-friendliness, and the best-rated venues
// (20+ reviews). Nothing is written by hand about a venue, so nothing can be stale or invented;
// where the data has no answer the section is omitted. Names are only used when the listing's
// postcode sits in the hub's own area (`postcodeAreas`), so a venue wrongly filed under the hub
// (a Glasgow listing under Birmingham, say) is never presented as local.

export interface GuideVenue extends StatsVenue {
  postcode?: string | null
  area?: string | null
  baby_area?: boolean
}

interface DataGuideConfig {
  /** Outward postcodes (e.g. "LS14") whose venues may be named. Omit = no restriction. */
  allow?: RegExp
  nearbyHubs: { slug: string; label: string }[]
  londonAreas?: boolean
}

const DATA_GUIDES: Record<string, DataGuideConfig> = {
  london: { londonAreas: true, nearbyHubs: [{ slug: 'dartford', label: 'Dartford' }, { slug: 'southend', label: 'Southend-on-Sea' }] },
  birmingham: { allow: /^(B|CV|DY|WS|WV|TF|WR)\d/, nearbyHubs: [{ slug: 'stoke', label: 'Stoke-on-Trent' }] },
  manchester: { allow: /^(M|SK)\d/, nearbyHubs: [{ slug: 'bolton', label: 'Bolton' }, { slug: 'mossley', label: 'Mossley' }, { slug: 'liverpool', label: 'Liverpool' }] },
  edinburgh: { allow: /^EH\d/, nearbyHubs: [{ slug: 'glasgow', label: 'Glasgow' }] },
  hull: { allow: /^HU\d/, nearbyHubs: [{ slug: 'beverley', label: 'Beverley' }, { slug: 'bridlington', label: 'Bridlington' }] },
  liverpool: { allow: /^L\d/, nearbyHubs: [{ slug: 'manchester', label: 'Manchester' }] },
  bristol: { allow: /^BS\d/, nearbyHubs: [{ slug: 'cardiff', label: 'Cardiff' }] },
  leeds: { allow: /^LS\d/, nearbyHubs: [{ slug: 'bradford', label: 'Bradford' }, { slug: 'halifax', label: 'Halifax' }, { slug: 'huddersfield', label: 'Huddersfield' }, { slug: 'york', label: 'York' }] },
  swansea: { allow: /^SA([1-9]|1[0-3])$/, nearbyHubs: [{ slug: 'llanelli', label: 'Llanelli' }, { slug: 'cardiff', label: 'Cardiff' }] },
  glasgow: { allow: /^G\d/, nearbyHubs: [{ slug: 'edinburgh', label: 'Edinburgh' }] },
  sheffield: { allow: /^S([1-9]|1\d|2\d|3[0-6])$/, nearbyHubs: [{ slug: 'barnsley', label: 'Barnsley' }, { slug: 'doncaster', label: 'Doncaster' }] },
}

export function hasDataGuide(citySlug: string): boolean {
  return citySlug in DATA_GUIDES
}

const outward = (pc: string | null | undefined) => pc?.trim().toUpperCase().match(/^([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}$/)?.[1] ?? null
const postcodeArea = (pc: string | null | undefined) => outward(pc)?.match(/^[A-Z]+/)?.[0] ?? null

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

function link(citySlug: string, v: GuideVenue): string {
  const label = v.name.replace(/[\[\]()]/g, '').trim()
  return `[${label}](/soft-play/${citySlug}/${v.slug})`
}

/** "[A](/…) (M14), [B](/…) (M20) and 3 more" — most-reviewed first, so the choice is data, not taste. */
function nameList(citySlug: string, venues: GuideVenue[], limit = 8): string {
  const sorted = [...venues].sort((a, b) => Number(b.review_count ?? 0) - Number(a.review_count ?? 0) || a.name.localeCompare(b.name))
  const shown = sorted.slice(0, limit).map((v) => {
    const d = outward(v.postcode)
    return `${link(citySlug, v)}${d ? ` (${d})` : ''}`
  })
  const more = sorted.length - shown.length
  const parts = more > 0 ? [...shown, `${more} more`] : shown
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * The guide for a hub in DATA_GUIDES, from its main-list venues; undefined for any other hub or if
 * there are fewer than 4 venues. `blog` is the hub's own "best of" post, linked as editorial picks.
 */
export function buildDataGuide(
  citySlug: string,
  cityName: string,
  venues: GuideVenue[],
  blog?: { slug: string; title: string } | null
): HubGuide | undefined {
  const cfg = DATA_GUIDES[citySlug]
  if (!cfg || venues.length < 4) return undefined

  const n = venues.length
  const nameable = cfg.allow ? venues.filter((v) => cfg.allow!.test(outward(v.postcode) ?? '')) : venues
  const toddler = nameable.filter((v) => v.toddler_area)
  const baby = nameable.filter((v) => v.baby_area && !v.toddler_area)
  const parties = nameable.filter((v) => v.parties)
  const sen = nameable.filter((v) => v.sen_friendly)
  const top = rankTopRated(nameable, 5)
  const sections: GuideSection[] = []
  // When only some listings can be named (the rest have a postcode outside the hub's area), say so
  // rather than implying the named venues are all of them.
  const inCity = nameable.length < n ? `${cityName}'s own postcodes` : cityName

  // 1. overview
  const counts: string[] = []
  const nT = venues.filter((v) => v.toddler_area).length
  const nB = venues.filter((v) => v.baby_area).length
  const nP = venues.filter((v) => v.parties).length
  const nS = venues.filter((v) => v.sen_friendly).length
  if (nT) counts.push(`${nT} ${nT === 1 ? 'lists' : 'list'} a toddler area`)
  if (nB) counts.push(`${nB} ${nB === 1 ? 'lists' : 'list'} a baby area`)
  if (nP) counts.push(`${nP} ${nP === 1 ? 'offers' : 'offer'} birthday parties`)
  if (nS) counts.push(`${nS} ${nS === 1 ? 'is' : 'are'} marked SEN-friendly`)
  const countText = counts.length <= 1 ? counts.join('') : `${counts.slice(0, -1).join(', ')} and ${counts[counts.length - 1]}`
  const overview = [
    `We list ${plural(n, 'soft play centre')} in ${cityName}${counts.length ? `. Of those, ${countText}` : ''}.`,
  ]
  if (!cfg.londonAreas) {
    const byDistrict = new Map<string, number>()
    for (const v of venues) {
      const d = outward(v.postcode)
      if (d) byDistrict.set(d, (byDistrict.get(d) ?? 0) + 1)
    }
    const busiest = [...byDistrict.entries()].filter(([, k]) => k >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4)
    if (busiest.length >= 2) overview.push(`The postcode districts with the most listings are ${busiest.map(([d, k]) => `${d} (${k})`).join(', ')}.`)
  }
  if (blog) overview.push(`For our editorial picks, read [${blog.title}](/blog/${blog.slug}); this page is the complete, current list.`)
  sections.push({ heading: `Soft play in ${cityName}: a local guide`, paragraphs: [overview.join(' ')] })

  // 2. London areas (postcode prefixes from lib/londonAreas.ts)
  if (cfg.londonAreas) {
    const lines: string[] = []
    for (const area of LONDON_AREAS) {
      const inArea = venues.filter((v) => getLondonAreaSlug(v.postcode) === area.slug)
      if (!inArea.length) continue
      const prefixes = [...new Set(inArea.map((v) => postcodeArea(v.postcode)).filter((x): x is string => !!x))].sort()
      lines.push(`${area.name} (${prefixes.join(', ')}): ${plural(inArea.length, 'centre')}, including ${nameList(citySlug, inArea, 3)}.`)
    }
    if (lines.length) sections.push({ heading: `Soft play in London by area`, paragraphs: lines })
  }

  // 3. toddlers and babies
  if (toddler.length || baby.length) {
    const p: string[] = []
    if (toddler.length) p.push(`${plural(toddler.length, 'venue')} in ${inCity} ${toddler.length === 1 ? 'lists' : 'list'} a toddler area: ${nameList(citySlug, toddler)}.`)
    if (baby.length) p.push(`${baby.length === 1 ? 'Another lists' : `${baby.length} more list`} a baby area: ${nameList(citySlug, baby)}.`)
    sections.push({ heading: 'Babies and toddlers', paragraphs: p })
  }

  // 4. parties
  if (parties.length) {
    sections.push({
      heading: 'Birthday parties',
      paragraphs: [`${plural(parties.length, 'venue')} in ${inCity} ${parties.length === 1 ? 'is' : 'are'} listed as offering birthday parties: ${nameList(citySlug, parties)}. Packages and prices are set by each venue, so ask them for a current quote.`],
    })
  }

  // 5. SEN
  if (sen.length) {
    sections.push({
      heading: 'SEN-friendly soft play',
      paragraphs: [`${plural(sen.length, 'venue')} in ${inCity} ${sen.length === 1 ? 'is' : 'are'} listed as SEN-friendly: ${nameList(citySlug, sen)}. What that means varies — quiet sessions, sensory rooms, smaller groups — so ask the venue what it offers and when.`],
    })
  }

  // 6. best rated
  if (top.length) {
    const bySlug = new Map(nameable.map((v) => [v.slug, v]))
    const items = top.map((t) => `${link(citySlug, bySlug.get(t.slug)!)} ${t.rating.toFixed(1)} from ${t.reviews.toLocaleString('en-GB')} reviews`)
    sections.push({
      heading: 'Highest rated',
      paragraphs: [`Venues with ${MIN_REVIEWS_FOR_TOP_RATED} or more reviews, best rated first: ${items.join('; ')}.`],
    })
  }

  return { kind: 'listings', sections, faqs: [], nearbyHubs: cfg.nearbyHubs }
}
