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
  /** The name the hub's title, H1 and FAQ use when it differs from the city name ("Brighton & Hove"). */
  areaName?: string
  /**
   * Which of the generic data FAQs (lib/cityContent.ts buildCityFaqs) to keep, matched on the question.
   * Unset: the generic FAQ fills whatever room the guide's own FAQs leave (up to MAX_FAQS).
   */
  keepGenericFaqs?: RegExp[]
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

/** Prices quoted below were read from each venue's own website on this date. */
export const PRICES_ON = '27 October 2026'
/** Opening hours quoted in the FAQs below are as listed on the venue pages on this date. */
export const HOURS_ON = '16 November 2026'

const GUIDES: Record<string, HubGuide> = {
  worthing: {
    keepGenericFaqs: [/^How many soft play/, /^How much does soft play cost/],
    nearbyHubs: [
      { slug: 'brighton', label: 'Brighton & Hove' },
      { slug: 'bognor-regis', label: 'Bognor Regis' },
    ],
    sections: [
      {
        heading: 'Soft play in Worthing: what is here',
        paragraphs: [
          "Worthing's soft play is independent and community-run rather than big chains, and it is spread along the coast rather than in the town centre. In Worthing itself we list [Hope Hive](/soft-play/worthing/hope-hive) on St Dunstan's Road and [The Lighthouse](/soft-play/worthing/the-lighthouse-soft-play-and-cafe) on South Farm Road; [Space Station](/soft-play/worthing/space-station-soft-play-ltd) is a few minutes east in Lancing, and [The Little Play Village](/soft-play/worthing/the-little-play-village), a ticketed role-play village, is in Goring-by-Sea.",
          "The two biggest venues are just outside the town and are listed under nearby towns below: [Out of Bounds](/soft-play/worthing/out-of-bounds) in Angmering and [Harbour Park](/soft-play/worthing/harbour-park-indoor-soft-play) in Littlehampton. [Flying Fortress](/soft-play/bognor-regis/flying-fortress) at Ford, further west, is listed under [soft play in Bognor Regis](/soft-play/bognor-regis).",
        ],
      },
      {
        heading: 'Babies and toddlers',
        paragraphs: [
          "Space Station in Lancing describes its play centre as for ages 0–12 and runs timed sessions; it takes walk-ins but can't guarantee a space when full, so ring ahead. Harbour Park in Littlehampton has a separate baby soft play for 0–18 months and says you can pay on arrival without booking. Out of Bounds in Angmering runs a pre-school Climb 'n' Soft Play session. The Lighthouse lists entry prices for babies from birth.",
        ],
      },
      {
        heading: 'Older children',
        paragraphs: [
          "Out of Bounds combines soft play with ten-pin bowling, laser tag, high ropes and adventure golf, so it suits a mixed-age group. Harbour Park's soft play is for children up to 9. Flying Fortress at Ford prices children up to age 13.",
        ],
      },
      {
        heading: 'Birthday parties',
        paragraphs: [
          "Space Station has two party rooms and a private hire option. The Lighthouse lists party bookings on its site, and Out of Bounds and Harbour Park each publish party information. The Little Play Village in Goring also runs parties. Packages and prices change, so check the venue's own page before you book.",
        ],
      },
      {
        heading: 'Trampoline parks near Worthing',
        paragraphs: [
          "We don't list a trampoline park in Worthing. The nearest we list is [Flip Out Chichester](/soft-play/chichester/flip-out-chichester), about 17 miles west in a straight line. For bouncing closer to home, Out of Bounds in Angmering has high ropes and laser tag alongside its soft play.",
        ],
      },
      {
        heading: 'Rainy days and opening days',
        paragraphs: [
          "All of these are indoors. Opening days differ: The Lighthouse's website lists Wednesday to Friday only, and Hope Hive is open mornings to early afternoon. Check before you set off.",
          "Heading east? See [soft play in Brighton](/soft-play/brighton) and Hove.",
        ],
      },
    ],
    faqs: [
      {
        question: 'Which soft play in Worthing is best for toddlers?',
        answer:
          "For babies, Harbour Park in Littlehampton has a separate baby soft play for 0–18 months, and The Lighthouse in Worthing lists entry prices from birth. Space Station in Lancing is for ages 0–12 and runs timed sessions, and Out of Bounds in Angmering runs a pre-school Climb 'n' Soft Play session.",
      },
      {
        question: 'Is any soft play near Worthing open late?',
        answer:
          `Out of Bounds in Angmering is the latest we list: until 8pm on Fridays and Saturdays (6pm other days, closed Mondays). Harbour Park in Littlehampton is open until 7pm on Mondays and 6pm the rest of the week. In Worthing and Lancing, Space Station closes at 5:15pm (3:15pm Monday to Wednesday), The Lighthouse at 5pm at the latest, and Hope Hive closes by 1:30pm. Hours as listed on ${HOURS_ON}; they change in school holidays, so check before you go.`,
      },
      {
        question: 'Is there SEN-friendly soft play in Worthing?',
        answer:
          "Hope Hive on St Dunstan's Road in Worthing is listed with SEN sessions. Ask the venue which sessions are quieter or SEN-only, and when.",
      },
      {
        question: 'Where can I have a kids party in Worthing?',
        answer:
          "Space Station in Lancing has two party rooms and a private hire option, and The Lighthouse in Worthing lists party bookings on its website. Out of Bounds (Angmering), Harbour Park (Littlehampton) and The Little Play Village (Goring) also publish party information, and Flying Fortress at Ford (listed under Bognor Regis) does too. Packages and prices are set by each venue, so check their pages for current details.",
      },
      {
        question: 'Are there trampoline parks in Worthing?',
        answer:
          "Not one we list. The nearest trampoline park we list is Flip Out Chichester, about 17 miles west. Out of Bounds in Angmering has high ropes, laser tag and bowling alongside soft play.",
      },
    ],
  },

  brighton: {
    areaName: 'Brighton & Hove',
    keepGenericFaqs: [/^How many soft play/],
    nearTowns: [{ name: 'Peacehaven', lat: 50.7934, lng: -0.0045 }],
    nearbyHubs: [
      { slug: 'worthing', label: 'Worthing' },
      { slug: 'hastings', label: 'Hastings & Eastbourne' },
    ],
    sections: [
      {
        heading: 'Soft play in Brighton & Hove: what is here',
        paragraphs: [
          "Brighton & Hove has few big soft play centres, so it helps to know what is where. Inside the city we list three soft play centres: [Level Up](/soft-play/brighton/level-up-soft-play) at Withdean Sports Complex, [Funplex](/soft-play/brighton/funplex) on the Hyde Business Park off Auckland Drive (BN2), and [Palace Play](/soft-play/brighton/palace-play) on Brighton Palace Pier. Three community venues run weekly soft play sessions: [Hangleton Community Centre](/soft-play/brighton/hangleton-community-centre-soft-play) in Hove, [Old Boat Corner](/soft-play/brighton/old-boat-corner-soft-play) in Hollingbury and [King Alfred Leisure Centre](/soft-play/brighton/king-alfred-soft-play-sessions) on the Hove seafront.",
          "We don't list a soft play venue in Portslade or Shoreham-by-Sea; the nearest are [Two by Two](/soft-play/brighton/two-by-two-softplay) in Southwick and the Hove sessions. The larger venues families drive to are in Peacehaven, Lewes, Henfield, Burgess Hill and near Uckfield, listed under nearby towns below. Playcafé, a term-time toddler café at St Matthias Church, and FunPlay Leisure at Brighton Marina are listed under other family activities.",
        ],
      },
      {
        heading: 'Prices: the cheapest soft play in Brighton',
        paragraphs: [
          `The community sessions are the cheapest: Hangleton Community Centre lists soft play from 9:30am to 2pm, Monday to Friday, at £2 per family; Old Boat Corner lists Tuesday and Wednesday mornings (9:30am–12pm) at £3.50; and King Alfred Leisure Centre lists Tuesday (9am–12:30pm) and Friday sessions from £5.25 for one child. Of the centres, Palace Play charges £6.50 under 0.9m and £9 over 0.9m for all day (nobody over 1.5m), and Funplex charges £7.45 in term time and £9.95 at peak times (weekends, inset days and school holidays), plus £2.25 per adult. Prices as published by each venue on ${PRICES_ON}; check before you travel.`,
        ],
      },
      {
        heading: 'Toddlers and babies',
        paragraphs: [
          "Level Up at Withdean has a main play frame and a sensory toddler zone for ages 0–3; sessions last 1 hour 30 minutes and socks must be worn. Funplex has multi-level play frames, three slides, a four-cannon ball area and a two-level toddler area. [Meridian Mayhem](/soft-play/brighton/meridian-mayhem) in Peacehaven has a baby and toddler zone for children aged 5 and under. [The Doves Play Barn](/soft-play/brighton/the-doves-play-barn) at Furner's Green, near Uckfield, describes a toddler-safe area alongside hidden spaces, rope bridges and slides, with a café, and says it is open seven days a week, 9am to 5pm.",
        ],
      },
      {
        heading: 'SEN-friendly sessions',
        paragraphs: [
          "Level Up runs SEN sessions, and Meridian Mayhem in Peacehaven runs SEND sessions. [Sharky's](/soft-play/brighton/sharkys), at Henfield Leisure Centre, lists SEN sessions on the first and third Thursday of each month and is a nut-free site with a café; its website says sessions are often fully booked, so book ahead.",
        ],
      },
      {
        heading: 'Birthday parties',
        paragraphs: [
          "Level Up has party rooms. Meridian Mayhem in Peacehaven publishes four party packages and has a first-floor café; it recommends booking online at weekends and in school holidays. [Monkey Bizness in Lewes](/soft-play/brighton/monkey-bizness-lewes) publishes three party packages (Funky Monkey, Mega Monkey and Pizza Party), each for a minimum of 12 children and 2 hours, with 90 minutes of play. Sharky's, The Doves Play Barn and [Jumpin Fun in Burgess Hill](/soft-play/brighton/jumpin-fun-inflatable-park-burgess-hill) also have party pages. Check the venue's site for current prices.",
        ],
      },
      {
        heading: 'Trampoline parks in Brighton',
        paragraphs: [
          "There is no open trampoline park in Brighton & Hove that we can confirm. Sky High Trampoline Park in Peacehaven is shown by Google as permanently closed; the indoor play centre Meridian Mayhem now operates in Peacehaven. The nearest venue with trampolines that we list is [Fun Abounds Trampoline & Gymnastics Centre](/soft-play/brighton/fun-abounds-trampoline-gymnastics-centre) in Uckfield, about 14 miles north-east in a straight line; check its website for which sessions are open to the public.",
          "For bouncing nearer the city, Jumpin Fun in Burgess Hill is a 25,000 sq ft inflatable park with a mega slide, ball pit and ninja course. It is an inflatable park, not a trampoline park.",
        ],
      },
      {
        heading: 'Looking west?',
        paragraphs: [
          "Several well-regarded centres are nearer Worthing than Brighton, in Lancing, Angmering and Littlehampton: see [soft play in Worthing](/soft-play/worthing).",
        ],
      },
    ],
    faqs: [
      {
        question: "What's the cheapest soft play in Brighton?",
        answer:
          `The weekly community sessions: Hangleton Community Centre in Hove at £2 per family (Monday to Friday, 9:30am–2pm), Old Boat Corner in Hollingbury at £3.50 (Tuesday and Wednesday mornings) and King Alfred Leisure Centre from £5.25 for one child. Of the soft play centres, Palace Play starts at £6.50 for under-0.9m children and Funplex at £7.45 in term time. Prices as published on ${PRICES_ON}.`,
      },
      {
        question: 'Which soft play in Brighton is best for toddlers?',
        answer:
          "Level Up at Withdean has a sensory toddler zone for ages 0–3, and Funplex has a two-level toddler area. Just outside the city, Meridian Mayhem in Peacehaven has a baby and toddler zone for under-5s, and The Doves Play Barn near Uckfield describes a toddler-safe area with a café. Hangleton Community Centre's weekday sessions are an inexpensive option for little ones.",
      },
      {
        question: 'Is any soft play in Brighton open late?',
        answer:
          `Level Up at Withdean is open latest inside the city: 9am–7:30pm Monday to Friday and 9am–6pm on Saturday. Funplex is open 10am–6pm every day, and Palace Play 11am–5pm on weekdays and 10am–6pm at weekends. Nearby, Monkey Bizness in Lewes and Magic Castle at Peacehaven Leisure Centre are open until 6pm every day. Hours as listed on ${HOURS_ON}; they change in school holidays, so check before you go.`,
      },
      {
        question: 'Is there SEN-friendly soft play in Brighton?',
        answer:
          "Level Up at Withdean runs SEN sessions, and Meridian Mayhem in Peacehaven runs SEND sessions. Sharky's at Henfield Leisure Centre lists SEN sessions on the first and third Thursday of each month; they are often fully booked, so book ahead.",
      },
      {
        question: 'Where can I have a kids party in Brighton?',
        answer:
          "Level Up at Withdean has party rooms, and Funplex and Palace Play are both listed for parties. Meridian Mayhem in Peacehaven publishes four party packages, and Monkey Bizness in Lewes three (each for a minimum of 12 children). Sharky's in Henfield, The Doves Play Barn near Uckfield and Jumpin Fun in Burgess Hill also have party pages. Prices and availability are set by each venue.",
      },
      {
        question: 'Are there trampoline parks in Brighton?',
        answer:
          "Not one we can confirm as open. Sky High Trampoline Park in Peacehaven is shown by Google as permanently closed. The nearest venue with trampolines we list is Fun Abounds Trampoline & Gymnastics Centre in Uckfield, about 14 miles away; Jumpin Fun in Burgess Hill is an inflatable park, not a trampoline park.",
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

/** `Soft Play in Brighton & Hove: 6 Indoor Play Centres (2026)` — N is the live main-list count. */
export function buildGuideTitle(name: string, total: number, year: number): string {
  if (total <= 0) return `Soft Play in ${name}`
  return `Soft Play in ${name}: ${total} Indoor Play ${total === 1 ? 'Centre' : 'Centres'} (${year})`
}

/**
 * A guide hub's FAQ: the generic data questions it keeps (keepGenericFaqs), then its own.
 * Without keepGenericFaqs, the generic list fills the room the guide's FAQs leave. Capped at MAX_FAQS.
 */
export function composeGuideFaqs(guide: HubGuide, generic: Faq[]): Faq[] {
  const hasParty = guide.faqs.some((f) => /part(y|ies)/i.test(f.question))
  const kept = guide.keepGenericFaqs
    ? generic.filter((f) => guide.keepGenericFaqs!.some((re) => re.test(f.question)))
    : generic.filter((f) => !(hasParty && /birthday party/i.test(f.question))).slice(0, Math.max(0, MAX_FAQS - guide.faqs.length))
  return [...kept, ...guide.faqs].slice(0, MAX_FAQS)
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
